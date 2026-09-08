import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight, Compass, BookOpen, MapPin, HeartHandshake,
  Tv, ShoppingBag, ShieldCheck, Users, Sparkles,
  type LucideIcon,
} from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import LogoIntro from '@/components/LogoIntro'
import ScrollReveal from '@/components/ScrollReveal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PreviewStrip } from '@/components/home/PreviewStrip'
import PrayerPreview from '@/components/home/PrayerPreview'
import QuranPreview from '@/components/home/QuranPreview'
import { getHomePreviews } from '@/lib/home-previews'

// Server component: the live previews are fetched here so they are already
// in the HTML rather than popping in after hydration. Refreshed every
// 5 minutes — fresh enough for a headline, cheap enough to stay fast.
export const revalidate = 300

// ── Shared bits ──────────────────────────────────────────────────────────

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-4 font-cinzel text-[10px] tracking-[0.28em] text-gold">{children}</div>
)

const GoldDivider = () => (
  <div className="mx-auto flex max-w-[120px] items-center gap-3">
    <div className="h-px flex-1 bg-gold/30" />
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
      <polygon points="4,0 5,3 8,3 5.5,5 6.5,8 4,6 1.5,8 2.5,5 0,3 3,3" fill="#d4af6e" opacity="0.6" />
    </svg>
    <div className="h-px flex-1 bg-gold/30" />
  </div>
)

const fmtEventDate = (iso: string) => {
  const d = new Date(iso)
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${time}`
}

const relativeDay = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const FACTS = [
  { stat: '114', label: 'surahs, Uthmani script' },
  { stat: '5×', label: 'daily prayer times, to your location' },
  { stat: '$0', label: 'taken from any sadaqah given' },
]

const VALUES = [
  {
    Icon: ShieldCheck,
    title: 'Worship stays free',
    desc: 'Prayer times, Qibla, and the Quran carry no ads, no upsells, and no paywall. That is a commitment, not a launch offer.',
  },
  {
    Icon: Users,
    title: 'Built around the masjid',
    desc: 'Masjids list and post at no cost. The community layer only works if the institutions at its centre are never charged for it.',
  },
  {
    Icon: Sparkles,
    title: 'Nothing held in between',
    desc: 'Giving goes directly to verified charities. Green Emblem never touches the money and takes no cut.',
  },
]

// ── Pillar card shell ────────────────────────────────────────────────────

function Pillar({
  href, Icon, tag, title, desc, children,
}: {
  href: string
  Icon: LucideIcon
  tag: string
  title: string
  desc: string
  children: React.ReactNode   // the preview strip
}) {
  return (
    <Link href={href} className="group no-underline">
      <Card className="flex h-full flex-col p-6 transition-all duration-200 hover:-translate-y-1 hover:border-gold/40">
        <div className="mb-5 flex items-center justify-between">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-gold/20 bg-gold/[0.08] transition-colors group-hover:bg-gold/15">
            <Icon className="h-5 w-5 text-gold" strokeWidth={1.6} />
          </span>
          <Badge variant="muted">{tag}</Badge>
        </div>

        <h3 className="mb-2.5 font-cinzel text-[17px] text-white">{title}</h3>
        <p className="font-cormorant text-[15px] leading-[1.7] text-white/55">{desc}</p>

        <div className="flex-1" />
        {children}

        <span className="mt-4 flex items-center gap-1.5 font-cinzel text-[9px] tracking-[0.18em] text-white">
          OPEN
          <ArrowRight className="h-3 w-3 text-gold transition-transform duration-200 group-hover:translate-x-1" />
        </span>
      </Card>
    </Link>
  )
}

export default async function HomePage() {
  const { greentv, event, shop, giving } = await getHomePreviews()

  return (
    <>
      <LogoIntro />
      <ScrollReveal />
      <div className="bg-tile" aria-hidden="true" />
      <Nav />

      <main className="relative z-[2]">

        {/* ══ HERO ══ */}
        <section className="relative flex min-h-[92dvh] flex-col items-center justify-center overflow-hidden px-5 pb-20 pt-28 text-center sm:px-6">
          <div className="pointer-events-none absolute left-1/2 top-1/2 w-[min(600px,120vw)] -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.035]">
            <svg viewBox="0 0 220 220" className="h-auto w-full" aria-hidden="true">
              <rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke="#d4af6e" strokeWidth="2" />
              <rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke="#d4af6e" strokeWidth="2" transform="rotate(45 110 110)" />
              <polygon points="110,42 158,42 190,74 190,146 158,178 62,178 30,146 30,74 62,42" fill="#d4af6e" />
            </svg>
          </div>

          <div className="fade-up" style={{ animationDelay: '0.1s' }}>
            <Image
              src="/logo-full.png"
              alt="Green Emblem"
              width={170}
              height={170}
              priority
              className="mx-auto mb-7 h-auto w-[140px] sm:w-[170px]"
            />
          </div>

          <div className="fade-up max-w-[860px]" style={{ animationDelay: '0.22s' }}>
            <div className="mb-5 font-cinzel text-[9px] tracking-[0.34em] text-gold/70 sm:text-[10px]">
              FAITH · STRENGTH · PURPOSE
            </div>
            <h1 className="mb-6 font-cinzel text-[clamp(30px,7vw,64px)] font-medium leading-[1.1] tracking-[-0.01em] text-white">
              One home for faith,<br className="hidden sm:block" />{' '}
              <span className="text-gold">community, and giving</span>
            </h1>
            <p className="mx-auto mb-9 max-w-[600px] font-cormorant text-[clamp(16px,2.2vw,20px)] italic leading-[1.75] text-white/65">
              Prayer times wherever you stand. The Quran in Uthmani script. Your masjid&apos;s
              events, halal food within reach, and a free way to turn any celebration into
              sadaqah.
            </p>
            <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Button asChild variant="brand" size="lg" className="w-full sm:w-auto">
                <Link href="/explore">Explore the app</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href="/prayer">Today&apos;s prayer times</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ══ FACT STRIP ══ */}
        <section className="border-y border-gold/10 bg-forest-deepest/60 px-5 py-9 sm:px-6">
          <div className="mx-auto grid max-w-[900px] grid-cols-1 gap-7 text-center sm:grid-cols-3 sm:gap-6">
            {FACTS.map(({ stat, label }) => (
              <div key={label}>
                <div className="font-cinzel text-[30px] leading-none text-gold sm:text-[34px]">{stat}</div>
                <div className="mt-2 font-cormorant text-sm italic text-white/55">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ══ THE PLATFORM — each card previews what's behind it ══ */}
        <section className="reveal mx-auto max-w-[1120px] px-5 py-20 sm:px-6 sm:py-24">
          <div className="mb-12 text-center">
            <Eyebrow>The platform</Eyebrow>
            <h2 className="mb-4 font-cinzel text-[clamp(24px,4.5vw,40px)] font-medium leading-tight text-white">
              Everything the day asks of you,<br className="hidden sm:block" /> in one place
            </h2>
            <p className="mx-auto max-w-[560px] font-cormorant text-[17px] italic leading-relaxed text-white/50">
              Six parts of Green Emblem, each built to be the best version of itself.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

            <Pillar
              href="/prayer" Icon={Compass} tag="WORSHIP" title="Prayer & Qibla"
              desc="Prayer times calculated for your exact coordinates, with a live compass to the Kaaba."
            >
              <PrayerPreview />
            </Pillar>

            <Pillar
              href="/prayer?tab=quran" Icon={BookOpen} tag="WORSHIP" title="The Quran"
              desc="All 114 surahs in Uthmani script, with translation and Tafsir Ibn Kathir."
            >
              <QuranPreview />
            </Pillar>

            <Pillar
              href="/greenworld-plus" Icon={MapPin} tag="COMMUNITY" title="GreenWorld+"
              desc="Follow your masjid, and find masjids and halal food inside the radius you set."
            >
              {event ? (
                <PreviewStrip
                  label="NEXT IN YOUR COMMUNITY"
                  value={event.title}
                  meta={[fmtEventDate(event.startsAt), event.masjid].filter(Boolean).join(' · ')}
                />
              ) : (
                <PreviewStrip
                  label="COMMUNITY EVENTS"
                  value="Follow a masjid to see its events here"
                  muted
                />
              )}
            </Pillar>

            <Pillar
              href="/sadaqah" Icon={HeartHandshake} tag="GIVING" title="Baab As-Sadaqah"
              desc="Turn a Nikkah, Walima, or Aqiqah into charity with a QR code guests scan."
            >
              {giving ? (
                <PreviewStrip
                  label="GIVEN SO FAR"
                  value={`${giving.meals.toLocaleString()} meals funded`}
                  meta="Through Green Emblem campaigns"
                />
              ) : (
                <PreviewStrip
                  label="WHAT IT COSTS"
                  value="Free — and no cut of what's given"
                  meta="Your design, your QR code, in minutes"
                />
              )}
            </Pillar>

            <Pillar
              href="/greentv" Icon={Tv} tag="MEDIA" title="GreenTV & GreenFitness"
              desc="Community news, clips, and training content — discipline and purpose."
            >
              {greentv ? (
                <PreviewStrip
                  label="LATEST"
                  value={greentv.headline}
                  meta={relativeDay(greentv.postedAt)}
                />
              ) : (
                <PreviewStrip label="LATEST" value="New posts land here as they go out" muted />
              )}
            </Pillar>

            <Pillar
              href="/shop" Icon={ShoppingBag} tag="SHOP" title="Islamic Shop"
              desc="Clothing and accessories for the Muslim home, including Stand in the Middle."
            >
              {shop ? (
                <PreviewStrip
                  label="IN THE SHOP"
                  value={shop.name}
                  meta={shop.price != null ? `$${shop.price.toFixed(2)}` : null}
                />
              ) : (
                <PreviewStrip label="IN THE SHOP" value="New pieces arriving soon" muted />
              )}
            </Pillar>

          </div>
        </section>

        {/* ══ SPOTLIGHT — community radius ══ */}
        <section className="reveal border-y border-gold/10 bg-forest-deepest/40 px-5 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto grid max-w-[1050px] items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <Eyebrow>Your neighbourhood</Eyebrow>
              <h2 className="mb-5 font-cinzel text-[clamp(23px,3.6vw,34px)] font-medium leading-tight text-white">
                Set how far you&apos;ll travel. We&apos;ll show you what&apos;s inside it.
              </h2>
              <p className="mb-7 font-cormorant text-[17px] italic leading-[1.8] text-white/60">
                Drag the radius and the map answers: the masjids you could pray at, halal food
                worth the drive, and community events close enough to actually attend. Follow a
                masjid and its announcements come to you first.
              </p>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href="/greenworld-plus">Open GreenWorld+</Link>
              </Button>
            </div>

            <div className="order-first lg:order-last">
              <Card className="aspect-[4/3] w-full overflow-hidden p-0">
                <svg viewBox="0 0 400 300" className="h-full w-full" role="img" aria-label="Illustration of a travel radius over a map">
                  <defs>
                    <radialGradient id="ring" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#d4af6e" stopOpacity="0.16" />
                      <stop offset="100%" stopColor="#d4af6e" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <g stroke="#d4af6e" strokeOpacity="0.07" strokeWidth="1">
                    {[0, 1, 2, 3, 4, 5].map(i => <line key={`h${i}`} x1="0" y1={i * 55 + 15} x2="400" y2={i * 55 + 15} />)}
                    {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <line key={`v${i}`} x1={i * 52 + 18} y1="0" x2={i * 52 + 18} y2="300" />)}
                  </g>
                  <circle cx="200" cy="150" r="112" fill="url(#ring)" />
                  <circle cx="200" cy="150" r="112" fill="none" stroke="#d4af6e" strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="5 5" />
                  <circle cx="200" cy="150" r="70" fill="none" stroke="#d4af6e" strokeOpacity="0.2" strokeWidth="1" />
                  {[[140, 108], [268, 128], [176, 214], [246, 205], [128, 176]].map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r="5" fill={i % 2 ? '#5a9e5a' : '#d4af6e'} />
                  ))}
                  <circle cx="200" cy="150" r="8" fill="#f5f0e6" />
                  <circle cx="200" cy="150" r="14" fill="none" stroke="#f5f0e6" strokeOpacity="0.35" strokeWidth="1.5" />
                </svg>
              </Card>
            </div>
          </div>
        </section>

        {/* ══ SPOTLIGHT — giving ══ */}
        <section className="reveal mx-auto max-w-[820px] px-5 py-20 text-center sm:px-6 sm:py-24">
          <GoldDivider />
          <div className="my-9">
            <div className="mb-5 font-arabic text-[26px] text-gold/75 sm:text-[30px]" lang="ar">
              بَابُ الصَّدَقَة
            </div>
            <h2 className="mb-4 font-cinzel text-[clamp(23px,4vw,36px)] font-medium text-white">
              A celebration that keeps giving
            </h2>
            <p className="mx-auto mb-8 max-w-[600px] font-cormorant text-[17px] italic leading-[1.8] text-white/60">
              Design a QR card for your Nikkah, Walima, or Aqiqah in minutes. Guests scan it,
              choose a verified charity, and give in the honourees&apos; name — directly, with
              nothing held in between. Free, permanently.
            </p>
            <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row">
              <Button asChild variant="brand" size="lg" className="w-full sm:w-auto">
                <Link href="/sadaqah">Start a campaign</Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="w-full font-cinzel text-[11px] tracking-wider2 text-white sm:w-auto">
                <Link href="/sadaqah/request">Request one instead</Link>
              </Button>
            </div>
          </div>
          <GoldDivider />
        </section>

        {/* ══ VALUES ══ */}
        <section className="reveal border-t border-gold/10 bg-forest-deepest/50 px-5 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-[1050px]">
            <div className="mb-12 text-center">
              <Eyebrow>What we hold to</Eyebrow>
              <h2 className="font-cinzel text-[clamp(23px,4vw,36px)] font-medium text-white">
                The parts we will never charge for
              </h2>
            </div>
            <div className="grid gap-8 sm:grid-cols-3 sm:gap-10">
              {VALUES.map(({ Icon, title, desc }) => (
                <div key={title} className="text-center sm:text-left">
                  <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-gold/20 bg-gold/[0.08]">
                    <Icon className="h-5 w-5 text-gold" strokeWidth={1.6} />
                  </span>
                  <h3 className="mb-2.5 font-cinzel text-[15px] text-white">{title}</h3>
                  <p className="font-cormorant text-[15px] leading-[1.75] text-white/55">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ CLOSING CTA ══ */}
        <section className="reveal mx-auto max-w-[720px] px-5 py-20 text-center sm:px-6 sm:py-28">
          <h2 className="mb-4 font-cinzel text-[clamp(24px,4.5vw,40px)] font-medium leading-tight text-white">
            Start where you are
          </h2>
          <p className="mb-9 font-cormorant text-[17px] italic leading-[1.8] text-white/55">
            Check today&apos;s prayer times, open the Quran, or find your masjid. No account
            needed to begin.
          </p>
          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row">
            <Button asChild variant="brand" size="lg" className="w-full sm:w-auto">
              <Link href="/explore">Explore the app</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link href="/auth/sign-in">Create an account</Link>
            </Button>
          </div>
        </section>

      </main>
      <Footer />
    </>
  )
}
