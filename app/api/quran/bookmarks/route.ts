import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { isMissingSchema } from '@/lib/db-guards'

// ── Stars and notes ──────────────────────────────────────────────────────
// GET    → every bookmark this reader has, newest first
// POST   → set a star and/or a note on one verse { surah, ayah, starred?, note? }
// DELETE → clear a verse entirely { surah, ayah }
//
// One row per verse carries both the star and the note, because the slide-out
// strip offers both on the same verse. A row with neither is litter, so when
// a change would leave it empty the row is deleted instead — the table has a
// CHECK that refuses the empty state either way.
//
// Notes are private. RLS is enforced by using the reader's own token rather
// than the service role.

const NOTE_MAX = 2000

function clientFor(token: string) {
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
  if (!Number.isInteger(ayah) || ayah < 1 || ayah > 286) return null
  return { surah, ayah }
}

export async function GET(request: NextRequest) {
  const who = await caller(request)
  if (!who) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data, error } = await who.sb
    .from('quran_bookmarks')
    .select('surah, ayah, starred, note, updated_at')
    .order('updated_at', { ascending: false })

  if (error) {
    if (isMissingSchema(error)) return NextResponse.json({ available: false, reason: 'migration_pending' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ available: true, bookmarks: data || [] })
}

export async function POST(request: NextRequest) {
  const who = await caller(request)
  if (!who) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const verse = verseFrom(body)
  if (!verse) return NextResponse.json({ error: 'Invalid verse' }, { status: 400 })

  // Read the current row so a star change does not wipe a note, and a note
  // change does not clear a star.
  const { data: existing, error: readErr } = await who.sb
    .from('quran_bookmarks')
    .select('starred, note')
    .eq('surah', verse.surah)
    .eq('ayah', verse.ayah)
    .maybeSingle()

  if (readErr && isMissingSchema(readErr)) {
    return NextResponse.json({ available: false, reason: 'migration_pending' })
  }

  const starred = typeof body.starred === 'boolean' ? body.starred : (existing?.starred ?? false)
  const rawNote = body.note === undefined ? (existing?.note ?? null) : body.note
  const note = typeof rawNote === 'string' && rawNote.trim() ? rawNote.trim().slice(0, NOTE_MAX) : null

  // Nothing left to keep — remove the row rather than store an empty one.
  if (!starred && !note) {
    const { error } = await who.sb
      .from('quran_bookmarks')
      .delete()
      .eq('surah', verse.surah)
      .eq('ayah', verse.ayah)
    if (error && !isMissingSchema(error)) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ starred: false, note: null, cleared: true })
  }

  const { error } = await who.sb
    .from('quran_bookmarks')
    .upsert(
      {
        user_id: who.userId,
        surah: verse.surah,
        ayah: verse.ayah,
        starred,
        note,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,surah,ayah' }
    )

  if (error) {
    if (isMissingSchema(error)) return NextResponse.json({ available: false, reason: 'migration_pending' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ starred, note })
}

export async function DELETE(request: NextRequest) {
  const who = await caller(request)
  if (!who) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const verse = verseFrom(await request.json().catch(() => ({})))
  if (!verse) return NextResponse.json({ error: 'Invalid verse' }, { status: 400 })

  const { error } = await who.sb
    .from('quran_bookmarks')
    .delete()
    .eq('surah', verse.surah)
    .eq('ayah', verse.ayah)

  if (error) {
    if (isMissingSchema(error)) return NextResponse.json({ available: false, reason: 'migration_pending' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ cleared: true })
}
