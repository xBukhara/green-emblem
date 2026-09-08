'use client'
import { useEffect, useState } from 'react'
import { SURAHS } from '@/lib/quran'
import { PreviewStrip } from './PreviewStrip'

const PREF_KEY = 'ge_quran_prefs'

// Picks up where the reader left off, from the same key the reader writes.
export default function QuranPreview() {
  const [surah, setSurah] = useState<{ number: number; name: string } | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY)
      if (raw) {
        const p = JSON.parse(raw)
        const found = SURAHS.find(s => s.number === p?.surah)
        if (found && found.number !== 1) setSurah({ number: found.number, name: found.name })
      }
    } catch {}
    setReady(true)
  }, [])

  if (!ready) return <PreviewStrip label="THE QURAN" value="…" muted />

  return surah
    ? <PreviewStrip label="CONTINUE READING" value={`${surah.number}. ${surah.name}`} meta="Pick up where you left off" />
    : <PreviewStrip label="BEGIN WITH" value="1. Al-Fatihah" meta="The Opening · 7 verses" />
}
