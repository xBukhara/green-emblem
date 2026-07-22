'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createClient } from '@/lib/supabase/client'
import { Suspense } from 'react'

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#080f08' }}/>}>
      <DashboardInner/>
    </Suspense>
  )
}

// ── Islamic design presets (based on uploaded images) ──────────────────────────
const DESIGN_PRESETS = [
  {
    id: 'gold_geometric',
    name: 'Gold Geometric',
    desc: 'Golden arabesque tile pattern',
    bg: '#1a1200', accent: '#d4af6e', textColor: '#fff',
    pattern: 'geometric_tile',
    preview: ['#1a1200', '#d4af6e', '#f5e6a0'],
  },
  {
    id: 'burgundy_arch',
    name: 'Burgundy Arch',
    desc: 'Deep burgundy with gold arch frame',
    bg: '#2d0a1a', accent: '#c9956c', textColor: '#fff',
    pattern: 'arch',
    preview: ['#2d0a1a', '#c9956c', '#f0c070'],
  },
  {
    id: 'blue_mosque',
    name: 'Blue Mosque',
    desc: 'Deep blue with light geometric window',
    bg: '#030d1a', accent: '#378ADD', textColor: '#fff',
    pattern: 'mosque_window',
    preview: ['#030d1a', '#378ADD', '#90c8f0'],
  },
  {
    id: 'forest_gold',
    name: 'Forest & Gold',
    desc: 'Classic Green Emblem palette',
    bg: '#0f1f0f', accent: '#d4af6e', textColor: '#fff',
    pattern: 'star8',
    preview: ['#0f1f0f', '#d4af6e', '#f5f0e6'],
  },
  {
    id: 'ivory_green',
    name: 'Ivory & Green',
    desc: 'Light, clean — cream background',
    bg: '#f5f0e6', accent: '#2e6b2e', textColor: '#1a3d1a',
    pattern: 'star8',
    preview: ['#f5f0e6', '#2e6b2e', '#ffffff'],
  },
  {
    id: 'charcoal_rose',
    name: 'Charcoal & Rose',
    desc: 'Sophisticated dark with warm accent',
    bg: '#111111', accent: '#c4906a', textColor: '#fff',
    pattern: 'geometric_tile',
    preview: ['#111111', '#c4906a', '#ffffff'],
  },
]

const FONTS = [
  { id: 'cinzel', name: 'Cinzel', label: 'Cinzel (Classic)' },
  { id: 'cormorant', name: 'Cormorant', label: 'Cormorant (Elegant)' },
  { id: 'georgia', name: 'Georgia', label: 'Georgia (Traditional)' },
  { id: 'playfair', name: 'Playfair Display', label: 'Playfair (Editorial)' },
]

function DashboardInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [donations, setDonations] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'impact'|'campaigns'|'orders'|'profile'>('impact')
  const [editingCampaign, setEditingCampaign] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [welcome, setWelcome] = useState(false)

  // Campaign editor state
  const [editDesign, setEditDesign] = useState<typeof DESIGN_PRESETS[0] | null>(null)
  const [editGreeting, setEditGreeting] = useState('')
  const [editNames, setEditNames] = useState('')
  const [editFont, setEditFont] = useState('cinzel')
  const [editCustomColor, setEditCustomColor] = useState('')

  useEffect(() => {
    if (searchParams.get('welcome') === '1') setWelcome(true)
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/sign-in'); return }
      setUser(user)

      // Check onboarding
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!profile?.onboarding_complete) { router.push('/onboarding'); return }
      setProfile(profile)

      // Load everything
      const [donationsRes, requestsRes, ordersRes] = await Promise.all([
        supabase.from('donations').select('*, campaigns(slug, honoree_names, event_type)').eq('user_id', user.id).eq('confirmed', true).order('created_at', { ascending: false }),
        supabase.from('campaign_requests').select('*').eq('email', user.email).order('submitted_at', { ascending: false }),
        supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ])
      setDonations(donationsRes.data || [])
      setRequests(requestsRes.data || [])
      setOrders(ordersRes.data || [])

      // Load campaigns by request IDs
      const reqs = requestsRes.data || []
      if (reqs.length > 0) {
        const { data: camps } = await supabase.from('campaigns').select('*').in('request_id', reqs.map((r: any) => r.id)).order('created_at', { ascending: false })
        setCampaigns(camps || [])
      }
      setLoading(false)
    })
  }, [])

  const totalDonated = donations.reduce((s, d) => s + (d.amount || 0), 0)
  const totalMeals = donations.reduce((s, d) => s + (d.meals_funded || 0), 0)

  const openEditor = (campaign: any) => {
    setEditingCampaign(campaign)
    const preset = DESIGN_PRESETS.find(d => d.id === campaign.theme?.color_scheme) || DESIGN_PRESETS[0]
    setEditDesign(preset)
    setEditGreeting(campaign.theme?.greeting_text || '')
    setEditNames(campaign.honoree_names || '')
    setEditFont(campaign.theme?.font || 'cinzel')
    setEditCustomColor(campaign.theme?.custom_accent || '')
  }

  const saveDesign = async () => {
    if (!editingCampaign || !editDesign) return
    setSaving(true)
    await supabase.from('campaigns').update({
      honoree_names: editNames,
      theme: {
        ...editingCampaign.theme,
        color_scheme: editDesign.id,
        bg: editDesign.bg,
        accent: editCustomColor || editDesign.accent,
        pattern: editDesign.pattern,
        greeting_text: editGreeting,
        font: editFont,
      },
    }).eq('id', editingCampaign.id)
    // Refresh
    const reqs = requests
    if (reqs.length > 0) {
      const { data: camps } = await supabase.from('campaigns').select('*').in('request_id', reqs.map((r: any) => r.id)).order('created_at', { ascending: false })
      setCampaigns(camps || [])
    }
    setEditingCampaign(null)
    setSaving(false)
  }

  const charityLabel = (id: string) => ({ share_the_meal: 'Share The Meal', islamic_relief: 'Islamic Relief USA', unicef: 'UNICEF USA' }[id] || id)
  const charityColor = (id: string) => ({ share_the_meal: '#E8A020', islamic_relief: '#1D9E75', unicef: '#378ADD' }[id] || '#d4af6e')
  const statusColor = (s: string) => ({ active: '#1D9E75', ended: 'rgba(255,255,255,0.3)', pending: '#d4a017' }[s] || '#d4a017')

  const firstName = profile?.first_name || profile?.full_name?.split(' ')[0] || 'there'

  if (loading) return (
    <>
      <Nav />
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080f08' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>Loading…</div>
      </div>
    </>
  )

  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav/>
      <main style={{ paddingTop: '88px', minHeight: '100dvh', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: '880px', margin: '0 auto', padding: '36px 24px 80px' }}>

          {/* Welcome banner */}
          {welcome && (
            <div style={{ background: 'rgba(46,107,46,0.12)', border: '0.5px solid rgba(46,107,46,0.35)', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#1D9E75" strokeWidth="1.5"/><polyline points="7,12 10,15 17,9" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round"/></svg>
              <div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '14px', color: '#fff', marginBottom: '2px' }}>Ahlan wa sahlan, {firstName}! Your profile is set up.</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>Barak Allahu feekum. This is your Green Emblem home.</div>
              </div>
              <button onClick={() => setWelcome(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '18px', cursor: 'pointer' }}>×</button>
            </div>
          )}

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px', flexWrap: 'wrap' }}>
            {user?.user_metadata?.avatar_url && <img src={user.user_metadata.avatar_url} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid rgba(212,175,110,0.3)' }}/>}
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.28em', color: 'rgba(212,175,110,0.8)', marginBottom: '6px' }}>YOUR DASHBOARD</div>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(20px,4vw,32px)', fontWeight: 400, color: '#fff' }}>
                Assalamu Alaikum, {firstName}
              </h1>
            </div>
            {profile?.role === 'admin' && (
              <a href="/admin" style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.12em', color: '#d4af6e', border: '0.5px solid rgba(212,175,110,0.3)', padding: '8px 14px', borderRadius: '7px', textDecoration: 'none' }}>Admin console →</a>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '24px' }}>
            {[
              { label: 'Total given', value: `$${totalDonated.toFixed(2)}`, color: '#d4af6e' },
              { label: 'Meals funded', value: totalMeals.toLocaleString(), color: '#E8A020' },
              { label: 'My campaigns', value: campaigns.length, color: '#1D9E75' },
              { label: 'Orders', value: orders.length, color: '#d4af6e' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'rgba(15,31,15,0.55)', border: '0.5px solid rgba(212,175,110,0.12)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '8px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.3)', marginBottom: '6px' }}>{label}</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '26px', fontWeight: 300, color, lineHeight: 1 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '3px', marginBottom: '18px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '3px', width: 'fit-content' }}>
            {([['impact', 'Giving'], ['campaigns', 'Campaigns'], ['orders', 'Orders'], ['profile', 'Profile']] as [typeof tab, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{ fontFamily: 'Georgia, serif', fontSize: '11px', letterSpacing: '0.1em', padding: '7px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', background: tab === id ? 'rgba(212,175,110,0.1)' : 'transparent', color: tab === id ? '#d4af6e' : 'rgba(255,255,255,0.4)', transition: 'all 0.15s' }}>
                {label}
              </button>
            ))}
          </div>

          {/* ── GIVING TAB ── */}
          {tab === 'impact' && (
            donations.length === 0 ? (
              <div style={{ background: 'rgba(15,31,15,0.4)', border: '0.5px solid rgba(212,175,110,0.1)', borderRadius: '14px', padding: '48px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>No donations yet</div>
                <a href="/sadaqah" style={{ fontFamily: 'Georgia, serif', fontSize: '10px', letterSpacing: '0.14em', color: '#0f1f0f', background: '#d4af6e', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block', marginTop: '8px' }}>
                  Learn about Baab As-Sadaqah
                </a>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {donations.map(d => (
                  <div key={d.id} style={{ background: 'rgba(15,31,15,0.55)', border: '0.5px solid rgba(212,175,110,0.1)', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    <div style={{ width: '3px', height: '40px', borderRadius: '2px', background: charityColor(d.charity), flexShrink: 0 }}/>
                    <div style={{ flex: 1, minWidth: '120px' }}>
                      <div style={{ fontFamily: 'Georgia, serif', fontSize: '15px', color: '#fff', marginBottom: '2px' }}>{d.campaigns?.honoree_names || 'Campaign'}</div>
                      <div style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em' }}>{charityLabel(d.charity)}</div>
                    </div>
                    {d.meals_funded > 0 && <div style={{ textAlign: 'center' }}><div style={{ fontFamily: 'Georgia, serif', fontSize: '14px', color: '#E8A020' }}>{d.meals_funded}</div><div style={{ fontFamily: 'Georgia, serif', fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>MEALS</div></div>}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'Georgia, serif', fontSize: '20px', color: '#d4af6e' }}>${d.amount?.toFixed(2)}</div>
                      <div style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>{new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                  </div>
                ))}
                <div style={{ background: 'rgba(26,61,26,0.12)', border: '0.5px solid rgba(212,175,110,0.08)', borderRadius: '12px', padding: '16px', textAlign: 'center', marginTop: '4px' }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '18px', color: '#d4af6e', direction: 'rtl', opacity: 0.5, marginBottom: '4px' }}>تَقَبَّلَ اللَّهُ مِنَّا وَمِنكُمْ</div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>May Allah accept from us and from you.</div>
                </div>
              </div>
            )
          )}

          {/* ── CAMPAIGNS TAB ── */}
          {tab === 'campaigns' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {campaigns.map((c: any) => {
                const preset = DESIGN_PRESETS.find(d => d.id === c.theme?.color_scheme) || DESIGN_PRESETS[0]
                return (
                  <div key={c.id} style={{ background: 'rgba(15,31,15,0.55)', border: '0.5px solid rgba(212,175,110,0.12)', borderRadius: '14px', overflow: 'hidden' }}>
                    <div style={{ height: '4px', background: `linear-gradient(90deg, ${preset.bg}, ${preset.accent})` }}/>
                    <div style={{ padding: '18px 22px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                            <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', color: '#fff' }}>{c.honoree_names}</div>
                            <span style={{ fontFamily: 'Georgia, serif', fontSize: '9px', padding: '2px 9px', borderRadius: '20px', background: `${statusColor(c.status)}18`, color: statusColor(c.status), border: `0.5px solid ${statusColor(c.status)}40` }}>{c.status}</span>
                          </div>
                          <div style={{ fontFamily: 'Georgia, serif', fontSize: '11px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>
                            {c.event_type}{c.event_date ? ` · ${c.event_date}` : ''}{c.expires_at ? ` · Expires ${new Date(c.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {c.status === 'active' && <>
                            <a href={`/give/${c.slug}`} target="_blank" style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.1em', color: '#d4af6e', border: '0.5px solid rgba(212,175,110,0.35)', padding: '7px 12px', borderRadius: '7px', textDecoration: 'none' }}>View live</a>
                            <a href={`/api/campaigns/${c.slug}/qr-card?format=png`} download style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.1em', color: '#0f1f0f', background: '#d4af6e', padding: '7px 12px', borderRadius: '7px', textDecoration: 'none' }}>QR code</a>
                            <button onClick={() => openEditor(c)} style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', padding: '7px 12px', borderRadius: '7px', cursor: 'pointer' }}>
                              Edit design
                            </button>
                          </>}
                        </div>
                      </div>
                      {c.status === 'active' && (c.total_raised > 0 || c.donor_count > 0) && (
                        <div style={{ display: 'flex', gap: '20px', paddingTop: '12px', borderTop: '0.5px solid rgba(212,175,110,0.08)' }}>
                          {[{ label: 'Raised', value: `$${(c.total_raised || 0).toFixed(2)}` }, { label: 'Donors', value: c.donor_count || 0 }, { label: 'Meals', value: c.meals_funded || 0 }].map(({ label, value }) => (
                            <div key={label}><div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', color: '#d4af6e' }}>{value}</div><div style={{ fontFamily: 'Georgia, serif', fontSize: '8px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>{label}</div></div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Pending requests not yet campaigns */}
              {requests.filter(r => !campaigns.find((c: any) => c.request_id === r.id)).map((r: any) => (
                <div key={r.id} style={{ background: 'rgba(15,31,15,0.3)', border: '0.5px solid rgba(212,175,110,0.08)', borderRadius: '14px', padding: '18px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: '15px', color: 'rgba(255,255,255,0.7)' }}>{r.honoree_names}</div>
                    <span style={{ fontFamily: 'Georgia, serif', fontSize: '9px', padding: '2px 9px', borderRadius: '20px', background: 'rgba(186,117,23,0.1)', color: '#d4a017', border: '0.5px solid rgba(186,117,23,0.25)' }}>
                      {r.status === 'approved' ? 'Build link sent — check email' : 'Submitted'}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>{r.event_type}{r.event_date ? ` · ${r.event_date}` : ''}</div>
                </div>
              ))}

              {campaigns.length === 0 && requests.length === 0 && (
                <div style={{ background: 'rgba(15,31,15,0.4)', border: '0.5px solid rgba(212,175,110,0.1)', borderRadius: '14px', padding: '48px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>No campaigns yet</div>
                  <a href="/sadaqah/request" style={{ fontFamily: 'Georgia, serif', fontSize: '10px', letterSpacing: '0.14em', color: '#0f1f0f', background: '#d4af6e', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block', marginTop: '8px' }}>Request a campaign</a>
                </div>
              )}

              <a href="/sadaqah/request" style={{ fontFamily: 'Georgia, serif', fontSize: '10px', letterSpacing: '0.14em', color: '#d4af6e', border: '0.5px solid rgba(212,175,110,0.25)', padding: '12px', borderRadius: '10px', textDecoration: 'none', textAlign: 'center', display: 'block' }}>
                + Request another campaign
              </a>
            </div>
          )}

          {/* ── ORDERS TAB ── */}
          {tab === 'orders' && (
            orders.length === 0 ? (
              <div style={{ background: 'rgba(15,31,15,0.4)', border: '0.5px solid rgba(212,175,110,0.1)', borderRadius: '14px', padding: '48px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>No orders yet</div>
                <a href="/shop" style={{ fontFamily: 'Georgia, serif', fontSize: '10px', letterSpacing: '0.14em', color: '#0f1f0f', background: '#d4af6e', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block', marginTop: '8px' }}>Visit the shop</a>
              </div>
            ) : (
              <div style={{ background: 'rgba(15,31,15,0.55)', border: '0.5px solid rgba(212,175,110,0.12)', borderRadius: '14px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Order', 'Type', 'Total', 'Status'].map(h => (
                        <th key={h} style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.3)', padding: '12px 16px', textAlign: 'left', borderBottom: '0.5px solid rgba(212,175,110,0.08)', fontWeight: 400 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o: any) => (
                      <tr key={o.id}>
                        <td style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(212,175,110,0.05)', fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em' }}>{o.order_number}</td>
                        <td style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(212,175,110,0.05)', fontFamily: 'Georgia, serif', fontSize: '13px', color: '#fff' }}>{o.order_type}</td>
                        <td style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(212,175,110,0.05)', fontFamily: 'Georgia, serif', fontSize: '14px', color: '#d4af6e' }}>${o.total?.toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(212,175,110,0.05)' }}>
                          <span style={{ fontFamily: 'Georgia, serif', fontSize: '9px', padding: '3px 9px', borderRadius: '20px', background: o.status === 'delivered' ? 'rgba(29,158,117,0.12)' : o.status === 'processing' ? 'rgba(212,175,110,0.1)' : 'rgba(255,255,255,0.06)', color: o.status === 'delivered' ? '#1D9E75' : o.status === 'processing' ? '#d4af6e' : 'rgba(255,255,255,0.4)' }}>{o.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* ── PROFILE TAB ── */}
          {tab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: 'rgba(15,31,15,0.55)', border: '0.5px solid rgba(212,175,110,0.12)', borderRadius: '14px', padding: '22px' }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.2em', color: '#d4af6e', marginBottom: '16px' }}>ACCOUNT DETAILS</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
                  {user?.user_metadata?.avatar_url && <img src={user.user_metadata.avatar_url} alt="" style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px solid rgba(212,175,110,0.3)' }}/>}
                  <div>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: '17px', color: '#fff', marginBottom: '3px' }}>{profile?.first_name} {profile?.last_name}</div>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}>{user?.email}</div>
                    {profile?.local_mosque && <div style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '3px' }}>{profile.local_mosque}</div>}
                  </div>
                </div>
                {profile?.address?.line1 && (
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.3)', marginBottom: '5px' }}>SHIPPING ADDRESS</div>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                      {profile.address.line1}<br/>{profile.address.city}, {profile.address.state} {profile.address.zip}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {profile?.newsletter_opted_in && <span style={{ fontFamily: 'Georgia, serif', fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(46,107,46,0.12)', color: '#1D9E75', border: '0.5px solid rgba(46,107,46,0.3)' }}>Newsletter ✓</span>}
                  {profile?.role === 'admin' && <span style={{ fontFamily: 'Georgia, serif', fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(212,175,110,0.1)', color: '#d4af6e', border: '0.5px solid rgba(212,175,110,0.3)' }}>Admin</span>}
                </div>
              </div>

              <div style={{ background: 'rgba(15,31,15,0.55)', border: '0.5px solid rgba(212,175,110,0.12)', borderRadius: '14px', padding: '22px' }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.2em', color: '#d4af6e', marginBottom: '14px' }}>QUICK LINKS</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[{ href: '/sadaqah/request', label: 'Request a campaign' }, { href: '/shop', label: 'Islamic shop' }].map(({ href, label }) => (
                    <a key={href} href={href} style={{ fontFamily: 'Georgia, serif', fontSize: '10px', letterSpacing: '0.1em', color: '#d4af6e', border: '0.5px solid rgba(212,175,110,0.25)', padding: '8px 14px', borderRadius: '8px', textDecoration: 'none' }}>{label}</a>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
      <Footer/>

      {/* ── Campaign design editor modal ── */}
      {editingCampaign && (
        <div onClick={e => { if (e.target === e.currentTarget) setEditingCampaign(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 300, display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: '0' }}>
          <div style={{ background: '#0d1a0d', border: '0.5px solid rgba(212,175,110,0.2)', width: '100%', maxWidth: '860px', margin: 'auto', borderRadius: '16px', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 340px', maxHeight: '90vh' }}>

            {/* Left: controls */}
            <div style={{ overflowY: 'auto', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '14px', color: '#fff' }}>Edit campaign design</div>
                <button onClick={() => setEditingCampaign(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '20px', cursor: 'pointer' }}>×</button>
              </div>

              {/* Names */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontFamily: 'Georgia, serif', fontSize: '8px', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: '7px' }}>HONOUREES NAMES</label>
                <input type="text" value={editNames} onChange={e => setEditNames(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(212,175,110,0.2)', borderRadius: '8px', padding: '11px 13px', fontFamily: 'Georgia, serif', fontSize: '15px', color: '#fff', outline: 'none' }}/>
              </div>

              {/* Greeting */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontFamily: 'Georgia, serif', fontSize: '8px', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: '7px' }}>GREETING MESSAGE</label>
                <textarea value={editGreeting} onChange={e => setEditGreeting(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(212,175,110,0.2)', borderRadius: '8px', padding: '11px 13px', fontFamily: 'Georgia, serif', fontSize: '14px', color: '#fff', outline: 'none', resize: 'vertical', minHeight: '60px', lineHeight: 1.5 }}/>
              </div>

              {/* Design presets */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontFamily: 'Georgia, serif', fontSize: '8px', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: '12px' }}>DESIGN THEME</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {DESIGN_PRESETS.map(preset => (
                    <button key={preset.id} onClick={() => setEditDesign(preset)} style={{ background: editDesign?.id === preset.id ? `${preset.accent}15` : 'rgba(255,255,255,0.03)', border: `0.5px solid ${editDesign?.id === preset.id ? preset.accent + '60' : 'rgba(255,255,255,0.08)'}`, borderRadius: '9px', padding: '10px 8px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                        {preset.preview.map((c, i) => <div key={i} style={{ width: '12px', height: '12px', borderRadius: '50%', background: c, border: '0.5px solid rgba(255,255,255,0.1)' }}/>)}
                      </div>
                      <div style={{ fontFamily: 'Georgia, serif', fontSize: '10px', color: editDesign?.id === preset.id ? preset.accent : 'rgba(255,255,255,0.55)', lineHeight: 1.3 }}>{preset.name}</div>
                      <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', marginTop: '2px', lineHeight: 1.3 }}>{preset.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom accent color */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontFamily: 'Georgia, serif', fontSize: '8px', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: '10px' }}>CUSTOM ACCENT COLOUR (optional)</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="color" value={editCustomColor || editDesign?.accent || '#d4af6e'} onChange={e => setEditCustomColor(e.target.value)} style={{ width: '44px', height: '36px', borderRadius: '6px', border: '0.5px solid rgba(255,255,255,0.15)', cursor: 'pointer', background: 'none', padding: '2px' }}/>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>Pick any colour to override the theme accent</div>
                  {editCustomColor && <button onClick={() => setEditCustomColor('')} style={{ fontFamily: 'Georgia, serif', fontSize: '9px', color: 'rgba(255,255,255,0.3)', background: 'none', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '5px 9px', cursor: 'pointer' }}>Reset</button>}
                </div>
              </div>

              {/* Font */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontFamily: 'Georgia, serif', fontSize: '8px', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: '10px' }}>HEADING FONT</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {FONTS.map(f => (
                    <button key={f.id} onClick={() => setEditFont(f.id)} style={{ background: editFont === f.id ? 'rgba(46,107,46,0.12)' : 'rgba(255,255,255,0.03)', border: `0.5px solid ${editFont === f.id ? 'rgba(212,175,110,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '8px', padding: '10px 13px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: f.name === 'Georgia' ? 'Georgia, serif' : `"${f.name}", Georgia, serif`, fontSize: '15px', color: editFont === f.id ? '#fff' : 'rgba(255,255,255,0.55)' }}>Aa — {f.label}</span>
                      {editFont === f.id && <svg width="12" height="10" viewBox="0 0 12 10"><polyline points="1,5 4.5,8.5 11,1" fill="none" stroke="#d4af6e" strokeWidth="2" strokeLinecap="round"/></svg>}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setEditingCampaign(null)} style={{ flex: 1, fontFamily: 'Georgia, serif', fontSize: '10px', color: 'rgba(255,255,255,0.45)', background: 'transparent', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '12px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={saveDesign} disabled={saving} style={{ flex: 2, fontFamily: 'Georgia, serif', fontSize: '10px', letterSpacing: '0.14em', color: '#0f1f0f', background: '#d4af6e', border: 'none', borderRadius: '8px', padding: '12px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>

            {/* Right: live preview */}
            {editDesign && (
              <div style={{ background: editCustomColor ? editDesign.bg : editDesign.bg, borderLeft: '0.5px solid rgba(212,175,110,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', transition: 'background 0.5s ease', position: 'relative', overflow: 'hidden' }}>
                {/* Pattern based on design */}
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.07, pointerEvents: 'none' }}>
                  <defs>
                    <pattern id="prev-pat" width="60" height="60" patternUnits="userSpaceOnUse">
                      <g fill="none" stroke={editCustomColor || editDesign.accent} strokeWidth="0.8">
                        <rect x="15" y="15" width="30" height="30" rx="2"/>
                        <rect x="15" y="15" width="30" height="30" rx="2" transform="rotate(45 30 30)"/>
                      </g>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#prev-pat)"/>
                </svg>

                <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: '260px', background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(12px)', border: `0.5px solid ${(editCustomColor || editDesign.accent)}30`, borderRadius: '16px', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 14px 12px', textAlign: 'center', borderBottom: `0.5px solid ${(editCustomColor || editDesign.accent)}15` }}>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: '8px', letterSpacing: '0.22em', color: editCustomColor || editDesign.accent, marginBottom: '8px', opacity: 0.8 }}>بَابُ الصَّدَقَة</div>
                    <p style={{ fontFamily: editFont === 'cinzel' ? 'Georgia, serif' : 'Georgia, serif', fontSize: '11px', fontStyle: 'italic', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, marginBottom: '8px' }}>
                      {editGreeting || `Welcome to the blessed ${editingCampaign.event_type}`}
                    </p>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: 400, color: editDesign.textColor, lineHeight: 1.2 }}>
                      {editNames || editingCampaign.honoree_names}
                    </div>
                  </div>
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: '8px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.3)', marginBottom: '7px' }}>Choose a charity</div>
                    {['🌍 Share The Meal', '☪️ Islamic Relief'].map((ch, i) => (
                      <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 9px', background: i === 0 ? `${(editCustomColor || editDesign.accent)}15` : 'rgba(255,255,255,0.03)', border: `0.5px solid ${i === 0 ? (editCustomColor || editDesign.accent) + '50' : 'rgba(255,255,255,0.06)'}`, borderRadius: '7px', marginBottom: '5px', transition: 'all 0.4s' }}>
                        <span style={{ fontSize: '13px' }}>{ch.split(' ')[0]}</span>
                        <span style={{ fontFamily: 'Georgia, serif', fontSize: '9px', color: i === 0 ? '#fff' : 'rgba(255,255,255,0.4)', letterSpacing: '0.04em' }}>{ch.split(' ').slice(1).join(' ')}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: '4px', marginTop: '9px', marginBottom: '9px' }}>
                      {[5, 10, 20, 50].map((a, i) => (
                        <div key={a} style={{ flex: 1, textAlign: 'center', padding: '6px 3px', background: i === 1 ? (editCustomColor || editDesign.accent) : 'rgba(255,255,255,0.04)', borderRadius: '100px', fontFamily: 'Georgia, serif', fontSize: '10px', color: i === 1 ? '#0f1f0f' : 'rgba(255,255,255,0.5)', border: `0.5px solid ${i === 1 ? (editCustomColor || editDesign.accent) : 'rgba(255,255,255,0.08)'}`, transition: 'all 0.4s' }}>${a}</div>
                      ))}
                    </div>
                    <div style={{ background: editCustomColor || editDesign.accent, borderRadius: '7px', padding: '9px', textAlign: 'center', fontFamily: 'Georgia, serif', fontSize: '10px', letterSpacing: '0.1em', color: '#0f1f0f', transition: 'background 0.5s' }}>
                      Give $10.00 →
                    </div>
                  </div>
                  <div style={{ padding: '8px 14px', borderTop: `0.5px solid ${(editCustomColor || editDesign.accent)}15`, display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: editCustomColor || editDesign.accent, transition: 'background 0.5s' }}/>
                    <span style={{ fontFamily: 'Georgia, serif', fontSize: '8px', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>{editDesign.name}</span>
                  </div>
                </div>

                <div style={{ position: 'relative', zIndex: 2, marginTop: '12px', fontFamily: 'Georgia, serif', fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', textAlign: 'center' }}>
                  Live preview — updates as you edit
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
