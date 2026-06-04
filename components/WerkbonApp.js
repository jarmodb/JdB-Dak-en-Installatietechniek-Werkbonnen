'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { genereerUBL } from '@/lib/ubl'

// ── Helpers ─────────────────────────────────────────────────────────
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

function bereken(uren, uurtarief, materialen) {
  const arbeid = (parseFloat(uren) || 0) * (parseFloat(uurtarief) || 0)
  const mat_totaal = materialen.reduce((s, m) => s + (parseFloat(m.aantal) || 0) * (parseFloat(m.prijs) || 0), 0)
  const excl_btw = arbeid + mat_totaal
  const btw = excl_btw * 0.21
  const totaal_incl = excl_btw + btw
  return { arbeid, mat_totaal, excl_btw, btw, totaal_incl }
}

function leegFormulier() {
  return {
    nummer: '',
    datum: vandaag(),
    type: 'Loodgieter',
    klant_naam: '',
    klant_adres: '',
    klant_postcode: '',
    klant_plaats: '',
    klant_tel: '',
    omschrijving: '',
    uren: '',
    uurtarief: '',
    notities: '',
  }
}

// ── Hoofd component ──────────────────────────────────────────────────
export default function WerkbonApp() {
  const [view, setView] = useState('overzicht')
  const [werkbonnen, setWerkbonnen] = useState([])
  const [huidigeBon, setHuidigeBon] = useState(null)
  const [bewerkModus, setBewerkModus] = useState(false)
  const [laden, setLaden] = useState(true)
  const [formulier, setFormulier] = useState(leegFormulier())
  const [materialen, setMaterialen] = useState([])
  const [verwijderModal, setVerwijderModal] = useState(false)
  const [bezig, setBezig] = useState(false)

  useEffect(() => { laadWerkbonnen() }, [])

  async function laadWerkbonnen() {
    setLaden(true)
    const { data, error } = await supabase
      .from('werkbonnen')
      .select('*')
      .order('aangemaakt', { ascending: false })
    if (!error) setWerkbonnen(data || [])
    setLaden(false)
  }

  // ── Navigatie ────────────────────────────────────────────────────
  function toonOverzicht() {
    setView('overzicht')
    setHuidigeBon(null)
    setBewerkModus(false)
  }

  function toonDetail(bon) {
    setHuidigeBon(bon)
    setView('detail')
  }

  function nieuweWerkbon() {
    setBewerkModus(false)
    setHuidigeBon(null)
    setFormulier({ ...leegFormulier(), nummer: genNummer(werkbonnen) })
    setMaterialen([])
    setView('formulier')
  }

  function bewerkWerkbon() {
    if (!huidigeBon) return
    setBewerkModus(true)
    setFormulier({
      nummer: huidigeBon.nummer || '',
      datum: huidigeBon.datum || vandaag(),
      type: huidigeBon.type || 'Loodgieter',
      klant_naam: huidigeBon.klant_naam || '',
      klant_adres: huidigeBon.klant_adres || '',
      klant_postcode: huidigeBon.klant_postcode || '',
      klant_plaats: huidigeBon.klant_plaats || '',
      klant_tel: huidigeBon.klant_tel || '',
      omschrijving: huidigeBon.omschrijving || '',
      uren: huidigeBon.uren || '',
      uurtarief: huidigeBon.uurtarief || '',
      notities: huidigeBon.notities || '',
    })
    setMaterialen(huidigeBon.materialen || [])
    setView('formulier')
  }

  // ── Formulier ────────────────────────────────────────────────────
  function setVeld(key, val) {
    setFormulier(f => ({ ...f, [key]: val }))
  }

  function voegMateriaaltoe() {
    setMaterialen(m => [...m, { omschrijving: '', aantal: '', prijs: '' }])
  }

  function updateMateriaal(idx, key, val) {
    setMaterialen(m => m.map((item, i) => i === idx ? { ...item, [key]: val } : item))
  }

  function verwijderMateriaal(idx) {
    setMaterialen(m => m.filter((_, i) => i !== idx))
  }

  async function slaWerkbonOp() {
    setBezig(true)
    const geldigeMat = materialen
      .filter(m => m.omschrijving || m.aantal || m.prijs)
      .map(m => ({
        omschrijving: m.omschrijving,
        aantal: parseFloat(m.aantal) || 0,
        prijs: parseFloat(m.prijs) || 0,
      }))

    const totalen = bereken(formulier.uren, formulier.uurtarief, geldigeMat)

    const rij = {
      nummer: formulier.nummer,
      datum: formulier.datum,
      type: formulier.type,
      klant_naam: formulier.klant_naam,
      klant_adres: formulier.klant_adres,
      klant_postcode: formulier.klant_postcode,
      klant_plaats: formulier.klant_plaats,
      klant_tel: formulier.klant_tel,
      omschrijving: formulier.omschrijving,
      uren: parseFloat(formulier.uren) || 0,
      uurtarief: parseFloat(formulier.uurtarief) || 0,
      materialen: geldigeMat,
      notities: formulier.notities,
      ...totalen,
    }

    let result
    if (bewerkModus && huidigeBon) {
      const { data } = await supabase
        .from('werkbonnen')
        .update(rij)
        .eq('id', huidigeBon.id)
        .select()
        .single()
      result = data
    } else {
      const { data } = await supabase
        .from('werkbonnen')
        .insert(rij)
        .select()
        .single()
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
    a.href = url
    a.download = `${huidigeBon.nummer}.xml`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Live berekening voor formulier
  const totalen = bereken(formulier.uren, formulier.uurtarief, materialen)

  // ── Header tekst ─────────────────────────────────────────────────
  const headerTitel = view === 'overzicht' ? 'Werkbonnen'
    : view === 'formulier' ? (bewerkModus ? 'Bewerken' : 'Nieuwe werkbon')
    : huidigeBon?.nummer || ''
  const headerSub = view === 'detail' ? (huidigeBon?.klant_naam || '') : ''

  return (
    <>
      <header>
        <div>
          <h1>{headerTitel}</h1>
          {headerSub && <span>{headerSub}</span>}
        </div>
      </header>

      {/* ── OVERZICHT ── */}
      {view === 'overzicht' && (
        <div className="view-content">
          <div className="overzicht-header">
            <h2>{werkbonnen.length} {werkbonnen.length === 1 ? 'werkbon' : 'werkbonnen'}</h2>
          </div>

          {laden ? (
            <div className="laden">Laden...</div>
          ) : werkbonnen.length === 0 ? (
            <div className="leeg">
              <p>Nog geen werkbonnen.<br />Tik op <strong>+</strong> om te beginnen.</p>
            </div>
          ) : (
            <div className="bon-lijst">
              {werkbonnen.map(bon => (
                <div key={bon.id} className="bon-kaart" onClick={() => toonDetail(bon)}>
                  <div className="bon-nummer">{bon.nummer}</div>
                  <div className="bon-info">
                    <div className="bon-klant">{bon.klant_naam || '(geen naam)'}</div>
                    <div className="bon-meta">
                      {datumNL(bon.datum)} &bull; {bon.type} &bull; {' '}
                      <span className={`status-badge ${bon.gefactureerd ? 'status-gefactureerd' : 'status-open'}`}>
                        {bon.gefactureerd ? 'Gefactureerd' : 'Open'}
                      </span>
                    </div>
                  </div>
                  <div className="bon-totaal">{euro(bon.totaal_incl)}</div>
                </div>
              ))}
            </div>
          )}

          <button className="fab" onClick={nieuweWerkbon} title="Nieuwe werkbon">+</button>
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
            <div className="veld">
              <label>Type werk</label>
              <select value={formulier.type} onChange={e => setVeld('type', e.target.value)}>
                <option>Loodgieter</option>
                <option>Dakdekker</option>
                <option>Loodgieter + Dakdekker</option>
                <option>Overig</option>
              </select>
            </div>
          </div>

          <div className="sectie">
            <div className="sectie-titel">Klantgegevens</div>
            <div className="veld">
              <label>Naam</label>
              <input type="text" value={formulier.klant_naam} onChange={e => setVeld('klant_naam', e.target.value)} placeholder="Voornaam Achternaam" />
            </div>
            <div className="veld">
              <label>Adres</label>
              <input type="text" value={formulier.klant_adres} onChange={e => setVeld('klant_adres', e.target.value)} placeholder="Straat en huisnummer" />
            </div>
            <div className="rij-2">
              <div className="veld">
                <label>Postcode</label>
                <input type="text" value={formulier.klant_postcode} onChange={e => setVeld('klant_postcode', e.target.value)} placeholder="1234 AB" />
              </div>
              <div className="veld">
                <label>Plaats</label>
                <input type="text" value={formulier.klant_plaats} onChange={e => setVeld('klant_plaats', e.target.value)} placeholder="Amsterdam" />
              </div>
            </div>
            <div className="veld">
              <label>Telefoon</label>
              <input type="tel" value={formulier.klant_tel} onChange={e => setVeld('klant_tel', e.target.value)} placeholder="06-12345678" />
            </div>
          </div>

          <div className="sectie">
            <div className="sectie-titel">Omschrijving werkzaamheden</div>
            <textarea
              value={formulier.omschrijving}
              onChange={e => setVeld('omschrijving', e.target.value)}
              placeholder="Beschrijf wat er gedaan is..."
              rows={4}
            />
          </div>

          <div className="sectie">
            <div className="sectie-titel">Uren</div>
            <div className="rij-2">
              <div className="veld">
                <label>Aantal uren</label>
                <input type="number" value={formulier.uren} onChange={e => setVeld('uren', e.target.value)} placeholder="0" min="0" step="0.5" />
              </div>
              <div className="veld">
                <label>Uurtarief (€)</label>
                <input type="number" value={formulier.uurtarief} onChange={e => setVeld('uurtarief', e.target.value)} placeholder="0.00" min="0" step="0.50" />
              </div>
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
                  <input
                    type="text"
                    value={m.omschrijving}
                    onChange={e => updateMateriaal(i, 'omschrijving', e.target.value)}
                    placeholder="Omschrijving"
                  />
                  <input
                    type="number"
                    value={m.aantal}
                    onChange={e => updateMateriaal(i, 'aantal', e.target.value)}
                    placeholder="0"
                    min="0"
                    style={{ textAlign: 'center' }}
                  />
                  <input
                    type="number"
                    value={m.prijs}
                    onChange={e => updateMateriaal(i, 'prijs', e.target.value)}
                    placeholder="0,00"
                    min="0"
                    step="0.01"
                    style={{ textAlign: 'right' }}
                  />
                  <button className="btn-verwijder" onClick={() => verwijderMateriaal(i)}>×</button>
                </div>
              ))}
            </div>
            <button className="btn-toevoegen" onClick={voegMateriaaltoe}>+ Materiaal toevoegen</button>
          </div>

          <div className="sectie">
            <div className="sectie-titel">Totaal overzicht</div>
            <div className="totaal-rij"><span>Arbeid</span><span>{euro(totalen.arbeid)}</span></div>
            <div className="totaal-rij"><span>Materialen</span><span>{euro(totalen.mat_totaal)}</span></div>
            <div className="totaal-rij"><span>Totaal excl. BTW</span><span>{euro(totalen.excl_btw)}</span></div>
            <div className="totaal-rij"><span>BTW (21%)</span><span>{euro(totalen.btw)}</span></div>
            <div className="totaal-rij groot"><span>Totaal incl. BTW</span><span>{euro(totalen.totaal_incl)}</span></div>
          </div>

          <div className="sectie">
            <div className="sectie-titel">Notities (intern, niet op bon)</div>
            <textarea
              value={formulier.notities}
              onChange={e => setVeld('notities', e.target.value)}
              placeholder="Interne notities..."
              rows={2}
            />
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
            <button className="btn btn-primair" onClick={() => window.print()}>
              🖨️ PDF / Afdrukken
            </button>
            <button className="btn btn-digiboox" onClick={exporteerUBL}>
              📤 Exporteer naar Digiboox
            </button>
            <button className="btn btn-licht" onClick={bewerkWerkbon}>
              ✏️ Bewerken
            </button>
            <button
              className={`btn ${huidigeBon.gefactureerd ? 'btn-groen-licht' : 'btn-licht'}`}
              onClick={wisselStatus}
            >
              {huidigeBon.gefactureerd ? '✓ Gefactureerd' : 'Markeer gefactureerd'}
            </button>
            <button className="btn btn-gevaar-licht" onClick={() => setVerwijderModal(true)}>
              🗑️
            </button>
          </div>

          <div className="bon-print">
            <BonAfdruk bon={huidigeBon} />
          </div>
        </div>
      )}

      {/* ── VERWIJDER MODAL ── */}
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

// ── Bon afdruk component ─────────────────────────────────────────────
function BonAfdruk({ bon }) {
  const heeftRegels = bon.uren > 0 || (bon.materialen?.length > 0)

  return (
    <>
      <div className="bon-kop">
        <div className="bon-kop-rij">
          <div>
            <div className="bon-bedrijf">Jordy – Loodgieter &amp; Dakdekker</div>
            <div className="bon-kop-sub">{bon.type}</div>
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
        <div className="bon-sectie">
          <div className="bon-sectie-titel">Klant</div>
          <div className="bon-klant-info">
            <p><strong>{bon.klant_naam || '–'}</strong></p>
            {bon.klant_adres && <p>{bon.klant_adres}</p>}
            {(bon.klant_postcode || bon.klant_plaats) && (
              <p>{bon.klant_postcode} {bon.klant_plaats}</p>
            )}
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
                {bon.uren > 0 && (
                  <tr>
                    <td>Arbeid ({bon.uren} uur × {euro(bon.uurtarief)})</td>
                    <td style={{ textAlign: 'center' }}>{bon.uren}</td>
                    <td style={{ textAlign: 'right' }}>{euro(bon.uurtarief)}</td>
                    <td style={{ textAlign: 'right' }}>{euro(bon.arbeid)}</td>
                  </tr>
                )}
                {(bon.materialen || []).map((m, i) => (
                  <tr key={i}>
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
      </div>

      <div className="bon-footer">
        Werkbon gegenereerd op {new Date().toLocaleDateString('nl-NL')} &bull; Bewaar dit document voor uw administratie
      </div>
    </>
  )
}
