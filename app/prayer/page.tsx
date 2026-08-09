'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createClient } from '@/lib/supabase/client'
import { CALC_METHODS, computeDayTimes, qiblaBearing, fmtTime, orderedPrayers, type CalcMethodId, type DayPrayerTimes } from '@/lib/prayer'

const LOCATION_CACHE_KEY = 'ge_prayer_location'

type Coords = { lat: number; lng: number; label?: string }

export default function PrayerPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)

  const [coords, setCoords] = useState<Coords | null>(null)
  const [locStatus, setLocStatus] = useState<'idle' | 'locating' | 'granted' | 'denied' | 'error'>('idle')

  const [method, setMethod] = useState<CalcMethodId>('MuslimWorldLeague')
  const [primaryAsr, setPrimaryAsr] = useState<'shafi' | 'hanafi'>('shafi')
  const [times, setTimes] = useState<DayPrayerTimes | null>(null)
  const [bearing, setBearing] = useState<number | null>(null)
  const [now, setNow] = useState(new Date())

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
      <main style={{ position: 'relative', zIndex: 2, minHeight: '100dvh', padding: '120px 24px 80px', maxWidth: '640px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ fontFamily: 'var(--font-arabic)', fontSize: '26px', color: 'var(--gold)', opacity: 0.75, marginBottom: '14px' }} lang="ar">الصَّلَاة</div>
          <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '0.3em', color: 'var(--gold)', marginBottom: '16px' }}>PRAYER</div>
          <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: 'clamp(28px,5vw,44px)', fontWeight: 500, color: '#fff', marginBottom: '10px' }}>Prayer times & Qibla</h1>
          {coords && (
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '14px', fontStyle: 'italic', color: 'rgba(255,255,255,0.4)' }}>
              Based on your current location · {coords.lat.toFixed(3)}, {coords.lng.toFixed(3)}
            </p>
          )}
        </div>

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
                  <span style={{ fontFamily: 'Georgia, serif', fontSize: '15px', color: i === nextIdx ? 'var(--gold)' : 'rgba(255,255,255,0.75)' }}>{fmtTime(p.time)}</span>
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
      </main>
      <Footer />
    </>
  )
}

// ── Qibla compass ────────────────────────────────────────────────────────
function QiblaFinder({ bearing }: { bearing: number }) {
  const [liveHeading, setLiveHeading] = useState<number | null>(null)
  const [liveError, setLiveError] = useState('')

  const enableLiveCompass = async () => {
    setLiveError('')
    const DOE: any = (window as any).DeviceOrientationEvent
    if (!DOE) { setLiveError('Live compass is not supported on this device.'); return }

    if (typeof DOE.requestPermission === 'function') {
      try {
        const res = await DOE.requestPermission()
        if (res !== 'granted') { setLiveError('Compass permission was denied.'); return }
      } catch {
        setLiveError('Could not request compass permission.'); return
      }
    }

    window.addEventListener('deviceorientationabsolute', handleOrientation as any, true)
    window.addEventListener('deviceorientation', handleOrientation as any, true)
  }

  const handleOrientation = (e: any) => {
    const heading = e.webkitCompassHeading ?? (e.absolute && e.alpha != null ? 360 - e.alpha : null)
    if (heading != null) setLiveHeading(heading)
  }

  useEffect(() => {
    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation as any, true)
      window.removeEventListener('deviceorientation', handleOrientation as any, true)
    }
  }, [])

  // Needle rotation: bearing to Mecca, offset by the phone's own heading if live mode is on
  const needleRotation = liveHeading != null ? bearing - liveHeading : bearing

  return (
    <div style={{ background: 'rgba(15,31,15,0.55)', border: '0.5px solid rgba(212,175,110,0.12)', borderRadius: '14px', padding: '28px 24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.2em', color: 'var(--gold)', marginBottom: '18px' }}>QIBLA DIRECTION</div>

      <div style={{ position: 'relative', width: '180px', height: '180px', margin: '0 auto 18px' }}>
        <svg width="180" height="180" viewBox="0 0 180 180">
          <circle cx="90" cy="90" r="85" fill="none" stroke="rgba(212,175,110,0.25)" strokeWidth="1"/>
          {[0, 90, 180, 270].map(deg => (
            <line key={deg} x1="90" y1="10" x2="90" y2="18" stroke="rgba(212,175,110,0.4)" strokeWidth="2" transform={`rotate(${deg} 90 90)`}/>
          ))}
          <text x="90" y="24" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.4)" fontFamily="var(--font-inter)">N</text>
          {/* Needle, rotating toward Mecca */}
          <g transform={`rotate(${needleRotation} 90 90)`} style={{ transition: 'transform 0.2s ease-out' }}>
            <polygon points="90,20 84,95 90,85 96,95" fill="var(--gold)"/>
            <circle cx="90" cy="90" r="5" fill="var(--gold)"/>
          </g>
        </svg>
      </div>

      <div style={{ fontFamily: 'Georgia, serif', fontSize: '15px', color: '#fff', marginBottom: '4px' }}>{bearing.toFixed(1)}° from North</div>
      <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '13px', fontStyle: 'italic', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>
        {liveHeading != null ? 'The gold needle points toward the Kaaba as you turn.' : 'Align this bearing with a compass, or enable live mode below.'}
      </p>

      {liveHeading == null && (
        <button onClick={enableLiveCompass} style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 600, color: 'var(--gold)', background: 'none', border: '0.5px solid rgba(212,175,110,0.4)', borderRadius: '9px', padding: '9px 18px', cursor: 'pointer' }}>
          Enable live compass
        </button>
      )}
      {liveError && <p style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(226,75,74,0.8)', marginTop: '10px' }}>{liveError}</p>}
    </div>
  )
}
