import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export default function DashboardPage() {
  return (
    <>
      <Nav />
      <main style={{ paddingTop:'88px', minHeight:'100dvh', position:'relative', zIndex:2, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ textAlign:'center', padding:'40px 24px' }}>
          <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.28em', color:'var(--gold)', marginBottom:'14px' }}>
            Dashboard
          </div>
          <h1 style={{ fontFamily:'var(--font-cinzel)', fontSize:'32px', fontWeight:500, color:'#fff', marginBottom:'12px' }}>
            Coming soon
          </h1>
          <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'16px', fontStyle:'italic', color:'rgba(255,255,255,0.45)', lineHeight:1.7 }}>
            Your donor dashboard is being built. Check back soon.
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
