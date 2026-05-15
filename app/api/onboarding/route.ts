import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  // Verify the user is authenticated via their session cookies
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const { first_name, last_name, phone, address, local_mosque, newsletter } = body

  if (!first_name || !last_name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  // Use the admin client to bypass RLS — we've already verified auth above
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error: updateError } = await admin.from('profiles').update({
    first_name,
    last_name,
    full_name: `${first_name} ${last_name}`,
    phone: phone || null,
    address: address || null,
    local_mosque: local_mosque || null,
    newsletter_opted_in: !!newsletter,
    onboarding_complete: true,
  }).eq('id', user.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
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
