import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingHiddenAt, MIGRATION_HINT } from '@/lib/greentv'

// GET /api/greentv-posts — public feed, most recent first.
// ?before= (ISO timestamp) for simple pagination.
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const before = searchParams.get('before')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

  // `hidden_at` is set by the admin console to pull a post from the app. It is
  // a soft hide on purpose: the Telegram webhook upserts on
  // telegram_message_id and also handles edited_channel_post, so a hard-
  // deleted row would reappear the moment that message is edited in the
  // channel. Keeping the row — with hidden_at set — is what makes the removal
  // stick, because an upsert does not touch columns it doesn't list.
  //
  // Rebuilt each call: a Supabase query builder cannot be reused once awaited.
  const base = () => {
    let q = supabase
      .from('greentv_posts')
      .select('*')
      .order('posted_at', { ascending: false })
      .limit(limit)
    if (before) q = q.lt('posted_at', before)
    return q
  }

  let { data, error } = await base().is('hidden_at', null)

  // If the migration has not run yet, serve the feed rather than nothing.
  // lib/greentv.ts explains why this fallback is safe and kept this narrow.
  if (error && isMissingHiddenAt(error)) {
    console.error(MIGRATION_HINT)
    ;({ data, error } = await base())
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data })
}
