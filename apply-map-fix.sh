#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
#  GREEN EMBLEM — FIX: GreenWorld+ map not loading on first visit
#
#  The Maps script is requested with `loading=async`, so its onload fires
#  before google.maps.Map / google.maps.places exist. The old code resolved
#  on onload and immediately built the map, which threw. That is why the map
#  only appeared after visiting Dashboard → Profile first: that page also
#  triggers a load, and by the time you navigated back the libraries had
#  finished bootstrapping.
#
#  Run from the root of your green-emblem project:
#      bash apply-map-fix.sh
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

if [ ! -f package.json ] || [ ! -d app ]; then
  echo "✗ Run this from the root of the green-emblem project."
  exit 1
fi

BACKUP=".portal-backup/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/components" "components"
if [ -f components/MosqueMap.tsx ]; then cp components/MosqueMap.tsx "$BACKUP/components/MosqueMap.tsx"; fi
echo "→ Backed up the old file to $BACKUP"

cat > components/MosqueMap.tsx <<'GE_EOF_A0A90F93'
'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

// ── Google Maps JS loader ────────────────────────────────────────────────
// Loaded once, on demand, only by components that actually need it.
// Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY with the Maps JavaScript API and
// Places API enabled in Google Cloud Console.
let mapsLoadPromise: Promise<void> | null = null

// The libraries this file actually uses: 'core' carries SymbolPath and
// LatLngBounds, 'maps' the Map/Marker/Circle/InfoWindow classes, 'places'
// the search services, 'geometry' the spherical helpers.
const MAPS_LIBRARIES = ['core', 'maps', 'places', 'geometry'] as const

// The API surface this file touches. Anything less than this is "not loaded".
function mapsReady(): boolean {
  const g = (window as any).google
  return !!(g?.maps?.Map && g?.maps?.places?.PlacesService)
}

function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (mapsReady()) return Promise.resolve()
  if (mapsLoadPromise) return mapsLoadPromise

  const promise = new Promise<void>((resolve, reject) => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!key) { reject(new Error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set')); return }

    // ── Why this is not just `onload: resolve` ──────────────────────────
    // The script is requested with `loading=async`, which means onload
    // fires as soon as the small BOOTSTRAP loader arrives — at that moment
    // google.maps.Map and google.maps.places do not exist yet. Resolving
    // there and calling `new google.maps.Map(...)` throws, the caller's
    // .catch() shows "couldn't load the map", and it never retries.
    //
    // That was the GreenWorld+ bug: the map only appeared after visiting a
    // page that had already triggered a load (Dashboard → Profile mounts
    // the mosque autocomplete), because by the time you navigated back the
    // libraries had finished bootstrapping in the background and the
    // early-return above caught it.
    //
    // importLibrary is the documented way to wait for the real API, and it
    // populates the google.maps namespace the rest of this file uses.
    const whenReady = () => {
      const g = (window as any).google
      const libs = g?.maps?.importLibrary
        ? Promise.all(MAPS_LIBRARIES.map(l => g.maps.importLibrary(l)))
        : Promise.resolve([])   // legacy loader: everything is there already
      libs
        .then(() => {
          if (!mapsReady()) throw new Error('Google Maps loaded but its API never became available')
          resolve()
        })
        .catch(reject)
    }

    const fail = (err: Error) => {
      // Drop the tag so a retry starts from a clean slate.
      document.querySelectorAll('script[data-google-maps]').forEach(s => s.remove())
      reject(err)
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps]')
    if (existing) {
      existing.addEventListener('load', whenReady)
      existing.addEventListener('error', () => fail(new Error('Failed to load Google Maps')))
      if ((window as any).google?.maps) whenReady()
      return
    }

    const script = document.createElement('script')
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${key}` +
      `&libraries=${MAPS_LIBRARIES.join(',')}&loading=async&v=weekly`
    script.async = true
    script.dataset.googleMaps = 'true'
    script.onload = whenReady
    script.onerror = () => fail(new Error('Failed to load Google Maps'))
    document.head.appendChild(script)
  })

  mapsLoadPromise = promise
  // Never cache a failure. A rejected promise kept here would disable every
  // map for the rest of the session, turning one flaky request into a dead
  // feature until a full page reload.
  promise.catch(() => { if (mapsLoadPromise === promise) mapsLoadPromise = null })

  return promise
}

// ── Green Emblem map style ───────────────────────────────────────────────
// Custom styled-map JSON so the map reads as part of the app itself —
// deep forest ground, muted gold accents, no default Google POI clutter.
export const GE_MAP_STYLE: any[] = [
  { elementType: 'geometry', stylers: [{ color: '#0e1c0e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8fa38f' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a140a' }, { weight: 2 }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#2a3d2a' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#122412' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#14290f', visibility: 'on' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1d301d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6b7f6b' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2b3b26' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#3d4d33' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#a08c5f' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1712' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a5f55' }] },
]

// Vignette overlay that melts the map edges into the page background so the
// map feels embedded/transparent rather than a pasted-in rectangle.
function MapVignette() {
  return (
    <div aria-hidden="true" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit',
      boxShadow: 'inset 0 0 70px 22px rgba(10,18,10,0.78), inset 0 0 18px 6px rgba(10,18,10,0.5)',
      background: 'radial-gradient(ellipse at center, rgba(10,18,10,0) 55%, rgba(10,18,10,0.35) 100%)',
    }}/>
  )
}

const mapShell: React.CSSProperties = {
  position: 'relative', width: '100%', borderRadius: '16px', overflow: 'hidden',
  border: '0.5px solid rgba(212,175,110,0.18)', background: 'rgba(15,31,15,0.4)',
}

function goldMarkerIcon(g: any, color = '#d4af6e', scale = 8) {
  return {
    path: g.maps.SymbolPath.CIRCLE,
    scale,
    fillColor: color,
    fillOpacity: 0.95,
    strokeColor: '#0f1f0f',
    strokeWeight: 2,
  }
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

// ── Embedded map for a saved mosque ──────────────────────────────────────
// Interactive JS-API map with the Green Emblem style (replaces the old
// default-look Google iframe). Accepts lat/lng directly; falls back to
// resolving the placeId via the Places service when only that is saved.
export function MosqueMapEmbed({ placeId, name, lat, lng, height = 200 }: {
  placeId?: string | null; name?: string | null; lat?: number | null; lng?: number | null; height?: number
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  useEffect(() => {
    if (!key || (!placeId && (lat == null || lng == null))) return
    let cancelled = false
    loadGoogleMaps().then(async () => {
      if (cancelled || !mapRef.current) return
      const g = (window as any).google

      let center: any = (lat != null && lng != null) ? { lat, lng } : null
      if (!center && placeId) {
        center = await new Promise(resolve => {
          const svc = new g.maps.places.PlacesService(document.createElement('div'))
          svc.getDetails({ placeId, fields: ['geometry'] }, (place: any, status: string) => {
            if (status === 'OK' && place?.geometry?.location) {
              resolve({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() })
            } else resolve(null)
          })
        })
      }
      if (cancelled || !center) { if (!center) setFailed(true); return }

      const map = new g.maps.Map(mapRef.current, {
        center, zoom: 14, styles: GE_MAP_STYLE, backgroundColor: '#0f1f0f',
        disableDefaultUI: true, zoomControl: true, gestureHandling: 'cooperative',
      })
      new g.maps.Marker({ position: center, map, title: name || 'Masjid', icon: goldMarkerIcon(g) })
    }).catch(() => setFailed(true))
    return () => { cancelled = true }
  }, [key, placeId, lat, lng, name])

  if (!key || failed) {
    return (
      <div style={{ height, borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(212,175,110,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '16px' }}>
        <span style={{ fontFamily: 'var(--font-cormorant, Georgia, serif)', fontSize: '13px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
          {failed ? "Couldn't load the map for this masjid right now." : "Map unavailable — Google Maps isn't configured yet."}
        </span>
      </div>
    )
  }
  if (!placeId && (lat == null || lng == null)) return null

  return (
    <div style={{ ...mapShell, height }}>
      <div ref={mapRef} style={{ position: 'absolute', inset: 0 }}/>
      <MapVignette/>
    </div>
  )
}

// ── Explore Nearby — radius-bounded community map ────────────────────────
// The user sets how far they're willing to travel; the map draws that
// boundary and finds masjids, halal food, and community events inside it.
const RADIUS_KEY = 'ge_travel_radius'
const LOCATION_CACHE_KEY = 'ge_prayer_location' // shared with the Prayer page
const MI_TO_M = 1609.34
export const RADIUS_MIN = 2
export const RADIUS_MAX = 30 // Places nearby search caps at 50km ≈ 31mi

type Category = 'masjids' | 'halal' | 'events'

export type NearbyEvent = {
  id: string; title: string; event_start: string
  masjids: { name: string; city: string; state: string; lat: number | null; lng: number | null } | null
}

type ResultItem = {
  id: string; category: Category; name: string; detail: string
  lat: number; lng: number; distanceMi: number
}

const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  masjids: { label: 'Masjids', color: '#d4af6e' },
  halal:   { label: 'Halal food', color: '#5a9e5a' },
  events:  { label: 'Events', color: '#9b8ec4' },
}

function haversineMi(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 3958.8
  const dLat = (bLat - aLat) * Math.PI / 180
  const dLng = (bLng - aLng) * Math.PI / 180
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

export function ExploreNearbyMap({
  initialRadiusMi,
  events = [],
  onRadiusSave,
  height = 340,
}: {
  initialRadiusMi?: number | null
  events?: NearbyEvent[]
  onRadiusSave?: (mi: number) => void
  height?: number
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const gmap = useRef<any>(null)
  const circleRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [locStatus, setLocStatus] = useState<'idle' | 'locating' | 'granted' | 'denied'>('idle')
  const [mapReady, setMapReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [radiusMi, setRadiusMi] = useState<number>(() => {
    if (initialRadiusMi) return Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, initialRadiusMi))
    return 10
  })
  const [categories, setCategories] = useState<Record<Category, boolean>>({ masjids: true, halal: true, events: true })
  const [results, setResults] = useState<ResultItem[]>([])
  const [searching, setSearching] = useState(false)

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  // ── Restoring the radius ────────────────────────────────────────────────
  // The profile arrives AFTER mount (the page fetches it), so the lazy
  // useState initialiser above can never see it. Previously this effect
  // bailed out the moment initialRadiusMi appeared, which meant a saved
  // travel radius was silently ignored and everyone got 10 miles.
  const userTouchedRadius = useRef(false)
  const profileRadiusApplied = useRef(false)
  const clampMi = (n: number) => Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, n || 10))

  // Local cache first, so there's something sensible before the profile lands.
  useEffect(() => {
    if (initialRadiusMi || userTouchedRadius.current) return
    try {
      const cached = localStorage.getItem(RADIUS_KEY)
      if (cached) setRadiusMi(clampMi(Number(cached)))
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // The saved profile value wins when it arrives — unless they've already
  // moved the slider themselves, in which case leave their choice alone.
  useEffect(() => {
    if (!initialRadiusMi || profileRadiusApplied.current || userTouchedRadius.current) return
    profileRadiusApplied.current = true
    setRadiusMi(clampMi(initialRadiusMi))
  }, [initialRadiusMi])

  // Locate the user — reuse the Prayer page's cached location first
  const requestLocation = useCallback(() => {
    try {
      const cached = localStorage.getItem(LOCATION_CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Date.now() - parsed.savedAt < 24 * 60 * 60 * 1000 && parsed.coords) {
          setCenter(parsed.coords); setLocStatus('granted')
          return
        }
      }
    } catch {}
    if (!navigator.geolocation) { setLocStatus('denied'); return }
    setLocStatus('locating')
    navigator.geolocation.getCurrentPosition(
      pos => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setCenter(c); setLocStatus('granted')
        try { localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ coords: c, savedAt: Date.now() })) } catch {}
      },
      () => setLocStatus('denied'),
      { timeout: 10000 }
    )
  }, [])

  useEffect(() => { requestLocation() }, [requestLocation])

  // Build the map once we have a center
  useEffect(() => {
    if (!key || !center || gmap.current) return
    let cancelled = false
    setFailed(false)
    loadGoogleMaps().then(() => {
      if (cancelled) return
      if (!mapRef.current) { setFailed(true); return }   // never sit blank in silence
      const g = (window as any).google
      gmap.current = new g.maps.Map(mapRef.current, {
        center, zoom: 11, styles: GE_MAP_STYLE, backgroundColor: '#0f1f0f',
        disableDefaultUI: true, zoomControl: true, gestureHandling: 'cooperative',
      })
      // "You are here"
      new g.maps.Marker({
        position: center, map: gmap.current, title: 'You',
        icon: { path: g.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#f5f0e6', fillOpacity: 1, strokeColor: '#d4af6e', strokeWeight: 3 },
      })
      circleRef.current = new g.maps.Circle({
        map: gmap.current, center, radius: radiusMi * MI_TO_M,
        strokeColor: '#d4af6e', strokeOpacity: 0.55, strokeWeight: 1.5,
        fillColor: '#d4af6e', fillOpacity: 0.07,
      })
      gmap.current.fitBounds(circleRef.current.getBounds(), 24)
      setMapReady(true)
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [key, center, reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the boundary circle in sync with the slider
  useEffect(() => {
    if (!circleRef.current || !gmap.current) return
    circleRef.current.setRadius(radiusMi * MI_TO_M)
    gmap.current.fitBounds(circleRef.current.getBounds(), 24)
    try { localStorage.setItem(RADIUS_KEY, String(radiusMi)) } catch {}
    if (onRadiusSave) {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => onRadiusSave(radiusMi), 900)
    }
  }, [radiusMi]) // eslint-disable-line react-hooks/exhaustive-deps

  // Search whenever radius / categories / map readiness change
  useEffect(() => {
    if (!mapReady || !center) return
    const g = (window as any).google
    let cancelled = false
    setSearching(true)

    const nearby = (keyword: string, category: Category): Promise<ResultItem[]> =>
      new Promise(resolve => {
        const svc = new g.maps.places.PlacesService(gmap.current)
        svc.nearbySearch(
          { location: center, radius: Math.min(radiusMi * MI_TO_M, 50000), keyword },
          (places: any[], status: string) => {
            if (status !== 'OK' || !places) { resolve([]); return }
            resolve(places
              .filter(p => p.geometry?.location)
              .map(p => {
                const lat = p.geometry.location.lat(), lng = p.geometry.location.lng()
                return {
                  id: `${category}-${p.place_id}`, category,
                  name: p.name, detail: p.vicinity || '',
                  lat, lng, distanceMi: haversineMi(center.lat, center.lng, lat, lng),
                }
              })
              .filter(r => r.distanceMi <= radiusMi))
          }
        )
      })

    const tasks: Promise<ResultItem[]>[] = []
    if (categories.masjids) tasks.push(nearby('masjid mosque', 'masjids'))
    if (categories.halal) tasks.push(nearby('halal restaurant', 'halal'))
    if (categories.events) {
      tasks.push(Promise.resolve(
        events
          .filter(e => e.masjids?.lat != null && e.masjids?.lng != null)
          .map(e => {
            const lat = e.masjids!.lat as number, lng = e.masjids!.lng as number
            return {
              id: `events-${e.id}`, category: 'events' as Category,
              name: e.title,
              detail: `${e.masjids!.name} · ${new Date(e.event_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
              lat, lng, distanceMi: haversineMi(center.lat, center.lng, lat, lng),
            }
          })
          .filter(r => r.distanceMi <= radiusMi)
      ))
    }

    Promise.all(tasks).then(lists => {
      if (cancelled) return
      const all = lists.flat().sort((a, b) => a.distanceMi - b.distanceMi)
      setResults(all)
      setSearching(false)

      // Repaint markers
      markersRef.current.forEach(m => m.setMap(null))
      markersRef.current = all.map(r => {
        const marker = new g.maps.Marker({
          position: { lat: r.lat, lng: r.lng }, map: gmap.current, title: r.name,
          icon: goldMarkerIcon(g, CATEGORY_META[r.category].color, 6),
        })
        const info = new g.maps.InfoWindow({
          content: `<div style="font-family:Georgia,serif;color:#1a3d1a;font-size:13px"><strong>${r.name}</strong><br/><span style="font-size:11px">${r.detail} · ${r.distanceMi.toFixed(1)} mi</span></div>`,
        })
        marker.addListener('click', () => info.open({ map: gmap.current, anchor: marker }))
        return marker
      })
    })
    return () => { cancelled = true }
  }, [mapReady, center, radiusMi, categories, events])

  if (!key) {
    return (
      <div style={{ height: 160, borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(212,175,110,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '16px' }}>
        <span style={{ fontFamily: 'var(--font-cormorant, Georgia, serif)', fontSize: '13px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Map unavailable — Google Maps isn&apos;t configured yet.</span>
      </div>
    )
  }

  return (
    <div>
      {/* Radius + category controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <div style={{ flex: '1 1 220px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: '10px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.45)' }}>TRAVEL RADIUS</span>
            <span style={{ fontFamily: 'var(--font-inter, Georgia, serif)', fontSize: '12px', fontWeight: 600, color: '#d4af6e' }}>{radiusMi} mi</span>
          </div>
          <input
            type="range" min={RADIUS_MIN} max={RADIUS_MAX} step={1} value={radiusMi}
            onChange={e => { userTouchedRadius.current = true; setRadiusMi(Number(e.target.value)) }}
            aria-label="Travel radius in miles"
            className="ge-radius-slider"
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(Object.keys(CATEGORY_META) as Category[]).map(c => (
            <button
              key={c}
              onClick={() => setCategories(prev => ({ ...prev, [c]: !prev[c] }))}
              style={{
                fontFamily: 'var(--font-inter, Georgia, serif)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em',
                padding: '7px 12px', borderRadius: '20px', cursor: 'pointer',
                border: `0.5px solid ${CATEGORY_META[c].color}${categories[c] ? '' : '55'}`,
                background: categories[c] ? `${CATEGORY_META[c].color}22` : 'transparent',
                color: categories[c] ? CATEGORY_META[c].color : 'rgba(255,255,255,0.35)',
                transition: 'all 0.15s',
              }}
            >
              {CATEGORY_META[c].label}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div style={{ ...mapShell, height }}>
        {center ? <div ref={mapRef} style={{ position: 'absolute', inset: 0 }}/> : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '20px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-cormorant, Georgia, serif)', fontSize: '14px', fontStyle: 'italic', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
              {locStatus === 'locating' ? 'Finding your location…'
                : locStatus === 'denied' ? 'Location access is needed to show what’s within reach of you.'
                : 'Share your location to explore your community.'}
            </p>
            {locStatus !== 'locating' && (
              <button onClick={requestLocation} style={{ fontFamily: 'var(--font-inter, Georgia, serif)', fontSize: '11px', fontWeight: 600, color: '#0f1f0f', background: '#d4af6e', border: 'none', borderRadius: '9px', padding: '9px 20px', cursor: 'pointer' }}>
                Share location
              </button>
            )}
          </div>
        )}
        {failed && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '20px', textAlign: 'center', background: 'rgba(15,31,15,0.85)' }}>
            <span style={{ fontFamily: 'var(--font-cormorant, Georgia, serif)', fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>Couldn&apos;t load the map right now.</span>
            <button
              onClick={() => { gmap.current = null; setMapReady(false); setFailed(false); setReloadKey(k => k + 1) }}
              style={{ fontFamily: 'var(--font-inter, Georgia, serif)', fontSize: '11px', fontWeight: 600, color: '#0f1f0f', background: '#d4af6e', border: 'none', borderRadius: '9px', padding: '9px 20px', cursor: 'pointer' }}
            >
              Try again
            </button>
          </div>
        )}
        {center && <MapVignette/>}
      </div>

      {/* Results */}
      {center && (
        <div style={{ marginTop: '14px' }}>
          {searching ? (
            <p style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', textAlign: 'center' }}>Searching within {radiusMi} miles…</p>
          ) : results.length === 0 ? (
            <p style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', textAlign: 'center' }}>Nothing found inside {radiusMi} miles — try widening your radius.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
              {results.slice(0, 30).map(r => (
                <button
                  key={r.id}
                  onClick={() => { if (gmap.current) { gmap.current.panTo({ lat: r.lat, lng: r.lng }); gmap.current.setZoom(14) } }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', border: 'none', borderRadius: '9px', padding: '10px 13px', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: CATEGORY_META[r.category].color, flexShrink: 0 }}/>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontFamily: 'Georgia, serif', fontSize: '13px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                      <span style={{ display: 'block', fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.detail}</span>
                    </span>
                  </span>
                  <span style={{ fontFamily: 'var(--font-inter, Georgia, serif)', fontSize: '11px', color: CATEGORY_META[r.category].color, whiteSpace: 'nowrap' }}>{r.distanceMi.toFixed(1)} mi</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Gold slider styling */}
      <style>{`
        .ge-radius-slider { -webkit-appearance: none; appearance: none; height: 3px; border-radius: 3px; background: linear-gradient(to right, #d4af6e ${(radiusMi - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN) * 100}%, rgba(255,255,255,0.12) ${(radiusMi - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN) * 100}%); outline: none; }
        .ge-radius-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #d4af6e; border: 2px solid #0f1f0f; box-shadow: 0 0 0 1px rgba(212,175,110,0.5); cursor: pointer; }
        .ge-radius-slider::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: #d4af6e; border: 2px solid #0f1f0f; cursor: pointer; }
      `}</style>
    </div>
  )
}
GE_EOF_A0A90F93

echo
FAIL=0
for s in "importLibrary" "mapsReady" "Try again" "userTouchedRadius"; do
  if grep -qF -- "$s" components/MosqueMap.tsx; then echo "  ✓ $s"; else echo "  ✗ MISSING: $s"; FAIL=1; fi
done

if [ "$FAIL" -ne 0 ]; then
  echo "✗ File did not apply cleanly. Do not commit. Re-run the script."
  exit 1
fi

echo
echo "════════════════════════════════════════════════════════════════"
echo " MAP FIX APPLIED"
echo "════════════════════════════════════════════════════════════════"
echo
echo "  git add -A"
echo "  git commit -m 'fix: wait for Google Maps libraries before building the map'"
echo "  git push"
echo
