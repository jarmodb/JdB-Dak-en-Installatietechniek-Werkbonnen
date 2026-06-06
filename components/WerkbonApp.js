'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { genereerUBL } from '@/lib/ubl'
import { msLogin, msLogout, msGetAccount, uploadFotoNaarOneDrive, uploadPdfNaarOneDrive, syncFotosNaarOneDrive } from '@/lib/onedrive'
import PlanningView, { MedewerkersView } from '@/components/PlanningView'
import TodoView from '@/components/TodoView'
import OfferteView from '@/components/OfferteView'

const CHANGELOG = [
  {
    versie: 'v1.6', datum: '6 juni 2026', items: [
      { type: 'nieuw', tekst: 'Offertes module: aanmaken, bewerken, versturen per e-mail' },
      { type: 'nieuw', tekst: 'Dynamische tekst met variabelen ({klant_naam}, {totaal}, etc.)' },
      { type: 'nieuw', tekst: 'Tekst-sjablonen per werktype herbruikbaar' },
      { type: 'nieuw', tekst: 'Materiaallijst met toggle: wel/niet tonen op offerte' },
      { type: 'nieuw', tekst: 'Status: Concept → Verstuurd → Geaccepteerd / Afgewezen' },
      { type: 'nieuw', tekst: 'Werkbon aanmaken vanuit offerte met keuze wat je overneemt' },
      { type: 'nieuw', tekst: 'Variabele BTW (0%, 9%, 21%)' },
    ]
  },
  {
    versie: 'v1.5', datum: '6 juni 2026', items: [
      { type: 'nieuw', tekst: 'E-mailmelding als Jordy een werkbon toewijst aan een medewerker' },
      { type: 'nieuw', tekst: 'Per medewerker in- of uitschakelen of ze meldingen ontvangen' },
      { type: 'nieuw', tekst: 'E-mailadres instelbaar per medewerker in het Personeel-scherm' },
    ]
  },
  {
    versie: 'v1.4', datum: '6 juni 2026', items: [
      { type: 'nieuw', tekst: 'Medewerker login via PIN op persoonlijke link' },
      { type: 'nieuw', tekst: 'Medewerkers kunnen eigen werkbonnen aanmaken en bewerken' },
      { type: 'nieuw', tekst: 'Navigatie met Planning, Taken en Werkbonnen in personeelslink' },
      { type: 'nieuw', tekst: 'Rood teller-bolletje op Taken-tab bij openstaande taken' },
    ]
  },
  {
    versie: 'v1.3', datum: '6 juni 2026', items: [
      { type: 'nieuw', tekst: 'Medewerker per werkdag instellen via dropdown' },
      { type: 'nieuw', tekst: 'Automatisch PDF opslaan naar OneDrive bij elke opgeslagen werkbon' },
      { type: 'nieuw', tekst: 'Foto\'s opgeslagen in dezelfde OneDrive-map als de PDF' },
      { type: 'nieuw', tekst: 'Taken afvinken via persoonlijke planningslink' },
      { type: 'verbeterd', tekst: 'Bewerken als hoofdknop op werkbon; PDF-knop kleiner' },
      { type: 'verbeterd', tekst: '"Exporteer naar Digiboox" knop verwijderd' },
    ]
  },
  {
    versie: 'v1.2', datum: '5 juni 2026', items: [
      { type: 'nieuw', tekst: 'Meerdere reisritten per werkbon met automatische km-berekening' },
      { type: 'nieuw', tekst: 'Taken-tabblad met prioriteit en medewerker-koppeling' },
      { type: 'nieuw', tekst: 'Meerdere medewerkers per afspraak in planning' },
      { type: 'nieuw', tekst: 'Weeknummers in maandoverzicht' },
      { type: 'nieuw', tekst: 'Mailadres bij werkbonnen en klanten' },
      { type: 'nieuw', tekst: 'Werkbon koppelen aan afspraak vult adres en omschrijving automatisch in' },
      { type: 'nieuw', tekst: 'Naam medewerker zichtbaar als tabbladtitel in browser' },
      { type: 'nieuw', tekst: 'Taken zichtbaar in persoonlijke planningslink' },
      { type: 'opgelost', tekst: 'Taalfout "afspraaken" in dag- en weekplanning' },
      { type: 'opgelost', tekst: 'Huisnummer stond niet in het juiste veld bij klant overnemen' },
      { type: 'opgelost', tekst: 'Postcode automatisch invullen werkte niet correct' },
    ]
  },
  {
    versie: 'v1.1', datum: 'april 2026', items: [
      { type: 'nieuw', tekst: 'Planning met week-, maand- en dagweergave' },
      { type: 'nieuw', tekst: 'Persoonlijke planningslinks per medewerker' },
      { type: 'nieuw', tekst: 'Afspraken zichtbaar in maandoverzicht' },
    ]
  },
  {
    versie: 'v1.0', datum: 'maart 2026', items: [
      { type: 'nieuw', tekst: 'Werkbonnen aanmaken, bewerken en verwijderen' },
      { type: 'nieuw', tekst: 'Klanten- en productenbestand' },
      { type: 'nieuw', tekst: 'Uren, materialen en reiskosten registreren' },
      { type: 'nieuw', tekst: 'PDF afdrukken en factuurstatus bijhouden' },
      { type: 'nieuw', tekst: 'Real-time synchronisatie tussen apparaten' },
      { type: 'nieuw', tekst: 'Installeerbaar als app op telefoon' },
    ]
  },
]

const CHANGELOG_KLEUREN = { nieuw: { bg: '#f0fdf4', kleur: '#389E0D', rand: '#b7eb8f', label: 'Nieuw' }, verbeterd: { bg: '#fffbe6', kleur: '#C9A227', rand: '#ffe58f', label: 'Verbeterd' }, opgelost: { bg: '#fff1f0', kleur: '#D4380D', rand: '#ffccc7', label: 'Opgelost' } }

const WERK_TYPES = ['Gas', 'Water', 'Verwarming', 'Sanitair', 'Riolering', 'Dakbedekking', 'Zinkwerken', 'Graafwerkzaamheden']
const EENHEDEN = ['stuk', 'm²', 'meter', 'liter', 'kg', 'uur', 'set', 'rol', 'doos', 'pak']

// ── Helpers ─────────────────────────────────────────────────────────
function euro(n) { return '€ ' + Number(n || 0).toFixed(2).replace('.', ',') }
function datumNL(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}` }
function vandaag() { return new Date().toISOString().split('T')[0] }

function genNummer(werkbonnen, prefix = 'WB') {
  const jaar = new Date().getFullYear()
  const p = `${prefix}-${jaar}-`
  const nummers = werkbonnen.filter(b => b.nummer?.startsWith(p)).map(b => parseInt(b.nummer.replace(p, '')) || 0)
  return `${p}${String((nummers.length ? Math.max(...nummers) : 0) + 1).padStart(3, '0')}`
}

function bereken(werkdagen, uurtarief, materialen) {
  const totalUren = werkdagen.reduce((s, w) => s + (parseFloat(w.uren) || 0), 0)
  const arbeid = totalUren * (parseFloat(uurtarief) || 0)
  const mat_totaal = materialen.reduce((s, m) => s + (parseFloat(m.aantal) || 0) * (parseFloat(m.prijs) || 0), 0)
  const excl_btw = arbeid + mat_totaal
  const btw = excl_btw * 0.21
  return { arbeid, mat_totaal, excl_btw, btw, totaal_incl: excl_btw + btw, totalUren }
}

function leegFormulier() {
  return { nummer: '', naam: '', datum: vandaag(), klant_naam: '', klant_straat: '', klant_huisnummer: '', klant_postcode: '', klant_plaats: '', klant_tel: '', klant_email: '', omschrijving: '', uurtarief: '', notities: '', reistijd: '', kilometers: '', start_adres: '' }
}

// ── Autocomplete component ───────────────────────────────────────────
function Autocomplete({ waarde, opties, onChange, onSelecteer, placeholder, renderOptie }) {
  const [open, setOpen] = useState(false)
  const gefilterd = waarde.length > 0 ? opties.filter(o => o.naam.toLowerCase().includes(waarde.toLowerCase())).slice(0, 8) : []

  return (
    <div className="autocomplete">
      <input
        type="text"
        value={waarde}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
      />
      {open && gefilterd.length > 0 && (
        <div className="autocomplete-dropdown">
          {gefilterd.map(o => (
            <div key={o.id} className="autocomplete-optie" onMouseDown={() => { onSelecteer(o); setOpen(false) }}>
              {renderOptie ? renderOptie(o) : o.naam}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Klanten view ─────────────────────────────────────────────────────
function KlantenView({ klanten, onVervers }) {
  const [form, setForm] = useState(null)
  const [bezig, setBezig] = useState(false)
  const [postcodeBezig, setPostcodeBezig] = useState(false)

  function setVeld(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function adresOpzoeken(postcodeParam, huisnummerParam) {
    const postcode = postcodeParam !== undefined ? postcodeParam : (form?.postcode ?? '')
    const huisnummer = huisnummerParam !== undefined ? huisnummerParam : (form?.huisnummer ?? '')
    const pc = postcode.replace(/\s/g, '')
    if (!pc || pc.length < 6) return
    setPostcodeBezig(true)
    try {
      const q = huisnummer ? `${pc} ${huisnummer}` : pc
      const res = await fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(q)}&fl=straatnaam,woonplaatsnaam&rows=1`)
      const data = await res.json()
      const hit = data.response?.docs?.[0]
      if (hit) {
        if (hit.straatnaam) setVeld('straat', hit.straatnaam)
        if (hit.woonplaatsnaam) setVeld('plaats', hit.woonplaatsnaam)
      }
    } catch { }
    setPostcodeBezig(false)
  }

  async function opslaan() {
    if (!form.naam?.trim()) { alert('Naam is verplicht'); return }
    setBezig(true)
    const { id, aangemaakt, straat, huisnummer, ...rest } = form
    const data = { ...rest, adres: [straat, huisnummer].filter(Boolean).join(' ') }
    if (form.id) {
      await supabase.from('klanten').update(data).eq('id', form.id)
    } else {
      await supabase.from('klanten').insert(data)
    }
    onVervers(); setBezig(false); setForm(null)
  }

  async function verwijder(e, id) {
    e.stopPropagation()
    if (!confirm('Klant verwijderen?')) return
    await supabase.from('klanten').delete().eq('id', id)
    onVervers()
  }

  if (form !== null) return (
    <div className="view-content form-content with-bottom-nav">
      <div className="top-acties">
        <button className="form-terug" onClick={() => setForm(null)}>← Terug</button>
        <button className="btn btn-primair" onClick={opslaan} disabled={bezig}>{bezig ? 'Opslaan...' : '✓ Opslaan'}</button>
      </div>
      <div className="sectie">
        <div className="sectie-titel">{form.id ? 'Klant bewerken' : 'Nieuwe klant'}</div>
        <div className="veld"><label>Naam *</label><input type="text" value={form.naam || ''} onChange={e => setVeld('naam', e.target.value)} placeholder="Voornaam Achternaam" /></div>
        <div className="rij-2">
          <div className="veld">
            <label>Postcode</label>
            <div className="input-met-indicator">
              <input type="text" value={form.postcode || ''} onChange={e => setVeld('postcode', e.target.value)} onBlur={e => adresOpzoeken(e.target.value, form.huisnummer)} placeholder="1234 AB" />
              {postcodeBezig && <span className="input-spinner">⟳</span>}
            </div>
          </div>
          <div className="veld"><label>Huisnummer</label><input type="text" value={form.huisnummer || ''} onChange={e => setVeld('huisnummer', e.target.value)} onBlur={e => adresOpzoeken(form.postcode, e.target.value)} placeholder="10" /></div>
        </div>
        <div className="rij-2">
          <div className="veld"><label>Straat</label><input type="text" value={form.straat || ''} onChange={e => setVeld('straat', e.target.value)} placeholder="Automatisch ingevuld" /></div>
          <div className="veld"><label>Plaats</label><input type="text" value={form.plaats || ''} onChange={e => setVeld('plaats', e.target.value)} placeholder="Automatisch ingevuld" /></div>
        </div>
        <div className="rij-2">
          <div className="veld"><label>Telefoon</label><input type="tel" value={form.telefoon || ''} onChange={e => setVeld('telefoon', e.target.value)} placeholder="06-12345678" /></div>
          <div className="veld"><label>E-mail</label><input type="email" value={form.email || ''} onChange={e => setVeld('email', e.target.value)} placeholder="naam@email.nl" /></div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="view-content with-bottom-nav">
      <div className="overzicht-header"><h2>{klanten.length} klanten</h2></div>
      {klanten.length === 0 ? (
        <div className="leeg"><p>Nog geen klanten.<br />Tik op <strong>+</strong> om te beginnen.</p></div>
      ) : (
        <div className="bon-lijst">
          {klanten.map(k => (
            <div key={k.id} className="klant-kaart" onClick={() => { const m = (k.adres || '').match(/^(.*?)\s+(\d+\S*)$/); setForm({ ...k, straat: m ? m[1] : (k.adres || ''), huisnummer: m ? m[2] : '' }) }}>
              <div className="klant-info">
                <div className="klant-naam">{k.naam}</div>
                <div className="klant-adres">{[k.adres, k.postcode, k.plaats].filter(Boolean).join(' · ')}</div>
              </div>
              <button className="btn-verwijder" onClick={e => verwijder(e, k.id)}>×</button>
            </div>
          ))}
        </div>
      )}
      <button className="fab fab-boven-nav" onClick={() => setForm({ naam: '', straat: '', huisnummer: '', postcode: '', plaats: '', telefoon: '', email: '' })}>+</button>
    </div>
  )
}

// ── Producten view ───────────────────────────────────────────────────
function ProductenView({ producten, onVervers }) {
  const [form, setForm] = useState(null)
  const [bezig, setBezig] = useState(false)

  function setVeld(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function opslaan() {
    if (!form.naam?.trim()) { alert('Naam is verplicht'); return }
    setBezig(true)
    const { id, aangemaakt, ...data } = form
    if (form.id) {
      await supabase.from('producten').update(data).eq('id', form.id)
    } else {
      await supabase.from('producten').insert(data)
    }
    onVervers(); setBezig(false); setForm(null)
  }

  async function verwijder(e, id) {
    e.stopPropagation()
    if (!confirm('Product verwijderen?')) return
    await supabase.from('producten').delete().eq('id', id)
    onVervers()
  }

  if (form !== null) return (
    <div className="view-content form-content with-bottom-nav">
      <div className="top-acties">
        <button className="form-terug" onClick={() => setForm(null)}>← Terug</button>
        <button className="btn btn-primair" onClick={opslaan} disabled={bezig}>{bezig ? 'Opslaan...' : '✓ Opslaan'}</button>
      </div>
      <div className="sectie">
        <div className="sectie-titel">{form.id ? 'Product bewerken' : 'Nieuw product'}</div>
        <div className="veld"><label>Naam *</label><input type="text" value={form.naam || ''} onChange={e => setVeld('naam', e.target.value)} placeholder="Bijv. Koperen knie 90°" /></div>
        <div className="rij-2">
          <div className="veld">
            <label>Eenheid</label>
            <select value={form.eenheid || 'stuk'} onChange={e => setVeld('eenheid', e.target.value)}>
              {EENHEDEN.map(e => <option key={e}>{e}</option>)}
            </select>
          </div>
          <div className="veld"><label>Prijs (€)</label><input type="number" value={form.prijs || ''} onChange={e => setVeld('prijs', e.target.value)} placeholder="0.00" min="0" step="0.01" /></div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="view-content with-bottom-nav">
      <div className="overzicht-header"><h2>{producten.length} producten</h2></div>
      {producten.length === 0 ? (
        <div className="leeg"><p>Nog geen producten.<br />Tik op <strong>+</strong> om te beginnen.</p></div>
      ) : (
        <div className="bon-lijst">
          {producten.map(p => (
            <div key={p.id} className="product-kaart" onClick={() => setForm(p)}>
              <div className="product-info">
                <div className="product-naam">{p.naam}</div>
                <div className="product-meta">{p.eenheid}</div>
              </div>
              <div className="product-prijs">{euro(p.prijs)}</div>
              <button className="btn-verwijder" onClick={e => verwijder(e, p.id)}>×</button>
            </div>
          ))}
        </div>
      )}
      <button className="fab fab-boven-nav" onClick={() => setForm({ naam: '', prijs: '', eenheid: 'stuk' })}>+</button>
    </div>
  )
}

// ── Hoofdcomponent ───────────────────────────────────────────────────
export default function WerkbonApp() {
  const [view, setView] = useState('overzicht')
  const [werkbonnen, setWerkbonnen] = useState([])
  const [klanten, setKlanten] = useState([])
  const [producten, setProducten] = useState([])
  const [huidigeBon, setHuidigeBon] = useState(null)
  const [bewerkModus, setBewerkModus] = useState(false)
  const [laden, setLaden] = useState(true)
  const [formulier, setFormulier] = useState(leegFormulier())
  const [werkdagen, setWerkdagen] = useState([])
  const [geselecteerdeTypes, setGeselecteerdeTypes] = useState([])
  const [materialen, setMaterialen] = useState([])
  const [ritten, setRitten] = useState([])
  const [fotos, setFotos] = useState([])
  const [medewerkers, setMedewerkers] = useState([])
  const [verwijderModal, setVerwijderModal] = useState(false)
  const [bezig, setBezig] = useState(false)
  const [syncActief, setSyncActief] = useState(false)
  const [postcodeBezig, setPostcodeBezig] = useState(false)
  const [msIngelogd, setMsIngelogd] = useState(false)
  const [fotoUploadBezig, setFotoUploadBezig] = useState(false)
  const [pdfStatus, setPdfStatus] = useState(null) // null | 'bezig' | 'klaar' | 'fout'
  const [changelogOpen, setChangelogOpen] = useState(false)
  const [autosaveStatus, setAutosaveStatus] = useState(null)
  const [instellingen, setInstellingen] = useState({})
  const fotoInputRef = useRef(null)
  const bonPrintRef = useRef(null)
  const autoSavePdfRef = useRef(false)
  const autosaveTimerRef = useRef(null)
  const skipAutosaveRef = useRef(false)
  const WB_DRAFT_KEY = 'werkbon-draft-nieuw'

  // Auto-save PDF naar OneDrive zodra detail view geladen is na opslaan
  useEffect(() => {
    if (view !== 'detail' || !autoSavePdfRef.current || !huidigeBon || !bonPrintRef.current) return
    autoSavePdfRef.current = false
    const t = setTimeout(() => slaWerkbonPdfOp(bonPrintRef.current, huidigeBon), 900)
    return () => clearTimeout(t)
  }, [view, huidigeBon])

  // Sync medewerker-foto's (Supabase) naar OneDrive zodra Jordy een bon opent,
  // verwijder daarna uit Supabase Storage en update de URL's in de database.
  useEffect(() => {
    if (view !== 'detail' || !huidigeBon || !msIngelogd) return
    const heeftSupabaseFotos = (huidigeBon.fotos || []).some(f => f.url?.includes('supabase'))
    if (!heeftSupabaseFotos) return

    async function voerSyncUit() {
      const bijgewerkteFotos = await syncFotosNaarOneDrive(huidigeBon.fotos, huidigeBon.nummer, huidigeBon.klant_naam)
      if (!bijgewerkteFotos) return

      // Verwijder gesyncte bestanden uit Supabase Storage
      const teVerwijderen = bijgewerkteFotos
        .filter(f => f._supabasePad)
        .map(f => f._supabasePad)
      if (teVerwijderen.length) {
        await supabase.storage.from('werkbon-fotos').remove(teVerwijderen)
      }

      // Sla schone fotos op (zonder _supabasePad veld)
      const schoneFotos = bijgewerkteFotos.map(({ _supabasePad, ...f }) => f)
      await supabase.from('werkbonnen').update({ fotos: schoneFotos }).eq('id', huidigeBon.id)

      // Update lokale state
      const bijgewerkteBon = { ...huidigeBon, fotos: schoneFotos }
      setHuidigeBon(bijgewerkteBon)
      setWerkbonnen(w => w.map(b => b.id === huidigeBon.id ? bijgewerkteBon : b))
    }
    voerSyncUit()
  }, [view, huidigeBon?.id, msIngelogd])

  useEffect(() => {
    window.history.replaceState({ view: 'overzicht' }, '')
    laadAlles()
    msGetAccount().then(account => setMsIngelogd(!!account))

    const channels = [
      supabase.channel('wb-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'werkbonnen' }, () => { setSyncActief(true); laadWerkbonnen(); setTimeout(() => setSyncActief(false), 1500) }).subscribe(),
      supabase.channel('kl-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'klanten' }, laadKlanten).subscribe(),
      supabase.channel('pr-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'producten' }, laadProducten).subscribe(),
    ]

    function handlePopState(e) {
      const s = e.state
      if (!s || s.view === 'overzicht') { setView('overzicht'); setHuidigeBon(null); setBewerkModus(false) }
      else if (s.view === 'detail') { setView('detail'); setHuidigeBon(s.bon); setBewerkModus(false) }
      else if (s.view === 'formulier') { setView('formulier') }
      else if (s.view === 'klanten') { setView('klanten') }
      else if (s.view === 'producten') { setView('producten') }
    }
    window.addEventListener('popstate', handlePopState)
    return () => { channels.forEach(c => supabase.removeChannel(c)); window.removeEventListener('popstate', handlePopState) }
  }, [])

  // ── Autosave werkbon formulier ──────────────────────────────────────
  useEffect(() => {
    if (view !== 'formulier') return
    if (skipAutosaveRef.current) { skipAutosaveRef.current = false; return }
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(async () => {
      if (bewerkModus && huidigeBon?.id) {
        // Bestaande bon → Supabase
        const geldigeWerkdagen = werkdagen.filter(w => w.datum || w.omschrijving || w.uren).map(w => {
          const med = medewerkers.find(m => m.id === w.medewerker_id)
          return { datum: w.datum, omschrijving: w.omschrijving, uren: parseFloat(w.uren) || 0, medewerker_id: w.medewerker_id || null, medewerker_naam: med?.naam || null, medewerker_kleur: med?.kleur || null }
        })
        const geldigeMat = materialen.filter(m => m.omschrijving || m.aantal || m.prijs).map(m => {
          const med = medewerkers.find(x => x.id === m.medewerker_id)
          return { omschrijving: m.omschrijving, aantal: parseFloat(m.aantal) || 0, eenheid: m.eenheid || 'stuk', prijs: parseFloat(m.prijs) || 0, medewerker_id: m.medewerker_id || null, medewerker_naam: med?.naam || null, medewerker_kleur: med?.kleur || null }
        })
        const rij = {
          datum: formulier.datum, naam: formulier.naam || null, klant_naam: formulier.klant_naam,
          klant_adres: [formulier.klant_straat, formulier.klant_huisnummer].filter(Boolean).join(' '),
          klant_postcode: formulier.klant_postcode, klant_plaats: formulier.klant_plaats,
          klant_tel: formulier.klant_tel, klant_email: formulier.klant_email,
          omschrijving: formulier.omschrijving, notities: formulier.notities,
          uurtarief: parseFloat(formulier.uurtarief) || 0,
          type: geselecteerdeTypes.join(', '),
          werkdagen: geldigeWerkdagen, materialen: geldigeMat,
        }
        setAutosaveStatus('opslaan')
        try {
          const { error } = await supabase.from('werkbonnen').update(rij).eq('id', huidigeBon.id)
          if (!error) { setAutosaveStatus('opgeslagen'); setTimeout(() => setAutosaveStatus(null), 2500) }
        } catch {}
      } else if (!bewerkModus) {
        // Nieuwe bon → localStorage
        try {
          localStorage.setItem(WB_DRAFT_KEY, JSON.stringify({ formulier, werkdagen, geselecteerdeTypes, materialen }))
          setAutosaveStatus('opgeslagen'); setTimeout(() => setAutosaveStatus(null), 2500)
        } catch {}
      }
    }, 2000)
    return () => clearTimeout(autosaveTimerRef.current)
  }, [JSON.stringify({ formulier, werkdagen, geselecteerdeTypes, materialen })])

  async function laadAlles() { await Promise.all([laadWerkbonnen(), laadKlanten(), laadProducten(), laadMedewerkers(), laadInstellingen()]) }
  async function laadMedewerkers() { const { data } = await supabase.from('planning_links').select('*').order('naam'); setMedewerkers(data || []) }
  async function laadInstellingen() { const { data } = await supabase.from('instellingen').select('*').eq('id', 'singleton').single(); if (data) setInstellingen(data) }
  async function laadWerkbonnen() {
    setLaden(true)
    const { data } = await supabase.from('werkbonnen').select('*').order('aangemaakt', { ascending: false })
    setWerkbonnen(data || []); setLaden(false)
  }
  async function laadKlanten() { const { data } = await supabase.from('klanten').select('*').order('naam'); setKlanten(data || []) }
  async function laadProducten() { const { data } = await supabase.from('producten').select('*').order('naam'); setProducten(data || []) }

  // ── Navigatie ──────────────────────────────────────────────────────
  function navigeer(v, extra = {}) {
    window.history.pushState({ view: v, ...extra }, '')
    setView(v)
  }
  function toonOverzicht() { navigeer('overzicht'); setHuidigeBon(null); setBewerkModus(false) }
  function toonDetail(bon) { window.history.pushState({ view: 'detail', bon }, ''); setHuidigeBon(bon); setView('detail') }

  function nieuweWerkbon() {
    navigeer('formulier')
    setBewerkModus(false); setHuidigeBon(null)
    // Concept herstellen als aanwezig
    try {
      const draft = JSON.parse(localStorage.getItem(WB_DRAFT_KEY) || 'null')
      if (draft?.formulier?.klant_naam && window.confirm('Er is een niet-opgeslagen concept gevonden. Doorgaan waar je gebleven was?')) {
        skipAutosaveRef.current = true
        setFormulier({ ...draft.formulier, nummer: genNummer(werkbonnen, instellingen.wb_prefix || 'WB') })
        setWerkdagen(draft.werkdagen?.length ? draft.werkdagen : [{ datum: vandaag(), omschrijving: '', uren: '' }])
        setGeselecteerdeTypes(draft.geselecteerdeTypes || [])
        setMaterialen(draft.materialen || [])
        setFotos([]); setRitten([])
        return
      } else {
        localStorage.removeItem(WB_DRAFT_KEY)
      }
    } catch {}
    skipAutosaveRef.current = true
    setFormulier({ ...leegFormulier(), nummer: genNummer(werkbonnen, instellingen.wb_prefix || 'WB') })
    setWerkdagen([{ datum: vandaag(), omschrijving: '', uren: '' }])
    setGeselecteerdeTypes([]); setMaterialen([]); setFotos([]); setRitten([])
  }

  function bewerkWerkbon() {
    if (!huidigeBon) return
    skipAutosaveRef.current = true
    navigeer('formulier')
    setBewerkModus(true)
    const adresM = (huidigeBon.klant_adres || '').match(/^(.*?)\s+(\d+\S*)$/)
    setFormulier({
      nummer: huidigeBon.nummer || '', naam: huidigeBon.naam || '', datum: huidigeBon.datum || vandaag(),
      klant_naam: huidigeBon.klant_naam || '',
      klant_straat: adresM ? adresM[1] : (huidigeBon.klant_adres || ''),
      klant_huisnummer: adresM ? adresM[2] : '',
      klant_postcode: huidigeBon.klant_postcode || '',
      klant_plaats: huidigeBon.klant_plaats || '', klant_tel: huidigeBon.klant_tel || '',
      klant_email: huidigeBon.klant_email || '',
      omschrijving: huidigeBon.omschrijving || '', uurtarief: huidigeBon.uurtarief || '', notities: huidigeBon.notities || '',
      reistijd: huidigeBon.reistijd || '', kilometers: huidigeBon.kilometers || '', start_adres: huidigeBon.start_adres || '',
    })
    setWerkdagen(huidigeBon.werkdagen?.length ? huidigeBon.werkdagen : [{ datum: vandaag(), omschrijving: '', uren: '' }])
    setGeselecteerdeTypes(huidigeBon.type ? huidigeBon.type.split(', ').filter(Boolean) : [])
    setMaterialen(huidigeBon.materialen || [])
    setFotos(huidigeBon.fotos || [])
    setRitten(huidigeBon.ritten?.length ? huidigeBon.ritten : [])
  }

  function werkbonVanOfferte(data) {
    skipAutosaveRef.current = true
    navigeer('formulier')
    setBewerkModus(false); setHuidigeBon(null)
    setFormulier({
      ...leegFormulier(),
      nummer: genNummer(werkbonnen),
      naam: data.naam || '',
      klant_naam: data.klant_naam || '',
      klant_straat: data.klant_straat || '',
      klant_huisnummer: data.klant_huisnummer || '',
      klant_postcode: data.klant_postcode || '',
      klant_plaats: data.klant_plaats || '',
      klant_email: data.klant_email || '',
      omschrijving: data.omschrijving || '',
    })
    setWerkdagen([{ datum: vandaag(), omschrijving: '', uren: '' }])
    setGeselecteerdeTypes([]); setFotos([]); setRitten([])
    setMaterialen(data.materialen || [])
  }

  // ── Formulier ──────────────────────────────────────────────────────
  function setVeld(key, val) { setFormulier(f => ({ ...f, [key]: val })) }
  function toggleType(type) { setGeselecteerdeTypes(t => t.includes(type) ? t.filter(x => x !== type) : [...t, type]) }

  function klantSelecteren(klant) {
    const m = (klant.adres || '').match(/^(.*?)\s+(\d+\S*)$/)
    setFormulier(f => ({
      ...f, klant_naam: klant.naam,
      klant_straat: m ? m[1] : (klant.adres || ''),
      klant_huisnummer: m ? m[2] : '',
      klant_postcode: klant.postcode || '',
      klant_plaats: klant.plaats || '', klant_tel: klant.telefoon || '',
      klant_email: klant.email || '',
    }))
  }

  async function adresOpzoeken(richting) {
    setPostcodeBezig(true)
    try {
      let q = ''
      if (richting === 'postcode') {
        const pc = formulier.klant_postcode.replace(/\s/g, '')
        if (pc.length < 6) { setPostcodeBezig(false); return }
        q = formulier.klant_huisnummer ? `${pc} ${formulier.klant_huisnummer}` : pc
      } else {
        const delen = [formulier.klant_straat, formulier.klant_huisnummer, formulier.klant_plaats].filter(Boolean)
        if (delen.length < 2) { setPostcodeBezig(false); return }
        q = delen.join(' ')
      }
      const res = await fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(q)}&fl=straatnaam,woonplaatsnaam,postcode&rows=1`)
      const data = await res.json()
      const hit = data.response?.docs?.[0]
      if (hit) {
        if (hit.straatnaam && richting === 'postcode') setVeld('klant_straat', hit.straatnaam)
        if (hit.woonplaatsnaam && richting === 'postcode') setVeld('klant_plaats', hit.woonplaatsnaam)
        if (hit.postcode && richting === 'straat' && !formulier.klant_postcode) setVeld('klant_postcode', hit.postcode)
        if (hit.woonplaatsnaam && richting === 'straat' && !formulier.klant_plaats) setVeld('klant_plaats', hit.woonplaatsnaam)
      }
    } catch { }
    setPostcodeBezig(false)
  }

  // Werkdagen
  function voegWerkdagToe() { setWerkdagen(w => [...w, { datum: vandaag(), omschrijving: '', uren: '', medewerker_id: '' }]) }
  function updateWerkdag(idx, key, val) { setWerkdagen(w => w.map((item, i) => i === idx ? { ...item, [key]: val } : item)) }
  function verwijderWerkdag(idx) { setWerkdagen(w => w.filter((_, i) => i !== idx)) }

  // Materialen
  function voegMateriaaltoe() { setMaterialen(m => [...m, { omschrijving: '', aantal: '', eenheid: 'stuk', prijs: '', medewerker_id: '' }]) }
  function updateMateriaal(idx, key, val) { setMaterialen(m => m.map((item, i) => i === idx ? { ...item, [key]: val } : item)) }
  function verwijderMateriaal(idx) { setMaterialen(m => m.filter((_, i) => i !== idx)) }

  // Ritten
  function voegRitToe() { setRitten(r => [...r, { datum: vandaag(), startadres: '', reistijd: '', kilometers: '', medewerker_id: '' }]) }
  function updateRit(idx, key, val) { setRitten(r => r.map((item, i) => i === idx ? { ...item, [key]: val } : item)) }
  function verwijderRit(idx) { setRitten(r => r.filter((_, i) => i !== idx)) }

  async function berekenRoute(idx) {
    const rit = ritten[idx]
    const eindAdres = [formulier.klant_straat, formulier.klant_huisnummer, formulier.klant_postcode, formulier.klant_plaats].filter(Boolean).join(' ')
    if (!rit.startadres?.trim() || !eindAdres.trim()) { alert('Vul eerst start- en eindadres in'); return }
    updateRit(idx, '_bezig', true)
    try {
      async function geocodeer(adres) {
        const res = await fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(adres)}&fl=centroide_ll&rows=1`)
        const data = await res.json()
        const coord = data.response?.docs?.[0]?.centroide_ll
        if (!coord) return null
        const [lon, lat] = coord.replace('POINT(', '').replace(')', '').split(' ')
        return { lon, lat }
      }
      const [start, eind] = await Promise.all([geocodeer(rit.startadres), geocodeer(eindAdres)])
      if (!start || !eind) { alert('Adres niet gevonden via PDOK'); updateRit(idx, '_bezig', false); return }
      const routeRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${eind.lon},${eind.lat}?overview=false`)
      const routeData = await routeRes.json()
      const afstand = routeData.routes?.[0]?.distance
      const duur = routeData.routes?.[0]?.duration
      if (afstand) {
        updateRit(idx, 'kilometers', Math.round(afstand / 100) / 10)
        updateRit(idx, 'reistijd', Math.round(duur / 60))
      } else { alert('Route niet gevonden') }
    } catch (e) { alert('Fout bij routeberekening: ' + e.message) }
    updateRit(idx, '_bezig', false)
  }
  function productSelecteren(idx, product) {
    setMaterialen(m => m.map((item, i) => i === idx ? { ...item, omschrijving: product.naam, prijs: product.prijs, eenheid: product.eenheid || 'stuk' } : item))
  }

  // Foto's
  async function handleMsLogin() { try { await msLogin(); setMsIngelogd(true) } catch (e) { alert('Inloggen mislukt: ' + e.message) } }
  async function handleMsLogout() { await msLogout(); setMsIngelogd(false) }
  async function handleFotoKiezen(e) {
    const bestanden = Array.from(e.target.files); if (!bestanden.length) return
    setFotoUploadBezig(true)
    for (const b of bestanden) {
      try { const foto = await uploadFotoNaarOneDrive(b, formulier.nummer || 'concept', formulier.klant_naam); setFotos(f => [...f, foto]) }
      catch (err) { alert(`Upload mislukt: ${err.message}`) }
    }
    setFotoUploadBezig(false)
    if (fotoInputRef.current) fotoInputRef.current.value = ''
  }
  function verwijderFoto(idx) { setFotos(f => f.filter((_, i) => i !== idx)) }

  async function slaWerkbonOp() {
    setBezig(true)
    const geldigeWerkdagen = werkdagen.filter(w => w.datum || w.omschrijving || w.uren).map(w => {
      const med = medewerkers.find(m => m.id === w.medewerker_id)
      return { datum: w.datum, omschrijving: w.omschrijving, uren: parseFloat(w.uren) || 0, medewerker_id: w.medewerker_id || null, medewerker_naam: med?.naam || null, medewerker_kleur: med?.kleur || null }
    })
    const geldigeMat = materialen.filter(m => m.omschrijving || m.aantal || m.prijs).map(m => {
      const med = medewerkers.find(x => x.id === m.medewerker_id)
      return { omschrijving: m.omschrijving, aantal: parseFloat(m.aantal) || 0, eenheid: m.eenheid || 'stuk', prijs: parseFloat(m.prijs) || 0, medewerker_id: m.medewerker_id || null, medewerker_naam: med?.naam || null, medewerker_kleur: med?.kleur || null }
    })
    const totalen = bereken(geldigeWerkdagen, formulier.uurtarief, geldigeMat)
    const rij = {
      nummer: formulier.nummer, naam: formulier.naam || null, datum: formulier.datum, type: geselecteerdeTypes.join(', '),
      klant_naam: formulier.klant_naam,
      klant_adres: [formulier.klant_straat, formulier.klant_huisnummer].filter(Boolean).join(' '),
      klant_postcode: formulier.klant_postcode, klant_plaats: formulier.klant_plaats, klant_tel: formulier.klant_tel, klant_email: formulier.klant_email,
      ritten: ritten.map(({ _bezig, ...r }) => {
        const med = medewerkers.find(m => m.id === r.medewerker_id)
        return { ...r, reistijd: parseFloat(r.reistijd) || 0, kilometers: parseFloat(r.kilometers) || 0, medewerker_id: r.medewerker_id || null, medewerker_naam: med?.naam || null, medewerker_kleur: med?.kleur || null }
      }),
      omschrijving: formulier.omschrijving, uren: totalen.totalUren, uurtarief: parseFloat(formulier.uurtarief) || 0,
      werkdagen: geldigeWerkdagen, materialen: geldigeMat, fotos,
      notities: formulier.notities, arbeid: totalen.arbeid, mat_totaal: totalen.mat_totaal,
      excl_btw: totalen.excl_btw, btw: totalen.btw, totaal_incl: totalen.totaal_incl,
    }
    let result
    if (bewerkModus && huidigeBon) {
      const { data, error } = await supabase.from('werkbonnen').update(rij).eq('id', huidigeBon.id).select().single()
      if (error) { alert('Opslaan mislukt: ' + error.message); setBezig(false); return }
      result = data
    } else {
      const { data, error } = await supabase.from('werkbonnen').insert(rij).select().single()
      if (error) { alert('Opslaan mislukt: ' + error.message); setBezig(false); return }
      result = data
    }
    await laadWerkbonnen(); setBezig(false)
    if (result) {
      localStorage.removeItem(WB_DRAFT_KEY)
      if (msIngelogd) autoSavePdfRef.current = true
      toonDetail(result)
    } else toonOverzicht()
  }

  async function wijzigWerkbonMedewerker(medewerkerId) {
    const huidig = huidigeBon.medewerkers || []
    const wordtToegevoegd = !huidig.includes(medewerkerId)
    const nieuw = wordtToegevoegd
      ? [...huidig, medewerkerId]
      : huidig.filter(id => id !== medewerkerId)
    await supabase.from('werkbonnen').update({ medewerkers: nieuw }).eq('id', huidigeBon.id)
    const bijgewerkt = { ...huidigeBon, medewerkers: nieuw }
    setHuidigeBon(bijgewerkt)
    setWerkbonnen(w => w.map(b => b.id === huidigeBon.id ? bijgewerkt : b))

    // Stuur e-mailmelding als medewerker wordt toegevoegd en meldingen aan staan
    if (wordtToegevoegd) {
      const med = medewerkers.find(m => m.id === medewerkerId)
      if (med?.email && (med.meldingen ?? true)) {
        fetch('/api/stuur-melding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: med.email,
            naam: med.naam,
            werkbonNummer: huidigeBon.nummer,
            klantNaam: huidigeBon.klant_naam,
            klantAdres: huidigeBon.klant_adres,
            omschrijving: huidigeBon.omschrijving,
            token: med.token,
            origin: window.location.origin,
          }),
        }).catch(err => console.warn('Melding sturen mislukt:', err))
      }
    }
  }

  async function wisselStatus() {
    if (!huidigeBon) return
    const nieuw = !huidigeBon.gefactureerd
    await supabase.from('werkbonnen').update({ gefactureerd: nieuw }).eq('id', huidigeBon.id)
    const bijgewerkt = { ...huidigeBon, gefactureerd: nieuw }
    setHuidigeBon(bijgewerkt); setWerkbonnen(w => w.map(b => b.id === huidigeBon.id ? bijgewerkt : b))
  }

  async function verwijderWerkbon() {
    if (!huidigeBon) return
    await supabase.from('werkbonnen').delete().eq('id', huidigeBon.id)
    setVerwijderModal(false); await laadWerkbonnen(); toonOverzicht()
  }

  function exporteerUBL() {
    if (!huidigeBon) return
    const xml = genereerUBL(huidigeBon)
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${huidigeBon.nummer}.xml`; a.click()
    URL.revokeObjectURL(url)
  }

  async function slaWerkbonPdfOp(element, bon) {
    if (!element || !bon) return
    setPdfStatus('bezig')
    try {
      const html2pdf = (await import('html2pdf.js')).default
      const pdfBlob = await html2pdf()
        .from(element)
        .set({
          margin: [8, 8, 8, 8],
          filename: `${bon.nummer}.pdf`,
          image: { type: 'jpeg', quality: 0.92 },
          html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .outputPdf('blob')
      await uploadPdfNaarOneDrive(pdfBlob, bon.nummer, bon.klant_naam)
      setPdfStatus('klaar')
      setTimeout(() => setPdfStatus(null), 4000)
    } catch (err) {
      console.error('PDF naar OneDrive mislukt:', err)
      setPdfStatus('fout')
      setTimeout(() => setPdfStatus(null), 6000)
    }
  }

  const totalen = bereken(werkdagen, formulier.uurtarief, materialen)
  const toonNav = ['overzicht', 'klanten', 'producten', 'planning', 'todos', 'offertes', 'instellingen'].includes(view)
  const headerTitel = view === 'overzicht' ? 'JdB Werkbonnen' : view === 'klanten' ? 'Klanten' : view === 'producten' ? 'Producten' : view === 'planning' ? 'Planning' : view === 'todos' ? 'Taken' : view === 'medewerkers' ? 'Medewerkers' : view === 'offertes' ? 'Offertes' : view === 'instellingen' ? 'Instellingen' : view === 'formulier' ? (bewerkModus ? 'Bewerken' : 'Nieuwe werkbon') : huidigeBon?.nummer || ''

  return (
    <>
      <header>
        <div className="header-links">
          <img src="/logo.png" alt="JdB" className="header-logo" onError={e => e.target.style.display = 'none'} />
          <div>
            <h1>{headerTitel}{syncActief && <span className="sync-dot" />}</h1>
            {view === 'detail' && huidigeBon?.klant_naam && <span>{huidigeBon.klant_naam}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-ms-header" onClick={() => navigeer('medewerkers')}>
            Personeel
          </button>
          <button className={`btn-ms-header ${msIngelogd ? 'ingelogd' : ''}`} onClick={msIngelogd ? handleMsLogout : handleMsLogin} title={msIngelogd ? 'Uitloggen bij Microsoft' : 'Inloggen voor foto-upload'}>
            {msIngelogd ? '☁️ MS ✓' : '☁️ MS'}
          </button>
          <button className="btn-changelog-header" onClick={() => setChangelogOpen(true)} title="Wat is er nieuw?">
            🆕
          </button>
        </div>
      </header>

      {/* ── OVERZICHT ── */}
      {view === 'overzicht' && (
        <div className="view-content with-bottom-nav">
          <div className="overzicht-header"><h2>{werkbonnen.length} {werkbonnen.length === 1 ? 'werkbon' : 'werkbonnen'}</h2></div>
          {laden ? <div className="laden">Laden...</div>
            : werkbonnen.length === 0 ? <div className="leeg"><p>Nog geen werkbonnen.<br />Tik op <strong>+</strong> om te beginnen.</p></div>
            : (
              <div className="bon-lijst">
                {werkbonnen.map(bon => (
                  <div key={bon.id} className="bon-kaart" onClick={() => toonDetail(bon)}>
                    <div className="bon-nummer">{bon.nummer}</div>
                    <div className="bon-info">
                      {bon.naam && <div className="bon-klant" style={{ fontWeight: 600 }}>{bon.naam}</div>}
                      <div className={bon.naam ? 'bon-meta' : 'bon-klant'}>{bon.klant_naam || '(geen naam)'}</div>
                      <div className="bon-meta">
                        {datumNL(bon.datum)} &bull; {bon.type || '–'} &bull; {' '}
                        <span className={`status-badge ${bon.gefactureerd ? 'status-gefactureerd' : 'status-open'}`}>{bon.gefactureerd ? 'Gefactureerd' : 'Open'}</span>
                        {bon.fotos?.length > 0 && <span className="foto-badge">📷 {bon.fotos.length}</span>}
                      </div>
                    </div>
                    <div className="bon-totaal">{euro(bon.totaal_incl)}</div>
                  </div>
                ))}
              </div>
            )}
          <button className="fab fab-boven-nav" onClick={nieuweWerkbon}>+</button>
        </div>
      )}

      {/* ── KLANTEN ── */}
      {view === 'klanten' && <KlantenView klanten={klanten} onVervers={laadKlanten} />}

      {/* ── PRODUCTEN ── */}
      {view === 'producten' && <ProductenView producten={producten} onVervers={laadProducten} />}

      {/* ── PLANNING ── */}
      {view === 'planning' && <PlanningView klanten={klanten} werkbonnen={werkbonnen} onWerkbonNavigeer={bon => toonDetail(bon)} />}

      {/* ── OFFERTES ── */}
      {view === 'offertes' && <OfferteView klanten={klanten} producten={producten} onWerkbonAangemaakt={werkbonVanOfferte} msIngelogd={msIngelogd} instellingen={instellingen} />}

      {/* ── INSTELLINGEN ── */}
      {view === 'instellingen' && <InstellingenView instellingen={instellingen} onChange={setInstellingen} />}

      {/* ── TODOS ── */}
      {view === 'todos' && <TodoView />}

      {/* ── MEDEWERKERS ── */}
      {view === 'medewerkers' && (
        <MedewerkersView
          medewerkers={medewerkers}
          werkbonnen={werkbonnen}
          onVervers={laadMedewerkers}
          onTerug={toonOverzicht}
        />
      )}

      {/* ── FORMULIER ── */}
      {view === 'formulier' && (
        <div className="view-content form-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <button className="form-terug" style={{ margin: 0 }} onClick={toonOverzicht}>← Terug</button>
            {autosaveStatus && (
              <span style={{ fontSize: 12, color: autosaveStatus === 'opslaan' ? '#C9A227' : '#52c41a', flex: 1, textAlign: 'center' }}>
                {autosaveStatus === 'opslaan' ? '⏳ Automatisch opslaan...' : '✓ Concept opgeslagen'}
              </span>
            )}
          </div>

          <div className="sectie">
            <div className="sectie-titel">Werkbon info</div>
            <div className="rij-2">
              <div className="veld"><label>Bonnummer</label><input type="text" value={formulier.nummer} onChange={e => setVeld('nummer', e.target.value)} placeholder="WB-2026-001" /></div>
              <div className="veld"><label>Datum</label><input type="date" value={formulier.datum} onChange={e => setVeld('datum', e.target.value)} /></div>
            </div>
            <div className="veld">
              <label>Naam / omschrijving</label>
              <input type="text" value={formulier.naam || ''} onChange={e => setVeld('naam', e.target.value)} placeholder="Bijv. Dakgoot plaatsen, CV ketel installatie..." />
            </div>
          </div>

          <div className="sectie">
            <div className="sectie-titel">Type werkzaamheden</div>
            <div className="type-grid">
              {WERK_TYPES.map(type => (
                <label key={type} className={`type-optie ${geselecteerdeTypes.includes(type) ? 'geselecteerd' : ''}`}>
                  <input type="checkbox" checked={geselecteerdeTypes.includes(type)} onChange={() => toggleType(type)} />
                  <div className="type-vinkje">{geselecteerdeTypes.includes(type) ? '✓' : ''}</div>
                  <span className="type-label">{type}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="sectie">
            <div className="sectie-titel">Klantgegevens</div>
            <div className="veld">
              <label>Naam</label>
              <Autocomplete
                waarde={formulier.klant_naam}
                opties={klanten}
                onChange={v => setVeld('klant_naam', v)}
                onSelecteer={klantSelecteren}
                placeholder="Naam of zoek bestaande klant"
                renderOptie={k => (
                  <div>
                    <div>{k.naam}</div>
                    <div className="autocomplete-optie-sub">{[k.adres, k.postcode, k.plaats].filter(Boolean).join(' ')}</div>
                  </div>
                )}
              />
            </div>
            <div className="rij-2">
              <div className="veld">
                <label>Postcode</label>
                <div className="input-met-indicator">
                  <input type="text" value={formulier.klant_postcode} onChange={e => setVeld('klant_postcode', e.target.value)} onBlur={() => adresOpzoeken('postcode')} placeholder="1234 AB" />
                  {postcodeBezig && <span className="input-spinner">⟳</span>}
                </div>
              </div>
              <div className="veld"><label>Huisnummer</label><input type="text" value={formulier.klant_huisnummer} onChange={e => setVeld('klant_huisnummer', e.target.value)} onBlur={() => adresOpzoeken('postcode')} placeholder="10" /></div>
            </div>
            <div className="rij-2">
              <div className="veld"><label>Straat</label><input type="text" value={formulier.klant_straat} onChange={e => setVeld('klant_straat', e.target.value)} onBlur={() => adresOpzoeken('straat')} placeholder="Automatisch ingevuld" /></div>
              <div className="veld"><label>Plaats</label><input type="text" value={formulier.klant_plaats} onChange={e => setVeld('klant_plaats', e.target.value)} onBlur={() => adresOpzoeken('straat')} placeholder="Automatisch ingevuld" /></div>
            </div>
            <div className="rij-2">
              <div className="veld"><label>Telefoon</label><input type="tel" value={formulier.klant_tel} onChange={e => setVeld('klant_tel', e.target.value)} placeholder="06-12345678" /></div>
              <div className="veld"><label>E-mail</label><input type="email" value={formulier.klant_email} onChange={e => setVeld('klant_email', e.target.value)} placeholder="naam@email.nl" /></div>
            </div>
          </div>

          <div className="sectie">
            <div className="sectie-titel">Omschrijving werkzaamheden</div>
            <textarea value={formulier.omschrijving} onChange={e => setVeld('omschrijving', e.target.value)} placeholder="Beschrijf wat er gedaan is..." rows={3} />
          </div>

          <div className="sectie">
            <div className="sectie-titel">Gewerkte dagen</div>
            <div className="werkdag-labels"><span className="mat-label" style={{ textAlign: 'left' }}>Datum</span><span className="mat-label" style={{ textAlign: 'left' }}>Omschrijving</span><span className="mat-label">Uren</span>{medewerkers.length > 0 && <span />}<span /></div>
            <div className="werkdag-lijst">
              {werkdagen.map((w, i) => (
                <div key={i} className="werkdag-item">
                  <div className="werkdag-rij">
                    <input type="date" value={w.datum} onChange={e => updateWerkdag(i, 'datum', e.target.value)} />
                    <input type="text" value={w.omschrijving} onChange={e => updateWerkdag(i, 'omschrijving', e.target.value)} placeholder="Wat gedaan?" />
                    <input type="number" value={w.uren} onChange={e => updateWerkdag(i, 'uren', e.target.value)} placeholder="0" min="0" step="0.5" style={{ textAlign: 'center' }} />
                    <button className="btn-verwijder" onClick={() => verwijderWerkdag(i)}>×</button>
                  </div>
                  {medewerkers.length > 0 && (
                    <select className="med-select" value={w.medewerker_id || ''} onChange={e => updateWerkdag(i, 'medewerker_id', e.target.value)}>
                      <option value="">— Niemand —</option>
                      {medewerkers.map(m => <option key={m.id} value={m.id}>{m.naam}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
            <button className="btn-toevoegen" onClick={voegWerkdagToe}>+ Dag toevoegen</button>
            {totalen.totalUren > 0 && <div className="uren-totaal">Totaal: <strong>{totalen.totalUren} uur</strong></div>}
            <div className="veld" style={{ marginTop: 12 }}><label>Uurtarief (€)</label><input type="number" value={formulier.uurtarief} onChange={e => setVeld('uurtarief', e.target.value)} placeholder="0.00" min="0" step="0.50" /></div>
          </div>

          <div className="sectie">
            <div className="sectie-titel">Reistijd &amp; kilometers</div>
            {ritten.map((r, i) => (
              <div key={i} className="rit-kaart">
                <div className="rit-kaart-kop">
                  <input type="date" value={r.datum || ''} onChange={e => updateRit(i, 'datum', e.target.value)} style={{ flex: 1 }} />
                  <button className="btn-verwijder" onClick={() => verwijderRit(i)}>×</button>
                </div>
                <div className="rit-adres-rij">
                  <input type="text" value={r.startadres || ''} onChange={e => updateRit(i, 'startadres', e.target.value)} placeholder="Startadres (bijv. jouw thuisadres)" style={{ flex: 1 }} />
                  <button className="rit-route-btn" onClick={() => berekenRoute(i)} title="Bereken km automatisch" disabled={r._bezig}>
                    {r._bezig ? '⏳' : '🗺️ Bereken'}
                  </button>
                </div>
                <div className="rit-nummers-rij">
                  <div className="rit-num-veld">
                    <label>Reistijd (min)</label>
                    <input type="number" value={r.reistijd || ''} onChange={e => updateRit(i, 'reistijd', e.target.value)} placeholder="0" min="0" />
                  </div>
                  <div className="rit-num-veld">
                    <label>Kilometers</label>
                    <input type="number" value={r.kilometers || ''} onChange={e => updateRit(i, 'kilometers', e.target.value)} placeholder="0" min="0" step="0.1" />
                  </div>
                </div>
                {medewerkers.length > 0 && (
                  <select className="med-select" value={r.medewerker_id || ''} onChange={e => updateRit(i, 'medewerker_id', e.target.value)}>
                    <option value="">— Niemand —</option>
                    {medewerkers.map(m => <option key={m.id} value={m.id}>{m.naam}</option>)}
                  </select>
                )}
              </div>
            ))}
            <button className="btn-toevoegen" onClick={voegRitToe}>+ Rit toevoegen</button>
            {ritten.length > 0 && (
              <div className="rit-totaal">
                Totaal: <strong>{ritten.reduce((s, r) => s + (parseFloat(r.kilometers) || 0), 0).toFixed(1)} km</strong>
                {' · '}<strong>{ritten.reduce((s, r) => s + (parseFloat(r.reistijd) || 0), 0)} min</strong>
              </div>
            )}
          </div>

          <div className="sectie">
            <div className="sectie-titel">Materialen</div>
            <div className="mat-labels-5">
              <span className="mat-label" style={{ textAlign: 'left' }}>Omschrijving</span>
              <span className="mat-label">Aantal</span>
              <span className="mat-label">Eenh.</span>
              <span className="mat-label">Prijs (€)</span>
              <span />
            </div>
            <div className="materialen-lijst">
              {materialen.map((m, i) => (
                <div key={i} className="werkdag-item">
                  <div className="materiaal-rij-5">
                    <Autocomplete
                      waarde={m.omschrijving}
                      opties={producten}
                      onChange={v => updateMateriaal(i, 'omschrijving', v)}
                      onSelecteer={p => productSelecteren(i, p)}
                      placeholder="Omschrijving"
                      renderOptie={p => <div><span>{p.naam}</span><span className="autocomplete-optie-sub">{euro(p.prijs)} / {p.eenheid}</span></div>}
                    />
                    <input type="number" value={m.aantal} onChange={e => updateMateriaal(i, 'aantal', e.target.value)} placeholder="0" min="0" style={{ textAlign: 'center' }} />
                    <select value={m.eenheid || 'stuk'} onChange={e => updateMateriaal(i, 'eenheid', e.target.value)}>
                      {EENHEDEN.map(e => <option key={e}>{e}</option>)}
                    </select>
                    <input type="number" value={m.prijs} onChange={e => updateMateriaal(i, 'prijs', e.target.value)} placeholder="0,00" min="0" step="0.01" style={{ textAlign: 'right' }} />
                    <button className="btn-verwijder" onClick={() => verwijderMateriaal(i)}>×</button>
                  </div>
                  {medewerkers.length > 0 && (
                    <select className="med-select" value={m.medewerker_id || ''} onChange={e => updateMateriaal(i, 'medewerker_id', e.target.value)}>
                      <option value="">— Niemand —</option>
                      {medewerkers.map(med => <option key={med.id} value={med.id}>{med.naam}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
            <button className="btn-toevoegen" onClick={voegMateriaaltoe}>+ Materiaal toevoegen</button>
          </div>

          <div className="sectie">
            <div className="sectie-titel">Foto's (OneDrive)</div>
            {!msIngelogd ? (
              <div className="ms-login-blok"><p>Log in met Microsoft om foto's te uploaden.</p><button className="btn btn-ms" onClick={handleMsLogin}>Inloggen met Microsoft</button></div>
            ) : (
              <>
                <div className="foto-lijst">
                  {fotos.map((foto, i) => (
                    <div key={i} className="foto-rij">
                      <span className="foto-naam">📷 {foto.naam}</span>
                      <a href={foto.shareUrl || foto.url} target="_blank" rel="noreferrer" className="foto-link-btn">Bekijk</a>
                      <button className="btn-verwijder" onClick={() => verwijderFoto(i)}>×</button>
                    </div>
                  ))}
                </div>
                <label className={`btn-toevoegen ${fotoUploadBezig ? 'disabled' : ''}`}>
                  {fotoUploadBezig ? '⏳ Uploaden...' : '📷 Foto toevoegen'}
                  <input ref={fotoInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFotoKiezen} disabled={fotoUploadBezig} />
                </label>
              </>
            )}
          </div>

          <div className="sectie">
            <div className="sectie-titel">Totaal overzicht</div>
            <div className="totaal-rij"><span>Arbeid ({totalen.totalUren} uur × {euro(formulier.uurtarief || 0)})</span><span>{euro(totalen.arbeid)}</span></div>
            <div className="totaal-rij"><span>Materialen</span><span>{euro(totalen.mat_totaal)}</span></div>
            <div className="totaal-rij"><span>Totaal excl. BTW</span><span>{euro(totalen.excl_btw)}</span></div>
            <div className="totaal-rij"><span>BTW (21%)</span><span>{euro(totalen.btw)}</span></div>
            <div className="totaal-rij groot"><span>Totaal incl. BTW</span><span>{euro(totalen.totaal_incl)}</span></div>
          </div>

          <div className="sectie">
            <div className="sectie-titel">Notities (intern)</div>
            <textarea value={formulier.notities} onChange={e => setVeld('notities', e.target.value)} placeholder="Interne notities..." rows={2} />
          </div>

          <div className="form-acties">
            <button className="btn btn-licht" onClick={toonOverzicht}>Annuleer</button>
            <button className="btn btn-primair" onClick={slaWerkbonOp} disabled={bezig}>{bezig ? 'Opslaan...' : '✓ Opslaan'}</button>
          </div>
        </div>
      )}

      {/* ── DETAIL ── */}
      {view === 'detail' && huidigeBon && (
        <div className="view-content">
          <button className="form-terug" onClick={toonOverzicht}>← Terug</button>
          {huidigeBon.naam && (
            <div style={{ fontSize: 18, fontWeight: 700, margin: '8px 0 4px', color: '#1a1a1a' }}>{huidigeBon.naam}</div>
          )}
          <div className="detail-acties">
            <button className="btn btn-primair" onClick={bewerkWerkbon}>✏️ Bewerken</button>
            <button className="btn btn-sec" onClick={() => window.print()}>🖨️ PDF / Afdrukken</button>
            <button className={`btn ${huidigeBon.gefactureerd ? 'btn-groen-licht' : 'btn-licht'}`} onClick={wisselStatus}>{huidigeBon.gefactureerd ? '✓ Gefactureerd' : 'Markeer gefactureerd'}</button>
            <button className="btn btn-gevaar-licht" onClick={() => setVerwijderModal(true)}>🗑️</button>
          </div>
          {msIngelogd && pdfStatus && (
            <div className="pdf-onedrive-status" data-status={pdfStatus}>
              {pdfStatus === 'bezig' && '⏳ PDF opslaan naar OneDrive…'}
              {pdfStatus === 'klaar' && '✅ PDF opgeslagen in OneDrive'}
              {pdfStatus === 'fout' && '⚠️ PDF opslaan naar OneDrive mislukt'}
            </div>
          )}
          {medewerkers.length > 0 && (
            <div className="bon-medewerkers-blok">
              <span className="bon-med-label">Zichtbaar voor:</span>
              <div className="bon-med-chips">
                {medewerkers.map(m => {
                  const actief = (huidigeBon.medewerkers || []).includes(m.id)
                  return (
                    <button key={m.id} className={`bon-med-chip${actief ? ' actief' : ''}`}
                      style={actief ? { background: (m.kleur || '#C9A227') + '22', borderColor: m.kleur || '#C9A227', color: m.kleur || '#C9A227' } : {}}
                      onClick={() => wijzigWerkbonMedewerker(m.id)}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: actief ? (m.kleur || '#C9A227') : '#bbb', display: 'inline-block', marginRight: 5, flexShrink: 0 }} />
                      {m.naam}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div className="bon-print" ref={bonPrintRef}><BonAfdruk bon={huidigeBon} instellingen={instellingen} /></div>
        </div>
      )}

      {/* ── MODAL ── */}
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

      {/* ── CHANGELOG MODAL ── */}
      {changelogOpen && (
        <div className="modal-overlay" onClick={() => setChangelogOpen(false)}>
          <div className="modal changelog-modal" onClick={e => e.stopPropagation()}>
            <div className="changelog-header">
              <h3>Wat is er nieuw?</h3>
              <button className="modal-sluit" onClick={() => setChangelogOpen(false)}>✕</button>
            </div>
            <div className="changelog-inhoud">
              {CHANGELOG.map(v => (
                <div key={v.versie} className="changelog-versie">
                  <div className="changelog-versie-kop">
                    <span className="changelog-versie-nr">{v.versie}</span>
                    <span className="changelog-versie-datum">{v.datum}</span>
                  </div>
                  <ul className="changelog-items">
                    {v.items.map((item, i) => {
                      const stijl = CHANGELOG_KLEUREN[item.type] || CHANGELOG_KLEUREN.nieuw
                      return (
                        <li key={i} className="changelog-item">
                          <span className="changelog-badge" style={{ background: stijl.bg, color: stijl.kleur, border: `1px solid ${stijl.rand}` }}>{stijl.label}</span>
                          <span>{item.tekst}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── NAVIGATIEBALK ── */}
      {toonNav && (
        <nav className="bottom-nav">
          <button className={view === 'overzicht' ? 'actief' : ''} onClick={() => { navigeer('overzicht'); setHuidigeBon(null) }}>
            <span className="nav-icon">📋</span><span className="nav-label">Werkbonnen</span>
          </button>
          <button className={view === 'klanten' ? 'actief' : ''} onClick={() => navigeer('klanten')}>
            <span className="nav-icon">👥</span><span className="nav-label">Klanten</span>
          </button>
          <button className={view === 'producten' ? 'actief' : ''} onClick={() => navigeer('producten')}>
            <span className="nav-icon">📦</span><span className="nav-label">Producten</span>
          </button>
          <button className={view === 'planning' ? 'actief' : ''} onClick={() => navigeer('planning')}>
            <span className="nav-icon">📅</span><span className="nav-label">Planning</span>
          </button>
          <button className={view === 'todos' ? 'actief' : ''} onClick={() => navigeer('todos')}>
            <span className="nav-icon">✅</span><span className="nav-label">Taken</span>
          </button>
          <button className={view === 'offertes' ? 'actief' : ''} onClick={() => navigeer('offertes')}>
            <span className="nav-icon">📄</span><span className="nav-label">Offertes</span>
          </button>
          <button className={view === 'instellingen' ? 'actief' : ''} onClick={() => navigeer('instellingen')}>
            <span className="nav-icon">⚙️</span><span className="nav-label">Instellingen</span>
          </button>
        </nav>
      )}
    </>
  )
}

// Extraheert het Supabase opslagpad uit een av_url die ofwel al een pad is
// ofwel een volledige URL (legacy-formaat). Werkt met beide.
function avPadUitUrl(av_url) {
  if (!av_url) return null
  if (av_url.startsWith('http')) {
    const m = av_url.match(/\/object\/public\/werkbon-fotos\/([^?]+)/)
    return m?.[1] ? decodeURIComponent(m[1]) : null
  }
  return av_url // al een pad
}

// ── Instellingen ─────────────────────────────────────────────────────
function InstellingenView({ instellingen, onChange }) {
  const [form, setForm] = useState({ ...instellingen })
  const [bezig, setBezig] = useState(false)
  const [opgeslagen, setOpgeslagen] = useState(false)
  const [logoBezig, setLogoBezig] = useState(false)
  const [avBezig, setAvBezig] = useState(false)
  const logoInputRef = useRef(null)
  const avInputRef = useRef(null)

  useEffect(() => { setForm({ ...instellingen }) }, [JSON.stringify(instellingen)])

  function sv(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function opslaan() {
    setBezig(true)
    const { id, ...data } = form
    const { error } = await supabase.from('instellingen').upsert({ id: 'singleton', ...data })
    if (!error) { onChange({ id: 'singleton', ...data }); setOpgeslagen(true); setTimeout(() => setOpgeslagen(false), 3000) }
    else alert('Opslaan mislukt: ' + error.message)
    setBezig(false)
  }

  async function handleLogo(e) {
    const bestand = e.target.files?.[0]
    if (!bestand) return
    setLogoBezig(true)
    try {
      const ext = bestand.name.slice(bestand.name.lastIndexOf('.')) || '.png'
      const pad = `instellingen/logo${ext}`
      const res = await fetch('/api/foto-upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pad }) })
      const { signedUrl, publicUrl } = await res.json()
      await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': bestand.type || 'image/png', 'x-upsert': 'true' }, body: bestand })
      sv('logo_url', publicUrl + '?v=' + Date.now())
    } catch (err) { alert('Logo upload mislukt: ' + err.message) }
    setLogoBezig(false)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  async function handleAv(e) {
    const bestand = e.target.files?.[0]
    if (!bestand) return
    if (bestand.type !== 'application/pdf') { alert('Kies een PDF-bestand'); return }
    setAvBezig(true)
    try {
      const pad = 'instellingen/algemene-voorwaarden.pdf'
      const res = await fetch('/api/foto-upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pad }) })
      const { signedUrl } = await res.json()
      const uploadRes = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'true' }, body: bestand })
      if (!uploadRes.ok) throw new Error('Upload naar storage mislukt (' + uploadRes.status + ')')
      sv('av_url', pad) // Sla het opslagpad op — niet de publieke URL (die kan null zijn bij privé-bucket)
    } catch (err) { alert('Upload mislukt: ' + err.message) }
    setAvBezig(false)
    if (avInputRef.current) avInputRef.current.value = ''
  }

  async function bekijkAvPdf() {
    const pad = avPadUitUrl(form.av_url)
    if (!pad) { alert('Geen geldige PDF gevonden. Upload de PDF opnieuw.'); return }
    try {
      const res = await fetch('/api/haal-bestand', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pad }) })
      if (!res.ok) throw new Error(await res.text())
      const { base64 } = await res.json()
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: 'application/pdf' })
      window.open(URL.createObjectURL(blob), '_blank')
    } catch (err) { alert('PDF openen mislukt: ' + err.message) }
  }

  return (
    <div className="view-content with-bottom-nav">
      <div className="top-acties">
        <div />
        <button className="btn btn-primair" onClick={opslaan} disabled={bezig}>
          {bezig ? 'Opslaan...' : opgeslagen ? '✓ Opgeslagen!' : '✓ Opslaan'}
        </button>
      </div>
      <div className="sectie">
        <div className="sectie-titel">Logo</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <img src={form.logo_url || '/logo.png'} alt="Logo" style={{ height: 64, objectFit: 'contain', background: '#1a1a1a', padding: 8, borderRadius: 8 }} onError={e => e.target.style.display = 'none'} />
          <div>
            <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogo} style={{ display: 'none' }} />
            <button className="btn btn-licht" onClick={() => logoInputRef.current?.click()} disabled={logoBezig} style={{ marginRight: 8 }}>
              {logoBezig ? '⏳ Uploaden...' : '📷 Logo uploaden'}
            </button>
            {form.logo_url && <button className="btn btn-licht" onClick={() => sv('logo_url', '')}>Verwijder</button>}
          </div>
        </div>
      </div>
      <div className="sectie">
        <div className="sectie-titel">Algemene voorwaarden</div>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>
          Wordt automatisch als bijlage meegestuurd bij elke offerte per e-mail.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {form.av_url && (
            <button className="btn btn-licht" onClick={bekijkAvPdf}>
              📄 Bekijk huidige PDF
            </button>
          )}
          <input ref={avInputRef} type="file" accept="application/pdf" onChange={handleAv} style={{ display: 'none' }} />
          <button className="btn btn-licht" onClick={() => avInputRef.current?.click()} disabled={avBezig}>
            {avBezig ? '⏳ Uploaden...' : form.av_url ? '🔄 Vervang PDF' : '📎 Upload AV-PDF'}
          </button>
          {form.av_url && <button className="btn btn-licht" onClick={() => sv('av_url', '')}>Verwijder</button>}
        </div>
      </div>
      <div className="sectie">
        <div className="sectie-titel">Bedrijfsgegevens</div>
        <div className="veld"><label>Bedrijfsnaam</label><input value={form.bedrijfsnaam || ''} onChange={e => sv('bedrijfsnaam', e.target.value)} placeholder="JdB Dak- en Installatietechniek" /></div>
        <div className="veld"><label>Adres</label><input value={form.adres || ''} onChange={e => sv('adres', e.target.value)} placeholder="Straat 123" /></div>
        <div className="rij-2">
          <div className="veld"><label>Postcode</label><input value={form.postcode || ''} onChange={e => sv('postcode', e.target.value)} placeholder="1234 AB" /></div>
          <div className="veld"><label>Plaats</label><input value={form.plaats || ''} onChange={e => sv('plaats', e.target.value)} placeholder="Amsterdam" /></div>
        </div>
        <div className="rij-2">
          <div className="veld"><label>Telefoon</label><input value={form.telefoon || ''} onChange={e => sv('telefoon', e.target.value)} placeholder="06-12345678" /></div>
          <div className="veld"><label>E-mail</label><input value={form.email || ''} onChange={e => sv('email', e.target.value)} placeholder="info@bedrijf.nl" /></div>
        </div>
        <div className="veld"><label>Website</label><input value={form.website || ''} onChange={e => sv('website', e.target.value)} placeholder="www.bedrijf.nl" /></div>
      </div>
      <div className="sectie">
        <div className="sectie-titel">Financieel</div>
        <div className="rij-2">
          <div className="veld"><label>BTW-nummer</label><input value={form.btw_nummer || ''} onChange={e => sv('btw_nummer', e.target.value)} placeholder="NL123456789B01" /></div>
          <div className="veld"><label>KVK-nummer</label><input value={form.kvk_nummer || ''} onChange={e => sv('kvk_nummer', e.target.value)} placeholder="12345678" /></div>
        </div>
        <div className="veld"><label>IBAN</label><input value={form.iban || ''} onChange={e => sv('iban', e.target.value)} placeholder="NL00 BANK 0000 0000 00" /></div>
      </div>
      <div className="sectie">
        <div className="sectie-titel">Nummering</div>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
          Stel de prefix in voor automatisch gegenereerde nummers. Het jaar en volgnummer worden er automatisch achter gezet.
        </p>
        <div className="rij-2">
          <div className="veld">
            <label>Werkbon prefix</label>
            <input value={form.wb_prefix || ''} onChange={e => sv('wb_prefix', e.target.value)} placeholder="WB" />
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
              Voorbeeld: <strong>{(form.wb_prefix || 'WB').toUpperCase()}-{new Date().getFullYear()}-001</strong>
            </div>
          </div>
          <div className="veld">
            <label>Offerte prefix</label>
            <input value={form.offerte_prefix || ''} onChange={e => sv('offerte_prefix', e.target.value)} placeholder="OFN" />
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
              Voorbeeld: <strong>{(form.offerte_prefix || 'OFN').toUpperCase()}-{new Date().getFullYear()}-001</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Bon afdruk ────────────────────────────────────────────────────────
function BonAfdruk({ bon, instellingen = {} }) {
  const bedrijfsnaam = instellingen.bedrijfsnaam || 'JdB Dak- & Installatietechniek'
  const logoUrl = instellingen.logo_url || '/logo.png'
  const types = bon.type ? bon.type.split(', ').filter(Boolean) : []
  const werkdagen = bon.werkdagen || []
  const materialen = bon.materialen || []
  const fotos = bon.fotos || []
  const heeftRegels = werkdagen.length > 0 || materialen.length > 0

  return (
    <>
      <div className="bon-kop">
        <div className="bon-kop-rij">
          <div className="bon-logo-blok">
            <img src={logoUrl} alt="Logo" className="bon-logo" onError={e => e.target.style.display = 'none'} />
            <div className="bon-logo-tekst">
              <div className="bon-bedrijf">{bedrijfsnaam}</div>
              {(instellingen.adres || instellingen.telefoon || instellingen.email) && (
                <div className="bon-bedrijf-sub" style={{ lineHeight: 1.5 }}>
                  {instellingen.adres && <span>{instellingen.adres}{instellingen.postcode || instellingen.plaats ? ', ' + [instellingen.postcode, instellingen.plaats].filter(Boolean).join(' ') : ''}</span>}
                  {instellingen.telefoon && <><br />{instellingen.telefoon}</>}
                  {instellingen.email && <> · {instellingen.email}</>}
                </div>
              )}
            </div>
          </div>
          <div className="bon-kop-nr">
            <div className="nr">{bon.nummer}</div>
            <div className="datum">{datumNL(bon.datum)}</div>
            <div><span className={`status-badge ${bon.gefactureerd ? 'status-gefactureerd' : 'status-open'}`}>{bon.gefactureerd ? 'Gefactureerd' : 'Open'}</span></div>
          </div>
        </div>
      </div>

      <div className="bon-body">
        {types.length > 0 && <div className="bon-sectie"><div className="bon-sectie-titel">Type werkzaamheden</div><div className="bon-types">{types.map(t => <span key={t} className="bon-type-badge">{t}</span>)}</div></div>}

        <div className="bon-sectie">
          <div className="bon-sectie-titel">Klant</div>
          <div className="bon-klant-info">
            <p><strong>{bon.klant_naam || '–'}</strong></p>
            {bon.klant_adres && <p>{bon.klant_adres}</p>}
            {(bon.klant_postcode || bon.klant_plaats) && <p>{bon.klant_postcode} {bon.klant_plaats}</p>}
            {bon.klant_tel && <p>📞 {bon.klant_tel}</p>}
            {bon.klant_email && <p>✉️ {bon.klant_email}</p>}
            {(bon.klant_adres || bon.klant_plaats) && (
              <a href={`https://maps.google.com/?q=${encodeURIComponent([bon.klant_adres, bon.klant_postcode, bon.klant_plaats].filter(Boolean).join(' '))}`} target="_blank" rel="noreferrer" className="maps-knop">🗺️ Navigeer</a>
            )}
          </div>
        </div>

        {bon.omschrijving && <div className="bon-sectie"><div className="bon-sectie-titel">Werkzaamheden</div><div className="bon-omschrijving">{bon.omschrijving}</div></div>}

        {heeftRegels && (
          <div className="bon-sectie">
            <div className="bon-sectie-titel">Specificatie</div>
            <table>
              <thead><tr><th>Omschrijving</th><th style={{ textAlign: 'center' }}>Aantal</th><th style={{ textAlign: 'right' }}>Prijs</th><th style={{ textAlign: 'right' }}>Totaal</th></tr></thead>
              <tbody>
                {werkdagen.map((w, i) => (
                  <tr key={i}>
                    <td>
                      {datumNL(w.datum)}{w.omschrijving ? ` – ${w.omschrijving}` : ''}
                      {w.medewerker_naam && (
                        <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: (w.medewerker_kleur || '#C9A227') + '22', color: w.medewerker_kleur || '#C9A227', border: `1px solid ${(w.medewerker_kleur || '#C9A227')}55`, borderRadius: 10, padding: '1px 7px', fontWeight: 600, verticalAlign: 'middle' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: w.medewerker_kleur || '#C9A227', display: 'inline-block' }} />
                          {w.medewerker_naam}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>{w.uren} uur</td>
                    <td style={{ textAlign: 'right' }}>{euro(bon.uurtarief)}</td>
                    <td style={{ textAlign: 'right' }}>{euro(w.uren * bon.uurtarief)}</td>
                  </tr>
                ))}
                {materialen.map((m, i) => (
                  <tr key={`m${i}`}>
                    <td>
                      {m.omschrijving}
                      {m.medewerker_naam && (
                        <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: (m.medewerker_kleur || '#C9A227') + '22', color: m.medewerker_kleur || '#C9A227', border: `1px solid ${(m.medewerker_kleur || '#C9A227')}55`, borderRadius: 10, padding: '1px 7px', fontWeight: 600, verticalAlign: 'middle' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.medewerker_kleur || '#C9A227', display: 'inline-block' }} />
                          {m.medewerker_naam}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>{m.aantal} {m.eenheid || 'stuk'}</td>
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

        {bon.ritten?.length > 0 && (
          <div className="bon-sectie">
            <div className="bon-sectie-titel">Reistijd &amp; kilometers</div>
            <table>
              <thead><tr><th>Datum</th><th>Startadres</th><th style={{textAlign:'center'}}>Reistijd</th><th style={{textAlign:'right'}}>Km</th></tr></thead>
              <tbody>
                {bon.ritten.map((r, i) => (
                  <tr key={i}>
                    <td>{r.datum ? `${r.datum.split('-')[2]}-${r.datum.split('-')[1]}-${r.datum.split('-')[0]}` : ''}</td>
                    <td>
                      {r.startadres || '–'}
                      {r.medewerker_naam && (
                        <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: (r.medewerker_kleur || '#C9A227') + '22', color: r.medewerker_kleur || '#C9A227', border: `1px solid ${(r.medewerker_kleur || '#C9A227')}55`, borderRadius: 10, padding: '1px 7px', fontWeight: 600, verticalAlign: 'middle' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.medewerker_kleur || '#C9A227', display: 'inline-block' }} />
                          {r.medewerker_naam}
                        </span>
                      )}
                    </td>
                    <td style={{textAlign:'center'}}>{r.reistijd > 0 ? `${r.reistijd} min` : '–'}</td>
                    <td style={{textAlign:'right'}}>{r.kilometers > 0 ? `${r.kilometers} km` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {fotos.length > 0 && <div className="bon-sectie"><div className="bon-sectie-titel">Foto's ({fotos.length})</div><div className="bon-foto-lijst">{fotos.map((f, i) => <a key={i} href={f.shareUrl || f.url} target="_blank" rel="noreferrer" className="bon-foto-link">📷 {f.naam}</a>)}</div></div>}
      </div>

      <div className="bon-footer">
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{bedrijfsnaam}</div>
        <div>
          {[instellingen.adres, [instellingen.postcode, instellingen.plaats].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
          {instellingen.telefoon && ` · ${instellingen.telefoon}`}
          {instellingen.email && ` · ${instellingen.email}`}
          {instellingen.website && ` · ${instellingen.website}`}
        </div>
        {(instellingen.kvk_nummer || instellingen.btw_nummer || instellingen.iban) && (
          <div style={{ marginTop: 2 }}>
            {instellingen.kvk_nummer && `KVK: ${instellingen.kvk_nummer}`}
            {instellingen.btw_nummer && ` · BTW: ${instellingen.btw_nummer}`}
            {instellingen.iban && ` · IBAN: ${instellingen.iban}`}
          </div>
        )}
      </div>
    </>
  )
}
