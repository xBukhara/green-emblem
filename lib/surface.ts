// ── Which surface is this? ───────────────────────────────────────────────
// One Next build serves three surfaces:
//   • the consumer app            (green-emblem.com/*)
//   • the platform admin console  (/admin/*)
//   • the masjid portal           (masjid.green-emblem.com/* → /portal/*)
//
// Consumer chrome — the mobile tab bar, the install banner, the service
// worker — is mounted in the ROOT layout, so a nested layout cannot remove
// it. Each of those components asks this helper to step aside instead.
//
// IMPORTANT: the portal is identified by HOSTNAME, not by path. The
// middleware *rewrites* masjid.green-emblem.com/posts to /portal/posts
// internally, and a rewrite is invisible to the client router — in the
// browser `usePathname()` there returns "/posts", never "/portal/posts".
// Matching on the path alone silently misses the entire portal.
//
// Keep this the single source of truth. Adding a surface in one component
// and forgetting another is exactly how the tab bar ended up floating over
// the portal.

// Mirrors the list in middleware.ts. NEXT_PUBLIC_ so it is inlined into the
// client bundle too — the middleware's own copy is server-side only.
const PORTAL_HOSTS = [
  process.env.NEXT_PUBLIC_PORTAL_HOST,
  'masjid.green-emblem.com',
  'masjid.localhost',
]
  .filter(Boolean)
  .map(h => String(h).toLowerCase().split(':')[0])

export function isPortalHost(hostname?: string | null): boolean {
  const host = (hostname || '').toLowerCase().split(':')[0]
  if (!host) return false
  return PORTAL_HOSTS.includes(host) || host.startsWith('masjid.')
}

const NON_CONSUMER_PATHS = ['/admin', '/portal']

function isNonConsumerPath(pathname?: string | null): boolean {
  if (!pathname) return false
  // Exact match or a real path segment — '/administrators' is not '/admin'.
  return NON_CONSUMER_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

/**
 * True when this page should carry consumer chrome.
 *
 * Client components must pass the live hostname; during SSR there is none,
 * so the answer is "consumer" and the portal's own layout suppresses the
 * chrome with CSS before first paint (see hideConsumerChromeCss). Once
 * hydrated, this returns false on the portal and the elements unmount.
 */
export function isConsumerSurface(pathname?: string | null, hostname?: string | null): boolean {
  if (isPortalHost(hostname)) return false
  return !isNonConsumerPath(pathname)
}

/**
 * Rendered by the portal layout on the server. Static pages cannot read
 * request headers, so this is what keeps the consumer tab bar from flashing
 * over the portal in the frame before hydration.
 */
export const HIDE_CONSUMER_CHROME_CSS = `
  nav[aria-label="Primary"],
  [data-consumer-chrome] { display: none !important; }
  body { padding-bottom: 0 !important; }
`
