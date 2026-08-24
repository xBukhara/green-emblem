'use client'
import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import GreenTVFeed from '@/components/GreenTVFeed'
import { createClient } from '@/lib/supabase/client'

const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL

export default function GreenTVPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user)
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('sub_greentv').eq('id', user.id).maybeSingle()
        setSubscribed(!!profile?.sub_greentv)
      }
      setChecked(true)
    })
  }, [])

  const toggleSubscribe = async () => {
    if (!user) { window.location.href = '/auth/sign-in'; return }
    setSaving(true)
    const next = !subscribed
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ sub_greentv: next }),
      })
    }
    setSubscribed(next)
    setSaving(false)
  }

  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ position: 'relative', zIndex: 2, minHeight: '100dvh', padding: '120px 24px 80px', maxWidth: '680px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ fontFamily: 'var(--font-arabic)', fontSize: '26px', color: '#5a9e5a', opacity: 0.75, marginBottom: '14px' }} lang="ar">أَخْبَار</div>
          <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '0.3em', color: '#5a9e5a', marginBottom: '16px' }}>GREENTV</div>
          <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: 'clamp(28px,5vw,44px)', fontWeight: 500, color: '#fff', marginBottom: '12px' }}>News, fitness &amp; community</h1>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '16px', fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: '24px' }}>
            Curated Islamic world news, faith-centered fitness coaching, and live community discussions — all in one place.
          </p>
          <button
            onClick={toggleSubscribe}
            disabled={saving || !checked}
            style={{
              fontFamily: 'var(--font-inter)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em',
              padding: '13px 30px', borderRadius: '10px', border: '1px solid #5a9e5a',
              background: subscribed ? '#5a9e5a' : 'transparent',
              color: subscribed ? '#0f1f0f' : '#5a9e5a',
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
            }}
          >
            {!checked ? 'Loading…' : subscribed ? 'Subscribed ✓' : 'Subscribe for updates'}
          </button>
        </div>

        {/* ── Live community / Discord ── */}
        <div style={{
          background: DISCORD_URL ? 'rgba(88,101,242,0.08)' : 'rgba(255,255,255,0.03)',
          border: `0.5px solid ${DISCORD_URL ? 'rgba(88,101,242,0.35)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: '14px', padding: '22px', marginBottom: '32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.18em', color: DISCORD_URL ? '#8b93f7' : 'rgba(255,255,255,0.4)', marginBottom: '6px', textTransform: 'uppercase' }}>Live discussions</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '15px', color: '#fff', marginBottom: '3px' }}>Join the conversation on Discord</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '12.5px', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}>
              {DISCORD_URL ? 'Live voice discussions, recorded sessions land here on GreenTV.' : 'Coming soon.'}
            </div>
          </div>
          {DISCORD_URL ? (
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', fontWeight: 600, color: '#fff', background: '#5865F2', padding: '11px 22px', borderRadius: '9px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Open Discord →
            </a>
          ) : (
            <span style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', color: 'rgba(255,255,255,0.3)', border: '0.5px solid rgba(255,255,255,0.15)', padding: '10px 18px', borderRadius: '9px', whiteSpace: 'nowrap' }}>Not linked yet</span>
          )}
        </div>

        {/* ── GreenFitness ── */}
        <div style={{ background: 'rgba(15,31,15,0.5)', border: '0.5px solid rgba(212,175,110,0.15)', borderRadius: '14px', padding: '22px', marginBottom: '36px' }}>
          <div style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.18em', color: 'var(--gold)', marginBottom: '8px', textTransform: 'uppercase' }}>GreenFitness</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '15px', color: '#fff', marginBottom: '6px' }}>Faith-centered fitness coaching</div>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '14px', fontStyle: 'italic', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
            Training programs from Muslim athletes, starting with boxing fundamentals. Coming soon — episodes will post right here alongside GreenTV's news updates.
          </p>
        </div>

        {/* ── News feed ── */}
        <div style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.4)', marginBottom: '14px', textTransform: 'uppercase' }}>Latest updates</div>
        <GreenTVFeed/>
      </main>
      <Footer />
    </>
  )
}
