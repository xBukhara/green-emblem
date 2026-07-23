import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // Verify the user via their access token (Bearer header) — more reliable
  // across mobile browsers than cookie-based auth after an OAuth redirect chain.
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: { user }, error: authError } = await anon.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const {
    first_name, last_name, phone, address, local_mosque, newsletter,
    mosque_place_id, mosque_lat, mosque_lng, mosque_formatted_address,
  } = body

  if (!first_name || !last_name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  // Use the admin client to bypass RLS — we've already verified auth above
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Upsert rather than update — if the profile row was never created (e.g.
  // the sign-in callback's insert failed silently), an UPDATE would match
  // zero rows and report false success, leaving the user stuck in an
  // onboarding <-> dashboard redirect loop. Upsert guarantees the row exists.
  const { error: upsertError } = await admin.from('profiles').upsert({
    id: user.id,
    email: user.email,
    first_name,
    last_name,
    full_name: `${first_name} ${last_name}`,
    phone: phone || null,
    address: address || null,
    local_mosque: local_mosque || null,
    mosque_place_id: mosque_place_id || null,
    mosque_lat: mosque_lat ?? null,
    mosque_lng: mosque_lng ?? null,
    mosque_formatted_address: mosque_formatted_address || null,
    newsletter_opted_in: !!newsletter,
    onboarding_complete: true,
  }, { onConflict: 'id' })

  if (upsertError) {
    console.error('Onboarding upsert failed:', upsertError)
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  // Handle newsletter subscription
  if (newsletter) {
    await admin.from('newsletter_subscribers').upsert({
      email: user.email,
      first_name,
      last_name,
      source: 'onboarding',
      is_active: true,
    }, { onConflict: 'email' })
  }

  return NextResponse.json({ success: true })
}
