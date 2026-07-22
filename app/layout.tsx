import type { Metadata } from 'next'
import { Cinzel, Cormorant_Garamond, Noto_Naskh_Arabic, Inter } from 'next/font/google'
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

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
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
    <html lang="en" className={`${cinzel.variable} ${cormorant.variable} ${arabic.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  )
}
