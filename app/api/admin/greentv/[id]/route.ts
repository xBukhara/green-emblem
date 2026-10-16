import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isPlatformAdmin } from '@/lib/portal'

// ── Moderating Telegram-fed GreenTV posts ────────────────────────────────
// DELETE /api/admin/greentv/[id]           → remove from the app (reversible)
// DELETE /api/admin/greentv/[id]?purge=1   → delete the row outright
// PATCH  /api/admin/greentv/[id]           → put it back
//
// WHY REMOVE IS A FLAG AND NOT A DELETE
// The Telegram webhook does:
//
//   upsert({ telegram_message_id, text, image_url, posted_at },
//          { onConflict: 'telegram_message_id' })
//
// and it runs for `edited_channel_post` as well as new posts. So a row that
// is hard-deleted here comes straight back, visible, the next time anyone
// edits that message in the channel — and the person who removed it would
// have no idea why.
//
// Setting `hidden_at` survives that, because an upsert only writes the
// columns it lists: hidden_at is left alone on conflict. The row is the
// record of the decision, which is exactly what makes the removal stick.
//
// Purge is offered because sometimes the content itself should not sit in the
// database. It is only safe once the message is gone from Telegram too —
// otherwise an edit resurrects it with no hidden_at to suppress it. The UI
// says so at the point of clicking.
//
// Note on scope: hiding is editorial, not access control. Anyone reading the
// table directly can still see a hidden row; the three app read paths filter
// it. If something must truly be gone, delete it in Telegram and then purge.

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const adminUserId = await isPlatformAdmin(request)
  if (!adminUserId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const purge = new URL(request.url).searchParams.get('purge') === '1'
  const admin = createAdminClient()

  if (purge) {
    const { error } = await admin.from('greentv_posts').delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ purged: true })
  }

  const hidden_at = new Date().toISOString()
  const { data, error } = await admin
    .from('greentv_posts')
    .update({ hidden_at, hidden_by: adminUserId })
    .eq('id', params.id)
    .select('id, hidden_at')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  return NextResponse.json({ hidden_at: data.hidden_at })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const adminUserId = await isPlatformAdmin(request)
  if (!adminUserId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('greentv_posts')
    .update({ hidden_at: null, hidden_by: null })
    .eq('id', params.id)
    .select('id, hidden_at')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  return NextResponse.json({ hidden_at: null })
}
