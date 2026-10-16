'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Home, Compass, HeartHandshake, MapPin, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isConsumerSurface, isFullBleedPath } from '@/lib/surface'

// ── Mobile bottom tab bar ────────────────────────────────────────────────
// Pocket-check features one thumb-tap away. Hidden on desktop; on the admin
// console and masjid portal, which are their own surfaces; and on full-bleed
// consumer screens like the /nearby map, which take over the viewport and
// provide their own way back.
//
// The fourth tab points at the map rather than the /explore hub: finding
// what is around you is the thing people open this app on the street to do.
// The hub is still at /explore, linked from the top nav and from the map.
const TABS = [
  { href: '/',          label: 'Home',    Icon: Home },
  { href: '/prayer',    label: 'Prayer',  Icon: Compass },
  { href: '/sadaqah',   label: 'Give',    Icon: HeartHandshake },
  { href: '/nearby',    label: 'Nearby',  Icon: MapPin },
  { href: '/dashboard', label: 'Profile', Icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()

  // The hostname is only knowable in the browser, so this starts as the
  // server's answer and corrects itself on mount. On the portal the CSS in
  // its layout has already hidden the bar, so nothing flashes in between.
  const [host, setHost] = useState<string | null>(null)
  useEffect(() => { setHost(window.location.hostname) }, [])

  if (!isConsumerSurface(pathname, host)) return null
  if (isFullBleedPath(pathname)) return null

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname?.startsWith(href)

  return (
    <>
      <nav
        aria-label="Primary"
        className={cn(
          'fixed inset-x-0 bottom-0 z-[120] border-t border-gold/15 bg-forest-deepest/95 backdrop-blur-xl lg:hidden',
          'pb-[env(safe-area-inset-bottom,0px)]'
        )}
      >
        <div className="mx-auto flex h-[62px] max-w-[520px] items-stretch justify-around">
          {TABS.map(({ href, label, Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className="relative flex flex-1 flex-col items-center justify-center gap-[3px] no-underline"
              >
                {active && (
                  <span className="absolute top-0 h-0.5 w-6 rounded-full bg-gold" />
                )}
                <Icon
                  className={cn('h-[22px] w-[22px] transition-colors', active ? 'text-gold' : 'text-white/60')}
                  strokeWidth={active ? 2 : 1.6}
                />
                <span
                  className={cn(
                    'text-[9px] font-semibold tracking-wide transition-colors',
                    active ? 'text-white' : 'text-white/60'
                  )}
                >
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Keep page content clear of the bar on mobile */}
      <style>{`
        @media (max-width: 1023px) {
          body { padding-bottom: calc(62px + env(safe-area-inset-bottom, 0px)); }
        }
      `}</style>
    </>
  )
}
