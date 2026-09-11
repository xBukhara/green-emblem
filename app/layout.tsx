import type { Metadata, Viewport } from 'next'
import { Cinzel, Cormorant_Garamond, Noto_Naskh_Arabic, Inter, Amiri_Quran } from 'next/font/google'
import BottomNav from '@/components/BottomNav'
import PWARegister from '@/components/PWARegister'
import InstallPrompt from '@/components/InstallPrompt'
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

export const viewport: Viewport = {
  themeColor: '#143314',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',   // lets content sit under the iOS home indicator
}

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
  manifest: '/manifest.json',
  applicationName: 'Green Emblem',
  appleWebApp: {
    capable: true,
    title: 'Green Emblem',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icon.png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${cormorant.variable} ${arabic.variable} ${inter.variable} ${amiriQuran.variable}`}>
      <body>
        {children}
        <BottomNav/>
        <PWARegister/>
        <InstallPrompt/>
      </body>
    </html>
  )
}
