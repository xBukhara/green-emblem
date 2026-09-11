import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function admin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function userFrom(request: NextRequest) {
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

// Coordinates are stored at 2dp (~1.1 km) — accurate enough for prayer
// times, deliberately too coarse to pin down a home.
const coarse = (n: unknown) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : null

// POST /api/push/subscribe — save or refresh this device's subscription
export async function POST(request: NextRequest) {
  const user = await userFrom(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const sub = body.subscription
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  const db = admin()

  // A rotated subscription replaces the old row rather than leaving a
  // dead endpoint behind that will 410 forever.
  if (body.rotatedFrom && body.rotatedFrom !== sub.endpoint) {
    await db.from('push_subscriptions').delete().eq('endpoint', body.rotatedFrom)
  }

  const row: Record<string, any> = {
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    user_agent: (request.headers.get('user-agent') || '').slice(0, 300),
    last_seen_at: new Date().toISOString(),
    failure_count: 0,
  }
  if (body.lat != null) row.lat = coarse(body.lat)
  if (body.lng != null) row.lng = coarse(body.lng)
  if (body.timezone) row.timezone = String(body.timezone).slice(0, 64)
  if (body.calcMethod) row.calc_method = String(body.calcMethod).slice(0, 40)
  if (body.madhab) row.madhab = body.madhab === 'hanafi' ? 'hanafi' : 'shafi'
  for (const key of ['notify_prayer_daily', 'notify_prayer_each', 'notify_masjid_events']) {
    if (key in body) row[key] = !!body[key]
  }

  const { data, error } = await db
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'endpoint' })
    .select('notify_prayer_daily, notify_prayer_each, notify_masjid_events')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, preferences: data })
}

// GET /api/push/subscribe?endpoint=… — current state for this device
export async function GET(request: NextRequest) {
  const user = await userFrom(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const endpoint = request.nextUrl.searchParams.get('endpoint')
  if (!endpoint) return NextResponse.json({ subscribed: false })

  const { data } = await admin()
    .from('push_subscriptions')
    .select('notify_prayer_daily, notify_prayer_each, notify_masjid_events, lat, timezone')
    .eq('endpoint', endpoint)
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ subscribed: !!data, preferences: data || null })
}
