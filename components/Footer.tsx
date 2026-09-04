import Link from 'next/link'
import Image from 'next/image'
import { Separator } from '@/components/ui/separator'

const PLATFORM = [
  { href: '/sadaqah',           label: 'Baab As-Sadaqah' },
  { href: '/prayer',            label: 'Prayer & Qibla' },
  { href: '/prayer?tab=quran',  label: 'Quran' },
  { href: '/greenworld-plus',   label: 'GreenWorld+' },
  { href: '/shop',              label: 'Islamic Shop' },
]

const COMPANY = [
  { href: '/about',   label: 'About Us' },
  { href: '/contact', label: 'Contact' },
  { href: '/terms',   label: 'Terms of Service' },
  { href: '/privacy', label: 'Privacy Policy' },
]

const linkClass =
  'font-cormorant text-sm italic text-white/55 no-underline transition-colors hover:text-gold'

const colTitleClass =
  'mb-4 font-cinzel text-[9px] tracking-[0.2em] text-gold/80'

export default function Footer() {
  return (
    <footer className="border-t border-gold/10 bg-[#080f08] px-6 pb-8 pt-14 lg:px-10">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr] lg:gap-12">

          {/* Brand */}
          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <Image src="/icon.png" alt="" width={30} height={30} className="rounded-md" aria-hidden="true" />
              <span className="font-cinzel text-[13px] tracking-[0.2em] text-cream">
                GREEN <span className="text-gold">★</span> EMBLEM
              </span>
            </div>
            <div className="mb-3 font-cinzel text-[9px] tracking-[0.34em] text-gold/60">
              FAITH · STRENGTH · PURPOSE
            </div>
            <p className="max-w-[260px] font-cormorant text-sm italic leading-relaxed text-white/35">
              Islamic events, giving &amp; community. Every celebration honoured with intention.
            </p>
          </div>

          {/* Platform */}
          <div>
            <div className={colTitleClass}>Platform</div>
            <div className="flex flex-col gap-2.5">
              {PLATFORM.map(({ href, label }) => (
                <Link key={href} href={href} className={linkClass}>{label}</Link>
              ))}
            </div>
          </div>

          {/* Company */}
          <div>
            <div className={colTitleClass}>Company</div>
            <div className="flex flex-col gap-2.5">
              {COMPANY.map(({ href, label }) => (
                <Link key={href} href={href} className={linkClass}>{label}</Link>
              ))}
            </div>
          </div>
        </div>

        <Separator className="bg-white/[0.06]" />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-5">
          <span className="font-cinzel text-[11px] tracking-wide text-white/30">
            © 2026 Green Emblem. All rights reserved.
          </span>
          <span className="font-arabic text-sm text-gold/45" lang="ar">
            بَارَكَ اللَّهُ فِيهِ
          </span>
        </div>
      </div>
    </footer>
  )
}
