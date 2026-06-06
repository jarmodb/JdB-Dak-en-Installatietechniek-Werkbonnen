'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PlanningReadOnly } from '@/components/PlanningView'

const PRIORITEITEN = {
  hoog: { label: 'Hoog', kleur: '#D4380D', achtergrond: '#fff1f0', rand: '#ffccc7' },
  normaal: { label: 'Normaal', kleur: '#C9A227', achtergrond: '#fffbe6', rand: '#ffe58f' },
  laag: { label: 'Laag', kleur: '#389E0D', achtergrond: '#f6ffed', rand: '#b7eb8f' },
}

export default function PlanningDeelPage() {
  const { token } = useParams()
  const [status, setStatus] = useState('laden')
  const [medewerkerId, setMedewerkerId] = useState(null)
  const [medewerkerNaam, setMedewerkerNaam] = useState('')
  const [afspraken, setAfspraken] = useState([])
  const [todos, setTodos] = useState([])

  useEffect(() => {
    async function init() {
      const { data: link } = await supabase
        .from('planning_links').select('id, naam').eq('token', token).single()
      if (!link) { setStatus('ongeldig'); return }

      setMedewerkerId(link.id)
      setMedewerkerNaam(link.naam)
      document.title = `Planning – ${link.naam}`

      const [{ data: ap }, { data: td }] = await Promise.all([
        supabase.from('planning').select('*').order('datum').order('tijdstip_van', { nullsFirst: true }),
        supabase.from('todos').select('*').eq('medewerker_id', link.id).eq('gedaan', false).order('aangemaakt'),
      ])

      setAfspraken(ap || [])
      setTodos(td || [])
      setStatus('geldig')
    }
    init()

    // Real-time todos
    const ch = supabase.channel('todo-ro-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, async () => {
        // We need medewerkerId but it might not be set yet - use token to re-fetch
        const { data: link } = await supabase.from('planning_links').select('id').eq('token', token).single()
        if (!link) return
        const { data } = await supabase.from('todos').select('*').eq('medewerker_id', link.id).eq('gedaan', false).order('aangemaakt')
        setTodos(data || [])
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [token])

  if (status === 'laden') {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#888' }}>Laden...</div>
  }

  if (status === 'ongeldig') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#888', textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: '#C9A227', marginBottom: 8 }}>Ongeldige link</h2>
        <p>Deze link is niet geldig of is verwijderd.</p>
      </div>
    )
  }

  async function vinkAf(id) {
    await supabase.from('todos').update({ gedaan: true }).eq('id', id)
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  const volgorde = { hoog: 0, normaal: 1, laag: 2 }
  const gesorteerdesTodos = [...todos].sort((a, b) => (volgorde[a.prioriteit] ?? 1) - (volgorde[b.prioriteit] ?? 1))

  return (
    <>
      <header>
        <div>
          <h1>Planning</h1>
          <span>{medewerkerNaam} · Alleen lezen</span>
        </div>
        <img src="/logo.png" alt="JdB" style={{ height: 36, objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
      </header>

      <PlanningReadOnly medewerkerId={medewerkerId} initialAfspraken={afspraken} />

      <div style={{ padding: '0 16px 100px' }}>
        <div className="sectie-titel" style={{ marginBottom: 10 }}>
          ✅ Mijn taken {gesorteerdesTodos.length > 0 ? `(${gesorteerdesTodos.length})` : ''}
        </div>
        {gesorteerdesTodos.length === 0 ? (
          <div style={{ color: '#888', fontSize: 14, padding: '12px 0' }}>Geen openstaande taken 🎉</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {gesorteerdesTodos.map(t => {
              const prio = PRIORITEITEN[t.prioriteit] || PRIORITEITEN.normaal
              return (
                <div key={t.id} style={{ background: 'white', borderRadius: 8, padding: '10px 14px', boxShadow: '0 1px 3px rgba(0,0,0,.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => vinkAf(t.id)}
                    style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${prio.kleur}`, background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, color: prio.kleur, fontWeight: 700, padding: 0 }}
                    title="Markeer als gedaan"
                  >
                    ✓
                  </button>
                  <span style={{ flex: 1, fontSize: 15 }}>{t.tekst}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: prio.achtergrond, border: `1px solid ${prio.rand}`, color: prio.kleur }}>{prio.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
