'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [user, setUser] = useState<any>(null)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => { setMenuOpen(false) }, [pathname])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const Logo = () => (
    <Link href="/" style={{ display:'flex', alignItems:'center', gap:'10px', textDecoration:'none' }}>
      <svg width="30" height="30" viewBox="25 35 170 155" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke="#c8a050" strokeWidth="3" transform="rotate(0 110 110)"/>
        <rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke="#c8a050" strokeWidth="3" transform="rotate(45 110 110)"/>
        <polygon points="110,42 158,42 190,74 190,146 158,178 62,178 30,146 30,74 62,42" fill="#2e6b2e" stroke="#c8a050" strokeWidth="2.5"/>
        <polygon points="110,52 152,52 180,80 180,140 152,168 68,168 40,140 40,80 68,52" fill="none" stroke="#d4af6e" strokeWidth="1" opacity="0.45"/>
        <circle cx="103" cy="104" r="44" fill="#d4af6e"/>
        <circle cx="117" cy="96" r="37" fill="#2e6b2e"/>
        <g transform="translate(158,82)">
          <polygon points="0,-16 3.8,-6.2 14.8,-5 6.8,3 9.4,14 0,8.2 -9.4,14 -6.8,3 -14.8,-5 -3.8,-6.2" fill="#d4af6e"/>
        </g>
      </svg>
      <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'13px', letterSpacing:'0.2em', color:'#d4af6e' }}>
        Green Emblem
      </span>
    </Link>
  )

  const navStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 40px', height: '68px',
    background: scrolled ? 'rgba(8,15,8,0.97)' : 'rgba(15,31,15,0.88)',
    borderBottom: '0.5px solid rgba(212,175,110,0.15)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    transition: 'background 0.3s',
  }

  const linkStyle: React.CSSProperties = {
    fontFamily: 'var(--font-cinzel)', fontSize: '10px',
    letterSpacing: '0.16em', color: 'rgba(255,255,255,0.55)',
    textDecoration: 'none', position: 'relative', transition: 'color 0.2s',
  }

  return (
    <>
      <nav style={navStyle} role="navigation" aria-label="Main navigation">
        <Logo />

        {/* Desktop links */}
        <ul style={{ display:'flex', alignItems:'center', gap:'28px', listStyle:'none',
          '@media (max-width: 768px)': { display:'none' } as any }}
          className="nav-desktop-links">
          <li><Link href="/shop" style={linkStyle}>Shop</Link></li>
          <li><Link href="/favours" style={linkStyle}>Party Favours</Link></li>
          <li><Link href="/events" style={linkStyle}>Find a Decorator</Link></li>
          <li><Link href="/sadaqah" style={linkStyle}>Baab As-Sadaqah</Link></li>
          {user ? (
            <>
              <li><Link href="/dashboard" style={linkStyle}>My Dashboard</Link></li>
              <li>
                <button onClick={signOut} style={{
                  ...linkStyle, background:'none', border:'none', cursor:'pointer', padding:0
                }}>Sign out</button>
              </li>
            </>
          ) : (
            <li>
              <Link href="/auth/sign-in" style={{
                fontFamily:'var(--font-cinzel)', fontSize:'10px', letterSpacing:'0.14em',
                color:'var(--forest-dark)', background:'var(--gold)',
                padding:'8px 18px', borderRadius:'6px', textDecoration:'none',
                transition:'opacity 0.15s',
              }}>
                Sign in
              </Link>
            </li>
          )}
          <li>
            <Link href="/affiliates/apply" style={{
              fontFamily:'var(--font-cinzel)', fontSize:'10px', letterSpacing:'0.12em',
              color:'var(--gold)', border:'0.5px solid rgba(212,175,110,0.4)',
              padding:'8px 16px', borderRadius:'6px', textDecoration:'none',
            }}>
              Become an Affiliate
            </Link>
          </li>
        </ul>

        {/* Mobile toggle */}
        <button
          className="nav-mobile-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          style={{ display:'none', background:'none', border:'none', cursor:'pointer', flexDirection:'column', gap:'5px', padding:'4px' }}
        >
          {[0,1,2].map(i => (
            <span key={i} style={{ display:'block', width:'22px', height:'1.5px', background:'var(--gold)', borderRadius:'1px', transition:'all 0.2s' }}/>
          ))}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          position:'fixed', top:'68px', left:0, right:0, zIndex:99,
          background:'rgba(8,15,8,0.97)', borderBottom:'0.5px solid rgba(212,175,110,0.15)',
          padding:'20px', display:'flex', flexDirection:'column', gap:'16px',
        }}>
          {[
            { href:'/shop', label:'Shop' },
            { href:'/favours', label:'Party Favours' },
            { href:'/events', label:'Find a Decorator' },
            { href:'/sadaqah', label:'Baab As-Sadaqah' },
          ].map(({ href, label }) => (
            <Link key={href} href={href} style={{ fontFamily:'var(--font-cinzel)', fontSize:'12px', letterSpacing:'0.16em', color:'rgba(255,255,255,0.6)', textDecoration:'none' }}>
              {label}
            </Link>
          ))}
          {user ? (
            <>
              <Link href="/dashboard" style={{ fontFamily:'var(--font-cinzel)', fontSize:'12px', letterSpacing:'0.16em', color:'rgba(255,255,255,0.6)', textDecoration:'none' }}>My Dashboard</Link>
              <button onClick={signOut} style={{ fontFamily:'var(--font-cinzel)', fontSize:'12px', letterSpacing:'0.16em', color:'rgba(255,255,255,0.6)', background:'none', border:'none', cursor:'pointer', textAlign:'left', padding:0 }}>Sign out</button>
            </>
          ) : (
            <Link href="/auth/sign-in" style={{ fontFamily:'var(--font-cinzel)', fontSize:'12px', letterSpacing:'0.16em', color:'var(--gold)', textDecoration:'none' }}>Sign in</Link>
          )}
          <Link href="/affiliates/apply" style={{ fontFamily:'var(--font-cinzel)', fontSize:'12px', letterSpacing:'0.16em', color:'var(--gold)', border:'0.5px solid rgba(212,175,110,0.4)', padding:'10px 16px', borderRadius:'6px', textDecoration:'none', textAlign:'center' }}>
            Become an Affiliate
          </Link>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .nav-desktop-links { display: none !important; }
          .nav-mobile-toggle { display: flex !important; }
        }
      `}</style>
    </>
  )
}
