import nodemailer from 'nodemailer'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { offerte, bericht, email, offerte_pdf_base64, av_pdf_base64 } = await request.json()

    const afzender = process.env.EMAIL_AFZENDER
    const wachtwoord = process.env.EMAIL_WACHTWOORD
    if (!afzender || !wachtwoord) return NextResponse.json({ error: 'E-mail configuratie ontbreekt' }, { status: 500 })

    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: afzender, pass: wachtwoord } })

    // Begeleidende e-mail — de volledige offerte zit als PDF bijlage
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff">
        <div style="background:#1a1a1a;padding:24px 32px;border-radius:10px 10px 0 0">
          <div style="color:#C9A227;font-size:22px;font-weight:bold">JdB Dak- en Installatietechniek</div>
          <div style="color:#999;font-size:13px;margin-top:4px">Offerte ${offerte.nummer}</div>
        </div>
        <div style="border:1px solid #e8e8e8;border-top:none;padding:32px;border-radius:0 0 10px 10px">
          <div style="margin-bottom:24px;font-size:14px;color:#333;line-height:1.7">
            ${bericht.split('\n').map(r => `<p style="margin:0 0 6px">${r || '&nbsp;'}</p>`).join('')}
          </div>
          <div style="background:#fafafa;border:1px solid #e8e8e8;border-left:3px solid #C9A227;border-radius:0 6px 6px 0;padding:14px 18px;font-size:13px;color:#555">
            📎 De offerte vindt u als PDF bijlage bij deze e-mail.${av_pdf_base64 ? '<br>📋 De algemene voorwaarden zijn eveneens bijgevoegd.' : ''}
          </div>
          <p style="font-size:12px;color:#aaa;margin-top:28px;border-top:1px solid #f0f0f0;padding-top:16px">
            Voor akkoord of vragen: <a href="mailto:jdbtechniek@gmail.com" style="color:#C9A227">jdbtechniek@gmail.com</a>
          </p>
        </div>
      </div>
    `

    const attachments = []

    if (offerte_pdf_base64) {
      attachments.push({
        filename: `Offerte ${offerte.nummer}.pdf`,
        content: Buffer.from(offerte_pdf_base64, 'base64'),
        contentType: 'application/pdf',
      })
    }

    if (av_pdf_base64) {
      attachments.push({
        filename: 'Algemene voorwaarden.pdf',
        content: Buffer.from(av_pdf_base64, 'base64'),
        contentType: 'application/pdf',
      })
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
