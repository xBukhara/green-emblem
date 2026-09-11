import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireMasjidMember } from '@/lib/portal'

export const dynamic = 'force-dynamic'

// Every handler re-checks that the post belongs to the caller's masjid —
// membership alone is not enough to touch an arbitrary post id.
async function ownPost(request: NextRequest, id: string) {
  const member = await requireMasjidMember(request)
  if (!member) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const db = createAdminClient()
  const { data: post } = await db.from('masjid_posts').select('*').eq('id', id).maybeSingle()
  if (!post) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  if (post.masjid_id !== member.masjidId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { member, post, db }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const r = await ownPost(request, params.id)
  if (r.error) return r.error

  const { data: attendees } = await r.db!
    .from('post_rsvps')
    .select('created_at, profiles:user_id(full_name, email)')
    .eq('post_id', params.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ post: r.post, attendees: attendees || [] })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const r = await ownPost(request, params.id)
  if (r.error) return r.error

  const b = await request.json().catch(() => ({}))
  const allowed = [
    'title', 'body', 'image_url', 'status', 'starts_at', 'ends_at', 'location',
    'rsvp_enabled', 'goal_amount', 'raised_amount', 'donate_url', 'deadline', 'schedule_text',
  ]
  const updates: Record<string, any> = {}
  for (const k of allowed) if (k in b) updates[k] = b[k]
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }
  // Moving a draft to published stamps the publish time once
  if (updates.status === 'published' && !r.post!.published_at) {
    updates.published_at = new Date().toISOString()
  }

  const { data, error } = await r.db!
    .from('masjid_posts').update(updates).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data })
}

// Archive rather than hard-delete, so RSVPs and history survive.
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const r = await ownPost(request, params.id)
  if (r.error) return r.error
  await r.db!.from('masjid_posts').update({ status: 'archived' }).eq('id', params.id)
  return NextResponse.json({ ok: true })
}
