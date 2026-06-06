import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Geeft een signed upload URL terug — de client uploadt dan direct naar Supabase,
// zodat de foto Vercel's request-size limiet niet raakt.
export async function POST(request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY

    if (!url || !key) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_KEY is niet ingesteld op de server.' }, { status: 500 })
    }

    const supabaseAdmin = createClient(url, key)
    const { pad } = await request.json()

    if (!pad) {
      return NextResponse.json({ error: 'Pad ontbreekt' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.storage
      .from('werkbon-fotos')
      .createSignedUploadUrl(pad)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('werkbon-fotos')
      .getPublicUrl(pad)

    return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, publicUrl: urlData.publicUrl })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Onbekende fout' }, { status: 500 })
  }
}
