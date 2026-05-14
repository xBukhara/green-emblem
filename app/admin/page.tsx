'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const PANELS = ['overview','campaigns','requests','orders','users','affiliates','newsletter'] as const
type Panel = typeof PANELS[number]

export default function AdminPage() {
  const supabase = createClient()
  const router = useRouter()
  const [panel, setPanel] = useState<Panel>('overview')
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  // Data
  const [stats, setStats] = useState({ campaigns:0, activeCampaigns:0, donations:0, totalRaised:0, mealsFunded:0, orders:0, orderRevenue:0, affiliates:0, connections:0, subscribers:0, users:0 })
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [affiliates, setAffiliates] = useState<any[]>([])
  const [subscribers, setSubscribers] = useState<any[]>([])

  // Newsletter composer
  const [newsletterSubject, setNewsletterSubject] = useState('')
  const [newsletterBody, setNewsletterBody] = useState('')
  const [sendingNewsletter, setSendingNewsletter] = useState(false)
  const [newsletterSent, setNewsletterSent] = useState(false)

  // Product modal
  const [productModal, setProductModal] = useState(false)
  const [editProduct, setEditProduct] = useState<any>(null)
  const [pForm, setPForm] = useState({ name:'', category:'favours', price:'', description:'', visibility:'draft' })

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/sign-in'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin') { router.push('/dashboard'); return }
      setAuthorized(true)
      await loadAll()
      setLoading(false)
    })
  }, [])

  const loadAll = async () => {
    const [campaignsRes, requestsRes, ordersRes, usersRes, affiliatesRes, subscribersRes, donationsRes] = await Promise.all([
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('campaign_requests').select('*').order('submitted_at', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('affiliates').select('*').order('created_at', { ascending: false }),
      supabase.from('newsletter_subscribers').select('*').eq('is_active', true).order('subscribed_at', { ascending: false }),
      supabase.from('donations').select('amount,meals_funded,confirmed').eq('confirmed', true),
    ])

    const camps = campaignsRes.data || []
    const ords = ordersRes.data || []
    const donations = donationsRes.data || []
    const subs = subscribersRes.data || []

    setCampaigns(camps)
    setRequests(requestsRes.data || [])
    setOrders(ords)
    setUsers(usersRes.data || [])
    setAffiliates(affiliatesRes.data || [])
    setSubscribers(subs)

    setStats({
      campaigns: camps.length,
      activeCampaigns: camps.filter(c => c.status === 'active').length,
      donations: donations.length,
      totalRaised: donations.reduce((s,d) => s + (d.amount||0), 0),
      mealsFunded: donations.reduce((s,d) => s + (d.meals_funded||0), 0),
      orders: ords.length,
      orderRevenue: ords.reduce((s,o) => s + (o.total||0), 0),
      affiliates: (affiliatesRes.data||[]).length,
      connections: 0,
      subscribers: subs.length,
      users: (usersRes.data||[]).length,
    })
  }

  const updateCampaignStatus = async (id: string, status: string) => {
    await supabase.from('campaigns').update({ status }).eq('id', id)
    setCampaigns(cs => cs.map(c => c.id === id ? { ...c, status } : c))
    setStats(s => ({ ...s, activeCampaigns: status === 'active' ? s.activeCampaigns + 1 : s.activeCampaigns - 1 }))
  }

  const sendMagicLink = async (requestId: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/admin/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ request_id: requestId }),
    })
    await supabase.from('campaign_requests').update({ status: 'approved' }).eq('id', requestId)
    setRequests(rs => rs.map(r => r.id === requestId ? { ...r, status: 'approved' } : r))
  }

  const sendNewsletter = async () => {
    if (!newsletterSubject || !newsletterBody) return
    setSendingNewsletter(true)
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/admin/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ subject: newsletterSubject, body: newsletterBody }),
    })
    setNewsletterSent(true)
    setSendingNewsletter(false)
    setTimeout(() => { setNewsletterSent(false); setNewsletterSubject(''); setNewsletterBody('') }, 3000)
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const c = {
    page: { minHeight:'100dvh', background:'#080f08', display:'grid', gridTemplateColumns:'220px 1fr' } as React.CSSProperties,
    sidebar: { background:'rgba(15,31,15,0.95)', borderRight:'0.5px solid rgba(212,175,110,0.12)', padding:'0', display:'flex', flexDirection:'column' as const, position:'sticky' as const, top:0, height:'100dvh', overflowY:'auto' as const },
    main: { padding:'32px', overflowY:'auto' as const },
    navItem: (active:boolean) => ({ display:'flex', alignItems:'center', gap:'10px', padding:'10px 18px', cursor:'pointer', background:active?'rgba(212,175,110,0.08)':'transparent', borderLeft:`2px solid ${active?'#d4af6e':'transparent'}`, transition:'all 0.15s', border:'none', width:'100%', textAlign:'left' as const } as React.CSSProperties),
    navLabel: (active:boolean) => ({ fontFamily:'Georgia,serif', fontSize:'11px', letterSpacing:'0.12em', color:active?'#d4af6e':'rgba(255,255,255,0.45)' }),
    card: { background:'rgba(15,31,15,0.6)', border:'0.5px solid rgba(212,175,110,0.12)', borderRadius:'12px', padding:'18px' } as React.CSSProperties,
    statCard: { background:'rgba(15,31,15,0.6)', border:'0.5px solid rgba(212,175,110,0.12)', borderRadius:'12px', padding:'16px' } as React.CSSProperties,
    th: { fontFamily:'Georgia,serif', fontSize:'9px', letterSpacing:'0.14em', color:'rgba(255,255,255,0.35)', padding:'10px 14px', textAlign:'left' as const, borderBottom:'0.5px solid rgba(212,175,110,0.08)', fontWeight:400 },
    td: { padding:'11px 14px', borderBottom:'0.5px solid rgba(212,175,110,0.05)', fontFamily:'Georgia,serif', fontSize:'13px', color:'rgba(255,255,255,0.75)', verticalAlign:'middle' as const },
    h2: { fontFamily:'Georgia,serif', fontSize:'10px', letterSpacing:'0.24em', color:'#d4af6e', marginBottom:'16px', display:'flex', alignItems:'center', gap:'10px' } as React.CSSProperties,
    inp: { width:'100%', background:'rgba(255,255,255,0.05)', border:'0.5px solid rgba(212,175,110,0.2)', borderRadius:'8px', padding:'10px 13px', fontFamily:'Georgia,serif', fontSize:'14px', color:'#fff', outline:'none' } as React.CSSProperties,
    badge: (color:string) => ({ fontFamily:'Georgia,serif', fontSize:'9px', padding:'2px 9px', borderRadius:'20px', background:`${color}18`, color, border:`0.5px solid ${color}40` }),
    btn: (color:string='gold') => ({ fontFamily:'Georgia,serif', fontSize:'9px', letterSpacing:'0.1em', padding:'6px 13px', borderRadius:'7px', cursor:'pointer', border:'none', background:color==='gold'?'#d4af6e':color==='red'?'rgba(226,75,74,0.15)':'rgba(29,158,117,0.15)', color:color==='gold'?'#0f1f0f':color==='red'?'#e24b4a':'#1D9E75', transition:'all 0.15s' } as React.CSSProperties),
  }

  const sectionTitle = (t:string) => (
    <h2 style={c.h2}>{t}<span style={{flex:1,height:'0.5px',background:'rgba(212,175,110,0.12)',display:'block'}}/></h2>
  )

  if (!authorized && !loading) return <div style={{minHeight:'100dvh',background:'#080f08',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:'rgba(255,255,255,0.4)',fontFamily:'Georgia,serif'}}>Access denied.</div></div>
  if (loading) return <div style={{minHeight:'100dvh',background:'#080f08',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:'rgba(255,255,255,0.4)',fontFamily:'Georgia,serif',fontStyle:'italic'}}>Loading admin…</div></div>

  const navItems: {id:Panel;label:string;icon:string}[] = [
    {id:'overview',label:'Overview',icon:'◈'},
    {id:'campaigns',label:'Campaigns',icon:'◉'},
    {id:'requests',label:'Sadaqah Requests',icon:'◎'},
    {id:'orders',label:'Orders',icon:'◐'},
    {id:'users',label:'Users',icon:'◑'},
    {id:'affiliates',label:'Affiliates',icon:'◒'},
    {id:'newsletter',label:'Newsletter',icon:'◓'},
  ]

  return (
    <div style={c.page}>
      {/* Sidebar */}
      <aside style={c.sidebar}>
        <div style={{padding:'20px 18px 16px',borderBottom:'0.5px solid rgba(212,175,110,0.1)'}}>
          <div style={{fontFamily:'Georgia,serif',fontSize:'10px',letterSpacing:'0.22em',color:'#d4af6e',marginBottom:'3px'}}>GREEN EMBLEM</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:'11px',color:'rgba(255,255,255,0.3)',letterSpacing:'0.08em'}}>Admin Console</div>
        </div>
        <nav style={{flex:1,paddingTop:'8px'}}>
          {navItems.map(item => (
            <button key={item.id} style={c.navItem(panel===item.id)} onClick={() => setPanel(item.id)}>
              <span style={{fontSize:'14px',color:panel===item.id?'#d4af6e':'rgba(255,255,255,0.3)'}}>{item.icon}</span>
              <span style={c.navLabel(panel===item.id)}>{item.label}</span>
            </button>
          ))}
        </nav>
        <div style={{padding:'14px 18px',borderTop:'0.5px solid rgba(212,175,110,0.08)'}}>
          <a href="/" style={{fontFamily:'Georgia,serif',fontSize:'10px',letterSpacing:'0.1em',color:'rgba(255,255,255,0.25)',textDecoration:'none'}}>← Back to site</a>
        </div>
      </aside>

      {/* Main content */}
      <main style={c.main}>

        {/* ── OVERVIEW ── */}
        {panel === 'overview' && (
          <div style={{display:'flex',flexDirection:'column',gap:'20px'}}>
            {sectionTitle('Overview')}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:'12px'}}>
              {[
                {label:'Active campaigns',value:stats.activeCampaigns,color:'#1D9E75'},
                {label:'Total raised',value:`$${stats.totalRaised.toFixed(2)}`,color:'#d4af6e'},
                {label:'Meals funded',value:stats.mealsFunded.toLocaleString(),color:'#E8A020'},
                {label:'Orders',value:stats.orders,color:'#d4af6e'},
                {label:'Order revenue',value:`$${stats.orderRevenue.toFixed(2)}`,color:'#1D9E75'},
                {label:'Affiliates',value:stats.affiliates,color:'#9b8ec4'},
                {label:'Newsletter',value:`${stats.subscribers} subs`,color:'#378ADD'},
                {label:'Total users',value:stats.users,color:'rgba(255,255,255,0.6)'},
              ].map(({label,value,color}) => (
                <div key={label} style={c.statCard}>
                  <div style={{fontFamily:'Georgia,serif',fontSize:'8px',letterSpacing:'0.18em',color:'rgba(255,255,255,0.3)',marginBottom:'6px'}}>{label}</div>
                  <div style={{fontFamily:'Georgia,serif',fontSize:'clamp(20px,3vw,28px)',color,fontWeight:300,lineHeight:1}}>{value}</div>
                </div>
              ))}
            </div>

            {/* Recent campaigns */}
            <div style={c.card}>
              {sectionTitle('Recent campaigns')}
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Campaign','Event','Status','Raised','Donors'].map(h => <th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {campaigns.slice(0,5).map(campaign => (
                    <tr key={campaign.id}>
                      <td style={c.td}>{campaign.honoree_names}</td>
                      <td style={{...c.td,color:'rgba(255,255,255,0.4)',fontSize:'12px'}}>{campaign.event_type}</td>
                      <td style={c.td}><span style={c.badge(campaign.status==='active'?'#1D9E75':campaign.status==='ended'?'rgba(255,255,255,0.3)':'#d4a017')}>{campaign.status}</span></td>
                      <td style={{...c.td,color:'#d4af6e'}}>${(campaign.total_raised||0).toFixed(2)}</td>
                      <td style={c.td}>{campaign.donor_count||0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Recent orders */}
            <div style={c.card}>
              {sectionTitle('Recent orders')}
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Order #','Type','Total','Status'].map(h => <th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {orders.slice(0,5).map(order => (
                    <tr key={order.id}>
                      <td style={{...c.td,fontSize:'11px',color:'rgba(255,255,255,0.35)',letterSpacing:'0.06em'}}>{order.order_number}</td>
                      <td style={c.td}>{order.order_type}</td>
                      <td style={{...c.td,color:'#d4af6e'}}>${order.total?.toFixed(2)}</td>
                      <td style={c.td}><span style={c.badge(order.status==='delivered'?'#1D9E75':'#d4a017')}>{order.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CAMPAIGNS ── */}
        {panel === 'campaigns' && (
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            {sectionTitle(`Campaigns (${campaigns.length})`)}
            <div style={c.card}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Campaign','Event','Date','Status','Raised','Donors','Meals','Actions'].map(h => <th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {campaigns.map(camp => (
                    <tr key={camp.id}>
                      <td style={c.td}><a href={`/give/${camp.slug}`} target="_blank" style={{color:'#d4af6e',textDecoration:'none'}}>{camp.honoree_names}</a></td>
                      <td style={{...c.td,fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>{camp.event_type}</td>
                      <td style={{...c.td,fontSize:'11px',color:'rgba(255,255,255,0.3)'}}>{camp.event_date||'—'}</td>
                      <td style={c.td}><span style={c.badge(camp.status==='active'?'#1D9E75':camp.status==='ended'?'rgba(255,255,255,0.4)':'#d4a017')}>{camp.status}</span></td>
                      <td style={{...c.td,color:'#d4af6e'}}>${(camp.total_raised||0).toFixed(2)}</td>
                      <td style={c.td}>{camp.donor_count||0}</td>
                      <td style={c.td}>{camp.meals_funded||0}</td>
                      <td style={{...c.td,display:'flex',gap:'6px',flexWrap:'wrap'}}>
                        {camp.status !== 'active' && <button style={c.btn('green')} onClick={() => updateCampaignStatus(camp.id,'active')}>Activate</button>}
                        {camp.status === 'active' && <button style={c.btn('red')} onClick={() => updateCampaignStatus(camp.id,'ended')}>End</button>}
                        <a href={`/api/campaigns/${camp.slug}/qr`} download style={{...c.btn(), textDecoration:'none', display:'inline-block'}}>QR</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── SADAQAH REQUESTS ── */}
        {panel === 'requests' && (
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            {sectionTitle(`Sadaqah requests (${requests.length})`)}
            <div style={c.card}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Name','Email','Event','Date','Status','Actions'].map(h => <th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {requests.map(req => (
                    <tr key={req.id}>
                      <td style={c.td}>{req.first_name} {req.last_name}</td>
                      <td style={{...c.td,fontSize:'12px',color:'rgba(255,255,255,0.5)'}}>{req.email}</td>
                      <td style={{...c.td,fontSize:'12px'}}>{req.event_type}</td>
                      <td style={{...c.td,fontSize:'11px',color:'rgba(255,255,255,0.35)'}}>{req.event_date||'—'}</td>
                      <td style={c.td}><span style={c.badge(req.status==='approved'?'#1D9E75':'#d4a017')}>{req.status}</span></td>
                      <td style={c.td}>
                        {req.status !== 'approved' && (
                          <button style={c.btn('gold')} onClick={() => sendMagicLink(req.id)}>
                            Send builder link
                          </button>
                        )}
                        {req.status === 'approved' && <span style={{fontFamily:'Georgia,serif',fontSize:'11px',color:'rgba(255,255,255,0.25)',fontStyle:'italic'}}>Link sent</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ORDERS ── */}
        {panel === 'orders' && (
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            {sectionTitle(`Orders (${orders.length})`)}
            <div style={c.card}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Order #','Customer','Type','Total','Status','Date'].map(h => <th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id}>
                      <td style={{...c.td,fontSize:'11px',color:'rgba(255,255,255,0.35)',letterSpacing:'0.06em'}}>{order.order_number}</td>
                      <td style={c.td}>{order.customer_name || order.customer_email}</td>
                      <td style={{...c.td,fontSize:'12px'}}>{order.order_type}</td>
                      <td style={{...c.td,color:'#d4af6e'}}>${order.total?.toFixed(2)}</td>
                      <td style={c.td}>
                        <select value={order.status} onChange={async e => {
                          await supabase.from('orders').update({status:e.target.value}).eq('id',order.id)
                          setOrders(os => os.map(o => o.id===order.id?{...o,status:e.target.value}:o))
                        }} style={{background:'rgba(255,255,255,0.05)',border:'0.5px solid rgba(212,175,110,0.2)',borderRadius:'6px',padding:'4px 8px',fontFamily:'Georgia,serif',fontSize:'11px',color:'#fff',cursor:'pointer'}}>
                          {['pending','processing','shipped','delivered','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{...c.td,fontSize:'11px',color:'rgba(255,255,255,0.3)'}}>{new Date(order.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── USERS ── */}
        {panel === 'users' && (
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            {sectionTitle(`Users (${users.length})`)}
            <div style={c.card}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Name','Email','Mosque','Newsletter','Onboarded','Role'].map(h => <th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td style={c.td}>{user.first_name||''} {user.last_name||''} <span style={{fontSize:'11px',color:'rgba(255,255,255,0.3)'}}>{user.full_name&&!user.first_name?`(${user.full_name})`:''}</span></td>
                      <td style={{...c.td,fontSize:'12px',color:'rgba(255,255,255,0.5)'}}>{user.email}</td>
                      <td style={{...c.td,fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>{user.local_mosque||'—'}</td>
                      <td style={c.td}><span style={c.badge(user.newsletter_opted_in?'#1D9E75':'rgba(255,255,255,0.25)')}>{user.newsletter_opted_in?'Yes':'No'}</span></td>
                      <td style={c.td}><span style={c.badge(user.onboarding_complete?'#1D9E75':'#d4a017')}>{user.onboarding_complete?'Yes':'Pending'}</span></td>
                      <td style={c.td}><span style={c.badge(user.role==='admin'?'#d4af6e':'rgba(255,255,255,0.25)')}>{user.role||'user'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── AFFILIATES ── */}
        {panel === 'affiliates' && (
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            {sectionTitle(`Affiliates (${affiliates.length})`)}
            <div style={c.card}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Name','Business','City','Status','Actions'].map(h => <th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {affiliates.length === 0 && (
                    <tr><td colSpan={5} style={{...c.td,textAlign:'center',color:'rgba(255,255,255,0.3)',fontStyle:'italic',padding:'32px'}}>No affiliates yet</td></tr>
                  )}
                  {affiliates.map(aff => (
                    <tr key={aff.id}>
                      <td style={c.td}>{aff.display_name}</td>
                      <td style={{...c.td,fontSize:'12px',color:'rgba(255,255,255,0.5)'}}>{aff.business_name}</td>
                      <td style={{...c.td,fontSize:'12px'}}>{aff.city}, {aff.state}</td>
                      <td style={c.td}><span style={c.badge(aff.status==='approved'?'#1D9E75':'#d4a017')}>{aff.status}</span></td>
                      <td style={c.td}>
                        {aff.status !== 'approved' && <button style={c.btn('green')} onClick={async () => { await supabase.from('affiliates').update({status:'approved'}).eq('id',aff.id); setAffiliates(as => as.map(a => a.id===aff.id?{...a,status:'approved'}:a)) }}>Approve</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── NEWSLETTER ── */}
        {panel === 'newsletter' && (
          <div style={{display:'flex',flexDirection:'column',gap:'20px'}}>
            {sectionTitle(`Newsletter (${subscribers.length} subscribers)`)}

            {/* Compose */}
            <div style={c.card}>
              <div style={{fontFamily:'Georgia,serif',fontSize:'11px',letterSpacing:'0.18em',color:'rgba(255,255,255,0.5)',marginBottom:'16px'}}>COMPOSE NEWSLETTER</div>
              <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                <div>
                  <label style={{fontFamily:'Georgia,serif',fontSize:'9px',letterSpacing:'0.16em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'7px'}}>SUBJECT LINE</label>
                  <input type="text" value={newsletterSubject} onChange={e => setNewsletterSubject(e.target.value)} placeholder="e.g. Ramadan Mubarak from Green Emblem" style={c.inp}/>
                </div>
                <div>
                  <label style={{fontFamily:'Georgia,serif',fontSize:'9px',letterSpacing:'0.16em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'7px'}}>BODY (plain text or HTML)</label>
                  <textarea value={newsletterBody} onChange={e => setNewsletterBody(e.target.value)} placeholder="Write your newsletter here…" rows={10} style={{...c.inp,resize:'vertical' as const,lineHeight:1.6}}/>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'14px'}}>
                  <button onClick={sendNewsletter} disabled={sendingNewsletter||!newsletterSubject||!newsletterBody} style={{fontFamily:'Georgia,serif',fontSize:'10px',letterSpacing:'0.14em',color:'#0f1f0f',background:newsletterSubject&&newsletterBody?'#d4af6e':'rgba(255,255,255,0.15)',border:'none',borderRadius:'8px',padding:'12px 24px',cursor:newsletterSubject&&newsletterBody?'pointer':'not-allowed',opacity:sendingNewsletter?0.6:1}}>
                    {sendingNewsletter?'Sending…':newsletterSent?'Sent!`':`Send to ${subscribers.length} subscribers`}
                  </button>
                  <span style={{fontFamily:'Georgia,serif',fontSize:'12px',color:'rgba(255,255,255,0.3)',fontStyle:'italic'}}>Via Resend · green-emblem.com</span>
                </div>
              </div>
            </div>

            {/* Subscriber list */}
            <div style={c.card}>
              <div style={{fontFamily:'Georgia,serif',fontSize:'11px',letterSpacing:'0.18em',color:'rgba(255,255,255,0.5)',marginBottom:'16px'}}>SUBSCRIBER LIST</div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Name','Email','Source','Subscribed'].map(h => <th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {subscribers.map(sub => (
                    <tr key={sub.id}>
                      <td style={c.td}>{sub.first_name||''} {sub.last_name||''}</td>
                      <td style={{...c.td,fontSize:'12px',color:'rgba(255,255,255,0.5)'}}>{sub.email}</td>
                      <td style={{...c.td,fontSize:'11px',color:'rgba(255,255,255,0.3)'}}>{sub.source}</td>
                      <td style={{...c.td,fontSize:'11px',color:'rgba(255,255,255,0.3)'}}>{new Date(sub.subscribed_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
