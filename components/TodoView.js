'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function TodoView() {
  const [todos, setTodos] = useState([])
  const [nieuw, setNieuw] = useState('')
  const [filter, setFilter] = useState('open') // 'alles' | 'open' | 'gedaan'
  const inputRef = useRef(null)

  useEffect(() => {
    laad()
    const ch = supabase.channel('todo-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, laad)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function laad() {
    const { data } = await supabase.from('todos').select('*').order('aangemaakt', { ascending: true })
    setTodos(data || [])
  }

  async function voegToe(e) {
    e.preventDefault()
    if (!nieuw.trim()) return
    await supabase.from('todos').insert({ tekst: nieuw.trim() })
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

  const gefilterd = todos.filter(t =>
    filter === 'alles' ? true : filter === 'open' ? !t.gedaan : t.gedaan
  )
  const aantalOpen = todos.filter(t => !t.gedaan).length
  const aantalGedaan = todos.filter(t => t.gedaan).length

  return (
    <div className="view-content with-bottom-nav">
      {/* Invoer nieuwe taak */}
      <form onSubmit={voegToe} className="todo-invoer">
        <input
          ref={inputRef}
          type="text"
          value={nieuw}
          onChange={e => setNieuw(e.target.value)}
          placeholder="Nieuwe taak toevoegen..."
          className="todo-input"
        />
        <button type="submit" className="btn btn-primair" disabled={!nieuw.trim()}>+</button>
      </form>

      {/* Filter tabs */}
      <div className="todo-filter">
        {[['open', `Open (${aantalOpen})`], ['gedaan', `Gedaan (${aantalGedaan})`], ['alles', 'Alles']].map(([v, l]) => (
          <button key={v} className={`todo-filter-btn${filter === v ? ' actief' : ''}`} onClick={() => setFilter(v)}>{l}</button>
        ))}
      </div>

      {/* Taken lijst */}
      {gefilterd.length === 0 ? (
        <div className="leeg" style={{ paddingTop: 32 }}>
          <p>{filter === 'open' ? 'Geen openstaande taken. 🎉' : filter === 'gedaan' ? 'Nog niets afgerond.' : 'Nog geen taken.'}</p>
        </div>
      ) : (
        <div className="todo-lijst">
          {gefilterd.map(t => (
            <div key={t.id} className={`todo-item${t.gedaan ? ' gedaan' : ''}`}>
              <button className="todo-check" onClick={() => toggleGedaan(t.id, t.gedaan)}>
                {t.gedaan ? '✓' : ''}
              </button>
              <span className="todo-tekst">{t.tekst}</span>
              <button className="btn-verwijder" onClick={() => verwijder(t.id)}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Gedaan opruimen */}
      {aantalGedaan > 0 && (
        <div style={{ padding: '8px 16px' }}>
          <button className="btn btn-licht" style={{ fontSize: 13, width: '100%' }} onClick={verwijderGedaan}>
            🗑️ Verwijder {aantalGedaan} afgeronde {aantalGedaan === 1 ? 'taak' : 'taken'}
          </button>
        </div>
      )}
    </div>
  )
}
