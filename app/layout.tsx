import type { Metadata } from 'next'
import { Cinzel, Cormorant_Garamond, Noto_Naskh_Arabic, Inter, Amiri_Quran } from 'next/font/google'
import BottomNav from '@/components/BottomNav'
import './globals.css'

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-cinzel',
  display: 'swap',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

const arabic = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500'],
  variable: '--font-arabic',
  display: 'swap',
})

// Quranic typesetting face. Amiri Quran is purpose-built for Quranic text
// (full Uthmani diacritic coverage) and is always available from Google
// Fonts, so the reader can never fall back to a face that mangles the
// marks. If /public/fonts/UthmanicHafs.woff2 is present (see APPLY notes),
// the @font-face in globals.css takes precedence over this.
const amiriQuran = Amiri_Quran({
  subsets: ['arabic'],
  weight: ['400'],
  variable: '--font-amiri-quran',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://green-emblem.com'),
  title: {
    default: 'Green Emblem — Islamic Events, Giving & Community',
    template: '%s | Green Emblem',
  },
  description: 'Free QR-code charitable giving for Islamic events — turn any Nikkah, Walima, or Aqiqah into sadaqah given in someone\'s honour.',
  keywords: ['Islamic events', 'sadaqah', 'charity QR code', 'Nikkah', 'Walima', 'Aqiqah', 'halal', 'Muslim giving'],
  openGraph: {
    title: 'Green Emblem',
    description: 'Faith. Strength. Purpose.',
    url: 'https://green-emblem.com',
    siteName: 'Green Emblem',
    locale: 'en_US',
    type: 'website',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${cormorant.variable} ${arabic.variable} ${inter.variable} ${amiriQuran.variable}`}>
      <body>
        {children}
        <BottomNav/>
      </body>
    </html>
  )
}
