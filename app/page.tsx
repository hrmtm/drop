'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface BlobFile {
  url: string
  pathname: string
  size: number
  uploadedAt: string
}

const MAX_FILES = 5
const MAX_BYTES = 25 * 1024 * 1024

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'gerade eben'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function extOf(pathname: string) {
  return (pathname.split('.').pop() ?? 'file').toUpperCase().slice(0, 6)
}

const EXT_COLORS: Record<string, string> = {
  PDF: '#DC2626', JPG: '#7C3AED', JPEG: '#7C3AED', PNG: '#7C3AED',
  GIF: '#0891B2', SVG: '#059669', WEBP: '#7C3AED', MP4: '#2563EB',
  MOV: '#2563EB', MKV: '#2563EB', MP3: '#D97706', WAV: '#D97706',
  FLAC: '#D97706', ZIP: '#4B5563', RAR: '#4B5563', '7Z': '#4B5563',
  TAR: '#4B5563', JS: '#F59E0B', TS: '#2563EB', PY: '#059669',
  RS: '#D97706', GO: '#0891B2', CSV: '#059669', XLSX: '#059669',
  DOCX: '#2563EB', PPTX: '#D97706', JSON: '#F59E0B', MD: '#6B7280',
  TXT: '#6B7280', HTML: '#DC2626', CSS: '#7C3AED',
}

export default function Page() {
  const [files, setFiles] = useState<BlobFile[]>([])
  const [loading, setLoading] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadName, setUploadName] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/files')
      const data = await res.json()
      setFiles(Array.isArray(data) ? data : [])
    } catch {
      setError('Dateien konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const upload = useCallback((file: File) => {
    setError(null)
    if (file.size > MAX_BYTES) {
      setError(`„${file.name}" ist zu groß — max. 25 MB pro Datei.`)
      return
    }
    if (files.length >= MAX_FILES) {
      setError('Speicher voll — bitte zuerst eine Datei löschen.')
      return
    }

    setUploading(true)
    setProgress(0)
    setUploadName(file.name)

    const form = new FormData()
    form.append('file', file)

    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        refresh()
      } else {
        try {
          setError(JSON.parse(xhr.responseText).error ?? 'Upload fehlgeschlagen.')
        } catch {
          setError('Upload fehlgeschlagen.')
        }
      }
      setUploading(false)
      setProgress(0)
      setUploadName('')
    })
    xhr.addEventListener('error', () => {
      setError('Upload fehlgeschlagen — Verbindung prüfen.')
      setUploading(false)
      setProgress(0)
      setUploadName('')
    })
    xhr.open('POST', '/api/upload')
    xhr.send(form)
  }, [files.length, refresh])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }, [upload])

  const handleDelete = useCallback(async (url: string) => {
    setRemoving(url)
    try {
      await fetch('/api/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      await refresh()
    } catch {
      setError('Löschen fehlgeschlagen.')
    } finally {
      setRemoving(null)
    }
  }, [refresh])

  const isFull = files.length >= MAX_FILES
  const capacityPct = Math.min(100, (files.length / MAX_FILES) * 100)
  const displayPct = uploading
    ? Math.min(100, capacityPct + (progress / 100) * (100 / MAX_FILES))
    : capacityPct

  return (
    <main className="main">
      <header className="header">
        <span className="logo">drop.</span>
        <span className="tagline">schnelles file-sharing</span>
      </header>

      <div className="capacity">
        <div className="capacity-track">
          <div
            className={`capacity-fill${uploading ? ' uploading' : ''}`}
            style={{ width: `${displayPct}%` }}
          />
        </div>
        <div className="capacity-row">
          <span className="capacity-count">
            {uploading ? files.length + 1 : files.length}/{MAX_FILES} Dateien
          </span>
          <span className="capacity-limit">max 5 × 25 MB</span>
        </div>
      </div>

      <div
        className={[
          'dropzone',
          dragOver ? 'dragover' : '',
          uploading ? 'busy' : '',
          isFull && !uploading ? 'full' : '',
        ].filter(Boolean).join(' ')}
        onClick={() => !uploading && !isFull && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!uploading && !isFull) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }}
        />

        {uploading ? (
          <div className="upload-progress">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="progress-filename">{uploadName}</p>
            <p className="progress-pct">{progress}%</p>
          </div>
        ) : isFull ? (
          <div className="drop-content">
            <span className="drop-icon muted">■</span>
            <span className="drop-label">Speicher voll</span>
            <span className="drop-hint">Datei löschen, um Platz zu schaffen</span>
          </div>
        ) : (
          <div className="drop-content">
            <span className="drop-icon">+</span>
            <span className="drop-label">Datei hier ablegen</span>
            <span className="drop-hint">oder klicken zum Auswählen · max. 25 MB</span>
          </div>
        )}
      </div>

      {error && (
        <div className="error-banner" onClick={() => setError(null)}>
          <span>{error}</span>
          <span className="error-close">✕</span>
        </div>
      )}

      {loading ? (
        <p className="state-msg">Lädt…</p>
      ) : files.length === 0 ? (
        <p className="state-msg">Noch keine Dateien — lade eine hoch.</p>
      ) : (
        <>
          <p className="list-label">Dateien</p>
          <ul className="file-list">
            {files.map((f) => {
              const ext = extOf(f.pathname)
              const color = EXT_COLORS[ext] ?? '#6B7280'
              const isRemoving = removing === f.url
              return (
                <li key={f.url} className={`file-item${isRemoving ? ' removing' : ''}`}>
                  <span className="file-badge" style={{ background: color }}>
                    {ext}
                  </span>
                  <span className="file-name" title={f.pathname}>
                    {f.pathname}
                  </span>
                  <span className="file-size">{fmtSize(f.size)}</span>
                  <span className="file-age">{timeAgo(f.uploadedAt)}</span>
                  <div className="file-actions">
                    <a
                      className="btn"
                      href={f.url}
                      download
                      target="_blank"
                      rel="noreferrer"
                      title="Herunterladen"
                    >
                      ↓
                    </a>
                    <button
                      className="btn danger"
                      onClick={() => handleDelete(f.url)}
                      disabled={isRemoving}
                      title="Löschen"
                    >
                      {isRemoving ? '…' : '✕'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <footer className="footer">
        öffentlich · kein login · kein tracking
      </footer>
    </main>
  )
}
