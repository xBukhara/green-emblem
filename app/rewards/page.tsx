'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createClient } from '@/lib/supabase/client'
import { fetchRewards, ACTION_META } from '@/lib/rewards'

const card: React.CSSProperties = { background: 'rgba(15,31,15,0.55)', border: '0.5px solid rgba(212,175,110,0.12)', borderRadius: '16px', padding: '24px' }
const sectionLabel: React.CSSProperties = { fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.2em', color: '#d4af6e', marginBottom: '16px' }
const inputStyle: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(212,175,110,0.25)', borderRadius: '9px', padding: '10px 12px', fontFamily: 'Georgia, serif', fontSize: '14px', color: '#fff', outline: 'none' }

// The daily checklist shown on the page, in a sensible daily order
const DAILY_ACTIONS = ['prayer_times', 'prayer_fajr', 'prayer_dhuhr', 'prayer_asr', 'prayer_maghrib', 'prayer_isha', 'quran_read', 'community']

type Catalog = { id: string; name: string; description: string | null; image_url: string | null; points_cost: number; stock: number | null }

export default function RewardsPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [checked, setChecked] = useState(false)
  const [data, setData] = useState<any>(null)

  const [redeeming, setRedeeming] = useState<Catalog | null>(null)
  const [addr, setAddr] = useState({ name: '', line1: '', line2: '', city: '', state: '', zip: '' })
  const [submitting, setSubmitting] = useState(false)
  const [redeemMsg, setRedeemMsg] = useState('')

  const load = () => fetchRewards(supabase).then(d => setData(d))

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user)
      if (user) {
        await load()
        // Prefill shipping from profile
        const { data: p } = await supabase.from('profiles').select('first_name, last_name, address').eq('id', user.id).maybeSingle()
        if (p) setAddr(a => ({
          ...a,
          name: [p.first_name, p.last_name].filter(Boolean).join(' '),
          line1: p.address?.line1 || '', city: p.address?.city || '',
          state: p.address?.state || '', zip: p.address?.zip || '',
        }))
      }
      setChecked(true)
    })
  }, [])

  const submitRedemption = async () => {
    if (!redeeming) return
    setSubmitting(true); setRedeemMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSubmitting(false); return }
    const res = await fetch('/api/rewards/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ reward_id: redeeming.id, shipping_address: addr }),
    })
    const result = await res.json()
    setSubmitting(false)
    if (!res.ok || result.error) {
      setRedeemMsg(result.error === 'insufficient_points'
        ? `Not enough points yet — you need ${result.needed?.toLocaleString()} and have ${result.balance?.toLocaleString()}.`
        : result.error === 'out_of_stock' ? 'This item just sold out — check back soon.'
        : 'Something went wrong. Please try again.')
      return
    }
    setRedeeming(null)
    setRedeemMsg('')
    await load()
  }

  const points = data?.points
  const today: string[] = data?.today_actions || []
  const catalog: Catalog[] = data?.catalog || []
  const redemptions: any[] = data?.redemptions || []

  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ position: 'relative', zIndex: 2, minHeight: '100dvh', padding: '120px 24px 80px', maxWidth: '760px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '0.3em', color: 'var(--gold)', marginBottom: '16px' }}>REWARDS</div>
          <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: 'clamp(28px,5vw,44px)', fontWeight: 500, color: '#fff', marginBottom: '12px' }}>Consistency, rewarded</h1>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '17px', fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
            Small daily acts — prayer, Quran, community — add up. Redeem your points for Green Emblem merch.
          </p>
        </div>

        {!checked ? null : !user ? (
          <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '17px', fontStyle: 'italic', color: 'rgba(255,255,255,0.55)', lineHeight: 1.8, marginBottom: '22px' }}>
              Sign in to start earning — reading Quran, checking prayer times, and staying close to your community all count.
            </p>
            <Link href="/auth/sign-in" className="btn-gold" style={{ display: 'inline-block', textDecoration: 'none', padding: '12px 28px', borderRadius: '9px' }}>Sign in to begin</Link>
          </div>
        ) : (
          <>
            {/* ── Balance + streak ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div style={{ ...card, textAlign: 'center' }}>
                <div style={{ fontSize: '22px', color: '#d4af6e', marginBottom: '6px' }}>✦</div>
                <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '34px', color: '#fff' }}>{(points?.balance ?? 0).toLocaleString()}</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '10px', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.4)' }}>POINTS</div>
              </div>
              <div style={{ ...card, textAlign: 'center' }}>
                <div style={{ fontSize: '22px', marginBottom: '6px', color: (points?.current_streak ?? 0) > 0 ? '#f0d48a' : 'rgba(255,255,255,0.25)' }}>◆</div>
                <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '34px', color: '#fff' }}>{points?.current_streak ?? 0}</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '10px', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.4)' }}>
                  DAY STREAK{points?.longest_streak > 1 ? ` · BEST ${points.longest_streak}` : ''}
                </div>
              </div>
            </div>

            {/* ── Today's checklist ── */}
            <div style={{ ...card, marginBottom: '14px' }}>
              <div style={sectionLabel}>EARN TODAY</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {DAILY_ACTIONS.map(a => {
                  const done = today.includes(a)
                  const meta = ACTION_META[a]
                  const href = a === 'quran_read' ? '/prayer?tab=quran' : a === 'community' ? '/greenworld-plus' : '/prayer'
                  return (
                    <Link key={a} href={href} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '9px', background: done ? 'rgba(46,107,46,0.08)' : 'rgba(255,255,255,0.02)', textDecoration: 'none' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          width: '18px', height: '18px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          border: done ? 'none' : '1px solid rgba(255,255,255,0.2)', background: done ? '#2e6b2e' : 'transparent',
                          color: '#f5f0e6', fontSize: '10px',
                        }}>{done ? '✓' : ''}</span>
                        <span style={{ fontFamily: 'Georgia, serif', fontSize: '14px', color: done ? 'rgba(255,255,255,0.45)' : '#fff' }}>{meta.label}</span>
                      </span>
                      <span style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 600, color: done ? 'rgba(212,175,110,0.4)' : '#d4af6e' }}>+{meta.points}</span>
                    </Link>
                  )
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px' }}>
                  <span style={{ fontFamily: 'Georgia, serif', fontSize: '12px', fontStyle: 'italic', color: 'rgba(255,255,255,0.35)' }}>
                    Daily streak bonus — +5 × your streak, up to +50
                  </span>
                  <span style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 600, color: '#9b8ec4' }}>auto</span>
                </div>
              </div>
            </div>

            {/* ── Catalog ── */}
            <div style={{ ...card, marginBottom: '14px' }}>
              <div style={sectionLabel}>REDEEM</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {catalog.map(r => {
                  const affordable = (points?.balance ?? 0) >= r.points_cost
                  const soldOut = r.stock !== null && r.stock <= 0
                  return (
                    <div key={r.id} style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(212,175,110,0.1)', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '14px', color: '#fff' }}>{r.name}</div>
                      {r.description && <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '13px', fontStyle: 'italic', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, flex: 1 }}>{r.description}</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', fontWeight: 600, color: '#f0d48a' }}>✦ {r.points_cost.toLocaleString()}</span>
                        <button
                          onClick={() => { setRedeeming(r); setRedeemMsg('') }}
                          disabled={!affordable || soldOut}
                          style={{
                            fontFamily: 'var(--font-inter)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em',
                            padding: '7px 14px', borderRadius: '8px', border: 'none',
                            cursor: affordable && !soldOut ? 'pointer' : 'not-allowed',
                            background: affordable && !soldOut ? '#d4af6e' : 'rgba(255,255,255,0.06)',
                            color: affordable && !soldOut ? '#0f1f0f' : 'rgba(255,255,255,0.3)',
                          }}
                        >
                          {soldOut ? 'Sold out' : 'Redeem'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── History ── */}
            {redemptions.length > 0 && (
              <div style={card}>
                <div style={sectionLabel}>YOUR REDEMPTIONS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {redemptions.map(r => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '9px' }}>
                      <span style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: '#fff' }}>{r.rewards_catalog?.name}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>✦ {r.points_spent.toLocaleString()}</span>
                        <span style={{
                          fontFamily: 'var(--font-inter)', fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                          padding: '3px 10px', borderRadius: '20px',
                          background: r.status === 'fulfilled' ? 'rgba(46,107,46,0.15)' : 'rgba(212,175,110,0.1)',
                          color: r.status === 'fulfilled' ? '#5a9e5a' : '#d4af6e',
                        }}>{r.status === 'pending' ? 'On its way soon' : r.status}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Redeem modal ── */}
      {redeeming && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(5,10,5,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => !submitting && setRedeeming(null)}>
          <div style={{ ...card, width: '100%', maxWidth: '420px', background: '#101f10' }} onClick={e => e.stopPropagation()}>
            <div style={sectionLabel}>SHIP MY REWARD</div>
            <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '16px', color: '#fff', marginBottom: '4px' }}>{redeeming.name}</div>
            <div style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: '#f0d48a', marginBottom: '18px' }}>✦ {redeeming.points_cost.toLocaleString()} points</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input style={inputStyle} placeholder="Full name" value={addr.name} onChange={e => setAddr(a => ({ ...a, name: e.target.value }))}/>
              <input style={inputStyle} placeholder="Street address" value={addr.line1} onChange={e => setAddr(a => ({ ...a, line1: e.target.value }))}/>
              <input style={inputStyle} placeholder="Apt / unit (optional)" value={addr.line2} onChange={e => setAddr(a => ({ ...a, line2: e.target.value }))}/>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px' }}>
                <input style={inputStyle} placeholder="City" value={addr.city} onChange={e => setAddr(a => ({ ...a, city: e.target.value }))}/>
                <input style={inputStyle} placeholder="State" value={addr.state} onChange={e => setAddr(a => ({ ...a, state: e.target.value }))}/>
                <input style={inputStyle} placeholder="ZIP" value={addr.zip} onChange={e => setAddr(a => ({ ...a, zip: e.target.value }))}/>
              </div>
            </div>
            {redeemMsg && <p style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: '#e87573', marginTop: '12px' }}>{redeemMsg}</p>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
              <button onClick={() => setRedeeming(null)} disabled={submitting} style={{ flex: 1, fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px', padding: '11px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={submitRedemption} disabled={submitting || !addr.line1 || !addr.city || !addr.state || !addr.zip} style={{ flex: 2, fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 600, color: '#0f1f0f', background: '#d4af6e', border: 'none', borderRadius: '8px', padding: '11px', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
                {submitting ? 'Redeeming…' : 'Confirm redemption'}
              </button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </>
  )
}
