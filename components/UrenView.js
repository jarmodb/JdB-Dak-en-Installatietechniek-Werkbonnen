'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

function vandaag() { return new Date().toISOString().split('T')[0] }
function datumNL(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}` }
function urenNL(n) { const u = parseFloat(n) || 0; return u === 1 ? '1 uur' : `${u.toFixed(u % 1 === 0 ? 0 : 1)} uur` }

function weekStart() {
  const d = new Date()
  const dag = d.getDay()
  d.setDate(d.getDate() - (dag === 0 ? 6 : dag - 1))
  return d.toISOString().split('T')[0]
}

function maandStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function UrenView({ werkbonnen, medewerkers, onWerkbonNavigeer }) {
  const [registraties, setRegistraties] = useState([])
  const [laden, setLaden] = useState(true)
  const [form, setForm] = useState(null)
  const [bezig, setBezig] = useState(false)
  const [medFilter, setMedFilter] = useState('alle')

  useEffect(() => { laadRegistraties() }, [])

  async function laadRegistraties() {
    const { data } = await supabase.from('uren_registraties').select('*').order('datum', { ascending: false })
    setRegistraties(data || [])
    setLaden(false)
  }

  // Gecombineerde lijst: werkdagen uit werkbonnen + losse registraties
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

  const ws = weekStart()
  const ms = maandStart()
  const totaalWeek = alleEntries.filter(e => e.datum >= ws).reduce((s, e) => s + (parseFloat(e.uren) || 0), 0)
  const totaalMaand = alleEntries.filter(e => e.datum >= ms).reduce((s, e) => s + (parseFloat(e.uren) || 0), 0)
  const totaalAlles = alleEntries.reduce((s, e) => s + (parseFloat(e.uren) || 0), 0)

  // Unieke medewerkers in de data (voor filter)
  const medNamen = ['alle', ...Array.from(new Set(alleEntries.map(e => e.medewerker_naam || '(geen)')))]

  function setVeld(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function nieuw() {
    setForm({ datum: vandaag(), uren: '', omschrijving: '', medewerker_id: '', werkbon_id: '' })
  }

  function bewerk(r) {
    setForm({ ...r })
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
    await laadRegistraties()
    setBezig(false)
    setForm(null)
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
          <div className="uren-stat-waarde">{totaalWeek.toFixed(totaalWeek % 1 === 0 ? 0 : 1)}</div>
          <div className="uren-stat-label">uur deze week</div>
        </div>
        <div className="uren-stat-kaart">
          <div className="uren-stat-waarde">{totaalMaand.toFixed(totaalMaand % 1 === 0 ? 0 : 1)}</div>
          <div className="uren-stat-label">uur deze maand</div>
        </div>
        <div className="uren-stat-kaart">
          <div className="uren-stat-waarde">{totaalAlles.toFixed(totaalAlles % 1 === 0 ? 0 : 1)}</div>
          <div className="uren-stat-label">uur totaal</div>
        </div>
      </div>

      {/* Medewerker filter */}
      {medNamen.length > 2 && (
        <div className="status-filter-rij" style={{ paddingBottom: 0 }}>
          {medNamen.map(n => (
            <button
              key={n}
              className={`status-filter-chip alle ${medFilter === n ? 'actief' : ''}`}
              onClick={() => setMedFilter(n)}
            >
              {n === 'alle' ? 'Iedereen' : n}
            </button>
          ))}
        </div>
      )}

      {/* Gecombineerde lijst */}
      <div className="overzicht-header" style={{ marginTop: 8 }}>
        <h2>{gefilterd.length} {gefilterd.length === 1 ? 'invoer' : 'invoeren'}</h2>
      </div>

      {laden ? <div className="laden">Laden...</div>
        : gefilterd.length === 0 ? (
          <div className="leeg"><p>Nog geen uren geregistreerd.<br />Tik op <strong>+</strong> om te beginnen.</p></div>
        ) : (
          <div className="bon-lijst">
            {gefilterd.map((e, i) => (
              <div
                key={e._type === 'registratie' ? e.id : `wb-${e.werkbon_id}-${i}`}
                className="bon-kaart"
                style={{ cursor: e._type === 'werkbon' ? 'pointer' : 'default' }}
                onClick={() => e._type === 'werkbon' && onWerkbonNavigeer?.(werkbonnen.find(w => w.id === e.werkbon_id))}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {e.medewerker_kleur && (
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: e.medewerker_kleur, flexShrink: 0 }} />
                    )}
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{datumNL(e.datum)}</span>
                    {e.medewerker_naam && (
                      <span style={{ fontSize: 12, color: '#666' }}>{e.medewerker_naam}</span>
                    )}
                  </div>
                  {e.omschrijving && (
                    <div style={{ fontSize: 13, color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.omschrijving}</div>
                  )}
                  {e._type === 'werkbon' && (
                    <div style={{ fontSize: 12, color: '#1677ff' }}>
                      {e.werkbon_nummer}{e.werkbon_klant ? ` · ${e.werkbon_klant}` : ''}
                    </div>
                  )}
                  {e._type === 'registratie' && e.werkbon_nummer && (
                    <div style={{ fontSize: 12, color: '#1677ff' }}>
                      {e.werkbon_nummer}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{urenNL(e.uren)}</span>
                  {e._type === 'registratie' && (
                    <>
                      <button
                        className="btn"
                        style={{ padding: '2px 8px', fontSize: 13, minWidth: 0 }}
                        onClick={ev => { ev.stopPropagation(); bewerk(e) }}
                      >✏️</button>
                      <button
                        className="btn-verwijder"
                        onClick={ev => { ev.stopPropagation(); verwijder(e.id) }}
                      >×</button>
                    </>
                  )}
                  {e._type === 'werkbon' && (
                    <span style={{ fontSize: 11, color: '#999', backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>werkbon</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      <button className="fab fab-boven-nav" onClick={nieuw}>+</button>
    </div>
  )
}
