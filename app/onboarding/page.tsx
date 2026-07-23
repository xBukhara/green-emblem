'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MosqueAutocomplete, type MosquePlace } from '@/components/MosqueMap'

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(1)
  const [mosquePlace, setMosquePlace] = useState<MosquePlace | null>(null)

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    address_line1: '',
    address_city: '',
    address_state: '',
    address_zip: '',
    local_mosque: '',
    newsletter: true,
    phone: '',
  })

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/sign-in'); return }
      setUser(user)
      // Pre-fill name from Google
      const name = user.user_metadata?.full_name || ''
      const parts = name.split(' ')
      setForm(f => ({
        ...f,
        first_name: user.user_metadata?.given_name || parts[0] || '',
        last_name: user.user_metadata?.family_name || parts.slice(1).join(' ') || '',
      }))
      // Check if already onboarded
      const { data: profile } = await supabase
        .from('profiles').select('onboarding_complete').eq('id', user.id).single()
      if (profile?.onboarding_complete) {
        router.push('/dashboard')
        return
      }
      setLoading(false)
    })
  }, [])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.first_name || !form.last_name) {
      setError('Please enter your first and last name.')
      return
    }
    setSaving(true)
    setError('')

    try {
      // Refresh the session to ensure we have a live access token — mobile
      // browsers can have a stale in-memory session after the OAuth redirect.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Your session expired. Please sign in again.')
        setSaving(false)
        router.push('/auth/sign-in')
        return
      }

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone || null,
          address: {
            line1: form.address_line1,
            city: form.address_city,
            state: form.address_state,
            zip: form.address_zip,
          },
          local_mosque: form.local_mosque || null,
          mosque_place_id: mosquePlace?.placeId || null,
          mosque_lat: mosquePlace?.lat ?? null,
          mosque_lng: mosquePlace?.lng ?? null,
          mosque_formatted_address: mosquePlace?.formattedAddress || null,
          newsletter: form.newsletter,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        setError(result.error || 'Something went wrong. Please try again.')
        setSaving(false)
        return
      }

      router.push('/dashboard?welcome=1')
    } catch (e) {
      setError('Network error. Please check your connection and try again.')
      setSaving(false)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '0.5px solid rgba(212,175,110,0.25)', borderRadius: '9px',
    padding: '12px 14px', fontFamily: 'Georgia, serif', fontSize: '16px',
    color: '#fff', outline: 'none', appearance: 'none',
  }
  const lbl: React.CSSProperties = {
    fontFamily: 'var(--font-cinzel, Georgia)', fontSize: '8.5px',
    letterSpacing: '0.18em', color: 'rgba(255,255,255,0.4)',
    display: 'block', marginBottom: '7px',
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: '#0a140a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Loading…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(160deg, #0a140a 0%, #0f1f0f 50%, #0a0f1a 100%)', position: 'relative', overflow: 'hidden' }}>
      {/* Islamic geometric background */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04, pointerEvents: 'none' }}>
        <defs>
          <pattern id="geo" width="80" height="80" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="#d4af6e" strokeWidth="0.8">
              <rect x="20" y="20" width="40" height="40" rx="2"/>
              <rect x="20" y="20" width="40" height="40" rx="2" transform="rotate(45 40 40)"/>
              <circle cx="40" cy="40" r="10"/>
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#geo)"/>
      </svg>

      <div style={{ position: 'relative', zIndex: 2, maxWidth: '520px', margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <svg width="52" height="52" viewBox="25 35 170 155" style={{ marginBottom: '14px' }}>
            <rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke="#c8a050" strokeWidth="2" transform="rotate(0 110 110)"/>
            <rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke="#c8a050" strokeWidth="2" transform="rotate(45 110 110)"/>
            <polygon points="110,42 158,42 190,74 190,146 158,178 62,178 30,146 30,74 62,42" fill="#2e6b2e" stroke="#c8a050" strokeWidth="2"/>
            <circle cx="103" cy="104" r="44" fill="#d4af6e"/>
            <circle cx="117" cy="96" r="37" fill="#2e6b2e"/>
            <g transform="translate(158,82)"><polygon points="0,-16 3.8,-6.2 14.8,-5 6.8,3 9.4,14 0,8.2 -9.4,14 -6.8,3 -14.8,-5 -3.8,-6.2" fill="#d4af6e"/></g>
          </svg>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '10px', letterSpacing: '0.28em', color: '#d4af6e', marginBottom: '8px', opacity: 0.8 }}>
            GREEN EMBLEM
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(22px,4vw,32px)', fontWeight: 400, color: '#fff', marginBottom: '8px', lineHeight: 1.2 }}>
            Assalamu Alaikum{form.first_name ? `, ${form.first_name}` : ''}
          </h1>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: '15px', fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
            Let's set up your Green Emblem profile.
          </p>
        </div>

        {/* Step progress */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '28px' }}>
          {['Your details', 'Address', 'Community'].map((s, i) => (
            <div key={s} style={{ flex: 1 }}>
              <div style={{ height: '3px', borderRadius: '2px', background: step > i + 1 ? '#d4af6e' : step === i + 1 ? 'rgba(212,175,110,0.5)' : 'rgba(255,255,255,0.08)', marginBottom: '5px' }}/>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', color: step === i + 1 ? '#d4af6e' : 'rgba(255,255,255,0.25)', textAlign: 'center', letterSpacing: '0.08em' }}>{s}</div>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ background: 'rgba(226,75,74,0.1)', border: '0.5px solid rgba(226,75,74,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#e24b4a', fontSize: '13px', fontFamily: 'Georgia, serif' }}>
            {error}
          </div>
        )}

        <div style={{ background: 'rgba(15,31,15,0.7)', border: '0.5px solid rgba(212,175,110,0.18)', borderRadius: '16px', overflow: 'hidden', backdropFilter: 'blur(12px)' }}>

          {/* STEP 1 — Name + phone */}
          {step === 1 && (
            <div style={{ padding: '28px' }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.22em', color: '#d4af6e', marginBottom: '20px' }}>YOUR DETAILS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={lbl}>First name <span style={{ color: '#d4af6e' }}>*</span></label>
                    <input type="text" value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Aisha" style={inp}/>
                  </div>
                  <div>
                    <label style={lbl}>Last name <span style={{ color: '#d4af6e' }}>*</span></label>
                    <input type="text" value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Rahman" style={inp}/>
                  </div>
                </div>
                <div>
                  <label style={lbl}>Phone number (optional)</label>
                  <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 (555) 000-0000" style={inp}/>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '5px', fontStyle: 'italic' }}>
                    For order updates only. Never shared or sold.
                  </div>
                </div>
              </div>
              <button onClick={() => { if (!form.first_name || !form.last_name) { setError('Please enter your name.'); return } setError(''); setStep(2) }}
                style={{ width: '100%', marginTop: '20px', fontFamily: 'Georgia, serif', fontSize: '11px', letterSpacing: '0.16em', color: '#0f1f0f', background: '#d4af6e', border: 'none', borderRadius: '9px', padding: '14px', cursor: 'pointer' }}>
                Next →
              </button>
            </div>
          )}

          {/* STEP 2 — Address */}
          {step === 2 && (
            <div style={{ padding: '28px' }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.22em', color: '#d4af6e', marginBottom: '6px' }}>SHIPPING ADDRESS</div>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', lineHeight: 1.6, marginBottom: '20px' }}>
                Used for shop deliveries. Saved securely.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={lbl}>Street address</label>
                  <input type="text" value={form.address_line1} onChange={e => set('address_line1', e.target.value)} placeholder="123 Main Street, Apt 4B" style={inp}/>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={lbl}>City</label>
                    <input type="text" value={form.address_city} onChange={e => set('address_city', e.target.value)} placeholder="New York" style={inp}/>
                  </div>
                  <div>
                    <label style={lbl}>State</label>
                    <input type="text" value={form.address_state} onChange={e => set('address_state', e.target.value)} placeholder="NY" style={inp}/>
                  </div>
                </div>
                <div>
                  <label style={lbl}>ZIP code</label>
                  <input type="text" value={form.address_zip} onChange={e => set('address_zip', e.target.value)} placeholder="10001" style={inp}/>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button onClick={() => setStep(1)} style={{ flex: 1, fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(255,255,255,0.45)', background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: '9px', padding: '13px', cursor: 'pointer' }}>← Back</button>
                <button onClick={() => { setError(''); setStep(3) }} style={{ flex: 2, fontFamily: 'Georgia, serif', fontSize: '11px', letterSpacing: '0.14em', color: '#0f1f0f', background: '#d4af6e', border: 'none', borderRadius: '9px', padding: '13px', cursor: 'pointer' }}>Next →</button>
              </div>
            </div>
          )}

          {/* STEP 3 — Community + newsletter */}
          {step === 3 && (
            <div style={{ padding: '28px' }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.22em', color: '#d4af6e', marginBottom: '6px' }}>YOUR COMMUNITY</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={lbl}>Your local mosque (optional)</label>
                  <MosqueAutocomplete
                    defaultValue={form.local_mosque}
                    inputStyle={inp}
                    onSelect={(place) => {
                      set('local_mosque', place.name)
                      setMosquePlace(place)
                    }}
                  />
                </div>

                {/* Community pitch */}
                <div style={{ background: 'rgba(212,175,110,0.06)', border: '0.5px solid rgba(212,175,110,0.2)', borderRadius: '12px', padding: '16px 18px' }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: '#d4af6e', marginBottom: '8px', letterSpacing: '0.04em' }}>Why we ask</div>
                  <p style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.75, fontStyle: 'italic' }}>
                    This information helps us build a centralized access system for Muslims across the USA — connecting you to your favorite mosques, local community events, networking opportunities, and Islamic businesses near you. Your address is saved for shipping purposes only. We never sell your data.
                  </p>
                </div>

                {/* Newsletter opt-in */}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '14px', background: form.newsletter ? 'rgba(46,107,46,0.12)' : 'rgba(255,255,255,0.03)', border: `0.5px solid ${form.newsletter ? 'rgba(46,107,46,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '10px', transition: 'all 0.2s' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '5px', background: form.newsletter ? '#d4af6e' : 'transparent', border: `0.5px solid ${form.newsletter ? '#d4af6e' : 'rgba(255,255,255,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }} onClick={() => set('newsletter', !form.newsletter)}>
                    {form.newsletter && <svg width="11" height="9" viewBox="0 0 11 9"><polyline points="1,4.5 4,7.5 10,1" fill="none" stroke="#0f1f0f" strokeWidth="2" strokeLinecap="round"/></svg>}
                  </div>
                  <div onClick={() => set('newsletter', !form.newsletter)}>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: '#fff', marginBottom: '3px' }}>Join the Green Emblem newsletter</div>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', lineHeight: 1.5 }}>
                      Prayer times, halal guides, community events, new features, and early access to future projects. Unsubscribe anytime.
                    </div>
                  </div>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button onClick={() => setStep(2)} style={{ flex: 1, fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(255,255,255,0.45)', background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: '9px', padding: '13px', cursor: 'pointer' }}>← Back</button>
                <button onClick={handleSave} disabled={saving} style={{ flex: 2, fontFamily: 'Georgia, serif', fontSize: '11px', letterSpacing: '0.14em', color: '#0f1f0f', background: '#d4af6e', border: 'none', borderRadius: '9px', padding: '13px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving…' : 'Complete profile →'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Privacy note */}
        <p style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: '20px', fontStyle: 'italic', lineHeight: 1.6 }}>
          Your information is encrypted, never sold, and only used to improve your Green Emblem experience.
        </p>
      </div>
    </div>
  )
}
