'use client'
// Genereert een vector-PDF van een offerte via jsPDF (geen canvas/screenshot).
// Tekst is selecteerbaar, scherp op elk zoomniveau.

function euro(n) { return '€ ' + Number(n || 0).toFixed(2).replace('.', ',') }
function datumNL(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}` }

function berekenTotalen(form) {
  const arbeidskosten = (parseFloat(form.uren) || 0) * (parseFloat(form.uurtarief) || 0)
  const subtotaalMat = (form.materialen || []).reduce((s, m) => s + (parseFloat(m.aantal) || 0) * (parseFloat(m.stukprijs) || 0), 0)
  const subtotaal = arbeidskosten + subtotaalMat
  const btw = parseFloat(form.btw_percentage) || 21
  const btw_bedrag = subtotaal * (btw / 100)
  return { arbeidskosten, subtotaalMat, subtotaal, btw_bedrag, totaal: subtotaal + btw_bedrag }
}

async function haalLogoBase64(logoUrl) {
  if (!logoUrl) return null
  try {
    // Probeer via proxy (Supabase storage)
    const match = logoUrl.match(/\/object\/public\/werkbon-fotos\/([^?]+)/)
    const pad = match?.[1]
    if (pad) {
      const res = await fetch('/api/haal-bestand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pad: decodeURIComponent(pad) }),
      })
      if (res.ok) {
        const { base64 } = await res.json()
        const ext = pad.split('.').pop().toLowerCase().replace('jpg', 'jpeg')
        return { base64, mime: `image/${ext}`, format: ext === 'png' ? 'PNG' : 'JPEG' }
      }
    }
    // Fallback: directe fetch
    const res = await fetch(logoUrl)
    if (res.ok) {
      const blob = await res.blob()
      return new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result
          const format = dataUrl.includes('image/png') ? 'PNG' : 'JPEG'
          resolve({ base64: dataUrl.split(',')[1], mime: blob.type, format })
        }
        reader.readAsDataURL(blob)
      })
    }
  } catch {}
  return null
}

export async function maakOffertePdf(offerte, instellingen = {}) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  const W = 210
  const H = 297
  const ml = 16   // margin left
  const mr = 16   // margin right
  const cw = W - ml - mr  // content width = 178mm

  // Kleuren
  const GOLD   = [201, 162, 39]
  const DARK   = [26,  26,  26]
  const GRAY   = [100, 100, 100]
  const LGRAY  = [245, 245, 245]
  const BORDER = [220, 220, 220]
  const TEXT   = [34,  34,  34]
  const WHITE  = [255, 255, 255]

  const fill   = c => doc.setFillColor(...c)
  const draw   = c => doc.setDrawColor(...c)
  const tc     = c => doc.setTextColor(...c)
  const lw     = w => doc.setLineWidth(w)
  const fnt    = (style, size) => { doc.setFont('helvetica', style); doc.setFontSize(size) }
  const txt    = (s, x, y, opts) => doc.text(String(s ?? ''), x, y, opts)
  const rect   = (x, y, w, h, s) => doc.rect(x, y, w, h, s)
  const line   = (x1, y1, x2, y2) => doc.line(x1, y1, x2, y2)

  let y = 0

  // ── HEADER ──────────────────────────────────────────────────────────
  const headerH = 30
  fill(DARK); rect(0, 0, W, headerH, 'F')

  // Logo ophalen en plaatsen
  const logo = await haalLogoBase64(instellingen.logo_url)
  let logoW = 0
  if (logo) {
    try {
      const logoH = 18
      logoW = 30
      doc.addImage(`data:${logo.mime};base64,${logo.base64}`, logo.format, ml, 6, logoW, logoH, '', 'FAST')
      logoW += 5
    } catch { logoW = 0 }
  }

  const textX = ml + logoW
  fnt('bold', 15); tc(GOLD)
  txt(instellingen.bedrijfsnaam || 'JdB Dak- en Installatietechniek', textX, 14)

  const sub = [instellingen.adres, [instellingen.postcode, instellingen.plaats].filter(Boolean).join(' '), instellingen.telefoon, instellingen.email].filter(Boolean).join('  ·  ')
  if (sub) { fnt('normal', 7.5); tc([180, 180, 180]); txt(sub, textX, 22) }

  // Offerte nummer rechts
  fnt('normal', 8.5); tc([180, 180, 180])
  txt(`Offerte ${offerte.nummer}`, W - mr, 12, { align: 'right' })
  if (offerte.naam) {
    fnt('italic', 8); tc([150, 150, 150])
    txt(offerte.naam, W - mr, 19, { align: 'right' })
  }

  y = headerH + 8

  // ── KLANT + GEGEVENS ────────────────────────────────────────────────
  const klantW = cw * 0.56
  const metaX = ml + klantW + 6
  const metaW = cw - klantW - 6
  const blockH = 28

  // Klantblok
  fill(LGRAY); draw(BORDER); lw(0.2)
  rect(ml, y, klantW, blockH, 'FD')
  fnt('bold', 10.5); tc(TEXT)
  txt(offerte.klant_naam || '', ml + 4, y + 8)
  fnt('normal', 8.5); tc(GRAY)
  let cy = y + 14
  if (offerte.klant_adres) { txt(offerte.klant_adres, ml + 4, cy); cy += 5 }
  if (offerte.klant_postcode || offerte.klant_plaats) txt([offerte.klant_postcode, offerte.klant_plaats].filter(Boolean).join(' '), ml + 4, cy)

  // Meta
  const meta = [
    ['Nummer', offerte.nummer],
    ['Datum', datumNL(offerte.datum)],
    offerte.geldig_tot ? ['Geldig tot', datumNL(offerte.geldig_tot)] : null,
  ].filter(Boolean)

  meta.forEach(([label, val], i) => {
    fnt('normal', 8); tc(GRAY); txt(label + ':', metaX, y + 8 + i * 6)
    fnt('bold', 8); tc(TEXT); txt(val || '', metaX + metaW, y + 8 + i * 6, { align: 'right' })
  })

  y += blockH + 6

  // ── GOUDKLEURIGE SCHEIDINGSLIJN ─────────────────────────────────────
  fill(GOLD); rect(ml, y, cw, 0.8, 'F')
  y += 5

  // ── OFFERTETEKST ────────────────────────────────────────────────────
  if (offerte.tekst?.trim()) {
    // Vervang variabelen basic ({{klant_naam}} etc.)
    let tekst = offerte.tekst
      .replace(/\{\{klant_naam\}\}/g, offerte.klant_naam || '')
      .replace(/\{\{datum\}\}/g, datumNL(offerte.datum))
      .replace(/\{\{geldig_tot\}\}/g, datumNL(offerte.geldig_tot))
      .replace(/\{\{nummer\}\}/g, offerte.nummer || '')

    fnt('normal', 9); tc(TEXT)
    const lines = doc.splitTextToSize(tekst, cw - 10)
    const tekstH = Math.max(lines.length * 5 + 8, 12)

    fill(LGRAY); draw(BORDER); lw(0.2)
    rect(ml, y, cw, tekstH, 'FD')
    fill(GOLD); rect(ml, y, 3, tekstH, 'F')

    fnt('normal', 9); tc(TEXT)
    doc.text(lines, ml + 7, y + 6)
    y += tekstH + 6
  }

  // ── MATERIAALTABEL ──────────────────────────────────────────────────
  const totalen = berekenTotalen(offerte)
  const mats = (offerte.materialen || []).filter(m => m.naam)
  if (offerte.materialen_tonen && mats.length > 0) {
    fnt('bold', 9.5); tc(TEXT)
    txt('Specificatie materialen', ml, y)
    y += 5

    const rh = 6.5
    // Kolomposities
    const c1 = ml              // omschrijving
    const c2 = ml + 96         // aantal (center)
    const c3 = ml + 114        // eenheid
    const c4 = W - mr - 22    // stukprijs (right)
    const c5 = W - mr          // totaal (right)

    // Header
    fill(DARK); rect(ml, y, cw, rh, 'F')
    fnt('bold', 7.5); tc(WHITE)
    txt('Omschrijving', c1 + 2, y + 4.5)
    txt('Aantal', c2, y + 4.5, { align: 'center' })
    txt('Eenh.', c3 + 2, y + 4.5)
    txt('Stukprijs', c4, y + 4.5, { align: 'right' })
    txt('Totaal', c5, y + 4.5, { align: 'right' })
    y += rh

    mats.forEach((m, i) => {
      fill(i % 2 === 0 ? WHITE : [250, 250, 250])
      draw(BORDER); lw(0.15)
      rect(ml, y, cw, rh, 'FD')
      fnt('normal', 8); tc(TEXT)
      const naam = doc.splitTextToSize(m.naam, 90)[0]
      txt(naam, c1 + 2, y + 4.5)
      txt(String(m.aantal ?? ''), c2, y + 4.5, { align: 'center' })
      txt(m.eenheid || 'stuk', c3 + 2, y + 4.5)
      txt(euro(m.stukprijs), c4, y + 4.5, { align: 'right' })
      txt(euro((parseFloat(m.aantal) || 0) * (parseFloat(m.stukprijs) || 0)), c5, y + 4.5, { align: 'right' })
      y += rh
    })
    y += 5
  }

  // ── TOTALEN ─────────────────────────────────────────────────────────
  const totaalRows = [
    totalen.arbeidskosten > 0 ? [`Arbeid (${offerte.uren} uur × ${euro(offerte.uurtarief)})`, totalen.arbeidskosten] : null,
    totalen.subtotaalMat > 0 && totalen.arbeidskosten > 0 ? ['Materialen', totalen.subtotaalMat] : null,
    ['Subtotaal excl. BTW', totalen.subtotaal],
    [`BTW (${offerte.btw_percentage ?? 21}%)`, totalen.btw_bedrag],
  ].filter(Boolean)

  const totaalBoxW = cw * 0.52
  const totaalBoxX = ml + cw - totaalBoxW
  const rh2 = 6.5
  const totaalH = totaalRows.length * rh2 + 14

  fill(LGRAY); draw(BORDER); lw(0.2)
  rect(totaalBoxX, y, totaalBoxW, totaalH, 'FD')

  totaalRows.forEach(([label, val], i) => {
    fnt('normal', 8.5); tc(GRAY)
    txt(label, totaalBoxX + 4, y + 6 + i * rh2)
    fnt('normal', 8.5); tc(TEXT)
    txt(euro(val), totaalBoxX + totaalBoxW - 4, y + 6 + i * rh2, { align: 'right' })
  })

  // Scheidingslijn voor totaal
  draw(BORDER); lw(0.6)
  line(totaalBoxX + 4, y + totaalH - 9, totaalBoxX + totaalBoxW - 4, y + totaalH - 9)

  fnt('bold', 11); tc(TEXT)
  txt('Totaal incl. BTW', totaalBoxX + 4, y + totaalH - 3)
  fnt('bold', 11); tc(GOLD)
  txt(euro(totalen.totaal), totaalBoxX + totaalBoxW - 4, y + totaalH - 3, { align: 'right' })

  // ── FOOTER ──────────────────────────────────────────────────────────
  const footerY = H - 14
  draw(BORDER); lw(0.3)
  line(ml, footerY - 3, W - mr, footerY - 3)

  const footerDelen = [
    instellingen.kvk_nummer ? `KVK: ${instellingen.kvk_nummer}` : null,
    instellingen.btw_nummer ? `BTW: ${instellingen.btw_nummer}` : null,
    instellingen.iban ? `IBAN: ${instellingen.iban}` : null,
    instellingen.website || instellingen.email || 'jdbtechniek@gmail.com',
  ].filter(Boolean)

  fnt('normal', 7.5); tc(GRAY)
  txt(footerDelen.join('  ·  '), W / 2, footerY, { align: 'center' })

  return doc.output('datauristring').split(',')[1]
}
