'use client'
// Genereert een vector-PDF van een offerte via jsPDF (geen canvas/screenshot).
// Tekst is selecteerbaar, scherp op elk zoomniveau.
// Layout volgt zo dicht mogelijk het origineel (.offerte-print in globals.css).

function euro(n) { return '€ ' + Number(n || 0).toFixed(2).replace('.', ',') }
function datumNL(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}` }

function berekenTotalen(form) {
  const arbeidskosten = (parseFloat(form.uren) || 0) * (parseFloat(form.uurtarief) || 0)
  const subtotaalMat = (form.materialen || []).reduce((s, m) => s + (parseFloat(m.aantal) || 0) * (parseFloat(m.stukprijs) || 0), 0)
  const subtotaal = arbeidskosten + subtotaalMat
  const btw = parseFloat(form.btw_percentage) || 21
  const btw_bedrag = subtotaal * (btw / 100)
  return { arbeidskosten, subtotaalMat, subtotaal, btw_bedrag, totaal: subtotaal + btw_bedrag }
}

function materiaaltekst(materialen) {
  return (materialen || []).filter(m => m.naam).map(m =>
    `- ${m.naam}: ${m.aantal} ${m.eenheid || 'stuk'} à ${euro(m.stukprijs)}`
  ).join('\n')
}

// Zelfde variabelen-syntax als in OfferteView.js (verwerkVariabelen) — enkele accolades, bijv. {klant_naam}
function verwerkVariabelen(tekst, form) {
  if (!tekst) return ''
  const t = berekenTotalen(form)
  return tekst
    .replace(/{klant_naam}/g, form.klant_naam || '')
    .replace(/{datum}/g, datumNL(form.datum))
    .replace(/{geldig_tot}/g, datumNL(form.geldig_tot))
    .replace(/{uren}/g, String(form.uren || '0'))
    .replace(/{uurtarief}/g, euro(form.uurtarief))
    .replace(/{arbeidskosten}/g, euro(t.arbeidskosten))
    .replace(/{subtotaal}/g, euro(t.subtotaal))
    .replace(/{btw_bedrag}/g, euro(t.btw_bedrag))
    .replace(/{totaal}/g, euro(t.totaal))
    .replace(/{materialen_lijst}/g, materiaaltekst(form.materialen))
}

// Bepaalt de natuurlijke breedte/hoogte van een afbeelding (voor de juiste beeldverhouding in de PDF)
function leesAfbeeldingAfmetingen(dataUrl) {
  return new Promise(resolve => {
    try {
      const img = new Image()
      img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 })
      img.onerror = () => resolve(null)
      img.src = dataUrl
    } catch { resolve(null) }
  })
}

async function haalLogoBase64(logoUrl) {
  if (!logoUrl) return null
  let resultaat = null
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
        resultaat = { base64, mime: `image/${ext}`, format: ext === 'png' ? 'PNG' : 'JPEG' }
      }
    }
    // Fallback: directe fetch
    if (!resultaat) {
      const res = await fetch(logoUrl)
      if (res.ok) {
        const blob = await res.blob()
        resultaat = await new Promise(resolve => {
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = reader.result
            const format = dataUrl.includes('image/png') ? 'PNG' : 'JPEG'
            resolve({ base64: dataUrl.split(',')[1], mime: blob.type, format })
          }
          reader.readAsDataURL(blob)
        })
      }
    }
  } catch {}

  if (resultaat) {
    const afmetingen = await leesAfbeeldingAfmetingen(`data:${resultaat.mime};base64,${resultaat.base64}`)
    if (afmetingen) { resultaat.width = afmetingen.width; resultaat.height = afmetingen.height }
  }
  return resultaat
}

export async function maakOffertePdf(offerte, instellingen = {}) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  const W = 210
  const H = 297
  const ml = 18   // margin — komt overeen met .offerte-print padding: 32px ≈ 11mm, iets ruimer voor PDF
  const mr = 18
  const cw = W - ml - mr  // content width

  // Kleuren — ontleend aan het origineel (donkere tekst, goud accent, lichtgrijze vlakken)
  const GOLD   = [201, 162, 39]   // #C9A227
  const DARK   = [26,  26,  26]   // #1a1a1a
  const GRAY   = [136, 136, 136]  // #888
  const GRAY2  = [85,  85,  85]   // #555
  const LBG    = [250, 250, 250]  // #fafafa
  const LBORDER= [232, 232, 232]  // #e8e8e8
  const THBG   = [245, 245, 245]  // #f5f5f5
  const THBORD = [224, 224, 224]  // #e0e0e0
  const ROWBORD= [240, 240, 240]  // #f0f0f0
  const TEXT   = [34,  34,  34]   // #222

  const fill = c => doc.setFillColor(...c)
  const draw = c => doc.setDrawColor(...c)
  const tc   = c => doc.setTextColor(...c)
  const lw   = w => doc.setLineWidth(w)
  const fnt  = (style, size) => { doc.setFont('helvetica', style); doc.setFontSize(size) }
  const txt  = (s, x, y, opts) => doc.text(String(s ?? ''), x, y, opts)
  const rect = (x, y, w, h, s) => doc.rect(x, y, w, h, s)
  const line = (x1, y1, x2, y2) => doc.line(x1, y1, x2, y2)

  let y = 18

  // ── HEADER (logo + bedrijfsnaam links, nummer/datum rechts, gouden lijn onder) ──
  const bedrijfsnaam = instellingen.bedrijfsnaam || 'JdB Dak- en Installatietechniek'
  const logo = await haalLogoBase64(instellingen.offerte_logo_url || instellingen.logo_url)

  let textX = ml
  let logoHoogte = 0
  const headerTopY = y
  if (logo) {
    try {
      // Behoud de beeldverhouding (zoals object-fit: contain) i.p.v. een vast vierkant te forceren
      const maxH = 18, maxW = 34
      const verhouding = (logo.width && logo.height) ? logo.width / logo.height : 1
      let logoH = maxH
      let logoW = logoH * verhouding
      if (logoW > maxW) { logoW = maxW; logoH = logoW / verhouding }
      doc.addImage(`data:${logo.mime};base64,${logo.base64}`, logo.format, ml, headerTopY, logoW, logoH, '', 'FAST')
      logoHoogte = logoH
      textX = ml + logoW + 6
    } catch {}
  }

  fnt('bold', 14); tc(DARK)
  txt(bedrijfsnaam, textX, headerTopY + 6)

  const sub = [
    instellingen.adres ? `${instellingen.adres}${(instellingen.postcode || instellingen.plaats) ? ', ' + [instellingen.postcode, instellingen.plaats].filter(Boolean).join(' ') : ''}` : null,
    instellingen.telefoon || null,
    instellingen.email || null,
  ].filter(Boolean)
  fnt('normal', 8); tc(GRAY)
  let subY = headerTopY + 11
  if (sub[0]) { txt(sub[0], textX, subY); subY += 4 }
  const subRest = [sub[1], sub[2]].filter(Boolean).join('  ·  ')
  if (subRest) { txt(subRest, textX, subY); subY += 4 }
  if (instellingen.website) { txt(instellingen.website, textX, subY); subY += 4 }

  const bedrijfsgegevens = [
    instellingen.kvk_nummer ? `KVK: ${instellingen.kvk_nummer}` : null,
    instellingen.btw_nummer ? `BTW: ${instellingen.btw_nummer}` : null,
    instellingen.iban ? `IBAN: ${instellingen.iban}` : null,
  ].filter(Boolean)
  if (bedrijfsgegevens.length) {
    fnt('normal', 7.5); tc(GRAY)
    txt(bedrijfsgegevens.join('  ·  '), textX, subY)
    subY += 4
  }

  // Nummers rechts uitgelijnd
  fnt('normal', 9); tc(TEXT)
  let numY = headerTopY + 5
  txt(`Offertenummer: ${offerte.nummer}`, W - mr, numY, { align: 'right' }); numY += 4.5
  txt(`Offerte datum: ${datumNL(offerte.datum)}`, W - mr, numY, { align: 'right' }); numY += 4.5
  if (offerte.geldig_tot) { txt(`Geldig tot: ${datumNL(offerte.geldig_tot)}`, W - mr, numY, { align: 'right' }); numY += 4.5 }
  if (offerte.naam) {
    fnt('bold', 9.5); tc(DARK)
    txt(offerte.naam, W - mr, numY + 1, { align: 'right' })
    numY += 5.5
  }

  const headerBottom = Math.max(subY, numY, headerTopY + (logoHoogte || 6)) + 5
  draw(GOLD); lw(0.7)
  line(ml, headerBottom, W - mr, headerBottom)
  y = headerBottom + 8

  // ── KLANTBLOK ───────────────────────────────────────────────────────
  const klantRegels = [
    offerte.klant_naam || '',
    offerte.klant_adres || null,
    (offerte.klant_postcode || offerte.klant_plaats) ? [offerte.klant_postcode, offerte.klant_plaats].filter(Boolean).join(' ') : null,
    offerte.klant_email || null,
  ].filter(Boolean)

  const klantH = 7 + (klantRegels.length - 1) * 4.6 + 6
  fill(LBG); draw(LBORDER); lw(0.25)
  doc.roundedRect(ml, y, cw, klantH, 1.5, 1.5, 'FD')

  fnt('bold', 10); tc(TEXT)
  txt(klantRegels[0], ml + 5, y + 7.5)
  fnt('normal', 8.5); tc(GRAY2)
  klantRegels.slice(1).forEach((r, i) => txt(r, ml + 5, y + 7.5 + (i + 1) * 4.6))

  y += klantH + 8

  // ── AANHEF + OFFERTETEKST (open brieftekst, zoals het echte sjabloon) ─
  fnt('normal', 9.5); tc(TEXT)
  txt(offerte.klant_naam ? `Geachte ${offerte.klant_naam},` : 'Geachte heer/mevrouw,', ml, y)
  y += 8

  if (offerte.tekst?.trim()) {
    const tekst = verwerkVariabelen(offerte.tekst, offerte)

    fnt('normal', 9.5); tc(TEXT)
    const lines = doc.splitTextToSize(tekst, cw)
    const regelH = 4.8   // mm per regel — komt overeen met line-height ~1.7 op 9.5pt tekst
    lines.forEach((regel, i) => txt(regel, ml, y + i * regelH))
    y += lines.length * regelH + 8
  }

  // ── MATERIAALTABEL ──────────────────────────────────────────────────
  const totalen = berekenTotalen(offerte)
  const mats = (offerte.materialen || []).filter(m => m.naam)
  if (offerte.materialen_tonen && mats.length > 0) {
    fnt('bold', 10); tc([68, 68, 68])
    txt('Specificatie materialen', ml, y)
    y += 6

    const rh = 7
    // Kolomposities (volgt th-uitlijning: omschrijving | aantal centered | eenheid | stukprijs right | totaal right)
    const c1 = ml + 2
    const c2 = ml + cw * 0.56
    const c3 = ml + cw * 0.66
    const c4 = ml + cw - 2 - 24
    const c5 = ml + cw - 2

    // Tabelkop — licht grijs, zoals origineel (geen donkere balk)
    fill(THBG)
    rect(ml, y, cw, rh, 'F')
    draw(THBORD); lw(0.4)
    line(ml, y + rh, ml + cw, y + rh)
    fnt('bold', 8); tc([102, 102, 102])
    txt('Omschrijving', c1, y + 4.7)
    txt('Aantal', c2, y + 4.7, { align: 'center' })
    txt('Eenheid', c3, y + 4.7)
    txt('Stukprijs', c4, y + 4.7, { align: 'right' })
    txt('Totaal', c5, y + 4.7, { align: 'right' })
    y += rh

    mats.forEach((m, i) => {
      fnt('normal', 8.5); tc(TEXT)
      const naam = doc.splitTextToSize(m.naam, c2 - c1 - 6)[0]
      txt(naam, c1, y + 4.7)
      txt(String(m.aantal ?? ''), c2, y + 4.7, { align: 'center' })
      txt(m.eenheid || 'stuk', c3, y + 4.7)
      txt(euro(m.stukprijs), c4, y + 4.7, { align: 'right' })
      txt(euro((parseFloat(m.aantal) || 0) * (parseFloat(m.stukprijs) || 0)), c5, y + 4.7, { align: 'right' })
      if (i < mats.length - 1) {
        draw(ROWBORD); lw(0.3)
        line(ml, y + rh, ml + cw, y + rh)
      }
      y += rh
    })
    y += 8
  }

  // ── TOTALEN (geen kader, eenvoudige regels met scheidingslijnen — zoals origineel) ──
  draw(THBORD); lw(0.6)
  line(ml, y, ml + cw, y)
  y += 7

  const totaalRows = [
    totalen.arbeidskosten > 0 ? [`Arbeid (${offerte.uren} uur × ${euro(offerte.uurtarief)})`, totalen.arbeidskosten] : null,
    totalen.subtotaalMat > 0 && totalen.arbeidskosten > 0 ? ['Materialen', totalen.subtotaalMat] : null,
    ['Subtotaal (excl. BTW)', totalen.subtotaal],
    [`BTW (${offerte.btw_percentage ?? 21}%)`, totalen.btw_bedrag],
  ].filter(Boolean)

  totaalRows.forEach(([label, val]) => {
    fnt('normal', 9); tc(GRAY2)
    txt(label, ml, y + 4)
    txt(euro(val), ml + cw, y + 4, { align: 'right' })
    y += 6.2
  })

  draw(THBORD); lw(0.4)
  line(ml, y + 1.5, ml + cw, y + 1.5)
  y += 8

  fnt('bold', 13); tc(DARK)
  txt('Totaal (incl. BTW)', ml, y)
  txt(euro(totalen.totaal), ml + cw, y, { align: 'right' })
  y += 10

  // ── NOTITIES ────────────────────────────────────────────────────────
  if (offerte.notities?.trim()) {
    draw(ROWBORD); lw(0.3)
    line(ml, y, ml + cw, y)
    y += 6
    fnt('bold', 8.5); tc([102, 102, 102])
    txt('Notities:', ml, y)
    fnt('normal', 8.5); tc(GRAY2)
    const notitieLines = doc.splitTextToSize(offerte.notities, cw - 22)
    doc.text(notitieLines, ml + 18, y)
    y += notitieLines.length * 4.4 + 6
  }

  // ── FOOTER (afsluittekst + ondertekening, zoals het echte sjabloon) ─
  let footerY = Math.max(y + 8, H - 56)
  fnt('normal', 9); tc(GRAY2)
  const afsluit = doc.splitTextToSize('Wij vertrouwen erop u hiermee een passend aanbod te hebben gedaan. Voor vragen kunt u contact met ons opnemen.', cw)
  doc.text(afsluit, ml, footerY)
  footerY += afsluit.length * 4.4 + 10

  // Twee kolommen: groet + ondertekenaar  |  handtekening voor akkoord
  const kolomW = cw / 2
  const kol2X = ml + kolomW + 6

  fnt('italic', 9); tc(GRAY2)
  txt('Met vriendelijke groet,', ml, footerY)
  txt('Handtekening voor akkoord:', kol2X, footerY)

  fnt('italic', 9); tc(TEXT)
  txt(instellingen.ondertekenaar || bedrijfsnaam, ml, footerY + 11)
  txt('Plaats: ……………………………………', kol2X, footerY + 11)

  if (instellingen.ondertekenaar) {
    txt(bedrijfsnaam, ml, footerY + 16)
    txt('Datum: ……………………………………', kol2X, footerY + 16)
  } else {
    txt('Datum: ……………………………………', kol2X, footerY + 16)
  }

  // ── PAGINAVOETER (bedrijfsnaam + website, klein, onderaan) ──────────
  draw(LBORDER); lw(0.3)
  line(ml, H - 14, W - mr, H - 14)
  fnt('normal', 7); tc(GRAY)
  const voet = [bedrijfsnaam, instellingen.website || instellingen.email].filter(Boolean).join('  ·  ')
  txt(voet, W / 2, H - 10, { align: 'center' })

  return doc.output('datauristring').split(',')[1]
}
