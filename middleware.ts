import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ── Hostname routing ─────────────────────────────────────────────────────
// masjid.green-emblem.com serves the masjid portal; everything else serves
// the consumer app. One deployment, one database — the portal has to write
// events that appear instantly in GreenWorld+ and push to followers, so
// splitting it into a second project would only mean duplicating auth, the
// database client and the push layer.
//
// Rewrites (not redirects) so the portal's URLs stay clean:
//   masjid.green-emblem.com/posts  ->  /portal/posts  internally
//
// Set PORTAL_HOST in Vercel to override for a preview deployment.
const PORTAL_HOSTS = new Set(
  [process.env.NEXT_PUBLIC_PORTAL_HOST, 'masjid.green-emblem.com', 'masjid.localhost']
    .filter(Boolean)
    .map(h => String(h).toLowerCase())
)

function isPortalHost(hostname: string) {
  const host = hostname.toLowerCase().split(':')[0]
  return PORTAL_HOSTS.has(host) || host.startsWith('masjid.')
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()

  const host = request.headers.get('host') || ''
  const { pathname } = request.nextUrl

  if (isPortalHost(host)) {
    // API routes and Next internals are shared — never rewrite those.
    if (pathname.startsWith('/api') || pathname.startsWith('/_next')) return supabaseResponse

    // Already pointed at the portal tree
    if (pathname.startsWith('/portal')) return supabaseResponse

    const url = request.nextUrl.clone()
    url.pathname = `/portal${pathname === '/' ? '' : pathname}`
    const rewritten = NextResponse.rewrite(url, { request })
    supabaseResponse.cookies.getAll().forEach(c => rewritten.cookies.set(c))
    return rewritten
  }

  // On the main site, /portal is not a public path — send people to the
  // portal's own hostname rather than exposing the internal route.
  if (pathname.startsWith('/portal')) {
    const portalHost = process.env.NEXT_PUBLIC_PORTAL_HOST || 'masjid.green-emblem.com'
    return NextResponse.redirect(
      new URL(pathname.replace(/^\/portal/, '') || '/', `https://${portalHost}`)
    )
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
