'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PlanningReadOnly } from '@/components/PlanningView'

export default function PlanningDeelPage() {
  const { token } = useParams()
  const [status, setStatus] = useState('laden') // laden | geldig | ongeldig
  const [medewerkerId, setMedewerkerId] = useState(null)
  const [medewerkerNaam, setMedewerkerNaam] = useState('')
  const [afspraken, setAfspraken] = useState([])

  useEffect(() => {
    async function init() {
      const { data: link } = await supabase
        .from('planning_links')
        .select('id, naam')
        .eq('token', token)
        .single()

      if (!link) { setStatus('ongeldig'); return }

      setMedewerkerId(link.id)
      setMedewerkerNaam(link.naam)

      const { data } = await supabase
        .from('planning')
        .select('*')
        .order('datum')
        .order('tijdstip_van', { nullsFirst: true })

      setAfspraken(data || [])
      setStatus('geldig')
    }
    init()
  }, [token])

  if (status === 'laden') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#888' }}>
        Laden...
      </div>
    )
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
    </>
  )
}
