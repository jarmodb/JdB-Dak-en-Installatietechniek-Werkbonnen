'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

function datumNL(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}` }
function vandaag() { return new Date().toISOString().split('T')[0] }

async function genNummer() {
  const jaar = new Date().getFullYear()
  const prefix = `WB-${jaar}-`
  const { data } = await supabase.from('werkbonnen').select('nummer').like('nummer', `${prefix}%`)
  const nummers = (data || []).map(b => parseInt(b.nummer.replace(prefix, '')) || 0)
  return `${prefix}${String((nummers.length ? Math.max(...nummers) : 0) + 1).padStart(3, '0')}`
}

function leegFormulier() {
  return { nummer: '', datum: vandaag(), klant_naam: '', klant_straat: '', klant_huisnummer: '', klant_postcode: '', klant_plaats: '', klant_tel: '', klant_email: '', omschrijving: '', notities: '' }
}

export default function MedewerkerWerkbonView({ medewerker, view, huidigeBon, onOpenDetail, onBewerken, onOpgeslagen, onTerugNaarLijst, onTerugNaarDetail }) {
  const [werkbonnen, setWerkbonnen] = useState([])
  const [laden, setLaden] = useState(true)
  const [bewerkModus, setBewerkModus] = useState(false)
  const [bezig, setBezig] = useState(false)
  const [producten, setProducten] = useState([])

  const [formulier, setFormulier] = useState(leegFormulier())
  const [werkdagen, setWerkdagen] = useState([])
  const [materialen, setMaterialen] = useState([])
  const [ritten, setRitten] = useState([])
  const [fotos, setFotos] = useState([])
  const [postcodeBezig, setPostcodeBezig] = useState(false)
  const [fotoUploadBezig, setFotoUploadBezig] = useState(false)
  const fotoInputRef = useRef(null)

  useEffect(() => {
    laadWerkbonnen()
    laadProducten()
  }, [])

  async function laadWerkbonnen() {
    setLaden(true)
    const { data } = await supabase.from('werkbonnen').select('*').order('aangemaakt', { ascending: false })
    const eigen = (data || []).filter(b =>
      (b.medewerkers || []).includes(medewerker.id) ||
      (b.werkdagen || []).some(w => w.medewerker_id === medewerker.id) ||
      (b.ritten || []).some(r => r.medewerker_id === medewerker.id)
    )
    setWerkbonnen(eigen)
    setLaden(false)
  }

  async function laadProducten() {
    const { data } = await supabase.from('producten').select('id, naam, eenheid').order('naam')
    setProducten(data || [])
  }

  function setVeld(k, v) { setFormulier(f => ({ ...f, [k]: v })) }

  async function adresOpzoeken(postcode, huisnummer) {
    const pc = (postcode || '').replace(/\s/g, '')
    if (!pc || pc.length < 6) return
    setPostcodeBezig(true)
    try {
      const res = await fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(pc + ' ' + (huisnummer || ''))}&fl=straatnaam,woonplaatsnaam&rows=1&fq=type:adres`)
      const json = await res.json()
      const doc = json?.response?.docs?.[0]
      if (doc?.straatnaam) setVeld('klant_straat', doc.straatnaam)
      if (doc?.woonplaatsnaam) setVeld('klant_plaats', doc.woonplaatsnaam)
    } catch { }
    setPostcodeBezig(false)
  }

  // ── Werkdagen ──
  function voegWerkdagToe() {
    setWerkdagen(w => [...w, { datum: vandaag(), omschrijving: '', uren: '', medewerker_id: medewerker.id, medewerker_naam: medewerker.naam, medewerker_kleur: medewerker.kleur || '#C9A227' }])
  }
  function updateWerkdag(idx, key, val) { setWerkdagen(w => w.map((item, i) => i === idx ? { ...item, [key]: val } : item)) }
  function verwijderWerkdag(idx) { setWerkdagen(w => w.filter((_, i) => i !== idx)) }

  // ── Materialen ──
  function voegMateriaalToe() {
    setMaterialen(m => [...m, { omschrijving: '', aantal: 1, eenheid: 'stuk', prijs: 0, medewerker_id: medewerker.id, medewerker_naam: medewerker.naam, medewerker_kleur: medewerker.kleur || '#C9A227' }])
  }
  function updateMateriaal(idx, key, val) { setMaterialen(m => m.map((item, i) => i === idx ? { ...item, [key]: val } : item)) }
  function verwijderMateriaal(idx) { setMaterialen(m => m.filter((_, i) => i !== idx)) }
  function productSelecteren(idx, product) {
    setMaterialen(m => m.map((item, i) => i === idx ? { ...item, omschrijving: product.naam, eenheid: product.eenheid || 'stuk' } : item))
    // Prijs bewust NIET overnemen
  }

  // ── Ritten ──
  function voegRitToe() {
    setRitten(r => [...r, { datum: vandaag(), startadres: '', reistijd: '', kilometers: '', medewerker_id: medewerker.id, medewerker_naam: medewerker.naam, medewerker_kleur: medewerker.kleur || '#C9A227' }])
  }
  function updateRit(idx, key, val) { setRitten(r => r.map((item, i) => i === idx ? { ...item, [key]: val } : item)) }
  function verwijderRit(idx) { setRitten(r => r.filter((_, i) => i !== idx)) }

  async function berekenRoute(idx) {
    const rit = ritten[idx]
    const eindAdres = [formulier.klant_straat, formulier.klant_huisnummer, formulier.klant_postcode, formulier.klant_plaats].filter(Boolean).join(' ')
    if (!rit.startadres?.trim() || !eindAdres.trim()) { alert('Vul eerst start- en eindadres in'); return }
    updateRit(idx, '_bezig', true)
    try {
      async function geocodeer(adres) {
        const res = await fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(adres)}&fl=centroide_ll&rows=1`)
        const json = await res.json()
        const coord = json?.response?.docs?.[0]?.centroide_ll
        if (!coord) return null
        const [lon, lat] = coord.replace('POINT(', '').replace(')', '').split(' ')
        return { lon, lat }
      }
      const [start, eind] = await Promise.all([geocodeer(rit.startadres), geocodeer(eindAdres)])
      if (!start || !eind) { alert('Adres niet gevonden'); updateRit(idx, '_bezig', false); return }
      const routeRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${eind.lon},${eind.lat}?overview=false`)
      const routeData = await routeRes.json()
      const afstand = routeData.routes?.[0]?.distance
      const duur = routeData.routes?.[0]?.duration
      if (afstand) {
        updateRit(idx, 'kilometers', Math.round(afstand / 100) / 10)
        updateRit(idx, 'reistijd', Math.round(duur / 60))
      } else { alert('Route niet gevonden') }
    } catch (e) { alert('Fout: ' + e.message) }
    updateRit(idx, '_bezig', false)
  }

  // ── Foto's ──
  async function handleFotoKiezen(e) {
    const bestanden = Array.from(e.target.files)
    if (!bestanden.length) return
    setFotoUploadBezig(true)
    for (const bestand of bestanden) {
      try {
        const pad = `${formulier.nummer || 'concept'}/${Date.now()}_${bestand.name}`
        const { error } = await supabase.storage.from('werkbon-fotos').upload(pad, bestand, { upsert: true })
        if (error) throw error
        const { data: urlData } = supabase.storage.from('werkbon-fotos').getPublicUrl(pad)
        setFotos(f => [...f, { naam: bestand.name, url: urlData.publicUrl, datum: new Date().toISOString() }])
      } catch (err) { alert(`Upload mislukt: ${err.message}`) }
    }
    setFotoUploadBezig(false)
    if (fotoInputRef.current) fotoInputRef.current.value = ''
  }

  function verwijderFoto(idx) { setFotos(f => f.filter((_, i) => i !== idx)) }

  // ── Bewerken laden ──
  function bewerkWerkbon(bon) {
    setBewerkModus(true)
    const adresM = (bon.klant_adres || '').match(/^(.*?)\s+(\d+\S*)$/)
    setFormulier({
      nummer: bon.nummer || '', datum: bon.datum || vandaag(),
      klant_naam: bon.klant_naam || '',
      klant_straat: adresM ? adresM[1] : (bon.klant_adres || ''),
      klant_huisnummer: adresM ? adresM[2] : '',
      klant_postcode: bon.klant_postcode || '',
      klant_plaats: bon.klant_plaats || '',
      klant_tel: bon.klant_tel || '',
      klant_email: bon.klant_email || '',
      omschrijving: bon.omschrijving || '',
      notities: bon.notities || '',
    })
    setWerkdagen(bon.werkdagen?.length ? bon.werkdagen : [{ datum: vandaag(), omschrijving: '', uren: '', medewerker_id: medewerker.id, medewerker_naam: medewerker.naam, medewerker_kleur: medewerker.kleur || '#C9A227' }])
    setMaterialen(bon.materialen || [])
    setRitten(bon.ritten?.length ? bon.ritten : [])
    setFotos(bon.fotos || [])
    onBewerken(bon)
  }

  // ── Opslaan ──
  async function opslaan() {
    setBezig(true)
    const geldigeWerkdagen = werkdagen
      .filter(w => w.datum || w.omschrijving || w.uren)
      .map(w => ({ datum: w.datum, omschrijving: w.omschrijving, uren: parseFloat(w.uren) || 0, medewerker_id: w.medewerker_id || null, medewerker_naam: w.medewerker_naam || null, medewerker_kleur: w.medewerker_kleur || null }))
    const geldigeMat = materialen
      .filter(m => m.omschrijving)
      .map(m => ({ omschrijving: m.omschrijving, aantal: parseFloat(m.aantal) || 1, eenheid: m.eenheid || 'stuk', prijs: parseFloat(m.prijs) || 0, medewerker_id: m.medewerker_id || null, medewerker_naam: m.medewerker_naam || null, medewerker_kleur: m.medewerker_kleur || null }))
    const geldigeRitten = ritten
      .filter(r => r.startadres || r.kilometers)
      .map(({ _bezig, ...r }) => ({ ...r, reistijd: parseFloat(r.reistijd) || 0, kilometers: parseFloat(r.kilometers) || 0 }))

    const rij = {
      nummer: formulier.nummer, datum: formulier.datum,
      klant_naam: formulier.klant_naam,
      klant_adres: [formulier.klant_straat, formulier.klant_huisnummer].filter(Boolean).join(' '),
      klant_postcode: formulier.klant_postcode, klant_plaats: formulier.klant_plaats,
      klant_tel: formulier.klant_tel, klant_email: formulier.klant_email,
      omschrijving: formulier.omschrijving,
      werkdagen: geldigeWerkdagen, materialen: geldigeMat, ritten: geldigeRitten, fotos,
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
    onOpgeslagen(result)
  }

  // ══════════════════════════════════════════════════════════
  // ── LIJST ──
  // ══════════════════════════════════════════════════════════
  if (view === 'lijst') {
    return (
      <div className="view-content with-bottom-nav">
        {laden ? <div className="laden">Laden...</div>
          : werkbonnen.length === 0 ? (
            <div className="leeg"><p>Geen werkbonnen toegewezen.<br />Je leidinggevende wijst werkbonnen aan je toe.</p></div>
          ) : (
            <div className="bon-lijst">
              {werkbonnen.map(bon => (
                <div key={bon.id} className="bon-kaart" onClick={() => onOpenDetail(bon)}>
                  <div className="bon-nummer">{bon.nummer}</div>
                  <div className="bon-info">
                    <div className="bon-klant">{bon.klant_naam || '(geen naam)'}</div>
                    <div className="bon-meta">
                      {datumNL(bon.datum)} &bull; {bon.omschrijving || '–'}
                      <span className={`status-badge ${bon.gefactureerd ? 'status-gefactureerd' : 'status-open'}`} style={{ marginLeft: 6 }}>
                        {bon.gefactureerd ? 'Gefactureerd' : 'Open'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════
  // ── DETAIL ──
  // ══════════════════════════════════════════════════════════
  if (view === 'detail' && huidigeBon) {
    const werkdg = huidigeBon.werkdagen || []
    const mat = huidigeBon.materialen || []
    const rtn = huidigeBon.ritten || []
    const fts = huidigeBon.fotos || []
    return (
      <div className="view-content">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button className="form-terug" style={{ margin: 0 }} onClick={onTerugNaarLijst}>← Terug</button>
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
          {rtn.length > 0 && (
            <div className="bon-sectie">
              <div className="bon-sectie-titel">Ritten</div>
              <table>
                <thead><tr><th>Datum</th><th>Van</th><th style={{ textAlign: 'center' }}>Tijd</th><th style={{ textAlign: 'right' }}>Km</th></tr></thead>
                <tbody>
                  {rtn.map((r, i) => (
                    <tr key={i}>
                      <td>{datumNL(r.datum)}</td>
                      <td>
                        {r.startadres || '–'}
                        {r.medewerker_naam && (
                          <span style={{ marginLeft: 8, fontSize: 11, background: (r.medewerker_kleur || '#C9A227') + '22', color: r.medewerker_kleur || '#C9A227', border: `1px solid ${(r.medewerker_kleur || '#C9A227')}55`, borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>
                            {r.medewerker_naam}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>{r.reistijd > 0 ? `${r.reistijd} min` : '–'}</td>
                      <td style={{ textAlign: 'right' }}>{r.kilometers > 0 ? `${r.kilometers} km` : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {fts.length > 0 && (
            <div className="bon-sectie">
              <div className="bon-sectie-titel">Foto's ({fts.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {fts.map((f, i) => (
                  <a key={i} href={f.url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 13, color: '#C9A227', textDecoration: 'none', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, padding: '4px 10px' }}>
                    📷 {f.naam}
                  </a>
                ))}
              </div>
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

  // ══════════════════════════════════════════════════════════
  // ── FORMULIER ──
  // ══════════════════════════════════════════════════════════
  return (
    <div className="view-content form-content">
      <div className="top-acties">
        <button className="form-terug" onClick={onTerugNaarDetail}>← Terug</button>
        <button className="btn btn-primair" onClick={opslaan} disabled={bezig}>{bezig ? 'Opslaan...' : '💾 Opslaan'}</button>
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
        <textarea value={formulier.omschrijving} onChange={e => setVeld('omschrijving', e.target.value)} placeholder="Beschrijf het uitgevoerde werk..." rows={3} style={{ width: '100%', resize: 'vertical' }} />
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
          <div className="materiaal-lijst">
            {materialen.map((m, i) => (
              <div key={i} className="werkdag-item" style={{ gap: 6 }}>
                {/* Producten dropdown */}
                {producten.length > 0 && (
                  <select className="med-select" value="" onChange={e => { const p = producten.find(x => x.id === e.target.value); if (p) productSelecteren(i, p) }}>
                    <option value="">— Kies uit producten —</option>
                    {producten.map(p => <option key={p.id} value={p.id}>{p.naam} ({p.eenheid || 'stuk'})</option>)}
                  </select>
                )}
                <div className="materiaal-rij">
                  <input type="text" value={m.omschrijving} onChange={e => updateMateriaal(i, 'omschrijving', e.target.value)} placeholder="Omschrijving" />
                  <input type="number" value={m.aantal} onChange={e => updateMateriaal(i, 'aantal', e.target.value)} min="0" step="1" style={{ textAlign: 'center' }} />
                  <select value={m.eenheid || 'stuk'} onChange={e => updateMateriaal(i, 'eenheid', e.target.value)} style={{ padding: '8px 6px', border: '1px solid var(--grens)', borderRadius: 6, fontSize: 14 }}>
                    {['stuk', 'm²', 'meter', 'liter', 'kg', 'uur', 'set', 'rol', 'doos', 'pak'].map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <button className="btn-verwijder" onClick={() => verwijderMateriaal(i)}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <button className="btn-toevoegen" onClick={voegMateriaalToe}>+ Materiaal toevoegen</button>
      </div>

      {/* Ritten */}
      <div className="sectie">
        <div className="sectie-titel">Reistijd &amp; kilometers</div>
        {ritten.map((r, i) => (
          <div key={i} className="rit-kaart">
            <div className="rit-kaart-kop">
              <input type="date" value={r.datum || ''} onChange={e => updateRit(i, 'datum', e.target.value)} style={{ flex: 1 }} />
              <button className="btn-verwijder" onClick={() => verwijderRit(i)}>×</button>
            </div>
            <div className="rit-adres-rij">
              <input type="text" value={r.startadres || ''} onChange={e => updateRit(i, 'startadres', e.target.value)} placeholder="Startadres (bijv. jouw thuisadres)" style={{ flex: 1 }} />
              <button className="rit-route-btn" onClick={() => berekenRoute(i)} disabled={r._bezig}>
                {r._bezig ? '⏳' : '🗺️ Bereken'}
              </button>
            </div>
            <div className="rit-nummers-rij">
              <div className="rit-num-veld">
                <label>Reistijd (min)</label>
                <input type="number" value={r.reistijd || ''} onChange={e => updateRit(i, 'reistijd', e.target.value)} placeholder="0" min="0" />
              </div>
              <div className="rit-num-veld">
                <label>Kilometers</label>
                <input type="number" value={r.kilometers || ''} onChange={e => updateRit(i, 'kilometers', e.target.value)} placeholder="0" min="0" step="0.1" />
              </div>
            </div>
          </div>
        ))}
        <button className="btn-toevoegen" onClick={voegRitToe}>+ Rit toevoegen</button>
        {ritten.length > 0 && (
          <div className="rit-totaal">
            Totaal: <strong>{ritten.reduce((s, r) => s + (parseFloat(r.kilometers) || 0), 0).toFixed(1)} km</strong>
          </div>
        )}
      </div>

      {/* Foto's */}
      <div className="sectie">
        <div className="sectie-titel">Foto's</div>
        {fotos.length > 0 && (
          <div className="foto-lijst" style={{ marginBottom: 10 }}>
            {fotos.map((foto, i) => (
              <div key={i} className="foto-rij">
                <span className="foto-naam">📷 {foto.naam}</span>
                <a href={foto.url} target="_blank" rel="noreferrer" className="foto-link-btn">Bekijk</a>
                <button className="btn-verwijder" onClick={() => verwijderFoto(i)}>×</button>
              </div>
            ))}
          </div>
        )}
        <label className={`btn-toevoegen ${fotoUploadBezig ? 'disabled' : ''}`} style={{ cursor: 'pointer', display: 'inline-block' }}>
          {fotoUploadBezig ? '⏳ Uploaden...' : '📷 Foto toevoegen'}
          <input ref={fotoInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFotoKiezen} disabled={fotoUploadBezig} />
        </label>
      </div>

      {/* Notities */}
      <div className="sectie">
        <div className="sectie-titel">Notities</div>
        <textarea value={formulier.notities} onChange={e => setVeld('notities', e.target.value)} placeholder="Interne notities..." rows={3} style={{ width: '100%', resize: 'vertical' }} />
      </div>

      <div style={{ padding: '8px 0 80px' }}>
        <button className="btn btn-primair" style={{ width: '100%', padding: 14 }} onClick={opslaan} disabled={bezig}>
          {bezig ? 'Opslaan...' : '💾 Werkbon opslaan'}
        </button>
      </div>
    </div>
  )
}
