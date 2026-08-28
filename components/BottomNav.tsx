'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ── Mobile bottom tab bar ────────────────────────────────────────────────
// Fixed, mobile-only (≤768px), hidden on admin. Pocket-check features
// (prayer, community, giving) one thumb-tap away — the main lever for
// daily engagement on phones.
const TABS = [
  { href: '/',            label: 'Home',    icon: (a: boolean) => <path d="M3 11.5 12 4l9 7.5M5.5 10v9h13v-9" fill="none" stroke={a ? '#d4af6e' : 'rgba(255,255,255,0.45)'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/> },
  { href: '/prayer',      label: 'Prayer',  icon: (a: boolean) => <path d="M12 3.5c-3 1.8-5 4.9-5 8.5a8.5 8.5 0 0 0 10 8.4A8.5 8.5 0 0 1 12 3.5ZM16.5 5l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6Z" fill="none" stroke={a ? '#d4af6e' : 'rgba(255,255,255,0.45)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/> },
  { href: '/sadaqah',     label: 'Give',    icon: (a: boolean) => <path d="M12 20s-7-4.6-7-9.7C5 7.5 7 6 9 6c1.4 0 2.4.7 3 1.8C12.6 6.7 13.6 6 15 6c2 0 4 1.5 4 4.3 0 5.1-7 9.7-7 9.7Z" fill={a ? '#d4af6e' : 'none'} stroke={a ? '#d4af6e' : 'rgba(255,255,255,0.45)'} strokeWidth="1.5" strokeLinejoin="round"/> },
  { href: '/explore',     label: 'Explore', icon: (a: boolean) => <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.5-12.5-2 5-5 2 2-5 5-2Z" fill="none" stroke={a ? '#d4af6e' : 'rgba(255,255,255,0.45)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/> },
  { href: '/dashboard',   label: 'Profile', icon: (a: boolean) => <path d="M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-7 8.5c.8-3.4 3.6-5.5 7-5.5s6.2 2.1 7 5.5" fill="none" stroke={a ? '#d4af6e' : 'rgba(255,255,255,0.45)'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/> },
]

export default function BottomNav() {
  const pathname = usePathname()
  if (pathname?.startsWith('/admin')) return null

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname?.startsWith(href)

  return (
    <>
      <nav className="ge-bottom-nav" aria-label="Primary" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 120,
        display: 'none',
        background: 'rgba(8,15,8,0.97)', borderTop: '0.5px solid rgba(212,175,110,0.18)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'stretch', height: '62px', maxWidth: '520px', margin: '0 auto' }}>
          {TABS.map(t => {
            const active = isActive(t.href)
            return (
              <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '3px', textDecoration: 'none', position: 'relative',
              }}>
                {active && <span style={{ position: 'absolute', top: 0, width: '22px', height: '2px', borderRadius: '2px', background: '#d4af6e' }}/>}
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">{t.icon(active)}</svg>
                <span style={{
                  fontFamily: 'var(--font-inter, Georgia, serif)', fontSize: '9px', fontWeight: 600,
                  letterSpacing: '0.06em', color: active ? '#d4af6e' : 'rgba(255,255,255,0.4)',
                }}>{t.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
      <style>{`
        @media (max-width: 768px) {
          .ge-bottom-nav { display: block !important; }
          body { padding-bottom: calc(62px + env(safe-area-inset-bottom, 0px)); }
        }
      `}</style>
    </>
  )
}
