'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

function euro(n) { return '€ ' + Number(n || 0).toFixed(2).replace('.', ',') }
function datumNL(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}` }
function vandaag() { return new Date().toISOString().split('T')[0] }

async function genNummer() {
  const jaar = new Date().getFullYear()
  const prefix = `WB-${jaar}-`
  const { data } = await supabase.from('werkbonnen').select('nummer').like('nummer', `${prefix}%`)
  const nummers = (data || []).map(b => parseInt(b.nummer.replace(prefix, '')) || 0)
  return `${prefix}${String((nummers.length ? Math.max(...nummers) : 0) + 1).padStart(3, '0')}`
}

function leegFormulier(medewerker) {
  return {
    nummer: '', datum: vandaag(),
    klant_naam: '', klant_straat: '', klant_huisnummer: '', klant_postcode: '', klant_plaats: '', klant_tel: '', klant_email: '',
    omschrijving: '', notities: '',
  }
}

export default function MedewerkerWerkbonView({ medewerker }) {
  const [view, setView] = useState('lijst')  // lijst | formulier | detail
  const [werkbonnen, setWerkbonnen] = useState([])
  const [laden, setLaden] = useState(true)
  const [huidigeBon, setHuidigeBon] = useState(null)
  const [bewerkModus, setBewerkModus] = useState(false)
  const [bezig, setBezig] = useState(false)

  // Formulier state
  const [formulier, setFormulier] = useState(leegFormulier())
  const [werkdagen, setWerkdagen] = useState([])
  const [materialen, setMaterialen] = useState([])
  const [postcodeBezig, setPostcodeBezig] = useState(false)

  useEffect(() => {
    laadWerkbonnen()

    function handlePop(e) {
      const s = e.state
      if (!s || s.tab) {
        // Terug naar tab-niveau: toon de lijst
        setView('lijst')
        return
      }
      if (s.medView === 'detail' && s.bon) { setHuidigeBon(s.bon); setView('detail') }
      else if (s.medView === 'formulier') { setView('formulier') }
      else { setView('lijst') }
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  async function laadWerkbonnen() {
    setLaden(true)
    const { data } = await supabase.from('werkbonnen').select('*').order('aangemaakt', { ascending: false })
    // Toon werkbonnen die expliciet zijn toegewezen OF waar medewerker in werkdagen/ritten staat
    const eigen = (data || []).filter(b =>
      (b.medewerkers || []).includes(medewerker.id) ||
      (b.werkdagen || []).some(w => w.medewerker_id === medewerker.id) ||
      (b.ritten || []).some(r => r.medewerker_id === medewerker.id)
    )
    setWerkbonnen(eigen)
    setLaden(false)
  }

  function setVeld(k, v) { setFormulier(f => ({ ...f, [k]: v })) }

  async function adresOpzoeken(postcode, huisnummer) {
    const pc = (postcode || '').replace(/\s/g, '')
    if (!pc || pc.length < 6) return
    setPostcodeBezig(true)
    try {
      const res = await fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(pc + ' ' + (huisnummer || ''))}&fl=straatnaam,woonplaatsnaam,huisnummer&rows=1&fq=type:adres`)
      const json = await res.json()
      const doc = json?.response?.docs?.[0]
      if (doc) {
        if (doc.straatnaam) setVeld('klant_straat', doc.straatnaam)
        if (doc.woonplaatsnaam) setVeld('klant_plaats', doc.woonplaatsnaam)
      }
    } catch { /* stil falen */ }
    setPostcodeBezig(false)
  }

  async function nieuweWerkbon() {
    const nummer = await genNummer()
    setFormulier({ ...leegFormulier(), nummer })
    setWerkdagen([{ datum: vandaag(), omschrijving: '', uren: '', medewerker_id: medewerker.id, medewerker_naam: medewerker.naam, medewerker_kleur: medewerker.kleur || '#C9A227' }])
    setMaterialen([])
    setBewerkModus(false)
    setHuidigeBon(null)
    setView('formulier')
  }

  function bewerkWerkbon(bon) {
    window.history.pushState({ medView: 'formulier' }, '')
    setFormulier({
      nummer: bon.nummer || '',
      datum: bon.datum || vandaag(),
      klant_naam: bon.klant_naam || '',
      klant_straat: bon.klant_straat || (bon.klant_adres || '').match(/^(.*?)\s+(\d+\S*)$/)?.[1] || bon.klant_adres || '',
      klant_huisnummer: bon.klant_huisnummer || (bon.klant_adres || '').match(/^(.*?)\s+(\d+\S*)$/)?.[2] || '',
      klant_postcode: bon.klant_postcode || '',
      klant_plaats: bon.klant_plaats || '',
      klant_tel: bon.klant_tel || '',
      klant_email: bon.klant_email || '',
      omschrijving: bon.omschrijving || '',
      notities: bon.notities || '',
    })
    setWerkdagen(bon.werkdagen?.length ? bon.werkdagen : [{ datum: vandaag(), omschrijving: '', uren: '', medewerker_id: medewerker.id, medewerker_naam: medewerker.naam, medewerker_kleur: medewerker.kleur || '#C9A227' }])
    setMaterialen(bon.materialen || [])
    setBewerkModus(true)
    setHuidigeBon(bon)
    setView('formulier')
  }

  async function opslaan() {
    setBezig(true)
    const geldigeWerkdagen = werkdagen
      .filter(w => w.datum || w.omschrijving || w.uren)
      .map(w => ({ datum: w.datum, omschrijving: w.omschrijving, uren: parseFloat(w.uren) || 0, medewerker_id: w.medewerker_id || null, medewerker_naam: w.medewerker_naam || null, medewerker_kleur: w.medewerker_kleur || null }))
    const geldigeMat = materialen
      .filter(m => m.omschrijving)
      .map(m => ({ omschrijving: m.omschrijving, aantal: parseFloat(m.aantal) || 1, eenheid: m.eenheid || 'stuk', prijs: parseFloat(m.prijs) || 0 }))

    const rij = {
      nummer: formulier.nummer,
      datum: formulier.datum,
      klant_naam: formulier.klant_naam,
      klant_adres: [formulier.klant_straat, formulier.klant_huisnummer].filter(Boolean).join(' '),
      klant_postcode: formulier.klant_postcode,
      klant_plaats: formulier.klant_plaats,
      klant_tel: formulier.klant_tel,
      klant_email: formulier.klant_email,
      omschrijving: formulier.omschrijving,
      werkdagen: geldigeWerkdagen,
      materialen: geldigeMat,
      notities: formulier.notities,
      uren: geldigeWerkdagen.reduce((s, w) => s + w.uren, 0),
      medewerkers: bewerkModus ? (huidigeBon?.medewerkers || [medewerker.id]) : [medewerker.id],
    }

    let result
    if (bewerkModus && huidigeBon) {
      const { data, error } = await supabase.from('werkbonnen').update(rij).eq('id', huidigeBon.id).select().single()
      if (error) { alert('Opslaan mislukt: ' + error.message); setBezig(false); return }
      result = data
    } else {
      const { data, error } = await supabase.from('werkbonnen').insert(rij).select().single()
      if (error) { alert('Opslaan mislukt: ' + error.message); setBezig(false); return }
      result = data
    }
    setBezig(false)
    await laadWerkbonnen()
    setHuidigeBon(result)
    // Vervang formulier-state door detail-state zodat back-knop naar lijst gaat
    window.history.replaceState({ medView: 'detail', bon: result }, '')
    setView('detail')
  }

  // Werkdagen helpers
  function voegWerkdagToe() {
    setWerkdagen(w => [...w, { datum: vandaag(), omschrijving: '', uren: '', medewerker_id: medewerker.id, medewerker_naam: medewerker.naam, medewerker_kleur: medewerker.kleur || '#C9A227' }])
  }
  function updateWerkdag(idx, key, val) { setWerkdagen(w => w.map((item, i) => i === idx ? { ...item, [key]: val } : item)) }
  function verwijderWerkdag(idx) { setWerkdagen(w => w.filter((_, i) => i !== idx)) }

  // Materialen helpers
  function voegMateriaalToe() { setMaterialen(m => [...m, { omschrijving: '', aantal: 1, eenheid: 'stuk', prijs: '' }]) }
  function updateMateriaal(idx, key, val) { setMaterialen(m => m.map((item, i) => i === idx ? { ...item, [key]: val } : item)) }
  function verwijderMateriaal(idx) { setMaterialen(m => m.filter((_, i) => i !== idx)) }

  // ── LIJST ──
  if (view === 'lijst') {
    return (
      <div className="view-content with-bottom-nav">
        {laden ? (
          <div className="laden">Laden...</div>
        ) : werkbonnen.length === 0 ? (
          <div className="leeg"><p>Geen werkbonnen toegewezen.<br />Je leidinggevende wijst werkbonnen aan je toe.</p></div>
        ) : (
          <div className="bon-lijst">
            {werkbonnen.map(bon => (
              <div key={bon.id} className="bon-kaart" onClick={() => { window.history.pushState({ medView: 'detail', bon }, ''); setHuidigeBon(bon); setView('detail') }}>
                <div className="bon-nummer">{bon.nummer}</div>
                <div className="bon-info">
                  <div className="bon-klant">{bon.klant_naam || '(geen naam)'}</div>
                  <div className="bon-meta">
                    {datumNL(bon.datum)} &bull; {bon.omschrijving || '–'}
                    <span className={`status-badge ${bon.gefactureerd ? 'status-gefactureerd' : 'status-open'}`} style={{ marginLeft: 6 }}>{bon.gefactureerd ? 'Gefactureerd' : 'Open'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── DETAIL ──
  if (view === 'detail' && huidigeBon) {
    const werkdg = huidigeBon.werkdagen || []
    const mat = huidigeBon.materialen || []
    return (
      <div className="view-content">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button className="form-terug" style={{ margin: 0 }} onClick={() => setView('lijst')}>← Terug</button>
          <button className="btn btn-primair" onClick={() => bewerkWerkbon(huidigeBon)}>✏️ Bewerken</button>
          <button className="btn btn-sec" onClick={() => window.print()}>🖨️ PDF</button>
        </div>
        <div className="bon-print">
          <div className="bon-kop">
            <div className="bon-kop-info">
              <div className="bon-bedrijf">JdB Dak- &amp; Installatietechniek</div>
              <div className="bon-klant-blok">
                <div className="bon-label">Klant</div>
                <div className="bon-waarde">{huidigeBon.klant_naam}</div>
                {huidigeBon.klant_adres && <div className="bon-waarde">{huidigeBon.klant_adres}</div>}
                {huidigeBon.klant_postcode && <div className="bon-waarde">{huidigeBon.klant_postcode} {huidigeBon.klant_plaats}</div>}
              </div>
            </div>
            <div className="bon-kop-nr">
              <div className="nr">{huidigeBon.nummer}</div>
              <div className="datum">{datumNL(huidigeBon.datum)}</div>
            </div>
          </div>
          {huidigeBon.omschrijving && (
            <div className="bon-sectie">
              <div className="bon-sectie-titel">Omschrijving</div>
              <p style={{ margin: 0, fontSize: 14 }}>{huidigeBon.omschrijving}</p>
            </div>
          )}
          {(werkdg.length > 0 || mat.length > 0) && (
            <div className="bon-sectie">
              <div className="bon-sectie-titel">Specificatie</div>
              <table>
                <thead><tr><th>Omschrijving</th><th style={{ textAlign: 'center' }}>Aantal</th></tr></thead>
                <tbody>
                  {werkdg.map((w, i) => (
                    <tr key={i}>
                      <td>
                        {datumNL(w.datum)}{w.omschrijving ? ` – ${w.omschrijving}` : ''}
                        {w.medewerker_naam && (
                          <span style={{ marginLeft: 8, fontSize: 11, background: (w.medewerker_kleur || '#C9A227') + '22', color: w.medewerker_kleur || '#C9A227', border: `1px solid ${(w.medewerker_kleur || '#C9A227')}55`, borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>
                            {w.medewerker_naam}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>{w.uren} uur</td>
                    </tr>
                  ))}
                  {mat.map((m, i) => (
                    <tr key={`m${i}`}><td>{m.omschrijving}</td><td style={{ textAlign: 'center' }}>{m.aantal} {m.eenheid || 'stuk'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {huidigeBon.notities && (
            <div className="bon-sectie">
              <div className="bon-sectie-titel">Notities</div>
              <p style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap' }}>{huidigeBon.notities}</p>
            </div>
          )}
          <div className="bon-footer">JdB Dak- &amp; Installatietechniek &bull; {huidigeBon.nummer} &bull; {datumNL(huidigeBon.datum)}</div>
        </div>
      </div>
    )
  }

  // ── FORMULIER ──
  return (
    <div className="view-content form-content">
      <div className="top-acties">
        <button className="form-terug" onClick={() => setView(bewerkModus ? 'detail' : 'lijst')}>← Terug</button>
        <button className="btn btn-primair" onClick={opslaan} disabled={bezig}>
          {bezig ? 'Opslaan...' : '💾 Opslaan'}
        </button>
      </div>

      {/* Basisinfo */}
      <div className="sectie">
        <div className="sectie-titel">Werkbon</div>
        <div className="veld-rij-2">
          <div className="veld"><label>Nummer</label><input type="text" value={formulier.nummer} readOnly style={{ background: '#f5f5f5', color: '#888' }} /></div>
          <div className="veld"><label>Datum</label><input type="date" value={formulier.datum} onChange={e => setVeld('datum', e.target.value)} /></div>
        </div>
      </div>

      {/* Klant */}
      <div className="sectie">
        <div className="sectie-titel">Klantgegevens</div>
        <div className="veld"><label>Naam</label><input type="text" value={formulier.klant_naam} onChange={e => setVeld('klant_naam', e.target.value)} placeholder="Naam klant" /></div>
        <div className="veld-rij-2">
          <div className="veld" style={{ flex: 3 }}><label>Postcode</label>
            <input type="text" value={formulier.klant_postcode} onChange={e => setVeld('klant_postcode', e.target.value)}
              onBlur={e => adresOpzoeken(e.target.value, formulier.klant_huisnummer)} placeholder="1234AB" />
          </div>
          <div className="veld" style={{ flex: 2 }}><label>Huisnummer</label>
            <input type="text" value={formulier.klant_huisnummer} onChange={e => setVeld('klant_huisnummer', e.target.value)}
              onBlur={e => adresOpzoeken(formulier.klant_postcode, e.target.value)} placeholder="10" />
          </div>
        </div>
        <div className="veld"><label>Straat {postcodeBezig && <span style={{ fontSize: 11, color: '#C9A227' }}>⏳</span>}</label>
          <input type="text" value={formulier.klant_straat} onChange={e => setVeld('klant_straat', e.target.value)} placeholder="Straatnaam" />
        </div>
        <div className="veld"><label>Plaats</label><input type="text" value={formulier.klant_plaats} onChange={e => setVeld('klant_plaats', e.target.value)} placeholder="Plaatsnaam" /></div>
        <div className="veld-rij-2">
          <div className="veld"><label>Telefoon</label><input type="tel" value={formulier.klant_tel} onChange={e => setVeld('klant_tel', e.target.value)} placeholder="06-..." /></div>
          <div className="veld"><label>E-mail</label><input type="email" value={formulier.klant_email} onChange={e => setVeld('klant_email', e.target.value)} placeholder="naam@..." /></div>
        </div>
      </div>

      {/* Omschrijving */}
      <div className="sectie">
        <div className="sectie-titel">Omschrijving</div>
        <div className="veld">
          <textarea value={formulier.omschrijving} onChange={e => setVeld('omschrijving', e.target.value)} placeholder="Beschrijf het uitgevoerde werk..." rows={3} style={{ width: '100%', resize: 'vertical' }} />
        </div>
      </div>

      {/* Werkdagen */}
      <div className="sectie">
        <div className="sectie-titel">Gewerkte dagen</div>
        <div className="werkdag-labels">
          <span className="mat-label" style={{ textAlign: 'left' }}>Datum</span>
          <span className="mat-label" style={{ textAlign: 'left' }}>Omschrijving</span>
          <span className="mat-label">Uren</span>
          <span />
        </div>
        <div className="werkdag-lijst">
          {werkdagen.map((w, i) => (
            <div key={i} className="werkdag-item">
              <div className="werkdag-rij">
                <input type="date" value={w.datum} onChange={e => updateWerkdag(i, 'datum', e.target.value)} />
                <input type="text" value={w.omschrijving} onChange={e => updateWerkdag(i, 'omschrijving', e.target.value)} placeholder="Wat gedaan?" />
                <input type="number" value={w.uren} onChange={e => updateWerkdag(i, 'uren', e.target.value)} placeholder="0" min="0" step="0.5" style={{ textAlign: 'center' }} />
                <button className="btn-verwijder" onClick={() => verwijderWerkdag(i)}>×</button>
              </div>
            </div>
          ))}
        </div>
        <button className="btn-toevoegen" onClick={voegWerkdagToe}>+ Dag toevoegen</button>
        {werkdagen.reduce((s, w) => s + (parseFloat(w.uren) || 0), 0) > 0 && (
          <div className="uren-totaal">Totaal: <strong>{werkdagen.reduce((s, w) => s + (parseFloat(w.uren) || 0), 0)} uur</strong></div>
        )}
      </div>

      {/* Materialen */}
      <div className="sectie">
        <div className="sectie-titel">Materialen</div>
        {materialen.length > 0 && (
          <>
            <div className="mat-labels">
              <span className="mat-label">Omschrijving</span>
              <span className="mat-label" style={{ textAlign: 'center' }}>Aantal</span>
              <span className="mat-label" style={{ textAlign: 'right' }}>Prijs</span>
              <span />
            </div>
            <div className="materiaal-lijst">
              {materialen.map((m, i) => (
                <div key={i} className="materiaal-rij">
                  <input type="text" value={m.omschrijving} onChange={e => updateMateriaal(i, 'omschrijving', e.target.value)} placeholder="Omschrijving" />
                  <input type="number" value={m.aantal} onChange={e => updateMateriaal(i, 'aantal', e.target.value)} min="0" step="1" style={{ textAlign: 'center' }} />
                  <input type="number" value={m.prijs} onChange={e => updateMateriaal(i, 'prijs', e.target.value)} placeholder="0.00" min="0" step="0.01" style={{ textAlign: 'right' }} />
                  <button className="btn-verwijder" onClick={() => verwijderMateriaal(i)}>×</button>
                </div>
              ))}
            </div>
          </>
        )}
        <button className="btn-toevoegen" onClick={voegMateriaalToe}>+ Materiaal toevoegen</button>
      </div>

      {/* Notities */}
      <div className="sectie">
        <div className="sectie-titel">Notities</div>
        <div className="veld">
          <textarea value={formulier.notities} onChange={e => setVeld('notities', e.target.value)} placeholder="Interne notities..." rows={3} style={{ width: '100%', resize: 'vertical' }} />
        </div>
      </div>

      <div style={{ padding: '8px 0 60px' }}>
        <button className="btn btn-primair" style={{ width: '100%', padding: 14 }} onClick={opslaan} disabled={bezig}>
          {bezig ? 'Opslaan...' : '💾 Werkbon opslaan'}
        </button>
      </div>
    </div>
  )
}
