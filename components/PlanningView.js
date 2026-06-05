'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ── Helpers ──────────────────────────────────────────────────────────
function maandag(datum) {
  const d = new Date(datum)
  const dag = d.getDay()
  d.setDate(d.getDate() + (dag === 0 ? -6 : 1 - dag))
  d.setHours(0, 0, 0, 0)
  return d
}

function datumStr(d) { return d.toISOString().split('T')[0] }

function datumNL(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
const MAANDEN_K = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const DAGLABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
const KLEUREN = ['#C9A227', '#E8A020', '#D4380D', '#096DD9', '#389E0D', '#722ED1', '#08979C']

function dagLabel(d) {
  return `${DAGLABELS[d.getDay() === 0 ? 6 : d.getDay() - 1]} ${d.getDate()} ${MAANDEN_K[d.getMonth()]}`
}

function isVandaag(d) { return datumStr(d) === datumStr(new Date()) }

function tijdStr(t) { return t ? t.slice(0, 5) : '' }

// ── Autocomplete (herbruikbaar) ───────────────────────────────────────
function Autocomplete({ waarde, opties, onChange, onSelecteer, placeholder }) {
  const [open, setOpen] = useState(false)
  const gefilterd = waarde.length > 0 ? opties.filter(o => o.naam.toLowerCase().includes(waarde.toLowerCase())).slice(0, 6) : []
  return (
    <div className="autocomplete">
      <input type="text" value={waarde} onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder={placeholder} />
      {open && gefilterd.length > 0 && (
        <div className="autocomplete-dropdown">
          {gefilterd.map(o => (
            <div key={o.id} className="autocomplete-optie" onMouseDown={() => { onSelecteer(o); setOpen(false) }}>
              <div>{o.naam}</div>
              {o.adres && <div className="autocomplete-optie-sub">{[o.adres, o.postcode, o.plaats].filter(Boolean).join(' ')}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Afspraak formulier ────────────────────────────────────────────────
function AfspraakForm({ form, setForm, klanten, werkbonnen, onOpslaan, onVerwijder, onAnnuleer, bezig }) {
  function setVeld(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function klantSelecteren(klant) {
    const m = (klant.adres || '').match(/^(.*?)\s+(\d+\S*)$/)
    const straat = m ? m[1] : (klant.adres || '')
    const nr = m ? m[2] : ''
    setForm(f => ({
      ...f,
      klant_naam: klant.naam,
      klant_adres: [straat, nr].filter(Boolean).join(' '),
      klant_postcode: klant.postcode || '',
      klant_plaats: klant.plaats || '',
    }))
  }

  return (
    <div className="view-content form-content with-bottom-nav">
      <div className="top-acties">
        <button className="form-terug" onClick={onAnnuleer}>← Terug</button>
        <div style={{ display: 'flex', gap: 8 }}>
          {form.id && <button className="btn btn-gevaar-licht" onClick={onVerwijder} disabled={bezig}>🗑️</button>}
          <button className="btn btn-primair" onClick={onOpslaan} disabled={bezig}>{bezig ? 'Opslaan...' : '✓ Opslaan'}</button>
        </div>
      </div>

      <div className="sectie">
        <div className="sectie-titel">{form.id ? 'Afspraak bewerken' : 'Nieuwe afspraak'}</div>

        <div className="veld">
          <label>Titel *</label>
          <input type="text" value={form.titel || ''} onChange={e => setVeld('titel', e.target.value)} placeholder="Bijv. Loodgieterswerk cv-ketel" />
        </div>

        <div className="rij-2">
          <div className="veld"><label>Datum</label><input type="date" value={form.datum || ''} onChange={e => setVeld('datum', e.target.value)} /></div>
          <div className="veld">
            <label>Kleur</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>
              {KLEUREN.map(k => (
                <div key={k} onClick={() => setVeld('kleur', k)}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: k, cursor: 'pointer', border: form.kleur === k ? '3px solid white' : '2px solid transparent', boxShadow: form.kleur === k ? `0 0 0 2px ${k}` : 'none' }} />
              ))}
            </div>
          </div>
        </div>

        <div className="rij-2">
          <div className="veld"><label>Van</label><input type="time" value={form.tijdstip_van || ''} onChange={e => setVeld('tijdstip_van', e.target.value)} /></div>
          <div className="veld"><label>Tot</label><input type="time" value={form.tijdstip_tot || ''} onChange={e => setVeld('tijdstip_tot', e.target.value)} /></div>
        </div>
      </div>

      <div className="sectie">
        <div className="sectie-titel">Klantgegevens</div>
        <div className="veld">
          <label>Naam</label>
          <Autocomplete waarde={form.klant_naam || ''} opties={klanten}
            onChange={v => setVeld('klant_naam', v)} onSelecteer={klantSelecteren} placeholder="Zoek klant of typ naam" />
        </div>
        <div className="veld"><label>Adres</label><input type="text" value={form.klant_adres || ''} onChange={e => setVeld('klant_adres', e.target.value)} placeholder="Straat + huisnummer" /></div>
        <div className="rij-2">
          <div className="veld"><label>Postcode</label><input type="text" value={form.klant_postcode || ''} onChange={e => setVeld('klant_postcode', e.target.value)} placeholder="1234 AB" /></div>
          <div className="veld"><label>Plaats</label><input type="text" value={form.klant_plaats || ''} onChange={e => setVeld('klant_plaats', e.target.value)} placeholder="Amsterdam" /></div>
        </div>
      </div>

      <div className="sectie">
        <div className="sectie-titel">Omschrijving</div>
        <textarea value={form.omschrijving || ''} onChange={e => setVeld('omschrijving', e.target.value)} placeholder="Optionele toelichting..." rows={3} />
      </div>

      <div className="sectie">
        <div className="sectie-titel">Koppel werkbon (optioneel)</div>
        <div className="veld">
          <select value={form.werkbon_id || ''} onChange={e => setVeld('werkbon_id', e.target.value)}>
            <option value="">— Geen werkbon gekoppeld —</option>
            {werkbonnen.map(b => (
              <option key={b.id} value={b.id}>{b.nummer} {b.klant_naam ? `· ${b.klant_naam}` : ''} · {datumNL(b.datum)}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

// ── Links beheer ──────────────────────────────────────────────────────
function LinksView({ links, onVervers, onTerug }) {
  async function voegToe() {
    const naam = window.prompt('Naam voor de link (bijv. "John" of "Opdrachtgever"):')
    if (!naam?.trim()) return
    const bytes = new Uint8Array(16)
    window.crypto.getRandomValues(bytes)
    const token = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    await supabase.from('planning_links').insert({ naam: naam.trim(), token })
    onVervers()
  }

  async function verwijder(id) {
    if (!window.confirm('Link verwijderen? De persoon met deze link kan de planning dan niet meer inzien.')) return
    await supabase.from('planning_links').delete().eq('id', id)
    onVervers()
  }

  function kopieer(token) {
    const url = `${window.location.origin}/planning/${token}`
    navigator.clipboard.writeText(url).then(() => alert('Link gekopieerd naar klembord!'))
  }

  return (
    <div className="view-content form-content with-bottom-nav">
      <div className="top-acties">
        <button className="form-terug" onClick={onTerug}>← Terug</button>
        <button className="btn btn-primair" onClick={voegToe}>+ Nieuwe link</button>
      </div>

      <div className="sectie">
        <div className="sectie-titel">Gedeelde planning links</div>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>
          Iedereen met een link kan de planning inzien (alleen lezen). Handig voor collega's of opdrachtgevers.
        </p>

        {links.length === 0 ? (
          <div className="leeg"><p>Nog geen links aangemaakt.<br />Klik op <strong>+ Nieuwe link</strong> om te beginnen.</p></div>
        ) : (
          <div className="bon-lijst">
            {links.map(l => (
              <div key={l.id} className="klant-kaart">
                <div className="klant-info">
                  <div className="klant-naam">{l.naam}</div>
                  <div className="klant-adres" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                    {`${window.location.origin}/planning/${l.token}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-licht" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => kopieer(l.token)}>📋</button>
                  <button className="btn-verwijder" onClick={() => verwijder(l.id)}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Hoofd PlanningView ────────────────────────────────────────────────
export default function PlanningView({ klanten, werkbonnen }) {
  const [afspraken, setAfspraken] = useState([])
  const [weekStart, setWeekStart] = useState(() => maandag(new Date()))
  const [dagView, setDagView] = useState(null)
  const [form, setForm] = useState(null)
  const [bezig, setBezig] = useState(false)
  const [linksView, setLinksView] = useState(false)
  const [links, setLinks] = useState([])

  useEffect(() => {
    laadAfspraken()
    laadLinks()
    const channel = supabase.channel('pl-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning' }, laadAfspraken)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function laadAfspraken() {
    const { data } = await supabase.from('planning').select('*').order('datum').order('tijdstip_van', { nullsFirst: true })
    setAfspraken(data || [])
  }

  async function laadLinks() {
    const { data } = await supabase.from('planning_links').select('*').order('aangemaakt')
    setLinks(data || [])
  }

  const weekDagen = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  function weekLabel() {
    const eind = weekDagen[6]
    if (weekStart.getMonth() === eind.getMonth()) {
      return `${weekStart.getDate()} – ${eind.getDate()} ${MAANDEN[eind.getMonth()]} ${eind.getFullYear()}`
    }
    return `${weekStart.getDate()} ${MAANDEN_K[weekStart.getMonth()]} – ${eind.getDate()} ${MAANDEN_K[eind.getMonth()]} ${eind.getFullYear()}`
  }

  function afsprakenOpDag(datum) {
    return afspraken.filter(a => a.datum === datumStr(datum))
  }

  function leegForm(datum) {
    return {
      datum: datumStr(datum || new Date()),
      tijdstip_van: '08:00',
      tijdstip_tot: '17:00',
      titel: '',
      omschrijving: '',
      klant_naam: '',
      klant_adres: '',
      klant_postcode: '',
      klant_plaats: '',
      werkbon_id: '',
      kleur: '#C9A227',
    }
  }

  async function opslaan() {
    if (!form.titel?.trim()) { alert('Titel is verplicht'); return }
    setBezig(true)
    const { id, aangemaakt, ...data } = form
    const saveData = { ...data, werkbon_id: data.werkbon_id || null }
    if (form.id) {
      await supabase.from('planning').update(saveData).eq('id', form.id)
    } else {
      await supabase.from('planning').insert(saveData)
    }
    await laadAfspraken()
    setBezig(false)
    setForm(null)
  }

  async function verwijder() {
    if (!form.id || !window.confirm('Afspraak verwijderen?')) return
    await supabase.from('planning').delete().eq('id', form.id)
    await laadAfspraken()
    setForm(null)
  }

  // Formulier tonen
  if (form !== null) {
    return (
      <AfspraakForm
        form={form} setForm={setForm}
        klanten={klanten} werkbonnen={werkbonnen}
        onOpslaan={opslaan} onVerwijder={verwijder}
        onAnnuleer={() => setForm(null)} bezig={bezig}
      />
    )
  }

  // Links beheer
  if (linksView) {
    return <LinksView links={links} onVervers={laadLinks} onTerug={() => setLinksView(false)} />
  }

  // Dag view
  if (dagView) {
    const dagAfspraken = afspraken.filter(a => a.datum === dagView)
    const dagDatum = new Date(dagView + 'T12:00:00')
    return (
      <div className="view-content with-bottom-nav">
        <div className="planning-dag-header">
          <button className="form-terug" style={{ marginBottom: 0 }} onClick={() => setDagView(null)}>← Week</button>
          <span className="planning-dag-titel">{dagLabel(dagDatum)}{isVandaag(dagDatum) ? ' · Vandaag' : ''}</span>
          <button className="fab-inline" onClick={() => setForm(leegForm(dagDatum))}>+</button>
        </div>

        {dagAfspraken.length === 0 ? (
          <div className="leeg" style={{ paddingTop: 40 }}>
            <p>Geen afspraken op deze dag.<br />Tik op <strong>+</strong> om toe te voegen.</p>
          </div>
        ) : (
          <div className="planning-dag-lijst">
            {dagAfspraken.map(a => (
              <AfspraakKaart key={a.id} afspraak={a} werkbonnen={werkbonnen}
                onClick={() => setForm({ ...a, werkbon_id: a.werkbon_id || '' })} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Week view
  return (
    <div className="view-content with-bottom-nav">
      <div className="planning-week-nav">
        <button className="planning-nav-btn" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }}>‹</button>
        <span className="planning-week-label">{weekLabel()}</span>
        <button className="planning-nav-btn" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }}>›</button>
        <button className="planning-links-btn" onClick={() => setLinksView(true)} title="Gedeelde links beheren">🔗</button>
      </div>

      <div className="planning-week-lijst">
        {weekDagen.map(dag => {
          const aps = afsprakenOpDag(dag)
          const vandaag = isVandaag(dag)
          return (
            <div key={datumStr(dag)} className={`planning-dag-sectie${vandaag ? ' planning-vandaag' : ''}`}>
              <div className="planning-dag-label" onClick={() => setDagView(datumStr(dag))}>
                <span className="planning-dag-naam">{dagLabel(dag)}{vandaag ? ' · Vandaag' : ''}</span>
                <button className="fab-inline" onClick={e => { e.stopPropagation(); setForm(leegForm(dag)) }}>+</button>
              </div>
              {aps.length === 0 ? (
                <div className="planning-leeg-dag">Geen afspraken</div>
              ) : (
                aps.map(a => (
                  <AfspraakKaart key={a.id} afspraak={a} werkbonnen={werkbonnen}
                    onClick={() => setForm({ ...a, werkbon_id: a.werkbon_id || '' })} />
                ))
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Afspraak kaart ────────────────────────────────────────────────────
function AfspraakKaart({ afspraak: a, werkbonnen, onClick, readOnly }) {
  const bon = werkbonnen?.find(b => b.id === a.werkbon_id)
  const kleur = a.kleur || '#C9A227'
  return (
    <div className="afspraak-kaart" onClick={readOnly ? undefined : onClick}
      style={{ borderLeftColor: kleur, cursor: readOnly ? 'default' : 'pointer' }}>
      <div className="afspraak-kop">
        <span className="afspraak-titel">{a.titel}</span>
        {(a.tijdstip_van || a.tijdstip_tot) && (
          <span className="afspraak-tijd">{tijdStr(a.tijdstip_van)}{a.tijdstip_tot ? ` – ${tijdStr(a.tijdstip_tot)}` : ''}</span>
        )}
      </div>
      {a.klant_naam && <div className="afspraak-klant">👤 {a.klant_naam}</div>}
      {(a.klant_adres || a.klant_plaats) && (
        <div className="afspraak-adres">
          📍 {[a.klant_adres, a.klant_postcode, a.klant_plaats].filter(Boolean).join(' ')}
          {(a.klant_adres || a.klant_plaats) && (
            <a href={`https://maps.google.com/?q=${encodeURIComponent([a.klant_adres, a.klant_postcode, a.klant_plaats].filter(Boolean).join(' '))}`}
              target="_blank" rel="noreferrer" className="maps-knop-mini" onClick={e => e.stopPropagation()}>🗺️</a>
          )}
        </div>
      )}
      {a.omschrijving && <div className="afspraak-omschrijving">{a.omschrijving}</div>}
      {bon && <div className="afspraak-bon">📋 {bon.nummer}</div>}
    </div>
  )
}

// ── Read-only planning (voor gedeelde link) ───────────────────────────
export function PlanningReadOnly({ afspraken: initialAfspraken }) {
  const [afspraken, setAfspraken] = useState(initialAfspraken || [])
  const [weekStart, setWeekStart] = useState(() => maandag(new Date()))
  const [dagView, setDagView] = useState(null)

  useEffect(() => {
    const channel = supabase.channel('pl-readonly-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning' }, async () => {
        const { data } = await supabase.from('planning').select('*').order('datum').order('tijdstip_van', { nullsFirst: true })
        setAfspraken(data || [])
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const weekDagen = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  function weekLabel() {
    const eind = weekDagen[6]
    if (weekStart.getMonth() === eind.getMonth()) {
      return `${weekStart.getDate()} – ${eind.getDate()} ${MAANDEN[eind.getMonth()]} ${eind.getFullYear()}`
    }
    return `${weekStart.getDate()} ${MAANDEN_K[weekStart.getMonth()]} – ${eind.getDate()} ${MAANDEN_K[eind.getMonth()]} ${eind.getFullYear()}`
  }

  if (dagView) {
    const dagAfspraken = afspraken.filter(a => a.datum === dagView)
    const dagDatum = new Date(dagView + 'T12:00:00')
    return (
      <div className="view-content">
        <div className="planning-dag-header">
          <button className="form-terug" style={{ marginBottom: 0 }} onClick={() => setDagView(null)}>← Week</button>
          <span className="planning-dag-titel">{dagLabel(dagDatum)}{isVandaag(dagDatum) ? ' · Vandaag' : ''}</span>
          <span />
        </div>
        {dagAfspraken.length === 0 ? (
          <div className="leeg" style={{ paddingTop: 40 }}><p>Geen afspraken op deze dag.</p></div>
        ) : (
          <div className="planning-dag-lijst">
            {dagAfspraken.map(a => <AfspraakKaart key={a.id} afspraak={a} werkbonnen={[]} readOnly />)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="view-content">
      <div className="planning-week-nav">
        <button className="planning-nav-btn" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }}>‹</button>
        <span className="planning-week-label">{weekLabel()}</span>
        <button className="planning-nav-btn" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }}>›</button>
      </div>
      <div className="planning-week-lijst">
        {weekDagen.map(dag => {
          const aps = afspraken.filter(a => a.datum === datumStr(dag))
          const vandaag = isVandaag(dag)
          return (
            <div key={datumStr(dag)} className={`planning-dag-sectie${vandaag ? ' planning-vandaag' : ''}`}>
              <div className="planning-dag-label" style={{ cursor: 'pointer' }} onClick={() => setDagView(datumStr(dag))}>
                <span className="planning-dag-naam">{dagLabel(dag)}{vandaag ? ' · Vandaag' : ''}</span>
              </div>
              {aps.length === 0 ? (
                <div className="planning-leeg-dag">Geen afspraken</div>
              ) : (
                aps.map(a => <AfspraakKaart key={a.id} afspraak={a} werkbonnen={[]} readOnly />)
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
