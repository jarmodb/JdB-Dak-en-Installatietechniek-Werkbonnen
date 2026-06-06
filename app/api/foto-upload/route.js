import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const maxDuration = 30

// Server-side route — gebruikt service role key die RLS bypast
export async function POST(request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY

    if (!url || !key) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_KEY is niet ingesteld op de server. Voeg deze toe in Vercel Environment Variables.' }, { status: 500 })
    }

    const supabaseAdmin = createClient(url, key)

    const formData = await request.formData()
    const bestand = formData.get('bestand')
    const pad = formData.get('pad')

    if (!bestand || !pad) {
      return NextResponse.json({ error: 'Bestand of pad ontbreekt' }, { status: 400 })
    }

    const buffer = Buffer.from(await bestand.arrayBuffer())

    const { error } = await supabaseAdmin.storage
      .from('werkbon-fotos')
      .upload(pad, buffer, {
        contentType: bestand.type || 'image/jpeg',
        upsert: true,
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('werkbon-fotos')
      .getPublicUrl(pad)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Onbekende fout' }, { status: 500 })
  }
}
