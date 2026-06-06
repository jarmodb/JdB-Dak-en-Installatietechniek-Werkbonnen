import nodemailer from 'nodemailer'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { email, naam, werkbonNummer, klantNaam, klantAdres, omschrijving, token, origin } = await request.json()

    if (!email) return NextResponse.json({ error: 'Geen e-mailadres opgegeven' }, { status: 400 })

    const afzender = process.env.EMAIL_AFZENDER
    const wachtwoord = process.env.EMAIL_WACHTWOORD

    if (!afzender || !wachtwoord) {
      return NextResponse.json({ error: 'E-mail configuratie ontbreekt op de server.' }, { status: 500 })
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: afzender, pass: wachtwoord },
    })

    const link = `${origin}/planning/${token}`

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #fff; border: 1px solid #e8e8e8; border-radius: 10px; overflow: hidden;">
        <div style="background: #C9A227; padding: 20px 28px;">
          <div style="color: #fff; font-size: 18px; font-weight: bold;">JdB Techniek</div>
          <div style="color: #fff3cd; font-size: 13px; margin-top: 2px;">Werkbon toegewezen</div>
        </div>
        <div style="padding: 28px;">
          <p style="margin: 0 0 16px; font-size: 15px; color: #333;">Hoi <strong>${naam}</strong>,</p>
          <p style="margin: 0 0 20px; font-size: 15px; color: #333;">
            Er is een werkbon aan jou toegewezen:
          </p>
          <div style="background: #fafafa; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
            <div style="font-size: 13px; color: #888; margin-bottom: 4px;">Werkbonnummer</div>
            <div style="font-size: 16px; font-weight: bold; color: #C9A227; margin-bottom: 12px;">${werkbonNummer}</div>
            ${klantNaam ? `<div style="font-size: 13px; color: #888; margin-bottom: 4px;">Klant</div><div style="font-size: 14px; color: #333; margin-bottom: 12px;">${klantNaam}</div>` : ''}
            ${klantAdres ? `<div style="font-size: 13px; color: #888; margin-bottom: 4px;">Adres</div><div style="font-size: 14px; color: #333; margin-bottom: 12px;">${klantAdres}</div>` : ''}
            ${omschrijving ? `<div style="font-size: 13px; color: #888; margin-bottom: 4px;">Omschrijving</div><div style="font-size: 14px; color: #333;">${omschrijving}</div>` : ''}
          </div>
          <a href="${link}" style="display: inline-block; background: #C9A227; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 7px; font-size: 15px; font-weight: bold;">
            Bekijk werkbon →
          </a>
          <p style="margin: 24px 0 0; font-size: 12px; color: #aaa;">
            Je ontvangt dit bericht omdat Jordy je heeft toegewezen aan deze werkbon.<br>
            Om meldingen uit te zetten, neem contact op met Jordy.
          </p>
        </div>
      </div>
    `

    await transporter.sendMail({
      from: `JdB Techniek <${afzender}>`,
      to: email,
      subject: `Werkbon ${werkbonNummer} toegewezen${klantNaam ? ` – ${klantNaam}` : ''}`,
      html,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Melding sturen mislukt:', err)
    return NextResponse.json({ error: err.message || 'Onbekende fout' }, { status: 500 })
  }
}
