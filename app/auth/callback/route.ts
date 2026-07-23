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
    .maybeSingle()

  if (!profile) {
    // First-time sign-in — create the profile row so onboarding can save to it later.
    // Works the same for Google and Apple; Apple only supplies a name on the
    // user's very first-ever authorization, so full_name may be empty here —
    // onboarding step 1 lets them fill it in either way.
    const name = user.user_metadata?.full_name || ''
    const parts = name.split(' ')
    const newProfile = {
      id: user.id,
      email: user.email,
      full_name: name,
      first_name: user.user_metadata?.given_name || parts[0] || '',
      last_name: user.user_metadata?.family_name || parts.slice(1).join(' ') || '',
      role: 'user',
      onboarding_complete: false,
    }

    let { error: insertError } = await admin.from('profiles').insert(newProfile)

    // A unique-constraint conflict here almost always means a stale row from
    // an earlier broken sign-in attempt is squatting on this email with a
    // different id. Clean it up and retry once, rather than failing silently
    // and leaving the user stuck in an onboarding/dashboard redirect loop.
    if (insertError?.code === '23505' && user.email) {
      await admin.from('profiles').delete().eq('email', user.email).neq('id', user.id)
      ;({ error: insertError } = await admin.from('profiles').insert(newProfile))
    }

    if (insertError) {
      console.error('Profile creation failed on sign-in:', insertError)
      return NextResponse.redirect(`${baseUrl}/auth/sign-in?error=profile_creation_failed`)
    }

    return NextResponse.redirect(`${baseUrl}/onboarding`)
  }

  // Profile exists — route based on onboarding status
  if (profile.onboarding_complete) {
    return NextResponse.redirect(`${baseUrl}/dashboard`)
  }

  return NextResponse.redirect(`${baseUrl}/onboarding`)
}
