'use client'
import { createClient } from '@/lib/supabase/client'

// ── Client helpers for reading progress, stars and notes ─────────────────
// Every call fails soft and reports `available`. If the migration has not
// been run, or the reader is signed out, the features simply do not appear —
// the Quran itself never depends on any of this.

export type Progress = {
  available: boolean
  perSurah: Record<number, number>
  readInSurah: number[]   // exact ayat marked in the surah that was asked for
  versesRead: number
  totalVerses: number
  letters: number
  resume: { surah: number; ayah: number; at: string } | null
}

export type Bookmark = {
  surah: number
  ayah: number
  starred: boolean
  note: string | null
  updated_at?: string
}

export const EMPTY_PROGRESS: Progress = {
  available: false, perSurah: {}, readInSurah: [], versesRead: 0, totalVerses: 0, letters: 0, resume: null,
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
}

// Pass a surah to also get the exact ayat marked inside it, so the reader
// needs one request rather than one per verse.
export async function fetchProgress(surah?: number): Promise<Progress> {
  try {
    const headers = await authHeaders()
    if (!headers) return EMPTY_PROGRESS
    const qs = surah ? `?surah=${surah}` : ''
    const res = await fetch(`/api/quran/progress${qs}`, { headers })
    if (!res.ok) return EMPTY_PROGRESS
    const j = await res.json()
    if (!j.available) return EMPTY_PROGRESS
    return {
      available: true,
      perSurah: j.perSurah || {},
      readInSurah: j.readInSurah || [],
      versesRead: j.versesRead || 0,
      totalVerses: j.totalVerses || 0,
      letters: j.letters || 0,
      resume: j.resume || null,
    }
  } catch { return EMPTY_PROGRESS }
}

export async function markVerse(surah: number, ayah: number, read: boolean): Promise<boolean> {
  try {
    const headers = await authHeaders()
    if (!headers) return false
    const res = await fetch('/api/quran/progress', {
      method: read ? 'POST' : 'DELETE',
      headers,
      body: JSON.stringify({ surah, ayah }),
    })
    return res.ok
  } catch { return false }
}

export async function fetchBookmarks(): Promise<{ available: boolean; bookmarks: Bookmark[] }> {
  try {
    const headers = await authHeaders()
    if (!headers) return { available: false, bookmarks: [] }
    const res = await fetch('/api/quran/bookmarks', { headers })
    if (!res.ok) return { available: false, bookmarks: [] }
    const j = await res.json()
    return { available: !!j.available, bookmarks: j.bookmarks || [] }
  } catch { return { available: false, bookmarks: [] } }
}

export async function saveBookmark(
  surah: number, ayah: number, patch: { starred?: boolean; note?: string | null }
): Promise<Bookmark | null> {
  try {
    const headers = await authHeaders()
    if (!headers) return null
    const res = await fetch('/api/quran/bookmarks', {
      method: 'POST', headers, body: JSON.stringify({ surah, ayah, ...patch }),
    })
    if (!res.ok) return null
    const j = await res.json()
    return { surah, ayah, starred: !!j.starred, note: j.note ?? null }
  } catch { return null }
}
