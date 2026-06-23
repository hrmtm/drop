import { put, list } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

const MAX_FILES = 5
const MAX_BYTES = 25 * 1024 * 1024

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'Keine Datei angegeben.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Datei zu groß — max. 25 MB.' }, { status: 400 })
  }

  const { blobs } = await list()
  if (blobs.length >= MAX_FILES) {
    return NextResponse.json({ error: 'Speicher voll — max. 5 Dateien.' }, { status: 400 })
  }

  const blob = await put(file.name, file, {
    access: 'public',
    addRandomSuffix: false,
  })

  return NextResponse.json(blob)
}
