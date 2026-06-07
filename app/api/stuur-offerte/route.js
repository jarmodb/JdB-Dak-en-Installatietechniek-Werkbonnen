import nodemailer from 'nodemailer'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const { offerte, bericht, email, offerte_pdf_base64, av_pad, kopie_naar_afzender } = await request.json()

    const afzender = process.env.EMAIL_AFZENDER
    const wachtwoord = process.env.EMAIL_WACHTWOORD
    if (!afzender || !wachtwoord) return NextResponse.json({ error: 'E-mail configuratie ontbreekt' }, { status: 500 })

    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: afzender, pass: wachtwoord } })

    // Begeleidende e-mail — de volledige offerte zit als PDF bijlage
    // Let op: volledig HTML-document met expliciete color-scheme = light, anders
    // passen Gmail/Outlook/Apple Mail "donkere modus" toe en wordt de opmaak onleesbaar
    // (lichte vlakken worden donker gemaakt zonder de tekstkleuren aan te passen).
    const html = `<!DOCTYPE html>
<html lang="nl" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>Offerte ${offerte.nummer}</title>
<style>
  :root { color-scheme: light only; supported-color-schemes: light only; }
  body { margin:0; padding:0; background:#f4f4f4 !important; }
  [data-ogsc] body, [data-ogsc] .jdb-card, [data-ogsc] .jdb-vlak { background:#ffffff !important; }
  [data-ogsc] .jdb-header { background:#1a1a1a !important; }
  [data-ogsc] .jdb-info { background:#fafafa !important; color:#555 !important; }
  [data-ogsc] p, [data-ogsc] div, [data-ogsc] span { color: inherit; }
</style>
</head>
<body style="margin:0;padding:24px 12px;background:#f4f4f4;background-color:#f4f4f4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;background-color:#f4f4f4;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="jdb-card" bgcolor="#ffffff" style="max-width:600px;width:100%;background:#ffffff;background-color:#ffffff;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
          <tr>
            <td class="jdb-header" bgcolor="#1a1a1a" style="background:#1a1a1a;background-color:#1a1a1a;padding:24px 32px;">
              <div style="color:#C9A227;font-size:22px;font-weight:bold;">JdB Dak- en Installatietechniek</div>
              <div style="color:#999999;font-size:13px;margin-top:4px;">Offerte ${offerte.nummer}</div>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background:#ffffff;background-color:#ffffff;border:1px solid #e8e8e8;border-top:none;padding:32px;">
              <div style="margin-bottom:24px;font-size:14px;color:#333333;line-height:1.7;">
                ${bericht.split('\n').map(r => `<p style="margin:0 0 6px;color:#333333;">${r || '&nbsp;'}</p>`).join('')}
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="jdb-info" bgcolor="#fafafa" style="background:#fafafa;background-color:#fafafa;border:1px solid #e8e8e8;border-left:3px solid #C9A227;border-radius:0 6px 6px 0;">
                <tr>
                  <td style="padding:14px 18px;font-size:13px;color:#555555;">
                    📎 De offerte vindt u als PDF bijlage bij deze e-mail.${av_pad ? '<br>📋 De algemene voorwaarden zijn eveneens bijgevoegd.' : ''}
                  </td>
                </tr>
              </table>
              <p style="font-size:12px;color:#aaaaaa;margin-top:28px;border-top:1px solid #f0f0f0;padding-top:16px;">
                Voor akkoord of vragen: <a href="mailto:jdbtechniek@gmail.com" style="color:#C9A227;">jdbtechniek@gmail.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    const attachments = []

    if (offerte_pdf_base64) {
      attachments.push({
        filename: `Offerte ${offerte.nummer}.pdf`,
        content: Buffer.from(offerte_pdf_base64, 'base64'),
        contentType: 'application/pdf',
      })
    }

    // AV PDF server-side ophalen via service key (geen grote base64 in de request)
    if (av_pad) {
      try {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_KEY
        )
        const { data: blob, error } = await supabaseAdmin.storage.from('werkbon-fotos').download(av_pad)
        if (!error && blob) {
          attachments.push({
            filename: 'Algemene voorwaarden.pdf',
            content: Buffer.from(await blob.arrayBuffer()),
            contentType: 'application/pdf',
          })
        } else {
          console.warn('AV PDF download mislukt:', error?.message)
        }
      } catch (e) {
        console.warn('AV PDF fout:', e.message)
      }
    }

    await transporter.sendMail({
      from: `JdB Dak- en Installatietechniek <${afzender}>`,
      to: email,
      ...(kopie_naar_afzender ? { cc: afzender } : {}),
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
