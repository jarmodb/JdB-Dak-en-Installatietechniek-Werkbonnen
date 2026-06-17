'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

function vandaag() { return new Date().toISOString().split('T')[0] }
function datumNL(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}` }
function urenNL(n) { const u = parseFloat(n) || 0; return u === 1 ? '1 uur' : `${u % 1 === 0 ? u.toFixed(0) : u.toFixed(1)} uur` }

const MAANDEN = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']

function weekMaandag(datum) {
  if (!datum) return ''
  const d = new Date(datum)
  const dag = d.getDay() || 7
  d.setDate(d.getDate() - dag + 1)
  return d.toISOString().split('T')[0]
}

function isoWeekNr(datum) {
  const d = new Date(datum)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
}

function weekLabel(maandagStr) {
  if (!maandagStr) return 'Onbekend'
  const ma = new Date(maandagStr)
  const zo = new Date(ma); zo.setDate(ma.getDate() + 6)
  const nr = isoWeekNr(maandagStr)
  return `Week ${nr} · ${datumNL(maandagStr)} – ${datumNL(zo.toISOString().split('T')[0])}`
}

function maandLabel(jaarMaand) {
  if (!jaarMaand) return 'Onbekend'
  const [jaar, maand] = jaarMaand.split('-')
  return `${MAANDEN[parseInt(maand) - 1]} ${jaar}`
}

function groepeerKey(e, g) {
  switch (g) {
    case 'dag':       return e.datum || ''
    case 'week':      return weekMaandag(e.datum)
    case 'maand':     return e.datum?.slice(0, 7) || ''
    case 'jaar':      return e.datum?.slice(0, 4) || ''
    case 'werkbon':   return e.werkbon_nummer || '__geen__'
    case 'klant':     return e.werkbon_klant || '__geen__'
    case 'medewerker':return e.medewerker_naam || '__geen__'
    default: return ''
  }
}

function groepeerLabel(key, g) {
  if (key === '__geen__') {
    return g === 'werkbon' ? 'Geen werkbon' : g === 'klant' ? 'Geen klant' : '(geen medewerker)'
  }
  if (g === 'dag')   return datumNL(key)
  if (g === 'week')  return weekLabel(key)
  if (g === 'maand') return maandLabel(key)
  return key
}

function weekStart() {
  const d = new Date(); const dag = d.getDay() || 7
  d.setDate(d.getDate() - dag + 1); return d.toISOString().split('T')[0]
}
function maandStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const GROEPERINGEN = [
  { id: 'week', label: 'Week' },
  { id: 'dag', label: 'Dag' },
  { id: 'maand', label: 'Maand' },
  { id: 'jaar', label: 'Jaar' },
  { id: 'werkbon', label: 'Werkbon' },
  { id: 'klant', label: 'Klant' },
  { id: 'medewerker', label: 'Medewerker' },
]

export default function UrenView({ werkbonnen, medewerkers, onWerkbonNavigeer }) {
  const [registraties, setRegistraties] = useState([])
  const [laden, setLaden] = useState(true)
  const [form, setForm] = useState(null)
  const [bezig, setBezig] = useState(false)
  const [medFilter, setMedFilter] = useState('alle')
  const [groepering, setGroepering] = useState('week')
  const [uitgebreid, setUitgebreid] = useState(new Set())

  useEffect(() => { laadRegistraties() }, [])

  async function laadRegistraties() {
    const { data } = await supabase.from('uren_registraties').select('*').order('datum', { ascending: false })
    setRegistraties(data || [])
    setLaden(false)
  }

  const alleEntries = [
    ...werkbonnen.flatMap(wb =>
      (wb.werkdagen || [])
        .filter(wd => wd.datum || wd.uren)
        .map(wd => ({
          _type: 'werkbon',
          datum: wd.datum || '',
          uren: parseFloat(wd.uren) || 0,
          omschrijving: wd.omschrijving || '',
          medewerker_naam: wd.medewerker_naam || null,
          medewerker_kleur: wd.medewerker_kleur || null,
          werkbon_id: wb.id,
          werkbon_nummer: wb.nummer,
          werkbon_klant: wb.klant_naam,
        }))
    ),
    ...registraties.map(r => ({ ...r, _type: 'registratie' })),
  ].sort((a, b) => (b.datum || '').localeCompare(a.datum || ''))

  const gefilterd = medFilter === 'alle'
    ? alleEntries
    : alleEntries.filter(e => (e.medewerker_naam || '(geen)') === medFilter)

  const ws = weekStart(); const ms = maandStart()
  const totaalWeek  = alleEntries.filter(e => e.datum >= ws).reduce((s, e) => s + e.uren, 0)
  const totaalMaand = alleEntries.filter(e => e.datum >= ms).reduce((s, e) => s + e.uren, 0)
  const totaalAlles = alleEntries.reduce((s, e) => s + e.uren, 0)

  const medNamen = ['alle', ...Array.from(new Set(alleEntries.map(e => e.medewerker_naam || '(geen)')))]

  // Groepen opbouwen
  const groepMap = new Map()
  const groepen = []
  gefilterd.forEach(e => {
    const key = groepeerKey(e, groepering)
    if (!groepMap.has(key)) {
      const g = { key, label: groepeerLabel(key, groepering), entries: [], totaal: 0 }
      groepMap.set(key, g); groepen.push(g)
    }
    const g = groepMap.get(key)
    g.entries.push(e)
    g.totaal += e.uren
  })
  if (['dag', 'week', 'maand', 'jaar'].includes(groepering)) {
    groepen.sort((a, b) => b.key.localeCompare(a.key))
  }

  function toggleGroep(key) {
    setUitgebreid(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function setVeld(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function nieuw() {
    setForm({ datum: vandaag(), uren: '', omschrijving: '', medewerker_id: '', werkbon_id: '' })
  }

  async function opslaan() {
    if (!form.datum || !form.uren) { alert('Datum en uren zijn verplicht'); return }
    setBezig(true)
    const med = medewerkers.find(m => m.id === form.medewerker_id)
    const wb = form.werkbon_id ? werkbonnen.find(w => w.id === form.werkbon_id) : null
    const data = {
      datum: form.datum,
      uren: parseFloat(form.uren) || 0,
      omschrijving: form.omschrijving || null,
      medewerker_id: form.medewerker_id || null,
      medewerker_naam: med?.naam || null,
      medewerker_kleur: med?.kleur || null,
      werkbon_id: wb?.id || null,
      werkbon_nummer: wb?.nummer || null,
    }
    if (form.id) {
      await supabase.from('uren_registraties').update(data).eq('id', form.id)
    } else {
      await supabase.from('uren_registraties').insert(data)
    }
    await laadRegistraties(); setBezig(false); setForm(null)
  }

  async function verwijder(id) {
    if (!confirm('Deze urenregistratie verwijderen?')) return
    await supabase.from('uren_registraties').delete().eq('id', id)
    setRegistraties(r => r.filter(x => x.id !== id))
  }

  // ── FORMULIER ──────────────────────────────────────────────────────
  if (form !== null) return (
    <div className="view-content form-content with-bottom-nav">
      <div className="top-acties">
        <button className="form-terug" onClick={() => setForm(null)}>← Terug</button>
        <button className="btn btn-primair" onClick={opslaan} disabled={bezig}>{bezig ? 'Opslaan...' : '✓ Opslaan'}</button>
      </div>
      <div className="sectie">
        <div className="sectie-titel">{form.id ? 'Uren bewerken' : 'Uren registreren'}</div>
        <div className="rij-2">
          <div className="veld">
            <label>Datum *</label>
            <input type="date" value={form.datum} onChange={e => setVeld('datum', e.target.value)} />
          </div>
          <div className="veld">
            <label>Uren *</label>
            <input type="number" value={form.uren} onChange={e => setVeld('uren', e.target.value)} placeholder="bijv. 7.5" min="0" step="0.5" />
          </div>
        </div>
        <div className="veld">
          <label>Omschrijving</label>
          <input type="text" value={form.omschrijving || ''} onChange={e => setVeld('omschrijving', e.target.value)} placeholder="Wat is er gedaan?" />
        </div>
        <div className="veld">
          <label>Medewerker</label>
          <select value={form.medewerker_id || ''} onChange={e => setVeld('medewerker_id', e.target.value)}>
            <option value="">— geen —</option>
            {medewerkers.map(m => <option key={m.id} value={m.id}>{m.naam}</option>)}
          </select>
        </div>
        <div className="veld">
          <label>Koppelen aan werkbon</label>
          <select value={form.werkbon_id || ''} onChange={e => setVeld('werkbon_id', e.target.value)}>
            <option value="">— geen werkbon —</option>
            {werkbonnen.map(wb => (
              <option key={wb.id} value={wb.id}>
                {wb.nummer}{wb.klant_naam ? ` · ${wb.klant_naam}` : ''}{wb.naam ? ` · ${wb.naam}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )

  // ── OVERZICHT ──────────────────────────────────────────────────────
  return (
    <div className="view-content with-bottom-nav">
      {/* Totaalcijfers */}
      <div className="uren-stats">
        <div className="uren-stat-kaart">
          <div className="uren-stat-waarde">{totaalWeek % 1 === 0 ? totaalWeek.toFixed(0) : totaalWeek.toFixed(1)}</div>
          <div className="uren-stat-label">uur deze week</div>
        </div>
        <div className="uren-stat-kaart">
          <div className="uren-stat-waarde">{totaalMaand % 1 === 0 ? totaalMaand.toFixed(0) : totaalMaand.toFixed(1)}</div>
          <div className="uren-stat-label">uur deze maand</div>
        </div>
        <div className="uren-stat-kaart">
          <div className="uren-stat-waarde">{totaalAlles % 1 === 0 ? totaalAlles.toFixed(0) : totaalAlles.toFixed(1)}</div>
          <div className="uren-stat-label">uur totaal</div>
        </div>
      </div>

      {/* Medewerker filter */}
      {medNamen.length > 2 && (
        <div className="status-filter-rij" style={{ paddingBottom: 0 }}>
          {medNamen.map(n => (
            <button key={n} className={`status-filter-chip alle ${medFilter === n ? 'actief' : ''}`} onClick={() => setMedFilter(n)}>
              {n === 'alle' ? 'Iedereen' : n}
            </button>
          ))}
        </div>
      )}

      {/* Groepering selector */}
      <div className="uren-groepering-rij">
        <span className="uren-groepering-label">Groepeer op</span>
        <div className="uren-groepering-chips">
          {GROEPERINGEN.map(g => (
            <button
              key={g.id}
              className={`uren-groepering-chip ${groepering === g.id ? 'actief' : ''}`}
              onClick={() => { setGroepering(g.id); setUitgebreid(new Set()) }}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Groepen */}
      {laden ? <div className="laden">Laden...</div>
        : gefilterd.length === 0 ? (
          <div className="leeg"><p>Nog geen uren geregistreerd.<br />Tik op <strong>+</strong> om te beginnen.</p></div>
        ) : (
          <div className="bon-lijst" style={{ gap: 6 }}>
            {groepen.map(g => {
              const open = uitgebreid.has(g.key)
              return (
                <div key={g.key} className="uren-groep">
                  {/* Groep header */}
                  <div className="uren-groep-header" onClick={() => toggleGroep(g.key)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="uren-groep-label">{g.label}</div>
                      <div className="uren-groep-sub">{g.entries.length} {g.entries.length === 1 ? 'invoer' : 'invoeren'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="uren-groep-totaal">{urenNL(g.totaal)}</span>
                      <span className="uren-groep-pijl">{open ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Ingeklapte entries */}
                  {open && (
                    <div className="uren-groep-entries">
                      {g.entries.map((e, i) => (
                        <div
                          key={e._type === 'registratie' ? e.id : `wb-${e.werkbon_id}-${i}`}
                          className="uren-entry"
                          style={{ cursor: e._type === 'werkbon' ? 'pointer' : 'default' }}
                          onClick={() => e._type === 'werkbon' && onWerkbonNavigeer?.(werkbonnen.find(w => w.id === e.werkbon_id))}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              {e.medewerker_kleur && (
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.medewerker_kleur, flexShrink: 0 }} />
                              )}
                              {groepering !== 'dag' && (
                                <span style={{ fontWeight: 600, fontSize: 13 }}>{datumNL(e.datum)}</span>
                              )}
                              {groepering !== 'medewerker' && e.medewerker_naam && (
                                <span style={{ fontSize: 12, color: '#666' }}>{e.medewerker_naam}</span>
                              )}
                            </div>
                            {e.omschrijving && (
                              <div style={{ fontSize: 12, color: '#444', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.omschrijving}</div>
                            )}
                            {groepering !== 'werkbon' && e._type === 'werkbon' && (
                              <div style={{ fontSize: 11, color: '#1677ff', marginTop: 1 }}>
                                {e.werkbon_nummer}{e.werkbon_klant ? ` · ${e.werkbon_klant}` : ''}
                              </div>
                            )}
                            {e._type === 'registratie' && e.werkbon_nummer && groepering !== 'werkbon' && (
                              <div style={{ fontSize: 11, color: '#1677ff', marginTop: 1 }}>{e.werkbon_nummer}</div>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>{urenNL(e.uren)}</span>
                            {e._type === 'registratie' && (
                              <>
                                <button
                                  className="btn"
                                  style={{ padding: '1px 6px', fontSize: 12, minWidth: 0 }}
                                  onClick={ev => { ev.stopPropagation(); setForm({ ...e }) }}
                                >✏️</button>
                                <button
                                  className="btn-verwijder"
                                  style={{ fontSize: 14 }}
                                  onClick={ev => { ev.stopPropagation(); verwijder(e.id) }}
                                >×</button>
                              </>
                            )}
                            {e._type === 'werkbon' && (
                              <span style={{ fontSize: 10, color: '#aaa', backgroundColor: '#f5f5f5', padding: '1px 5px', borderRadius: 4 }}>wb</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      <button className="fab fab-boven-nav" onClick={nieuw}>+</button>
    </div>
  )
}
