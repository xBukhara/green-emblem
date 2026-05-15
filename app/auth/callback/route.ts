import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  // Use origin so it works in both local dev and production
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin

  if (error) {
    return NextResponse.redirect(`${baseUrl}/auth/sign-in?error=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/auth/sign-in?error=no_code`)
  }

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

  // Exchange the auth code for a session — this sets the session cookies
  const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

  if (sessionError || !sessionData.session) {
    return NextResponse.redirect(`${baseUrl}/auth/sign-in?error=session_failed`)
  }

  const user = sessionData.session.user

  // Use the admin client to check/create the profile (bypasses RLS)
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Check if a profile row exists for this user
  const { data: profile } = await admin
    .from('profiles')
    .select('id, onboarding_complete')
    .eq('id', user.id)
    .single()

  if (!profile) {
    // First-time sign-in — create the profile row so onboarding can .update() it later
    const name = user.user_metadata?.full_name || ''
    const parts = name.split(' ')
    await admin.from('profiles').insert({
      id: user.id,
      email: user.email,
      full_name: name,
      first_name: user.user_metadata?.given_name || parts[0] || '',
      last_name: user.user_metadata?.family_name || parts.slice(1).join(' ') || '',
      role: 'user',
      onboarding_complete: false,
    })
    return NextResponse.redirect(`${baseUrl}/onboarding`)
  }

  // Profile exists — route based on onboarding status
  if (profile.onboarding_complete) {
    return NextResponse.redirect(`${baseUrl}/dashboard`)
  }

  return NextResponse.redirect(`${baseUrl}/onboarding`)
}
