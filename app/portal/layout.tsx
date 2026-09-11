import type { Metadata } from 'next'
import { HIDE_CONSUMER_CHROME_CSS } from '@/lib/surface'

export const metadata: Metadata = {
  title: { default: 'Masjid Portal · Green Emblem', template: '%s · Masjid Portal' },
  description: 'Post events, fundraisers, programs and youth announcements to your community.',
  robots: { index: false, follow: false },   // the portal is not for search engines
}

// The portal is a separate product surface: no consumer nav, no bottom tab
// bar, no install prompt. Those are mounted in the ROOT layout, which this
// nested layout cannot reach, so suppression happens twice over:
//
//   1. This stylesheet, server-rendered, hides them before the first paint.
//      Needed because portal pages are statically rendered and so cannot
//      read the request hostname on the server.
//   2. The components themselves unmount on hydration once they can see
//      window.location (lib/surface.ts) — which also stops the service
//      worker registering and the install banner firing on this host.
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#0c1f0c]">
      <style dangerouslySetInnerHTML={{ __html: HIDE_CONSUMER_CHROME_CSS }} />
      {children}
    </div>
  )
}
