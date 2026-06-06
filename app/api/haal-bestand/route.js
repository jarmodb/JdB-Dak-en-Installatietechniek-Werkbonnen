import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Server-side proxy: haalt een bestand op uit Supabase Storage via de service key
// zodat bucket-permissies of CORS geen probleem zijn.
export async function POST(request) {
  try {
    const { pad } = await request.json()
    if (!pad) return NextResponse.json({ error: 'pad ontbreekt' }, { status: 400 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY
    if (!url || !key) return NextResponse.json({ error: 'SUPABASE_SERVICE_KEY niet ingesteld' }, { status: 500 })

    const supabaseAdmin = createClient(url, key)
    const { data: blob, error } = await supabaseAdmin.storage.from('werkbon-fotos').download(pad)
    if (error || !blob) return NextResponse.json({ error: error?.message || 'Download mislukt' }, { status: 500 })

    const buf = Buffer.from(await blob.arrayBuffer())
    return NextResponse.json({ base64: buf.toString('base64') })
  } catch (err) {
    console.error('haal-bestand mislukt:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
