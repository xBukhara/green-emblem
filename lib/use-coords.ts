'use client'
import { useCallback, useEffect, useState } from 'react'

export const LOCATION_CACHE_KEY = 'ge_prayer_location'

export type Coords = { lat: number; lng: number; label?: string }
export type LocStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'error'

// ── Shared location, one cache ───────────────────────────────────────────
// /prayer, /qibla and the Nearby map all need the same coordinates, and all
// read the same cached value so nobody is asked for permission twice. The
// cache is written once per day; see the privacy note in push-and-pwa.md
// about why coordinates are not stored more precisely than they need to be.
export function useCoords() {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [status, setStatus] = useState<LocStatus>('idle')

  const request = useCallback(() => {
    if (!navigator.geolocation) { setStatus('error'); return }
    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      pos => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setCoords(c); setStatus('granted')
        try { localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ coords: c, savedAt: Date.now() })) } catch {}
      },
      err => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error'),
      { timeout: 10000, maximumAge: 60 * 60 * 1000 }
    )
  }, [])

  // Try the cache first, then ask.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCATION_CACHE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.coords && Date.now() - parsed.savedAt < 24 * 60 * 60 * 1000) {
          setCoords(parsed.coords); setStatus('granted'); return
        }
      }
    } catch {}
    request()
  }, [request])

  return { coords, status, request }
}
