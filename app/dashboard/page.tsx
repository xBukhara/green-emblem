'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createClient } from '@/lib/supabase/client'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [donations, setDonations] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'impact'|'campaigns'>('impact')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/sign-in'); return }
      setUser(user)

      const [profileRes, donationsRes, requestsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('donations')
          .select('*, campaigns(slug, honoree_names, event_type, event_date)')
          .eq('user_id', user.id)
          .eq('confirmed', true)
          .order('created_at', { ascending: false }),
        supabase.from('campaign_requests')
          .select('*')
          .eq('email', user.email)
          .order('submitted_at', { ascending: false }),
      ])

      // Load campaigns matching by organiser_id OR request email
      // First get all request IDs for this user's email
      const { data: userRequests } = await supabase
        .from('campaign_requests')
        .select('id')
        .eq('email', user.email)

      const requestIds = (userRequests || []).map((r: any) => r.id)

      let userCampaigns: any[] = []
      if (requestIds.length > 0) {
        const { data: campaignsByRequest } = await supabase
          .from('campaigns')
          .select('*')
          .in('request_id', requestIds)
          .order('created_at', { ascending: false })
        userCampaigns = campaignsByRequest || []
      }

      // Also check by organiser_id
      const { data: campaignsByOrganiser } = await supabase
        .from('campaigns')
        .select('*')
        .eq('organiser_id', user.id)
        .order('created_at', { ascending: false })

      // Merge and deduplicate
      const allUserCampaigns = [...userCampaigns]
      for (const c of (campaignsByOrganiser || [])) {
        if (!allUserCampaigns.find((x: any) => x.id === c.id)) {
          allUserCampaigns.push(c)
        }
      }

      setProfile(profileRes.data)
      setDonations(donationsRes.data || [])
      setCampaigns(allUserCampaigns)
      setRequests(requestsRes.data || [])
      setLoading(false)
    })
  }, [])

  const totalDonated    = donations.reduce((s, d) => s + (d.amount || 0), 0)
  const totalMeals      = donations.reduce((s, d) => s + (d.meals_funded || 0), 0)
  const uniqueCampaigns = new Set(donations.map(d => d.campaign_id)).size

  // Auto-refresh campaign stats every 5 minutes
  useEffect(() => {
    if (!user) return
    const interval = setInterval(async () => {
      const { data: userRequests } = await supabase
        .from('campaign_requests').select('id').eq('email', user.email)
      const requestIds = (userRequests || []).map((r: any) => r.id)
      let refreshed: any[] = []
      if (requestIds.length > 0) {
        const { data } = await supabase.from('campaigns').select('*').in('request_id', requestIds).order('created_at', { ascending: false })
        refreshed = data || []
      }
      const { data: byOrganiser } = await supabase.from('campaigns').select('*').eq('organiser_id', user.id)
      for (const c of (byOrganiser || [])) {
        if (!refreshed.find((x: any) => x.id === c.id)) refreshed.push(c)
      }
      setCampaigns(refreshed)
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [user])

  const charityLabel = (id: string) => ({ share_the_meal:'Share The Meal', islamic_relief:'Islamic Relief USA', unicef:'UNICEF USA' }[id] || id)
  const charityColor = (id: string) => ({ share_the_meal:'#E8A020', islamic_relief:'#1D9E75', unicef:'#378ADD' }[id] || '#d4af6e')

  const statusColor = (s: string) => ({ active:'#1D9E75', pending:'#d4a017', ended:'rgba(255,255,255,0.3)', approved:'#1D9E75' }[s] || 'rgba(255,255,255,0.3)')

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
        <div style={{ maxWidth:'900px', margin:'0 auto', padding:'40px 24px 80px' }}>

          {/* Header */}
          <div style={{ marginBottom:'36px' }}>
            <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.28em', color:'var(--gold)', marginBottom:'10px' }}>Your dashboard</div>
            <h1 style={{ fontFamily:'var(--font-cinzel)', fontSize:'clamp(26px,5vw,40px)', fontWeight:500, color:'#fff', marginBottom:'8px' }}>
              Assalamu Alaikum, {firstName}
            </h1>
            <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'17px', fontStyle:'italic', color:'rgba(255,255,255,0.45)', lineHeight:1.7 }}>
              Every act of sadaqah is recorded. Here is yours.
            </p>
          </div>

          {/* Impact stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'12px', marginBottom:'32px' }}>
            {[
              { label:'Total given', value:`$${totalDonated.toFixed(2)}`, sub:'Confirmed sadaqah', color:'var(--gold)' },
              { label:'Meals funded', value:totalMeals.toLocaleString(), sub:'Via Share The Meal', color:'#E8A020' },
              { label:'Events honoured', value:uniqueCampaigns, sub:'Campaigns supported', color:'#1D9E75' },
              { label:'Donations', value:donations.length, sub:'Individual gifts', color:'var(--gold)' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} style={{ background:'rgba(15,31,15,0.55)', border:'0.5px solid rgba(212,175,110,0.12)', borderRadius:'14px', padding:'18px' }}>
                <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.18em', color:'rgba(255,255,255,0.3)', marginBottom:'8px' }}>{label}</div>
                <div style={{ fontSize:'clamp(24px,4vw,34px)', fontWeight:300, color, lineHeight:1, marginBottom:'4px', fontFamily:'var(--font-cormorant)' }}>{value}</div>
                <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.3)', fontStyle:'italic', fontFamily:'var(--font-cormorant)' }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:'4px', marginBottom:'24px', background:'rgba(255,255,255,0.03)', borderRadius:'10px', padding:'4px', width:'fit-content' }}>
            {([['impact','Donation history'],['campaigns','My campaigns']] as [typeof tab, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.14em', padding:'8px 18px', borderRadius:'7px', border:'none', cursor:'pointer', background: tab === id ? 'rgba(212,175,110,0.12)' : 'transparent', color: tab === id ? '#d4af6e' : 'rgba(255,255,255,0.4)', transition:'all 0.15s' }}>
                {label}
                {id === 'campaigns' && (campaigns.length + requests.length) > 0 && (
                  <span style={{ marginLeft:'6px', background:'rgba(212,175,110,0.2)', color:'var(--gold)', fontFamily:'var(--font-cinzel)', fontSize:'8px', padding:'1px 6px', borderRadius:'10px' }}>
                    {campaigns.length + requests.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* DONATION HISTORY TAB */}
          {tab === 'impact' && (
            donations.length === 0 ? (
              <div style={{ background:'rgba(15,31,15,0.4)', border:'0.5px solid rgba(212,175,110,0.1)', borderRadius:'14px', padding:'48px', textAlign:'center' }}>
                <div style={{ fontFamily:'var(--font-arabic)', fontSize:'28px', color:'var(--gold)', opacity:0.3, direction:'rtl', marginBottom:'14px' }} lang="ar">بَابُ الصَّدَقَة</div>
                <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'13px', color:'rgba(255,255,255,0.4)', marginBottom:'8px' }}>No donations yet</div>
                <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'15px', color:'rgba(255,255,255,0.3)', fontStyle:'italic', lineHeight:1.7, maxWidth:'300px', margin:'0 auto 20px' }}>
                  Scan a Baab As-Sadaqah QR code at an event, or give through a campaign link.
                </p>
                <a href="/sadaqah" style={{ fontFamily:'var(--font-cinzel)', fontSize:'10px', letterSpacing:'0.14em', color:'var(--forest-dark)', background:'var(--gold)', padding:'10px 20px', borderRadius:'8px', textDecoration:'none', display:'inline-block' }}>
                  Learn about Baab As-Sadaqah
                </a>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {donations.map(d => (
                  <div key={d.id} style={{ background:'rgba(15,31,15,0.55)', border:'0.5px solid rgba(212,175,110,0.1)', borderRadius:'12px', padding:'16px 20px', display:'flex', alignItems:'center', gap:'16px', flexWrap:'wrap' }}>
                    <div style={{ width:'3px', height:'44px', borderRadius:'2px', background:charityColor(d.charity), flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:'160px' }}>
                      <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'16px', color:'#fff', marginBottom:'3px' }}>
                        {d.campaigns?.honoree_names || 'Campaign'}
                      </div>
                      <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.1em', color:'rgba(255,255,255,0.3)' }}>
                        {d.campaigns?.event_type && d.campaigns.event_type !== 'Other' ? d.campaigns.event_type + ' · ' : ''}
                        {charityLabel(d.charity)}
                      </div>
                    </div>
                    {d.meals_funded > 0 && (
                      <div style={{ textAlign:'center', minWidth:'80px' }}>
                        <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'14px', color:'#E8A020' }}>{d.meals_funded}</div>
                        <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.1em', color:'rgba(255,255,255,0.3)' }}>meals</div>
                      </div>
                    )}
                    <div style={{ textAlign:'right', minWidth:'80px' }}>
                      <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'20px', color:'var(--gold)', lineHeight:1 }}>${d.amount?.toFixed(2)}</div>
                      <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'11px', color:'rgba(255,255,255,0.25)', marginTop:'3px' }}>
                        {new Date(d.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                      </div>
                    </div>
                    {d.campaigns?.slug && (
                      <a href={`/give/${d.campaigns.slug}`} style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.1em', color:'rgba(255,255,255,0.25)', textDecoration:'none', border:'0.5px solid rgba(255,255,255,0.1)', padding:'6px 10px', borderRadius:'6px', flexShrink:0 }}>
                        View
                      </a>
                    )}
                  </div>
                ))}
                <div style={{ background:'rgba(26,61,26,0.12)', border:'0.5px solid rgba(212,175,110,0.08)', borderRadius:'12px', padding:'20px', textAlign:'center', marginTop:'8px' }}>
                  <div style={{ fontFamily:'var(--font-arabic)', fontSize:'20px', color:'var(--gold)', opacity:0.5, direction:'rtl', marginBottom:'6px' }} lang="ar">تَقَبَّلَ اللَّهُ مِنَّا وَمِنكُمْ</div>
                  <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'rgba(255,255,255,0.25)', fontStyle:'italic' }}>May Allah accept from us and from you.</div>
                </div>
              </div>
            )
          )}

          {/* MY CAMPAIGNS TAB */}
          {tab === 'campaigns' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {/* Active/ended campaigns */}
              {campaigns.map(c => (
                <div key={c.id} style={{ background:'rgba(15,31,15,0.55)', border:'0.5px solid rgba(212,175,110,0.12)', borderRadius:'14px', padding:'20px 24px' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
                        <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'14px', color:'#fff' }}>{c.honoree_names}</div>
                        <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.1em', padding:'3px 10px', borderRadius:'20px', background:`${statusColor(c.status)}18`, color:statusColor(c.status), border:`0.5px solid ${statusColor(c.status)}40` }}>{c.status}</span>
                      </div>
                      <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.12em', color:'rgba(255,255,255,0.3)' }}>
                        {c.event_type}{c.event_date ? ` · ${c.event_date}` : ''}
                        {c.expires_at ? ` · Expires ${new Date(c.expires_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })}` : ''}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
                      {c.status === 'active' && (
                        <>
                          <a href={`/give/${c.slug}`} target="_blank" style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.12em', color:'var(--gold)', border:'0.5px solid rgba(212,175,110,0.35)', padding:'7px 14px', borderRadius:'7px', textDecoration:'none' }}>
                            View live
                          </a>
                          <a href={`/api/campaigns/${c.slug}/qr`} download style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.12em', color:'var(--forest-dark)', background:'var(--gold)', padding:'7px 14px', borderRadius:'7px', textDecoration:'none' }}>
                            Download QR
                          </a>
                        </>
                      )}
                      {c.status === 'pending' && (
                        <span style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'rgba(255,255,255,0.3)', fontStyle:'italic' }}>Pending activation</span>
                      )}
                    </div>
                  </div>
                  {c.status === 'active' && (c.total_raised > 0 || c.donor_count > 0) && (
                    <div style={{ display:'flex', gap:'20px', marginTop:'14px', paddingTop:'14px', borderTop:'0.5px solid rgba(212,175,110,0.08)' }}>
                      {[
                        { label:'Raised', value:`$${(c.total_raised||0).toFixed(2)}` },
                        { label:'Donors', value:c.donor_count||0 },
                        { label:'Meals', value:c.meals_funded||0 },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'14px', color:'var(--gold)' }}>{value}</div>
                          <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.1em', color:'rgba(255,255,255,0.3)' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Pending requests (not yet built into campaigns) */}
              {requests.filter(r => !campaigns.find(c => c.request_id === r.id)).map(r => (
                <div key={r.id} style={{ background:'rgba(15,31,15,0.3)', border:'0.5px solid rgba(212,175,110,0.08)', borderRadius:'14px', padding:'20px 24px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
                    <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'14px', color:'rgba(255,255,255,0.7)' }}>{r.honoree_names}</div>
                    <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.1em', padding:'3px 10px', borderRadius:'20px', background:'rgba(186,117,23,0.1)', color:'#d4a017', border:'0.5px solid rgba(186,117,23,0.25)' }}>
                      {r.status === 'pending' ? 'Under review' : r.status === 'approved' ? 'Build link sent' : r.status}
                    </span>
                  </div>
                  <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.12em', color:'rgba(255,255,255,0.25)' }}>
                    {r.event_type}{r.event_date ? ` · ${r.event_date}` : ''} · Request submitted
                  </div>
                  {r.status === 'pending' && (
                    <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'rgba(255,255,255,0.3)', fontStyle:'italic', marginTop:'8px' }}>
                      We'll review within 48 hours and email you a link to build your campaign, in sha Allah.
                    </div>
                  )}
                  {r.status === 'approved' && (
                    <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'rgba(255,255,255,0.3)', fontStyle:'italic', marginTop:'8px' }}>
                      Check your email for the campaign builder link. It expires in 7 days.
                    </div>
                  )}
                </div>
              ))}

              {campaigns.length === 0 && requests.length === 0 && (
                <div style={{ background:'rgba(15,31,15,0.4)', border:'0.5px solid rgba(212,175,110,0.1)', borderRadius:'14px', padding:'48px', textAlign:'center' }}>
                  <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'13px', color:'rgba(255,255,255,0.4)', marginBottom:'8px' }}>No campaigns yet</div>
                  <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'15px', color:'rgba(255,255,255,0.3)', fontStyle:'italic', lineHeight:1.7, maxWidth:'300px', margin:'0 auto 20px' }}>
                    Request a Baab As-Sadaqah campaign for your event and we'll build you a giving page with a QR code.
                  </p>
                  <a href="/sadaqah/request" style={{ fontFamily:'var(--font-cinzel)', fontSize:'10px', letterSpacing:'0.14em', color:'var(--forest-dark)', background:'var(--gold)', padding:'10px 20px', borderRadius:'8px', textDecoration:'none', display:'inline-block' }}>
                    Request a campaign
                  </a>
                </div>
              )}

              <a href="/sadaqah/request" style={{ fontFamily:'var(--font-cinzel)', fontSize:'10px', letterSpacing:'0.14em', color:'var(--gold)', border:'0.5px solid rgba(212,175,110,0.3)', padding:'12px', borderRadius:'10px', textDecoration:'none', textAlign:'center', display:'block', marginTop:'4px' }}>
                + Request another campaign
              </a>
            </div>
          )}

          {profile?.role === 'admin' && (
            <div style={{ marginTop:'28px', textAlign:'center' }}>
              <a href="/admin" style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.14em', color:'rgba(255,255,255,0.2)', textDecoration:'none' }}>→ Go to admin console</a>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
