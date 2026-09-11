'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, CalendarDays, Building2, LogOut, Menu, X, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/portal',         label: 'Overview', Icon: LayoutDashboard, exact: true },
  { href: '/portal/posts',   label: 'Posts',    Icon: CalendarDays },
  { href: '/portal/profile', label: 'Masjid',   Icon: Building2 },
]

export default function PortalShell({
  masjidName, children,
}: { masjidName?: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [pathname])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/portal/sign-in')
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname?.startsWith(href)

  const navList = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, Icon, exact }) => {
        const active = isActive(href, exact)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] no-underline transition-colors',
              active ? 'bg-gold/12 text-gold' : 'text-white/60 hover:bg-white/5 hover:text-white'
            )}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
            {label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="flex min-h-[100dvh]">
      {/* Desktop sidebar */}
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-white/8 bg-[#0a1a0a] lg:flex">
        <div className="border-b border-white/8 px-5 py-5">
          <Link href="/portal" className="flex items-center gap-2.5 no-underline">
            <Image src="/icons/icon-192.png" alt="" width={28} height={28} className="rounded-md" />
            <span className="font-cinzel text-[11px] tracking-[0.18em] text-cream">GREEN EMBLEM</span>
          </Link>
          <div className="mt-3 font-cinzel text-[9px] tracking-[0.2em] text-gold/70">MASJID PORTAL</div>
        </div>

        {masjidName && (
          <div className="border-b border-white/8 px-5 py-4">
            <div className="mb-1 text-[9px] uppercase tracking-[0.16em] text-white/35">Managing</div>
            <div className="truncate font-cinzel text-[14px] text-white">{masjidName}</div>
          </div>
        )}

        <div className="flex-1 px-3 py-4">{navList}</div>

        <div className="border-t border-white/8 p-3">
          <a
            href="https://green-emblem.com/greenworld-plus"
            target="_blank"
            rel="noreferrer"
            className="mb-1 flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] text-white/45 no-underline transition-colors hover:bg-white/5 hover:text-white"
          >
            <ExternalLink className="h-[18px] w-[18px]" strokeWidth={1.7} />
            View public page
          </a>
          <button
            onClick={signOut}
            className="flex w-full cursor-pointer items-center gap-3 rounded-md border-none bg-transparent px-3 py-2.5 text-left text-[13px] text-white/45 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.7} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-white/8 bg-[#0a1a0a] px-4 lg:hidden">
          <div className="flex items-center gap-2.5">
            <Image src="/icons/icon-192.png" alt="" width={24} height={24} className="rounded" />
            <span className="font-cinzel text-[10px] tracking-[0.16em] text-gold">MASJID PORTAL</span>
          </div>
          <button
            onClick={() => setOpen(v => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="flex h-11 w-11 cursor-pointer items-center justify-center border-none bg-transparent text-white/70"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {open && (
          <div className="border-b border-white/8 bg-[#0a1a0a] px-3 py-3 lg:hidden">
            {masjidName && (
              <div className="mb-2 px-3 font-cinzel text-[13px] text-white">{masjidName}</div>
            )}
            {navList}
            <button
              onClick={signOut}
              className="mt-1 flex w-full cursor-pointer items-center gap-3 rounded-md border-none bg-transparent px-3 py-2.5 text-left text-[13px] text-white/45"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={1.7} />
              Sign out
            </button>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-7 sm:py-8">{children}</main>
      </div>
    </div>
  )
}
