import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendToSubscriptions, pushConfigured } from '@/lib/push-server'

export const dynamic = 'force-dynamic'

// POST /api/push/test — send a notification to the caller's own devices.
// Rate-limited to once every 30s so it can't be used as a nuisance.
export async function POST(request: NextRequest) {
  if (!pushConfigured()) {
    return NextResponse.json({ error: 'Push is not configured on the server (VAPID keys missing).' }, { status: 503 })
  }

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: { user } } = await anon.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, last_sent_at')
    .eq('user_id', user.id)

  if (!subs?.length) {
    return NextResponse.json({ error: 'No device is subscribed yet.' }, { status: 400 })
  }

  const newest = subs.reduce((a: any, b: any) =>
    (a?.last_sent_at || '') > (b?.last_sent_at || '') ? a : b)
  if (newest?.last_sent_at && Date.now() - new Date(newest.last_sent_at).getTime() < 30_000) {
    return NextResponse.json({ error: 'Just a moment — try again in half a minute.' }, { status: 429 })
  }

  const result = await sendToSubscriptions(subs as any, {
    title: 'Green Emblem',
    body: 'Notifications are working. This is what a prayer alert will look like.',
    url: '/prayer',
    tag: 'ge-test',
    renotify: true,
  })

  await admin.from('push_subscriptions')
    .update({ last_sent_at: new Date().toISOString() })
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true, ...result })
}
