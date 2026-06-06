'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PlanningReadOnly } from '@/components/PlanningView'
import MedewerkerWerkbonView from '@/components/MedewerkerWerkbonView'

const PRIORITEITEN = {
  hoog:    { label: 'Hoog',    kleur: '#D4380D', achtergrond: '#fff1f0', rand: '#ffccc7' },
  normaal: { label: 'Normaal', kleur: '#C9A227', achtergrond: '#fffbe6', rand: '#ffe58f' },
  laag:    { label: 'Laag',    kleur: '#389E0D', achtergrond: '#f6ffed', rand: '#b7eb8f' },
}

// ── PIN login scherm ──────────────────────────────────────────────────
function PinLogin({ naam, onSuccess }) {
  const [pin, setPin] = useState('')
  const [fout, setFout] = useState(false)
  const [laden, setLaden] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function controleer(e) {
    e.preventDefault()
    if (pin.length !== 4) return
    setLaden(true)
    // PIN wordt gecontroleerd via de server (token + PIN check)
    // We halen de link op en vergelijken de PIN
    setFout(false)
    const result = await onSuccess(pin)
    if (!result) {
      setFout(true)
      setPin('')
      inputRef.current?.focus()
    }
    setLaden(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: 24, background: '#1a1a1a' }}>
      <img src="/logo.png" alt="JdB" style={{ height: 56, marginBottom: 32, objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
      <div style={{ background: 'white', borderRadius: 16, padding: 32, width: '100%', maxWidth: 340, boxShadow: '0 8px 32px rgba(0,0,0,.3)' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Inloggen</h2>
        <p style={{ margin: '0 0 24px', color: '#888', fontSize: 14 }}>Welkom, <strong>{naam}</strong>. Voer je 4-cijferige PIN in.</p>
        <form onSubmit={controleer}>
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setFout(false) }}
            placeholder="● ● ● ●"
            style={{
              width: '100%', padding: '14px 16px', fontSize: 28, letterSpacing: 12,
              border: `2px solid ${fout ? '#D4380D' : '#e0e0e0'}`, borderRadius: 10,
              textAlign: 'center', outline: 'none', marginBottom: fout ? 8 : 20,
              boxSizing: 'border-box', background: fout ? '#fff1f0' : 'white',
            }}
          />
          {fout && <p style={{ color: '#D4380D', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>Verkeerde PIN. Probeer opnieuw.</p>}
          <button
            type="submit"
            disabled={pin.length !== 4 || laden}
            style={{ width: '100%', padding: 14, background: '#C9A227', color: 'black', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: pin.length === 4 ? 'pointer' : 'not-allowed', opacity: pin.length === 4 ? 1 : 0.5 }}
          >
            {laden ? 'Controleren...' : 'Inloggen →'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Taken tab ─────────────────────────────────────────────────────────
function TakenTab({ medewerker, todos, setTodos }) {
  async function vinkAf(id) {
    await supabase.from('todos').update({ gedaan: true }).eq('id', id)
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  const volgorde = { hoog: 0, normaal: 1, laag: 2 }
  const gesorteerd = [...todos].sort((a, b) => (volgorde[a.prioriteit] ?? 1) - (volgorde[b.prioriteit] ?? 1))

  return (
    <div className="view-content with-bottom-nav">
      {gesorteerd.length === 0 ? (
        <div className="leeg"><p>Geen openstaande taken 🎉</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {gesorteerd.map(t => {
            const prio = PRIORITEITEN[t.prioriteit] || PRIORITEITEN.normaal
            return (
              <div key={t.id} style={{ background: 'white', borderRadius: 10, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={() => vinkAf(t.id)}
                  style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${prio.kleur}`, background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, color: prio.kleur, fontWeight: 700, padding: 0 }}
                >✓</button>
                <span style={{ flex: 1, fontSize: 15 }}>{t.tekst}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: prio.achtergrond, border: `1px solid ${prio.rand}`, color: prio.kleur, flexShrink: 0 }}>{prio.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Hoofdpagina ────────────────────────────────────────────────────────
export default function PlanningDeelPage() {
  const { token } = useParams()
  const [status, setStatus] = useState('laden')   // laden | pin | geldig | ongeldig
  const [medewerker, setMedewerker] = useState(null)
  const [afspraken, setAfspraken] = useState([])
  const [todos, setTodos] = useState([])
  const [actieveTab, setActieveTab] = useState('planning')

  useEffect(() => {
    async function init() {
      const { data: link } = await supabase
        .from('planning_links').select('*').eq('token', token).single()
      if (!link) { setStatus('ongeldig'); return }
      setMedewerker(link)

      // Check of al ingelogd in sessie
      const sessieSleutel = `pin-auth-${token}`
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(sessieSleutel) === 'ok') {
        await laadData(link)
        setStatus('geldig')
      } else {
        // Geen PIN ingesteld = direct toegang (backwards compat)
        if (!link.pin) {
          await laadData(link)
          setStatus('geldig')
        } else {
          setStatus('pin')
        }
      }
    }
    init()
  }, [token])

  async function laadData(link) {
    document.title = `JdB – ${link.naam}`
    const [{ data: ap }, { data: td }] = await Promise.all([
      supabase.from('planning').select('*').order('datum').order('tijdstip_van', { nullsFirst: true }),
      supabase.from('todos').select('*').eq('medewerker_id', link.id).eq('gedaan', false).order('aangemaakt'),
    ])
    setAfspraken(ap || [])
    setTodos(td || [])

    // Real-time todos
    supabase.channel('todo-ro-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, async () => {
        const { data } = await supabase.from('todos').select('*').eq('medewerker_id', link.id).eq('gedaan', false).order('aangemaakt')
        setTodos(data || [])
      })
      .subscribe()
  }

  async function controleerPin(ingevoerd) {
    const { data: link } = await supabase.from('planning_links').select('*').eq('token', token).single()
    if (!link || link.pin !== ingevoerd) return false
    sessionStorage.setItem(`pin-auth-${token}`, 'ok')
    setMedewerker(link)
    await laadData(link)
    setStatus('geldig')
    return true
  }

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

  if (status === 'pin') {
    return <PinLogin naam={medewerker?.naam || ''} onSuccess={controleerPin} />
  }

  // ── Ingelogd ──
  const tabTitel = actieveTab === 'planning' ? 'Planning' : actieveTab === 'taken' ? 'Taken' : 'Werkbonnen'

  return (
    <>
      <header>
        <div className="header-links">
          <img src="/logo.png" alt="JdB" className="header-logo" onError={e => e.target.style.display = 'none'} />
          <div>
            <h1>{tabTitel}</h1>
            <span style={{ fontSize: 13, opacity: .7 }}>{medewerker?.naam}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {todos.length > 0 && actieveTab !== 'taken' && (
            <span style={{ background: '#D4380D', color: 'white', borderRadius: '50%', width: 20, height: 20, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {todos.length}
            </span>
          )}
        </div>
      </header>

      {actieveTab === 'planning' && (
        <PlanningReadOnly medewerkerId={medewerker?.id} initialAfspraken={afspraken} />
      )}
      {actieveTab === 'taken' && (
        <TakenTab medewerker={medewerker} todos={todos} setTodos={setTodos} />
      )}
      {actieveTab === 'werkbonnen' && (
        <MedewerkerWerkbonView medewerker={medewerker} />
      )}

      {/* Navigatiebalk */}
      <nav className="bottom-nav">
        <button className={actieveTab === 'planning' ? 'actief' : ''} onClick={() => setActieveTab('planning')}>
          <span className="nav-icon">📅</span><span className="nav-label">Planning</span>
        </button>
        <button className={actieveTab === 'taken' ? 'actief' : ''} onClick={() => setActieveTab('taken')} style={{ position: 'relative' }}>
          <span className="nav-icon">✅</span>
          <span className="nav-label">Taken</span>
          {todos.length > 0 && (
            <span style={{ position: 'absolute', top: 6, right: '50%', transform: 'translateX(10px)', background: '#D4380D', color: 'white', borderRadius: '50%', width: 16, height: 16, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {todos.length}
            </span>
          )}
        </button>
        <button className={actieveTab === 'werkbonnen' ? 'actief' : ''} onClick={() => setActieveTab('werkbonnen')}>
          <span className="nav-icon">📋</span><span className="nav-label">Werkbonnen</span>
        </button>
      </nav>
    </>
  )
}
