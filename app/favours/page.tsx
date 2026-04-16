'use client'
import { useState, useEffect } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createClient } from '@/lib/supabase/client'

type Product = {
  id: string
  name: string
  price: number
  description: string
  images: string[]
  stock_status: string
}

type Bundle = {
  id: string
  name: string
  event_type: string
  description: string
  min_items: number
  base_price_per_bag: number
}

const QTY_STEPS = [50, 100, 150, 200, 250, 300]

export default function FavoursPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [quantity, setQuantity] = useState(50)
  const [customMessage, setCustomMessage] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [shippingMethod, setShippingMethod] = useState<'ground'|'sample'>('ground')
  const [loading, setLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [step, setStep] = useState<1|2|3>(1)

  const supabase = createClient()

  useEffect(() => {
    Promise.all([
      supabase.from('products').select('*').eq('is_favour_item', true).eq('visibility', 'published').order('sort_order'),
      supabase.from('favour_bundles').select('*').eq('is_active', true).order('sort_order'),
    ]).then(([{ data: prods }, { data: bunds }]) => {
      setProducts(prods || [])
      setBundles(bunds || [])
      if (bunds?.length) setSelectedBundle(bunds[0])
    })
  }, [])

  const toggleItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedProductList = products.filter(p => selectedItems.has(p.id))
  const pricePerBag = selectedProductList.reduce((sum, p) => sum + p.price, 0) +
    (selectedBundle?.base_price_per_bag || 0)
  const subtotal = pricePerBag * quantity
  const shippingEst = quantity <= 100 ? 45 : quantity <= 200 ? 75 : 110
  const total = subtotal + shippingEst
  const mealsEquivalent = Math.floor(subtotal / 0.80)
  const minItems = selectedBundle?.min_items || 3
  const canProceed = selectedItems.size >= minItems

  const handleCheckout = async () => {
    setLoading(true)
    setCheckoutError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_type: 'favours',
          customer_email: user?.email || '',
          customer_name: user?.user_metadata?.full_name || '',
          event_type: selectedBundle?.event_type,
          bundle_quantity: quantity,
          custom_message: customMessage,
          shipping_method: shippingMethod,
          items: selectedProductList.map(p => ({
            product_id: p.id, name: p.name,
            qty: quantity, price: p.price,
          })),
        }),
      })
      const data = await res.json()
      if (data.checkoutUrl) window.location.href = data.checkoutUrl
      else setCheckoutError(data.error || 'Something went wrong. Please try again.')
    } catch {
      setCheckoutError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const sectionTitle = (t: string) => (
    <h2 style={{ fontFamily:'var(--font-cinzel)', fontSize:'10px', letterSpacing:'0.24em',
      color:'var(--gold)', marginBottom:'16px', display:'flex', alignItems:'center', gap:'10px' }}>
      {t}
      <span style={{ flex:1, height:'0.5px', background:'rgba(212,175,110,0.15)', display:'block' }}/>
    </h2>
  )

  const card = (children: React.ReactNode, extra?: React.CSSProperties) => (
    <div style={{ background:'rgba(15,31,15,0.6)', border:'0.5px solid rgba(212,175,110,0.15)',
      borderRadius:'14px', padding:'22px', backdropFilter:'blur(8px)', ...extra }}>
      {children}
    </div>
  )

  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ paddingTop:'88px', minHeight:'100dvh', position:'relative', zIndex:2 }}>

        {/* Hero */}
        <div style={{ textAlign:'center', padding:'48px 24px 40px', maxWidth:'600px', margin:'0 auto' }}>
          <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.28em', color:'var(--gold)', marginBottom:'14px' }}>
            Party Favours
          </div>
          <h1 style={{ fontFamily:'var(--font-cinzel)', fontSize:'clamp(28px,5vw,44px)', fontWeight:500, color:'#fff', marginBottom:'14px', lineHeight:1.15 }}>
            Curated with <span style={{ color:'var(--gold)' }}>intention</span>
          </h1>
          <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'17px', fontStyle:'italic', color:'rgba(255,255,255,0.55)', lineHeight:1.7 }}>
            Beautifully assembled favour bags for Nikkah, Walima, Aqiqah and every blessed occasion.
            Minimum 3 items per bag · Orders from 50 units · 2-week production + shipping.
          </p>
        </div>

        {/* Configurator */}
        <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'0 24px 80px',
          display:'grid', gridTemplateColumns:'1fr 340px', gap:'24px', alignItems:'start' }}>

          {/* Left — configuration */}
          <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

            {/* Step 1 — Event type */}
            {sectionTitle('Step 1 — Choose your occasion')}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:'10px' }}>
              {bundles.map(b => (
                <button key={b.id} onClick={() => setSelectedBundle(b)} style={{
                  background: selectedBundle?.id === b.id ? 'rgba(46,107,46,0.2)' : 'rgba(255,255,255,0.03)',
                  border: `0.5px solid ${selectedBundle?.id === b.id ? 'rgba(212,175,110,0.5)' : 'rgba(212,175,110,0.12)'}`,
                  borderRadius:'10px', padding:'14px', textAlign:'left', cursor:'pointer',
                  transition:'all 0.15s',
                }}>
                  <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'11px', fontWeight:500, color:'#fff', marginBottom:'4px' }}>
                    {b.name}
                  </div>
                  <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'rgba(255,255,255,0.5)', fontStyle:'italic', lineHeight:1.4 }}>
                    {b.description}
                  </div>
                  <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'10px', color:'var(--gold)', marginTop:'8px' }}>
                    From ${b.base_price_per_bag.toFixed(2)}/bag
                  </div>
                </button>
              ))}
            </div>

            {/* Step 2 — Item selection */}
            {sectionTitle(`Step 2 — Choose items (minimum ${minItems})`)}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'10px' }}>
              {products.map(p => {
                const selected = selectedItems.has(p.id)
                return (
                  <button key={p.id} onClick={() => toggleItem(p.id)} style={{
                    background: selected ? 'rgba(46,107,46,0.18)' : 'rgba(255,255,255,0.03)',
                    border: `0.5px solid ${selected ? 'rgba(212,175,110,0.5)' : 'rgba(212,175,110,0.12)'}`,
                    borderRadius:'10px', padding:'14px', textAlign:'left',
                    cursor: p.stock_status === 'out' ? 'not-allowed' : 'pointer',
                    opacity: p.stock_status === 'out' ? 0.4 : 1,
                    transition:'all 0.15s', position:'relative',
                  }}>
                    {/* Check indicator */}
                    {selected && (
                      <div style={{ position:'absolute', top:'10px', right:'10px', width:'18px', height:'18px',
                        borderRadius:'50%', background:'var(--gold)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <svg width="10" height="8" viewBox="0 0 10 8"><polyline points="1,4 3.5,6.5 9,1" fill="none" stroke="#0f1f0f" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </div>
                    )}

                    {/* Image placeholder / real image */}
                    <div style={{ height:'80px', background:'rgba(26,61,26,0.5)', borderRadius:'7px',
                      marginBottom:'10px', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                      {p.images?.[0] ? (
                        <img src={p.images[0]} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                      ) : (
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" opacity="0.3">
                          <rect x="3" y="6" width="26" height="20" rx="3" stroke="#d4af6e" strokeWidth="1"/>
                          <circle cx="11" cy="12" r="3" stroke="#d4af6e" strokeWidth="0.8"/>
                          <path d="M3 20 L10 15 L16 18 L22 12 L29 17" stroke="#d4af6e" strokeWidth="0.8" fill="none"/>
                        </svg>
                      )}
                    </div>

                    <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'14px', color:'#fff', marginBottom:'4px' }}>
                      {p.name}
                    </div>
                    <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'rgba(255,255,255,0.45)', fontStyle:'italic', marginBottom:'6px', lineHeight:1.4 }}>
                      {p.description}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'10px', color:'var(--gold)' }}>
                        +${p.price.toFixed(2)}/bag
                      </span>
                      {p.stock_status === 'low' && (
                        <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', color:'#d4a017', letterSpacing:'0.08em' }}>Low stock</span>
                      )}
                      {p.stock_status === 'out' && (
                        <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', color:'#e24b4a', letterSpacing:'0.08em' }}>Sold out</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Validation message */}
            {selectedItems.size > 0 && selectedItems.size < minItems && (
              <div style={{ background:'rgba(212,175,110,0.08)', border:'0.5px solid rgba(212,175,110,0.2)',
                borderRadius:'8px', padding:'10px 14px', fontFamily:'var(--font-cormorant)',
                fontSize:'14px', color:'var(--gold)', fontStyle:'italic' }}>
                Please select at least {minItems} items to continue. You've chosen {selectedItems.size}.
              </div>
            )}

            {/* Step 3 — Quantity */}
            {sectionTitle('Step 3 — Quantity (multiples of 50)')}
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
              {QTY_STEPS.map(q => (
                <button key={q} onClick={() => setQuantity(q)} style={{
                  fontFamily:'var(--font-cinzel)', fontSize:'12px', letterSpacing:'0.1em',
                  padding:'10px 20px', borderRadius:'100px',
                  background: quantity === q ? 'var(--gold)' : 'transparent',
                  color: quantity === q ? 'var(--forest-dark)' : 'var(--gold)',
                  border:`0.5px solid ${quantity === q ? 'var(--gold)' : 'rgba(212,175,110,0.3)'}`,
                  cursor:'pointer', transition:'all 0.15s',
                }}>
                  {q} bags
                </button>
              ))}
              <button onClick={() => {
                const val = parseInt(window.prompt('Enter quantity (multiples of 50, max 2000):') || '0')
                if (val >= 50 && val <= 2000 && val % 50 === 0) setQuantity(val)
              }} style={{
                fontFamily:'var(--font-cinzel)', fontSize:'12px', letterSpacing:'0.1em',
                padding:'10px 20px', borderRadius:'100px', background:'transparent',
                color:'rgba(255,255,255,0.4)', border:'0.5px solid rgba(255,255,255,0.12)',
                cursor:'pointer',
              }}>
                Custom
              </button>
            </div>

            {/* Custom message */}
            {sectionTitle('Step 4 — Personalisation (optional)')}
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <div>
                <label style={{ fontFamily:'var(--font-cinzel)', fontSize:'8.5px', letterSpacing:'0.18em',
                  color:'rgba(255,255,255,0.35)', display:'block', marginBottom:'7px' }}>
                  Custom insert card message
                </label>
                <textarea className="ge-input" rows={3} value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  placeholder="e.g. With love from Aisha & Ibrahim · April 13, 2026"
                  style={{ resize:'vertical', lineHeight:1.5 }}/>
                <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'rgba(255,255,255,0.3)', marginTop:'5px', fontStyle:'italic' }}>
                  Printed on the insert card inside every bag. Max 120 characters.
                </div>
              </div>
              <div>
                <label style={{ fontFamily:'var(--font-cinzel)', fontSize:'8.5px', letterSpacing:'0.18em',
                  color:'rgba(255,255,255,0.35)', display:'block', marginBottom:'7px' }}>
                  Event date (helps us schedule production)
                </label>
                <input type="date" className="ge-input" value={eventDate}
                  onChange={e => setEventDate(e.target.value)}
                  style={{ colorScheme:'dark' }}/>
              </div>
            </div>

            {/* Shipping method */}
            {sectionTitle('Step 5 — Shipping')}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              {[
                { id:'ground', label:'Standard ground', desc:'USPS / UPS Ground · 2–3 weeks · lowest cost', price:`~$${shippingEst}` },
                { id:'sample', label:'Order a sample first', desc:'USPS Priority · 2–3 days · pay express rate', price:'~$15' },
              ].map(opt => (
                <button key={opt.id} onClick={() => setShippingMethod(opt.id as any)} style={{
                  background: shippingMethod === opt.id ? 'rgba(46,107,46,0.18)' : 'rgba(255,255,255,0.03)',
                  border:`0.5px solid ${shippingMethod === opt.id ? 'rgba(212,175,110,0.5)' : 'rgba(212,175,110,0.12)'}`,
                  borderRadius:'10px', padding:'14px', textAlign:'left', cursor:'pointer', transition:'all 0.15s',
                }}>
                  <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'11px', color:'#fff', marginBottom:'4px' }}>{opt.label}</div>
                  <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'rgba(255,255,255,0.45)', fontStyle:'italic', lineHeight:1.4, marginBottom:'6px' }}>{opt.desc}</div>
                  <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'10px', color:'var(--gold)' }}>{opt.price}</div>
                </button>
              ))}
            </div>

          </div>

          {/* Right — order summary sticky */}
          <div style={{ position:'sticky', top:'88px' }}>
            {card(
              <>
                <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.22em', color:'var(--gold)', marginBottom:'16px' }}>
                  Order Summary
                </div>

                {/* Bundle */}
                {selectedBundle && (
                  <div style={{ marginBottom:'12px', paddingBottom:'12px', borderBottom:'0.5px solid rgba(212,175,110,0.12)' }}>
                    <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'11px', color:'#fff', marginBottom:'2px' }}>{selectedBundle.name}</div>
                    <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'rgba(255,255,255,0.45)', fontStyle:'italic' }}>{selectedBundle.event_type} · {quantity} bags</div>
                  </div>
                )}

                {/* Selected items */}
                {selectedProductList.length > 0 ? (
                  <div style={{ marginBottom:'12px', paddingBottom:'12px', borderBottom:'0.5px solid rgba(212,175,110,0.12)' }}>
                    <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'8.5px', letterSpacing:'0.15em', color:'rgba(255,255,255,0.35)', marginBottom:'8px' }}>Items per bag</div>
                    {selectedProductList.map(p => (
                      <div key={p.id} style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
                        <span style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'rgba(255,255,255,0.7)' }}>{p.name}</span>
                        <span style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'var(--gold)' }}>+${p.price.toFixed(2)}</span>
                      </div>
                    ))}
                    {selectedProductList.length < minItems && (
                      <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', color:'#d4a017', letterSpacing:'0.08em', marginTop:'6px' }}>
                        Add {minItems - selectedProductList.length} more item{minItems - selectedProductList.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'rgba(255,255,255,0.3)', fontStyle:'italic', marginBottom:'12px', paddingBottom:'12px', borderBottom:'0.5px solid rgba(212,175,110,0.12)' }}>
                    No items selected yet
                  </div>
                )}

                {/* Pricing breakdown */}
                <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'16px' }}>
                  {[
                    { label:`${quantity} bags × $${pricePerBag.toFixed(2)}`, val:`$${subtotal.toFixed(2)}` },
                    { label:`Est. shipping (${shippingMethod === 'sample' ? 'express' : 'ground'})`, val:`~$${shippingMethod === 'sample' ? 15 : shippingEst}` },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ display:'flex', justifyContent:'space-between' }}>
                      <span style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'rgba(255,255,255,0.55)', fontStyle:'italic' }}>{label}</span>
                      <span style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'#fff' }}>{val}</span>
                    </div>
                  ))}
                  <div style={{ borderTop:'0.5px solid rgba(212,175,110,0.15)', paddingTop:'8px', display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'11px', color:'#fff' }}>Estimated total</span>
                    <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'18px', fontWeight:500, color:'var(--gold-light)' }}>${(subtotal + (shippingMethod === 'sample' ? 15 : shippingEst)).toFixed(2)}</span>
                  </div>
                </div>

                {/* Inquiry note */}
                <div style={{ background:'rgba(212,175,110,0.06)', border:'0.5px solid rgba(212,175,110,0.15)',
                  borderRadius:'8px', padding:'10px 12px', marginBottom:'16px',
                  fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'rgba(255,255,255,0.45)', fontStyle:'italic', lineHeight:1.5 }}>
                  Final pricing confirmed at checkout. Orders take a minimum of 2 weeks to produce and ship. Non-refundable once packed.
                </div>

                {checkoutError && (
                  <div style={{ background:'rgba(226,75,74,0.1)', border:'0.5px solid rgba(226,75,74,0.25)',
                    borderRadius:'8px', padding:'10px 12px', marginBottom:'12px',
                    fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'#e24b4a', lineHeight:1.5 }}>
                    {checkoutError}
                  </div>
                )}

                <button
                  onClick={handleCheckout}
                  disabled={!canProceed || loading}
                  style={{
                    width:'100%', fontFamily:'var(--font-cinzel)', fontSize:'11px', letterSpacing:'0.16em',
                    color: canProceed ? 'var(--forest-dark)' : 'rgba(255,255,255,0.3)',
                    background: canProceed ? 'var(--gold)' : 'rgba(255,255,255,0.06)',
                    border: canProceed ? 'none' : '0.5px solid rgba(255,255,255,0.1)',
                    borderRadius:'10px', padding:'15px',
                    cursor: canProceed && !loading ? 'pointer' : 'not-allowed',
                    transition:'all 0.18s',
                  }}
                >
                  {loading ? 'Preparing checkout…' : canProceed ? 'Proceed to checkout' : `Select ${minItems - selectedItems.size} more item${minItems - selectedItems.size !== 1 ? 's' : ''}`}
                </button>

                {/* Or: request a quote */}
                <div style={{ textAlign:'center', marginTop:'12px' }}>
                  <a href="/contact?inquiry=favours" style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.14em', color:'rgba(255,255,255,0.3)', textDecoration:'none' }}>
                    Need a custom quote? Contact us
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
