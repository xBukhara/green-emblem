'use client'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import LogoIntro from '@/components/LogoIntro'
import ScrollReveal from '@/components/ScrollReveal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const GoldDivider = () => (
  <div className="mx-auto flex max-w-[120px] items-center gap-3">
    <div className="h-px flex-1 bg-gold/30" />
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
      <polygon points="4,0 5,3 8,3 5.5,5 6.5,8 4,6 1.5,8 2.5,5 0,3 3,3" fill="#d4af6e" opacity="0.6" />
    </svg>
    <div className="h-px flex-1 bg-gold/30" />
  </div>
)

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-3.5 font-cinzel text-[9px] tracking-[0.28em] text-gold">{children}</div>
)

const STEPS = [
  {
    num: '01',
    title: 'Tell us the occasion',
    desc: 'Share the honourees’ names, the event type, and the date. Takes under a minute.',
    cta: 'Request a campaign',
    href: '/sadaqah/request',
  },
  {
    num: '02',
    title: 'Design it yourself',
    desc: 'Pick a colorway, font, and pattern in the design studio. See it rendered live as you go. Goes live the moment you publish — no approval wait.',
    cta: 'See the design studio',
    href: '/sadaqah',
  },
  {
    num: '03',
    title: 'Print and share the code',
    desc: 'Download a QR card styled to match your event. Place it on tables. Guests scan, choose a charity, and give — directly, with nothing held by Green Emblem.',
    cta: 'How giving works',
    href: '/sadaqah',
  },
]

export default function HomePage() {
  return (
    <>
      <LogoIntro />
      <ScrollReveal />
      <div className="bg-tile" aria-hidden="true" />
      <Nav />

      <main className="relative z-[2]">

        {/* ── HERO ── */}
        <section className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 pb-16 pt-28 text-center">
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.03]">
            <svg width="600" height="600" viewBox="0 0 220 220" aria-hidden="true">
              <rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke="#d4af6e" strokeWidth="2" />
              <rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke="#d4af6e" strokeWidth="2" transform="rotate(45 110 110)" />
              <polygon points="110,42 158,42 190,74 190,146 158,178 62,178 30,146 30,74 62,42" fill="#d4af6e" />
            </svg>
          </div>

          <div className="fade-up" style={{ animationDelay: '0.1s' }}>
            <div className="mb-5 font-arabic text-[22px] text-gold/60" lang="ar">
              بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
            </div>
          </div>

          <div className="fade-up" style={{ animationDelay: '0.2s' }}>
            <Image
              src="/logo-full.png"
              alt="Green Emblem — Faith. Strength. Purpose."
              width={190}
              height={190}
              priority
              className="mx-auto mb-6 h-auto w-[190px]"
            />
          </div>

          <div className="fade-up" style={{ animationDelay: '0.3s' }}>
            <div className="mb-3.5 font-arabic text-[26px] text-gold/75" lang="ar">
              بَابُ الصَّدَقَة
            </div>
            <h1 className="mb-5 font-cinzel text-[clamp(36px,7vw,72px)] font-medium leading-[1.08] tracking-[-0.01em] text-white">
              Every celebration<br />
              <span className="text-gold">honoured with</span><br />
              sadaqah
            </h1>
          </div>

          <div className="fade-up max-w-[520px]" style={{ animationDelay: '0.5s' }}>
            <p className="mb-10 font-cormorant text-[clamp(16px,2.5vw,20px)] italic leading-[1.75] text-white/55">
              Scan a QR code at any Nikkah, Walima, or Aqiqah, and turn the celebration into charity
              given in someone&apos;s honour. Free to start. No fees. No middleman.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild variant="brand" size="lg">
                <Link href="/sadaqah">Start Baab As-Sadaqah</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/shop">Visit the shop</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="reveal mx-auto max-w-[1100px] px-6 py-20">
          <div className="mb-14 text-center">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="font-cinzel text-[clamp(24px,4vw,38px)] font-medium leading-tight text-white">
              From request to QR code<br />in minutes
            </h2>
          </div>

          <div className="reveal reveal-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map(({ num, title, desc, cta, href }) => (
              <Link key={num} href={href} className="group no-underline">
                <Card className="h-full p-7 transition-all duration-200 hover:-translate-y-1 hover:border-gold/35">
                  <div className="mb-3.5 font-cinzel text-[26px] text-gold/50 transition-colors group-hover:text-gold/80">
                    {num}
                  </div>
                  <div className="mb-3 font-cinzel text-[15px] font-medium text-white">{title}</div>
                  <p className="mb-5 font-cormorant text-[15px] leading-[1.7] text-white/60">{desc}</p>
                  <div className="flex items-center gap-1.5 font-cinzel text-[9px] tracking-[0.18em] text-gold">
                    {cta}
                    <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* ── SADAQAH HIGHLIGHT ── */}
        <section className="reveal border-y border-gold/10 bg-forest/20 px-6 py-[70px]">
          <div className="mx-auto max-w-[800px] text-center">
            <GoldDivider />
            <div className="my-8">
              <div className="mb-4 font-arabic text-[28px] text-gold/70" lang="ar">
                بَابُ الصَّدَقَة
              </div>
              <h2 className="mb-3.5 font-cinzel text-[clamp(22px,4vw,36px)] font-medium text-white">
                Free, because it should be
              </h2>
              <p className="mx-auto mb-8 max-w-[560px] font-cormorant text-lg italic leading-[1.8] text-white/55">
                Baab As-Sadaqah will always be free to use. Guests give directly to verified charities
                like Share The Meal, Islamic Relief USA, and UNICEF USA — Green Emblem never touches
                the money.
              </p>
              <Button asChild variant="brand" size="lg">
                <Link href="/sadaqah">Request a campaign</Link>
              </Button>
            </div>
            <GoldDivider />
          </div>
        </section>

        {/* ── SHOP TEASER ── */}
        <section className="reveal mx-auto max-w-[700px] px-6 py-20 text-center">
          <SectionLabel>The shop</SectionLabel>
          <h2 className="mb-3.5 font-cinzel text-[clamp(22px,4vw,36px)] font-medium text-white">
            Stand in the Middle
          </h2>
          <p className="mb-8 font-cormorant text-lg italic leading-[1.75] text-white/50">
            Clothing and accessories for the Muslim home — a reminder to take the balanced path,
            and refrain from division.
          </p>
          <Button asChild variant="brand" size="lg">
            <Link href="/shop">Visit the shop</Link>
          </Button>
        </section>

      </main>
      <Footer />
    </>
  )
}
