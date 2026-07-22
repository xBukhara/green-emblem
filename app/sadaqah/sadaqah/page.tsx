import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import Link from 'next/link'

export default function SadaqahPage() {
  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ paddingTop:'88px', minHeight:'100dvh', position:'relative', zIndex:2 }}>
        <div style={{ maxWidth:'640px', margin:'0 auto', padding:'60px 24px 80px', textAlign:'center' }}>
          <div style={{ fontFamily:'var(--font-arabic)', fontSize:'26px', color:'var(--gold)', opacity:0.65, marginBottom:'16px', direction:'rtl' }} lang="ar">
            بَابُ الصَّدَقَة
          </div>
          <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.28em', color:'var(--gold)', marginBottom:'14px' }}>
            Baab As-Sadaqah
          </div>
          <h1 style={{ fontFamily:'var(--font-cinzel)', fontSize:'clamp(26px,5vw,42px)', fontWeight:500, color:'#fff', lineHeight:1.15, marginBottom:'14px' }}>
            The Gate of Charity
          </h1>
          <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'17px', fontStyle:'italic', color:'rgba(255,255,255,0.55)', lineHeight:1.8, marginBottom:'40px' }}>
            Place a QR code at your event. Every guest who scans it can give sadaqah in the names of the honourees — directly to Share The Meal, Islamic Relief, or UNICEF. Zero fees. Zero middleman. 100% to charity.
          </p>

          <div style={{ background:'rgba(15,31,15,0.6)', border:'0.5px solid rgba(212,175,110,0.15)', borderRadius:'16px', padding:'28px', marginBottom:'32px', textAlign:'left' }}>
            <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.2em', color:'var(--gold)', marginBottom:'16px' }}>
              How it works
            </div>
            {[
              { n:'01', t:'Request a campaign', d:'Fill in your event details. We review and approve within 48 hours.' },
              { n:'02', t:'Build your page', d:'Choose your theme, colour scheme, and a verse. We generate your QR code.' },
              { n:'03', t:'Place it at your event', d:'Print the QR code and place it on tables, place cards, or display it on a screen.' },
              { n:'04', t:'Guests give sadaqah', d:'Every scan goes to charity in the names of your honourees. You see the impact in real time.' },
            ].map(({ n, t, d }) => (
              <div key={n} style={{ display:'flex', gap:'16px', marginBottom:'16px' }}>
                <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'11px', color:'var(--gold)', opacity:0.5, minWidth:'24px', paddingTop:'2px' }}>{n}</div>
                <div>
                  <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'12px', color:'#fff', marginBottom:'3px' }}>{t}</div>
                  <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'14px', color:'rgba(255,255,255,0.5)', fontStyle:'italic', lineHeight:1.5 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>

          <Link href="/sadaqah/request" className="btn-gold" style={{ textDecoration:'none', display:'inline-block' }}>
            Request a campaign
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
