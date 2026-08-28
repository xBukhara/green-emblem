'use client'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

// ── Explore — the single front door to everything beyond giving ──────────
const SECTIONS = [
  {
    href: '/greenworld-plus', accent: '#9b8ec4', tag: 'COMMUNITY',
    title: 'GreenWorld+',
    desc: 'Follow your masjid, see local events, and explore masjids and halal food within your travel radius.',
  },
  {
    href: '/prayer', accent: '#d4af6e', tag: 'WORSHIP',
    title: 'Prayer & Qibla',
    desc: 'Accurate prayer times for your location, a live Qibla compass, and your madhab preferences.',
  },
  {
    href: '/prayer?tab=quran', accent: '#d4af6e', tag: 'WORSHIP',
    title: 'Quran',
    desc: 'Read any surah with translation and tafsir — a few minutes a day earns rewards points.',
  },
  {
    href: '/greentv', accent: '#5a9e5a', tag: 'MEDIA',
    title: 'GreenTV',
    desc: 'News, community clips, and live moments from the Green Emblem community.',
  },
  {
    href: '/greenfitness', accent: '#5a9e5a', tag: 'MEDIA',
    title: 'GreenFitness',
    desc: 'Fitness coaching and training content, rooted in discipline and purpose.',
  },
  {
    href: '/rewards', accent: '#f0d48a', tag: 'REWARDS',
    title: 'Rewards',
    desc: 'Daily prayer, Quran, and community engagement earn points — redeem them for Green Emblem merch.',
  },
  {
    href: '/shop', accent: '#d4af6e', tag: 'SHOP',
    title: 'Islamic Shop',
    desc: 'Curated Islamic products and Green Emblem merchandise.',
  },
  {
    href: null, accent: '#8fa38f', tag: 'COMING SOON',
    title: 'Local Businesses',
    desc: 'Muslim-owned businesses near you — reviews, halal verification, and community-first promotion.',
  },
] as const

export default function ExplorePage() {
  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ position: 'relative', zIndex: 2, minHeight: '100dvh', padding: '120px 24px 80px', maxWidth: '860px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '0.3em', color: 'var(--gold)', marginBottom: '16px' }}>EXPLORE</div>
          <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: 'clamp(28px,5vw,44px)', fontWeight: 500, color: '#fff', marginBottom: '12px' }}>Everything Green Emblem</h1>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '17px', fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
            Worship, community, media, and rewards — one place.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '14px' }}>
          {SECTIONS.map(s => {
            const inner = (
              <>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.22em', color: s.accent, marginBottom: '10px' }}>{s.tag}</div>
                <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '18px', color: s.href ? '#fff' : 'rgba(255,255,255,0.45)', marginBottom: '8px' }}>{s.title}</div>
                <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '14px', fontStyle: 'italic', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, margin: 0, flex: 1 }}>{s.desc}</p>
                {s.href && <div style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', color: s.accent, marginTop: '14px' }}>OPEN →</div>}
              </>
            )
            const style: React.CSSProperties = {
              display: 'flex', flexDirection: 'column',
              background: 'rgba(15,31,15,0.55)', borderRadius: '16px', padding: '22px',
              border: `0.5px solid ${s.href ? s.accent + '30' : 'rgba(255,255,255,0.07)'}`,
              textDecoration: 'none', transition: 'transform 0.15s, border-color 0.15s',
              opacity: s.href ? 1 : 0.75,
            }
            return s.href
              ? <Link key={s.title} href={s.href} style={style}>{inner}</Link>
              : <div key={s.title} style={style}>{inner}</div>
          })}
        </div>
      </main>
      <Footer />
    </>
  )
}
