import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── RSVP: "Going" only, by design ────────────────────────────────────────
// There is no "not going" state anywhere in this API. Withdrawing deletes
// the row; non-attendance is never recorded or counted. Toggling off is
// necessary — without it headcounts inflate and stop being useful to the
// masjid — but it is not the same as a skip button.

async function caller(request: NextRequest) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: { user } } = await anon.auth.getUser(token)
  return user
}

// GET — public count, plus whether the caller is going
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const pub = createPublicClient()
  const { data: count } = await pub.rpc('post_rsvp_count', { p_post: params.id })

  let going = false
  const user = await caller(request)
  if (user) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('post_rsvps').select('post_id')
      .eq('post_id', params.id).eq('user_id', user.id).maybeSingle()
    going = !!data
  }
  return NextResponse.json({ count: count ?? 0, going })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await caller(request)
  if (!user) return NextResponse.json({ error: 'Please sign in to RSVP.' }, { status: 401 })

  const admin = createAdminClient()
  const { data: post } = await admin
    .from('masjid_posts').select('id, rsvp_enabled, status').eq('id', params.id).maybeSingle()
  if (!post || post.status !== 'published') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!post.rsvp_enabled) return NextResponse.json({ error: 'RSVP is closed for this post.' }, { status: 400 })

  await admin.from('post_rsvps').upsert(
    { post_id: params.id, user_id: user.id }, { onConflict: 'post_id,user_id' }
  )
  const { data: count } = await admin.rpc('post_rsvp_count', { p_post: params.id })
  return NextResponse.json({ going: true, count: count ?? 0 })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await caller(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  await admin.from('post_rsvps').delete().eq('post_id', params.id).eq('user_id', user.id)
  const { data: count } = await admin.rpc('post_rsvp_count', { p_post: params.id })
  return NextResponse.json({ going: false, count: count ?? 0 })
}
