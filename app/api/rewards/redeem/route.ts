import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/rewards/redeem { reward_id, shipping_address }
// Atomic balance + stock check happens inside the redeem_reward SQL function.
export async function POST(request: NextRequest) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: { user } } = await anon.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { reward_id, shipping_address } = body
  if (!reward_id) return NextResponse.json({ error: 'reward_id is required' }, { status: 400 })
  const addr = shipping_address || {}
  if (!addr.line1 || !addr.city || !addr.state || !addr.zip) {
    return NextResponse.json({ error: 'A full shipping address is required' }, { status: 400 })
  }

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data, error } = await admin.rpc('redeem_reward', {
    p_user: user.id,
    p_reward: reward_id,
    p_address: { name: addr.name || null, line1: addr.line1, line2: addr.line2 || null, city: addr.city, state: addr.state, zip: addr.zip },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (data?.error) return NextResponse.json(data, { status: 400 })

  return NextResponse.json(data)
}
