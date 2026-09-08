'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/prayer',            label: 'Prayer' },
  { href: '/prayer?tab=quran',  label: 'Quran' },
  { href: '/explore',           label: 'Explore' },
  { href: '/shop',              label: 'Shop' },
]

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

  // Lock body scroll while the mobile sheet is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const isActive = (href: string) => {
    const base = href.split('?')[0]
    const qs = href.split('?')[1]
    if (qs) return pathname === base && typeof window !== 'undefined' && window.location.search.includes(qs)
    return base === '/' ? pathname === '/' : pathname?.startsWith(base)
  }

  return (
    <>
      <nav
        role="navigation"
        aria-label="Main navigation"
        className={cn(
          'fixed inset-x-0 top-0 z-[100] h-[68px] border-b transition-colors duration-300',
          'backdrop-blur-xl',
          scrolled ? 'border-gold/25 bg-forest-deepest/95' : 'border-gold/10 bg-forest-dark/85'
        )}
      >
        <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-6 lg:px-10">

          <Link href="/" className="-my-1 flex min-h-[44px] items-center gap-3 py-1 no-underline">
            <Image src="/icon.png" alt="" width={32} height={32} className="rounded-md" priority />
            <span className="font-cinzel text-[13px] tracking-brand text-cream">
              GREEN <span className="text-gold">★</span> EMBLEM
            </span>
          </Link>

          {/* Desktop */}
          <ul className="hidden list-none items-center gap-8 lg:flex">
            {LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'relative font-cinzel text-[10px] tracking-wider2 no-underline transition-colors',
                    'after:absolute after:-bottom-1.5 after:left-0 after:h-px after:bg-gold after:transition-all after:duration-300',
                    isActive(href)
                      ? 'text-white after:w-full'
                      : 'text-white/70 hover:text-white after:w-0 hover:after:w-full'
                  )}
                >
                  {label}
                </Link>
              </li>
            ))}
            {user ? (
              <>
                <li>
                  <Link href="/dashboard" className="font-cinzel text-[10px] tracking-wider2 text-white/70 no-underline transition-colors hover:text-white">
                    My Dashboard
                  </Link>
                </li>
                <li>
                  <button onClick={signOut} className="cursor-pointer border-none bg-transparent p-0 font-cinzel text-[10px] tracking-wider2 text-white/70 transition-colors hover:text-white">
                    Sign out
                  </button>
                </li>
              </>
            ) : (
              <li>
                <Link href="/auth/sign-in" className="font-cinzel text-[10px] tracking-wider2 text-white/70 no-underline transition-colors hover:text-white">
                  Sign in
                </Link>
              </li>
            )}
            <li>
              <Button asChild variant="brand" size="sm">
                <Link href="/explore">Explore</Link>
              </Button>
            </li>
          </ul>

          {/* Mobile toggle */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="-mr-2 flex h-11 w-11 cursor-pointer items-center justify-center border-none bg-transparent text-gold lg:hidden"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile sheet */}
      <div
        className={cn(
          'fixed inset-x-0 top-[68px] z-[99] origin-top border-b border-gold/15 bg-forest-deepest/95 backdrop-blur-xl transition-all duration-200 lg:hidden',
          menuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
        )}
      >
        <div className="flex flex-col gap-1 p-5">
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'rounded-md px-3 py-3 font-cinzel text-[12px] tracking-wider2 no-underline transition-colors',
                isActive(href) ? 'bg-gold/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
              )}
            >
              {label}
            </Link>
          ))}
          {user ? (
            <>
              <Link href="/dashboard" className="rounded-md px-3 py-3 font-cinzel text-[12px] tracking-wider2 text-white/70 no-underline transition-colors hover:bg-white/5 hover:text-white">
                My Dashboard
              </Link>
              <button onClick={signOut} className="cursor-pointer rounded-md border-none bg-transparent px-3 py-3 text-left font-cinzel text-[12px] tracking-wider2 text-white/70 transition-colors hover:bg-white/5 hover:text-white">
                Sign out
              </button>
            </>
          ) : (
            <Link href="/auth/sign-in" className="rounded-md px-3 py-3 font-cinzel text-[12px] tracking-wider2 text-white no-underline transition-colors hover:bg-white/5">
              Sign in
            </Link>
          )}
          <Button asChild variant="brand" className="mt-2 w-full">
            <Link href="/explore">Explore</Link>
          </Button>
        </div>
      </div>
    </>
  )
}
