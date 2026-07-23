'use client'
import { useEffect, useRef, useState } from 'react'

// ── Google Maps JS loader ────────────────────────────────────────────────
// Loaded once, on demand, only by components that actually need Places.
// Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY with the Maps JavaScript API,
// Places API, and Maps Embed API enabled in Google Cloud Console.
let mapsLoadPromise: Promise<void> | null = null

function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if ((window as any).google?.maps?.places) return Promise.resolve()
  if (mapsLoadPromise) return mapsLoadPromise

  mapsLoadPromise = new Promise((resolve, reject) => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!key) { reject(new Error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set')); return }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&loading=async`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(script)
  })
  return mapsLoadPromise
}

export type MosquePlace = {
  name: string
  formattedAddress: string
  placeId: string
  lat: number
  lng: number
}

// ── Mosque Places Autocomplete input ─────────────────────────────────────
export function MosqueAutocomplete({
  defaultValue,
  onSelect,
  inputStyle,
}: {
  defaultValue?: string
  onSelect: (place: MosquePlace) => void
  inputStyle?: React.CSSProperties
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !inputRef.current) return
        const g = (window as any).google
        const autocomplete = new g.maps.places.Autocomplete(inputRef.current, {
          fields: ['name', 'formatted_address', 'place_id', 'geometry'],
        })
        // Bias toward religious/point-of-interest results with "mosque" in the query via the input itself
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          if (!place?.geometry?.location) return
          onSelect({
            name: place.name || inputRef.current!.value,
            formattedAddress: place.formatted_address || '',
            placeId: place.place_id || '',
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          })
        })
        setReady(true)
      })
      .catch(() => setError('Map search unavailable right now.'))
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        defaultValue={defaultValue}
        placeholder="Search for your masjid…"
        style={inputStyle}
      />
      {error && <div style={{ fontFamily: 'var(--font-inter, Georgia, serif)', fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '6px', fontStyle: 'italic' }}>{error} You can still type the name manually.</div>}
    </div>
  )
}

// ── Static embedded map for a saved mosque ───────────────────────────────
export function MosqueMapEmbed({ placeId, name, height = 200 }: { placeId?: string | null; name?: string | null; height?: number }) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key) {
    return (
      <div style={{ height, borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(212,175,110,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '16px' }}>
        <span style={{ fontFamily: 'var(--font-cormorant, Georgia, serif)', fontSize: '13px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Map unavailable — Google Maps isn't configured yet.</span>
      </div>
    )
  }
  if (!placeId) return null
  const src = `https://www.google.com/maps/embed/v1/place?key=${key}&q=place_id:${placeId}`
  return (
    <iframe
      title={name || 'Masjid location'}
      width="100%"
      height={height}
      style={{ border: 0, borderRadius: '12px', display: 'block' }}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      src={src}
    />
  )
}
