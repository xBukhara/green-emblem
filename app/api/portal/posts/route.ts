import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireMasjidMember } from '@/lib/portal'
import { sendToSubscriptions, getSubscriptionsForUsers } from '@/lib/push-server'

export const dynamic = 'force-dynamic'

const TYPES = new Set(['event', 'fundraiser', 'program', 'youth'])

// GET /api/portal/posts — this masjid's posts, newest first
export async function GET(request: NextRequest) {
  const member = await requireMasjidMember(request)
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('masjid_posts')
    .select('*')
    .eq('masjid_id', member.masjidId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach RSVP counts without exposing the roster
  const ids = (data || []).map(p => p.id)
  let counts: Record<string, number> = {}
  if (ids.length) {
    const { data: rows } = await db.rpc('posts_rsvp_counts', { p_posts: ids })
    counts = Object.fromEntries((rows || []).map((r: any) => [r.post_id, r.going]))
  }

  return NextResponse.json({
    posts: (data || []).map(p => ({ ...p, going: counts[p.id] || 0 })),
    masjid: { id: member.masjidId, name: member.masjidName },
  })
}

// POST /api/portal/posts — create. Published immediately (invited masjids
// are already vetted), and followers are pushed straight away.
export async function POST(request: NextRequest) {
  const member = await requireMasjidMember(request)
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const b = await request.json().catch(() => ({}))
  if (!TYPES.has(b.type)) return NextResponse.json({ error: 'Unknown post type' }, { status: 400 })
  if (!b.title?.trim()) return NextResponse.json({ error: 'A title is required' }, { status: 400 })

  if ((b.type === 'event' || b.type === 'youth') && !b.starts_at) {
    return NextResponse.json({ error: 'Events need a start date and time' }, { status: 400 })
  }
  if (b.type === 'fundraiser' && b.donate_url && !/^https?:\/\//i.test(b.donate_url)) {
    return NextResponse.json({ error: 'The donation link must start with http:// or https://' }, { status: 400 })
  }

  const status = b.status === 'draft' ? 'draft' : 'published'
  const row = {
    masjid_id: member.masjidId,
    type: b.type,
    title: String(b.title).slice(0, 200),
    body: b.body ? String(b.body).slice(0, 5000) : null,
    image_url: b.image_url || null,
    status,
    published_at: status === 'published' ? new Date().toISOString() : null,
    starts_at: b.starts_at || null,
    ends_at: b.ends_at || null,
    location: b.location || null,
    rsvp_enabled: b.rsvp_enabled !== false,
    goal_amount: b.goal_amount ?? null,
    raised_amount: b.raised_amount ?? 0,
    donate_url: b.donate_url || null,
    deadline: b.deadline || null,
    schedule_text: b.schedule_text || null,
    created_by: member.userId,
  }

  const db = createAdminClient()
  const { data: post, error } = await db.from('masjid_posts').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Push to followers — best effort, never blocks the response.
  if (status === 'published') {
    ;(async () => {
      try {
        const { data: followers } = await db
          .from('profiles').select('id').eq('followed_masjid_id', member.masjidId)
        const subs = await getSubscriptionsForUsers(
          (followers || []).map((f: any) => f.id), 'notify_masjid_events'
        )
        if (!subs.length) return
        const when = post.starts_at
          ? new Date(post.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          : null
        await sendToSubscriptions(subs, {
          title: member.masjidName,
          body: when ? `${post.title} · ${when}` : post.title,
          url: `/greenworld-plus?post=${post.id}`,
          tag: `ge-post-${post.id}`,
          renotify: true,
        })
      } catch (e) {
        console.warn('[portal] push failed', e)
      }
    })()
  }

  return NextResponse.json({ post }, { status: 201 })
}
