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
    <Link href="/" style={{ display:'flex', alignItems:'center', gap:'11px', textDecoration:'none' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.png" alt="Green Emblem" width={32} height={32} style={{ borderRadius:'7px', display:'block' }}/>
      <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'13px', letterSpacing:'0.22em', color:'#e9e4d8' }}>
        GREEN <span style={{ color:'#d4af6e' }}>★</span> EMBLEM
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
    textDecoration: 'none', transition: 'color 0.2s',
  }

  return (
    <>
      <nav style={navStyle} role="navigation" aria-label="Main navigation">
        <Logo />

        <ul className="nav-desktop-links" style={{ display:'flex', alignItems:'center', gap:'28px', listStyle:'none' }}>
          <li><Link href="/shop" style={linkStyle}>Shop</Link></li>
          {user ? (
            <>
              <li><Link href="/dashboard" style={linkStyle}>My Dashboard</Link></li>
              <li>
                <button onClick={signOut} style={{ ...linkStyle, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                  Sign out
                </button>
              </li>
            </>
          ) : (
            <li>
              <Link href="/auth/sign-in" style={linkStyle}>Sign in</Link>
            </li>
          )}
          <li>
            <Link href="/sadaqah" style={{
              fontFamily:'var(--font-cinzel)', fontSize:'10px', letterSpacing:'0.14em',
              color:'var(--forest-dark)', background:'var(--gold)',
              padding:'8px 20px', borderRadius:'6px', textDecoration:'none',
            }}>
              Start Baab As-Sadaqah
            </Link>
          </li>
        </ul>

        <button
          className="nav-mobile-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          style={{ background:'none', border:'none', cursor:'pointer', flexDirection:'column', gap:'5px', padding:'4px', display:'none' }}
        >
          {[0,1,2].map(i => (
            <span key={i} style={{ display:'block', width:'22px', height:'1.5px', background:'var(--gold)', borderRadius:'1px' }}/>
          ))}
        </button>
      </nav>

      {menuOpen && (
        <div style={{
          position:'fixed', top:'68px', left:0, right:0, zIndex:99,
          background:'rgba(8,15,8,0.97)', borderBottom:'0.5px solid rgba(212,175,110,0.15)',
          padding:'20px', display:'flex', flexDirection:'column', gap:'16px',
        }}>
          {[
            { href:'/shop', label:'Shop' },
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
          <Link href="/sadaqah" style={{ fontFamily:'var(--font-cinzel)', fontSize:'12px', letterSpacing:'0.16em', color:'var(--forest-dark)', background:'var(--gold)', padding:'10px 16px', borderRadius:'6px', textDecoration:'none', textAlign:'center' }}>
            Start Baab As-Sadaqah
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
