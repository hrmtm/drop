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

function extOf(p: string) {
  return (p.split('.').pop() ?? 'file').toUpperCase().slice(0, 6)
}

export default function Page() {
  const [files, setFiles]       = useState<BlobFile[]>([])
  const [loading, setLoading]   = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadName, setUploadName] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await fetch('/api/files').then(r => r.json())
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
    if (file.size > MAX_BYTES) { setError(`„${file.name}" ist zu groß — max. 25 MB.`); return }
    if (files.length >= MAX_FILES) { setError('Speicher voll — zuerst eine Datei löschen.'); return }

    setUploading(true)
    setProgress(0)
    setUploadName(file.name)

    const form = new FormData()
    form.append('file', file)
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100))
    })
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        refresh()
      } else {
        try { setError(JSON.parse(xhr.responseText).error ?? 'Upload fehlgeschlagen.') }
        catch { setError('Upload fehlgeschlagen.') }
      }
      setUploading(false); setProgress(0); setUploadName('')
    })
    xhr.addEventListener('error', () => {
      setError('Upload fehlgeschlagen — Verbindung prüfen.')
      setUploading(false); setProgress(0); setUploadName('')
    })
    xhr.open('POST', '/api/upload')
    xhr.send(form)
  }, [files.length, refresh])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }, [upload])

  const handleDelete = useCallback(async (url: string) => {
    setRemoving(url)
    try {
      await fetch('/api/delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
      await refresh()
    } catch { setError('Löschen fehlgeschlagen.') }
    finally { setRemoving(null) }
  }, [refresh])

  const isFull = files.length >= MAX_FILES

  return (
    <main className="main">
      <header className="header">
        <span className="logo">drop.</span>
        <div className="slots" aria-label={`${files.length} von ${MAX_FILES} Slots belegt`}>
          {Array.from({ length: MAX_FILES }, (_, i) => (
            <span key={i} className={[
              'slot',
              i < files.length ? 'filled' : '',
              uploading && i === files.length ? 'pulsing' : '',
            ].filter(Boolean).join(' ')} />
          ))}
        </div>
      </header>

      <div
        role="button"
        tabIndex={!uploading && !isFull ? 0 : -1}
        aria-label="Datei hochladen"
        className={['dropzone', dragOver && 'dragover', uploading && 'busy', isFull && !uploading && 'full'].filter(Boolean).join(' ')}
        onClick={() => !uploading && !isFull && inputRef.current?.click()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); !uploading && !isFull && inputRef.current?.click() } }}
        onDragOver={e => { e.preventDefault(); if (!uploading && !isFull) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input ref={inputRef} type="file" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />

        {uploading ? (
          <div className="upload-state">
            <p className="progress-pct">{progress}%</p>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="progress-filename">{uploadName}</p>
          </div>
        ) : isFull ? (
          <div className="drop-content">
            <span className="drop-label">Speicher voll</span>
            <span className="drop-hint">Datei löschen, um Platz zu schaffen</span>
          </div>
        ) : (
          <div className="drop-content">
            <span className="drop-label">Datei hier ablegen</span>
            <span className="drop-hint">oder klicken · max. 25 MB</span>
          </div>
        )}
      </div>

      {error && (
        <div className="error-banner" role="alert" onClick={() => setError(null)}>
          <span>{error}</span>
          <span className="error-close">schließen</span>
        </div>
      )}

      {loading ? (
        <p className="state-msg">lädt…</p>
      ) : files.length === 0 ? (
        <p className="state-msg">keine dateien</p>
      ) : (
        <>
          <p className="section-label">dateien</p>
          <ul className="file-list">
            {files.map(f => {
              const isRemoving = removing === f.url
              return (
                <li key={f.url} className={`file-item${isRemoving ? ' removing' : ''}`}>
                  <div className="file-info">
                    <span className="file-name" title={f.pathname}>{f.pathname}</span>
                    <span className="file-meta">
                      <span>{extOf(f.pathname)}</span>
                      <span>{fmtSize(f.size)}</span>
                      <span>{timeAgo(f.uploadedAt)}</span>
                    </span>
                  </div>
                  <div className="file-actions">
                    <a className="btn" href={f.url} download target="_blank" rel="noreferrer" aria-label={`${f.pathname} herunterladen`}>↓</a>
                    <button className="btn" onClick={() => handleDelete(f.url)} disabled={isRemoving} aria-label={`${f.pathname} löschen`}>
                      {isRemoving ? '…' : '✕'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <footer className="footer">öffentlich · kein login · kein tracking</footer>
    </main>
  )
}
