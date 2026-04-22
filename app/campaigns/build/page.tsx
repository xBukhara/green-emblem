'use client'
import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Nav from '@/components/Nav'

const THEMES = [
  { id: 'forest_gold', label: 'Forest & Gold',       bg: '#1a3d1a', accent: '#d4af6e', preview: ['#1a3d1a','#d4af6e','#f5f0e6'] },
  { id: 'navy_gold',   label: 'Navy & Gold',          bg: '#0d1b2e', accent: '#d4af6e', preview: ['#0d1b2e','#d4af6e','#ffffff'] },
  { id: 'burgundy',    label: 'Burgundy & Cream',     bg: '#2d0c12', accent: '#c9956c', preview: ['#2d0c12','#c9956c','#f5f0e6'] },
  { id: 'purple',      label: 'Violet & Silver',      bg: '#1a0d2e', accent: '#9b8ec4', preview: ['#1a0d2e','#9b8ec4','#ffffff'] },
  { id: 'terracotta',  label: 'Terracotta & Sage',    bg: '#2d1a0d', accent: '#8fad8a', preview: ['#2d1a0d','#8fad8a','#f5f0e6'] },
  { id: 'charcoal',    label: 'Charcoal & Rose Gold', bg: '#1a1a1a', accent: '#c4906a', preview: ['#1a1a1a','#c4906a','#ffffff'] },
]

const PATTERNS = [
  { id: 'star8',      label: '8-pointed star' },
  { id: 'arabesque',  label: 'Arabesque vines' },
  { id: 'geometric',  label: 'Geometric tile' },
  { id: 'none',       label: 'Clean / minimal' },
]

const VERSES = [
  { id: 'tirmidhi_shade', label: 'Shade of generosity', preview: 'The generous person is close to Allah, close to people…' },
  { id: 'quran_2_272',    label: 'Quran 2:272',          preview: 'Whatever good you give is for yourselves…' },
  { id: 'tirmidhi_fire',  label: 'Shield from fire',     preview: 'Save yourself from the fire even with half a date…' },
  { id: 'custom',         label: 'Write my own',         preview: '' },
]

export default function CampaignBuilderPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'16px', color:'rgba(255,255,255,0.4)', fontStyle:'italic' }}>
          Verifying your link…
        </div>
      </div>
    }>
      <CampaignBuilderInner />
    </Suspense>
  )
}

function CampaignBuilderInner() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [slug, setSlug] = useState('')
  const [campaignCreated, setCampaignCreated] = useState(false)
  const [qrUrl, setQrUrl] = useState('')

  const [honoreeNames, setHonoreeNames] = useState('')
  const [eventType, setEventType] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [location, setLocation] = useState('')
  const [theme, setTheme] = useState(THEMES[0])
  const [pattern, setPattern] = useState(PATTERNS[0])
  const [verse, setVerse] = useState(VERSES[0])
  const [customVerse, setCustomVerse] = useState('')
  const [greetingText, setGreetingText] = useState('')

  useEffect(() => {
    if (!token) { setTokenValid(false); return }
    fetch(`/api/campaigns/validate-token?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setTokenValid(true)
          setHonoreeNames(data.request?.honoree_names || '')
          setEventType(data.request?.event_type || '')
          setEventDate(data.request?.event_date || '')
          setGreetingText(`Welcome to the blessed ${data.request?.event_type || 'celebration'} of ${data.request?.honoree_names || ''}`)
        } else {
          setTokenValid(false)
        }
      })
      .catch(() => setTokenValid(false))
  }, [token])

  const handleCreate = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token, honoree_names: honoreeNames, event_type: eventType,
          event_date: eventDate, location,
          theme: { color_scheme: theme.id, bg: theme.bg, accent: theme.accent, pattern: pattern.id, verse: verse.id, custom_verse: verse.id === 'custom' ? customVerse : null, greeting_text: greetingText },
        }),
      })
      const data = await res.json()
      if (data.campaign) {
        setSlug(data.campaign.slug)
        setCampaignCreated(true)
        setQrUrl(`/api/campaigns/${data.campaign.slug}/qr`)
      } else {
        setError(data.error || 'Something went wrong.')
      }
    } catch { setError('Network error. Please try again.') }
    finally { setSaving(false) }
  }

  const lbl = (t: string) => (
    <label style={{ fontFamily:'var(--font-cinzel)', fontSize:'8.5px', letterSpacing:'0.18em', color:'rgba(255,255,255,0.35)', display:'block', marginBottom:'7px' }}>{t}</label>
  )

  if (tokenValid === false) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', textAlign:'center' }}>
      <div style={{ maxWidth:'400px' }}>
        <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'18px', color:'#fff', marginBottom:'12px' }}>Invalid or expired link</div>
        <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'15px', color:'rgba(255,255,255,0.45)', fontStyle:'italic', lineHeight:1.7 }}>
          This link is no longer valid. Please contact us and we'll send a new one.
        </p>
        <a href="/contact" style={{ display:'inline-block', marginTop:'20px', fontFamily:'var(--font-cinzel)', fontSize:'10px', letterSpacing:'0.14em', color:'var(--forest-dark)', background:'var(--gold)', padding:'12px 24px', borderRadius:'8px', textDecoration:'none' }}>
          Contact us
        </a>
      </div>
    </div>
  )

  if (tokenValid === null) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'16px', color:'rgba(255,255,255,0.4)', fontStyle:'italic' }}>Verifying your link…</div>
    </div>
  )

  if (campaignCreated) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', textAlign:'center', position:'relative', zIndex:2 }}>
      <div className="bg-tile" aria-hidden="true"/>
      <div style={{ maxWidth:'480px', background:'rgba(15,31,15,0.7)', border:'0.5px solid rgba(212,175,110,0.25)', borderRadius:'20px', padding:'40px 36px', backdropFilter:'blur(12px)' }}>
        <div style={{ width:'64px', height:'64px', borderRadius:'50%', background:'rgba(46,107,46,0.15)', border:'0.5px solid rgba(46,107,46,0.4)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><polyline points="6,14 11,20 22,8" stroke="#4a9e4a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <h1 style={{ fontFamily:'var(--font-cinzel)', fontSize:'22px', fontWeight:500, color:'#fff', marginBottom:'10px' }}>Campaign created!</h1>
        <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'15px', fontStyle:'italic', color:'rgba(255,255,255,0.5)', lineHeight:1.7, marginBottom:'24px' }}>
          Your Baab As-Sadaqah campaign is ready. Share the link or QR code at your event.
        </p>
        <div style={{ background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(212,175,110,0.2)', borderRadius:'8px', padding:'12px 14px', marginBottom:'16px', display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontFamily:'var(--font-cormorant)', fontSize:'14px', color:'#fff', flex:1, textAlign:'left', wordBreak:'break-all' }}>
            green-emblem.com/give/{slug}
          </span>
          <button onClick={() => navigator.clipboard.writeText(`https://green-emblem.com/give/${slug}`)}
            style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.1em', color:'var(--gold)', background:'none', border:'0.5px solid rgba(212,175,110,0.3)', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', whiteSpace:'nowrap' }}>
            Copy
          </button>
        </div>
        <a href={qrUrl} download={`green-emblem-qr-${slug}.png`}
          style={{ display:'block', width:'100%', fontFamily:'var(--font-cinzel)', fontSize:'11px', letterSpacing:'0.16em', color:'var(--forest-dark)', background:'var(--gold)', borderRadius:'10px', padding:'14px', textDecoration:'none', marginBottom:'10px', textAlign:'center' }}>
          Download QR code (PNG)
        </a>
        <a href={`/give/${slug}`}
          style={{ display:'block', width:'100%', fontFamily:'var(--font-cinzel)', fontSize:'11px', letterSpacing:'0.16em', color:'var(--gold)', border:'0.5px solid rgba(212,175,110,0.4)', borderRadius:'10px', padding:'14px', textDecoration:'none', textAlign:'center' }}>
          Preview campaign page
        </a>
      </div>
    </div>
  )

  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ paddingTop:'88px', minHeight:'100dvh', position:'relative', zIndex:2 }}>
        <div style={{ maxWidth:'680px', margin:'0 auto', padding:'40px 24px 80px' }}>
          <div style={{ textAlign:'center', marginBottom:'40px' }}>
            <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.28em', color:'var(--gold)', marginBottom:'14px' }}>Baab As-Sadaqah</div>
            <h1 style={{ fontFamily:'var(--font-cinzel)', fontSize:'clamp(24px,4vw,36px)', fontWeight:500, color:'#fff', lineHeight:1.15, marginBottom:'10px' }}>Build your campaign</h1>
            <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'16px', fontStyle:'italic', color:'rgba(255,255,255,0.5)', lineHeight:1.7 }}>
              Customise your giving page. Your guests scan a QR code at the event and donate directly to charity.
            </p>
          </div>

          <div style={{ display:'flex', gap:'4px', marginBottom:'32px' }}>
            {['Event details','Choose theme','Verse & greeting','Review'].map((s,i) => (
              <div key={s} style={{ flex:1, height:'3px', borderRadius:'2px', background: step > i+1 ? 'var(--gold)' : step === i+1 ? 'rgba(212,175,110,0.6)' : 'rgba(255,255,255,0.08)' }}/>
            ))}
          </div>

          {error && (
            <div style={{ background:'rgba(226,75,74,0.1)', border:'0.5px solid rgba(226,75,74,0.25)', borderRadius:'8px', padding:'12px 16px', marginBottom:'20px', fontFamily:'var(--font-cormorant)', fontSize:'14px', color:'#e24b4a' }}>
              {error}
            </div>
          )}

          {step === 1 && (
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              <h2 style={{ fontFamily:'var(--font-cinzel)', fontSize:'13px', color:'#fff', marginBottom:'4px' }}>Event details</h2>
              <div>{lbl('Names to honour')}<input type="text" value={honoreeNames} onChange={e=>setHonoreeNames(e.target.value)} placeholder="e.g. Aisha & Ibrahim" className="ge-input"/></div>
              <div>{lbl('Event type')}
                <select value={['Nikkah','Walima','Aqiqah','Eid','Graduation','Anniversary'].includes(eventType) ? eventType : eventType ? 'Other' : ''} onChange={e => { if (e.target.value !== 'Other') setEventType(e.target.value); else setEventType('') }} style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(212,175,110,0.18)', borderRadius:'8px', padding:'12px 14px', fontFamily:'var(--font-cormorant)', fontSize:'16px', color: eventType ? '#fff' : 'rgba(255,255,255,0.35)', outline:'none', appearance:'none', cursor:'pointer', marginBottom:'8px' }}>
                  <option value="">Select event type…</option>
                  {['Nikkah','Walima','Aqiqah','Eid','Graduation','Anniversary','Other'].map(t=><option key={t} value={t}>{t}</option>)}
                </select>
                {(!['Nikkah','Walima','Aqiqah','Eid','Graduation','Anniversary'].includes(eventType) && (eventType !== '' || false)) || (!['Nikkah','Walima','Aqiqah','Eid','Graduation','Anniversary',''].includes(eventType)) ? (
                  <input type="text" value={eventType} onChange={e => setEventType(e.target.value)} placeholder="e.g. Shaadi Ceremony, Mehndi, Khitaan…" className="ge-input"/>
                ) : null}
              </div>
              <div>{lbl('Event date')}<input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)} className="ge-input" style={{ colorScheme:'dark' }}/></div>
              <div>{lbl('Venue / location (optional)')}<input type="text" value={location} onChange={e=>setLocation(e.target.value)} placeholder="e.g. The Grand Ballroom, Queens NY" className="ge-input"/></div>
              <button onClick={()=>setStep(2)} disabled={!honoreeNames||!eventType} className="btn-gold" style={{ marginTop:'8px', opacity:(!honoreeNames||!eventType)?0.4:1, cursor:(!honoreeNames||!eventType)?'not-allowed':'pointer' }}>
                Next: Choose theme →
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 style={{ fontFamily:'var(--font-cinzel)', fontSize:'13px', color:'#fff', marginBottom:'16px' }}>Choose a colour theme</h2>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'10px', marginBottom:'24px' }}>
                {THEMES.map(t=>(
                  <button key={t.id} onClick={()=>setTheme(t)} style={{ background:'transparent', border:`0.5px solid ${theme.id===t.id?'rgba(212,175,110,0.6)':'rgba(255,255,255,0.1)'}`, borderRadius:'10px', padding:'14px', cursor:'pointer', textAlign:'left' }}>
                    <div style={{ display:'flex', gap:'5px', marginBottom:'8px' }}>
                      {t.preview.map((c,i)=><div key={i} style={{ width:'18px', height:'18px', borderRadius:'50%', background:c, border:'0.5px solid rgba(255,255,255,0.1)' }}/>)}
                    </div>
                    <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'10px', letterSpacing:'0.08em', color: theme.id===t.id?'var(--gold)':'rgba(255,255,255,0.6)' }}>{t.label}</div>
                  </button>
                ))}
              </div>
              <h2 style={{ fontFamily:'var(--font-cinzel)', fontSize:'13px', color:'#fff', marginBottom:'12px' }}>Background pattern</h2>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'8px', marginBottom:'24px' }}>
                {PATTERNS.map(p=>(
                  <button key={p.id} onClick={()=>setPattern(p)} style={{ background: pattern.id===p.id?'rgba(46,107,46,0.15)':'rgba(255,255,255,0.03)', border:`0.5px solid ${pattern.id===p.id?'rgba(212,175,110,0.5)':'rgba(255,255,255,0.1)'}`, borderRadius:'8px', padding:'12px', cursor:'pointer', fontFamily:'var(--font-cormorant)', fontSize:'14px', color: pattern.id===p.id?'#fff':'rgba(255,255,255,0.5)', textAlign:'left' }}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={()=>setStep(1)} className="btn-outline" style={{ flex:1 }}>← Back</button>
                <button onClick={()=>setStep(3)} className="btn-gold" style={{ flex:2 }}>Next: Verse & greeting →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              <h2 style={{ fontFamily:'var(--font-cinzel)', fontSize:'13px', color:'#fff', marginBottom:'4px' }}>Choose a verse</h2>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {VERSES.map(v=>(
                  <button key={v.id} onClick={()=>setVerse(v)} style={{ background: verse.id===v.id?'rgba(46,107,46,0.15)':'rgba(255,255,255,0.03)', border:`0.5px solid ${verse.id===v.id?'rgba(212,175,110,0.4)':'rgba(255,255,255,0.08)'}`, borderRadius:'10px', padding:'14px', cursor:'pointer', textAlign:'left' }}>
                    <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'11px', color: verse.id===v.id?'#fff':'rgba(255,255,255,0.55)', marginBottom: v.preview?'5px':0 }}>{v.label}</div>
                    {v.preview && <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'rgba(255,255,255,0.35)', fontStyle:'italic' }}>{v.preview}</div>}
                  </button>
                ))}
              </div>
              {verse.id==='custom' && (
                <div>{lbl("Your verse or du'a (English)")}<textarea value={customVerse} onChange={e=>setCustomVerse(e.target.value)} placeholder="Enter your chosen verse or du'a…" className="ge-input" rows={3} style={{ resize:'vertical' }}/></div>
              )}
              <div>
                {lbl('Greeting message shown on campaign page')}
                <textarea value={greetingText} onChange={e=>setGreetingText(e.target.value)} className="ge-input" rows={2} style={{ resize:'vertical' }}/>
              </div>
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={()=>setStep(2)} className="btn-outline" style={{ flex:1 }}>← Back</button>
                <button onClick={()=>setStep(4)} className="btn-gold" style={{ flex:2 }}>Review →</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 style={{ fontFamily:'var(--font-cinzel)', fontSize:'13px', color:'#fff', marginBottom:'20px' }}>Review your campaign</h2>
              <div style={{ background:'rgba(15,31,15,0.6)', border:'0.5px solid rgba(212,175,110,0.2)', borderRadius:'14px', overflow:'hidden', marginBottom:'20px' }}>
                <div style={{ height:'8px', background:`linear-gradient(90deg,${theme.bg},${theme.accent})` }}/>
                <div style={{ padding:'20px' }}>
                  <div style={{ display:'flex', gap:'6px', marginBottom:'12px' }}>
                    {theme.preview.map((c,i)=><div key={i} style={{ width:'16px', height:'16px', borderRadius:'50%', background:c }}/>)}
                    <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'10px', color:'rgba(255,255,255,0.4)', marginLeft:'4px' }}>{theme.label}</span>
                  </div>
                  {[
                    { label:'Honourees', val:honoreeNames },
                    { label:'Event', val:eventType },
                    { label:'Date', val:eventDate||'Not specified' },
                    { label:'Location', val:location||'Not specified' },
                    { label:'Pattern', val:pattern.label },
                    { label:'Verse', val:verse.label },
                    { label:'Greeting', val:greetingText },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ display:'flex', gap:'12px', marginBottom:'8px' }}>
                      <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.12em', color:'rgba(255,255,255,0.3)', minWidth:'80px', paddingTop:'2px' }}>{label}</span>
                      <span style={{ fontFamily:'var(--font-cormorant)', fontSize:'14px', color:'rgba(255,255,255,0.7)' }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background:'rgba(212,175,110,0.06)', border:'0.5px solid rgba(212,175,110,0.15)', borderRadius:'8px', padding:'12px 14px', marginBottom:'20px', fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'rgba(255,255,255,0.45)', fontStyle:'italic', lineHeight:1.6 }}>
                Once submitted, your campaign will be reviewed within a few hours. You'll receive a confirmation email with your live link and QR code.
              </div>
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={()=>setStep(3)} className="btn-outline" style={{ flex:1 }}>← Back</button>
                <button onClick={handleCreate} disabled={saving} className="btn-gold" style={{ flex:2, opacity:saving?0.6:1, cursor:saving?'not-allowed':'pointer' }}>
                  {saving?'Creating campaign…':'Create campaign'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
