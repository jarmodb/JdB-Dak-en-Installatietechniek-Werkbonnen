'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { genereerUBL } from '@/lib/ubl'
import { msLogin, msLogout, msGetAccount, uploadFotoNaarOneDrive } from '@/lib/onedrive'

const WERK_TYPES = ['Gas', 'Water', 'Verwarming', 'Sanitair', 'Riolering', 'Dakbedekking', 'Zinkwerken', 'Graafwerkzaamheden']

function euro(n) {
  return '€ ' + Number(n || 0).toFixed(2).replace('.', ',')
}
function datumNL(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}
function vandaag() {
  return new Date().toISOString().split('T')[0]
}
function genNummer(werkbonnen) {
  const jaar = new Date().getFullYear()
  const dit_jaar = werkbonnen.filter(b => b.nummer?.startsWith('WB-' + jaar))
  return `WB-${jaar}-${String(dit_jaar.length + 1).padStart(3, '0')}`
}
function bereken(werkdagen, uurtarief, materialen) {
  const totalUren = werkdagen.reduce((s, w) => s + (parseFloat(w.uren) || 0), 0)
  const arbeid = totalUren * (parseFloat(uurtarief) || 0)
  const mat_totaal = materialen.reduce((s, m) => s + (parseFloat(m.aantal) || 0) * (parseFloat(m.prijs) || 0), 0)
  const excl_btw = arbeid + mat_totaal
  const btw = excl_btw * 0.21
  const totaal_incl = excl_btw + btw
  return { arbeid, mat_totaal, excl_btw, btw, totaal_incl, totalUren }
}
function leegFormulier() {
  return {
    nummer: '', datum: vandaag(),
    klant_naam: '', klant_straat: '', klant_huisnummer: '',
    klant_postcode: '', klant_plaats: '', klant_tel: '',
    omschrijving: '', uurtarief: '', notities: '',
  }
}

export default function WerkbonApp() {
  const [view, setView] = useState('overzicht')
  const [werkbonnen, setWerkbonnen] = useState([])
  const [huidigeBon, setHuidigeBon] = useState(null)
  const [bewerkModus, setBewerkModus] = useState(false)
  const [laden, setLaden] = useState(true)
  const [formulier, setFormulier] = useState(leegFormulier())
  const [werkdagen, setWerkdagen] = useState([])
  const [geselecteerdeTypes, setGeselecteerdeTypes] = useState([])
  const [materialen, setMaterialen] = useState([])
  const [fotos, setFotos] = useState([])
  const [verwijderModal, setVerwijderModal] = useState(false)
  const [bezig, setBezig] = useState(false)
  const [syncActief, setSyncActief] = useState(false)
  const [postcodeBezig, setPostcodeBezig] = useState(false)
  const [msIngelogd, setMsIngelogd] = useState(false)
  const [fotoUploadBezig, setFotoUploadBezig] = useState(false)
  const fotoInputRef = useRef(null)

  useEffect(() => {
    window.history.replaceState({ view: 'overzicht' }, '')
    laadWerkbonnen()

    // Check Microsoft login status
    msGetAccount().then(account => setMsIngelogd(!!account))

    // Real-time sync
    const channel = supabase
      .channel('werkbonnen-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'werkbonnen' }, () => {
        setSyncActief(true)
        laadWerkbonnen()
        setTimeout(() => setSyncActief(false), 1500)
      })
      .subscribe()

    // Browser terugknop
    function handlePopState(e) {
      const state = e.state
      if (!state || state.view === 'overzicht') {
        setView('overzicht'); setHuidigeBon(null); setBewerkModus(false)
      } else if (state.view === 'detail') {
        setView('detail'); setHuidigeBon(state.bon); setBewerkModus(false)
      } else if (state.view === 'formulier') {
        setView('formulier')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => { supabase.removeChannel(channel); window.removeEventListener('popstate', handlePopState) }
  }, [])

  async function laadWerkbonnen() {
    setLaden(true)
    const { data, error } = await supabase.from('werkbonnen').select('*').order('aangemaakt', { ascending: false })
    if (!error) setWerkbonnen(data || [])
    setLaden(false)
  }

  // ── Navigatie ────────────────────────────────────────────────────
  function toonOverzicht() {
    window.history.pushState({ view: 'overzicht' }, '')
    setView('overzicht'); setHuidigeBon(null); setBewerkModus(false)
  }
  function toonDetail(bon) {
    window.history.pushState({ view: 'detail', bon }, '')
    setHuidigeBon(bon); setView('detail')
  }
  function nieuweWerkbon() {
    window.history.pushState({ view: 'formulier' }, '')
    setBewerkModus(false); setHuidigeBon(null)
    setFormulier({ ...leegFormulier(), nummer: genNummer(werkbonnen) })
    setWerkdagen([{ datum: vandaag(), omschrijving: '', uren: '' }])
    setGeselecteerdeTypes([]); setMaterialen([]); setFotos([])
    setView('formulier')
  }
  function bewerkWerkbon() {
    if (!huidigeBon) return
    window.history.pushState({ view: 'formulier', bon: huidigeBon }, '')
    setBewerkModus(true)
    setFormulier({
      nummer: huidigeBon.nummer || '',
      datum: huidigeBon.datum || vandaag(),
      klant_naam: huidigeBon.klant_naam || '',
      klant_straat: huidigeBon.klant_adres || '',   // bestaand adres in straatveld
      klant_huisnummer: '',
      klant_postcode: huidigeBon.klant_postcode || '',
      klant_plaats: huidigeBon.klant_plaats || '',
      klant_tel: huidigeBon.klant_tel || '',
      omschrijving: huidigeBon.omschrijving || '',
      uurtarief: huidigeBon.uurtarief || '',
      notities: huidigeBon.notities || '',
    })
    setWerkdagen(huidigeBon.werkdagen?.length ? huidigeBon.werkdagen : [{ datum: vandaag(), omschrijving: '', uren: '' }])
    setGeselecteerdeTypes(huidigeBon.type ? huidigeBon.type.split(', ').filter(Boolean) : [])
    setMaterialen(huidigeBon.materialen || [])
    setFotos(huidigeBon.fotos || [])
    setView('formulier')
  }

  // ── Formulier helpers ────────────────────────────────────────────
  function setVeld(key, val) { setFormulier(f => ({ ...f, [key]: val })) }

  function toggleType(type) {
    setGeselecteerdeTypes(t => t.includes(type) ? t.filter(x => x !== type) : [...t, type])
  }

  // Postcode lookup (PDOK — gratis overheids-API)
  async function postcodeOpzoeken() {
    const pc = formulier.klant_postcode.replace(/\s/g, '')
    if (pc.length < 6) return
    setPostcodeBezig(true)
    try {
      const q = formulier.klant_huisnummer ? `${pc} ${formulier.klant_huisnummer}` : pc
      const res = await fetch(
        `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(q)}&fl=straatnaam,woonplaatsnaam&rows=1`
      )
      const data = await res.json()
      const hit = data.response?.docs?.[0]
      if (hit) {
        if (hit.straatnaam) setVeld('klant_straat', hit.straatnaam)
        if (hit.woonplaatsnaam) setVeld('klant_plaats', hit.woonplaatsnaam)
      }
    } catch { /* stil falen */ }
    setPostcodeBezig(false)
  }

  // Werkdagen
  function voegWerkdagToe() { setWerkdagen(w => [...w, { datum: vandaag(), omschrijving: '', uren: '' }]) }
  function updateWerkdag(idx, key, val) { setWerkdagen(w => w.map((item, i) => i === idx ? { ...item, [key]: val } : item)) }
  function verwijderWerkdag(idx) { setWerkdagen(w => w.filter((_, i) => i !== idx)) }

  // Materialen
  function voegMateriaaltoe() { setMaterialen(m => [...m, { omschrijving: '', aantal: '', prijs: '' }]) }
  function updateMateriaal(idx, key, val) { setMaterialen(m => m.map((item, i) => i === idx ? { ...item, [key]: val } : item)) }
  function verwijderMateriaal(idx) { setMaterialen(m => m.filter((_, i) => i !== idx)) }

  // Microsoft / OneDrive
  async function handleMsLogin() {
    try {
      await msLogin()
      setMsIngelogd(true)
    } catch (e) { alert('Inloggen mislukt: ' + e.message) }
  }
  async function handleMsLogout() {
    await msLogout()
    setMsIngelogd(false)
  }
  async function handleFotoKiezen(e) {
    const bestanden = Array.from(e.target.files)
    if (!bestanden.length) return
    setFotoUploadBezig(true)
    const nummer = formulier.nummer || 'concept'
    for (const bestand of bestanden) {
      try {
        const foto = await uploadFotoNaarOneDrive(bestand, nummer)
        setFotos(f => [...f, foto])
      } catch (err) { alert(`Upload mislukt voor ${bestand.name}: ${err.message}`) }
    }
    setFotoUploadBezig(false)
    if (fotoInputRef.current) fotoInputRef.current.value = ''
  }
  function verwijderFoto(idx) { setFotos(f => f.filter((_, i) => i !== idx)) }

  async function slaWerkbonOp() {
    setBezig(true)
    const geldigeWerkdagen = werkdagen
      .filter(w => w.datum || w.omschrijving || w.uren)
      .map(w => ({ datum: w.datum, omschrijving: w.omschrijving, uren: parseFloat(w.uren) || 0 }))
    const geldigeMat = materialen
      .filter(m => m.omschrijving || m.aantal || m.prijs)
      .map(m => ({ omschrijving: m.omschrijving, aantal: parseFloat(m.aantal) || 0, prijs: parseFloat(m.prijs) || 0 }))
    const totalen = bereken(geldigeWerkdagen, formulier.uurtarief, geldigeMat)

    const rij = {
      nummer: formulier.nummer,
      datum: formulier.datum,
      type: geselecteerdeTypes.join(', '),
      klant_naam: formulier.klant_naam,
      klant_adres: [formulier.klant_straat, formulier.klant_huisnummer].filter(Boolean).join(' '),
      klant_postcode: formulier.klant_postcode,
      klant_plaats: formulier.klant_plaats,
      klant_tel: formulier.klant_tel,
      omschrijving: formulier.omschrijving,
      uren: totalen.totalUren,
      uurtarief: parseFloat(formulier.uurtarief) || 0,
      werkdagen: geldigeWerkdagen,
      materialen: geldigeMat,
      fotos,
      notities: formulier.notities,
      arbeid: totalen.arbeid,
      mat_totaal: totalen.mat_totaal,
      excl_btw: totalen.excl_btw,
      btw: totalen.btw,
      totaal_incl: totalen.totaal_incl,
    }

    let result
    if (bewerkModus && huidigeBon) {
      const { data } = await supabase.from('werkbonnen').update(rij).eq('id', huidigeBon.id).select().single()
      result = data
    } else {
      const { data } = await supabase.from('werkbonnen').insert(rij).select().single()
      result = data
    }
    await laadWerkbonnen()
    setBezig(false)
    if (result) toonDetail(result)
    else toonOverzicht()
  }

  // ── Detail acties ────────────────────────────────────────────────
  async function wisselStatus() {
    if (!huidigeBon) return
    const nieuw = !huidigeBon.gefactureerd
    await supabase.from('werkbonnen').update({ gefactureerd: nieuw }).eq('id', huidigeBon.id)
    const bijgewerkt = { ...huidigeBon, gefactureerd: nieuw }
    setHuidigeBon(bijgewerkt)
    setWerkbonnen(w => w.map(b => b.id === huidigeBon.id ? bijgewerkt : b))
  }
  async function verwijderWerkbon() {
    if (!huidigeBon) return
    await supabase.from('werkbonnen').delete().eq('id', huidigeBon.id)
    setVerwijderModal(false)
    await laadWerkbonnen()
    toonOverzicht()
  }
  function exporteerUBL() {
    if (!huidigeBon) return
    const xml = genereerUBL(huidigeBon)
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${huidigeBon.nummer}.xml`; a.click()
    URL.revokeObjectURL(url)
  }

  const totalen = bereken(werkdagen, formulier.uurtarief, materialen)
  const totalUrenDisplay = totalen.totalUren
  const headerTitel = view === 'overzicht' ? 'JdB Werkbonnen'
    : view === 'formulier' ? (bewerkModus ? 'Bewerken' : 'Nieuwe werkbon')
    : huidigeBon?.nummer || ''
  const headerSub = view === 'detail' ? (huidigeBon?.klant_naam || '') : ''

  return (
    <>
      <header>
        <div>
          <h1>{headerTitel}{syncActief && <span className="sync-dot" />}</h1>
          {headerSub && <span>{headerSub}</span>}
        </div>
        {/* Microsoft login knop in header */}
        <button
          className={`btn-ms-header ${msIngelogd ? 'ingelogd' : ''}`}
          onClick={msIngelogd ? handleMsLogout : handleMsLogin}
          title={msIngelogd ? 'Uitloggen bij Microsoft' : 'Inloggen voor foto-upload'}
        >
          {msIngelogd ? '☁️ MS ✓' : '☁️ MS'}
        </button>
      </header>

      {/* ── OVERZICHT ── */}
      {view === 'overzicht' && (
        <div className="view-content">
          <div className="overzicht-header">
            <h2>{werkbonnen.length} {werkbonnen.length === 1 ? 'werkbon' : 'werkbonnen'}</h2>
          </div>
          {laden ? <div className="laden">Laden...</div>
            : werkbonnen.length === 0 ? (
              <div className="leeg"><p>Nog geen werkbonnen.<br />Tik op <strong>+</strong> om te beginnen.</p></div>
            ) : (
              <div className="bon-lijst">
                {werkbonnen.map(bon => (
                  <div key={bon.id} className="bon-kaart" onClick={() => toonDetail(bon)}>
                    <div className="bon-nummer">{bon.nummer}</div>
                    <div className="bon-info">
                      <div className="bon-klant">{bon.klant_naam || '(geen naam)'}</div>
                      <div className="bon-meta">
                        {datumNL(bon.datum)} &bull; {bon.type || '–'} &bull; {' '}
                        <span className={`status-badge ${bon.gefactureerd ? 'status-gefactureerd' : 'status-open'}`}>
                          {bon.gefactureerd ? 'Gefactureerd' : 'Open'}
                        </span>
                        {bon.fotos?.length > 0 && <span className="foto-badge">📷 {bon.fotos.length}</span>}
                      </div>
                    </div>
                    <div className="bon-totaal">{euro(bon.totaal_incl)}</div>
                  </div>
                ))}
              </div>
            )}
          <button className="fab" onClick={nieuweWerkbon}>+</button>
        </div>
      )}

      {/* ── FORMULIER ── */}
      {view === 'formulier' && (
        <div className="view-content form-content">
          <button className="form-terug" onClick={toonOverzicht}>← Terug</button>

          <div className="sectie">
            <div className="sectie-titel">Werkbon info</div>
            <div className="rij-2">
              <div className="veld">
                <label>Bonnummer</label>
                <input type="text" value={formulier.nummer} readOnly className="readonly" />
              </div>
              <div className="veld">
                <label>Datum</label>
                <input type="date" value={formulier.datum} onChange={e => setVeld('datum', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="sectie">
            <div className="sectie-titel">Type werkzaamheden</div>
            <div className="type-grid">
              {WERK_TYPES.map(type => (
                <label key={type} className={`type-optie ${geselecteerdeTypes.includes(type) ? 'geselecteerd' : ''}`}>
                  <input type="checkbox" checked={geselecteerdeTypes.includes(type)} onChange={() => toggleType(type)} />
                  <div className="type-vinkje">{geselecteerdeTypes.includes(type) ? '✓' : ''}</div>
                  <span className="type-label">{type}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="sectie">
            <div className="sectie-titel">Klantgegevens</div>
            <div className="veld">
              <label>Naam</label>
              <input type="text" value={formulier.klant_naam} onChange={e => setVeld('klant_naam', e.target.value)} placeholder="Voornaam Achternaam" />
            </div>
            {/* Postcode + huisnummer eerst voor auto-lookup */}
            <div className="rij-2">
              <div className="veld">
                <label>Postcode</label>
                <div className="input-met-indicator">
                  <input
                    type="text"
                    value={formulier.klant_postcode}
                    onChange={e => setVeld('klant_postcode', e.target.value)}
                    onBlur={postcodeOpzoeken}
                    placeholder="1234 AB"
                  />
                  {postcodeBezig && <span className="input-spinner">⟳</span>}
                </div>
              </div>
              <div className="veld">
                <label>Huisnummer</label>
                <input
                  type="text"
                  value={formulier.klant_huisnummer}
                  onChange={e => setVeld('klant_huisnummer', e.target.value)}
                  onBlur={postcodeOpzoeken}
                  placeholder="10"
                />
              </div>
            </div>
            <div className="rij-2">
              <div className="veld">
                <label>Straat {postcodeBezig && <span style={{color:'var(--goud)', fontSize:11}}>opzoeken...</span>}</label>
                <input type="text" value={formulier.klant_straat} onChange={e => setVeld('klant_straat', e.target.value)} placeholder="Automatisch ingevuld" />
              </div>
              <div className="veld">
                <label>Plaats</label>
                <input type="text" value={formulier.klant_plaats} onChange={e => setVeld('klant_plaats', e.target.value)} placeholder="Automatisch ingevuld" />
              </div>
            </div>
            <div className="veld">
              <label>Telefoon</label>
              <input type="tel" value={formulier.klant_tel} onChange={e => setVeld('klant_tel', e.target.value)} placeholder="06-12345678" />
            </div>
          </div>

          <div className="sectie">
            <div className="sectie-titel">Omschrijving werkzaamheden</div>
            <textarea value={formulier.omschrijving} onChange={e => setVeld('omschrijving', e.target.value)} placeholder="Beschrijf wat er gedaan is..." rows={3} />
          </div>

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
                <div key={i} className="werkdag-rij">
                  <input type="date" value={w.datum} onChange={e => updateWerkdag(i, 'datum', e.target.value)} />
                  <input type="text" value={w.omschrijving} onChange={e => updateWerkdag(i, 'omschrijving', e.target.value)} placeholder="Wat gedaan?" />
                  <input type="number" value={w.uren} onChange={e => updateWerkdag(i, 'uren', e.target.value)} placeholder="0" min="0" step="0.5" style={{ textAlign: 'center' }} />
                  <button className="btn-verwijder" onClick={() => verwijderWerkdag(i)}>×</button>
                </div>
              ))}
            </div>
            <button className="btn-toevoegen" onClick={voegWerkdagToe}>+ Dag toevoegen</button>
            {totalUrenDisplay > 0 && <div className="uren-totaal">Totaal: <strong>{totalUrenDisplay} uur</strong></div>}
            <div className="veld" style={{ marginTop: 12 }}>
              <label>Uurtarief (€)</label>
              <input type="number" value={formulier.uurtarief} onChange={e => setVeld('uurtarief', e.target.value)} placeholder="0.00" min="0" step="0.50" />
            </div>
          </div>

          <div className="sectie">
            <div className="sectie-titel">Materialen</div>
            <div className="mat-labels">
              <span className="mat-label" style={{ textAlign: 'left' }}>Omschrijving</span>
              <span className="mat-label">Aantal</span>
              <span className="mat-label">Prijs (€)</span>
              <span />
            </div>
            <div className="materialen-lijst">
              {materialen.map((m, i) => (
                <div key={i} className="materiaal-rij">
                  <input type="text" value={m.omschrijving} onChange={e => updateMateriaal(i, 'omschrijving', e.target.value)} placeholder="Omschrijving" />
                  <input type="number" value={m.aantal} onChange={e => updateMateriaal(i, 'aantal', e.target.value)} placeholder="0" min="0" style={{ textAlign: 'center' }} />
                  <input type="number" value={m.prijs} onChange={e => updateMateriaal(i, 'prijs', e.target.value)} placeholder="0,00" min="0" step="0.01" style={{ textAlign: 'right' }} />
                  <button className="btn-verwijder" onClick={() => verwijderMateriaal(i)}>×</button>
                </div>
              ))}
            </div>
            <button className="btn-toevoegen" onClick={voegMateriaaltoe}>+ Materiaal toevoegen</button>
          </div>

          {/* FOTO'S */}
          <div className="sectie">
            <div className="sectie-titel">Foto's (OneDrive)</div>
            {!msIngelogd ? (
              <div className="ms-login-blok">
                <p>Log in met Microsoft om foto's te uploaden naar OneDrive.</p>
                <button className="btn btn-ms" onClick={handleMsLogin}>Inloggen met Microsoft</button>
              </div>
            ) : (
              <>
                <div className="foto-lijst">
                  {fotos.map((foto, i) => (
                    <div key={i} className="foto-rij">
                      <span className="foto-naam">📷 {foto.naam}</span>
                      <a href={foto.shareUrl} target="_blank" rel="noreferrer" className="foto-link-btn">Bekijk</a>
                      <button className="btn-verwijder" onClick={() => verwijderFoto(i)}>×</button>
                    </div>
                  ))}
                </div>
                <label className={`btn-toevoegen ${fotoUploadBezig ? 'disabled' : ''}`}>
                  {fotoUploadBezig ? '⏳ Uploaden...' : '📷 Foto toevoegen'}
                  <input
                    ref={fotoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFotoKiezen}
                    disabled={fotoUploadBezig}
                  />
                </label>
              </>
            )}
          </div>

          <div className="sectie">
            <div className="sectie-titel">Totaal overzicht</div>
            <div className="totaal-rij"><span>Arbeid ({totalUrenDisplay} uur × {euro(formulier.uurtarief || 0)})</span><span>{euro(totalen.arbeid)}</span></div>
            <div className="totaal-rij"><span>Materialen</span><span>{euro(totalen.mat_totaal)}</span></div>
            <div className="totaal-rij"><span>Totaal excl. BTW</span><span>{euro(totalen.excl_btw)}</span></div>
            <div className="totaal-rij"><span>BTW (21%)</span><span>{euro(totalen.btw)}</span></div>
            <div className="totaal-rij groot"><span>Totaal incl. BTW</span><span>{euro(totalen.totaal_incl)}</span></div>
          </div>

          <div className="sectie">
            <div className="sectie-titel">Notities (intern, niet op bon)</div>
            <textarea value={formulier.notities} onChange={e => setVeld('notities', e.target.value)} placeholder="Interne notities..." rows={2} />
          </div>

          <div className="form-acties">
            <button className="btn btn-licht" onClick={toonOverzicht}>Annuleer</button>
            <button className="btn btn-primair" onClick={slaWerkbonOp} disabled={bezig}>
              {bezig ? 'Opslaan...' : '✓ Opslaan'}
            </button>
          </div>
        </div>
      )}

      {/* ── DETAIL ── */}
      {view === 'detail' && huidigeBon && (
        <div className="view-content">
          <button className="form-terug" onClick={toonOverzicht}>← Terug</button>
          <div className="detail-acties">
            <button className="btn btn-primair" onClick={() => window.print()}>🖨️ PDF / Afdrukken</button>
            <button className="btn btn-digiboox" onClick={exporteerUBL}>📤 Exporteer naar Digiboox</button>
            <button className="btn btn-licht" onClick={bewerkWerkbon}>✏️ Bewerken</button>
            <button className={`btn ${huidigeBon.gefactureerd ? 'btn-groen-licht' : 'btn-licht'}`} onClick={wisselStatus}>
              {huidigeBon.gefactureerd ? '✓ Gefactureerd' : 'Markeer gefactureerd'}
            </button>
            <button className="btn btn-gevaar-licht" onClick={() => setVerwijderModal(true)}>🗑️</button>
          </div>
          <div className="bon-print"><BonAfdruk bon={huidigeBon} /></div>
        </div>
      )}

      {verwijderModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Werkbon verwijderen?</h3>
            <p>Dit kan niet ongedaan worden gemaakt.</p>
            <div className="modal-acties">
              <button className="btn btn-licht" onClick={() => setVerwijderModal(false)}>Annuleer</button>
              <button className="btn btn-gevaar" onClick={verwijderWerkbon}>Verwijderen</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function BonAfdruk({ bon }) {
  const types = bon.type ? bon.type.split(', ').filter(Boolean) : []
  const werkdagen = bon.werkdagen || []
  const materialen = bon.materialen || []
  const fotos = bon.fotos || []
  const heeftRegels = werkdagen.length > 0 || materialen.length > 0

  return (
    <>
      <div className="bon-kop">
        <div className="bon-kop-rij">
          <div className="bon-logo-blok">
            <img src="/logo.png" alt="JdB logo" className="bon-logo" onError={e => e.target.style.display = 'none'} />
            <div className="bon-logo-tekst">
              <div className="bon-bedrijf">JdB Dak- &amp; Installatietechniek</div>
              <div className="bon-bedrijf-sub">Dak- &amp; Installatietechniek</div>
            </div>
          </div>
          <div className="bon-kop-nr">
            <div className="nr">{bon.nummer}</div>
            <div className="datum">{datumNL(bon.datum)}</div>
            <div>
              <span className={`status-badge ${bon.gefactureerd ? 'status-gefactureerd' : 'status-open'}`}>
                {bon.gefactureerd ? 'Gefactureerd' : 'Open'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bon-body">
        {types.length > 0 && (
          <div className="bon-sectie">
            <div className="bon-sectie-titel">Type werkzaamheden</div>
            <div className="bon-types">
              {types.map(t => <span key={t} className="bon-type-badge">{t}</span>)}
            </div>
          </div>
        )}

        <div className="bon-sectie">
          <div className="bon-sectie-titel">Klant</div>
          <div className="bon-klant-info">
            <p><strong>{bon.klant_naam || '–'}</strong></p>
            {bon.klant_adres && <p>{bon.klant_adres}</p>}
            {(bon.klant_postcode || bon.klant_plaats) && <p>{bon.klant_postcode} {bon.klant_plaats}</p>}
            {bon.klant_tel && <p>📞 {bon.klant_tel}</p>}
          </div>
        </div>

        {bon.omschrijving && (
          <div className="bon-sectie">
            <div className="bon-sectie-titel">Werkzaamheden</div>
            <div className="bon-omschrijving">{bon.omschrijving}</div>
          </div>
        )}

        {heeftRegels && (
          <div className="bon-sectie">
            <div className="bon-sectie-titel">Specificatie</div>
            <table>
              <thead>
                <tr>
                  <th>Omschrijving</th>
                  <th style={{ textAlign: 'center' }}>Aantal</th>
                  <th style={{ textAlign: 'right' }}>Prijs</th>
                  <th style={{ textAlign: 'right' }}>Totaal</th>
                </tr>
              </thead>
              <tbody>
                {werkdagen.map((w, i) => (
                  <tr key={i}>
                    <td>{datumNL(w.datum)}{w.omschrijving ? ` – ${w.omschrijving}` : ''}</td>
                    <td style={{ textAlign: 'center' }}>{w.uren} uur</td>
                    <td style={{ textAlign: 'right' }}>{euro(bon.uurtarief)}</td>
                    <td style={{ textAlign: 'right' }}>{euro(w.uren * bon.uurtarief)}</td>
                  </tr>
                ))}
                {materialen.map((m, i) => (
                  <tr key={`m${i}`}>
                    <td>{m.omschrijving}</td>
                    <td style={{ textAlign: 'center' }}>{m.aantal}</td>
                    <td style={{ textAlign: 'right' }}>{euro(m.prijs)}</td>
                    <td style={{ textAlign: 'right' }}>{euro(m.aantal * m.prijs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="bon-sectie">
          <div className="bon-totaal-blok">
            <div className="tot-rij"><span>Subtotaal excl. BTW</span><span>{euro(bon.excl_btw)}</span></div>
            <div className="tot-rij"><span>BTW 21%</span><span>{euro(bon.btw)}</span></div>
            <div className="tot-rij eindtotaal"><span>Totaal incl. BTW</span><span>{euro(bon.totaal_incl)}</span></div>
          </div>
        </div>

        {fotos.length > 0 && (
          <div className="bon-sectie">
            <div className="bon-sectie-titel">Foto's ({fotos.length})</div>
            <div className="bon-foto-lijst">
              {fotos.map((foto, i) => (
                <a key={i} href={foto.shareUrl} target="_blank" rel="noreferrer" className="bon-foto-link">
                  📷 {foto.naam}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bon-footer">
        JdB Dak- &amp; Installatietechniek &bull; Werkbon {bon.nummer} &bull; {datumNL(bon.datum)}
      </div>
    </>
  )
}
