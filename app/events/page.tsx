'use client'
import { useState, useEffect } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createClient } from '@/lib/supabase/client'

type Affiliate = {
  id: string
  display_name: string
  bio: string
  city: string
  state: string
  affiliate_type: string
  event_types: string[]
  portfolio_urls: string[]
  instagram_url?: string
  review_count: number
  avg_rating?: number
  jobs_completed: number
  service_radius?: string
}

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
  'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
  'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
  'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming',
]

const EVENT_TYPES = ['Nikkah','Walima','Aqiqah','Eid','Graduation','Custom']

export default function EventsPage() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [filtered, setFiltered] = useState<Affiliate[]>([])
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [connecting, setConnecting] = useState<string | null>(null)
  const [connectModal, setConnectModal] = useState<Affiliate | null>(null)
  const [eventType, setEventType] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [guestCount, setGuestCount] = useState('')
  const [notes, setNotes] = useState('')
  const [connectError, setConnectError] = useState('')

  const supabase = createClient()

  useEffect(() => {
    fetch('/api/affiliates/directory')
      .then(r => r.json())
      .then(data => {
        setAffiliates(data.affiliates || [])
        setFiltered(data.affiliates || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    let result = affiliates
    if (state) result = result.filter(a => a.state === state)
    if (city) result = result.filter(a => a.city.toLowerCase().includes(city.toLowerCase()))
    if (typeFilter !== 'all') result = result.filter(a =>
      a.affiliate_type === typeFilter || a.affiliate_type === 'both'
    )
    setFiltered(result)
  }, [state, city, typeFilter, affiliates])

  const handleConnect = async () => {
    if (!connectModal) return
    setConnecting(connectModal.id)
    setConnectError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = `/auth/sign-in?redirect=/events`
        return
      }
      const res = await fetch('/api/payments/affiliate-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliate_id: connectModal.id,
          event_type: eventType,
          event_date: eventDate,
          guest_count: guestCount ? parseInt(guestCount) : null,
          notes,
        }),
      })
      const data = await res.json()
      if (data.checkoutUrl) window.location.href = data.checkoutUrl
      else setConnectError(data.error || 'Something went wrong.')
    } catch {
      setConnectError('Network error. Please try again.')
    } finally {
      setConnecting(null)
    }
  }

  const TypeBadge = ({ type }: { type: string }) => (
    <span style={{
      fontFamily: 'var(--font-cinzel)', fontSize: '8px', letterSpacing: '0.1em',
      padding: '3px 9px', borderRadius: '100px',
      background: 'var(--gold-glow)', color: 'var(--gold)',
      border: '0.5px solid rgba(212,175,110,0.3)',
    }}>
      {type === 'both' ? 'Decorator & Favours' : type === 'decorator' ? 'Decorator' : 'Favours Specialist'}
    </span>
  )

  const Stars = ({ rating }: { rating?: number }) => {
    const r = rating || 0
    return (
      <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
        {[1,2,3,4,5].map(i => (
          <svg key={i} width="11" height="11" viewBox="0 0 11 11">
            <polygon points="5.5,0.5 6.9,3.9 10.5,4.1 7.8,6.5 8.7,10 5.5,8.1 2.3,10 3.2,6.5 0.5,4.1 4.1,3.9"
              fill={i <= r ? '#d4af6e' : 'none'} stroke="#d4af6e" strokeWidth="0.8"/>
          </svg>
        ))}
        {rating && <span style={{ fontFamily: 'var(--font-cormorant)', fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginLeft: '4px' }}>{rating.toFixed(1)}</span>}
      </div>
    )
  }

  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ paddingTop: '88px', minHeight: '100dvh', position: 'relative', zIndex: 2 }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', padding: '48px 24px 40px', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '9px', letterSpacing: '0.28em', color: 'var(--gold)', marginBottom: '14px' }}>
            Find a Decorator
          </div>
          <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: 'clamp(28px,5vw,42px)', fontWeight: 500, color: '#fff', marginBottom: '14px', lineHeight: 1.15 }}>
            Verified for <span style={{ color: 'var(--gold)' }}>Islamic events</span>
          </h1>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '17px', fontStyle: 'italic', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
            Every decorator in our network has been personally reviewed. Pay a one-time $19 connection fee and we'll introduce you — they keep 100% of their service rate.
          </p>
        </div>

        {/* How it works */}
        <div style={{ maxWidth: '800px', margin: '0 auto 40px', padding: '0 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {[
              { n: '01', title: 'Browse & choose', desc: 'Filter by location and event type. View portfolios.' },
              { n: '02', title: 'Pay $19 once', desc: 'Non-refundable finder fee. We make the introduction.' },
              { n: '03', title: 'They contact you', desc: 'Your decorator reaches out within 1–2 business days.' },
            ].map(({ n, title, desc }) => (
              <div key={n} style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(212,175,110,0.12)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '11px', color: 'var(--gold)', opacity: 0.5, marginBottom: '6px' }}>{n}</div>
                <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '12px', color: '#fff', marginBottom: '5px' }}>{title}</div>
                <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '13px', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px 32px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '24px' }}>
            <input
              type="text" placeholder="City…" value={city}
              onChange={e => setCity(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(212,175,110,0.2)', borderRadius: '8px', padding: '10px 14px', fontFamily: 'var(--font-cormorant)', fontSize: '15px', color: '#fff', outline: 'none', width: '160px' }}
            />
            <select value={state} onChange={e => setState(e.target.value)}
              style={{ background: '#0f1f0f', border: '0.5px solid rgba(212,175,110,0.2)', borderRadius: '8px', padding: '10px 14px', fontFamily: 'var(--font-cormorant)', fontSize: '15px', color: state ? '#fff' : 'rgba(255,255,255,0.35)', outline: 'none', cursor: 'pointer', appearance: 'none' }}>
              <option value="">All states</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['all', 'decorator', 'favours'].map(t => (
                <button key={t} onClick={() => setTypeFilter(t)} style={{
                  fontFamily: 'var(--font-cinzel)', fontSize: '9px', letterSpacing: '0.12em',
                  padding: '8px 16px', borderRadius: '100px', cursor: 'pointer', transition: 'all 0.15s',
                  background: typeFilter === t ? 'var(--gold)' : 'transparent',
                  color: typeFilter === t ? 'var(--forest-dark)' : 'rgba(255,255,255,0.5)',
                  border: `0.5px solid ${typeFilter === t ? 'var(--gold)' : 'rgba(255,255,255,0.15)'}`,
                }}>
                  {t === 'all' ? 'All types' : t === 'decorator' ? 'Decorators' : 'Favour Specialists'}
                </button>
              ))}
            </div>
            <span style={{ fontFamily: 'var(--font-cormorant)', fontSize: '13px', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', marginLeft: 'auto' }}>
              {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
            </span>
          </div>

          {/* Affiliate grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: 'var(--font-cormorant)', fontSize: '16px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
              Loading decorators…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '14px', color: '#fff', marginBottom: '8px' }}>No decorators found</div>
              <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '15px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', lineHeight: 1.7 }}>
                Try adjusting your filters, or{' '}
                <a href="/contact" style={{ color: 'var(--gold)' }}>contact us</a> — we may have someone in your area.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {filtered.map(a => (
                <div key={a.id} style={{ background: 'rgba(15,31,15,0.6)', border: '0.5px solid rgba(212,175,110,0.15)', borderRadius: '16px', overflow: 'hidden', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(212,175,110,0.35)') }
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(212,175,110,0.15)') }>

                  {/* Portfolio strip */}
                  <div style={{ height: '130px', background: 'rgba(26,61,26,0.5)', display: 'flex', gap: '2px', overflow: 'hidden' }}>
                    {a.portfolio_urls?.slice(0, 3).map((url, i) => (
                      <div key={i} style={{ flex: 1, overflow: 'hidden' }}>
                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                      </div>
                    ))}
                    {(!a.portfolio_urls || a.portfolio_urls.length === 0) && (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
                        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                          <rect x="4" y="8" width="40" height="32" rx="4" stroke="#d4af6e" strokeWidth="1.5"/>
                          <circle cx="16" cy="20" r="5" stroke="#d4af6e" strokeWidth="1.2"/>
                          <path d="M4 34 L16 24 L26 30 L36 20 L44 26" stroke="#d4af6e" strokeWidth="1.2" fill="none"/>
                        </svg>
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '14px', fontWeight: 500, color: '#fff', marginBottom: '3px' }}>
                          {a.display_name}
                        </div>
                        <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '13px', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}>
                          {a.city}, {a.state}
                        </div>
                      </div>
                      <TypeBadge type={a.affiliate_type}/>
                    </div>

                    <Stars rating={a.avg_rating}/>

                    <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: '10px 0 12px', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {a.bio}
                    </p>

                    {/* Event types */}
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '14px' }}>
                      {a.event_types?.slice(0, 4).map(t => (
                        <span key={t} style={{ fontFamily: 'var(--font-cinzel)', fontSize: '8px', letterSpacing: '0.08em', padding: '2px 8px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                          {t}
                        </span>
                      ))}
                    </div>

                    {a.jobs_completed > 0 && (
                      <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '9px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: '14px' }}>
                        {a.jobs_completed} event{a.jobs_completed !== 1 ? 's' : ''} completed
                      </div>
                    )}

                    <button onClick={() => { setConnectModal(a); setConnectError('') }}
                      style={{ width: '100%', fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '0.14em', color: 'var(--forest-dark)', background: 'var(--gold)', border: 'none', borderRadius: '8px', padding: '12px', cursor: 'pointer', transition: 'opacity 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                      Connect — $19
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Are you a decorator? CTA */}
        <div style={{ textAlign: 'center', padding: '40px 24px 80px', borderTop: '0.5px solid rgba(212,175,110,0.08)', marginTop: '20px' }}>
          <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '9px', letterSpacing: '0.24em', color: 'var(--gold)', marginBottom: '12px' }}>For decorators</div>
          <h2 style={{ fontFamily: 'var(--font-cinzel)', fontSize: '24px', fontWeight: 500, color: '#fff', marginBottom: '10px' }}>Are you an event decorator?</h2>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '16px', fontStyle: 'italic', color: 'rgba(255,255,255,0.45)', marginBottom: '20px' }}>Join our verified network. Keep 100% of your service fee.</p>
          <a href="/affiliates/apply" className="btn-gold" style={{ textDecoration: 'none' }}>Apply to join</a>
        </div>
      </main>
      <Footer />

      {/* Connect modal */}
      {connectModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setConnectModal(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#111b11', border: '0.5px solid rgba(212,175,110,0.25)', borderRadius: '16px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid rgba(212,175,110,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '14px', color: '#fff' }}>Connect with {connectModal.display_name}</div>
                <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginTop: '2px' }}>{connectModal.city}, {connectModal.state}</div>
              </div>
              <button onClick={() => setConnectModal(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: 'rgba(212,175,110,0.07)', border: '0.5px solid rgba(212,175,110,0.2)', borderRadius: '8px', padding: '12px', fontFamily: 'var(--font-cormorant)', fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, fontStyle: 'italic' }}>
                A one-time <strong style={{ color: 'var(--gold)', fontStyle: 'normal' }}>$19 non-refundable</strong> finder fee connects you with {connectModal.display_name}. They will reach out within 1–2 business days to discuss your event.
              </div>

              {[
                { label: 'Event type', el: (
                  <select value={eventType} onChange={e => setEventType(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(212,175,110,0.18)', borderRadius: '8px', padding: '11px 14px', fontFamily: 'var(--font-cormorant)', fontSize: '15px', color: eventType ? '#fff' : 'rgba(255,255,255,0.35)', outline: 'none', appearance: 'none', cursor: 'pointer' }}>
                    <option value="">Select event type…</option>
                    {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )},
                { label: 'Event date (approx.)', el: (
                  <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="ge-input" style={{ colorScheme: 'dark' }}/>
                )},
                { label: 'Expected guest count', el: (
                  <input type="number" value={guestCount} onChange={e => setGuestCount(e.target.value)} placeholder="e.g. 150" className="ge-input"/>
                )},
                { label: 'Any notes for the decorator', el: (
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Venue, theme, special requests…" className="ge-input" rows={3} style={{ resize: 'vertical', lineHeight: 1.5 }}/>
                )},
              ].map(({ label, el }) => (
                <div key={label}>
                  <label style={{ fontFamily: 'var(--font-cinzel)', fontSize: '8.5px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: '7px' }}>{label}</label>
                  {el}
                </div>
              ))}

              {connectError && (
                <div style={{ background: 'rgba(226,75,74,0.1)', border: '0.5px solid rgba(226,75,74,0.25)', borderRadius: '8px', padding: '10px 12px', fontFamily: 'var(--font-cormorant)', fontSize: '13px', color: '#e24b4a' }}>
                  {connectError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setConnectModal(null)} style={{ flex: 1, fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)', background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '12px', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleConnect} disabled={!!connecting}
                  style={{ flex: 2, fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '0.14em', color: 'var(--forest-dark)', background: 'var(--gold)', border: 'none', borderRadius: '8px', padding: '12px', cursor: connecting ? 'not-allowed' : 'pointer', opacity: connecting ? 0.6 : 1 }}>
                  {connecting ? 'Redirecting…' : 'Pay $19 & connect'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
