import { del } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(request: NextRequest) {
  const { url } = await request.json()

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'Ungültige URL.' }, { status: 400 })
  }

  await del(url)
  return NextResponse.json({ ok: true })
}
