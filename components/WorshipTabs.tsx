'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ── Prayer · Qibla · Quran ───────────────────────────────────────────────
// These were one page with sub-tabs. They are now three routes, because each
// is a thing someone arrives at directly: /quran is worth bookmarking, and
// /qibla is what you open standing in a hotel room.
//
// Rendered as a segmented control so it still reads as tabs, but each tab is
// a real link — the URL is the state.
const TABS = [
  { href: '/prayer', label: 'Prayer' },
  { href: '/qibla',  label: 'Qibla'  },
  { href: '/quran',  label: 'Quran'  },
]

export default function WorshipTabs() {
  const pathname = usePathname()

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
      <div
        role="tablist"
        aria-label="Worship sections"
        style={{
          display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)',
          border: '0.5px solid rgba(212,175,110,0.15)', borderRadius: '100px', padding: '4px',
        }}
      >
        {TABS.map(({ href, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              role="tab"
              aria-selected={active}
              aria-current={active ? 'page' : undefined}
              style={{
                fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em',
                padding: '9px 22px', borderRadius: '100px', textDecoration: 'none',
                background: active ? 'var(--gold)' : 'transparent',
                color: active ? '#0f1f0f' : 'rgba(255,255,255,0.5)',
                transition: 'all 0.2s',
              }}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
