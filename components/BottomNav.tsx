'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Compass, HeartHandshake, LayoutGrid, User } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Mobile bottom tab bar ────────────────────────────────────────────────
// Pocket-check features one thumb-tap away. Hidden on desktop and admin.
const TABS = [
  { href: '/',          label: 'Home',    Icon: Home },
  { href: '/prayer',    label: 'Prayer',  Icon: Compass },
  { href: '/sadaqah',   label: 'Give',    Icon: HeartHandshake },
  { href: '/explore',   label: 'Explore', Icon: LayoutGrid },
  { href: '/dashboard', label: 'Profile', Icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()
  if (pathname?.startsWith('/admin')) return null

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname?.startsWith(href)

  return (
    <>
      <nav
        aria-label="Primary"
        className={cn(
          'fixed inset-x-0 bottom-0 z-[120] border-t border-gold/15 bg-[#080f08]/95 backdrop-blur-xl lg:hidden',
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
                  className={cn('h-[22px] w-[22px] transition-colors', active ? 'text-gold' : 'text-white/45')}
                  strokeWidth={active ? 2 : 1.6}
                />
                <span
                  className={cn(
                    'text-[9px] font-semibold tracking-wide transition-colors',
                    active ? 'text-gold' : 'text-white/40'
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
