import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getVerseText, getTotalVerses } from '@/lib/quran-api'
import { countLetters, MAX_LETTERS_PER_VERSE } from '@/lib/hasanat'
import { isMissingSchema } from '@/lib/db-guards'

// ── Reading progress ─────────────────────────────────────────────────────
// GET    → everything the reader and the Reward Tracker need
// POST   → mark one verse read   { surah, ayah }
// DELETE → unmark one verse      { surah, ayah }
//
// A verse counts ONLY when the reader marks it. Nothing is banked by
// scrolling: the whole point of the letter count is that it corresponds to
// something someone actually read.
//
// Letters are counted HERE, from the Complex's own text, never taken from
// the request body. A counter the client can inflate is not worth showing.
//
// Every response carries `available`. When the migration has not been run
// the tables do not exist, and the UI hides the feature instead of throwing
// — see lib/db-guards.ts for why that fallback is safe and narrow.

function clientFor(token: string) {
  // The user's own token, so row-level security enforces ownership rather
  // than this file remembering to add `.eq('user_id', …)` every time.
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )
}

async function caller(request: NextRequest) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const sb = clientFor(token)
  const { data: { user } } = await sb.auth.getUser(token)
  if (!user) return null
  return { sb, userId: user.id }
}

function verseFrom(body: any): { surah: number; ayah: number } | null {
  const surah = Number(body?.surah)
  const ayah = Number(body?.ayah)
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) return null
  if (!Number.isInteger(ayah) || ayah < 1 || ayah > 286) return null // 2:286 is the longest surah
  return { surah, ayah }
}

export async function GET(request: NextRequest) {
  const who = await caller(request)
  if (!who) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: rows, error } = await who.sb
    .from('quran_read')
    .select('surah, ayah, letters')

  if (error) {
    if (isMissingSchema(error)) {
      return NextResponse.json({ available: false, reason: 'migration_pending' })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: last } = await who.sb
    .from('quran_read')
    .select('surah, ayah, read_at')
    .order('read_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Per-surah tallies, so the reader can draw one bar without asking again.
  // With ?surah=N it also gets the exact ayat marked in that surah, which is
  // what the per-verse tick needs — one request serves the whole screen.
  const wanted = Number(new URL(request.url).searchParams.get('surah'))
  const perSurah: Record<number, number> = {}
  const readInSurah: number[] = []
  let letters = 0
  for (const r of rows || []) {
    perSurah[r.surah] = (perSurah[r.surah] || 0) + 1
    letters += r.letters || 0
    if (r.surah === wanted) readInSurah.push(r.ayah)
  }
  readInSurah.sort((a, b) => a - b)

  let totalVerses = 0
  try { totalVerses = await getTotalVerses() } catch { totalVerses = 0 }

  return NextResponse.json({
    available: true,
    perSurah,
    readInSurah,
    versesRead: (rows || []).length,
    totalVerses,
    letters,
    resume: last ? { surah: last.surah, ayah: last.ayah, at: last.read_at } : null,
  })
}

export async function POST(request: NextRequest) {
  const who = await caller(request)
  if (!who) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const verse = verseFrom(await request.json().catch(() => ({})))
  if (!verse) return NextResponse.json({ error: 'Invalid verse' }, { status: 400 })

  // Count from the real text. If the verse cannot be fetched we refuse
  // rather than store a guess — a wrong letter count is worse than none.
  let letters: number
  try {
    letters = Math.min(countLetters(await getVerseText(verse.surah, verse.ayah)), MAX_LETTERS_PER_VERSE)
  } catch {
    return NextResponse.json({ error: 'Could not read that verse just now' }, { status: 502 })
  }

  const { error } = await who.sb
    .from('quran_read')
    .upsert(
      { user_id: who.userId, surah: verse.surah, ayah: verse.ayah, letters, read_at: new Date().toISOString() },
      { onConflict: 'user_id,surah,ayah' }
    )

  if (error) {
    if (isMissingSchema(error)) return NextResponse.json({ available: false, reason: 'migration_pending' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ marked: true, letters })
}

export async function DELETE(request: NextRequest) {
  const who = await caller(request)
  if (!who) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const verse = verseFrom(await request.json().catch(() => ({})))
  if (!verse) return NextResponse.json({ error: 'Invalid verse' }, { status: 400 })

  const { error } = await who.sb
    .from('quran_read')
    .delete()
    .eq('surah', verse.surah)
    .eq('ayah', verse.ayah)

  if (error) {
    if (isMissingSchema(error)) return NextResponse.json({ available: false, reason: 'migration_pending' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ marked: false })
}
