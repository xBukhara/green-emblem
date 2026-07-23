import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// PATCH /api/profile — update the signed-in user's own profile.
// Uses Bearer-token auth (proven reliable across browsers) rather than
// cookie-based server auth.
export async function PATCH(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: { user }, error: authError } = await anon.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()

  // Whitelist of fields a user is allowed to update on their own profile —
  // never trust the client for role, id, onboarding_complete, etc.
  const allowed = [
    'first_name', 'last_name', 'phone', 'address',
    'local_mosque', 'mosque_place_id', 'mosque_lat', 'mosque_lng', 'mosque_formatted_address',
    'newsletter_opted_in', 'sub_greentv', 'sub_greenfitness', 'sub_greenworld_plus',
  ]
  const updates: Record<string, any> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }
  if (updates.first_name || updates.last_name) {
    // Keep full_name in sync if either name part changes
    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: current } = await admin.from('profiles').select('first_name, last_name').eq('id', user.id).maybeSingle()
    const firstName = updates.first_name ?? current?.first_name ?? ''
    const lastName = updates.last_name ?? current?.last_name ?? ''
    updates.full_name = `${firstName} ${lastName}`.trim()
  }

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await admin.from('profiles').update(updates).eq('id', user.id).select().maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ profile: data })
}
