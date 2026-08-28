'use client'
import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createClient } from '@/lib/supabase/client'
import { CALC_METHODS, computeDayTimes, qiblaBearing, fmtTime, orderedPrayers, type CalcMethodId, type DayPrayerTimes } from '@/lib/prayer'
import QuranReader from '@/components/QuranReader'
import { awardPoints, fetchRewards } from '@/lib/rewards'

const PRAYED_ACTIONS: Record<string, string> = {
  fajr: 'prayer_fajr', dhuhr: 'prayer_dhuhr', asr: 'prayer_asr',
  maghrib: 'prayer_maghrib', isha: 'prayer_isha',
}

const LOCATION_CACHE_KEY = 'ge_prayer_location'

type Coords = { lat: number; lng: number; label?: string }

// Suspense wrapper — useSearchParams requires one for static prerendering
export default function PrayerPage() {
  return (
    <Suspense fallback={null}>
      <PrayerPageInner/>
    </Suspense>
  )
}

function PrayerPageInner() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)

  const [coords, setCoords] = useState<Coords | null>(null)
  const [locStatus, setLocStatus] = useState<'idle' | 'locating' | 'granted' | 'denied' | 'error'>('idle')

  const [method, setMethod] = useState<CalcMethodId>('MuslimWorldLeague')
  const [primaryAsr, setPrimaryAsr] = useState<'shafi' | 'hanafi'>('shafi')
  const [times, setTimes] = useState<DayPrayerTimes | null>(null)
  const [bearing, setBearing] = useState<number | null>(null)
  const [now, setNow] = useState(new Date())
  const [subTab, setSubTab] = useState<'prayer' | 'quran'>('prayer')

  // Deep link: /prayer?tab=quran opens the Quran reader directly, and the
  // nav's Prayer/Quran links keep working even when already on this page.
  const searchParams = useSearchParams()
  useEffect(() => {
    setSubTab(searchParams.get('tab') === 'quran' ? 'quran' : 'prayer')
  }, [searchParams])

  // ── Load saved preference (signed-in users) + cached location ──────────
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user)
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('prayer_calc_method, prayer_madhab').eq('id', user.id).maybeSingle()
        if (profile?.prayer_calc_method) setMethod(profile.prayer_calc_method as CalcMethodId)
        if (profile?.prayer_madhab) setPrimaryAsr(profile.prayer_madhab as 'shafi' | 'hanafi')
      }
    })

    try {
      const cached = localStorage.getItem(LOCATION_CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Date.now() - parsed.savedAt < 24 * 60 * 60 * 1000) {
          setCoords(parsed.coords)
          setLocStatus('granted')
        }
      }
    } catch {}

    requestLocation()

    const tick = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(tick)
  }, [])

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocStatus('error'); return }
    setLocStatus('locating')
    navigator.geolocation.getCurrentPosition(
      pos => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setCoords(c)
        setLocStatus('granted')
        try { localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ coords: c, savedAt: Date.now() })) } catch {}
      },
      err => setLocStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error'),
      { timeout: 10000 }
    )
  }, [])

  // ── Recompute whenever location/method/madhab changes ──────────────────
  useEffect(() => {
    if (!coords) return
    setTimes(computeDayTimes(coords.lat, coords.lng, new Date(), method))
    setBearing(qiblaBearing(coords.lat, coords.lng))
  }, [coords, method])

  // ── Rewards: checking today's times counts (deduped server-side daily),
  //    and load which prayers were already marked prayed today ────────────
  const [prayedToday, setPrayedToday] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!times || !user) return
    awardPoints(supabase, 'prayer_times')
    fetchRewards(supabase).then(d => {
      if (!d) return
      const done = new Set<string>()
      for (const [key, action] of Object.entries(PRAYED_ACTIONS)) {
        if (d.today_actions?.includes(action)) done.add(key)
      }
      setPrayedToday(done)
    })
  }, [times, user]) // eslint-disable-line react-hooks/exhaustive-deps

  const markPrayed = async (key: string) => {
    if (!user) { window.location.href = '/auth/sign-in'; return }
    if (prayedToday.has(key)) return
    setPrayedToday(prev => new Set(prev).add(key)) // optimistic
    const res = await awardPoints(supabase, PRAYED_ACTIONS[key])
    if (!res) setPrayedToday(prev => { const n = new Set(prev); n.delete(key); return n })
  }

  const savePreference = async (patch: { prayer_calc_method?: string; prayer_madhab?: string }) => {
    if (!user) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify(patch),
    }).catch(() => {})
  }

  const prayers = times ? orderedPrayers(times, primaryAsr) : []
  const nextIdx = (() => {
    if (!prayers.length) return -1
    const idx = prayers.findIndex(p => p.time > now)
    return idx === -1 ? 0 : idx // if past Isha, next is tomorrow's Fajr — highlight Fajr
  })()

  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ position: 'relative', zIndex: 2, minHeight: '100dvh', padding: '120px 24px 80px', maxWidth: subTab === 'quran' ? '920px' : '640px', margin: '0 auto', transition: 'max-width 0.2s' }}>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontFamily: 'var(--font-arabic)', fontSize: '26px', color: 'var(--gold)', opacity: 0.75, marginBottom: '14px' }} lang="ar">الصَّلَاة</div>
          <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '0.3em', color: 'var(--gold)', marginBottom: '16px' }}>PRAYER</div>
          <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: 'clamp(28px,5vw,44px)', fontWeight: 500, color: '#fff', marginBottom: '10px' }}>Prayer, Qibla &amp; Quran</h1>
          {subTab === 'prayer' && coords && (
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '14px', fontStyle: 'italic', color: 'rgba(255,255,255,0.4)' }}>
              Based on your current location · {coords.lat.toFixed(3)}, {coords.lng.toFixed(3)}
            </p>
          )}
        </div>

        {/* ── Sub-tab selector ── */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(212,175,110,0.15)', borderRadius: '100px', padding: '4px' }}>
            {(['prayer', 'quran'] as const).map(t => (
              <button key={t} onClick={() => setSubTab(t)} style={{
                fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em',
                padding: '9px 22px', borderRadius: '100px', border: 'none', cursor: 'pointer',
                background: subTab === t ? 'var(--gold)' : 'transparent',
                color: subTab === t ? '#0f1f0f' : 'rgba(255,255,255,0.5)', transition: 'all 0.2s',
              }}>
                {t === 'prayer' ? 'Prayer & Qibla' : 'Quran'}
              </button>
            ))}
          </div>
        </div>

        {subTab === 'quran' ? (
          <QuranReader/>
        ) : (
        <>
        {/* ── Location gate ── */}
        {locStatus !== 'granted' && (
          <div style={{ textAlign: 'center', padding: '32px 24px', background: 'rgba(15,31,15,0.5)', borderRadius: '14px', marginBottom: '28px' }}>
            {locStatus === 'locating' && <p style={{ fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>Finding your location…</p>}
            {locStatus === 'denied' && (
              <>
                <p style={{ fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', marginBottom: '14px' }}>
                  Location access was denied. Prayer times and Qibla direction need your location to be accurate — please enable location access for this site in your browser settings, then try again.
                </p>
                <button onClick={requestLocation} style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', fontWeight: 600, color: '#0f1f0f', background: 'var(--gold)', border: 'none', borderRadius: '9px', padding: '10px 22px', cursor: 'pointer' }}>Try again</button>
              </>
            )}
            {(locStatus === 'idle' || locStatus === 'error') && (
              <>
                <p style={{ fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', marginBottom: '14px' }}>
                  {locStatus === 'error' ? "Couldn't get your location." : 'Share your location to see accurate prayer times.'}
                </p>
                <button onClick={requestLocation} style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', fontWeight: 600, color: '#0f1f0f', background: 'var(--gold)', border: 'none', borderRadius: '9px', padding: '10px 22px', cursor: 'pointer' }}>Share location</button>
              </>
            )}
          </div>
        )}

        {times && (
          <>
            {/* ── Settings ── */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <select
                value={method}
                onChange={e => { const v = e.target.value as CalcMethodId; setMethod(v); savePreference({ prayer_calc_method: v }) }}
                style={{ flex: 1, minWidth: '180px', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(212,175,110,0.25)', borderRadius: '9px', padding: '10px 12px', fontFamily: 'Georgia, serif', fontSize: '13px', color: '#fff', outline: 'none' }}
              >
                {CALC_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <div style={{ display: 'flex', border: '0.5px solid rgba(212,175,110,0.25)', borderRadius: '9px', overflow: 'hidden' }}>
                {(['shafi', 'hanafi'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => { setPrimaryAsr(m); savePreference({ prayer_madhab: m }) }}
                    style={{
                      fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 600, padding: '10px 16px', border: 'none', cursor: 'pointer',
                      background: primaryAsr === m ? 'var(--gold)' : 'transparent', color: primaryAsr === m ? '#0f1f0f' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {m === 'shafi' ? 'Standard Asr' : 'Hanafi Asr'}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Times table ── */}
            <div style={{ background: 'rgba(15,31,15,0.55)', border: '0.5px solid rgba(212,175,110,0.12)', borderRadius: '14px', overflow: 'hidden', marginBottom: '24px' }}>
              {prayers.map((p, i) => (
                <div key={p.key} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px',
                  background: i === nextIdx ? 'rgba(212,175,110,0.1)' : 'transparent',
                  borderBottom: i < prayers.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: '14px', color: i === nextIdx ? 'var(--gold)' : '#fff' }}>{p.label}</span>
                    {i === nextIdx && <span style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.08em', color: 'var(--gold)', border: '0.5px solid rgba(212,175,110,0.4)', borderRadius: '20px', padding: '2px 8px' }}>NEXT</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontFamily: 'Georgia, serif', fontSize: '15px', color: i === nextIdx ? 'var(--gold)' : 'rgba(255,255,255,0.75)' }}>{fmtTime(p.time)}</span>
                    {PRAYED_ACTIONS[p.key] && (
                      <button
                        onClick={() => markPrayed(p.key)}
                        title={prayedToday.has(p.key) ? 'Prayed — may it be accepted' : `Mark ${p.label} as prayed`}
                        aria-pressed={prayedToday.has(p.key)}
                        style={{
                          width: '26px', height: '26px', borderRadius: '50%', cursor: prayedToday.has(p.key) ? 'default' : 'pointer',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px',
                          border: prayedToday.has(p.key) ? 'none' : '1px solid rgba(212,175,110,0.35)',
                          background: prayedToday.has(p.key) ? '#2e6b2e' : 'transparent',
                          color: prayedToday.has(p.key) ? '#f5f0e6' : 'rgba(212,175,110,0.6)',
                          transition: 'all 0.2s',
                        }}
                      >
                        ✓
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {/* Both Asr times, always visible for reference regardless of the toggle above */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', background: 'rgba(255,255,255,0.02)', fontSize: '11px' }}>
                <span style={{ fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>Standard Asr: {fmtTime(times.asrShafi)}</span>
                <span style={{ fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>Hanafi Asr: {fmtTime(times.asrHanafi)}</span>
              </div>
            </div>

            {/* ── Qibla ── */}
            {bearing !== null && <QiblaFinder bearing={bearing} />}
          </>
        )}
        </>
        )}
      </main>
      <Footer />
    </>
  )
}

// ── Qibla compass ────────────────────────────────────────────────────────
// Built the way native compass apps (and MuslimPro) actually work: the dial
// itself rotates as you turn the device — N/E/S/W sweep around — while a
// fixed arrow at the top of the screen always represents "where the phone
// is pointing." A Kaaba marker sits at a fixed spot on the (rotating) dial,
// at the Qibla bearing. When the Kaaba marker swings under the fixed top
// arrow, you're facing Mecca.
function QiblaFinder({ bearing }: { bearing: number }) {
  const [liveHeading, setLiveHeading] = useState<number | null>(null)
  const [liveError, setLiveError] = useState('')
  const [calibrating, setCalibrating] = useState(false)

  // Smoothing + continuous-rotation state (refs so the event handler always
  // sees the latest value without re-subscribing on every render)
  const smoothedRef = useRef<number>(NaN)           // low-pass filtered heading, 0-360
  const unwrappedRef = useRef(0)                     // continuously increasing/decreasing — no 359->1 snap
  const calibTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleOrientation = useCallback((e: any) => {
    let raw = e.webkitCompassHeading ?? (e.alpha != null ? 360 - e.alpha : null)
    if (raw == null) return

    // Compensate for screen rotation (landscape etc.) so the dial stays correct
    const screenAngle = (screen as any).orientation?.angle ?? (window as any).orientation ?? 0
    raw = (raw + screenAngle + 360) % 360

    if (Number.isNaN(smoothedRef.current)) {
      smoothedRef.current = raw
    } else {
      let delta = raw - smoothedRef.current
      if (delta > 180) delta -= 360
      if (delta < -180) delta += 360
      smoothedRef.current = (smoothedRef.current + delta * 0.15 + 360) % 360
    }
    const smoothed = smoothedRef.current

    // Unwrap so CSS rotation always takes the short path, never spins
    // the long way around when crossing the 0/360 boundary
    const prevWrapped = ((unwrappedRef.current % 360) + 360) % 360
    let d = smoothed - prevWrapped
    if (d > 180) d -= 360
    if (d < -180) d += 360
    unwrappedRef.current += d

    setLiveHeading(unwrappedRef.current)
  }, [])

  const enableLiveCompass = async () => {
    setLiveError('')
    const DOE: any = (window as any).DeviceOrientationEvent
    if (!DOE) { setLiveError('Live compass is not supported on this device — showing the fixed bearing instead.'); return }

    if (typeof DOE.requestPermission === 'function') {
      try {
        const res = await DOE.requestPermission()
        if (res !== 'granted') { setLiveError('Compass permission was denied. You can still use the bearing number below.'); return }
      } catch {
        setLiveError('Could not request compass permission.'); return
      }
    }

    window.addEventListener('deviceorientationabsolute', handleOrientation, true)
    window.addEventListener('deviceorientation', handleOrientation, true)
    window.addEventListener('compassneedscalibration', onNeedsCalibration as any, true)
  }

  const onNeedsCalibration = () => {
    setCalibrating(true)
    if (calibTimer.current) clearTimeout(calibTimer.current)
    calibTimer.current = setTimeout(() => setCalibrating(false), 4000)
  }

  useEffect(() => {
    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true)
      window.removeEventListener('deviceorientation', handleOrientation, true)
      window.removeEventListener('compassneedscalibration', onNeedsCalibration as any, true)
      if (calibTimer.current) clearTimeout(calibTimer.current)
    }
  }, [handleOrientation])

  const isLive = liveHeading != null
  const dialRotation = isLive ? -liveHeading : 0
  const headingDisplay = isLive ? Math.round(((liveHeading % 360) + 360) % 360) : null

  // How far off is the Kaaba marker from the fixed top pointer right now?
  const offFromQibla = isLive ? Math.abs(((bearing - (((liveHeading % 360) + 360) % 360) + 540) % 360) - 180) : null
  const aligned = offFromQibla != null && offFromQibla < 6

  const R = 100 // dial radius
  const C = 130 // svg center

  return (
    <div style={{ background: 'rgba(15,31,15,0.55)', border: '0.5px solid rgba(212,175,110,0.12)', borderRadius: '14px', padding: '28px 24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.2em', color: 'var(--gold)', marginBottom: '4px' }}>QIBLA DIRECTION</div>
      {calibrating && (
        <div style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', color: '#e8b923', marginBottom: '10px' }}>
          Move your phone in a figure-8 to calibrate the compass
        </div>
      )}

      <div style={{ position: 'relative', width: '260px', height: '260px', margin: '0 auto 18px' }}>
        <svg width="260" height="260" viewBox="0 0 260 260">
          <defs>
            <radialGradient id="dialBg" cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="rgba(212,175,110,0.06)"/>
              <stop offset="100%" stopColor="rgba(212,175,110,0)"/>
            </radialGradient>
            <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>

          <circle cx={C} cy={C} r={R + 18} fill="url(#dialBg)"/>

          {/* ── Rotating dial: outer ring, ticks, N/E/S/W labels, Kaaba marker ── */}
          <g style={{ transform: `rotate(${dialRotation}deg)`, transformOrigin: `${C}px ${C}px`, transition: isLive ? 'transform 0.15s linear' : 'none' }}>
            <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(212,175,110,0.3)" strokeWidth="1"/>
            <circle cx={C} cy={C} r={R - 14} fill="none" stroke="rgba(212,175,110,0.12)" strokeWidth="1"/>

            {/* degree ticks every 15°, longer every 30° */}
            {Array.from({ length: 24 }, (_, i) => i * 15).map(deg => (
              <line key={deg} x1={C} y1={C - R} x2={C} y2={C - R + (deg % 30 === 0 ? 10 : 5)} stroke="rgba(212,175,110,0.35)" strokeWidth={deg % 90 === 0 ? 2 : 1} transform={`rotate(${deg} ${C} ${C})`}/>
            ))}

            {/* cardinal + intercardinal labels — position computed directly so the
                counter-rotation (keeping text upright as the dial spins) doesn't
                conflict with the positioning transform */}
            {[
              { deg: 0, t: 'N', big: true }, { deg: 45, t: 'NE' }, { deg: 90, t: 'E', big: true },
              { deg: 135, t: 'SE' }, { deg: 180, t: 'S', big: true }, { deg: 225, t: 'SW' },
              { deg: 270, t: 'W', big: true }, { deg: 315, t: 'NW' },
            ].map(({ deg, t, big }) => {
              const rad = (deg - 90) * (Math.PI / 180)
              const labelR = R - 28
              const lx = C + labelR * Math.cos(rad)
              const ly = C + labelR * Math.sin(rad)
              return (
                <text
                  key={t} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
                  fontSize={big ? 15 : 10} fontWeight={big ? 700 : 400}
                  fill={t === 'N' ? '#e0574f' : big ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)'}
                  fontFamily="var(--font-inter)"
                  style={{ transform: `rotate(${-dialRotation}deg)`, transformOrigin: `${lx}px ${ly}px` }}
                >
                  {t}
                </text>
              )
            })}

            {/* Kaaba marker — fixed on the dial at the Qibla bearing */}
            <g transform={`rotate(${bearing} ${C} ${C})`}>
              <g filter={aligned ? 'url(#glow)' : undefined}>
                <circle cx={C} cy={C - R + 2} r="13" fill={aligned ? '#2ecc71' : 'var(--gold)'} style={{ transition: 'fill 0.25s' }}/>
                {/* simple Kaaba silhouette */}
                <rect x={C - 6} y={C - R - 4} width="12" height="10" fill="#14210f"/>
                <rect x={C - 6} y={C - R - 4} width="12" height="3" fill="#c9a227"/>
              </g>
            </g>
          </g>

          {/* ── Fixed top pointer — represents where the phone is facing, does NOT rotate ── */}
          <g>
            <polygon points={`${C},${C - R - 22} ${C - 7},${C - R - 4} ${C + 7},${C - R - 4}`} fill={aligned ? '#2ecc71' : '#fff'} style={{ transition: 'fill 0.25s' }}/>
          </g>

          {/* center hub */}
          <circle cx={C} cy={C} r="4" fill="rgba(255,255,255,0.6)"/>
        </svg>
      </div>

      <div style={{ fontFamily: 'Georgia, serif', fontSize: '15px', color: aligned ? '#2ecc71' : '#fff', marginBottom: '4px', transition: 'color 0.25s' }}>
        {aligned ? 'Facing Qibla ✓' : `${bearing.toFixed(1)}° from North`}
      </div>
      <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '13px', fontStyle: 'italic', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>
        {isLive
          ? `Facing ${headingDisplay}° — turn until the marker lines up with the top arrow.`
          : 'Align this bearing with a compass, or enable live mode below.'}
      </p>

      {!isLive && (
        <button onClick={enableLiveCompass} style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 600, color: 'var(--gold)', background: 'none', border: '0.5px solid rgba(212,175,110,0.4)', borderRadius: '9px', padding: '9px 18px', cursor: 'pointer' }}>
          Enable live compass
        </button>
      )}
      {liveError && <p style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(226,75,74,0.8)', marginTop: '10px' }}>{liveError}</p>}
    </div>
  )
}
