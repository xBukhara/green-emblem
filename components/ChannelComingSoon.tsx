'use client'
import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createClient } from '@/lib/supabase/client'

export default function ChannelComingSoon({
  slug,
  arabic,
  title,
  tagline,
  description,
  accent,
  subField,
}: {
  slug: string
  arabic?: string
  title: string
  tagline: string
  description: string
  accent: string
  subField: 'sub_greentv' | 'sub_greenfitness' | 'sub_greenworld_plus'
}) {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user)
      if (user) {
        const { data: profile } = await supabase.from('profiles').select(subField).eq('id', user.id).maybeSingle()
        setSubscribed(!!(profile as any)?.[subField])
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
        body: JSON.stringify({ [subField]: next }),
      })
    }
    setSubscribed(next)
    setSaving(false)
  }

  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ position: 'relative', zIndex: 2, minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '120px 24px 80px' }}>
        <div style={{ maxWidth: '560px', textAlign: 'center' }}>
          {arabic && <div style={{ fontFamily: 'var(--font-arabic)', fontSize: '28px', color: accent, opacity: 0.75, marginBottom: '18px' }} lang="ar">{arabic}</div>}
          <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '0.3em', color: accent, marginBottom: '16px' }}>COMING SOON</div>
          <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: 'clamp(30px,6vw,52px)', fontWeight: 500, color: '#fff', marginBottom: '14px', letterSpacing: '-0.01em' }}>{title}</h1>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '19px', fontStyle: 'italic', color: 'rgba(255,255,255,0.6)', marginBottom: '10px' }}>{tagline}</p>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '16px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.75, marginBottom: '36px' }}>{description}</p>

          <button
            onClick={toggleSubscribe}
            disabled={saving || !checked}
            style={{
              fontFamily: 'var(--font-inter)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em',
              padding: '14px 32px', borderRadius: '10px', border: `1px solid ${accent}`,
              background: subscribed ? accent : 'transparent',
              color: subscribed ? '#0f1f0f' : accent,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
          >
            {!checked ? 'Loading…' : subscribed ? "You're on the list ✓" : 'Notify me when it launches'}
          </button>
          {!user && checked && (
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '13px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', marginTop: '14px' }}>
              Sign in to save your interest — we'll email you the moment {title} goes live.
            </p>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
