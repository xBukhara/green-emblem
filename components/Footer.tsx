import Link from 'next/link'

export default function Footer() {
  const Logo = () => (
    <svg width="28" height="28" viewBox="25 35 170 155" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke="#c8a050" strokeWidth="3" transform="rotate(0 110 110)"/>
      <rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke="#c8a050" strokeWidth="3" transform="rotate(45 110 110)"/>
      <polygon points="110,42 158,42 190,74 190,146 158,178 62,178 30,146 30,74 62,42" fill="#2e6b2e" stroke="#c8a050" strokeWidth="2.5"/>
      <circle cx="103" cy="104" r="44" fill="#d4af6e"/>
      <circle cx="117" cy="96" r="37" fill="#2e6b2e"/>
      <g transform="translate(158,82)">
        <polygon points="0,-16 3.8,-6.2 14.8,-5 6.8,3 9.4,14 0,8.2 -9.4,14 -6.8,3 -14.8,-5 -3.8,-6.2" fill="#d4af6e"/>
      </g>
    </svg>
  )

  const linkStyle: React.CSSProperties = {
    fontSize: '14px', color: 'rgba(255,255,255,0.55)', textDecoration: 'none',
    fontStyle: 'italic', fontFamily: 'var(--font-cormorant)', transition: 'color 0.15s',
  }

  const colTitle: React.CSSProperties = {
    fontFamily: 'var(--font-cinzel)', fontSize: '9px', letterSpacing: '0.2em',
    color: 'var(--gold)', marginBottom: '14px', opacity: 0.8,
  }

  return (
    <footer style={{ background:'#080f08', borderTop:'0.5px solid rgba(212,175,110,0.12)', padding:'56px 40px 32px' }}>
      <div style={{ maxWidth:'1200px', margin:'0 auto' }}>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:'48px', marginBottom:'40px' }}>

          {/* Brand */}
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px' }}>
              <Logo />
              <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'13px', letterSpacing:'0.18em', color:'var(--gold)' }}>Green Emblem</span>
            </div>
            <p style={{ fontSize:'14px', color:'rgba(255,255,255,0.35)', fontStyle:'italic', lineHeight:1.7, maxWidth:'260px', fontFamily:'var(--font-cormorant)' }}>
              Islamic events, giving & community. Every celebration honoured with intention.
            </p>
          </div>

          {/* Platform */}
          <div>
            <div style={colTitle}>Platform</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {[
                { href:'/sadaqah', label:'Baab As-Sadaqah' },
                { href:'/favours', label:'Party Favours' },
                { href:'/events', label:'Find a Decorator' },
                { href:'/shop', label:'Islamic Shop' },
              ].map(({ href, label }) => (
                <Link key={href} href={href} style={linkStyle}>{label}</Link>
              ))}
            </div>
          </div>

          {/* Affiliates */}
          <div>
            <div style={colTitle}>Affiliates</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {[
                { href:'/affiliates/apply', label:'Become an Affiliate' },
                { href:'/affiliates/login', label:'Affiliate Login' },
                { href:'/affiliates/guidelines', label:'Event Guidelines' },
              ].map(({ href, label }) => (
                <Link key={href} href={href} style={linkStyle}>{label}</Link>
              ))}
            </div>
          </div>

          {/* Company */}
          <div>
            <div style={colTitle}>Company</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {[
                { href:'/about', label:'About Us' },
                { href:'/contact', label:'Contact' },
                { href:'/terms', label:'Terms of Service' },
                { href:'/privacy', label:'Privacy Policy' },
              ].map(({ href, label }) => (
                <Link key={href} href={href} style={linkStyle}>{label}</Link>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop:'0.5px solid rgba(255,255,255,0.06)', paddingTop:'20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
          <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'11px', letterSpacing:'0.08em', color:'rgba(255,255,255,0.3)' }}>
            © 2026 Green Emblem. All rights reserved.
          </span>
          <span style={{ fontFamily:'var(--font-arabic)', fontSize:'14px', color:'var(--gold)', opacity:0.45 }} lang="ar">
            بَارَكَ اللَّهُ فِيهِ
          </span>
        </div>
      </div>
    </footer>
  )
}
