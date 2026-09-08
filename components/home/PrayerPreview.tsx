'use client'
import { useEffect, useState } from 'react'
import { computeDayTimes, orderedPrayers, fmtTime, type CalcMethodId } from '@/lib/prayer'
import { PreviewStrip } from './PreviewStrip'

const LOCATION_CACHE_KEY = 'ge_prayer_location'

// Shows the next prayer using the location the Prayer page already cached.
// Deliberately does NOT ask for geolocation — the homepage should never
// trigger a permission prompt. Visitors who haven't used the Prayer page yet
// see an invitation instead.
export default function PrayerPreview() {
  const [next, setNext] = useState<{ label: string; time: string; countdown: string } | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let coords: { lat: number; lng: number } | null = null
    let method: CalcMethodId = 'MuslimWorldLeague'
    let madhab: 'shafi' | 'hanafi' = 'shafi'
    try {
      const raw = localStorage.getItem(LOCATION_CACHE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        // Same 24h freshness window the Prayer page uses
        if (parsed?.coords && Date.now() - parsed.savedAt < 24 * 60 * 60 * 1000) coords = parsed.coords
      }
    } catch {}

    if (!coords) { setReady(true); return }

    const tick = () => {
      try {
        const now = new Date()
        const times = computeDayTimes(coords!.lat, coords!.lng, now, method)
        const prayers = orderedPrayers(times, madhab).filter(p => p.key !== 'sunrise')
        let upcoming = prayers.find(p => p.time > now)

        if (!upcoming) {
          // Past Isha — next is tomorrow's Fajr
          const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
          const t = computeDayTimes(coords!.lat, coords!.lng, tomorrow, method)
          upcoming = orderedPrayers(t, madhab)[0]
        }
        if (!upcoming) { setReady(true); return }

        const diffMin = Math.max(0, Math.round((upcoming.time.getTime() - now.getTime()) / 60000))
        const h = Math.floor(diffMin / 60)
        const m = diffMin % 60
        setNext({
          label: upcoming.label,
          time: fmtTime(upcoming.time),
          countdown: h > 0 ? `in ${h}h ${m}m` : `in ${m}m`,
        })
      } catch {}
      setReady(true)
    }

    tick()
    const id = setInterval(tick, 60000)
    return () => clearInterval(id)
  }, [])

  if (!ready) {
    return <PreviewStrip label="NEXT PRAYER" value="…" muted />
  }
  if (!next) {
    return <PreviewStrip label="NEXT PRAYER" value="Share your location to see today's times" muted />
  }
  return (
    <PreviewStrip
      label="NEXT PRAYER"
      value={
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-cinzel text-[15px] text-gold">{next.label}</span>
          <span className="text-white">{next.time}</span>
        </span>
      }
      meta={next.countdown}
    />
  )
}
