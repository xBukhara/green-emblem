import NearbyScreen from '@/components/NearbyScreen'

export const metadata = {
  title: 'Nearby',
  description: 'Masjids, halal food and community events within your travel radius.',
  // A full-screen map is not a page a search engine should land someone on —
  // it is useless without their location.
  robots: { index: false, follow: true },
}

// Full-bleed map screen. There is intentionally no Nav and no Footer here:
// the tab bar is suppressed for this route in lib/surface.ts, and the screen
// carries its own back control. See the notes at the top of NearbyScreen.
export default function NearbyPage() {
  return <NearbyScreen />
}
