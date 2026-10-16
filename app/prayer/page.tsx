'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import WorshipTabs from '@/components/WorshipTabs'
import { createClient } from '@/lib/supabase/client'
import { computeDayTimes, fmtTime, orderedPrayers, type DayPrayerTimes } from '@/lib/prayer'
import { useCoords } from '@/lib/use-coords'

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
  const router = useRouter()
  const searchParams = useSearchParams()

  const [user, setUser] = useState<any>(null)
  const { coords, status: locStatus, request: requestLocation } = useCoords()

  // Asr madhab is the ONLY timing preference left. The calculation method is
  // fixed to ISNA (see lib/prayer.ts) — a picker there only invited people to
  // change a number they had no way to check. Asr is different: it is a fiqh
  // choice, and removing it would hand Hanafi users a time they consider
  // wrong with no way to correct it.
  const [primaryAsr, setPrimaryAsr] = useState<'shafi' | 'hanafi'>('shafi')
  const [times, setTimes] = useState<DayPrayerTimes | null>(null)
  const [now, setNow] = useState(new Date())

  // Old deep links (/prayer?tab=quran) now live at their own routes.
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'quran') router.replace('/quran')
    else if (tab === 'qibla') router.replace('/qibla')
  }, [searchParams, router])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user)
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('prayer_madhab').eq('id', user.id).maybeSingle()
      if (profile?.prayer_madhab) setPrimaryAsr(profile.prayer_madhab as 'shafi' | 'hanafi')
    })

    const tick = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(tick)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ISNA is the default argument, so no method is threaded through here.
  useEffect(() => {
    if (!coords) return
    setTimes(computeDayTimes(coords.lat, coords.lng, new Date()))
  }, [coords])

  const saveMadhab = async (madhab: 'shafi' | 'hanafi') => {
    setPrimaryAsr(madhab)
    if (!user) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ prayer_madhab: madhab }),
    }).catch(() => {})
  }

  const prayers = times ? orderedPrayers(times, primaryAsr) : []
  const nextIdx = (() => {
    if (!prayers.length) return -1
    const idx = prayers.findIndex(p => p.time > now)
    return idx === -1 ? 0 : idx // past Isha → next is tomorrow's Fajr
  })()

  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ position: 'relative', zIndex: 2, minHeight: '100dvh', padding: '120px 24px 80px', maxWidth: '640px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontFamily: 'var(--font-arabic)', fontSize: '26px', color: 'var(--gold)', opacity: 0.75, marginBottom: '14px' }} lang="ar">الصَّلَاة</div>
          <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '0.3em', color: 'var(--gold)', marginBottom: '16px' }}>PRAYER</div>
          <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: 'clamp(28px,5vw,44px)', fontWeight: 500, color: '#fff', marginBottom: '10px' }}>Today&apos;s times</h1>
          {coords && (
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '14px', fontStyle: 'italic', color: 'rgba(255,255,255,0.4)' }}>
              ISNA (North America) · {coords.lat.toFixed(3)}, {coords.lng.toFixed(3)}
            </p>
          )}
        </div>

        <WorshipTabs />

        {/* ── Location gate ── */}
        {locStatus !== 'granted' && (
          <div style={{ textAlign: 'center', padding: '32px 24px', background: 'rgba(15,31,15,0.5)', borderRadius: '14px', marginBottom: '28px' }}>
            {locStatus === 'locating' && <p style={{ fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>Finding your location…</p>}
            {locStatus === 'denied' && (
              <>
                <p style={{ fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', marginBottom: '14px' }}>
                  Location access was denied. Prayer times are calculated from where you are — please enable location access for this site in your browser settings, then try again.
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
            {/* ── Asr madhab — the one remaining timing preference ── */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', border: '0.5px solid rgba(212,175,110,0.25)', borderRadius: '9px', overflow: 'hidden' }}>
                {(['shafi', 'hanafi'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => saveMadhab(m)}
                    aria-pressed={primaryAsr === m}
                    style={{
                      fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 600, padding: '10px 18px', border: 'none', cursor: 'pointer',
                      background: primaryAsr === m ? 'var(--gold)' : 'transparent',
                      color: primaryAsr === m ? '#0f1f0f' : 'rgba(255,255,255,0.5)',
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
              {/* Both Asr times stay visible regardless of the toggle, so
                  nobody has to change a setting to see the other one. */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', background: 'rgba(255,255,255,0.02)', fontSize: '11px' }}>
                <span style={{ fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>Standard Asr: {fmtTime(times.asrShafi)}</span>
                <span style={{ fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>Hanafi Asr: {fmtTime(times.asrHanafi)}</span>
              </div>
            </div>

            <p style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', textAlign: 'center', lineHeight: 1.7 }}>
              Calculated with the ISNA (North America) convention. Always follow your local masjid where they differ.
            </p>
          </>
        )}
      </main>
      <Footer />
    </>
  )
}
