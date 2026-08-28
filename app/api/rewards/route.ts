import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Actions a client may claim directly. 'donation' and 'review' are awarded
// server-side by their own flows and are deliberately NOT in this list.
const CLIENT_ACTIONS = new Set([
  'quran_read', 'prayer_times',
  'prayer_fajr', 'prayer_dhuhr', 'prayer_asr', 'prayer_maghrib', 'prayer_isha',
  'community',
])

async function authedUser(request: NextRequest) {
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

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/rewards — the signed-in user's balance, streak, today's earned
// actions, the active catalog, and their redemption history.
export async function GET(request: NextRequest) {
  const user = await authedUser(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = adminClient()
  const [pointsRes, catalogRes, redemptionsRes, todayRes] = await Promise.all([
    admin.from('user_points').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('rewards_catalog').select('*').eq('active', true).order('sort_order'),
    admin.from('redemptions')
      .select('id, points_spent, status, created_at, rewards_catalog(name)')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
    admin.rpc('today_actions', { p_user: user.id }),
  ])

  // Today's earned actions (New York day, matching award_points)
  const todayActions: string[] = todayRes.data || []

  return NextResponse.json({
    points: pointsRes.data || { balance: 0, lifetime_points: 0, current_streak: 0, longest_streak: 0 },
    today_actions: todayActions,
    catalog: catalogRes.data || [],
    redemptions: redemptionsRes.data || [],
  })
}

// POST /api/rewards { action } — claim a daily engagement action.
// All validation (point values, daily caps, streaks) lives in the
// award_points SQL function; this route only authenticates and relays.
export async function POST(request: NextRequest) {
  const user = await authedUser(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { action } = await request.json().catch(() => ({}))
  if (!action || !CLIENT_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const admin = adminClient()
  const { data, error } = await admin.rpc('award_points', { p_user: user.id, p_action: action })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
