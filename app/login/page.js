'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [wachtwoord, setWachtwoord] = useState('')
  const [fout, setFout] = useState(null)
  const [bezig, setBezig] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setFout(null)
    setBezig(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: wachtwoord })
    if (error) {
      setFout('Onjuist e-mailadres of wachtwoord.')
      setBezig(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--grijs-licht)',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '40px 32px',
        width: '100%',
        maxWidth: '380px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.10)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px', height: '56px',
            background: 'var(--zwart)',
            borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            borderBottom: '3px solid var(--goud)'
          }}>
            <span style={{ fontSize: '26px' }}>🔧</span>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--tekst)', margin: 0 }}>JdB Werkbonnen</h1>
          <p style={{ fontSize: '14px', color: 'var(--grijs)', marginTop: '4px' }}>Inloggen</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--tekst)', display: 'block', marginBottom: '6px' }}>
              E-mailadres
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="naam@voorbeeld.nl"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--tekst)', display: 'block', marginBottom: '6px' }}>
              Wachtwoord
            </label>
            <input
              type="password"
              value={wachtwoord}
              onChange={e => setWachtwoord(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          {fout && (
            <p style={{ fontSize: '13px', color: 'var(--rood, #dc2626)', background: '#fee2e2', padding: '10px 12px', borderRadius: '8px', margin: 0 }}>
              {fout}
            </p>
          )}

          <button
            type="submit"
            disabled={bezig}
            className="btn btn-primair"
            style={{ marginTop: '4px', width: '100%', justifyContent: 'center' }}
          >
            {bezig ? 'Inloggen...' : 'Inloggen'}
          </button>
        </form>
      </div>
    </div>
  )
}
