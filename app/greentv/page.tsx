'use client'
import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import GreenTVFeed from '@/components/GreenTVFeed'
import { createClient } from '@/lib/supabase/client'

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
      <main style={{ position: 'relative', zIndex: 2, minHeight: '100dvh', padding: '120px 24px 80px', maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ fontFamily: 'var(--font-arabic)', fontSize: '26px', color: '#5a9e5a', opacity: 0.75, marginBottom: '14px' }} lang="ar">أَخْبَار</div>
          <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '0.3em', color: '#5a9e5a', marginBottom: '16px' }}>GREENTV</div>
          <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: 'clamp(28px,5vw,44px)', fontWeight: 500, color: '#fff', marginBottom: '12px' }}>Islamic world news, curated</h1>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '16px', fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: '24px' }}>
            Live updates from credible, unbiased sources — curated and forwarded by our team, not scraped and dumped.
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
            {!checked ? 'Loading…' : subscribed ? 'Subscribed ✓' : 'Subscribe for notifications'}
          </button>
        </div>

        <GreenTVFeed/>
      </main>
      <Footer />
    </>
  )
}
