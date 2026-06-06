'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const PRIORITEITEN = [
  { waarde: 'hoog', label: 'Hoog', kleur: '#D4380D', achtergrond: '#fff1f0', rand: '#ffccc7' },
  { waarde: 'normaal', label: 'Normaal', kleur: '#C9A227', achtergrond: '#fffbe6', rand: '#ffe58f' },
  { waarde: 'laag', label: 'Laag', kleur: '#389E0D', achtergrond: '#f6ffed', rand: '#b7eb8f' },
]

function prioriteitInfo(p) { return PRIORITEITEN.find(x => x.waarde === p) || PRIORITEITEN[1] }

export default function TodoView() {
  const [todos, setTodos] = useState([])
  const [medewerkers, setMedewerkers] = useState([])
  const [nieuw, setNieuw] = useState('')
  const [nieuwPrioriteit, setNieuwPrioriteit] = useState('normaal')
  const [nieuwMedewerker, setNieuwMedewerker] = useState('')
  const [filter, setFilter] = useState('open')
  const [filterMed, setFilterMed] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    laadTodos()
    laadMedewerkers()
    const ch = supabase.channel('todo-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, laadTodos)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function laadTodos() {
    const { data } = await supabase.from('todos').select('*').order('aangemaakt', { ascending: true })
    setTodos(data || [])
  }

  async function laadMedewerkers() {
    const { data } = await supabase.from('planning_links').select('*').order('naam')
    setMedewerkers(data || [])
  }

  async function voegToe(e) {
    e.preventDefault()
    if (!nieuw.trim()) return
    await supabase.from('todos').insert({
      tekst: nieuw.trim(),
      prioriteit: nieuwPrioriteit,
      medewerker_id: nieuwMedewerker || null,
    })
    setNieuw('')
    inputRef.current?.focus()
  }

  async function toggleGedaan(id, huidig) {
    await supabase.from('todos').update({ gedaan: !huidig }).eq('id', id)
  }

  async function verwijder(id) {
    await supabase.from('todos').delete().eq('id', id)
  }

  async function verwijderGedaan() {
    if (!window.confirm('Alle afgeronde taken verwijderen?')) return
    await supabase.from('todos').delete().eq('gedaan', true)
  }

  async function updatePrioriteit(id, prioriteit) {
    await supabase.from('todos').update({ prioriteit }).eq('id', id)
  }

  // Sorteren: hoog → normaal → laag, dan op aangemaakt
  const volgorde = { hoog: 0, normaal: 1, laag: 2 }
  const gefilterd = todos
    .filter(t => {
      if (filter === 'open' && t.gedaan) return false
      if (filter === 'gedaan' && !t.gedaan) return false
      if (filterMed && t.medewerker_id !== filterMed) return false
      return true
    })
    .sort((a, b) => {
      if (a.gedaan !== b.gedaan) return a.gedaan ? 1 : -1
      return (volgorde[a.prioriteit] ?? 1) - (volgorde[b.prioriteit] ?? 1)
    })

  const aantalOpen = todos.filter(t => !t.gedaan).length
  const aantalGedaan = todos.filter(t => t.gedaan).length

  return (
    <div className="view-content with-bottom-nav">
      {/* Nieuwe taak invoer */}
      <form onSubmit={voegToe} className="todo-invoer-blok">
        <div className="todo-invoer-rij">
          <input ref={inputRef} type="text" value={nieuw} onChange={e => setNieuw(e.target.value)}
            placeholder="Nieuwe taak toevoegen..." className="todo-input" />
          <button type="submit" className="btn btn-primair" disabled={!nieuw.trim()}>+</button>
        </div>
        <div className="todo-invoer-opties">
          {/* Prioriteit selectie */}
          <div className="todo-prio-kiezer">
            {PRIORITEITEN.map(p => (
              <button key={p.waarde} type="button"
                className={`todo-prio-knop${nieuwPrioriteit === p.waarde ? ' actief' : ''}`}
                style={nieuwPrioriteit === p.waarde ? { background: p.achtergrond, borderColor: p.kleur, color: p.kleur } : {}}
                onClick={() => setNieuwPrioriteit(p.waarde)}>
                {p.label}
              </button>
            ))}
          </div>
          {/* Medewerker */}
          {medewerkers.length > 0 && (
            <select className="todo-med-select" value={nieuwMedewerker} onChange={e => setNieuwMedewerker(e.target.value)}>
              <option value="">Iedereen</option>
              {medewerkers.map(m => <option key={m.id} value={m.id}>{m.naam}</option>)}
            </select>
          )}
        </div>
      </form>

      {/* Filters */}
      <div className="todo-filters">
        <div className="todo-filter">
          {[['open', `Open (${aantalOpen})`], ['gedaan', `Gedaan (${aantalGedaan})`], ['alles', 'Alles']].map(([v, l]) => (
            <button key={v} className={`todo-filter-btn${filter === v ? ' actief' : ''}`} onClick={() => setFilter(v)}>{l}</button>
          ))}
        </div>
        {medewerkers.length > 0 && (
          <div className="todo-filter">
            <button className={`todo-filter-btn${!filterMed ? ' actief' : ''}`} onClick={() => setFilterMed('')}>Iedereen</button>
            {medewerkers.map(m => (
              <button key={m.id} className={`todo-filter-btn${filterMed === m.id ? ' actief' : ''}`}
                style={filterMed === m.id ? { borderColor: m.kleur || '#C9A227', color: m.kleur || '#C9A227', background: (m.kleur || '#C9A227') + '18' } : {}}
                onClick={() => setFilterMed(filterMed === m.id ? '' : m.id)}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: m.kleur || '#C9A227', marginRight: 4 }} />
                {m.naam}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Taken lijst */}
      {gefilterd.length === 0 ? (
        <div className="leeg" style={{ paddingTop: 24 }}>
          <p>{filter === 'open' ? 'Geen openstaande taken 🎉' : filter === 'gedaan' ? 'Nog niets afgerond.' : 'Geen taken.'}</p>
        </div>
      ) : (
        <div className="todo-lijst">
          {gefilterd.map(t => {
            const prio = prioriteitInfo(t.prioriteit)
            const med = medewerkers.find(m => m.id === t.medewerker_id)
            return (
              <div key={t.id} className={`todo-item${t.gedaan ? ' gedaan' : ''}`}>
                <button className="todo-check" onClick={() => toggleGedaan(t.id, t.gedaan)}>
                  {t.gedaan ? '✓' : ''}
                </button>
                <div className="todo-inhoud">
                  <span className="todo-tekst">{t.tekst}</span>
                  <div className="todo-meta">
                    {/* Prioriteit badge - klikbaar */}
                    <button className="todo-prio-badge" onClick={() => {
                      const idx = PRIORITEITEN.findIndex(p => p.waarde === t.prioriteit)
                      const next = PRIORITEITEN[(idx + 1) % PRIORITEITEN.length]
                      updatePrioriteit(t.id, next.waarde)
                    }} style={{ background: prio.achtergrond, borderColor: prio.rand, color: prio.kleur }}>
                      {prio.label}
                    </button>
                    {med && (
                      <span className="todo-med-badge" style={{ background: (med.kleur || '#C9A227') + '22', borderColor: med.kleur || '#C9A227', color: med.kleur || '#C9A227' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: med.kleur || '#C9A227', display: 'inline-block', marginRight: 3 }} />
                        {med.naam}
                      </span>
                    )}
                  </div>
                </div>
                <button className="btn-verwijder" onClick={() => verwijder(t.id)}>×</button>
              </div>
            )
          })}
        </div>
      )}

      {aantalGedaan > 0 && (
        <div style={{ padding: '8px 0' }}>
          <button className="btn btn-licht" style={{ fontSize: 13, width: '100%' }} onClick={verwijderGedaan}>
            🗑️ Verwijder {aantalGedaan} afgeronde {aantalGedaan === 1 ? 'taak' : 'taken'}
          </button>
        </div>
      )}
    </div>
  )
}
