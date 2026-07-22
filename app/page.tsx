'use client'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import LogoIntro from '@/components/LogoIntro'
import ScrollReveal from '@/components/ScrollReveal'
import Link from 'next/link'

const GoldDivider = () => (
  <div style={{ display:'flex', alignItems:'center', gap:'12px', margin:'0 auto', maxWidth:'120px' }}>
    <div style={{ flex:1, height:'0.5px', background:'rgba(212,175,110,0.3)' }}/>
    <svg width="8" height="8" viewBox="0 0 8 8"><polygon points="4,0 5,3 8,3 5.5,5 6.5,8 4,6 1.5,8 2.5,5 0,3 3,3" fill="#d4af6e" opacity="0.6"/></svg>
    <div style={{ flex:1, height:'0.5px', background:'rgba(212,175,110,0.3)' }}/>
  </div>
)

export default function HomePage() {
  return (
    <>
      <LogoIntro />
      <ScrollReveal />
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />

      <main style={{ position:'relative', zIndex:2 }}>

        {/* ── HERO ── */}
        <section style={{ minHeight:'100dvh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'100px 24px 60px', position:'relative', overflow:'hidden' }}>

          {/* Star watermark */}
          <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', opacity:0.03, pointerEvents:'none', userSelect:'none' }}>
            <svg width="600" height="600" viewBox="0 0 220 220"><rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke="#d4af6e" strokeWidth="2" transform="rotate(0 110 110)"/><rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke="#d4af6e" strokeWidth="2" transform="rotate(45 110 110)"/><polygon points="110,42 158,42 190,74 190,146 158,178 62,178 30,146 30,74 62,42" fill="#d4af6e"/></svg>
          </div>

          <div className="fade-up" style={{ animationDelay:'0.1s' }}>
            <div style={{ fontFamily:'var(--font-arabic)', fontSize:'22px', color:'var(--gold)', opacity:0.6, marginBottom:'20px', direction:'rtl' }} lang="ar">
              بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
            </div>
          </div>

          <div className="fade-up" style={{ animationDelay:'0.2s' }}>
            {/* Logo mark */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-full.png" alt="Green Emblem — Faith. Strength. Purpose." width={190} style={{ marginBottom:'24px', display:'block', marginLeft:'auto', marginRight:'auto' }}/>
          </div>

          <div className="fade-up" style={{ animationDelay:'0.3s' }}>
            <div style={{ fontFamily:'var(--font-arabic)', fontSize:'26px', color:'var(--gold)', opacity:0.75, marginBottom:'14px' }} lang="ar">
              بَابُ الصَّدَقَة
            </div>
            <h1 style={{ fontFamily:'var(--font-cinzel)', fontSize:'clamp(36px,7vw,72px)', fontWeight:500, lineHeight:1.08, color:'#fff', marginBottom:'20px', letterSpacing:'-0.01em' }}>
              Every celebration<br/>
              <span style={{ color:'var(--gold)' }}>honoured with</span><br/>
              sadaqah
            </h1>
          </div>

          <div className="fade-up" style={{ animationDelay:'0.5s', maxWidth:'520px' }}>
            <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'clamp(16px,2.5vw,20px)', fontStyle:'italic', color:'rgba(255,255,255,0.55)', lineHeight:1.75, marginBottom:'40px' }}>
              Scan a QR code at any Nikkah, Walima, or Aqiqah, and turn the celebration into charity given in someone's honour. Free to start. No fees. No middleman.
            </p>
            <div style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap' }}>
              <Link href="/sadaqah" className="btn-gold" style={{ textDecoration:'none' }}>
                Start Baab As-Sadaqah
              </Link>
              <Link href="/shop" className="btn-outline" style={{ textDecoration:'none' }}>
                Visit the shop
              </Link>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS (3 steps) ── */}
        <section className="reveal" style={{ padding:'80px 24px', maxWidth:'1100px', margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:'52px' }}>
            <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.28em', color:'var(--gold)', marginBottom:'14px' }}>
              How it works
            </div>
            <h2 style={{ fontFamily:'var(--font-cinzel)', fontSize:'clamp(24px,4vw,38px)', fontWeight:500, color:'#fff' }}>
              From request to QR code<br/>in minutes
            </h2>
          </div>

          <div className="reveal reveal-stagger" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:'16px' }}>
            {[
              {
                num: '01',
                title: 'Tell us the occasion',
                desc: 'Share the honourees\u2019 names, the event type, and the date. Takes under a minute.',
                cta: 'Request a campaign',
                href: '/sadaqah/request',
              },
              {
                num: '02',
                title: 'Design it yourself',
                desc: 'Pick a colorway, font, and pattern in the design studio. See it rendered live as you go. Goes live the moment you publish \u2014 no approval wait.',
                cta: 'See the design studio',
                href: '/sadaqah',
              },
              {
                num: '03',
                title: 'Print and share the code',
                desc: 'Download a QR card styled to match your event. Place it on tables. Guests scan, choose a charity, and give \u2014 directly, with nothing held by Green Emblem.',
                cta: 'How giving works',
                href: '/sadaqah',
              },
            ].map(({ num, title, desc, cta, href }) => (
              <Link key={num} href={href} style={{ textDecoration:'none' }}>
                <div className="pillar-card hover-lift" style={{ background:'rgba(15,31,15,0.55)', border:'0.5px solid rgba(212,175,110,0.12)', borderRadius:'16px', padding:'28px 24px', height:'100%', transition:'border-color 0.2s, transform 0.2s', cursor:'pointer' }}>
                  <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'26px', color:'var(--gold)', opacity:0.5, marginBottom:'14px' }}>{num}</div>
                  <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'15px', fontWeight:500, color:'#fff', marginBottom:'12px' }}>{title}</div>
                  <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'15px', color:'rgba(255,255,255,0.6)', lineHeight:1.7, marginBottom:'20px' }}>{desc}</p>
                  <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.18em', color:'var(--gold)' }}>
                    {cta} →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── SADAQAH HIGHLIGHT ── */}
        <section className="reveal" style={{ padding:'70px 24px', background:'rgba(26,61,26,0.2)', borderTop:'0.5px solid rgba(212,175,110,0.08)', borderBottom:'0.5px solid rgba(212,175,110,0.08)' }}>
          <div style={{ maxWidth:'800px', margin:'0 auto', textAlign:'center' }}>
            <GoldDivider />
            <div style={{ margin:'32px 0' }}>
              <div style={{ fontFamily:'var(--font-arabic)', fontSize:'28px', color:'var(--gold)', opacity:0.7, marginBottom:'16px' }} lang="ar">
                بَابُ الصَّدَقَة
              </div>
              <h2 style={{ fontFamily:'var(--font-cinzel)', fontSize:'clamp(22px,4vw,36px)', fontWeight:500, color:'#fff', marginBottom:'14px' }}>
                Free, because it should be
              </h2>
              <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'18px', fontStyle:'italic', color:'rgba(255,255,255,0.55)', lineHeight:1.8, marginBottom:'32px', maxWidth:'560px', margin:'0 auto 32px' }}>
                Baab As-Sadaqah will always be free to use. Guests give directly to verified charities like Share The Meal, Islamic Relief USA, and UNICEF USA \u2014 Green Emblem never touches the money.
              </p>
              <Link href="/sadaqah" className="btn-gold" style={{ textDecoration:'none' }}>
                Request a campaign
              </Link>
            </div>
            <GoldDivider />
          </div>
        </section>

        {/* ── SHOP TEASER ── */}
        <section className="reveal" style={{ padding:'80px 24px', maxWidth:'700px', margin:'0 auto', textAlign:'center' }}>
          <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.28em', color:'var(--gold)', marginBottom:'14px' }}>
            The shop
          </div>
          <h2 style={{ fontFamily:'var(--font-cinzel)', fontSize:'clamp(22px,4vw,36px)', fontWeight:500, color:'#fff', marginBottom:'14px' }}>
            Stand in the Middle
          </h2>
          <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'18px', fontStyle:'italic', color:'rgba(255,255,255,0.5)', lineHeight:1.75, marginBottom:'32px' }}>
            Clothing and accessories for the Muslim home \u2014 a reminder to take the balanced path, and refrain from division.
          </p>
          <div style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap' }}>
            <Link href="/shop" className="btn-gold" style={{ textDecoration:'none' }}>
              Visit the shop
            </Link>
          </div>
        </section>

      </main>
      <Footer />
    </>
  )
}
