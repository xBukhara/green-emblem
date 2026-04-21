'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Panel = 'dashboard' | 'products' | 'orders' | 'affiliates' | 'campaigns' | 'sadaqah'

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const [panel, setPanel] = useState<Panel>('dashboard')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ revenue: 0, donations: 0, meals: 0, orders: 0, pending_affiliates: 0, active_campaigns: 0, connections: 0 })
  const [products, setProducts] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [affiliates, setAffiliates] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [catFilter, setCatFilter] = useState('all')
  const [productModal, setProductModal] = useState(false)
  const [editProduct, setEditProduct] = useState<any>(null)
  const [form, setForm] = useState({ name:'', category:'favours', price:'', description:'', stock_status:'in_stock', visibility:'draft', is_favour_item: false })
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState<string|null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/sign-in'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin') { router.push('/'); return }
      setLoading(false)
      loadAll()
    })
  }, [])

  const loadAll = async () => {
    const [
      ordersRes, productsRes, affiliatesRes, campaignsRes, requestsRes,
      donationsRes, connectionsRes
    ] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('*').order('sort_order'),
      supabase.from('affiliate_applications').select('*').order('submitted_at', { ascending: false }),
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('campaign_requests').select('*').order('submitted_at', { ascending: false }),
      supabase.from('donations').select('amount, meals_funded').eq('confirmed', true),
      supabase.from('affiliate_connections').select('amount_paid'),
    ])

    const ordersData = ordersRes.data || []
    const donationsData = donationsRes.data || []
    const connectionsData = connectionsRes.data || []
    const affiliatesData = affiliatesRes.data || []
    const campaignsData = campaignsRes.data || []

    setOrders(ordersData)
    setProducts(productsRes.data || [])
    setAffiliates(affiliatesData)
    setCampaigns(campaignsData)
    setRequests(requestsRes.data || [])
    setStats({
      revenue: ordersData.reduce((s: number, o: any) => s + (o.total || 0), 0),
      donations: donationsData.reduce((s: number, d: any) => s + (d.amount || 0), 0),
      meals: donationsData.reduce((s: number, d: any) => s + (d.meals_funded || 0), 0),
      orders: ordersData.length,
      pending_affiliates: affiliatesData.filter((a: any) => a.status === 'pending').length,
      active_campaigns: campaignsData.filter((c: any) => c.status === 'active').length,
      connections: connectionsData.length,
    })
  }

  const saveProduct = async () => {
    setSaving(true)
    const data = { ...form, price: parseFloat(form.price) }
    if (editProduct) {
      await supabase.from('products').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editProduct.id)
    } else {
      await supabase.from('products').insert(data)
    }
    await loadAll()
    setProductModal(false)
    setEditProduct(null)
    setForm({ name:'', category:'favours', price:'', description:'', stock_status:'in_stock', visibility:'draft', is_favour_item: false })
    setSaving(false)
  }

  const deleteProduct = async (id: string) => {
    if (!confirm('Remove this product?')) return
    await supabase.from('products').delete().eq('id', id)
    setProducts(p => p.filter((x: any) => x.id !== id))
  }

  const approveAffiliate = async (id: string) => {
    const app = affiliates.find((a: any) => a.id === id)
    if (!app) return
    await supabase.from('affiliate_applications').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', id)
    await supabase.from('affiliates').insert({
      application_id: id,
      display_name: `${app.first_name} ${app.last_name}`,
      bio: app.bio, city: app.city, state: app.state,
      service_radius: app.service_radius,
      affiliate_type: app.affiliate_type,
      event_types: app.event_types,
      portfolio_urls: app.portfolio_urls,
      instagram_url: app.instagram_url,
      is_active: true,
    })
    setAffiliates((a: any[]) => a.map((x: any) => x.id === id ? { ...x, status: 'approved' } : x))
  }

  const updateCampaignStatus = async (id: string, status: string) => {
    await supabase.from('campaigns').update({ status }).eq('id', id)
    setCampaigns((c: any[]) => c.map((x: any) => x.id === id ? { ...x, status } : x))
  }

  const updateOrderStatus = async (id: string, status: string) => {
    await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setOrders((o: any[]) => o.map((x: any) => x.id === id ? { ...x, status } : x))
  }

  const sendMagicLink = async (id: string) => {
    setSending(id)
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/admin/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ request_id: id }),
    })
    setRequests((r: any[]) => r.map((x: any) => x.id === id ? { ...x, status: 'approved' } : x))
    setSending(null)
  }

  const openEdit = (p: any) => {
    setEditProduct(p)
    setForm({ name: p.name, category: p.category, price: p.price.toString(), description: p.description || '', stock_status: p.stock_status, visibility: p.visibility, is_favour_item: p.is_favour_item })
    setProductModal(true)
  }

  const filteredProducts = catFilter === 'all' ? products : products.filter((p: any) => p.category === catFilter)

  // ── Styles ──────────────────────────────────────────────────────────────────
  const c = {
    wrap:    { display:'flex', height:'100vh', overflow:'hidden', background:'#080f08', color:'#fff', fontFamily:'var(--font-cormorant)' } as React.CSSProperties,
    sidebar: { width:'196px', flexShrink:0, borderRight:'0.5px solid rgba(212,175,110,0.12)', display:'flex', flexDirection:'column' as const, background:'#060d06' },
    main:    { flex:1, overflow:'auto', display:'flex', flexDirection:'column' as const },
    topbar:  { padding:'0 24px', height:'52px', borderBottom:'0.5px solid rgba(212,175,110,0.1)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, background:'#080f08' },
    content: { padding:'24px', flex:1 },
    card:    { background:'rgba(15,31,15,0.5)', border:'0.5px solid rgba(212,175,110,0.12)', borderRadius:'12px', overflow:'hidden' },
    th:      { fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.14em', color:'rgba(255,255,255,0.3)', padding:'10px 14px', textAlign:'left' as const, borderBottom:'0.5px solid rgba(212,175,110,0.08)', fontWeight:400 },
    td:      { padding:'11px 14px', borderBottom:'0.5px solid rgba(212,175,110,0.05)', fontSize:'13px', color:'rgba(255,255,255,0.75)', verticalAlign:'middle' as const },
    input:   { width:'100%', background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(212,175,110,0.18)', borderRadius:'7px', padding:'10px 12px', fontFamily:'var(--font-cormorant)', fontSize:'15px', color:'#fff', outline:'none', appearance:'none' as const } as React.CSSProperties,
    label:   { fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.16em', color:'rgba(255,255,255,0.35)', display:'block', marginBottom:'6px' } as React.CSSProperties,
  }

  const pill = (status: string) => {
    const map: Record<string,string[]> = {
      pending:    ['rgba(186,117,23,0.12)','#d4a017'],
      processing: ['rgba(186,117,23,0.12)','#d4a017'],
      approved:   ['rgba(29,158,117,0.12)','#1D9E75'],
      active:     ['rgba(29,158,117,0.12)','#1D9E75'],
      shipped:    ['rgba(29,158,117,0.12)','#1D9E75'],
      delivered:  ['rgba(29,158,117,0.12)','#1D9E75'],
      published:  ['rgba(29,158,117,0.12)','#1D9E75'],
      featured:   ['rgba(212,175,110,0.12)','#d4af6e'],
      declined:   ['rgba(226,75,74,0.1)','#e24b4a'],
      cancelled:  ['rgba(226,75,74,0.1)','#e24b4a'],
      ended:      ['rgba(255,255,255,0.06)','rgba(255,255,255,0.4)'],
      draft:      ['rgba(255,255,255,0.06)','rgba(255,255,255,0.4)'],
    }
    const [bg, fg] = map[status] || ['rgba(255,255,255,0.06)','rgba(255,255,255,0.4)']
    return <span style={{ display:'inline-block', fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.08em', padding:'3px 9px', borderRadius:'20px', background:bg, color:fg }}>{status}</span>
  }

  const btn = (variant: 'gold'|'outline'|'danger'|'ghost', onClick?: () => void, label?: string, disabled?: boolean) => (
    <button onClick={onClick} disabled={disabled} style={{
      fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.12em', border:'none',
      borderRadius:'6px', padding:'6px 12px', cursor: disabled ? 'not-allowed' : 'pointer', transition:'all 0.15s', opacity: disabled ? 0.6 : 1,
      ...(variant==='gold' ?    { background:'#d4af6e', color:'#0f1f0f' } :
          variant==='danger' ?  { background:'rgba(226,75,74,0.1)', color:'#e24b4a', border:'0.5px solid rgba(226,75,74,0.2)' } :
          variant==='ghost' ?   { background:'transparent', color:'rgba(255,255,255,0.4)', border:'0.5px solid rgba(255,255,255,0.1)' } :
                                { background:'transparent', color:'#d4af6e', border:'0.5px solid rgba(212,175,110,0.3)' })
    }}>{label}</button>
  )

  const navItem = (id: Panel, label: string, badge?: number) => (
    <div key={id} onClick={() => setPanel(id)} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 10px', borderRadius:'7px', cursor:'pointer', margin:'1px 6px', background: panel===id ? 'rgba(212,175,110,0.08)' : 'transparent', fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.1em', color: panel===id ? '#d4af6e' : 'rgba(255,255,255,0.45)', transition:'all 0.15s' }}>
      {label}
      {badge ? <span style={{ marginLeft:'auto', background:'#e24b4a', color:'#fff', fontFamily:'var(--font-cinzel)', fontSize:'8px', padding:'1px 6px', borderRadius:'10px' }}>{badge}</span> : null}
    </div>
  )

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#080f08' }}>
      <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'16px', color:'rgba(255,255,255,0.4)', fontStyle:'italic' }}>Loading…</div>
    </div>
  )

  return (
    <div style={c.wrap}>
      {/* Sidebar */}
      <aside style={c.sidebar}>
        <div style={{ padding:'18px 16px', borderBottom:'0.5px solid rgba(212,175,110,0.1)', display:'flex', alignItems:'center', gap:'8px' }}>
          <svg width="22" height="22" viewBox="25 35 170 155"><rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke="#c8a050" strokeWidth="3" transform="rotate(0 110 110)"/><rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke="#c8a050" strokeWidth="3" transform="rotate(45 110 110)"/><polygon points="110,42 158,42 190,74 190,146 158,178 62,178 30,146 30,74 62,42" fill="#2e6b2e" stroke="#c8a050" strokeWidth="2.5"/><circle cx="103" cy="104" r="44" fill="#d4af6e"/><circle cx="117" cy="96" r="37" fill="#2e6b2e"/><g transform="translate(158,82)"><polygon points="0,-16 3.8,-6.2 14.8,-5 6.8,3 9.4,14 0,8.2 -9.4,14 -6.8,3 -14.8,-5 -3.8,-6.2" fill="#d4af6e"/></g></svg>
          <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'11px', letterSpacing:'0.18em', color:'#d4af6e' }}>Admin</span>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'8px 0' }}>
          <div style={{ padding:'10px 14px 4px', fontFamily:'var(--font-cinzel)', fontSize:'7px', letterSpacing:'0.22em', color:'rgba(255,255,255,0.25)' }}>Overview</div>
          {navItem('dashboard','Dashboard')}
          {navItem('orders','Orders')}
          <div style={{ padding:'10px 14px 4px', fontFamily:'var(--font-cinzel)', fontSize:'7px', letterSpacing:'0.22em', color:'rgba(255,255,255,0.25)' }}>Products</div>
          {navItem('products','All Products')}
          <div style={{ padding:'10px 14px 4px', fontFamily:'var(--font-cinzel)', fontSize:'7px', letterSpacing:'0.22em', color:'rgba(255,255,255,0.25)' }}>Community</div>
          {navItem('affiliates','Affiliates', stats.pending_affiliates || undefined)}
          {navItem('campaigns','Campaigns')}
          {navItem('sadaqah','Sadaqah Requests')}
        </div>
        <div style={{ padding:'12px 14px', borderTop:'0.5px solid rgba(212,175,110,0.1)' }}>
          <a href="/" style={{ fontFamily:'var(--font-cinzel)', fontSize:'8.5px', letterSpacing:'0.12em', color:'rgba(255,255,255,0.3)', textDecoration:'none' }}>← View site</a>
        </div>
      </aside>

      {/* Main */}
      <main style={c.main}>
        <div style={c.topbar}>
          <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'13px', color:'#fff', fontWeight:500 }}>
            {panel.charAt(0).toUpperCase() + panel.slice(1)}
          </div>
          {panel === 'products' && btn('gold', () => { setEditProduct(null); setForm({ name:'', category:'favours', price:'', description:'', stock_status:'in_stock', visibility:'draft', is_favour_item: false }); setProductModal(true) }, '+ Add product')}
        </div>

        <div style={c.content}>

          {/* DASHBOARD */}
          {panel === 'dashboard' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'12px', marginBottom:'24px' }}>
                {[
                  { label:'Total revenue', value:`$${stats.revenue.toFixed(2)}`, sub:'From orders' },
                  { label:'Donations routed', value:`$${stats.donations.toFixed(2)}`, sub:`${stats.meals} meals funded` },
                  { label:'Active campaigns', value:stats.active_campaigns, sub:'Baab As-Sadaqah' },
                  { label:'Pending affiliates', value:stats.pending_affiliates, sub:'Awaiting review' },
                  { label:'Total orders', value:stats.orders, sub:'All time' },
                  { label:'Connections', value:stats.connections, sub:`$${(stats.connections * 19).toFixed(0)} earned` },
                ].map(({ label, value, sub }) => (
                  <div key={label} style={{ ...c.card, padding:'16px' }}>
                    <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.18em', color:'rgba(255,255,255,0.3)', marginBottom:'8px' }}>{label}</div>
                    <div style={{ fontSize:'28px', fontWeight:300, color:'#fff', lineHeight:1, marginBottom:'4px' }}>{value}</div>
                    <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.3)', fontStyle:'italic' }}>{sub}</div>
                  </div>
                ))}
              </div>
              <div style={c.card}>
                <div style={{ padding:'12px 16px', borderBottom:'0.5px solid rgba(212,175,110,0.08)', fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.18em', color:'rgba(255,255,255,0.3)' }}>Recent orders</div>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr>{['Order','Customer','Type','Total','Status'].map(h=><th key={h} style={c.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {orders.slice(0,8).map((o:any) => (
                      <tr key={o.id}>
                        <td style={c.td}><span style={{ fontFamily:'var(--font-cinzel)', fontSize:'10px', color:'rgba(255,255,255,0.4)' }}>{o.order_number}</span></td>
                        <td style={{ ...c.td, fontSize:'12px' }}>{o.customer_email}</td>
                        <td style={c.td}>{o.order_type}</td>
                        <td style={{ ...c.td, color:'#d4af6e' }}>${o.total?.toFixed(2)}</td>
                        <td style={c.td}>{pill(o.status)}</td>
                      </tr>
                    ))}
                    {orders.length === 0 && <tr><td colSpan={5} style={{ ...c.td, textAlign:'center', color:'rgba(255,255,255,0.25)', fontStyle:'italic' }}>No orders yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PRODUCTS */}
          {panel === 'products' && (
            <div>
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'16px' }}>
                {['all','favours','clothing','accessories','decor','art'].map(cat => (
                  <button key={cat} onClick={() => setCatFilter(cat)} style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.1em', padding:'6px 14px', borderRadius:'100px', cursor:'pointer', background: catFilter===cat ? '#d4af6e' : 'transparent', color: catFilter===cat ? '#0f1f0f' : 'rgba(255,255,255,0.45)', border:`0.5px solid ${catFilter===cat ? '#d4af6e' : 'rgba(255,255,255,0.15)'}` }}>
                    {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase()+cat.slice(1)}
                  </button>
                ))}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'12px' }}>
                {filteredProducts.map((p:any) => (
                  <div key={p.id} style={c.card}>
                    <div style={{ height:'100px', background:'rgba(26,61,26,0.4)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
                      {p.images?.[0] ? <img src={p.images[0]} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : (
                        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" opacity="0.25"><rect x="3" y="6" width="30" height="24" rx="3" stroke="#d4af6e" strokeWidth="1"/></svg>
                      )}
                      <div style={{ position:'absolute', top:'6px', left:'6px' }}>{pill(p.visibility)}</div>
                    </div>
                    <div style={{ padding:'12px' }}>
                      <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.1em', color:'rgba(255,255,255,0.3)', marginBottom:'3px' }}>{p.category}</div>
                      <div style={{ fontSize:'14px', color:'#fff', marginBottom:'3px' }}>{p.name}</div>
                      <div style={{ fontSize:'18px', color:'#d4af6e', marginBottom:'10px' }}>${p.price?.toFixed(2)}</div>
                      <div style={{ display:'flex', gap:'6px' }}>
                        {btn('outline', () => openEdit(p), 'Edit')}
                        {btn('danger', () => deleteProduct(p.id), 'Remove')}
                      </div>
                    </div>
                  </div>
                ))}
                {filteredProducts.length === 0 && (
                  <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'60px', color:'rgba(255,255,255,0.25)', fontStyle:'italic' }}>No products yet. Click "+ Add product" to get started.</div>
                )}
              </div>
            </div>
          )}

          {/* ORDERS */}
          {panel === 'orders' && (
            <div style={c.card}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['Order','Customer','Type','Total','Status','Update'].map(h=><th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {orders.map((o:any) => (
                    <tr key={o.id}>
                      <td style={c.td}><span style={{ fontFamily:'var(--font-cinzel)', fontSize:'10px', color:'rgba(255,255,255,0.4)' }}>{o.order_number}</span></td>
                      <td style={{ ...c.td, fontSize:'12px' }}>{o.customer_email}</td>
                      <td style={c.td}>{o.order_type}</td>
                      <td style={{ ...c.td, color:'#d4af6e' }}>${o.total?.toFixed(2)}</td>
                      <td style={c.td}>{pill(o.status)}</td>
                      <td style={c.td}>
                        <select onChange={e => updateOrderStatus(o.id, e.target.value)} defaultValue={o.status}
                          style={{ background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(212,175,110,0.18)', borderRadius:'6px', padding:'5px 8px', fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'#fff', cursor:'pointer' }}>
                          {['pending','processing','shipped','delivered','cancelled'].map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && <tr><td colSpan={6} style={{ ...c.td, textAlign:'center', color:'rgba(255,255,255,0.25)', fontStyle:'italic' }}>No orders yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* AFFILIATES */}
          {panel === 'affiliates' && (
            <div style={c.card}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['Name','Location','Type','Submitted','Status','Action'].map(h=><th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {affiliates.map((a:any) => (
                    <tr key={a.id}>
                      <td style={c.td}><div>{a.first_name} {a.last_name}</div><div style={{ fontSize:'11px', color:'rgba(255,255,255,0.35)' }}>{a.email}</div></td>
                      <td style={{ ...c.td, fontSize:'12px' }}>{a.city}, {a.state}</td>
                      <td style={c.td}>{pill(a.affiliate_type || 'decorator')}</td>
                      <td style={{ ...c.td, fontFamily:'var(--font-cinzel)', fontSize:'10px', color:'rgba(255,255,255,0.3)' }}>{new Date(a.submitted_at).toLocaleDateString()}</td>
                      <td style={c.td}>{pill(a.status)}</td>
                      <td style={c.td}>
                        {a.status === 'pending' && btn('gold', () => approveAffiliate(a.id), 'Approve')}
                        {a.status === 'approved' && <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.3)', fontStyle:'italic' }}>Active</span>}
                      </td>
                    </tr>
                  ))}
                  {affiliates.length === 0 && <tr><td colSpan={6} style={{ ...c.td, textAlign:'center', color:'rgba(255,255,255,0.25)', fontStyle:'italic' }}>No applications yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* CAMPAIGNS */}
          {panel === 'campaigns' && (
            <div style={c.card}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['Campaign','Event','Raised','Donors','Status','Actions'].map(h=><th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {campaigns.map((cam:any) => (
                    <tr key={cam.id}>
                      <td style={c.td}><div>{cam.honoree_names}</div><div style={{ fontFamily:'var(--font-cinzel)', fontSize:'10px', color:'rgba(255,255,255,0.3)' }}>{cam.slug}</div></td>
                      <td style={c.td}>{cam.event_type}</td>
                      <td style={{ ...c.td, color:'#d4af6e' }}>${(cam.total_raised||0).toFixed(2)}</td>
                      <td style={c.td}>{cam.donor_count||0}</td>
                      <td style={c.td}>{pill(cam.status)}</td>
                      <td style={c.td}>
                        <div style={{ display:'flex', gap:'6px' }}>
                          {cam.status === 'pending' && btn('gold', () => updateCampaignStatus(cam.id, 'active'), 'Activate')}
                          {cam.status === 'active' && btn('outline', () => updateCampaignStatus(cam.id, 'ended'), 'End')}
                          <a href={`/give/${cam.slug}`} target="_blank" style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.1em', padding:'6px 12px', borderRadius:'6px', background:'transparent', color:'rgba(255,255,255,0.4)', border:'0.5px solid rgba(255,255,255,0.1)', textDecoration:'none' }}>View</a>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {campaigns.length === 0 && <tr><td colSpan={6} style={{ ...c.td, textAlign:'center', color:'rgba(255,255,255,0.25)', fontStyle:'italic' }}>No campaigns yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* SADAQAH REQUESTS */}
          {panel === 'sadaqah' && (
            <div style={c.card}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['Name','Event','Honourees','Date','QR Tier','Status','Action'].map(h=><th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {requests.map((r:any) => (
                    <tr key={r.id}>
                      <td style={c.td}><div>{r.first_name} {r.last_name}</div><div style={{ fontSize:'11px', color:'rgba(255,255,255,0.35)' }}>{r.email}</div></td>
                      <td style={c.td}>{r.event_type}</td>
                      <td style={c.td}>{r.honoree_names}</td>
                      <td style={{ ...c.td, fontFamily:'var(--font-cinzel)', fontSize:'10px', color:'rgba(255,255,255,0.3)' }}>{r.event_date || '—'}</td>
                      <td style={c.td}>{pill(r.qr_tier === 'premium' ? 'featured' : 'draft')}</td>
                      <td style={c.td}>{pill(r.status)}</td>
                      <td style={c.td}>
                        {r.status === 'pending' && btn('gold', () => sendMagicLink(r.id), sending === r.id ? 'Sending…' : 'Send magic link', sending === r.id)}
                        {r.status === 'approved' && <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.3)', fontStyle:'italic' }}>Link sent</span>}
                      </td>
                    </tr>
                  ))}
                  {requests.length === 0 && <tr><td colSpan={7} style={{ ...c.td, textAlign:'center', color:'rgba(255,255,255,0.25)', fontStyle:'italic' }}>No campaign requests yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </main>

      {/* Product modal */}
      {productModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setProductModal(false) }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
          <div style={{ background:'#111b11', border:'0.5px solid rgba(212,175,110,0.25)', borderRadius:'16px', width:'100%', maxWidth:'480px', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ padding:'18px 22px', borderBottom:'0.5px solid rgba(212,175,110,0.1)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'13px', color:'#fff' }}>{editProduct ? 'Edit product' : 'Add product'}</span>
              <button onClick={() => setProductModal(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', fontSize:'20px', cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:'14px' }}>
              <div><label style={c.label}>Product name</label><input type="text" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Lindor Milk Chocolate Truffle" style={c.input}/></div>
              <div><label style={c.label}>Price ($)</label><input type="number" value={form.price} onChange={e => setForm(f=>({...f,price:e.target.value}))} placeholder="0.50" style={c.input}/></div>
              <div><label style={c.label}>Description</label><textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="Brief description…" style={{ ...c.input, resize:'vertical' as const, minHeight:'70px', lineHeight:'1.5' }}/></div>
              <div>
                <label style={c.label}>Category</label>
                <select value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))} style={c.input}>
                  {['favours','clothing','accessories','decor','art'].map(cat=><option key={cat} value={cat}>{cat.charAt(0).toUpperCase()+cat.slice(1)}</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={c.label}>Stock</label>
                  <select value={form.stock_status} onChange={e => setForm(f=>({...f,stock_status:e.target.value}))} style={c.input}>
                    {['in_stock','low','out','seasonal'].map(v=><option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={c.label}>Visibility</label>
                  <select value={form.visibility} onChange={e => setForm(f=>({...f,visibility:e.target.value}))} style={c.input}>
                    {['draft','published','featured'].map(v=><option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:'10px', cursor:'pointer' }}>
                <input type="checkbox" checked={form.is_favour_item} onChange={e => setForm(f=>({...f,is_favour_item:e.target.checked}))} style={{ width:'16px', height:'16px' }}/>
                <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.1em', color:'rgba(255,255,255,0.5)' }}>Available as favour bag item</span>
              </label>
            </div>
            <div style={{ padding:'14px 22px', borderTop:'0.5px solid rgba(212,175,110,0.1)', display:'flex', gap:'10px', justifyContent:'flex-end' }}>
              {btn('ghost', () => setProductModal(false), 'Cancel')}
              {btn('gold', saveProduct, saving ? 'Saving…' : 'Save product', saving)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
