import nodemailer from 'nodemailer'
import { NextResponse } from 'next/server'

function euro(n) { return '€ ' + Number(n || 0).toFixed(2).replace('.', ',') }
function datumNL(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}` }

export async function POST(request) {
  try {
    const { offerte, bericht, email, totalen, verwerkteT, av_url } = await request.json()

    const afzender = process.env.EMAIL_AFZENDER
    const wachtwoord = process.env.EMAIL_WACHTWOORD
    if (!afzender || !wachtwoord) return NextResponse.json({ error: 'E-mail configuratie ontbreekt' }, { status: 500 })

    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: afzender, pass: wachtwoord } })

    const materiaalHtml = offerte.materialen_tonen && (offerte.materialen || []).some(m => m.naam)
      ? `<div style="margin:20px 0">
          <div style="font-weight:bold;font-size:14px;margin-bottom:8px;color:#333">Specificatie materialen</div>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#f5f5f5">
                <th style="text-align:left;padding:7px 10px;border-bottom:2px solid #e0e0e0;font-size:13px">Omschrijving</th>
                <th style="text-align:center;padding:7px 10px;border-bottom:2px solid #e0e0e0;font-size:13px">Aantal</th>
                <th style="padding:7px 10px;border-bottom:2px solid #e0e0e0;font-size:13px">Eenheid</th>
                <th style="text-align:right;padding:7px 10px;border-bottom:2px solid #e0e0e0;font-size:13px">Stukprijs</th>
                <th style="text-align:right;padding:7px 10px;border-bottom:2px solid #e0e0e0;font-size:13px">Totaal</th>
              </tr>
            </thead>
            <tbody>
              ${(offerte.materialen || []).filter(m => m.naam).map((m, i) => `
                <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
                  <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:13px">${m.naam}</td>
                  <td style="text-align:center;padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:13px">${m.aantal}</td>
                  <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:13px">${m.eenheid || 'stuk'}</td>
                  <td style="text-align:right;padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:13px">${euro(m.stukprijs)}</td>
                  <td style="text-align:right;padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:13px">${euro((parseFloat(m.aantal) || 0) * (parseFloat(m.stukprijs) || 0))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`
      : ''

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;background:#fff">
        <!-- Header -->
        <div style="background:#1a1a1a;padding:24px 32px;border-radius:10px 10px 0 0">
          <div style="color:#C9A227;font-size:22px;font-weight:bold">JdB Dak- en Installatietechniek</div>
          <div style="color:#888;font-size:13px;margin-top:4px">Offerte ${offerte.nummer}</div>
        </div>

        <!-- Body -->
        <div style="border:1px solid #e8e8e8;border-top:none;padding:32px;border-radius:0 0 10px 10px">

          <!-- Begeleidend bericht -->
          <div style="margin-bottom:24px">
            ${bericht.split('\n').map(r => `<p style="margin:0 0 8px;font-size:14px;color:#333">${r || '&nbsp;'}</p>`).join('')}
          </div>

          <hr style="border:none;border-top:1px solid #e8e8e8;margin:0 0 24px" />

          <!-- Klant + meta -->
          <div style="display:flex;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:16px">
            <div>
              <div style="font-weight:bold;font-size:16px;margin-bottom:4px">${offerte.klant_naam || ''}</div>
              ${offerte.klant_adres ? `<div style="color:#666;font-size:13px">${offerte.klant_adres}</div>` : ''}
              ${offerte.klant_postcode || offerte.klant_plaats ? `<div style="color:#666;font-size:13px">${[offerte.klant_postcode, offerte.klant_plaats].filter(Boolean).join(' ')}</div>` : ''}
            </div>
            <div style="font-size:13px;text-align:right">
              <div><strong>Nummer:</strong> ${offerte.nummer}</div>
              <div><strong>Datum:</strong> ${datumNL(offerte.datum)}</div>
              ${offerte.geldig_tot ? `<div><strong>Geldig tot:</strong> ${datumNL(offerte.geldig_tot)}</div>` : ''}
            </div>
          </div>

          <!-- Offertetekst -->
          ${verwerkteT ? `
            <div style="background:#fafafa;border:1px solid #e8e8e8;border-left:3px solid #C9A227;border-radius:0 6px 6px 0;padding:16px 20px;margin:20px 0;font-size:14px;line-height:1.7">
              ${verwerkteT.split('\n').map(r => `<p style="margin:0 0 5px">${r || '&nbsp;'}</p>`).join('')}
            </div>` : ''}

          <!-- Materialen tabel -->
          ${materiaalHtml}

          <!-- Totalen -->
          <div style="background:#fafafa;border:1px solid #e8e8e8;border-radius:8px;padding:16px 20px;margin-top:20px">
            ${totalen.arbeidskosten > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span>Arbeid (${offerte.uren} uur × ${euro(offerte.uurtarief)})</span><span>${euro(totalen.arbeidskosten)}</span></div>` : ''}
            ${totalen.subtotaalMat > 0 && totalen.arbeidskosten > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span>Materialen</span><span>${euro(totalen.subtotaalMat)}</span></div>` : ''}
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span>Subtotaal (excl. BTW)</span><span>${euro(totalen.subtotaal)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:10px"><span>BTW (${offerte.btw_percentage}%)</span><span>${euro(totalen.btw_bedrag)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:17px;font-weight:bold;border-top:2px solid #e0e0e0;padding-top:10px">
              <span>Totaal incl. BTW</span>
              <span style="color:#C9A227">${euro(totalen.totaal)}</span>
            </div>
          </div>

          <p style="font-size:12px;color:#aaa;margin-top:28px;border-top:1px solid #f0f0f0;padding-top:16px">
            Voor akkoord of vragen: <a href="mailto:jdbtechniek@gmail.com" style="color:#C9A227">jdbtechniek@gmail.com</a>
          </p>
        </div>
      </div>
    `

    // Algemene voorwaarden als bijlage ophalen
    const attachments = []
    if (av_url) {
      try {
        const avRes = await fetch(av_url)
        if (avRes.ok) {
          const buf = Buffer.from(await avRes.arrayBuffer())
          attachments.push({
            filename: 'Algemene voorwaarden.pdf',
            content: buf,
            contentType: 'application/pdf',
          })
        }
      } catch {}
    }

    await transporter.sendMail({
      from: `JdB Dak- en Installatietechniek <${afzender}>`,
      to: email,
      subject: `Offerte ${offerte.nummer} – JdB Dak- en Installatietechniek`,
      html,
      attachments,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Offerte e-mail mislukt:', err)
    return NextResponse.json({ error: err.message || 'Onbekende fout' }, { status: 500 })
  }
}
