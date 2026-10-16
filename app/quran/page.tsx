'use client'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import WorshipTabs from '@/components/WorshipTabs'
import QuranReader from '@/components/QuranReader'

// /quran — its own route now, rather than /prayer?tab=quran. Worth
// bookmarking, and the place the reading-position features will hang off.
export default function QuranPage() {
  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ position: 'relative', zIndex: 2, minHeight: '100dvh', padding: '120px 24px 80px', maxWidth: '920px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontFamily: 'var(--font-arabic)', fontSize: '26px', color: 'var(--gold)', opacity: 0.75, marginBottom: '14px' }} lang="ar">القُرْآن</div>
          <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '0.3em', color: 'var(--gold)', marginBottom: '16px' }}>QURAN</div>
          <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: 'clamp(28px,5vw,44px)', fontWeight: 500, color: '#fff', marginBottom: '10px' }}>Read</h1>
        </div>

        <WorshipTabs />
        <QuranReader />
      </main>
      <Footer />
    </>
  )
}
