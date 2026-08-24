import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import Link from 'next/link'

export const metadata = { title: 'About Us' }

const p: React.CSSProperties = { fontFamily: 'var(--font-cormorant)', fontSize: '18px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.85, marginBottom: '20px' }
const sectionLabel: React.CSSProperties = { fontFamily: 'var(--font-cinzel)', fontSize: '9px', letterSpacing: '0.28em', color: 'var(--gold)', marginBottom: '14px' }
const h2: React.CSSProperties = { fontFamily: 'var(--font-cinzel)', fontSize: 'clamp(22px,4vw,30px)', fontWeight: 500, color: '#fff', marginBottom: '16px' }

export default function AboutPage() {
  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ paddingTop: '88px', minHeight: '100dvh', position: 'relative', zIndex: 2 }}>

        {/* Hero */}
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '60px 24px 20px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-arabic)', fontSize: '24px', color: 'var(--gold)', opacity: 0.7, marginBottom: '16px' }} lang="ar">بَاب الصَّدَقَة</div>
          <div style={sectionLabel}>ABOUT US</div>
          <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: 'clamp(30px,6vw,48px)', fontWeight: 500, color: '#fff', lineHeight: 1.15, marginBottom: '20px' }}>
            Faith. Strength. Purpose.
          </h1>
          <p style={{ ...p, fontStyle: 'italic' }}>
            Green Emblem exists to make one act of good easy to start, and everything else — community, growth, and content — grow up around it.
          </p>
        </div>

        {/* Story */}
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '30px 24px' }}>
          <div style={sectionLabel}>WHY WE STARTED</div>
          <h2 style={h2}>A door, not a destination</h2>
          <p style={p}>
            Every Nikkah, Walima, Aqiqah, and Eid gathering is already a moment of gratitude. Baab As-Sadaqah — &ldquo;the door of charity&rdquo; — turns that moment into something that outlasts it: a QR code on the table that lets guests give directly to a verified charity, in honour of the people being celebrated. No fees. No middleman. Green Emblem never touches the money — it only builds the door.
          </p>
          <p style={p}>
            That single idea is why the platform exists, and it&rsquo;s free by design. Everything else we build — GreenWorld+, GreenTV, Quran and prayer tools — grows outward from the same instinct: make the good, ordinary infrastructure of Muslim life easier to reach.
          </p>
        </div>

        {/* Values */}
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '30px 24px' }}>
          <div style={sectionLabel}>WHAT WE BELIEVE</div>
          <h2 style={h2}>Stand in the Middle</h2>
          <p style={p}>
            It&rsquo;s also the name of our clothing line, and it&rsquo;s not a slogan we picked for how it looks on a shirt. <em>Ummatan wasatan</em> — a nation of the middle way — is a standing invitation to take the balanced path and resist the pull toward division, whichever direction it comes from. That idea runs through everything we build: a platform for the whole community, not a faction of it.
          </p>
        </div>

        {/* What we're building */}
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '30px 24px 10px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={sectionLabel}>THE ECOSYSTEM</div>
            <h2 style={{ ...h2, textAlign: 'center' }}>One platform, growing outward</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            {[
              { name: 'Baab As-Sadaqah', desc: 'Free, QR-code charitable giving for any Islamic event.', href: '/sadaqah' },
              { name: 'GreenWorld+', desc: 'A directory of verified masjids and their local events.', href: '/greenworld-plus' },
              { name: 'GreenTV', desc: 'News, fitness coaching, and a live community Discord.', href: '/greentv' },
              { name: 'Prayer, Qibla & Quran', desc: 'Prayer times, a live Qibla compass, and Quran with tafsir.', href: '/prayer' },
              { name: 'The Shop', desc: 'Stand in the Middle — clothing built around balance.', href: '/shop' },
            ].map(({ name, desc, href }) => (
              <Link key={name} href={href} style={{ textDecoration: 'none' }}>
                <div style={{ background: 'rgba(15,31,15,0.5)', border: '0.5px solid rgba(212,175,110,0.12)', borderRadius: '14px', padding: '20px', height: '100%' }} className="hover-lift">
                  <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '14px', color: 'var(--gold)', marginBottom: '8px' }}>{name}</div>
                  <div style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>{desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Who's building it */}
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '50px 24px 20px' }}>
          <div style={sectionLabel}>WHO WE ARE</div>
          <h2 style={h2}>Built deliberately, in the open</h2>
          <p style={p}>
            Green Emblem is early. We&rsquo;d rather say that plainly than pretend otherwise — you&rsquo;ll notice things change, improve, and occasionally break as we build in public. Every feature is built with the same test: does this make it easier for someone to give, to pray, to find their community, or to hold onto the middle path.
          </p>
          <p style={{ ...p, marginBottom: 0 }}>
            Questions, ideas, or feedback are always welcome at <a href="mailto:hello@green-emblem.com" style={{ color: 'var(--gold)', textDecoration: 'none' }}>hello@green-emblem.com</a>.
          </p>
        </div>

        {/* CTA */}
        <div style={{ maxWidth: '500px', margin: '0 auto', padding: '40px 24px 80px', textAlign: 'center' }}>
          <Link href="/sadaqah" className="btn-gold" style={{ textDecoration: 'none' }}>
            Start Baab As-Sadaqah
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
