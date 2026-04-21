'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Panel = 'dashboard' | 'products' | 'orders' | 'affiliates' | 'campaigns' | 'sadaqah'

type Stats = {
  revenue: { orders: number; connections: number; total: number }
  donations: { total: number; meals: number }
  counts: { orders: number; active_campaigns: number; pending_affiliates: number; total_connections: number }
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const [panel, setPanel] = useState<Panel>('dashboard')
  const [stats, setStats] = useState<Stats | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [affiliates, setAffiliates] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [catFilter, setCatFilter] = useState('all')
  const [productModal, setProductModal] = useState(false)
  const [editProduct, setEditProduct] = useState<any>(null)
  const [form, setForm] = useState({ name:'', category:'favours', price:'', description:'', stock_status:'in_stock', visibility:'draft', is_favour_item: false })
  const [saving, setSaving] = useState(false)

  // Verify admin
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
    const [statsRes, productsRes, ordersRes, affiliatesRes, campaignsRes] = await Promise.all([
      fetch('/api/admin/stats').then(r => r.json()),
      fetch('/api/products?all=true').then(r => r.json()),
      fetch('/api/orders').then(r => r.json()),
      supabase.from('affiliate_applications').select('*').order('submitted_at', { ascending: false }),
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
    ])
    setStats(statsRes)
    setProducts(productsRes.products || [])
    setOrders(ordersRes.orders || [])
    setAffiliates(affiliatesRes.data || [])
    setCampaigns(campaignsRes.data || [])
  }

  const saveProduct = async () => {
    setSaving(true)
    const method = editProduct ? 'PUT' : 'POST'
    const url = editProduct ? `/api/products/${editProduct.id}` : '/api/products'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, price: parseFloat(form.price) }),
    })
    await loadAll()
    setProductModal(false)
    setEditProduct(null)
    setForm({ name:'', category:'favours', price:'', description:'', stock_status:'in_stock', visibility:'draft', is_favour_item: false })
    setSaving(false)
  }

  const deleteProduct = async (id: string) => {
    if (!confirm('Remove this product?')) return
    await fetch(`/api/products/${id}`, { method: 'DELETE' })
    setProducts(p => p.filter(x => x.id !== id))
  }

  const approveAffiliate = async (id: string) => {
    await fetch(`/api/affiliates/${id}/approve`, { method: 'PUT' })
    setAffiliates(a => a.map(x => x.id === id ? { ...x, status: 'approved' } : x))
  }

  const updateCampaignStatus = async (id: string, status: string) => {
    await supabase.from('campaigns').update({ status }).eq('id', id)
    setCampaigns(c => c.map(x => x.id === id ? { ...x, status } : x))
  }

  const updateOrderStatus = async (id: string, status: string) => {
    await fetch(`/api/orders`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    setOrders(o => o.map(x => x.id === id ? { ...x, status } : x))
  }

  const openEdit = (p: any) => {
    setEditProduct(p)
    setForm({ name: p.name, category: p.category, price: p.price.toString(), description: p.description || '', stock_status: p.stock_status, visibility: p.visibility, is_favour_item: p.is_favour_item })
    setProductModal(true)
  }

  // Styles
  const s = {
    wrap: { display:'flex', height:'100vh', overflow:'hidden', background:'#080f08', color:'#fff', fontFamily:'var(--font-cormorant)' } as React.CSSProperties,
    sidebar: { width:'200px', flexShrink:0, borderRight:'0.5px solid rgba(212,175,110,0.12)', display:'flex', flexDirection:'column' as const, background:'#060d06' },
    sideTop: { padding:'18px 16px', borderBottom:'0.5px solid rgba(212,175,110,0.1)', display:'flex', alignItems:'center', gap:'8px' },
    wordmark: { fontFamily:'var(--font-cinzel)', fontSize:'11px', letterSpacing:'0.18em', color:'#d4af6e' },
    navSection: { padding:'12px 8px 4px', fontFamily:'var(--font-cinzel)', fontSize:'7px', letterSpacing:'0.22em', color:'rgba(255,255,255,0.25)' },
    navItem: (active: boolean): React.CSSProperties => ({ display:'flex', alignItems:'center', gap:'8px', padding:'8px 10px', borderRadius:'7px', cursor:'pointer', margin:'1px 6px', background: active ? 'rgba(212,175,110,0.08)' : 'transparent', fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.1em', color: active ? '#d4af6e' : 'rgba(255,255,255,0.45)', transition:'all 0.15s' }),
    main: { flex:1, overflow:'auto', display:'flex', flexDirection:'column' as const },
    topbar: { padding:'0 24px', height:'52px', borderBottom:'0.5px solid rgba(212,175,110,0.1)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
    content: { padding:'24px', flex:1 },
    card: { background:'rgba(15,31,15,0.5)', border:'0.5px solid rgba(212,175,110,0.12)', borderRadius:'12px', overflow:'hidden' },
    th: { fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.14em', color:'rgba(255,255,255,0.3)', padding:'10px 14px', textAlign:'left' as const, borderBottom:'0.5px solid rgba(212,175,110,0.08)', fontWeight:400 },
    td: { padding:'11px 14px', borderBottom:'0.5px solid rgba(212,175,110,0.05)', fontSize:'13px', color:'rgba(255,255,255,0.75)', verticalAlign:'middle' as const },
    pill: (color: string): React.CSSProperties => {
      const colors: Record<string, [string,string]> = {
        green: ['rgba(29,158,117,0.12)','#1D9E75'],
        amber: ['rgba(186,117,23,0.12)','#d4a017'],
        red:   ['rgba(226,75,74,0.1)','#e24b4a'],
        gray:  ['rgba(255,255,255,0.06)','rgba(255,255,255,0.4)'],
        gold:  ['rgba(212,175,110,0.1)','#d4af6e'],
      }
      const [bg, fg] = colors[color] || colors.gray
      return { display:'inline-block', fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.08em', padding:'3px 9px', borderRadius:'20px', background:bg, color:fg }
    },
    btn: (variant: 'gold'|'outline'|'danger'|'ghost'): React.CSSProperties => ({
      fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.12em', border:'none',
      borderRadius:'6px', padding:'6px 12px', cursor:'pointer', transition:'all 0.15s',
      ...(variant === 'gold' ? { background:'#d4af6e', color:'#0f1f0f' } :
          variant === 'danger' ? { background:'rgba(226,75,74,0.1)', color:'#e24b4a', border:'0.5px solid rgba(226,75,74,0.2)' } :
          variant === 'ghost' ? { background:'transparent', color:'rgba(255,255,255,0.4)', border:'0.5px solid rgba(255,255,255,0.1)' } :
          { background:'transparent', color:'#d4af6e', border:'0.5px solid rgba(212,175,110,0.3)' })
    }),
    input: { width:'100%', background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(212,175,110,0.18)', borderRadius:'7px', padding:'10px 12px', fontFamily:'var(--font-cormorant)', fontSize:'15px', color:'#fff', outline:'none' } as React.CSSProperties,
    label: { fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.16em', color:'rgba(255,255,255,0.35)', display:'block', marginBottom:'6px' } as React.CSSProperties,
  }

  const statusPill = (status: string) => {
    const map: Record<string,string> = { pending:'amber', processing:'amber', approved:'green', active:'green', shipped:'green', delivered:'green', declined:'red', cancelled:'red', ended:'gray', draft:'gray', published:'green', featured:'gold' }
    return <span style={s.pill(map[status] || 'gray')}>{status}</span>
  }

  const filteredProducts = catFilter === 'all' ? products : products.filter(p => p.category === catFilter)

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#080f08' }}>
      <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'16px', color:'rgba(255,255,255,0.4)', fontStyle:'italic' }}>Loading…</div>
    </div>
  )

  return (
    <div style={s.wrap}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.sideTop}>
          <svg width="22" height="22" viewBox="25 35 170 155"><rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke="#c8a050" strokeWidth="3" transform="rotate(0 110 110)"/><rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke="#c8a050" strokeWidth="3" transform="rotate(45 110 110)"/><polygon points="110,42 158,42 190,74 190,146 158,178 62,178 30,146 30,74 62,42" fill="#2e6b2e" stroke="#c8a050" strokeWidth="2.5"/><circle cx="103" cy="104" r="44" fill="#d4af6e"/><circle cx="117" cy="96" r="37" fill="#2e6b2e"/><g transform="translate(158,82)"><polygon points="0,-16 3.8,-6.2 14.8,-5 6.8,3 9.4,14 0,8.2 -9.4,14 -6.8,3 -14.8,-5 -3.8,-6.2" fill="#d4af6e"/></g></svg>
          <span style={s.wordmark}>Admin</span>
        </div>

        <div style={{ flex:1, overflowY:'auto', paddingBottom:'16px' }}>
          <div style={s.navSection}>Overview</div>
          {([['dashboard','Dashboard'],['orders','Orders'],] as [Panel,string][]).map(([id,label]) => (
            <div key={id} style={s.navItem(panel===id)} onClick={() => setPanel(id)}>{label}</div>
          ))}
          <div style={s.navSection}>Products</div>
          {([['products','All Products']] as [Panel,string][]).map(([id,label]) => (
            <div key={id} style={s.navItem(panel===id)} onClick={() => setPanel(id)}>{label}</div>
          ))}
          <div style={s.navSection}>Community</div>
          {([['affiliates','Affiliates'],['campaigns','Campaigns'],['sadaqah','Sadaqah']] as [Panel,string][]).map(([id,label]) => (
            <div key={id} style={s.navItem(panel===id)} onClick={() => setPanel(id)}>
              {label}
              {id === 'affiliates' && affiliates.filter(a => a.status === 'pending').length > 0 && (
                <span style={{ marginLeft:'auto', background:'#e24b4a', color:'#fff', fontFamily:'var(--font-cinzel)', fontSize:'8px', padding:'1px 6px', borderRadius:'10px' }}>
                  {affiliates.filter(a => a.status === 'pending').length}
                </span>
              )}
            </div>
          ))}
        </div>

        <div style={{ padding:'12px 14px', borderTop:'0.5px solid rgba(212,175,110,0.1)' }}>
          <a href="/" style={{ fontFamily:'var(--font-cinzel)', fontSize:'8.5px', letterSpacing:'0.12em', color:'rgba(255,255,255,0.3)', textDecoration:'none' }}>← View site</a>
        </div>
      </aside>

      {/* Main */}
      <main style={s.main}>
        {/* Topbar */}
        <div style={s.topbar}>
          <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'13px', color:'#fff', fontWeight:500 }}>
            {panel.charAt(0).toUpperCase() + panel.slice(1)}
          </div>
          {panel === 'products' && (
            <button style={s.btn('gold')} onClick={() => { setEditProduct(null); setForm({ name:'', category:'favours', price:'', description:'', stock_status:'in_stock', visibility:'draft', is_favour_item: false }); setProductModal(true) }}>
              + Add product
            </button>
          )}
        </div>

        <div style={s.content}>

          {/* ── DASHBOARD ── */}
          {panel === 'dashboard' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'12px', marginBottom:'24px' }}>
                {[
                  { label:'Total revenue', value:`$${((stats?.revenue.total || 0)).toFixed(2)}`, sub:'Orders + connections' },
                  { label:'Donations routed', value:`$${(stats?.donations.total || 0).toFixed(2)}`, sub:`${stats?.donations.meals || 0} meals funded` },
                  { label:'Active campaigns', value:stats?.counts.active_campaigns || 0, sub:'Baab As-Sadaqah' },
                  { label:'Pending affiliates', value:stats?.counts.pending_affiliates || 0, sub:'Awaiting review' },
                ].map(({ label, value, sub }) => (
                  <div key={label} style={{ ...s.card, padding:'16px' }}>
                    <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.18em', color:'rgba(255,255,255,0.3)', marginBottom:'8px' }}>{label}</div>
                    <div style={{ fontSize:'28px', fontWeight:300, color:'#fff', lineHeight:1, marginBottom:'4px' }}>{value}</div>
                    <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.3)', fontStyle:'italic' }}>{sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...s.card }}>
                <div style={{ padding:'12px 16px', borderBottom:'0.5px solid rgba(212,175,110,0.08)', fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.18em', color:'rgba(255,255,255,0.3)' }}>
                  Recent orders
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr>
                    {['Order','Customer','Type','Total','Status'].map(h => <th key={h} style={s.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {orders.slice(0,5).map(o => (
                      <tr key={o.id}>
                        <td style={s.td}><span style={{ fontFamily:'var(--font-cinzel)', fontSize:'10px', color:'rgba(255,255,255,0.4)' }}>{o.order_number}</span></td>
                        <td style={s.td}>{o.customer_email}</td>
                        <td style={s.td}>{o.order_type}</td>
                        <td style={{ ...s.td, color:'#d4af6e' }}>${o.total?.toFixed(2)}</td>
                        <td style={s.td}>{statusPill(o.status)}</td>
                      </tr>
                    ))}
                    {orders.length === 0 && <tr><td colSpan={5} style={{ ...s.td, textAlign:'center', color:'rgba(255,255,255,0.25)', fontStyle:'italic' }}>No orders yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── PRODUCTS ── */}
          {panel === 'products' && (
            <div>
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'16px' }}>
                {['all','favours','clothing','accessories','decor','art'].map(cat => (
                  <button key={cat} onClick={() => setCatFilter(cat)} style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.1em', padding:'6px 14px', borderRadius:'100px', cursor:'pointer', transition:'all 0.15s', background: catFilter === cat ? '#d4af6e' : 'transparent', color: catFilter === cat ? '#0f1f0f' : 'rgba(255,255,255,0.45)', border:`0.5px solid ${catFilter === cat ? '#d4af6e' : 'rgba(255,255,255,0.15)'}` }}>
                    {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'12px' }}>
                {filteredProducts.map(p => (
                  <div key={p.id} style={{ ...s.card }}>
                    <div style={{ height:'100px', background:'rgba(26,61,26,0.4)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                      {p.images?.[0] ? <img src={p.images[0]} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : (
                        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" opacity="0.25"><rect x="3" y="6" width="30" height="24" rx="3" stroke="#d4af6e" strokeWidth="1"/><circle cx="12" cy="14" r="4" stroke="#d4af6e" strokeWidth="0.8"/><path d="M3 24 L11 18 L18 22 L26 15 L33 20" stroke="#d4af6e" strokeWidth="0.8" fill="none"/></svg>
                      )}
                      <div style={{ position:'absolute', top:'6px', left:'6px' }}>{statusPill(p.visibility)}</div>
                    </div>
                    <div style={{ padding:'12px' }}>
                      <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.1em', color:'rgba(255,255,255,0.3)', marginBottom:'3px' }}>{p.category}</div>
                      <div style={{ fontSize:'14px', color:'#fff', marginBottom:'3px' }}>{p.name}</div>
                      <div style={{ fontSize:'18px', color:'#d4af6e', marginBottom:'10px' }}>${p.price.toFixed(2)}</div>
                      <div style={{ display:'flex', gap:'6px' }}>
                        <button style={{ ...s.btn('outline'), flex:1 }} onClick={() => openEdit(p)}>Edit</button>
                        <button style={s.btn('danger')} onClick={() => deleteProduct(p.id)}>Remove</button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredProducts.length === 0 && (
                  <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'60px', color:'rgba(255,255,255,0.25)', fontStyle:'italic' }}>
                    No products in this category yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ORDERS ── */}
          {panel === 'orders' && (
            <div style={s.card}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>
                  {['Order','Customer','Type','Items','Total','Status','Action'].map(h => <th key={h} style={s.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td style={s.td}><span style={{ fontFamily:'var(--font-cinzel)', fontSize:'10px', color:'rgba(255,255,255,0.4)' }}>{o.order_number}</span></td>
                      <td style={{ ...s.td, fontSize:'12px' }}>{o.customer_email}</td>
                      <td style={s.td}>{o.order_type}</td>
                      <td style={{ ...s.td, fontSize:'12px', color:'rgba(255,255,255,0.5)' }}>{o.bundle_quantity ? `${o.bundle_quantity} bags` : `${o.items?.length || 0} items`}</td>
                      <td style={{ ...s.td, color:'#d4af6e' }}>${o.total?.toFixed(2)}</td>
                      <td style={s.td}>{statusPill(o.status)}</td>
                      <td style={s.td}>
                        <select onChange={e => updateOrderStatus(o.id, e.target.value)} defaultValue={o.status}
                          style={{ background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(212,175,110,0.18)', borderRadius:'6px', padding:'5px 8px', fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'#fff', cursor:'pointer' }}>
                          {['pending','processing','shipped','delivered','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && <tr><td colSpan={7} style={{ ...s.td, textAlign:'center', color:'rgba(255,255,255,0.25)', fontStyle:'italic' }}>No orders yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* ── AFFILIATES ── */}
          {panel === 'affiliates' && (
            <div style={s.card}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>
                  {['Name','Email','City','Type','Events','Submitted','Status','Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {affiliates.map(a => (
                    <tr key={a.id}>
                      <td style={s.td}>{a.first_name} {a.last_name}</td>
                      <td style={{ ...s.td, fontSize:'12px' }}>{a.email}</td>
                      <td style={{ ...s.td, fontSize:'12px' }}>{a.city}, {a.state}</td>
                      <td style={s.td}><span style={s.pill('gold')}>{a.affiliate_type}</span></td>
                      <td style={{ ...s.td, fontSize:'12px', color:'rgba(255,255,255,0.5)' }}>{a.event_types?.slice(0,2).join(', ')}</td>
                      <td style={{ ...s.td, fontFamily:'var(--font-cinzel)', fontSize:'10px', color:'rgba(255,255,255,0.3)' }}>{new Date(a.submitted_at).toLocaleDateString()}</td>
                      <td style={s.td}>{statusPill(a.status)}</td>
                      <td style={s.td}>
                        <div style={{ display:'flex', gap:'6px' }}>
                          {a.status === 'pending' && (
                            <button style={s.btn('gold')} onClick={() => approveAffiliate(a.id)}>Approve</button>
                          )}
                          {a.status === 'approved' && <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.3)', fontStyle:'italic' }}>Active</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {affiliates.length === 0 && <tr><td colSpan={8} style={{ ...s.td, textAlign:'center', color:'rgba(255,255,255,0.25)', fontStyle:'italic' }}>No applications yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* ── CAMPAIGNS ── */}
          {panel === 'campaigns' && (
            <div style={s.card}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>
                  {['Campaign','Event','Date','Raised','Donors','Status','Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {campaigns.map(c => (
                    <tr key={c.id}>
                      <td style={s.td}><div style={{ color:'#fff' }}>{c.honoree_names}</div><div style={{ fontSize:'11px', color:'rgba(255,255,255,0.3)', fontFamily:'var(--font-cinzel)', letterSpacing:'0.06em' }}>{c.slug}</div></td>
                      <td style={s.td}>{c.event_type}</td>
                      <td style={{ ...s.td, fontFamily:'var(--font-cinzel)', fontSize:'10px', color:'rgba(255,255,255,0.3)' }}>{c.event_date || '—'}</td>
                      <td style={{ ...s.td, color:'#d4af6e' }}>${(c.total_raised || 0).toFixed(2)}</td>
                      <td style={s.td}>{c.donor_count || 0}</td>
                      <td style={s.td}>{statusPill(c.status)}</td>
                      <td style={s.td}>
                        <div style={{ display:'flex', gap:'6px' }}>
                          {c.status === 'pending' && <button style={s.btn('gold')} onClick={() => updateCampaignStatus(c.id, 'active')}>Activate</button>}
                          {c.status === 'active' && <button style={s.btn('outline')} onClick={() => updateCampaignStatus(c.id, 'ended')}>End</button>}
                          <a href={`/give/${c.slug}`} target="_blank" style={{ ...s.btn('ghost'), textDecoration:'none', display:'inline-flex', alignItems:'center' }}>View</a>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {campaigns.length === 0 && <tr><td colSpan={7} style={{ ...s.td, textAlign:'center', color:'rgba(255,255,255,0.25)', fontStyle:'italic' }}>No campaigns yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* ── SADAQAH requests ── */}
          {panel === 'sadaqah' && <SadaqahPanel s={s} statusPill={statusPill} />}

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
              {[
                { key:'name', label:'Product name', placeholder:'e.g. Lindor Milk Chocolate Truffle' },
                { key:'price', label:'Price ($)', placeholder:'0.50', type:'number' },
                { key:'description', label:'Description', placeholder:'Brief description…', textarea: true },
              ].map(({ key, label, placeholder, type, textarea }) => (
                <div key={key}>
                  <label style={s.label}>{label}</label>
                  {textarea ? (
                    <textarea value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} style={{ ...s.input, resize:'vertical', minHeight:'70px', lineHeight:1.5 }}/>
                  ) : (
                    <input type={type || 'text'} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} style={s.input}/>
                  )}
                </div>
              ))}
              <div>
                <label style={s.label}>Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...s.input, appearance:'none', cursor:'pointer' }}>
                  {['favours','clothing','accessories','decor','art'].map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={s.label}>Stock status</label>
                  <select value={form.stock_status} onChange={e => setForm(f => ({ ...f, stock_status: e.target.value }))} style={{ ...s.input, appearance:'none', cursor:'pointer' }}>
                    {['in_stock','low','out','seasonal'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Visibility</label>
                  <select value={form.visibility} onChange={e => setForm(f => ({ ...f, visibility: e.target.value }))} style={{ ...s.input, appearance:'none', cursor:'pointer' }}>
                    {['draft','published','featured'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer' }}>
                <input type="checkbox" checked={form.is_favour_item} onChange={e => setForm(f => ({ ...f, is_favour_item: e.target.checked }))}/>
                <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.1em', color:'rgba(255,255,255,0.5)' }}>Available as favour bag item</span>
              </label>
            </div>
            <div style={{ padding:'14px 22px', borderTop:'0.5px solid rgba(212,175,110,0.1)', display:'flex', gap:'10px', justifyContent:'flex-end' }}>
              <button style={s.btn('ghost')} onClick={() => setProductModal(false)}>Cancel</button>
              <button style={{ ...s.btn('gold'), opacity: saving ? 0.6 : 1 }} onClick={saveProduct} disabled={saving}>
                {saving ? 'Saving…' : 'Save product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SadaqahPanel({ s, statusPill }: { s: any, statusPill: (status: string) => JSX.Element }) {
  const supabase = createClient()
  const [requests, setRequests] = useState<any[]>([])
  const [sending, setSending] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('campaign_requests').select('*').order('submitted_at', { ascending: false }).then(({ data }) => setRequests(data || []))
  }, [])

  const sendMagicLink = async (id: string) => {
    setSending(id)
    await fetch('/api/admin/magic-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request_id: id }) })
    setRequests(r => r.map(x => x.id === id ? { ...x, status: 'approved' } : x))
    setSending(null)
  }

  return (
    <div style={s.card}>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead><tr>
          {['Name','Email','Event','Honourees','Date','QR','Status','Action'].map((h: string) => <th key={h} style={s.th}>{h}</th>)}
        </tr></thead>
        <tbody>
          {requests.map((r: any) => (
            <tr key={r.id}>
              <td style={s.td}>{r.first_name} {r.last_name}</td>
              <td style={{ ...s.td, fontSize:'12px' }}>{r.email}</td>
              <td style={s.td}>{r.event_type}</td>
              <td style={s.td}>{r.honoree_names}</td>
              <td style={{ ...s.td, fontFamily:'var(--font-cinzel)', fontSize:'10px', color:'rgba(255,255,255,0.3)' }}>{r.event_date || '—'}</td>
              <td style={s.td}><span style={s.pill(r.qr_tier === 'premium' ? 'gold' : 'gray')}>{r.qr_tier}</span></td>
              <td style={s.td}>{statusPill(r.status)}</td>
              <td style={s.td}>
                {r.status === 'pending' && (
                  <button style={{ ...s.btn('gold'), opacity: sending === r.id ? 0.6 : 1 }} onClick={() => sendMagicLink(r.id)} disabled={sending === r.id}>
                    {sending === r.id ? 'Sending…' : 'Send magic link'}
                  </button>
                )}
                {r.status === 'approved' && <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.3)', fontStyle:'italic' }}>Link sent</span>}
              </td>
            </tr>
          ))}
          {requests.length === 0 && <tr><td colSpan={8} style={{ ...s.td, textAlign:'center', color:'rgba(255,255,255,0.25)', fontStyle:'italic' }}>No campaign requests yet</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
