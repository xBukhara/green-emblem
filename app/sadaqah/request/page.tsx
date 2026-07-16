'use client'
import { useState } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export default function SadaqahRequestPage() {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    event_type: '', honoree_names: '', event_date: '',
    guest_count: '', location: '', qr_tier: 'free', message: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [builderUrl, setBuilderUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.first_name || !form.last_name || !form.email || !form.event_type || !form.honoree_names) {
      setError('Please fill in all required fields.')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/campaigns/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }
      setBuilderUrl(data.builder_url || '')
      setSubmitted(true)
    } catch {
      setError('Network error. Please check your connection and try again.')
    }
    setLoading(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: '0.5px solid rgba(212,175,110,0.18)', borderRadius: '8px',
    padding: '12px 14px', fontFamily: 'var(--font-cormorant)', fontSize: '16px',
    color: '#fff', outline: 'none', appearance: 'none',
  }
  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-cinzel)', fontSize: '8.5px', letterSpacing: '0.18em',
    color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: '7px',
  }

  if (submitted) return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ paddingTop: '88px', minHeight: '100dvh', position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '480px', padding: '40px 24px' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(46,107,46,0.15)', border: '0.5px solid rgba(46,107,46,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><polyline points="7,16 13,23 25,9" stroke="#4a9e4a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '9px', letterSpacing: '0.28em', color: 'var(--gold)', marginBottom: '14px' }}>Request received</div>
          <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: '28px', fontWeight: 500, color: '#fff', marginBottom: '12px' }}>Barak Allahu Feek</h1>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '17px', fontStyle: 'italic', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: '8px' }}>
            Your campaign request for <strong style={{ color: '#fff' }}>{form.honoree_names}</strong> has been received.
          </p>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '15px', fontStyle: 'italic', color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, marginBottom: '24px' }}>
            Your campaign is ready to design right now. We've also emailed you this link so you can come back any time within 7 days.
          </p>
          {builderUrl && (
            <a href={builderUrl} className="btn-gold" style={{ marginBottom: '28px', textDecoration: 'none' }}>
              Design your campaign now →
            </a>
          )}
          <div style={{ fontFamily: 'var(--font-arabic)', fontSize: '20px', color: 'var(--gold)', opacity: 0.6, direction: 'rtl' }} lang="ar">
            تَقَبَّلَ اللَّهُ مِنَّا وَمِنكُمْ
          </div>
        </div>
      </main>
    </>
  )

  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ paddingTop: '88px', minHeight: '100dvh', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: '620px', margin: '0 auto', padding: '48px 24px 80px' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ fontFamily: 'var(--font-arabic)', fontSize: '24px', color: 'var(--gold)', opacity: 0.65, direction: 'rtl', marginBottom: '14px' }} lang="ar">بَابُ الصَّدَقَة</div>
            <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '9px', letterSpacing: '0.28em', color: 'var(--gold)', marginBottom: '14px' }}>Request a campaign</div>
            <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: 'clamp(26px,5vw,40px)', fontWeight: 500, color: '#fff', lineHeight: 1.15, marginBottom: '14px' }}>
              Turn your event into<br/><span style={{ color: 'var(--gold)' }}>an act of giving</span>
            </h1>
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '17px', fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
              We'll create a beautiful campaign page and QR code for your event. Guests scan and give sadaqah in the names of your honourees — directly to charity.
            </p>
          </div>

          {/* Form card */}
          <div style={{ background: 'rgba(15,31,15,0.6)', border: '0.5px solid rgba(212,175,110,0.15)', borderRadius: '16px', overflow: 'hidden', backdropFilter: 'blur(8px)' }}>

            {/* Section 1 — Contact */}
            <div style={{ padding: '24px 28px', borderBottom: '0.5px solid rgba(212,175,110,0.08)' }}>
              <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '9px', letterSpacing: '0.22em', color: 'var(--gold)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                Your details
                <span style={{ flex: 1, height: '0.5px', background: 'rgba(212,175,110,0.15)', display: 'block' }}/>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>First name <span style={{ color: 'var(--gold)' }}>*</span></label>
                  <input type="text" value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Aisha" style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Last name <span style={{ color: 'var(--gold)' }}>*</span></label>
                  <input type="text" value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Rahman" style={inputStyle}/>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Email <span style={{ color: 'var(--gold)' }}>*</span></label>
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Phone (optional)</label>
                  <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 (555) 000-0000" style={inputStyle}/>
                </div>
              </div>
            </div>

            {/* Section 2 — Event */}
            <div style={{ padding: '24px 28px', borderBottom: '0.5px solid rgba(212,175,110,0.08)' }}>
              <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '9px', letterSpacing: '0.22em', color: 'var(--gold)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                Your event
                <span style={{ flex: 1, height: '0.5px', background: 'rgba(212,175,110,0.15)', display: 'block' }}/>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Event type <span style={{ color: 'var(--gold)' }}>*</span></label>
                <select value={form.event_type} onChange={e => set('event_type', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Select event type…</option>
                  {['Nikkah','Walima','Aqiqah','Eid','Graduation','Anniversary','Birthday','Other'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Names to honour <span style={{ color: 'var(--gold)' }}>*</span></label>
                <input type="text" value={form.honoree_names} onChange={e => set('honoree_names', e.target.value)} placeholder="e.g. Aisha & Ibrahim" style={inputStyle}/>
                <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '12px', color: 'rgba(255,255,255,0.25)', marginTop: '5px', fontStyle: 'italic' }}>Shown prominently on your campaign page</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>Event date</label>
                  <input type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }}/>
                </div>
                <div>
                  <label style={labelStyle}>Expected guests</label>
                  <input type="number" value={form.guest_count} onChange={e => set('guest_count', e.target.value)} placeholder="e.g. 150" style={inputStyle}/>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Venue / location (optional)</label>
                <input type="text" value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. The Grand Ballroom, Queens NY" style={inputStyle}/>
              </div>
            </div>

            {/* Section 3 — QR Tier */}
            <div style={{ padding: '24px 28px', borderBottom: '0.5px solid rgba(212,175,110,0.08)' }}>
              <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '9px', letterSpacing: '0.22em', color: 'var(--gold)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                QR code tier
                <span style={{ flex: 1, height: '0.5px', background: 'rgba(212,175,110,0.15)', display: 'block' }}/>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { id: 'free', label: 'Standard', desc: 'Digital QR code, campaign page, impact tracking', price: 'Free' },
                  { id: 'premium', label: 'Premium', desc: 'Printable QR templates, custom branding, priority review', price: 'Coming soon' },
                ].map(tier => (
                  <button key={tier.id} onClick={() => set('qr_tier', tier.id)} style={{ background: form.qr_tier === tier.id ? 'rgba(46,107,46,0.15)' : 'rgba(255,255,255,0.03)', border: `0.5px solid ${form.qr_tier === tier.id ? 'rgba(212,175,110,0.4)' : 'rgba(212,175,110,0.1)'}`, borderRadius: '10px', padding: '14px', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '11px', color: '#fff', marginBottom: '4px' }}>{tier.label}</div>
                    <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '12px', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', lineHeight: 1.4, marginBottom: '8px' }}>{tier.desc}</div>
                    <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '10px', color: 'var(--gold)' }}>{tier.price}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Section 4 — Message */}
            <div style={{ padding: '24px 28px' }}>
              <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '9px', letterSpacing: '0.22em', color: 'var(--gold)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                Anything else?
                <span style={{ flex: 1, height: '0.5px', background: 'rgba(212,175,110,0.15)', display: 'block' }}/>
              </div>
              <textarea value={form.message} onChange={e => set('message', e.target.value)} placeholder="Any special requests, preferred charities, or other details…" style={{ ...inputStyle, resize: 'vertical', minHeight: '80px', lineHeight: '1.5' }}/>
            </div>
          </div>

          {error && (
            <div style={{ background: 'rgba(226,75,74,0.1)', border: '0.5px solid rgba(226,75,74,0.25)', borderRadius: '8px', padding: '12px 16px', marginTop: '16px', fontFamily: 'var(--font-cormorant)', fontSize: '14px', color: '#e24b4a' }}>
              {error}
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading} style={{ width: '100%', marginTop: '20px', fontFamily: 'var(--font-cinzel)', fontSize: '11px', letterSpacing: '0.18em', color: 'var(--forest-dark)', background: 'var(--gold)', border: 'none', borderRadius: '10px', padding: '16px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'opacity 0.18s' }}>
            {loading ? 'Submitting…' : 'Submit campaign request'}
          </button>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '12px', color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: '10px', fontStyle: 'italic' }}>
            No waiting, no approval queue — you'll get instant access to the design studio, plus a link by email.
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
