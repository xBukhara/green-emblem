'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Search, Crosshair, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  loadGoogleMaps, goldMarkerIcon, haversineMi,
  GE_MAP_STYLE, CATEGORY_META,
  RADIUS_KEY, LOCATION_CACHE_KEY, MI_TO_M, RADIUS_MIN, RADIUS_MAX,
  type Category, type ResultItem, type NearbyEvent,
} from '@/components/MosqueMap'

// ── /nearby — the map IS the screen ──────────────────────────────────────
// This is the full-bleed sibling of ExploreNearbyMap. The embedded card on
// GreenWorld+ still exists for the in-page teaser; this one takes over the
// viewport, so three things differ and all three are deliberate:
//
//   1. gestureHandling is 'greedy', not 'cooperative'. Nothing is behind the
//      map to scroll, so a one-finger drag should pan it. On the embedded
//      card the opposite is true and 'cooperative' is correct there.
//   2. No tab bar (see lib/surface.ts → FULL_BLEED_PATHS), so the way out is
//      the floating back control, which falls back to the hub when there is
//      no history to go back to.
//   3. Sheet position is written straight to the DOM during a drag instead of
//      through setState. Same reason the Qibla compass does: a pointermove
//      re-render at 60Hz is what made that laggy.
//
// The Maps loader is imported, never copied — it carries the `loading=async`
// fix, and a second copy would drift away from it.

type Loc = { lat: number; lng: number }

export default function NearbyScreen() {
  const router = useRouter()
  const supabase = createClient()
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  const mapHost = useRef<HTMLDivElement>(null)
  const gmap = useRef<any>(null)
  const circle = useRef<any>(null)
  const markers = useRef<any[]>([])
  const info = useRef<any>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [center, setCenter] = useState<Loc | null>(null)
  const [locStatus, setLocStatus] = useState<'idle' | 'locating' | 'granted' | 'denied'>('idle')
  const [mapReady, setMapReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const [radiusMi, setRadiusMi] = useState(10)
  const [cats, setCats] = useState<Record<Category, boolean>>({ masjids: true, halal: true, events: true })
  const [results, setResults] = useState<ResultItem[]>([])
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')

  const [events, setEvents] = useState<NearbyEvent[]>([])
  const [signedIn, setSignedIn] = useState(false)

  const userTouchedRadius = useRef(false)
  const profileApplied = useRef(false)
  const clampMi = (n: number) => Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, n || 10))

  /* ── This screen owns its own data, so the route stands alone ───────── */
  useEffect(() => {
    fetch('/api/masjid-events')
      .then(r => r.json())
      .then(d => setEvents(d.events || []))
      .catch(() => {})

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setSignedIn(true)
      const { data: p } = await supabase.from('profiles').select('travel_radius_miles').eq('id', user.id).maybeSingle()
      const saved = (p as any)?.travel_radius_miles
      if (saved && !profileApplied.current && !userTouchedRadius.current) {
        profileApplied.current = true
        setRadiusMi(clampMi(Number(saved)))
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* Local cache first, so the ring is sensible before the profile lands. */
  useEffect(() => {
    if (userTouchedRadius.current) return
    try {
      const cached = localStorage.getItem(RADIUS_KEY)
      if (cached) setRadiusMi(clampMi(Number(cached)))
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Location: reuse the Prayer page's cache, never prompt twice ────── */
  const requestLocation = useCallback(() => {
    try {
      const cached = localStorage.getItem(LOCATION_CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Date.now() - parsed.savedAt < 24 * 60 * 60 * 1000 && parsed.coords) {
          setCenter(parsed.coords); setLocStatus('granted'); return
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

  /* Nothing behind this screen should scroll while it is open. */
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  /* ── Build the map ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!key || !center || gmap.current) return
    let cancelled = false
    setFailed(false)
    loadGoogleMaps().then(() => {
      if (cancelled) return
      if (!mapHost.current) { setFailed(true); return }
      const g = (window as any).google
      gmap.current = new g.maps.Map(mapHost.current, {
        center, zoom: 12, styles: GE_MAP_STYLE, backgroundColor: '#0f1f0f',
        disableDefaultUI: true,
        // Full screen: the map owns every gesture inside it.
        gestureHandling: 'greedy',
        clickableIcons: false,
      })
      new g.maps.Marker({
        position: center, map: gmap.current, title: 'You',
        icon: { path: g.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#f5f0e6', fillOpacity: 1, strokeColor: '#d4af6e', strokeWeight: 3 },
      })
      circle.current = new g.maps.Circle({
        map: gmap.current, center, radius: radiusMi * MI_TO_M,
        strokeColor: '#d4af6e', strokeOpacity: 0.55, strokeWeight: 1.5,
        fillColor: '#d4af6e', fillOpacity: 0.07,
      })
      info.current = new g.maps.InfoWindow()
      fitRing()
      setMapReady(true)
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [key, center, reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Frame the ring, leaving room for the sheet so the circle is not hidden
     behind it. */
  const fitRing = () => {
    if (!circle.current || !gmap.current) return
    const b = circle.current.getBounds()
    if (!b) return
    gmap.current.fitBounds(b, { top: 150, right: 40, bottom: 210, left: 40 })
  }

  useEffect(() => {
    if (!circle.current || !gmap.current) return
    circle.current.setRadius(radiusMi * MI_TO_M)
    fitRing()
    try { localStorage.setItem(RADIUS_KEY, String(radiusMi)) } catch {}
    if (!signedIn) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ travel_radius_miles: radiusMi }),
      }).catch(() => {})
    }, 900)
  }, [radiusMi, signedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Search within the radius ───────────────────────────────────────── */
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
    if (cats.masjids) tasks.push(nearby('masjid mosque', 'masjids'))
    if (cats.halal) tasks.push(nearby('halal restaurant', 'halal'))
    if (cats.events) {
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

      markers.current.forEach(m => m.setMap(null))
      markers.current = all.map(r => {
        const marker = new g.maps.Marker({
          position: { lat: r.lat, lng: r.lng }, map: gmap.current, title: r.name,
          icon: goldMarkerIcon(g, CATEGORY_META[r.category].color, 6),
        })
        marker.addListener('click', () => {
          info.current?.setContent(
            `<div style="font-family:Georgia,serif;color:#1a3d1a;font-size:13px">` +
            `<strong>${escapeHtml(r.name)}</strong><br/>` +
            `<span style="font-size:11px">${escapeHtml(r.detail)} · ${r.distanceMi.toFixed(1)} mi</span></div>`
          )
          info.current?.open({ map: gmap.current, anchor: marker })
        })
        return marker
      })
    })
    return () => { cancelled = true }
  }, [mapReady, center, radiusMi, cats, events]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── The sheet ──────────────────────────────────────────────────────── */
  const sheet = useRef<HTMLDivElement>(null)
  const listBox = useRef<HTMLDivElement>(null)
  const yRef = useRef(0)
  const drag = useRef({ on: false, startY: 0, startT: 0 })
  const [vh, setVh] = useState(0)

  useEffect(() => {
    const read = () => setVh(window.innerHeight)
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])

  // peek shows the handle, the count and the radius slider; full stops short
  // of the top so the search bar stays reachable.
  const detents = useMemo(
    () => (vh ? [Math.max(200, vh - 196), Math.round(vh * 0.46), 112] : [700, 400, 112]),
    [vh]
  )

  const place = useCallback((y: number, animate: boolean) => {
    yRef.current = y
    const el = sheet.current
    if (!el) return
    el.style.transition = animate ? 'transform .3s cubic-bezier(.22,1,.36,1)' : 'none'
    el.style.transform = `translate3d(0,${y}px,0)`
    if (listBox.current) {
      listBox.current.style.overflowY = y <= detents[2] + 6 ? 'auto' : 'hidden'
    }
  }, [detents])

  useEffect(() => { if (vh) place(detents[0], false) }, [vh]) // eslint-disable-line react-hooks/exhaustive-deps

  const onDown = (e: React.PointerEvent) => {
    drag.current = { on: true, startY: e.clientY, startT: yRef.current }
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch {}
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current.on) return
    const next = Math.min(detents[0], Math.max(detents[2], drag.current.startT + (e.clientY - drag.current.startY)))
    place(next, false)
  }
  const onUp = () => {
    if (!drag.current.on) return
    drag.current.on = false
    let best = detents[0]
    for (const d of detents) if (Math.abs(d - yRef.current) < Math.abs(best - yRef.current)) best = d
    place(best, true)
  }

  /* ── Leaving ────────────────────────────────────────────────────────── */
  // There is no tab bar here, and this can be the first screen in an
  // installed PWA, so back has to have somewhere to go.
  const leave = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push('/explore')
  }

  const goTo = (r: ResultItem) => {
    if (!gmap.current) return
    gmap.current.panTo({ lat: r.lat, lng: r.lng })
    gmap.current.setZoom(15)
    place(detents[1], true)
  }

  const shown = query.trim()
    ? results.filter(r => (r.name + ' ' + r.detail).toLowerCase().includes(query.trim().toLowerCase()))
    : results

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (shown.length) goTo(shown[0])
  }

  /* ── Not configured ─────────────────────────────────────────────────── */
  if (!key) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-forest-dark px-6 text-center">
        <p className="font-cormorant text-[15px] italic text-white/45">
          The map isn&apos;t configured yet — NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing.
        </p>
        <button onClick={leave} className="cursor-pointer rounded-lg border border-gold bg-gold px-5 py-2.5 font-cinzel text-[10px] tracking-[0.14em] text-forest-deepest">
          GO BACK
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-forest-dark">
      {/* The map itself, edge to edge and under the system bars */}
      <div ref={mapHost} className="absolute inset-0" />

      {/* Scrim so the floating controls stay legible over pale map areas */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-forest-deepest/80 to-transparent"
      />

      {/* ── Top controls ─────────────────────────────────────────────── */}
      <div
        className="absolute inset-x-0 top-0 z-20 flex flex-col gap-2.5 px-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <div className="flex items-center gap-2.5">
          <button
            onClick={leave}
            aria-label="Back"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gold/20 bg-forest-deepest/85 text-gold backdrop-blur-xl"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
          </button>

          <form onSubmit={onSubmitSearch} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full border border-gold/20 bg-forest-deepest/85 px-4 backdrop-blur-xl">
            <Search className="h-[17px] w-[17px] shrink-0 text-gold" strokeWidth={1.8} />
            <input
              id="nearby-search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search masjids, halal food, events"
              aria-label="Search what's nearby"
              className="min-w-0 flex-1 border-none bg-transparent py-3 font-cormorant text-[15px] text-white outline-none placeholder:italic placeholder:text-white/35"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="shrink-0 cursor-pointer border-none bg-transparent p-1 text-white/45"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(Object.keys(CATEGORY_META) as Category[]).map(c => {
            const on = cats[c]
            const color = CATEGORY_META[c].color
            return (
              <button
                key={c}
                onClick={() => setCats(p => ({ ...p, [c]: !p[c] }))}
                aria-pressed={on}
                className={cn(
                  'shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3.5 py-2 text-[11.5px] font-semibold backdrop-blur-xl transition-colors',
                  !on && 'opacity-60'
                )}
                style={on
                  ? { background: color, borderColor: color, color: '#0f1f0f' }
                  : { background: 'rgba(14,37,14,0.85)', borderColor: color, color }}
              >
                {CATEGORY_META[c].label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Locate ───────────────────────────────────────────────────── */}
      <button
        onClick={() => { if (center && gmap.current) { gmap.current.panTo(center); fitRing() } else requestLocation() }}
        aria-label="Centre on my location"
        className="absolute right-3 z-20 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-gold/20 bg-forest-deepest/85 text-gold backdrop-blur-xl"
        style={{ bottom: vh ? `${vh - detents[0] + 14}px` : '210px' }}
      >
        <Crosshair className="h-5 w-5" strokeWidth={1.7} />
      </button>

      {/* ── No location yet ──────────────────────────────────────────── */}
      {!center && (
        <div className="absolute inset-x-6 top-1/2 z-10 -translate-y-1/2 rounded-2xl border border-gold/15 bg-forest-deepest/90 p-6 text-center backdrop-blur-xl">
          <p className="mb-4 font-cormorant text-[15px] italic leading-relaxed text-white/55">
            {locStatus === 'locating' ? 'Finding your location…'
              : locStatus === 'denied' ? 'Location access is needed to show what’s within reach of you.'
              : 'Share your location to explore your community.'}
          </p>
          {locStatus !== 'locating' && (
            <button onClick={requestLocation} className="cursor-pointer rounded-lg border-none bg-gold px-5 py-2.5 font-cinzel text-[10px] tracking-[0.14em] text-forest-deepest">
              SHARE LOCATION
            </button>
          )}
        </div>
      )}

      {/* ── Map failed ───────────────────────────────────────────────── */}
      {failed && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-forest-deepest/90 px-6 text-center">
          <p className="font-cormorant text-[15px] italic text-white/45">Couldn&apos;t load the map right now.</p>
          <button
            onClick={() => { gmap.current = null; setMapReady(false); setFailed(false); setReloadKey(k => k + 1) }}
            className="cursor-pointer rounded-lg border-none bg-gold px-5 py-2.5 font-cinzel text-[10px] tracking-[0.14em] text-forest-deepest"
          >
            TRY AGAIN
          </button>
        </div>
      )}

      {/* ── Bottom sheet ─────────────────────────────────────────────── */}
      {center && (
        <div
          ref={sheet}
          className="absolute inset-x-0 top-0 z-20 flex h-full touch-none flex-col rounded-t-2xl border-t border-gold/15 bg-[#102610]/95 shadow-[0_-16px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          style={{ transform: 'translate3d(0,700px,0)' }}
        >
          <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            <div className="grid cursor-grab place-items-center pb-1 pt-2.5">
              <span className="h-1 w-10 rounded-full bg-white/25" />
            </div>

            <div className="grid cursor-grab gap-3 px-4 pb-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <b className="font-cinzel text-[14px] font-medium text-white">
                  {searching ? 'Searching…' : `${shown.length} ${shown.length === 1 ? 'place' : 'places'} nearby`}
                </b>
                <i className="font-cormorant text-[13px] italic text-white/35">drag to see all</i>
              </div>

              <div className="grid gap-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="font-cinzel text-[9px] tracking-[0.18em] text-white/40">TRAVEL RADIUS</span>
                  <span className="text-[12px] font-semibold tabular-nums text-gold">{radiusMi} mi</span>
                </div>
                <input
                  id="nearby-radius"
                  type="range"
                  min={RADIUS_MIN}
                  max={RADIUS_MAX}
                  step={1}
                  value={radiusMi}
                  onChange={e => { userTouchedRadius.current = true; setRadiusMi(Number(e.target.value)) }}
                  onPointerDown={e => e.stopPropagation()}
                  aria-label="Travel radius in miles"
                  className="ge-radius-slider w-full"
                />
              </div>
            </div>
          </div>

          <div
            ref={listBox}
            className="min-h-0 flex-1 px-3"
            style={{ overflowY: 'hidden', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)' }}
          >
            {shown.length === 0 && !searching ? (
              <p className="px-2 py-5 text-center font-cormorant text-[13px] italic text-white/30">
                {query.trim()
                  ? `Nothing matching “${query.trim()}” inside ${radiusMi} miles.`
                  : `Nothing found inside ${radiusMi} miles — try widening your radius.`}
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {shown.map(r => (
                  <button
                    key={r.id}
                    onClick={() => goTo(r)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border-none bg-white/[0.035] px-3.5 py-3 text-left hover:bg-white/[0.07]"
                  >
                    <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: CATEGORY_META[r.category].color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] text-white">{r.name}</span>
                      <span className="block truncate font-cormorant text-[12.5px] text-white/35">{r.detail}</span>
                    </span>
                    <span className="shrink-0 text-[11.5px] font-semibold tabular-nums" style={{ color: CATEGORY_META[r.category].color }}>
                      {r.distanceMi.toFixed(1)} mi
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* The slider thumb styling lives with the component that uses it.
          Tailwind's preflight is off in this project, so range inputs get no
          reset and need this explicitly. */}
      <style>{`
        .ge-radius-slider {
          -webkit-appearance: none; appearance: none;
          height: 3px; border-radius: 3px; outline: none; margin: 0;
          background: linear-gradient(to right,
            #d4af6e ${((radiusMi - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN)) * 100}%,
            rgba(255,255,255,0.12) ${((radiusMi - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN)) * 100}%);
        }
        .ge-radius-slider::-webkit-slider-thumb {
          -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%;
          background: #d4af6e; border: 2px solid #0f1f0f; cursor: pointer;
          box-shadow: 0 0 0 1px rgba(212,175,110,0.5);
        }
        .ge-radius-slider::-moz-range-thumb {
          width: 18px; height: 18px; border-radius: 50%;
          background: #d4af6e; border: 2px solid #0f1f0f; cursor: pointer;
        }
      `}</style>
    </div>
  )
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}
