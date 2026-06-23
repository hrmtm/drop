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

const RING_R = 26
const RING_C = 32
const RING_CIRC = 2 * Math.PI * RING_R

function IconDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2v9M4 8l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 14h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

function IconX() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

function IconArrowUp() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <path d="M18 28V10M10 18l8-8 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconBlock() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 16h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
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
  const filledSlots = uploading ? files.length + 1 : files.length
  const ringOffset = RING_CIRC - (progress / 100) * RING_CIRC

  return (
    <main className="main">
      <header className="header">
        <div className="header-left">
          <span className="logo">drop.</span>
          <span className="tagline">schnelles file-sharing</span>
        </div>
        <div className="slots" aria-label={`${filledSlots} von ${MAX_FILES} Slots belegt`}>
          {Array.from({ length: MAX_FILES }, (_, i) => (
            <span
              key={i}
              className={[
                'slot',
                i < files.length ? 'filled' : '',
                uploading && i === files.length ? 'pulsing' : '',
              ].filter(Boolean).join(' ')}
            />
          ))}
        </div>
      </header>

      <div
        role="button"
        tabIndex={!uploading && !isFull ? 0 : -1}
        aria-label="Datei hochladen"
        className={[
          'dropzone',
          dragOver ? 'dragover' : '',
          uploading ? 'busy' : '',
          isFull && !uploading ? 'full' : '',
        ].filter(Boolean).join(' ')}
        onClick={() => !uploading && !isFull && inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); !uploading && !isFull && inputRef.current?.click() } }}
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
          <div className="upload-state">
            <div className="progress-ring">
              <svg width={RING_C * 2} height={RING_C * 2} viewBox={`0 0 ${RING_C * 2} ${RING_C * 2}`}>
                <circle className="progress-ring-track" cx={RING_C} cy={RING_C} r={RING_R} />
                <circle
                  className="progress-ring-fill"
                  cx={RING_C} cy={RING_C} r={RING_R}
                  strokeDasharray={RING_CIRC}
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <span className="progress-ring-pct">{progress}%</span>
            </div>
            <p className="progress-filename">{uploadName}</p>
          </div>
        ) : isFull ? (
          <div className="drop-content">
            <span className="drop-svg muted"><IconBlock /></span>
            <span className="drop-label">Speicher voll</span>
            <span className="drop-hint">Datei löschen, um Platz zu schaffen</span>
          </div>
        ) : (
          <div className="drop-content">
            <span className="drop-svg"><IconArrowUp /></span>
            <span className="drop-label">Datei hier ablegen</span>
            <span className="drop-hint">oder klicken zum Auswählen · max. 25 MB</span>
          </div>
        )}
      </div>

      {error && (
        <div className="error-banner" role="alert" onClick={() => setError(null)}>
          <span>{error}</span>
          <span className="error-close" aria-hidden="true">ESC</span>
        </div>
      )}

      {loading ? (
        <p className="state-msg">lädt…</p>
      ) : files.length === 0 ? (
        <p className="state-msg">noch keine dateien. leg eine ab.</p>
      ) : (
        <>
          <p className="section-label">dateien</p>
          <ul className="file-list" aria-label="Hochgeladene Dateien">
            {files.map((f) => {
              const ext = extOf(f.pathname)
              const isRemoving = removing === f.url
              return (
                <li key={f.url} className={`file-item${isRemoving ? ' removing' : ''}`}>
                  <div className="file-ext-col">
                    <span className="file-ext">{ext}</span>
                  </div>
                  <div className="file-info">
                    <span className="file-name" title={f.pathname}>{f.pathname}</span>
                    <span className="file-meta">
                      <span className="file-size-val">{fmtSize(f.size)}</span>
                      <span>{timeAgo(f.uploadedAt)}</span>
                    </span>
                  </div>
                  <div className="file-actions">
                    <a
                      className="btn"
                      href={f.url}
                      download
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${f.pathname} herunterladen`}
                    >
                      <IconDown />
                    </a>
                    <button
                      className="btn danger"
                      onClick={() => handleDelete(f.url)}
                      disabled={isRemoving}
                      aria-label={`${f.pathname} löschen`}
                    >
                      {isRemoving ? <span style={{ fontSize: '0.75rem' }}>…</span> : <IconX />}
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
