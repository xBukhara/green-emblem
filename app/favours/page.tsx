'use client'
import { useState, useRef } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createClient } from '@/lib/supabase/client'

// ── Bundle definitions ────────────────────────────────────────────────────────
const BUNDLES = [
  { id:'nikkah_classic',  name:'Nikkah Classic',   occasion:'Nikkah',  basePrice:3.50, maxFood:3, desc:'Curated for wedding guests. Up to 3 food items included.' },
  { id:'nikkah_deluxe',   name:'Nikkah Deluxe',    occasion:'Nikkah',  basePrice:5.00, maxFood:5, desc:'Premium selection. Up to 5 food items included.' },
  { id:'walima_standard', name:'Walima Standard',  occasion:'Walima',  basePrice:3.50, maxFood:3, desc:'Elegant favour bags for the Walima reception.' },
  { id:'aqiqah_bundle',   name:'Aqiqah Bundle',    occasion:'Aqiqah',  basePrice:3.00, maxFood:3, desc:'Thoughtful favours for the blessed arrival.' },
  { id:'eid_celebration', name:'Eid Celebration',  occasion:'Eid',     basePrice:3.00, maxFood:3, desc:'Festive bags for Eid gatherings.' },
  { id:'custom_event',    name:'Custom Event',     occasion:'Custom',  basePrice:3.50, maxFood:3, desc:'Build your own for any Islamic occasion.' },
]

// ── Food items ────────────────────────────────────────────────────────────────
const FOOD_ITEMS = [
  {
    id:'hershey', name:'Hershey Nuggets', extraPrice:0.35,
    desc:'Classic Hershey milk chocolate, individually foil-wrapped.',
    variants:['Milk Chocolate','Almond'], hasVariant:true,
  },
  {
    id:'lindor', name:'Lindor Chocolates', extraPrice:0.50,
    desc:'Premium Lindor milk chocolate truffle with smooth melting centre.',
    variants:['Milk','Dark','White','Mix'], hasVariant:true,
  },
  {
    id:'mixed_nuts', name:'Mixed Nuts', extraPrice:0.75,
    desc:'Branded sachet of cashews, almonds, and pistachios. Approx 1oz.',
    variants:[], hasVariant:false,
  },
  {
    id:'shahi_mehva', name:'Shahi Mehva', extraPrice:0.50,
    desc:'Traditional South Asian dried fruit mix. 1 pack per bag.',
    variants:[], hasVariant:false,
  },
]

// ── Vanity items (always extra) ───────────────────────────────────────────────
const VANITY_ITEMS = [
  { id:'attar',    name:'Attar / Fragrance',           price:4.00, desc:'Miniature Islamic fragrance vial. Alcohol-free.' },
  { id:'zamzam',   name:'Zamzam Bottle',               price:2.00, desc:'50ml miniature glass bottle of Zamzam water, sealed.' },
  { id:'keychain', name:'Mini Customized Keychain',    price:2.00, desc:'Personalized keychain with custom text or name.' },
  { id:'magnet',   name:'Customizable Magnet',         price:2.00, desc:'Custom printed fridge magnet. Gold foil on dark green.' },
]

// ── Box designs ───────────────────────────────────────────────────────────────
const BOX_DESIGNS = [
  { id:'silver',   name:'Silver',   extraPrice:0,    desc:'Elegant silver ribbon, matte white box', color:'#C0C0C0' },
  { id:'gold',     name:'Gold',     extraPrice:0.50, desc:'Gold foil accent, ivory box', color:'#D4AF6E' },
  { id:'platinum', name:'Platinum', extraPrice:1.00, desc:'Platinum embossed, premium rigid box', color:'#9B8EC4' },
]

const QTY_STEPS = [50, 100, 150, 200, 250, 300]

// ── Box preview SVG ───────────────────────────────────────────────────────────
function BoxPreview({ boxDesign, stickerUrl, bundleName }: { boxDesign: typeof BOX_DESIGNS[0], stickerUrl: string | null, bundleName: string }) {
  const accent = boxDesign.color
  return (
    <svg viewBox="0 0 220 280" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', maxWidth:'200px' }}>
      {/* Box body */}
      <rect x="20" y="60" width="180" height="200" rx="6" fill={boxDesign.id==='platinum'?'#1a1a2e':boxDesign.id==='gold'?'#faf6ed':'#f8f8f8'} stroke={accent} strokeWidth="1.5"/>
      {/* Box lid */}
      <rect x="15" y="45" width="190" height="25" rx="4" fill={accent} opacity="0.9"/>
      {/* Ribbon vertical */}
      <rect x="105" y="60" width="10" height="200" fill={accent} opacity="0.3"/>
      {/* Ribbon horizontal */}
      <rect x="20" y="148" width="180" height="10" fill={accent} opacity="0.3"/>
      {/* Ribbon bow */}
      <ellipse cx="110" cy="57" rx="20" ry="12" fill={accent} opacity="0.8"/>
      <ellipse cx="90" cy="52" rx="16" ry="9" fill={accent} opacity="0.7" transform="rotate(-20 90 52)"/>
      <ellipse cx="130" cy="52" rx="16" ry="9" fill={accent} opacity="0.7" transform="rotate(20 130 52)"/>
      <circle cx="110" cy="57" r="6" fill={accent}/>
      {/* Sticker area */}
      {stickerUrl ? (
        <>
          <rect x="75" y="90" width="70" height="110" rx="4" fill="#fff" stroke={accent} strokeWidth="1"/>
          <image href={stickerUrl} x="77" y="92" width="66" height="106" preserveAspectRatio="xMidYMid meet"/>
        </>
      ) : (
        <>
          <rect x="75" y="90" width="70" height="110" rx="4" fill="rgba(255,255,255,0.6)" stroke={accent} strokeWidth="0.8" strokeDasharray="4,3"/>
          <text x="110" y="140" fill={accent} fontSize="8" textAnchor="middle" fontFamily="serif" opacity="0.6">Your</text>
          <text x="110" y="152" fill={accent} fontSize="8" textAnchor="middle" fontFamily="serif" opacity="0.6">label</text>
          <text x="110" y="164" fill={accent} fontSize="8" textAnchor="middle" fontFamily="serif" opacity="0.6">here</text>
        </>
      )}
      {/* Green Emblem watermark */}
      <text x="110" y="275" fill={accent} fontSize="7" textAnchor="middle" fontFamily="serif" opacity="0.5">Green Emblem</text>
      {/* Bundle name on lid */}
      <text x="110" y="62" fill="#fff" fontSize="8" textAnchor="middle" fontFamily="serif" opacity="0.9">{bundleName}</text>
    </svg>
  )
}

export default function FavoursPage() {
  const supabase = createClient()

  // Step tracking
  const [step, setStep] = useState<1|2|3|4|5>(1)

  // Step 1 — Bundle
  const [selectedBundle, setSelectedBundle] = useState<typeof BUNDLES[0] | null>(null)

  // Step 2 — Box
  const [selectedBox, setSelectedBox] = useState(BOX_DESIGNS[0])

  // Step 3 — Items
  const [selectedFood, setSelectedFood] = useState<Record<string, string | true>>({}) // id -> variant or true
  const [selectedVanity, setSelectedVanity] = useState<Set<string>>(new Set())

  // Step 4 — Label
  const [stickerFile, setStickerFile] = useState<File | null>(null)
  const [stickerUrl, setStickerUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Step 5 — Quantity + checkout
  const [quantity, setQuantity] = useState(50)
  const [customMessage, setCustomMessage] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ── Pricing calculation ──────────────────────────────────────────────────────
  const foodSelected = Object.keys(selectedFood)
  const maxFood = selectedBundle?.maxFood || 3
  const includedFood = foodSelected.slice(0, maxFood)
  const extraFood = foodSelected.slice(maxFood)

  const basePricePerBag = selectedBundle?.basePrice || 0

  const extraFoodCost = extraFood.reduce((sum, id) => {
    const item = FOOD_ITEMS.find(f => f.id === id)
    return sum + (item?.extraPrice || 0)
  }, 0)

  const vanityCost = [...selectedVanity].reduce((sum, id) => {
    const item = VANITY_ITEMS.find(v => v.id === id)
    return sum + (item?.price || 0)
  }, 0)

  const boxExtra = selectedBox.extraPrice

  const pricePerBag = basePricePerBag + extraFoodCost + vanityCost + boxExtra
  const subtotal = pricePerBag * quantity
  const shippingEst = quantity <= 100 ? 45 : quantity <= 200 ? 75 : 110
  const total = subtotal + shippingEst

  // ── Food toggle ───────────────────────────────────────────────────────────────
  const toggleFood = (id: string, variant?: string) => {
    setSelectedFood(prev => {
      const next = { ...prev }
      if (next[id] !== undefined && !variant) {
        delete next[id]
      } else if (variant) {
        next[id] = variant
      } else {
        next[id] = true
      }
      return next
    })
  }

  // ── Sticker upload ────────────────────────────────────────────────────────────
  const handleStickerUpload = (file: File) => {
    setStickerFile(file)
    const reader = new FileReader()
    reader.onload = e => setStickerUrl(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  // ── Checkout ──────────────────────────────────────────────────────────────────
  const handleCheckout = async () => {
    setLoading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_type: 'favours',
          customer_email: user?.email || '',
          customer_name: user?.user_metadata?.full_name || '',
          event_type: selectedBundle?.occasion,
          bundle_quantity: quantity,
          custom_message: customMessage,
          shipping_method: 'ground',
          items: [
            ...foodSelected.map(id => {
              const item = FOOD_ITEMS.find(f => f.id === id)!
              const variant = selectedFood[id]
              return { product_id: id, name: `${item.name}${typeof variant === 'string' ? ` (${variant})` : ''}`, qty: quantity, price: extraFood.includes(id) ? item.extraPrice : 0 }
            }),
            ...([...selectedVanity].map(id => {
              const item = VANITY_ITEMS.find(v => v.id === id)!
              return { product_id: id, name: item.name, qty: quantity, price: item.price }
            })),
            { product_id: `box_${selectedBox.id}`, name: `Box: ${selectedBox.name}`, qty: quantity, price: selectedBox.extraPrice },
            { product_id: 'bundle_base', name: selectedBundle!.name, qty: quantity, price: selectedBundle!.basePrice },
          ],
        }),
      })
      const data = await res.json()
      if (data.checkoutUrl) window.location.href = data.checkoutUrl
      else setError(data.error || 'Something went wrong.')
    } catch { setError('Network error. Please try again.') }
    setLoading(false)
  }

  // ── Shared styles ─────────────────────────────────────────────────────────────
  const sectionTitle = (t: string, sub?: string) => (
    <div style={{ marginBottom:'20px' }}>
      <h2 style={{ fontFamily:'var(--font-cinzel)', fontSize:'10px', letterSpacing:'0.24em', color:'var(--gold)', display:'flex', alignItems:'center', gap:'10px' }}>
        {t}<span style={{ flex:1, height:'0.5px', background:'rgba(212,175,110,0.15)', display:'block' }}/>
      </h2>
      {sub && <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'rgba(255,255,255,0.4)', fontStyle:'italic', marginTop:'4px' }}>{sub}</div>}
    </div>
  )

  const stepBtn = (active: boolean) => ({
    fontFamily:'var(--font-cinzel)' as const, fontSize:'9px', letterSpacing:'0.12em',
    padding:'8px 18px', borderRadius:'7px', cursor:'pointer' as const, border:'none',
    background: active ? 'var(--gold)' : 'rgba(255,255,255,0.06)',
    color: active ? 'var(--forest-dark)' : 'rgba(255,255,255,0.4)',
    transition:'all 0.15s',
  })

  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ paddingTop:'88px', minHeight:'100dvh', position:'relative', zIndex:2 }}>

        {/* Hero */}
        <div style={{ textAlign:'center', padding:'48px 24px 40px', maxWidth:'580px', margin:'0 auto' }}>
          <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.28em', color:'var(--gold)', marginBottom:'14px' }}>Party Favours</div>
          <h1 style={{ fontFamily:'var(--font-cinzel)', fontSize:'clamp(28px,5vw,44px)', fontWeight:500, color:'#fff', marginBottom:'14px', lineHeight:1.15 }}>
            Curated with <span style={{ color:'var(--gold)' }}>intention</span>
          </h1>
          <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'17px', fontStyle:'italic', color:'rgba(255,255,255,0.55)', lineHeight:1.7 }}>
            Beautifully assembled favour bags for every blessed occasion. Orders from 50 units · 2-week production + shipping.
          </p>
        </div>

        {/* Step progress */}
        <div style={{ maxWidth:'900px', margin:'0 auto', padding:'0 24px 12px' }}>
          <div style={{ display:'flex', gap:'4px' }}>
            {['Bundle','Box','Items','Label','Order'].map((s, i) => (
              <div key={s} style={{ flex:1 }}>
                <div style={{ height:'3px', borderRadius:'2px', background: step > i+1 ? 'var(--gold)' : step === i+1 ? 'rgba(212,175,110,0.6)' : 'rgba(255,255,255,0.08)', marginBottom:'5px' }}/>
                <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.1em', color: step === i+1 ? 'var(--gold)' : 'rgba(255,255,255,0.25)', textAlign:'center' }}>{s}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ maxWidth:'900px', margin:'0 auto', padding:'0 24px 80px', display:'grid', gridTemplateColumns:'1fr 300px', gap:'24px', alignItems:'start' }}>

          {/* Left — steps */}
          <div>

            {/* ── STEP 1: Bundle ── */}
            {step === 1 && (
              <div>
                {sectionTitle('Step 1 — Choose your occasion')}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'10px' }}>
                  {BUNDLES.map(b => (
                    <button key={b.id} onClick={() => setSelectedBundle(b)} style={{ background: selectedBundle?.id===b.id ? 'rgba(46,107,46,0.2)' : 'rgba(255,255,255,0.03)', border:`0.5px solid ${selectedBundle?.id===b.id ? 'rgba(212,175,110,0.5)' : 'rgba(212,175,110,0.12)'}`, borderRadius:'10px', padding:'16px', textAlign:'left', cursor:'pointer', transition:'all 0.15s' }}>
                      <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'12px', fontWeight:500, color:'#fff', marginBottom:'5px' }}>{b.name}</div>
                      <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'rgba(255,255,255,0.5)', fontStyle:'italic', lineHeight:1.4, marginBottom:'8px' }}>{b.desc}</div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'11px', color:'var(--gold)' }}>${b.basePrice.toFixed(2)}/bag</span>
                        <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', color:'rgba(255,255,255,0.3)', letterSpacing:'0.08em' }}>up to {b.maxFood} food items</span>
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={() => selectedBundle && setStep(2)} disabled={!selectedBundle} style={{ ...stepBtn(!!selectedBundle), marginTop:'20px' }}>
                  Next: Choose box design →
                </button>
              </div>
            )}

            {/* ── STEP 2: Box design ── */}
            {step === 2 && (
              <div>
                {sectionTitle('Step 2 — Choose your box design')}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'20px' }}>
                  {BOX_DESIGNS.map(box => (
                    <button key={box.id} onClick={() => setSelectedBox(box)} style={{ background: selectedBox.id===box.id ? 'rgba(46,107,46,0.18)' : 'rgba(255,255,255,0.03)', border:`0.5px solid ${selectedBox.id===box.id ? box.color+'80' : 'rgba(212,175,110,0.12)'}`, borderRadius:'12px', padding:'16px', cursor:'pointer', textAlign:'center', transition:'all 0.15s' }}>
                      <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:box.color, margin:'0 auto 10px', opacity:0.85 }}/>
                      <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'13px', color:'#fff', marginBottom:'4px' }}>{box.name}</div>
                      <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'rgba(255,255,255,0.45)', fontStyle:'italic', lineHeight:1.4, marginBottom:'8px' }}>{box.desc}</div>
                      <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'11px', color:'var(--gold)' }}>
                        {box.extraPrice === 0 ? 'Included' : `+$${box.extraPrice.toFixed(2)}/bag`}
                      </div>
                    </button>
                  ))}
                </div>
                <div style={{ display:'flex', gap:'10px' }}>
                  <button onClick={() => setStep(1)} style={stepBtn(false)}>← Back</button>
                  <button onClick={() => setStep(3)} style={stepBtn(true)}>Next: Choose items →</button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Items ── */}
            {step === 3 && (
              <div>
                {/* Food items */}
                {sectionTitle(
                  `Step 3 — Food items (${selectedBundle!.name} includes ${selectedBundle!.maxFood})`,
                  `First ${selectedBundle!.maxFood} selections are included in your base price. Additional items charged extra.`
                )}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'10px', marginBottom:'28px' }}>
                  {FOOD_ITEMS.map((item, idx) => {
                    const isSelected = selectedFood[item.id] !== undefined
                    const position = foodSelected.indexOf(item.id)
                    const isIncluded = position >= 0 && position < selectedBundle!.maxFood
                    const isExtra = position >= selectedBundle!.maxFood

                    return (
                      <div key={item.id} style={{ background: isSelected ? 'rgba(46,107,46,0.15)' : 'rgba(255,255,255,0.03)', border:`0.5px solid ${isSelected ? (isExtra ? 'rgba(212,175,110,0.5)' : 'rgba(46,107,46,0.5)') : 'rgba(212,175,110,0.12)'}`, borderRadius:'10px', padding:'14px', transition:'all 0.15s', position:'relative' as const }}>
                        {isIncluded && <div style={{ position:'absolute', top:'10px', right:'10px', width:'16px', height:'16px', borderRadius:'50%', background:'#1D9E75', display:'flex', alignItems:'center', justifyContent:'center' }}><svg width="9" height="7" viewBox="0 0 9 7"><polyline points="1,3.5 3.5,6 8,1" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg></div>}
                        {isExtra && <div style={{ position:'absolute', top:'8px', right:'8px', fontFamily:'var(--font-cinzel)', fontSize:'8px', color:'var(--gold)', background:'rgba(212,175,110,0.1)', padding:'2px 7px', borderRadius:'10px' }}>+extra</div>}
                        <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'12px', color:'#fff', marginBottom:'4px' }}>{item.name}</div>
                        <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'rgba(255,255,255,0.45)', fontStyle:'italic', lineHeight:1.4, marginBottom:'10px' }}>{item.desc}</div>

                        {item.hasVariant ? (
                          <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', marginBottom:'8px' }}>
                            {item.variants.map(v => (
                              <button key={v} onClick={() => toggleFood(item.id, v)} style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.06em', padding:'4px 9px', borderRadius:'100px', cursor:'pointer', background: selectedFood[item.id]===v ? 'var(--gold)' : 'rgba(255,255,255,0.06)', color: selectedFood[item.id]===v ? 'var(--forest-dark)' : 'rgba(255,255,255,0.5)', border:`0.5px solid ${selectedFood[item.id]===v ? 'var(--gold)' : 'rgba(255,255,255,0.12)'}` }}>
                                {v}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <button onClick={() => toggleFood(item.id)} style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.1em', padding:'6px 14px', borderRadius:'7px', cursor:'pointer', background: isSelected ? (isExtra ? 'rgba(212,175,110,0.12)' : 'rgba(46,107,46,0.2)') : 'rgba(255,255,255,0.05)', color: isSelected ? '#fff' : 'rgba(255,255,255,0.5)', border:`0.5px solid ${isSelected ? 'rgba(212,175,110,0.3)' : 'rgba(255,255,255,0.1)'}` }}>
                            {isSelected ? 'Remove' : 'Add'}
                          </button>
                        )}

                        <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', color: isIncluded ? '#1D9E75' : 'var(--gold)', marginTop:'4px' }}>
                          {isIncluded ? '✓ Included' : isExtra ? `+$${item.extraPrice.toFixed(2)}/bag` : `+$${item.extraPrice.toFixed(2)}/bag if over limit`}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Vanity items */}
                {sectionTitle('Vanity add-ons', 'Always charged per bag — premium keepsakes.')}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'10px', marginBottom:'24px' }}>
                  {VANITY_ITEMS.map(item => {
                    const isSelected = selectedVanity.has(item.id)
                    return (
                      <button key={item.id} onClick={() => setSelectedVanity(prev => { const next = new Set(prev); isSelected ? next.delete(item.id) : next.add(item.id); return next })}
                        style={{ background: isSelected ? 'rgba(159,142,196,0.12)' : 'rgba(255,255,255,0.03)', border:`0.5px solid ${isSelected ? 'rgba(159,142,196,0.5)' : 'rgba(212,175,110,0.12)'}`, borderRadius:'10px', padding:'14px', cursor:'pointer', textAlign:'left', transition:'all 0.15s', position:'relative' as const }}>
                        {isSelected && <div style={{ position:'absolute', top:'10px', right:'10px', width:'16px', height:'16px', borderRadius:'50%', background:'#9b8ec4', display:'flex', alignItems:'center', justifyContent:'center' }}><svg width="9" height="7" viewBox="0 0 9 7"><polyline points="1,3.5 3.5,6 8,1" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg></div>}
                        <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'12px', color:'#fff', marginBottom:'4px' }}>{item.name}</div>
                        <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'rgba(255,255,255,0.45)', fontStyle:'italic', lineHeight:1.4, marginBottom:'8px' }}>{item.desc}</div>
                        <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'11px', color:'#9b8ec4' }}>+${item.price.toFixed(2)}/bag</div>
                      </button>
                    )
                  })}
                </div>

                <div style={{ display:'flex', gap:'10px' }}>
                  <button onClick={() => setStep(2)} style={stepBtn(false)}>← Back</button>
                  <button onClick={() => setStep(4)} style={stepBtn(true)}>Next: Custom label →</button>
                </div>
              </div>
            )}

            {/* ── STEP 4: Custom label ── */}
            {step === 4 && (
              <div>
                {sectionTitle('Step 4 — Custom label / sticker', 'Upload your design. We\'ll print it as a tall rectangular sticker on the front of your box.')}

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', alignItems:'start' }}>
                  {/* Upload area */}
                  <div>
                    <label style={{ display:'block', background:'rgba(255,255,255,0.03)', border:'0.5px dashed rgba(212,175,110,0.3)', borderRadius:'12px', padding:'32px 20px', textAlign:'center', cursor:'pointer', transition:'all 0.15s' }}>
                      <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleStickerUpload(f) }}/>
                      {stickerUrl ? (
                        <img src={stickerUrl} alt="Your sticker" style={{ maxWidth:'100px', maxHeight:'160px', borderRadius:'6px', objectFit:'contain', display:'block', margin:'0 auto 12px' }}/>
                      ) : (
                        <div>
                          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ margin:'0 auto 10px', display:'block' }}><rect x="4" y="4" width="32" height="32" rx="4" stroke="#d4af6e" strokeWidth="1" opacity="0.4"/><path d="M20 14v12M14 20h12" stroke="#d4af6e" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/></svg>
                          <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'10px', letterSpacing:'0.12em', color:'rgba(255,255,255,0.4)' }}>Upload sticker design</div>
                          <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'rgba(255,255,255,0.25)', fontStyle:'italic', marginTop:'5px' }}>PNG, JPG — rectangular format recommended</div>
                        </div>
                      )}
                      {stickerUrl && <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.1em', color:'var(--gold)', marginTop:'8px' }}>Click to change</div>}
                    </label>
                    {stickerUrl && (
                      <button onClick={() => { setStickerUrl(null); setStickerFile(null) }} style={{ width:'100%', marginTop:'8px', fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.1em', color:'rgba(255,255,255,0.4)', background:'transparent', border:'0.5px solid rgba(255,255,255,0.1)', borderRadius:'7px', padding:'8px', cursor:'pointer' }}>
                        Remove sticker
                      </button>
                    )}
                  </div>

                  {/* Box preview */}
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'8.5px', letterSpacing:'0.16em', color:'rgba(255,255,255,0.35)', marginBottom:'12px' }}>Box preview</div>
                    <BoxPreview boxDesign={selectedBox} stickerUrl={stickerUrl} bundleName={selectedBundle?.name || ''}/>
                    <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'11px', color:'rgba(255,255,255,0.25)', fontStyle:'italic', marginTop:'8px' }}>
                      {selectedBox.name} box · {stickerUrl ? 'Custom sticker applied' : 'No sticker'}
                    </div>
                  </div>
                </div>

                <div style={{ background:'rgba(212,175,110,0.06)', border:'0.5px solid rgba(212,175,110,0.15)', borderRadius:'8px', padding:'12px 14px', marginTop:'16px', fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'rgba(255,255,255,0.45)', fontStyle:'italic', lineHeight:1.6 }}>
                  Sticker is optional. If skipped, the box will feature the Green Emblem logo. Custom sticker design files are shared securely with our print partner and deleted after production.
                </div>

                <div style={{ display:'flex', gap:'10px', marginTop:'16px' }}>
                  <button onClick={() => setStep(3)} style={stepBtn(false)}>← Back</button>
                  <button onClick={() => setStep(5)} style={stepBtn(true)}>Next: Quantity & order →</button>
                </div>
              </div>
            )}

            {/* ── STEP 5: Quantity + checkout ── */}
            {step === 5 && (
              <div>
                {sectionTitle('Step 5 — Quantity')}
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'20px' }}>
                  {QTY_STEPS.map(q => (
                    <button key={q} onClick={() => setQuantity(q)} style={{ fontFamily:'var(--font-cinzel)', fontSize:'12px', letterSpacing:'0.1em', padding:'10px 20px', borderRadius:'100px', background: quantity===q ? 'var(--gold)' : 'transparent', color: quantity===q ? 'var(--forest-dark)' : 'var(--gold)', border:`0.5px solid ${quantity===q ? 'var(--gold)' : 'rgba(212,175,110,0.3)'}`, cursor:'pointer' }}>
                      {q} bags
                    </button>
                  ))}
                </div>

                {sectionTitle('Personalisation (optional)')}
                <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'20px' }}>
                  <div>
                    <label style={{ fontFamily:'var(--font-cinzel)', fontSize:'8.5px', letterSpacing:'0.18em', color:'rgba(255,255,255,0.35)', display:'block', marginBottom:'7px' }}>Insert card message</label>
                    <textarea className="ge-input" rows={2} value={customMessage} onChange={e => setCustomMessage(e.target.value)} placeholder="e.g. With love from Aisha & Ibrahim · April 2026" style={{ resize:'vertical' as const, lineHeight:1.5 }}/>
                  </div>
                  <div>
                    <label style={{ fontFamily:'var(--font-cinzel)', fontSize:'8.5px', letterSpacing:'0.18em', color:'rgba(255,255,255,0.35)', display:'block', marginBottom:'7px' }}>Event date</label>
                    <input type="date" className="ge-input" value={eventDate} onChange={e => setEventDate(e.target.value)} style={{ colorScheme:'dark' as const }}/>
                  </div>
                </div>

                {error && <div style={{ background:'rgba(226,75,74,0.1)', border:'0.5px solid rgba(226,75,74,0.25)', borderRadius:'8px', padding:'10px 14px', marginBottom:'12px', fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'#e24b4a' }}>{error}</div>}

                <div style={{ display:'flex', gap:'10px' }}>
                  <button onClick={() => setStep(4)} style={stepBtn(false)}>← Back</button>
                  <button onClick={handleCheckout} disabled={loading} style={{ ...stepBtn(true), flex:2, opacity:loading?0.6:1, cursor:loading?'not-allowed':'pointer' }}>
                    {loading ? 'Preparing checkout…' : 'Proceed to checkout'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right — sticky order summary ── */}
          <div style={{ position:'sticky', top:'88px' }}>
            <div style={{ background:'rgba(15,31,15,0.6)', border:'0.5px solid rgba(212,175,110,0.15)', borderRadius:'16px', padding:'22px', backdropFilter:'blur(8px)' }}>
              <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.22em', color:'var(--gold)', marginBottom:'16px' }}>Order Summary</div>

              {selectedBundle && (
                <div style={{ marginBottom:'12px', paddingBottom:'12px', borderBottom:'0.5px solid rgba(212,175,110,0.1)' }}>
                  <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'12px', color:'#fff', marginBottom:'2px' }}>{selectedBundle.name}</div>
                  <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'rgba(255,255,255,0.4)', fontStyle:'italic' }}>{selectedBundle.occasion} · {quantity} bags</div>
                </div>
              )}

              {/* Box */}
              {step >= 2 && (
                <div style={{ marginBottom:'8px', display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'rgba(255,255,255,0.6)', fontStyle:'italic' }}>Box: {selectedBox.name}</span>
                  <span style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color: selectedBox.extraPrice > 0 ? 'var(--gold)' : 'rgba(255,255,255,0.4)' }}>
                    {selectedBox.extraPrice > 0 ? `+$${selectedBox.extraPrice.toFixed(2)}/bag` : 'Included'}
                  </span>
                </div>
              )}

              {/* Food items */}
              {step >= 3 && foodSelected.length > 0 && (
                <div style={{ marginBottom:'8px', paddingBottom:'8px', borderBottom:'0.5px solid rgba(212,175,110,0.08)' }}>
                  <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.12em', color:'rgba(255,255,255,0.3)', marginBottom:'6px' }}>Food items</div>
                  {foodSelected.map((id, i) => {
                    const item = FOOD_ITEMS.find(f => f.id === id)!
                    const variant = selectedFood[id]
                    const isExtra = i >= selectedBundle!.maxFood
                    return (
                      <div key={id} style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                        <span style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'rgba(255,255,255,0.65)' }}>
                          {item.name}{typeof variant === 'string' ? ` (${variant})` : ''}
                        </span>
                        <span style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color: isExtra ? 'var(--gold)' : '#1D9E75' }}>
                          {isExtra ? `+$${item.extraPrice.toFixed(2)}` : '✓'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Vanity items */}
              {step >= 3 && selectedVanity.size > 0 && (
                <div style={{ marginBottom:'8px', paddingBottom:'8px', borderBottom:'0.5px solid rgba(212,175,110,0.08)' }}>
                  <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.12em', color:'rgba(255,255,255,0.3)', marginBottom:'6px' }}>Vanity add-ons</div>
                  {[...selectedVanity].map(id => {
                    const item = VANITY_ITEMS.find(v => v.id === id)!
                    return (
                      <div key={id} style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                        <span style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'rgba(255,255,255,0.65)' }}>{item.name}</span>
                        <span style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'#9b8ec4' }}>+${item.price.toFixed(2)}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Sticker */}
              {step >= 4 && stickerUrl && (
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
                  <span style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'rgba(255,255,255,0.65)', fontStyle:'italic' }}>Custom sticker</span>
                  <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', color:'#1D9E75', letterSpacing:'0.06em' }}>✓ Uploaded</span>
                </div>
              )}

              {/* Price breakdown */}
              <div style={{ borderTop:'0.5px solid rgba(212,175,110,0.12)', paddingTop:'12px', marginTop:'8px', display:'flex', flexDirection:'column', gap:'6px' }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'rgba(255,255,255,0.55)', fontStyle:'italic' }}>{quantity} bags × ${pricePerBag.toFixed(2)}</span>
                  <span style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'#fff' }}>${subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'rgba(255,255,255,0.55)', fontStyle:'italic' }}>Est. shipping</span>
                  <span style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'#fff' }}>~${shippingEst}</span>
                </div>
                <div style={{ borderTop:'0.5px solid rgba(212,175,110,0.12)', paddingTop:'8px', display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'11px', color:'#fff' }}>Estimated total</span>
                  <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'20px', color:'var(--gold-light)' }}>${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Price breakdown detail */}
              {selectedBundle && (
                <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'8px', padding:'10px', marginTop:'10px', fontFamily:'var(--font-cormorant)', fontSize:'11px', color:'rgba(255,255,255,0.35)', lineHeight:1.7, fontStyle:'italic' }}>
                  ${selectedBundle.basePrice.toFixed(2)} base
                  {boxExtra > 0 && ` + $${boxExtra.toFixed(2)} box`}
                  {extraFoodCost > 0 && ` + $${extraFoodCost.toFixed(2)} extra food`}
                  {vanityCost > 0 && ` + $${vanityCost.toFixed(2)} vanity`}
                  {' '}= ${pricePerBag.toFixed(2)}/bag
                </div>
              )}

              <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'11px', color:'rgba(255,255,255,0.25)', marginTop:'10px', fontStyle:'italic', lineHeight:1.6 }}>
                Final pricing confirmed at checkout. Orders take a minimum of 2 weeks. Non-refundable once packed.
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
