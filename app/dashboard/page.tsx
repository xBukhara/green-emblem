'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createClient } from '@/lib/supabase/client'

const THEMES = [
  { id:'forest_gold', label:'Forest & Gold', bg:'#0f1f0f', accent:'#d4af6e' },
  { id:'navy_gold',   label:'Navy & Gold',   bg:'#0a1628', accent:'#d4af6e' },
  { id:'burgundy',    label:'Burgundy',      bg:'#1a0508', accent:'#c9956c' },
  { id:'purple',      label:'Violet',        bg:'#120a1e', accent:'#9b8ec4' },
  { id:'terracotta',  label:'Terracotta',    bg:'#1a0f08', accent:'#8fad8a' },
  { id:'charcoal',    label:'Charcoal',      bg:'#111111', accent:'#c4906a' },
]

const VERSES = [
  { id:'tirmidhi_shade', label:'Shade of generosity' },
  { id:'quran_2_272',    label:'Quran 2:272' },
  { id:'tirmidhi_fire',  label:'Shield from fire' },
  { id:'custom',         label:'Custom verse' },
]

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [donations, setDonations] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'impact'|'campaigns'|'profile'>('impact')
  const [editingCampaign, setEditingCampaign] = useState<any>(null)
  const [savingCampaign, setSavingCampaign] = useState(false)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/sign-in'); return }
      setUser(user)

      // Load everything in parallel
      const [profileRes, donationsRes, requestsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('donations')
          .select('*, campaigns(slug, honoree_names, event_type, event_date)')
          .eq('user_id', user.id).eq('confirmed', true)
          .order('created_at', { ascending: false }),
        supabase.from('campaign_requests')
          .select('*').eq('email', user.email)
          .order('submitted_at', { ascending: false }),
      ])

      setProfile(profileRes.data)
      setDonations(donationsRes.data || [])
      const reqs = requestsRes.data || []
      setRequests(reqs)

      // Load campaigns using request IDs (bypasses RLS issues)
      if (reqs.length > 0) {
        const reqIds = reqs.map((r: any) => r.id)
        const { data: camps } = await supabase
          .from('campaigns').select('*')
          .in('request_id', reqIds)
          .order('created_at', { ascending: false })
        setCampaigns(camps || [])
      }

      setLoading(false)
    })
  }, [])

  const totalDonated = donations.reduce((s, d) => s + (d.amount || 0), 0)
  const totalMeals   = donations.reduce((s, d) => s + (d.meals_funded || 0), 0)

  const updateCampaignStyle = async () => {
    if (!editingCampaign) return
    setSavingCampaign(true)
    await supabase.from('campaigns').update({
      theme: {
        ...editingCampaign.theme,
        color_scheme: editingCampaign._editTheme,
        verse: editingCampaign._editVerse,
        greeting_text: editingCampaign._editGreeting,
      },
      honoree_names: editingCampaign._editNames || editingCampaign.honoree_names,
    }).eq('id', editingCampaign.id)

    // Refresh campaigns
    const reqIds = requests.map((r: any) => r.id)
    const { data: camps } = await supabase.from('campaigns').select('*').in('request_id', reqIds).order('created_at', { ascending: false })
    setCampaigns(camps || [])
    setEditingCampaign(null)
    setSavingCampaign(false)
  }

  const charityColor = (id: string) => ({ share_the_meal:'#E8A020', islamic_relief:'#1D9E75', unicef:'#378ADD' }[id] || '#d4af6e')
  const charityLabel = (id: string) => ({ share_the_meal:'Share The Meal', islamic_relief:'Islamic Relief USA', unicef:'UNICEF USA' }[id] || id)

  const statusColor = (s: string) => ({
    active: '#1D9E75', pending: '#d4a017', ended: 'rgba(255,255,255,0.3)'
  }[s] || 'rgba(255,255,255,0.3)')

  const firstName = profile?.full_name?.split(' ')[0] || user?.user_metadata?.given_name || 'there'

  if (loading) return (
    <>
      <Nav />
      <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#080f08' }}>
        <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'16px', color:'rgba(255,255,255,0.4)', fontStyle:'italic' }}>Loading…</div>
      </div>
    </>
  )

  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ paddingTop:'88px', minHeight:'100dvh', position:'relative', zIndex:2 }}>
        <div style={{ maxWidth:'860px', margin:'0 auto', padding:'40px 24px 80px' }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'32px', flexWrap:'wrap' }}>
            {user?.user_metadata?.avatar_url && (
              <img src={user.user_metadata.avatar_url} alt="" style={{ width:'52px', height:'52px', borderRadius:'50%', border:'2px solid rgba(212,175,110,0.3)' }}/>
            )}
            <div>
              <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.28em', color:'var(--gold)', marginBottom:'6px' }}>Your dashboard</div>
              <h1 style={{ fontFamily:'var(--font-cinzel)', fontSize:'clamp(22px,4vw,34px)', fontWeight:500, color:'#fff' }}>
                Assalamu Alaikum, {firstName}
              </h1>
            </div>
            {profile?.role === 'admin' && (
              <a href="/admin" style={{ marginLeft:'auto', fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.12em', color:'var(--gold)', border:'0.5px solid rgba(212,175,110,0.3)', padding:'8px 14px', borderRadius:'7px', textDecoration:'none' }}>
                Admin console →
              </a>
            )}
          </div>

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'10px', marginBottom:'28px' }}>
            {[
              { label:'Total given', value:`$${totalDonated.toFixed(2)}`, color:'var(--gold)' },
              { label:'Meals funded', value:totalMeals.toLocaleString(), color:'#E8A020' },
              { label:'Campaigns', value:campaigns.length + requests.filter(r => !campaigns.find((c:any) => c.request_id === r.id)).length, color:'#1D9E75' },
              { label:'Donations', value:donations.length, color:'var(--gold)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background:'rgba(15,31,15,0.55)', border:'0.5px solid rgba(212,175,110,0.12)', borderRadius:'12px', padding:'16px' }}>
                <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.18em', color:'rgba(255,255,255,0.3)', marginBottom:'6px' }}>{label}</div>
                <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'28px', fontWeight:300, color, lineHeight:1 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:'4px', marginBottom:'20px', background:'rgba(255,255,255,0.03)', borderRadius:'10px', padding:'4px', width:'fit-content' }}>
            {([['impact','Giving history'],['campaigns','My campaigns'],['profile','Profile']] as [typeof tab, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.12em', padding:'8px 16px', borderRadius:'7px', border:'none', cursor:'pointer', background: tab===id ? 'rgba(212,175,110,0.1)' : 'transparent', color: tab===id ? '#d4af6e' : 'rgba(255,255,255,0.4)', transition:'all 0.15s' }}>
                {label}
              </button>
            ))}
          </div>

          {/* ── GIVING HISTORY ── */}
          {tab === 'impact' && (
            donations.length === 0 ? (
              <div style={{ background:'rgba(15,31,15,0.4)', border:'0.5px solid rgba(212,175,110,0.1)', borderRadius:'14px', padding:'48px', textAlign:'center' }}>
                <div style={{ fontFamily:'var(--font-arabic)', fontSize:'28px', color:'var(--gold)', opacity:0.3, direction:'rtl', marginBottom:'14px' }} lang="ar">بَابُ الصَّدَقَة</div>
                <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'13px', color:'rgba(255,255,255,0.4)', marginBottom:'8px' }}>No donations yet</div>
                <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'15px', color:'rgba(255,255,255,0.3)', fontStyle:'italic', lineHeight:1.7, maxWidth:'300px', margin:'0 auto 20px' }}>
                  Scan a Baab As-Sadaqah QR code at an event to get started.
                </p>
                <a href="/sadaqah" style={{ fontFamily:'var(--font-cinzel)', fontSize:'10px', letterSpacing:'0.14em', color:'var(--forest-dark)', background:'var(--gold)', padding:'10px 20px', borderRadius:'8px', textDecoration:'none', display:'inline-block' }}>
                  Learn about Baab As-Sadaqah
                </a>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {donations.map(d => (
                  <div key={d.id} style={{ background:'rgba(15,31,15,0.55)', border:'0.5px solid rgba(212,175,110,0.1)', borderRadius:'12px', padding:'14px 18px', display:'flex', alignItems:'center', gap:'14px', flexWrap:'wrap' }}>
                    <div style={{ width:'3px', height:'40px', borderRadius:'2px', background:charityColor(d.charity), flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:'140px' }}>
                      <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'15px', color:'#fff', marginBottom:'2px' }}>{d.campaigns?.honoree_names || 'Campaign'}</div>
                      <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.1em', color:'rgba(255,255,255,0.3)' }}>{charityLabel(d.charity)}</div>
                    </div>
                    {d.meals_funded > 0 && <div style={{ textAlign:'center' }}><div style={{ fontFamily:'var(--font-cinzel)', fontSize:'14px', color:'#E8A020' }}>{d.meals_funded}</div><div style={{ fontFamily:'var(--font-cinzel)', fontSize:'7px', letterSpacing:'0.1em', color:'rgba(255,255,255,0.3)' }}>meals</div></div>}
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'20px', color:'var(--gold)' }}>${d.amount?.toFixed(2)}</div>
                      <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'11px', color:'rgba(255,255,255,0.25)' }}>{new Date(d.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</div>
                    </div>
                    {d.campaigns?.slug && <a href={`/give/${d.campaigns.slug}`} style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', color:'rgba(255,255,255,0.25)', textDecoration:'none', border:'0.5px solid rgba(255,255,255,0.1)', padding:'5px 9px', borderRadius:'6px' }}>View</a>}
                  </div>
                ))}
                <div style={{ background:'rgba(26,61,26,0.12)', border:'0.5px solid rgba(212,175,110,0.08)', borderRadius:'12px', padding:'16px', textAlign:'center', marginTop:'4px' }}>
                  <div style={{ fontFamily:'var(--font-arabic)', fontSize:'18px', color:'var(--gold)', opacity:0.5, direction:'rtl', marginBottom:'4px' }} lang="ar">تَقَبَّلَ اللَّهُ مِنَّا وَمِنكُمْ</div>
                  <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'rgba(255,255,255,0.25)', fontStyle:'italic' }}>May Allah accept from us and from you.</div>
                </div>
              </div>
            )
          )}

          {/* ── MY CAMPAIGNS ── */}
          {tab === 'campaigns' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>

              {/* Active/ended campaigns */}
              {campaigns.map((c: any) => {
                const theme = THEMES.find(t => t.id === c.theme?.color_scheme) || THEMES[0]
                return (
                  <div key={c.id} style={{ background:'rgba(15,31,15,0.55)', border:'0.5px solid rgba(212,175,110,0.12)', borderRadius:'14px', overflow:'hidden' }}>
                    {/* Theme colour bar */}
                    <div style={{ height:'4px', background:`linear-gradient(90deg, ${theme.bg}, ${theme.accent})` }}/>
                    <div style={{ padding:'18px 22px' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px', flexWrap:'wrap', marginBottom:'12px' }}>
                        <div>
                          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
                            <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'15px', color:'#fff' }}>{c.honoree_names}</div>
                            <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.1em', padding:'3px 9px', borderRadius:'20px', background:`${statusColor(c.status)}18`, color:statusColor(c.status), border:`0.5px solid ${statusColor(c.status)}40` }}>{c.status}</span>
                          </div>
                          <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.12em', color:'rgba(255,255,255,0.3)' }}>
                            {c.event_type}{c.event_date ? ` · ${c.event_date}` : ''}{c.expires_at ? ` · Expires ${new Date(c.expires_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })}` : ''}
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                          {c.status === 'active' && <>
                            <a href={`/give/${c.slug}`} target="_blank" style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.1em', color:'var(--gold)', border:'0.5px solid rgba(212,175,110,0.35)', padding:'7px 12px', borderRadius:'7px', textDecoration:'none' }}>View live</a>
                            <a href={`/api/campaigns/${c.slug}/qr`} download style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.1em', color:'var(--forest-dark)', background:'var(--gold)', padding:'7px 12px', borderRadius:'7px', textDecoration:'none' }}>Download QR</a>
                            <button onClick={() => setEditingCampaign({ ...c, _editTheme: c.theme?.color_scheme || 'forest_gold', _editVerse: c.theme?.verse || 'tirmidhi_shade', _editGreeting: c.theme?.greeting_text || '', _editNames: c.honoree_names })}
                              style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.1em', color:'rgba(255,255,255,0.5)', background:'rgba(255,255,255,0.05)', border:'0.5px solid rgba(255,255,255,0.1)', padding:'7px 12px', borderRadius:'7px', cursor:'pointer' }}>
                              Edit style
                            </button>
                          </>}
                          {c.status === 'pending' && <span style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'rgba(255,255,255,0.3)', fontStyle:'italic', paddingTop:'6px' }}>Pending activation</span>}
                        </div>
                      </div>
                      {/* Live stats */}
                      {c.status === 'active' && (c.total_raised > 0 || c.donor_count > 0) && (
                        <div style={{ display:'flex', gap:'20px', paddingTop:'12px', borderTop:'0.5px solid rgba(212,175,110,0.08)' }}>
                          {[{ label:'Raised', value:`$${(c.total_raised||0).toFixed(2)}` },{ label:'Donors', value:c.donor_count||0 },{ label:'Meals', value:c.meals_funded||0 }].map(({ label, value }) => (
                            <div key={label}><div style={{ fontFamily:'var(--font-cinzel)', fontSize:'16px', color:'var(--gold)' }}>{value}</div><div style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.1em', color:'rgba(255,255,255,0.3)' }}>{label}</div></div>
                          ))}
                        </div>
                      )}
                      {c.status === 'pending' && (
                        <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'rgba(255,255,255,0.3)', fontStyle:'italic', paddingTop:'10px', borderTop:'0.5px solid rgba(212,175,110,0.08)' }}>
                          Your campaign is under review. You'll receive an email once it's activated, in sha Allah.
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Pending requests not yet built */}
              {requests.filter(r => !campaigns.find((c:any) => c.request_id === r.id)).map((r: any) => (
                <div key={r.id} style={{ background:'rgba(15,31,15,0.3)', border:'0.5px solid rgba(212,175,110,0.08)', borderRadius:'14px', padding:'18px 22px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px' }}>
                    <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'14px', color:'rgba(255,255,255,0.7)' }}>{r.honoree_names}</div>
                    <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.1em', padding:'3px 9px', borderRadius:'20px', background:'rgba(186,117,23,0.1)', color:'#d4a017', border:'0.5px solid rgba(186,117,23,0.25)' }}>
                      {r.status === 'pending' ? 'Under review' : r.status === 'approved' ? 'Build link sent — check email' : r.status}
                    </span>
                  </div>
                  <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.12em', color:'rgba(255,255,255,0.25)' }}>{r.event_type}{r.event_date ? ` · ${r.event_date}` : ''}</div>
                  {r.status === 'approved' && <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'rgba(255,255,255,0.3)', fontStyle:'italic', marginTop:'8px' }}>Check your inbox for the campaign builder link. It expires in 7 days.</div>}
                </div>
              ))}

              {campaigns.length === 0 && requests.length === 0 && (
                <div style={{ background:'rgba(15,31,15,0.4)', border:'0.5px solid rgba(212,175,110,0.1)', borderRadius:'14px', padding:'48px', textAlign:'center' }}>
                  <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'13px', color:'rgba(255,255,255,0.4)', marginBottom:'8px' }}>No campaigns yet</div>
                  <a href="/sadaqah/request" style={{ fontFamily:'var(--font-cinzel)', fontSize:'10px', letterSpacing:'0.14em', color:'var(--forest-dark)', background:'var(--gold)', padding:'10px 20px', borderRadius:'8px', textDecoration:'none', display:'inline-block', marginTop:'8px' }}>
                    Request a campaign
                  </a>
                </div>
              )}

              <a href="/sadaqah/request" style={{ fontFamily:'var(--font-cinzel)', fontSize:'10px', letterSpacing:'0.14em', color:'var(--gold)', border:'0.5px solid rgba(212,175,110,0.25)', padding:'12px', borderRadius:'10px', textDecoration:'none', textAlign:'center', display:'block' }}>
                + Request another campaign
              </a>
            </div>
          )}

          {/* ── PROFILE ── */}
          {tab === 'profile' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              <div style={{ background:'rgba(15,31,15,0.55)', border:'0.5px solid rgba(212,175,110,0.12)', borderRadius:'14px', padding:'24px' }}>
                <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.2em', color:'var(--gold)', marginBottom:'16px' }}>Account details</div>
                <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'20px' }}>
                  {user?.user_metadata?.avatar_url && <img src={user.user_metadata.avatar_url} alt="" style={{ width:'64px', height:'64px', borderRadius:'50%', border:'2px solid rgba(212,175,110,0.3)' }}/>}
                  <div>
                    <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'16px', color:'#fff', marginBottom:'4px' }}>{profile?.full_name || user?.user_metadata?.full_name || 'Anonymous'}</div>
                    <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'14px', color:'rgba(255,255,255,0.45)', fontStyle:'italic' }}>{user?.email}</div>
                    {profile?.role === 'admin' && <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.1em', padding:'3px 9px', borderRadius:'10px', background:'rgba(212,175,110,0.1)', color:'var(--gold)', border:'0.5px solid rgba(212,175,110,0.3)', display:'inline-block', marginTop:'6px' }}>Admin</span>}
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  {[
                    { label:'Member since', value: user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month:'long', year:'numeric' }) : '—' },
                    { label:'Sign-in method', value:'Google OAuth' },
                    { label:'Total sadaqah', value:`$${totalDonated.toFixed(2)}` },
                    { label:'Meals funded', value:totalMeals.toLocaleString() },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background:'rgba(255,255,255,0.03)', borderRadius:'8px', padding:'12px' }}>
                      <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.16em', color:'rgba(255,255,255,0.3)', marginBottom:'5px' }}>{label}</div>
                      <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'15px', color:'#fff' }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background:'rgba(15,31,15,0.55)', border:'0.5px solid rgba(212,175,110,0.12)', borderRadius:'14px', padding:'24px' }}>
                <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.2em', color:'var(--gold)', marginBottom:'16px' }}>Quick links</div>
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                  {[
                    { href:'/sadaqah/request', label:'Request a campaign' },
                    { href:'/favours', label:'Order party favours' },
                    { href:'/events', label:'Find a decorator' },
                    { href:'/campaigns/premium-qr', label:'Premium QR designs' },
                  ].map(({ href, label }) => (
                    <a key={href} href={href} style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.12em', color:'var(--gold)', border:'0.5px solid rgba(212,175,110,0.25)', padding:'9px 14px', borderRadius:'8px', textDecoration:'none' }}>{label}</a>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
      <Footer />

      {/* Edit campaign style modal */}
      {editingCampaign && (
        <div onClick={e => { if (e.target === e.currentTarget) setEditingCampaign(null) }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
          <div style={{ background:'#111b11', border:'0.5px solid rgba(212,175,110,0.25)', borderRadius:'16px', width:'100%', maxWidth:'500px', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ padding:'18px 22px', borderBottom:'0.5px solid rgba(212,175,110,0.1)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'13px', color:'#fff' }}>Edit campaign</div>
                <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'rgba(255,255,255,0.35)', fontStyle:'italic' }}>{editingCampaign.honoree_names}</div>
              </div>
              <button onClick={() => setEditingCampaign(null)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', fontSize:'20px', cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:'18px' }}>

              {/* Edit names */}
              <div>
                <label style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.16em', color:'rgba(255,255,255,0.35)', display:'block', marginBottom:'7px' }}>Honourees names</label>
                <input type="text" value={editingCampaign._editNames} onChange={e => setEditingCampaign((c: any) => ({ ...c, _editNames: e.target.value }))} className="ge-input"/>
              </div>

              {/* Theme */}
              <div>
                <label style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.16em', color:'rgba(255,255,255,0.35)', display:'block', marginBottom:'10px' }}>Colour theme</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px' }}>
                  {THEMES.map(t => (
                    <button key={t.id} onClick={() => setEditingCampaign((c: any) => ({ ...c, _editTheme: t.id }))} style={{ background: editingCampaign._editTheme === t.id ? 'rgba(212,175,110,0.1)' : 'rgba(255,255,255,0.03)', border:`0.5px solid ${editingCampaign._editTheme === t.id ? 'rgba(212,175,110,0.5)' : 'rgba(255,255,255,0.08)'}`, borderRadius:'8px', padding:'10px 8px', cursor:'pointer', textAlign:'left' }}>
                      <div style={{ display:'flex', gap:'4px', marginBottom:'5px' }}>
                        <div style={{ width:'12px', height:'12px', borderRadius:'50%', background:t.bg, border:'0.5px solid rgba(255,255,255,0.15)' }}/>
                        <div style={{ width:'12px', height:'12px', borderRadius:'50%', background:t.accent }}/>
                      </div>
                      <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', color: editingCampaign._editTheme === t.id ? 'var(--gold)' : 'rgba(255,255,255,0.5)' }}>{t.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Verse */}
              <div>
                <label style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.16em', color:'rgba(255,255,255,0.35)', display:'block', marginBottom:'10px' }}>Verse</label>
                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                  {VERSES.map(v => (
                    <button key={v.id} onClick={() => setEditingCampaign((c: any) => ({ ...c, _editVerse: v.id }))} style={{ background: editingCampaign._editVerse === v.id ? 'rgba(46,107,46,0.12)' : 'rgba(255,255,255,0.03)', border:`0.5px solid ${editingCampaign._editVerse === v.id ? 'rgba(212,175,110,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius:'8px', padding:'10px 12px', cursor:'pointer', textAlign:'left', fontFamily:'var(--font-cinzel)', fontSize:'10px', color: editingCampaign._editVerse === v.id ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Greeting */}
              <div>
                <label style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.16em', color:'rgba(255,255,255,0.35)', display:'block', marginBottom:'7px' }}>Greeting message</label>
                <textarea value={editingCampaign._editGreeting} onChange={e => setEditingCampaign((c: any) => ({ ...c, _editGreeting: e.target.value }))} className="ge-input" rows={2} style={{ resize:'vertical' as const }}/>
              </div>

              <div style={{ display:'flex', gap:'10px', paddingTop:'4px' }}>
                <button onClick={() => setEditingCampaign(null)} style={{ flex:1, fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.12em', color:'rgba(255,255,255,0.4)', background:'transparent', border:'0.5px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'12px', cursor:'pointer' }}>Cancel</button>
                <button onClick={updateCampaignStyle} disabled={savingCampaign} style={{ flex:2, fontFamily:'var(--font-cinzel)', fontSize:'10px', letterSpacing:'0.14em', color:'var(--forest-dark)', background:'var(--gold)', border:'none', borderRadius:'8px', padding:'12px', cursor: savingCampaign ? 'not-allowed' : 'pointer', opacity: savingCampaign ? 0.6 : 1 }}>
                  {savingCampaign ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
