import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export const metadata = {
  title: 'Explore',
  description: 'Worship, community, and media — every part of Green Emblem in one place.',
}

type Section = {
  href: string | null
  tag: string
  tone: 'default' | 'green' | 'violet' | 'muted'
  title: string
  desc: string
}

const SECTIONS: Section[] = [
  {
    href: '/greenworld-plus', tone: 'violet', tag: 'COMMUNITY',
    title: 'GreenWorld+',
    desc: 'Follow your masjid, see local events, and explore masjids and halal food within your travel radius.',
  },
  {
    href: '/prayer', tone: 'default', tag: 'WORSHIP',
    title: 'Prayer & Qibla',
    desc: 'Accurate prayer times for your location, a live Qibla compass, and your madhab preferences.',
  },
  {
    href: '/prayer?tab=quran', tone: 'default', tag: 'WORSHIP',
    title: 'Quran',
    desc: 'Read any surah in Uthmani script with translation and Tafsir Ibn Kathir — your place remembered.',
  },
  {
    href: '/greentv', tone: 'green', tag: 'MEDIA',
    title: 'GreenTV',
    desc: 'News, community clips, and live moments from the Green Emblem community.',
  },
  {
    href: '/greenfitness', tone: 'green', tag: 'MEDIA',
    title: 'GreenFitness',
    desc: 'Fitness coaching and training content, rooted in discipline and purpose.',
  },
  {
    href: '/shop', tone: 'default', tag: 'SHOP',
    title: 'Islamic Shop',
    desc: 'Curated Islamic products and Green Emblem merchandise.',
  },
  {
    href: null, tone: 'muted', tag: 'COMING SOON',
    title: 'Local Businesses',
    desc: 'Muslim-owned businesses near you — reviews, halal verification, and community-first promotion.',
  },
]

export default function ExplorePage() {
  return (
    <>
      <div className="bg-tile" aria-hidden="true" />
      <Nav />

      <main className="relative z-[2] mx-auto min-h-[100dvh] max-w-[900px] px-5 pb-20 pt-32 sm:px-6">

        <header className="mb-11 text-center">
          <div className="mb-4 font-cinzel text-[10px] tracking-[0.3em] text-gold">EXPLORE</div>
          <h1 className="mb-3 font-cinzel text-[clamp(28px,5vw,44px)] font-medium text-white">
            Everything Green Emblem
          </h1>
          <p className="font-cormorant text-[17px] italic leading-[1.7] text-white/50">
            Worship, community, and media — one place.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map(s => {
            const body = (
              <Card
                className={cn(
                  'flex h-full flex-col p-6 transition-all duration-200',
                  s.href
                    ? 'hover:-translate-y-1 hover:border-gold/35'
                    : 'opacity-70'
                )}
              >
                <Badge variant={s.tone} className="mb-3.5 self-start">{s.tag}</Badge>
                <h2 className={cn('mb-2 font-cinzel text-lg', s.href ? 'text-white' : 'text-white/50')}>
                  {s.title}
                </h2>
                <p className="flex-1 font-cormorant text-sm italic leading-relaxed text-white/45">
                  {s.desc}
                </p>
                {s.href && (
                  <div className="mt-4 flex items-center gap-1.5 font-cinzel text-[9px] tracking-[0.18em] text-white">
                    OPEN
                    <ArrowRight className="h-3 w-3 text-gold transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                )}
              </Card>
            )

            return s.href ? (
              <Link key={s.title} href={s.href} className="group no-underline">{body}</Link>
            ) : (
              <div key={s.title}>{body}</div>
            )
          })}
        </div>
      </main>

      <Footer />
    </>
  )
}
