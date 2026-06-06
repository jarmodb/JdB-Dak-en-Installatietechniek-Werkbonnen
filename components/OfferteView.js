'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// ── Constanten ───────────────────────────────────────────────────────
const STATUS = {
  concept:      { label: 'Concept',      kleur: '#888',    bg: '#f5f5f5', rand: '#d9d9d9' },
  verstuurd:    { label: 'Verstuurd',    kleur: '#096DD9', bg: '#e6f4ff', rand: '#91caff' },
  geaccepteerd: { label: 'Geaccepteerd', kleur: '#389E0D', bg: '#f6ffed', rand: '#b7eb8f' },
  afgewezen:    { label: 'Afgewezen',    kleur: '#D4380D', bg: '#fff1f0', rand: '#ffccc7' },
}

const BTW_OPTIES = [0, 9, 21]
const EENHEDEN = ['stuk', 'm²', 'meter', 'liter', 'kg', 'uur', 'set', 'rol', 'doos', 'pak']

const VARIABELEN = [
  { key: '{klant_naam}',       label: 'Klantnaam' },
  { key: '{datum}',            label: 'Datum' },
  { key: '{geldig_tot}',       label: 'Geldig tot' },
  { key: '{uren}',             label: 'Uren' },
  { key: '{uurtarief}',        label: 'Uurtarief' },
  { key: '{arbeidskosten}',    label: 'Arbeidskosten' },
  { key: '{subtotaal}',        label: 'Subtotaal' },
  { key: '{btw_bedrag}',       label: 'BTW bedrag' },
  { key: '{totaal}',           label: 'Totaal incl. BTW' },
  { key: '{materialen_lijst}', label: 'Materialen als tekst' },
]

// ── Helpers ──────────────────────────────────────────────────────────
function euro(n) { return '€ ' + Number(n || 0).toFixed(2).replace('.', ',') }
function datumNL(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}` }
function vandaag() { return new Date().toISOString().split('T')[0] }
function addDagen(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0] }

function genNummer(offertes, prefix = 'OFN') {
  const jaar = new Date().getFullYear()
  const p = `${prefix}-${jaar}-`
  const nrs = offertes.filter(o => o.nummer?.startsWith(p)).map(o => parseInt(o.nummer.replace(p, '')) || 0)
  return `${p}${String((nrs.length ? Math.max(...nrs) : 0) + 1).padStart(3, '0')}`
}

function berekenTotalen(form) {
  const materialen = form.materialen || []
  const subtotaalMat = materialen.reduce((s, m) => s + (parseFloat(m.aantal) || 0) * (parseFloat(m.stukprijs) || 0), 0)
  const arbeidskosten = (parseFloat(form.uren) || 0) * (parseFloat(form.uurtarief) || 0)
  const subtotaal = subtotaalMat + arbeidskosten
  const btw_bedrag = subtotaal * (parseFloat(form.btw_percentage ?? 21) / 100)
  const totaal = subtotaal + btw_bedrag
  return { subtotaalMat, arbeidskosten, subtotaal, btw_bedrag, totaal }
}

function materiaaltekst(materialen) {
  return (materialen || []).filter(m => m.naam).map(m =>
    `- ${m.naam}: ${m.aantal} ${m.eenheid || 'stuk'} à ${euro(m.stukprijs)}`
  ).join('\n')
}

function verwerkVariabelen(tekst, form) {
  if (!tekst) return ''
  const t = berekenTotalen(form)
  return tekst
    .replace(/{klant_naam}/g, form.klant_naam || '')
    .replace(/{datum}/g, datumNL(form.datum))
    .replace(/{geldig_tot}/g, datumNL(form.geldig_tot))
    .replace(/{uren}/g, String(form.uren || '0'))
    .replace(/{uurtarief}/g, euro(form.uurtarief))
    .replace(/{arbeidskosten}/g, euro(t.arbeidskosten))
    .replace(/{subtotaal}/g, euro(t.subtotaal))
    .replace(/{btw_bedrag}/g, euro(t.btw_bedrag))
    .replace(/{totaal}/g, euro(t.totaal))
    .replace(/{materialen_lijst}/g, materiaaltekst(form.materialen))
}

// ── Klant autocomplete ────────────────────────────────────────────────
function KlantAC({ waarde, klanten, onChange, onSelect }) {
  const [open, setOpen] = useState(false)
  const filtered = waarde ? klanten.filter(k => k.naam.toLowerCase().includes(waarde.toLowerCase())).slice(0, 5) : []
  return (
    <div className="autocomplete">
      <input value={waarde} onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Zoek klant of typ naam..." />
      {open && filtered.length > 0 && (
        <div className="autocomplete-dropdown">
          {filtered.map(k => (
            <div key={k.id} className="autocomplete-optie" onMouseDown={() => { onSelect(k); setOpen(false) }}>
              <div>{k.naam}</div>
              {k.adres && <div className="autocomplete-optie-sub">{[k.adres, k.postcode, k.plaats].filter(Boolean).join(' ')}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Materiaal autocomplete ────────────────────────────────────────────
function MateriaalAC({ waarde, producten, onChange, onSelect }) {
  const [open, setOpen] = useState(false)
  const filtered = waarde
    ? producten.filter(p => p.naam.toLowerCase().includes(waarde.toLowerCase())).slice(0, 6)
    : []
  return (
    <div className="autocomplete" style={{ width: '100%' }}>
      <input
        value={waarde}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Naam materiaal"
        style={{ width: '100%' }}
      />
      {open && filtered.length > 0 && (
        <div className="autocomplete-dropdown">
          {filtered.map(p => (
            <div key={p.id} className="autocomplete-optie" onMouseDown={() => { onSelect(p); setOpen(false) }}>
              <div>{p.naam}</div>
              <div className="autocomplete-optie-sub">
                {[p.eenheid, p.prijs != null ? euro(p.prijs) : null].filter(Boolean).join(' · ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Print view ────────────────────────────────────────────────────────
function OffertePrint({ offerte, instellingen = {} }) {
  const t = berekenTotalen(offerte)
  const tekst = verwerkVariabelen(offerte.tekst, offerte)
  const bedrijfsnaam = instellingen.bedrijfsnaam || 'JdB Dak- en Installatietechniek'
  const logoUrl = instellingen.logo_url || '/logo.png'
  return (
    <div className="offerte-print">
      <div className="offerte-print-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={logoUrl} alt="Logo" style={{ height: 56, objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
          <div>
            <div className="offerte-print-bedrijf">{bedrijfsnaam}</div>
            <div className="offerte-print-sub" style={{ lineHeight: 1.6 }}>
              {instellingen.adres && <span>{instellingen.adres}{(instellingen.postcode || instellingen.plaats) ? ', ' + [instellingen.postcode, instellingen.plaats].filter(Boolean).join(' ') : ''}</span>}
              {instellingen.telefoon && <><br />{instellingen.telefoon}</>}
              {instellingen.email && <> · {instellingen.email}</>}
              {instellingen.website && <><br />{instellingen.website}</>}
            </div>
          </div>
        </div>
        <div className="offerte-print-nummers">
          <div><strong>Nummer:</strong> {offerte.nummer}</div>
          <div><strong>Datum:</strong> {datumNL(offerte.datum)}</div>
          {offerte.geldig_tot && <div><strong>Geldig tot:</strong> {datumNL(offerte.geldig_tot)}</div>}
          {offerte.naam && <div style={{ marginTop: 4, fontWeight: 700, color: '#1a1a1a' }}>{offerte.naam}</div>}
        </div>
      </div>

      <div className="offerte-print-klant">
        <strong>{offerte.klant_naam}</strong>
        {offerte.klant_adres && <div>{offerte.klant_adres}</div>}
        {(offerte.klant_postcode || offerte.klant_plaats) && <div>{[offerte.klant_postcode, offerte.klant_plaats].filter(Boolean).join(' ')}</div>}
        {offerte.klant_email && <div>{offerte.klant_email}</div>}
      </div>

      {tekst && (
        <div className="offerte-print-tekst">
          {tekst.split('\n').map((r, i) => <p key={i} style={{ margin: '0 0 4px' }}>{r || <br />}</p>)}
        </div>
      )}

      {offerte.materialen_tonen && (offerte.materialen || []).some(m => m.naam) && (
        <div className="offerte-print-sectie">
          <div className="offerte-print-sectie-titel">Specificatie materialen</div>
          <table className="offerte-print-tabel">
            <thead>
              <tr>
                <th>Omschrijving</th>
                <th style={{ textAlign: 'center' }}>Aantal</th>
                <th>Eenheid</th>
                <th style={{ textAlign: 'right' }}>Stukprijs</th>
                <th style={{ textAlign: 'right' }}>Totaal</th>
              </tr>
            </thead>
            <tbody>
              {(offerte.materialen || []).filter(m => m.naam).map((m, i) => (
                <tr key={i}>
                  <td>{m.naam}</td>
                  <td style={{ textAlign: 'center' }}>{m.aantal}</td>
                  <td>{m.eenheid || 'stuk'}</td>
                  <td style={{ textAlign: 'right' }}>{euro(m.stukprijs)}</td>
                  <td style={{ textAlign: 'right' }}>{euro((parseFloat(m.aantal) || 0) * (parseFloat(m.stukprijs) || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="offerte-print-totalen">
        {t.arbeidskosten > 0 && (
          <div className="offerte-print-totaal-rij">
            <span>Arbeid ({offerte.uren} uur × {euro(offerte.uurtarief)})</span>
            <span>{euro(t.arbeidskosten)}</span>
          </div>
        )}
        {t.subtotaalMat > 0 && t.arbeidskosten > 0 && (
          <div className="offerte-print-totaal-rij">
            <span>Materialen</span>
            <span>{euro(t.subtotaalMat)}</span>
          </div>
        )}
        <div className="offerte-print-totaal-rij">
          <span>Subtotaal (excl. BTW)</span>
          <span>{euro(t.subtotaal)}</span>
        </div>
        <div className="offerte-print-totaal-rij">
          <span>BTW ({offerte.btw_percentage}%)</span>
          <span>{euro(t.btw_bedrag)}</span>
        </div>
        <div className="offerte-print-totaal-rij totaal">
          <span><strong>Totaal (incl. BTW)</strong></span>
          <span><strong>{euro(t.totaal)}</strong></span>
        </div>
      </div>

      {offerte.notities && (
        <div className="offerte-print-notities"><strong>Notities:</strong> {offerte.notities}</div>
      )}

      <div className="offerte-print-footer">
        <p>Wij vertrouwen erop u hiermee een passend aanbod te hebben gedaan. Voor vragen kunt u contact met ons opnemen.</p>
        {(instellingen.kvk_nummer || instellingen.btw_nummer || instellingen.iban) && (
          <p style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
            {instellingen.kvk_nummer && `KVK: ${instellingen.kvk_nummer}`}
            {instellingen.btw_nummer && ` · BTW: ${instellingen.btw_nummer}`}
            {instellingen.iban && ` · IBAN: ${instellingen.iban}`}
          </p>
        )}
        <div className="offerte-print-akkoord">
          <div>
            <div className="offerte-akkoord-lijn" />
            <div className="offerte-akkoord-label">Naam</div>
          </div>
          <div>
            <div className="offerte-akkoord-lijn" />
            <div className="offerte-akkoord-label">Datum</div>
          </div>
          <div>
            <div className="offerte-akkoord-lijn" />
            <div className="offerte-akkoord-label">Handtekening</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Werkbon modal ─────────────────────────────────────────────────────
function WerkbonModal({ offerte, onAanmaken, onSluiten }) {
  const [keuzes, setKeuzes] = useState({ klant: true, omschrijving: true, materialen: true })
  const aantalMat = (offerte.materialen || []).filter(m => m.naam).length
  return (
    <div className="modal-overlay" onClick={onSluiten}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-titel">Werkbon aanmaken uit offerte</div>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>Kies wat je wilt overnemen:</p>
        {[
          { key: 'klant', label: 'Klantgegevens', sub: offerte.klant_naam },
          { key: 'omschrijving', label: 'Omschrijving', sub: offerte.tekst ? (verwerkVariabelen(offerte.tekst, offerte)).slice(0, 70) + '…' : null },
          { key: 'materialen', label: `Materialen`, sub: aantalMat > 0 ? `${aantalMat} item${aantalMat !== 1 ? 's' : ''}` : 'Geen materialen' },
        ].map(opt => (
          <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}>
            <input type="checkbox" checked={keuzes[opt.key]} onChange={() => setKeuzes(v => ({ ...v, [opt.key]: !v[opt.key] }))}
              style={{ width: 18, height: 18, accentColor: '#C9A227', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{opt.label}</div>
              {opt.sub && <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>{opt.sub}</div>}
            </div>
          </label>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button className="btn btn-licht" style={{ flex: 1 }} onClick={onSluiten}>Annuleren</button>
          <button className="btn btn-primair" style={{ flex: 1 }} onClick={() => onAanmaken(keuzes)}>📋 Werkbon aanmaken</button>
        </div>
      </div>
    </div>
  )
}

// ── E-mail modal ──────────────────────────────────────────────────────
function EmailModal({ offerte, onVerstuur, onSluiten, bezig }) {
  const [email, setEmail] = useState(offerte.klant_email || '')
  const [bericht, setBericht] = useState(
    `Geachte ${offerte.klant_naam || 'heer/mevrouw'},\n\nHierbij ontvangt u onze offerte ${offerte.nummer}.\n\nWij hopen u hiermee een passend aanbod te hebben gedaan. Neem gerust contact op voor vragen.\n\nMet vriendelijke groet,\nJdB Dak- en Installatietechniek`
  )
  return (
    <div className="modal-overlay" onClick={onSluiten}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="modal-titel">Offerte versturen per e-mail</div>
        <div className="veld">
          <label>E-mailadres ontvanger *</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="klant@voorbeeld.nl" />
        </div>
        <div className="veld">
          <label>Begeleidend bericht</label>
          <textarea value={bericht} onChange={e => setBericht(e.target.value)} rows={6} style={{ resize: 'vertical' }} />
        </div>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
          De offerte wordt als nette HTML-mail verstuurd vanuit jdbtechniek@gmail.com. De status wordt automatisch gewijzigd naar "Verstuurd".
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-licht" style={{ flex: 1 }} onClick={onSluiten} disabled={bezig}>Annuleren</button>
          <button className="btn btn-primair" style={{ flex: 1 }} onClick={() => onVerstuur(email, bericht)} disabled={!email || bezig}>
            {bezig ? 'Versturen...' : '✉️ Verstuur offerte'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sjablonen beheer ──────────────────────────────────────────────────
function SjablonenView({ onTerug }) {
  const [sjablonen, setSjablonen] = useState([])
  const [form, setForm] = useState(null)
  const tekstRef = useRef(null)

  useEffect(() => { laad() }, [])
  async function laad() { const { data } = await supabase.from('offerte_sjablonen').select('*').order('naam'); setSjablonen(data || []) }

  function nieuw() { setForm({ naam: '', werktype: '', tekst: '' }) }
  function bewerk(s) { setForm({ ...s }) }

  async function opslaan() {
    if (!form.naam?.trim()) return
    const { id, ...data } = form
    if (id) await supabase.from('offerte_sjablonen').update(data).eq('id', id)
    else await supabase.from('offerte_sjablonen').insert(data)
    setForm(null); laad()
  }

  async function verwijder(id) {
    if (!window.confirm('Sjabloon verwijderen?')) return
    await supabase.from('offerte_sjablonen').delete().eq('id', id)
    laad()
  }

  function invoegVar(v) {
    const el = tekstRef.current
    if (!el) return
    const start = el.selectionStart, end = el.selectionEnd
    const nieuw = form.tekst.slice(0, start) + v + form.tekst.slice(end)
    setForm(f => ({ ...f, tekst: nieuw }))
    setTimeout(() => { el.focus(); el.setSelectionRange(start + v.length, start + v.length) }, 0)
  }

  if (form !== null) {
    return (
      <div className="view-content form-content with-bottom-nav">
        <div className="top-acties">
          <button className="form-terug" onClick={() => setForm(null)}>← Terug</button>
          <button className="btn btn-primair" onClick={opslaan}>✓ Opslaan</button>
        </div>
        <div className="sectie">
          <div className="sectie-titel">{form.id ? 'Sjabloon bewerken' : 'Nieuw sjabloon'}</div>
          <div className="veld">
            <label>Naam *</label>
            <input value={form.naam} onChange={e => setForm(f => ({ ...f, naam: e.target.value }))} placeholder="Bijv. Dakbedekking standaard" />
          </div>
          <div className="veld">
            <label>Werktype (optioneel)</label>
            <input value={form.werktype || ''} onChange={e => setForm(f => ({ ...f, werktype: e.target.value }))} placeholder="Bijv. Dakbedekking" />
          </div>
          <div className="veld">
            <label>Tekst</label>
            <div style={{ marginBottom: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {VARIABELEN.map(v => (
                <button key={v.key} onClick={() => invoegVar(v.key)}
                  style={{ fontSize: 11, background: '#f5ebc4', border: '1px solid #C9A227', borderRadius: 4, padding: '2px 7px', cursor: 'pointer' }}>
                  {v.label}
                </button>
              ))}
            </div>
            <textarea ref={tekstRef} value={form.tekst || ''} onChange={e => setForm(f => ({ ...f, tekst: e.target.value }))}
              rows={12} placeholder="Schrijf de standaard tekst. Klik op een variabele om die in te voegen." style={{ resize: 'vertical' }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="view-content form-content with-bottom-nav">
      <div className="top-acties">
        <button className="form-terug" onClick={onTerug}>← Terug</button>
        <button className="btn btn-primair" onClick={nieuw}>+ Sjabloon</button>
      </div>
      <div className="sectie">
        <div className="sectie-titel">Tekst-sjablonen</div>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>
          Maak standaard teksten per werktype. Variabelen worden automatisch ingevuld vanuit de offerte.
        </p>
        {sjablonen.length === 0 ? (
          <div className="leeg"><p>Nog geen sjablonen.<br />Klik op <strong>+ Sjabloon</strong> om te beginnen.</p></div>
        ) : (
          <div className="bon-lijst">
            {sjablonen.map(s => (
              <div key={s.id} className="klant-kaart">
                <div className="klant-info">
                  <div className="klant-naam">{s.naam}</div>
                  {s.werktype && <div className="klant-adres" style={{ color: '#C9A227' }}>{s.werktype}</div>}
                  {s.tekst && <div className="klant-adres" style={{ marginTop: 2 }}>{s.tekst.slice(0, 80)}…</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-licht" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => bewerk(s)}>✏️</button>
                  <button className="btn-verwijder" onClick={() => verwijder(s.id)}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Offerte formulier ─────────────────────────────────────────────────
function OfferteFormulier({ offerte, offertes, klanten, producten, sjablonen, instellingen = {}, onOpslaan, onAnnuleer }) {
  const [form, setForm] = useState(() => offerte ? { ...offerte } : {
    nummer: genNummer(offertes, instellingen.offerte_prefix || 'OFN'),
    naam: '',
    datum: vandaag(),
    geldig_tot: addDagen(vandaag(), 30),
    klant_naam: '', klant_adres: '', klant_postcode: '', klant_plaats: '', klant_email: '',
    tekst: '',
    materialen: [],
    materialen_tonen: true,
    uren: '', uurtarief: 65,
    btw_percentage: 21,
    notities: '',
    status: 'concept',
  })
  const [bezig, setBezig] = useState(false)
  const [autosaveStatus, setAutosaveStatus] = useState(null) // null | 'opslaan' | 'opgeslagen'
  const tekstRef = useRef(null)
  const autosaveTimerRef = useRef(null)
  const isEersteLaad = useRef(true)
  const DRAFT_KEY = 'offerte-draft-nieuw'

  // Concept herstellen bij nieuw formulier
  useEffect(() => {
    if (!offerte) {
      try {
        const opgeslagen = localStorage.getItem(DRAFT_KEY)
        if (opgeslagen) {
          const draft = JSON.parse(opgeslagen)
          if (draft.klant_naam && window.confirm('Er is een niet-opgeslagen concept gevonden. Doorgaan waar je gebleven was?')) {
            setForm(f => ({ ...f, ...draft }))
          } else {
            localStorage.removeItem(DRAFT_KEY)
          }
        }
      } catch {}
    }
  }, [])

  // Autosave — 2s na laatste wijziging
  useEffect(() => {
    if (isEersteLaad.current) { isEersteLaad.current = false; return }
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(async () => {
      if (form.id) {
        // Bestaande offerte → opslaan in Supabase
        setAutosaveStatus('opslaan')
        try {
          const { id, ...data } = form
          const { error } = await supabase.from('offertes').update(saniteerVoorOpslaan(data)).eq('id', id)
          if (!error) {
            setAutosaveStatus('opgeslagen')
            setTimeout(() => setAutosaveStatus(null), 2500)
          }
        } catch {}
      } else {
        // Nieuwe offerte → concept opslaan in localStorage
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(form))
          setAutosaveStatus('opgeslagen')
          setTimeout(() => setAutosaveStatus(null), 2500)
        } catch {}
      }
    }, 2000)
    return () => clearTimeout(autosaveTimerRef.current)
  }, [JSON.stringify(form)])

  function sv(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function saniteerVoorOpslaan(data) {
    return {
      ...data,
      uren: data.uren === '' || data.uren == null ? null : parseFloat(data.uren) || 0,
      uurtarief: data.uurtarief === '' || data.uurtarief == null ? null : parseFloat(data.uurtarief) || 0,
      btw_percentage: data.btw_percentage === '' || data.btw_percentage == null ? 21 : parseFloat(data.btw_percentage),
      materialen: (data.materialen || []).map(m => ({
        ...m,
        aantal: m.aantal === '' ? 0 : parseFloat(m.aantal) || 0,
        stukprijs: m.stukprijs === '' ? 0 : parseFloat(m.stukprijs) || 0,
      })),
    }
  }

  function klantSelecteren(k) {
    setForm(f => ({ ...f, klant_naam: k.naam, klant_adres: k.adres || '', klant_postcode: k.postcode || '', klant_plaats: k.plaats || '', klant_email: k.email || '' }))
  }

  function voegMateriaalToe() {
    sv('materialen', [...(form.materialen || []), { naam: '', aantal: 1, eenheid: 'stuk', stukprijs: 0 }])
  }

  function updateMateriaal(idx, k, v) {
    const m = [...(form.materialen || [])]; m[idx] = { ...m[idx], [k]: v }; sv('materialen', m)
  }

  function verwijderMateriaal(idx) {
    sv('materialen', (form.materialen || []).filter((_, i) => i !== idx))
  }

  function productSelecteren(idx, product) {
    const m = [...(form.materialen || [])]
    m[idx] = { ...m[idx], naam: product.naam, eenheid: product.eenheid || 'stuk', stukprijs: product.prijs || 0 }
    sv('materialen', m)
  }

  function invoegVar(v) {
    const el = tekstRef.current
    if (!el) return
    const start = el.selectionStart, end = el.selectionEnd
    const nieuw = form.tekst.slice(0, start) + v + form.tekst.slice(end)
    sv('tekst', nieuw)
    setTimeout(() => { el.focus(); el.setSelectionRange(start + v.length, start + v.length) }, 0)
  }

  function laadSjabloon(sjabloon) {
    if (!sjabloon) return
    if (form.tekst && !window.confirm('Huidige tekst overschrijven met sjabloon?')) return
    sv('tekst', sjabloon.tekst || '')
  }

  async function opslaan() {
    if (!form.klant_naam?.trim()) { alert('Klantnaam is verplicht'); return }
    setBezig(true)
    try {
      const { id, ...raw } = form
      const data = saniteerVoorOpslaan(raw)
      let result, error
      if (id) {
        const res = await supabase.from('offertes').update(data).eq('id', id).select().single()
        result = res.data; error = res.error
      } else {
        const res = await supabase.from('offertes').insert(data).select().single()
        result = res.data; error = res.error
      }
      if (error) { alert('Opslaan mislukt: ' + error.message); setBezig(false); return }
      if (result) {
        localStorage.removeItem(DRAFT_KEY)
        onOpslaan(result)
      }
    } catch (err) {
      alert('Onverwachte fout: ' + err.message)
    }
    setBezig(false)
  }

  const t = berekenTotalen(form)

  return (
    <div className="view-content form-content with-bottom-nav">
      <div className="top-acties">
        <button className="form-terug" onClick={onAnnuleer}>← Terug</button>
        {autosaveStatus && (
          <span style={{ fontSize: 12, color: autosaveStatus === 'opslaan' ? '#C9A227' : '#52c41a', alignSelf: 'center', flex: 1, textAlign: 'center' }}>
            {autosaveStatus === 'opslaan' ? '⏳ Automatisch opslaan...' : '✓ Concept opgeslagen'}
          </span>
        )}
        <button className="btn btn-primair" onClick={opslaan} disabled={bezig}>{bezig ? 'Opslaan...' : '✓ Opslaan'}</button>
      </div>

      {/* Naam offerte */}
      <div className="sectie">
        <div className="sectie-titel">Offerte naam</div>
        <div className="veld">
          <input type="text" value={form.naam || ''} onChange={e => sv('naam', e.target.value)} placeholder="Bijv. Dakisolatie renovatie, Loodgieterswerk badkamer..." />
        </div>
      </div>

      {/* Klant */}
      <div className="sectie">
        <div className="sectie-titel">Klant</div>
        <div className="veld">
          <label>Naam *</label>
          <KlantAC waarde={form.klant_naam} klanten={klanten} onChange={v => sv('klant_naam', v)} onSelect={klantSelecteren} />
        </div>
        <div className="veld-rij">
          <div className="veld" style={{ flex: 2 }}>
            <label>Adres</label>
            <input value={form.klant_adres || ''} onChange={e => sv('klant_adres', e.target.value)} placeholder="Straat + huisnummer" />
          </div>
          <div className="veld" style={{ flex: 1 }}>
            <label>Postcode</label>
            <input value={form.klant_postcode || ''} onChange={e => sv('klant_postcode', e.target.value)} />
          </div>
        </div>
        <div className="veld-rij">
          <div className="veld" style={{ flex: 1 }}>
            <label>Plaats</label>
            <input value={form.klant_plaats || ''} onChange={e => sv('klant_plaats', e.target.value)} />
          </div>
          <div className="veld" style={{ flex: 1 }}>
            <label>E-mail klant</label>
            <input type="email" value={form.klant_email || ''} onChange={e => sv('klant_email', e.target.value)} placeholder="Voor verzenden" />
          </div>
        </div>
      </div>

      {/* Gegevens */}
      <div className="sectie">
        <div className="sectie-titel">Gegevens</div>
        <div className="veld-rij">
          <div className="veld" style={{ flex: 1 }}>
            <label>Offertenummer</label>
            <input type="text" value={form.nummer || ''} onChange={e => sv('nummer', e.target.value)} placeholder={`${instellingen.offerte_prefix || 'OFN'}-${new Date().getFullYear()}-001`} />
          </div>
          <div className="veld" style={{ flex: 1 }}>
            <label>Datum offerte</label>
            <input type="date" value={form.datum || ''} onChange={e => sv('datum', e.target.value)} />
          </div>
        </div>
        <div className="veld">
          <label>Geldig tot</label>
          <input type="date" value={form.geldig_tot || ''} onChange={e => sv('geldig_tot', e.target.value)} />
        </div>
      </div>

      {/* Tekst */}
      <div className="sectie">
        <div className="sectie-titel">Offertetekst</div>
        {sjablonen.length > 0 && (
          <div className="veld">
            <label>Sjabloon laden</label>
            <select onChange={e => { const s = sjablonen.find(x => x.id === e.target.value); laadSjabloon(s); e.target.value = '' }} defaultValue="">
              <option value="">— Kies een sjabloon —</option>
              {sjablonen.map(s => <option key={s.id} value={s.id}>{s.naam}{s.werktype ? ` (${s.werktype})` : ''}</option>)}
            </select>
          </div>
        )}
        <div className="veld">
          <label>Tekst</label>
          <div style={{ marginBottom: 6, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            <span style={{ fontSize: 11, color: '#888', alignSelf: 'center', marginRight: 2 }}>Variabelen:</span>
            {VARIABELEN.map(v => (
              <button key={v.key} onClick={() => invoegVar(v.key)}
                style={{ fontSize: 11, background: '#f5ebc4', border: '1px solid #C9A227', borderRadius: 4, padding: '2px 7px', cursor: 'pointer' }}>
                {v.label}
              </button>
            ))}
          </div>
          <textarea ref={tekstRef} value={form.tekst || ''} onChange={e => sv('tekst', e.target.value)}
            rows={8} placeholder="Schrijf de offertetekst. Klik op een variabele om die in te voegen op de cursorpositie." style={{ resize: 'vertical' }} />
        </div>
        {form.tekst && (
          <details>
            <summary style={{ fontSize: 12, color: '#888', cursor: 'pointer', userSelect: 'none' }}>Voorbeeld bekijken (met ingevulde variabelen)</summary>
            <div style={{ background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: 6, padding: 12, marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>
              {verwerkVariabelen(form.tekst, form).split('\n').map((r, i) => <p key={i} style={{ margin: '0 0 4px' }}>{r || <br />}</p>)}
            </div>
          </details>
        )}
      </div>

      {/* Materialen */}
      <div className="sectie">
        <div className="sectie-titel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Materialen</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 400, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.materialen_tonen !== false} onChange={e => sv('materialen_tonen', e.target.checked)} style={{ accentColor: '#C9A227' }} />
            Tonen op offerte
          </label>
        </div>
        {(form.materialen || []).length === 0 && (
          <p style={{ color: '#aaa', fontSize: 13, marginBottom: 8 }}>Nog geen materialen toegevoegd.</p>
        )}
        {(form.materialen || []).map((m, i) => (
          <div key={i} className="werkdag-item">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: '2 1 140px' }}>
                <MateriaalAC
                  waarde={m.naam}
                  producten={producten}
                  onChange={v => updateMateriaal(i, 'naam', v)}
                  onSelect={p => productSelecteren(i, p)}
                />
              </div>
              <div style={{ flex: '0 0 70px' }}>
                <input type="number" value={m.aantal} onChange={e => updateMateriaal(i, 'aantal', e.target.value)} placeholder="Aantal" min="0" step="0.01" style={{ width: '100%' }} />
              </div>
              <div style={{ flex: '0 0 80px' }}>
                <select value={m.eenheid || 'stuk'} onChange={e => updateMateriaal(i, 'eenheid', e.target.value)} style={{ width: '100%' }}>
                  {EENHEDEN.map(e => <option key={e}>{e}</option>)}
                </select>
              </div>
              <div style={{ flex: '0 0 90px' }}>
                <input type="number" value={m.stukprijs} onChange={e => updateMateriaal(i, 'stukprijs', e.target.value)} placeholder="Prijs (€)" min="0" step="0.01" style={{ width: '100%' }} />
              </div>
              <div style={{ flex: '0 0 80px', textAlign: 'right', fontSize: 13, color: '#555' }}>
                {euro((parseFloat(m.aantal) || 0) * (parseFloat(m.stukprijs) || 0))}
              </div>
              <button onClick={() => verwijderMateriaal(i)} className="btn-verwijder">×</button>
            </div>
          </div>
        ))}
        <button className="btn btn-licht" style={{ marginTop: 8 }} onClick={voegMateriaalToe}>+ Materiaal toevoegen</button>
      </div>

      {/* Arbeid & BTW */}
      <div className="sectie">
        <div className="sectie-titel">Arbeid & BTW</div>
        <div className="veld-rij">
          <div className="veld" style={{ flex: 1 }}>
            <label>Uren</label>
            <input type="number" value={form.uren || ''} onChange={e => sv('uren', e.target.value)} placeholder="0" min="0" step="0.5" />
          </div>
          <div className="veld" style={{ flex: 1 }}>
            <label>Uurtarief (€)</label>
            <input type="number" value={form.uurtarief || ''} onChange={e => sv('uurtarief', e.target.value)} placeholder="65" min="0" step="0.5" />
          </div>
          <div className="veld" style={{ flex: 1 }}>
            <label>BTW %</label>
            <select value={form.btw_percentage} onChange={e => sv('btw_percentage', parseFloat(e.target.value))}>
              {BTW_OPTIES.map(b => <option key={b} value={b}>{b}%</option>)}
            </select>
          </div>
        </div>
        <div className="offerte-totaal-blok">
          {t.arbeidskosten > 0 && <div className="offerte-totaal-rij"><span>Arbeid</span><span>{euro(t.arbeidskosten)}</span></div>}
          {t.subtotaalMat > 0 && <div className="offerte-totaal-rij"><span>Materialen</span><span>{euro(t.subtotaalMat)}</span></div>}
          <div className="offerte-totaal-rij"><span>Subtotaal</span><span>{euro(t.subtotaal)}</span></div>
          <div className="offerte-totaal-rij"><span>BTW ({form.btw_percentage}%)</span><span>{euro(t.btw_bedrag)}</span></div>
          <div className="offerte-totaal-rij totaal"><span>Totaal incl. BTW</span><span>{euro(t.totaal)}</span></div>
        </div>
      </div>

      {/* Notities */}
      <div className="sectie">
        <div className="sectie-titel">Notities (intern)</div>
        <div className="veld">
          <textarea value={form.notities || ''} onChange={e => sv('notities', e.target.value)}
            rows={3} placeholder="Interne notities — niet zichtbaar op de offerte" style={{ resize: 'vertical' }} />
        </div>
      </div>
    </div>
  )
}

// ── Hoofd OfferteView ─────────────────────────────────────────────────
export default function OfferteView({ klanten, producten, onWerkbonAangemaakt, msIngelogd, instellingen = {} }) {
  const [offertes, setOffertes] = useState([])
  const [sjablonen, setSjablonen] = useState([])
  const [laden, setLaden] = useState(true)
  const [view, setView] = useState('lijst')
  const [huidig, setHuidig] = useState(null)
  const [werkbonModal, setWerkbonModal] = useState(false)
  const [emailModal, setEmailModal] = useState(false)
  const [emailBezig, setEmailBezig] = useState(false)
  const [pdfStatus, setPdfStatus] = useState(null)
  const printRef = useRef(null)
  const autoUploadRef = useRef(false)

  useEffect(() => { laadAlles() }, [])

  // Auto-upload PDF naar OneDrive na opslaan
  useEffect(() => {
    if (view !== 'detail' || !autoUploadRef.current || !huidig || !printRef.current || !msIngelogd) return
    autoUploadRef.current = false
    const t = setTimeout(() => slaOffertePdfOp(printRef.current, huidig), 900)
    return () => clearTimeout(t)
  }, [view, huidig, msIngelogd])

  async function slaOffertePdfOp(element, offerte) {
    if (!element || !offerte) return
    setPdfStatus('bezig')
    try {
      const { uploadPdfNaarOneDrive } = await import('@/lib/onedrive')
      const html2pdf = (await import('html2pdf.js')).default
      const pdfBlob = await html2pdf()
        .from(element)
        .set({
          margin: 0,
          filename: `${offerte.nummer}.pdf`,
          image: { type: 'jpeg', quality: 0.97 },
          html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', windowWidth: 794 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .outputPdf('blob')
      await uploadPdfNaarOneDrive(pdfBlob, offerte.nummer, offerte.klant_naam)
      setPdfStatus('klaar')
      setTimeout(() => setPdfStatus(null), 4000)
    } catch (err) {
      console.error('Offerte PDF naar OneDrive mislukt:', err)
      setPdfStatus('fout')
      setTimeout(() => setPdfStatus(null), 6000)
    }
  }

  async function laadAlles() {
    setLaden(true)
    const [{ data: of }, { data: sj }] = await Promise.all([
      supabase.from('offertes').select('*').order('aangemaakt', { ascending: false }),
      supabase.from('offerte_sjablonen').select('*').order('naam'),
    ])
    setOffertes(of || []); setSjablonen(sj || []); setLaden(false)
  }

  async function wisselStatus(offerte, status) {
    await supabase.from('offertes').update({ status }).eq('id', offerte.id)
    const bijgewerkt = { ...offerte, status }
    setHuidig(bijgewerkt)
    setOffertes(o => o.map(x => x.id === offerte.id ? bijgewerkt : x))
  }

  async function verwijder(offerte) {
    if (!window.confirm(`Offerte ${offerte.nummer} verwijderen?`)) return
    await supabase.from('offertes').delete().eq('id', offerte.id)
    setView('lijst'); setHuidig(null); laadAlles()
  }

  function werkbonAanmaken(keuzes) {
    if (!huidig) return
    const adresM = (huidig.klant_adres || '').match(/^(.*?)\s+(\d+\S*)$/)
    const werkbonData = {
      naam:           huidig.naam || '',
      klant_naam:     keuzes.klant ? huidig.klant_naam : '',
      klant_straat:   keuzes.klant ? (adresM ? adresM[1] : huidig.klant_adres || '') : '',
      klant_huisnummer: keuzes.klant ? (adresM ? adresM[2] : '') : '',
      klant_postcode: keuzes.klant ? huidig.klant_postcode : '',
      klant_plaats:   keuzes.klant ? huidig.klant_plaats : '',
      klant_email:    keuzes.klant ? huidig.klant_email : '',
      omschrijving:   keuzes.omschrijving ? verwerkVariabelen(huidig.tekst, huidig) : '',
      materialen:     keuzes.materialen ? (huidig.materialen || []).filter(m => m.naam).map(m => ({
        omschrijving: m.naam, aantal: m.aantal, eenheid: m.eenheid || 'stuk',
        prijs: m.stukprijs || 0, medewerker_id: '',
      })) : [],
    }
    setWerkbonModal(false)
    onWerkbonAangemaakt(werkbonData)
  }

  async function stuurEmail(email, bericht) {
    if (!huidig) return
    setEmailBezig(true)
    try {
      // Genereer offerte PDF als base64 vanuit het print-element
      let offertePdfBase64 = null
      if (printRef.current) {
        try {
          const html2pdf = (await import('html2pdf.js')).default
          const dataUri = await html2pdf()
            .from(printRef.current)
            .set({
              margin: 0,
              filename: `Offerte-${huidig.nummer}.pdf`,
              image: { type: 'png' },
              html2canvas: { scale: 3, useCORS: true, logging: false, backgroundColor: '#ffffff', windowWidth: 794 },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            })
            .outputPdf('datauristring')
          offertePdfBase64 = dataUri.split(',')[1] || null
        } catch (pdfErr) {
          console.warn('Offerte PDF genereren mislukt:', pdfErr)
        }
      }

      // Bepaal het AV opslagpad — de server downloadt het zelf (service key)
      const avUrl = instellingen.av_url
      let avPad = null
      if (avUrl) {
        avPad = avUrl.startsWith('http')
          ? (avUrl.match(/\/object\/public\/werkbon-fotos\/([^?]+)/)?.[1] || null)
          : avUrl
        if (avPad) avPad = decodeURIComponent(avPad)
      }

      const res = await fetch('/api/stuur-offerte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerte: huidig,
          bericht,
          email,
          offerte_pdf_base64: offertePdfBase64,
          av_pad: avPad,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Onbekende fout')
      await wisselStatus(huidig, 'verstuurd')
      setEmailModal(false)
      alert('✓ Offerte verstuurd!')
    } catch (err) {
      alert('Versturen mislukt: ' + err.message)
    }
    setEmailBezig(false)
  }

  // ── Views ─────────────────────────────────────────────────────────
  if (view === 'sjablonen') return <SjablonenView onTerug={() => { laadAlles(); setView('lijst') }} />

  if (view === 'formulier') {
    return (
      <OfferteFormulier
        offerte={huidig}
        offertes={offertes}
        klanten={klanten}
        producten={producten}
        sjablonen={sjablonen}
        instellingen={instellingen}
        onOpslaan={result => { if (msIngelogd) autoUploadRef.current = true; setHuidig(result); setView('detail'); laadAlles() }}
        onAnnuleer={() => setView(huidig ? 'detail' : 'lijst')}
      />
    )
  }

  if (view === 'detail' && huidig) {
    const st = STATUS[huidig.status] || STATUS.concept
    return (
      <>
        <div className="view-content form-content with-bottom-nav">
          <div className="top-acties no-print">
            <button className="form-terug" onClick={() => { setView('lijst'); setHuidig(null) }}>← Terug</button>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn btn-licht" onClick={() => setView('formulier')}>✏️ Bewerken</button>
              <button className="btn btn-licht" onClick={() => window.print()}>🖨️ PDF</button>
              <button className="btn btn-licht" onClick={() => setEmailModal(true)}>✉️ Stuur</button>
              <button className="btn btn-primair" onClick={() => setWerkbonModal(true)}>📋 → Werkbon</button>
            </div>
          </div>

          {/* Naam */}
          {huidig.naam && (
            <div style={{ fontSize: 18, fontWeight: 700, margin: '8px 0 2px', color: '#1a1a1a' }}>{huidig.naam}</div>
          )}

          {/* Status */}
          <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#888' }}>Status:</span>
            {Object.entries(STATUS).map(([key, s]) => (
              <button key={key} onClick={() => wisselStatus(huidig, key)}
                style={{ padding: '3px 12px', borderRadius: 20, border: `1px solid ${huidig.status === key ? s.rand : '#e0e0e0'}`, background: huidig.status === key ? s.bg : '#fff', color: huidig.status === key ? s.kleur : '#888', fontSize: 12, cursor: 'pointer', fontWeight: huidig.status === key ? 700 : 400 }}>
                {s.label}
              </button>
            ))}
          </div>

          {pdfStatus && (
            <div className={`pdf-onedrive-status ${pdfStatus}`} style={{ marginBottom: 8 }}>
              {pdfStatus === 'bezig' && '☁️ PDF opslaan naar OneDrive...'}
              {pdfStatus === 'klaar' && '✓ PDF opgeslagen in OneDrive'}
              {pdfStatus === 'fout' && '⚠️ PDF opslaan mislukt'}
            </div>
          )}
          <div ref={printRef}><OffertePrint offerte={huidig} instellingen={instellingen} /></div>

          <div className="no-print" style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-gevaar-licht" onClick={() => verwijder(huidig)}>🗑️ Verwijderen</button>
          </div>
        </div>

        {werkbonModal && <WerkbonModal offerte={huidig} onAanmaken={werkbonAanmaken} onSluiten={() => setWerkbonModal(false)} />}
        {emailModal && <EmailModal offerte={huidig} onVerstuur={stuurEmail} onSluiten={() => setEmailModal(false)} bezig={emailBezig} />}
      </>
    )
  }

  // ── Lijst ──────────────────────────────────────────────────────────
  return (
    <div className="view-content with-bottom-nav">
      <div className="overzicht-header">
        <h2>{offertes.length} {offertes.length === 1 ? 'offerte' : 'offertes'}</h2>
        <button className="btn btn-licht" style={{ fontSize: 12 }} onClick={() => setView('sjablonen')}>📝 Sjablonen</button>
      </div>
      {laden ? <div className="laden">Laden...</div> : offertes.length === 0 ? (
        <div className="leeg"><p>Nog geen offertes.<br />Tik op <strong>+</strong> om te beginnen.</p></div>
      ) : (
        <div className="bon-lijst">
          {offertes.map(o => {
            const st = STATUS[o.status] || STATUS.concept
            const t = berekenTotalen(o)
            return (
              <div key={o.id} className="bon-kaart" onClick={() => { setHuidig(o); setView('detail') }}>
                <div className="bon-nummer">{o.nummer}</div>
                <div className="bon-info">
                  {o.naam && <div className="bon-klant" style={{ fontWeight: 600 }}>{o.naam}</div>}
                  <div className={o.naam ? 'bon-meta' : 'bon-klant'}>{o.klant_naam || '(geen naam)'}</div>
                  <div className="bon-meta">
                    {o.datum && datumNL(o.datum)}
                    {o.geldig_tot && ` · t/m ${datumNL(o.geldig_tot)}`}
                    {' · '}
                    <span style={{ color: st.kleur, fontWeight: 600, fontSize: 11 }}>{st.label}</span>
                  </div>
                </div>
                <div className="bon-totaal">{euro(t.totaal)}</div>
              </div>
            )
          })}
        </div>
      )}
      <button className="fab fab-boven-nav" onClick={() => { setHuidig(null); setView('formulier') }}>+</button>
    </div>
  )
}
