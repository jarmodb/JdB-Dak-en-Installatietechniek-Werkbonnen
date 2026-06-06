'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ── Constanten ───────────────────────────────────────────────────────
const MN = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']
const MK = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
const DK = ['Ma','Di','Wo','Do','Vr','Za','Zo']
const DL = ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag']
const KLEUREN_OPTIES = ['#C9A227','#E8A020','#D4380D','#096DD9','#389E0D','#722ED1','#08979C']

// ── Datum helpers ────────────────────────────────────────────────────
function ds(d) {
  if (!d) return ''
  return (d instanceof Date ? d : new Date(d + 'T12:00:00')).toISOString().split('T')[0]
}
function parseDate(str) { return str ? new Date(str + 'T12:00:00') : new Date() }
function vandaag() { return ds(new Date()) }
function isVandaag(d) { return ds(d) === vandaag() }
function tijdStr(t) { return t ? t.slice(0, 5) : '' }
function datumNL(iso) { if (!iso) return ''; const [y,m,d] = iso.split('-'); return `${d}-${m}-${y}` }

function dagIdx(d) {
  const dag = (d instanceof Date ? d : new Date(d + 'T12:00:00')).getDay()
  return dag === 0 ? 6 : dag - 1
}
function addDagen(datum, n) { const d = new Date(datum); d.setDate(d.getDate() + n); return d }
function maandagVan(datum) {
  const d = datum instanceof Date ? new Date(datum) : new Date(datum + 'T12:00:00')
  d.setDate(d.getDate() - dagIdx(d)); d.setHours(12, 0, 0, 0); return d
}
function weekDagenVan(ma) { return Array.from({ length: 7 }, (_, i) => addDagen(ma, i)) }

function weekNummer(datum) {
  const d = datum instanceof Date ? new Date(datum) : new Date(datum + 'T12:00:00')
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

function maandKalender(jaar, maand) {
  const eerste = new Date(jaar, maand, 1, 12, 0, 0)
  const startPad = dagIdx(eerste)
  const laatste = new Date(jaar, maand + 1, 0, 12, 0, 0)
  const eindPad = 6 - dagIdx(laatste)
  const dagen = []
  const d = new Date(jaar, maand, 1 - startPad, 12, 0, 0)
  const eind = new Date(jaar, maand + 1, eindPad, 12, 0, 0)
  while (d <= eind) { dagen.push(new Date(d)); d.setDate(d.getDate() + 1) }
  return dagen
}

function periodeLabel(viewMode, refDatum) {
  if (viewMode === 'maand') return `${MN[refDatum.getMonth()]} ${refDatum.getFullYear()}`
  if (viewMode === 'week') {
    const ma = maandagVan(refDatum)
    const zo = addDagen(ma, 6)
    const wn = weekNummer(ma)
    const range = ma.getMonth() === zo.getMonth()
      ? `${ma.getDate()} – ${zo.getDate()} ${MK[zo.getMonth()]} ${zo.getFullYear()}`
      : `${ma.getDate()} ${MK[ma.getMonth()]} – ${zo.getDate()} ${MK[zo.getMonth()]} ${zo.getFullYear()}`
    return `Week ${wn} · ${range}`
  }
  return `${DL[dagIdx(refDatum)]} ${refDatum.getDate()} ${MN[refDatum.getMonth()]} ${refDatum.getFullYear()}`
}

function periodeVerschuif(viewMode, refDatum, richting) {
  if (viewMode === 'maand') { const d = new Date(refDatum); d.setMonth(d.getMonth() + richting); return d }
  if (viewMode === 'week') return addDagen(refDatum, richting * 7)
  return addDagen(refDatum, richting)
}

function getMedewerkers(a) { return a.medewerkers || (a.toegewezen_aan ? [a.toegewezen_aan] : []) }

function filterAfspraken(afspraken, filterMed) {
  if (!filterMed) return afspraken
  return afspraken.filter(a => getMedewerkers(a).includes(filterMed) || a.voor_iedereen)
}

// ── Autocomplete ─────────────────────────────────────────────────────
function AC({ waarde, opties, onChange, onSelect, placeholder }) {
  const [open, setOpen] = useState(false)
  const filtered = waarde ? opties.filter(o => o.naam.toLowerCase().includes(waarde.toLowerCase())).slice(0, 6) : []
  return (
    <div className="autocomplete">
      <input value={waarde} onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder={placeholder} />
      {open && filtered.length > 0 && (
        <div className="autocomplete-dropdown">
          {filtered.map(o => (
            <div key={o.id} className="autocomplete-optie" onMouseDown={() => { onSelect(o); setOpen(false) }}>
              <div>{o.naam}</div>
              {o.adres && <div className="autocomplete-optie-sub">{[o.adres, o.postcode, o.plaats].filter(Boolean).join(' ')}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Afspraak kaart ────────────────────────────────────────────────────
export function AfspraakKaart({ a, medewerkers, werkbonnen, onClick, readOnly }) {
  const meds = medewerkers?.filter(m => getMedewerkers(a).includes(m.id)) || []
  const bon = werkbonnen?.find(b => b.id === a.werkbon_id)
  const kleur = a.kleur || '#C9A227'
  const adresStr = [a.klant_adres, a.klant_postcode, a.klant_plaats].filter(Boolean).join(' ')
  return (
    <div className="afspraak-kaart" style={{ borderLeftColor: kleur, cursor: readOnly ? 'default' : 'pointer' }}
      onClick={readOnly ? undefined : onClick}>
      <div className="afspraak-kop">
        <span className="afspraak-titel">{a.titel}</span>
        {(a.tijdstip_van || a.tijdstip_tot) && (
          <span className="afspraak-tijd">{tijdStr(a.tijdstip_van)}{a.tijdstip_tot ? ` – ${tijdStr(a.tijdstip_tot)}` : ''}</span>
        )}
      </div>
      {meds.length > 0 && (
        <div className="afspraak-meta">
          {meds.map(m => (
            <span key={m.id} className="afspraak-med-chip" style={{ background: (m.kleur || '#C9A227') + '22', borderColor: m.kleur || '#C9A227' }}>
              <span className="afspraak-med-dot" style={{ background: m.kleur || '#C9A227' }} />
              {m.naam}
            </span>
          ))}
        </div>
      )}
      {a.klant_naam && <div className="afspraak-meta">👤 {a.klant_naam}</div>}
      {adresStr && (
        <div className="afspraak-meta">
          📍 {adresStr}
          <a href={`https://maps.google.com/?q=${encodeURIComponent(adresStr)}`}
            target="_blank" rel="noreferrer" className="maps-knop-mini" onClick={e => e.stopPropagation()}>🗺️</a>
        </div>
      )}
      {a.omschrijving && <div className="afspraak-omschrijving">{a.omschrijving}</div>}
      {bon && <div className="afspraak-bon">📋 {bon.nummer}</div>}
      {a.voor_iedereen && <div className="afspraak-iedereen-badge">📢 Iedereen</div>}
    </div>
  )
}

// ── Afspraak formulier ────────────────────────────────────────────────
function AfspraakForm({ form, setForm, klanten, werkbonnen, medewerkers, onOpslaan, onVerwijder, onAnnuleer, bezig }) {
  function sv(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function klantSelecteren(klant) {
    setForm(f => ({
      ...f, klant_naam: klant.naam, klant_adres: klant.adres || '',
      klant_postcode: klant.postcode || '', klant_plaats: klant.plaats || '',
    }))
  }

  function werkbonSelecteren(werkbonId) {
    setForm(f => {
      const bon = werkbonnen.find(b => b.id === werkbonId)
      if (!bon) return { ...f, werkbon_id: werkbonId }
      return {
        ...f, werkbon_id: werkbonId,
        klant_naam: bon.klant_naam || f.klant_naam,
        klant_adres: bon.klant_adres || f.klant_adres,
        klant_postcode: bon.klant_postcode || f.klant_postcode,
        klant_plaats: bon.klant_plaats || f.klant_plaats,
        omschrijving: f.omschrijving || bon.omschrijving || '',
      }
    })
  }

  function toggleMedewerker(id) {
    const cur = form.medewerkers || []
    sv('medewerkers', cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id])
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
        <div className="veld"><label>Titel *</label>
          <input value={form.titel || ''} onChange={e => sv('titel', e.target.value)} placeholder="Bijv. Loodgieterswerk cv-ketel" />
        </div>
        <div className="rij-2">
          <div className="veld"><label>Datum</label>
            <input type="date" value={form.datum || ''} onChange={e => sv('datum', e.target.value)} />
          </div>
          <div className="veld"><label>Kleur</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>
              {KLEUREN_OPTIES.map(k => (
                <div key={k} onClick={() => sv('kleur', k)} style={{
                  width: 28, height: 28, borderRadius: '50%', background: k, cursor: 'pointer',
                  border: form.kleur === k ? '3px solid white' : '2px solid transparent',
                  boxShadow: form.kleur === k ? `0 0 0 2px ${k}` : 'none'
                }} />
              ))}
            </div>
          </div>
        </div>
        <div className="rij-2">
          <div className="veld"><label>Van</label><input type="time" value={form.tijdstip_van || ''} onChange={e => sv('tijdstip_van', e.target.value)} /></div>
          <div className="veld"><label>Tot</label><input type="time" value={form.tijdstip_tot || ''} onChange={e => sv('tijdstip_tot', e.target.value)} /></div>
        </div>

        {medewerkers.length > 0 && (
          <div className="veld">
            <label>Toegewezen aan</label>
            <div className="medewerker-checkboxen">
              {medewerkers.map(m => {
                const checked = (form.medewerkers || []).includes(m.id)
                return (
                  <label key={m.id} className={`medewerker-checkbox-optie${checked ? ' geselecteerd' : ''}`}
                    style={checked ? { borderColor: m.kleur || '#C9A227', background: (m.kleur || '#C9A227') + '18' } : {}}>
                    <input type="checkbox" checked={checked} onChange={() => toggleMedewerker(m.id)} style={{ display: 'none' }} />
                    <span className="med-checkbox-dot" style={{ background: m.kleur || '#C9A227' }} />
                    {m.naam}
                    {checked && <span style={{ marginLeft: 'auto' }}>✓</span>}
                  </label>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <input type="checkbox" id="voor-iedereen" checked={!!form.voor_iedereen}
                onChange={e => sv('voor_iedereen', e.target.checked)} style={{ width: 'auto', margin: 0 }} />
              <label htmlFor="voor-iedereen" style={{ fontWeight: 'normal', marginBottom: 0, fontSize: 14 }}>
                Zichtbaar voor alle medewerkers
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="sectie">
        <div className="sectie-titel">Klantgegevens</div>
        <div className="veld"><label>Naam</label>
          <AC waarde={form.klant_naam || ''} opties={klanten}
            onChange={v => sv('klant_naam', v)} onSelect={klantSelecteren} placeholder="Zoek klant of typ naam" />
        </div>
        <div className="veld"><label>Adres</label>
          <input value={form.klant_adres || ''} onChange={e => sv('klant_adres', e.target.value)} placeholder="Straat + huisnummer" />
        </div>
        <div className="rij-2">
          <div className="veld"><label>Postcode</label><input value={form.klant_postcode || ''} onChange={e => sv('klant_postcode', e.target.value)} placeholder="1234 AB" /></div>
          <div className="veld"><label>Plaats</label><input value={form.klant_plaats || ''} onChange={e => sv('klant_plaats', e.target.value)} placeholder="Amsterdam" /></div>
        </div>
      </div>

      <div className="sectie">
        <div className="sectie-titel">Omschrijving</div>
        <textarea value={form.omschrijving || ''} onChange={e => sv('omschrijving', e.target.value)} placeholder="Optionele toelichting..." rows={3} />
      </div>

      <div className="sectie">
        <div className="sectie-titel">Koppel werkbon (optioneel)</div>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Klantgegevens en omschrijving worden automatisch overgenomen.</p>
        <select value={form.werkbon_id || ''} onChange={e => werkbonSelecteren(e.target.value)}>
          <option value="">— Geen werkbon —</option>
          {werkbonnen.map(b => <option key={b.id} value={b.id}>{b.nummer}{b.klant_naam ? ` · ${b.klant_naam}` : ''} · {datumNL(b.datum)}</option>)}
        </select>
      </div>
    </div>
  )
}

// ── Medewerkers beheer ────────────────────────────────────────────────
function MedewerkersView({ medewerkers, onVervers, onTerug }) {
  async function voegToe() {
    const naam = window.prompt('Naam van de medewerker:')
    if (!naam?.trim()) return
    const bytes = new Uint8Array(16)
    window.crypto.getRandomValues(bytes)
    const token = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    const kleur = KLEUREN_OPTIES[medewerkers.length % KLEUREN_OPTIES.length]
    await supabase.from('planning_links').insert({ naam: naam.trim(), token, kleur })
    onVervers()
  }

  async function verwijder(id) {
    if (!window.confirm('Medewerker verwijderen? Bestaande afspraken blijven staan.')) return
    await supabase.from('planning_links').delete().eq('id', id)
    onVervers()
  }

  async function stelPinIn(m) {
    const huidig = m.pin ? 'Huidige PIN is ingesteld. ' : ''
    const pin = window.prompt(`${huidig}Nieuwe PIN voor ${m.naam} (4 cijfers):`)
    if (pin === null) return
    if (!/^\d{4}$/.test(pin)) { alert('PIN moet precies 4 cijfers zijn.'); return }
    await supabase.from('planning_links').update({ pin }).eq('id', m.id)
    onVervers()
  }

  function kopieer(token) {
    const url = `${window.location.origin}/planning/${token}`
    navigator.clipboard.writeText(url).then(() => alert('Persoonlijke link gekopieerd!\n\n' + url))
  }

  return (
    <div className="view-content form-content with-bottom-nav">
      <div className="top-acties">
        <button className="form-terug" onClick={onTerug}>← Terug</button>
        <button className="btn btn-primair" onClick={voegToe}>+ Medewerker</button>
      </div>
      <div className="sectie">
        <div className="sectie-titel">Medewerkers</div>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>
          Elke medewerker krijgt een persoonlijke link met PIN. Na inloggen kunnen ze hun planning, taken en werkbonnen beheren.
        </p>
        {medewerkers.length === 0 ? (
          <div className="leeg"><p>Nog geen medewerkers.<br />Klik op <strong>+ Medewerker</strong> om te beginnen.</p></div>
        ) : (
          <div className="bon-lijst">
            {medewerkers.map(m => (
              <div key={m.id} className="klant-kaart" style={{ gap: 10, flexWrap: 'wrap' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: m.kleur || '#C9A227', flexShrink: 0, marginTop: 2 }} />
                <div className="klant-info" style={{ flex: 1, minWidth: 0 }}>
                  <div className="klant-naam">{m.naam}</div>
                  <div className="klant-adres" style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>
                    {typeof window !== 'undefined' ? `${window.location.origin}/planning/${m.token}` : `/planning/${m.token}`}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: m.pin ? '#389E0D' : '#aaa' }}>
                    {m.pin ? '🔒 PIN ingesteld' : '⚠️ Nog geen PIN'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-licht" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => stelPinIn(m)} title="PIN instellen">🔑 PIN</button>
                  <button className="btn btn-licht" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => kopieer(m.token)} title="Link kopiëren">📋</button>
                  <button className="btn-verwijder" onClick={() => verwijder(m.id)}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Maand view ────────────────────────────────────────────────────────
function MaandView({ refDatum, afspraken, onDagKlik }) {
  const jaar = refDatum.getFullYear()
  const maand = refDatum.getMonth()
  const dagen = maandKalender(jaar, maand)
  const weken = []
  for (let i = 0; i < dagen.length; i += 7) weken.push(dagen.slice(i, i + 7))

  return (
    <div className="maand-kalender">
      <div className="maand-dag-headers">
        <div className="maand-wk-header">Wk</div>
        {DK.map(d => <div key={d} className="maand-dag-header">{d}</div>)}
      </div>
      {weken.map((week, wi) => (
        <div key={wi} className="maand-week-rij">
          <div className="maand-wk-nr">{weekNummer(week[0])}</div>
          {week.map(dag => {
            const aps = afspraken.filter(a => a.datum === ds(dag))
            const huidigemnd = dag.getMonth() === maand
            const today = isVandaag(dag)
            return (
              <div key={ds(dag)}
                className={`maand-cel${!huidigemnd ? ' maand-cel-grijs' : ''}${today ? ' maand-cel-vandaag' : ''}`}
                onClick={() => onDagKlik(ds(dag))}>
                <div className="maand-cel-nr">{dag.getDate()}</div>
                <div className="maand-afspraken">
                  {aps.slice(0, 2).map(a => (
                    <div key={a.id} className="maand-afspraak-chip"
                      style={{ background: (a.kleur || '#C9A227') + '22', borderLeftColor: a.kleur || '#C9A227' }}>
                      {tijdStr(a.tijdstip_van) && <span className="maand-chip-tijd">{tijdStr(a.tijdstip_van)}</span>}
                      <span className="maand-chip-titel">{a.titel}</span>
                    </div>
                  ))}
                  {aps.length > 2 && <div className="maand-meer">+{aps.length - 2}</div>}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Week view ─────────────────────────────────────────────────────────
function WeekView({ refDatum, afspraken, medewerkers, werkbonnen, onDagKlik, onAfspraakKlik, readOnly }) {
  const ma = maandagVan(refDatum)
  const dagen = weekDagenVan(ma)

  return (
    <div className="planning-week-lijst">
      {dagen.map(dag => {
        const aps = afspraken.filter(a => a.datum === ds(dag))
        const today = isVandaag(dag)
        return (
          <div key={ds(dag)} className={`planning-dag-sectie${today ? ' planning-vandaag' : ''}`}>
            <div className="planning-dag-label" onClick={() => onDagKlik(ds(dag))}>
              <span className="planning-dag-naam">
                {DK[dagIdx(dag)]} {dag.getDate()} {MK[dag.getMonth()]}{today ? ' · Vandaag' : ''}
              </span>
              {aps.length > 0 && (
                <span className="planning-dag-teller">{aps.length} {aps.length === 1 ? 'afspraak' : 'afspraken'} →</span>
              )}
            </div>
            {aps.length === 0 ? (
              <div className="planning-leeg-dag">Geen afspraken</div>
            ) : (
              aps.map(a => (
                <AfspraakKaart key={a.id} a={a} medewerkers={medewerkers} werkbonnen={werkbonnen}
                  onClick={() => onAfspraakKlik(a)} readOnly={readOnly} />
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Dag view ──────────────────────────────────────────────────────────
function DagView({ refDatum, afspraken, medewerkers, werkbonnen, onAfspraakKlik, readOnly }) {
  const aps = afspraken.filter(a => a.datum === ds(refDatum))
  return (
    <div className="planning-dag-lijst" style={{ padding: '8px 12px' }}>
      {aps.length === 0 ? (
        <div className="leeg" style={{ paddingTop: 40 }}>
          <p>Geen afspraken op deze dag.{!readOnly && <><br />Tik op <strong>+</strong> om toe te voegen.</>}</p>
        </div>
      ) : (
        aps.map(a => (
          <AfspraakKaart key={a.id} a={a} medewerkers={medewerkers} werkbonnen={werkbonnen}
            onClick={() => onAfspraakKlik(a)} readOnly={readOnly} />
        ))
      )}
    </div>
  )
}

// ── Planning header ───────────────────────────────────────────────────
function PlanningHeader({ viewMode, setViewMode, refDatum, setRefDatum, medewerkers, filterMed, setFilterMed, onMedewerkers, readOnly }) {
  return (
    <>
      <div className="planning-toolbar">
        <div className="planning-view-switcher">
          {['maand', 'week', 'dag'].map(v => (
            <button key={v} className={`planning-view-tab${viewMode === v ? ' actief' : ''}`} onClick={() => setViewMode(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        {!readOnly && <button className="planning-med-btn" onClick={onMedewerkers} title="Medewerkers beheren">👷</button>}
      </div>

      <div className="planning-periode-nav">
        <button className="planning-nav-btn" onClick={() => setRefDatum(periodeVerschuif(viewMode, refDatum, -1))}>‹</button>
        <span className="planning-periode-label">{periodeLabel(viewMode, refDatum)}</span>
        <button className="planning-nav-btn" onClick={() => setRefDatum(periodeVerschuif(viewMode, refDatum, 1))}>›</button>
        {ds(refDatum) !== vandaag() && (
          <button className="planning-vandaag-btn" onClick={() => setRefDatum(new Date())}>Vandaag</button>
        )}
      </div>

      {medewerkers.length > 0 && (
        <div className="planning-filter">
          <button className={`planning-filter-btn${!filterMed ? ' actief' : ''}`} onClick={() => setFilterMed('')}>Alles</button>
          {medewerkers.map(m => (
            <button key={m.id} className={`planning-filter-btn${filterMed === m.id ? ' actief' : ''}`}
              style={filterMed === m.id ? { borderColor: m.kleur || '#C9A227', color: m.kleur || '#C9A227', background: (m.kleur || '#C9A227') + '18' } : {}}
              onClick={() => setFilterMed(filterMed === m.id ? '' : m.id)}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: m.kleur || '#C9A227', marginRight: 5 }} />
              {m.naam}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

// ── Hoofd PlanningView (admin) ────────────────────────────────────────
export default function PlanningView({ klanten, werkbonnen }) {
  const [afspraken, setAfspraken] = useState([])
  const [medewerkers, setMedewerkers] = useState([])
  const [viewMode, setViewMode] = useState('week')
  const [refDatum, setRefDatum] = useState(new Date())
  const [form, setForm] = useState(null)
  const [medView, setMedView] = useState(false)
  const [filterMed, setFilterMed] = useState('')
  const [bezig, setBezig] = useState(false)

  useEffect(() => {
    laad()
    const ch = supabase.channel('pl-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning' }, laadAfspraken)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function laad() { await Promise.all([laadAfspraken(), laadMedewerkers()]) }
  async function laadAfspraken() {
    const { data } = await supabase.from('planning').select('*').order('datum').order('tijdstip_van', { nullsFirst: true })
    setAfspraken(data || [])
  }
  async function laadMedewerkers() {
    const { data } = await supabase.from('planning_links').select('*').order('aangemaakt')
    setMedewerkers(data || [])
  }

  const zichtbareAfspraken = filterAfspraken(afspraken, filterMed)

  function leegForm() {
    return {
      datum: ds(refDatum), tijdstip_van: '08:00', tijdstip_tot: '17:00',
      titel: '', omschrijving: '', klant_naam: '', klant_adres: '', klant_postcode: '', klant_plaats: '',
      werkbon_id: '', medewerkers: filterMed ? [filterMed] : [], voor_iedereen: false, kleur: '#C9A227',
    }
  }

  async function opslaan() {
    if (!form.titel?.trim()) { alert('Titel is verplicht'); return }
    setBezig(true)
    const { id, aangemaakt, toegewezen_aan, ...data } = form
    const saveData = { ...data, werkbon_id: data.werkbon_id || null, medewerkers: data.medewerkers || [] }
    if (form.id) {
      await supabase.from('planning').update(saveData).eq('id', form.id)
    } else {
      await supabase.from('planning').insert(saveData)
    }
    await laadAfspraken(); setBezig(false); setForm(null)
  }

  async function verwijder() {
    if (!form.id || !window.confirm('Afspraak verwijderen?')) return
    await supabase.from('planning').delete().eq('id', form.id)
    await laadAfspraken(); setForm(null)
  }

  function dagKlik(dagStr) { setRefDatum(parseDate(dagStr)); setViewMode('dag') }
  function afspraakKlik(a) {
    setForm({ ...a, werkbon_id: a.werkbon_id || '', medewerkers: getMedewerkers(a) })
  }

  if (form !== null) {
    return <AfspraakForm form={form} setForm={setForm} klanten={klanten} werkbonnen={werkbonnen} medewerkers={medewerkers}
      onOpslaan={opslaan} onVerwijder={verwijder} onAnnuleer={() => setForm(null)} bezig={bezig} />
  }
  if (medView) {
    return <MedewerkersView medewerkers={medewerkers} onVervers={laadMedewerkers} onTerug={() => setMedView(false)} />
  }

  return (
    <div className="view-content with-bottom-nav">
      <PlanningHeader viewMode={viewMode} setViewMode={setViewMode} refDatum={refDatum} setRefDatum={setRefDatum}
        medewerkers={medewerkers} filterMed={filterMed} setFilterMed={setFilterMed} onMedewerkers={() => setMedView(true)} />
      {viewMode === 'maand' && <MaandView refDatum={refDatum} afspraken={zichtbareAfspraken} onDagKlik={dagKlik} />}
      {viewMode === 'week' && <WeekView refDatum={refDatum} afspraken={zichtbareAfspraken} medewerkers={medewerkers} werkbonnen={werkbonnen} onDagKlik={dagKlik} onAfspraakKlik={afspraakKlik} />}
      {viewMode === 'dag' && <DagView refDatum={refDatum} afspraken={zichtbareAfspraken} medewerkers={medewerkers} werkbonnen={werkbonnen} onAfspraakKlik={afspraakKlik} />}
      <button className="fab fab-boven-nav" onClick={() => setForm(leegForm())}>+</button>
    </div>
  )
}

// ── Read-only view (personeelslink) ───────────────────────────────────
export function PlanningReadOnly({ medewerkerId, initialAfspraken }) {
  const [afspraken, setAfspraken] = useState(initialAfspraken || [])
  const [viewMode, setViewMode] = useState('week')
  const [refDatum, setRefDatum] = useState(new Date())

  useEffect(() => {
    const ch = supabase.channel('pl-ro-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning' }, async () => {
        const { data } = await supabase.from('planning').select('*').order('datum').order('tijdstip_van', { nullsFirst: true })
        setAfspraken(data || [])
      }).subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  const mijn = medewerkerId
    ? afspraken.filter(a => getMedewerkers(a).includes(medewerkerId) || a.voor_iedereen)
    : afspraken

  function dagKlik(dagStr) { setRefDatum(parseDate(dagStr)); setViewMode('dag') }

  return (
    <div className="view-content">
      <PlanningHeader viewMode={viewMode} setViewMode={setViewMode} refDatum={refDatum} setRefDatum={setRefDatum}
        medewerkers={[]} filterMed="" setFilterMed={() => {}} onMedewerkers={() => {}} readOnly />
      {viewMode === 'maand' && <MaandView refDatum={refDatum} afspraken={mijn} onDagKlik={dagKlik} />}
      {viewMode === 'week' && <WeekView refDatum={refDatum} afspraken={mijn} medewerkers={[]} werkbonnen={[]} onDagKlik={dagKlik} onAfspraakKlik={() => {}} readOnly />}
      {viewMode === 'dag' && <DagView refDatum={refDatum} afspraken={mijn} medewerkers={[]} werkbonnen={[]} onAfspraakKlik={() => {}} readOnly />}
    </div>
  )
}
