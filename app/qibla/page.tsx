'use client'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import WorshipTabs from '@/components/WorshipTabs'
import QiblaCompass from '@/components/QiblaCompass'
import { useCoords } from '@/lib/use-coords'
import { qiblaBearing } from '@/lib/prayer'

// /qibla — the compass on its own, which is how it is actually used: you
// open it standing somewhere unfamiliar, not while reading a times table.
export default function QiblaPage() {
  const { coords, status, request } = useCoords()
  const bearing = coords ? qiblaBearing(coords.lat, coords.lng) : null

  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ position: 'relative', zIndex: 2, minHeight: '100dvh', padding: '120px 24px 80px', maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontFamily: 'var(--font-arabic)', fontSize: '26px', color: 'var(--gold)', opacity: 0.75, marginBottom: '14px' }} lang="ar">القِبْلَة</div>
          <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '0.3em', color: 'var(--gold)', marginBottom: '16px' }}>QIBLA</div>
          <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: 'clamp(28px,5vw,44px)', fontWeight: 500, color: '#fff', marginBottom: '10px' }}>Find the direction</h1>
          {coords && (
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '14px', fontStyle: 'italic', color: 'rgba(255,255,255,0.4)' }}>
              {bearing !== null && <>{bearing.toFixed(1)}° from true north · </>}
              {coords.lat.toFixed(3)}, {coords.lng.toFixed(3)}
            </p>
          )}
        </div>

        <WorshipTabs />

        {status !== 'granted' ? (
          <div style={{ textAlign: 'center', padding: '32px 24px', background: 'rgba(15,31,15,0.5)', borderRadius: '14px' }}>
            {status === 'locating' ? (
              <p style={{ fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>Finding your location…</p>
            ) : (
              <>
                <p style={{ fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', marginBottom: '14px' }}>
                  {status === 'denied'
                    ? 'Location access was denied. The Qibla direction is calculated from where you are, so it needs your location — enable it for this site, then try again.'
                    : "Couldn't get your location. The Qibla direction is calculated from where you are."}
                </p>
                <button onClick={request} style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', fontWeight: 600, color: '#0f1f0f', background: 'var(--gold)', border: 'none', borderRadius: '9px', padding: '10px 22px', cursor: 'pointer' }}>
                  {status === 'denied' ? 'Try again' : 'Share location'}
                </button>
              </>
            )}
          </div>
        ) : bearing !== null ? (
          <QiblaCompass bearing={bearing} />
        ) : null}
      </main>
      <Footer />
    </>
  )
}
