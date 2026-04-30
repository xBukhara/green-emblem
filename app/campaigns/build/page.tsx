'use client'
import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Nav from '@/components/Nav'

const THEMES = [
  { id:'forest_gold', label:'Forest & Gold',       bg:'#0f1f0f', accent:'#d4af6e', preview:['#0f1f0f','#d4af6e','#f5f0e6'] },
  { id:'navy_gold',   label:'Navy & Gold',          bg:'#0a1628', accent:'#d4af6e', preview:['#0a1628','#d4af6e','#ffffff'] },
  { id:'burgundy',    label:'Burgundy & Cream',     bg:'#1a0508', accent:'#c9956c', preview:['#1a0508','#c9956c','#f5f0e6'] },
  { id:'purple',      label:'Violet & Silver',      bg:'#120a1e', accent:'#9b8ec4', preview:['#120a1e','#9b8ec4','#ffffff'] },
  { id:'terracotta',  label:'Terracotta & Sage',    bg:'#1a0f08', accent:'#8fad8a', preview:['#1a0f08','#8fad8a','#f5f0e6'] },
  { id:'charcoal',    label:'Charcoal & Rose Gold', bg:'#1a1a1a', accent:'#c4906a', preview:['#1a1a1a','#c4906a','#ffffff'] },
]
const PATTERNS = [
  { id:'star8', label:'8-pointed star' },
  { id:'arabesque', label:'Arabesque vines' },
  { id:'geometric', label:'Geometric tile' },
  { id:'none', label:'Clean / minimal' },
]
const VERSES = [
  { id:'tirmidhi_shade', label:'Shade of generosity', preview:'The generous person is close to Allah…' },
  { id:'quran_2_272',    label:'Quran 2:272',          preview:'Whatever good you give is for yourselves…' },
  { id:'tirmidhi_fire',  label:'Shield from fire',     preview:'Save yourself from the fire even with half a date…' },
  { id:'custom',         label:'Write my own',         preview:'' },
]

function PatternBg({type,accent}:{type:string;accent:string}) {
  if(type==='none')return null
  if(type==='star8')return <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:0.07,pointerEvents:'none'}}><defs><pattern id="s8" width="80" height="80" patternUnits="userSpaceOnUse"><g fill="none" stroke={accent} strokeWidth="0.8"><rect x="20" y="20" width="40" height="40" rx="2"/><rect x="20" y="20" width="40" height="40" rx="2" transform="rotate(45 40 40)"/></g></pattern></defs><rect width="100%" height="100%" fill="url(#s8)"/></svg>
  if(type==='arabesque')return <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:0.07,pointerEvents:'none'}}><defs><pattern id="ab" width="60" height="60" patternUnits="userSpaceOnUse"><circle cx="30" cy="30" r="20" fill="none" stroke={accent} strokeWidth="0.7"/><circle cx="30" cy="30" r="10" fill="none" stroke={accent} strokeWidth="0.5"/><line x1="10" y1="30" x2="50" y2="30" stroke={accent} strokeWidth="0.4"/><line x1="30" y1="10" x2="30" y2="50" stroke={accent} strokeWidth="0.4"/></pattern></defs><rect width="100%" height="100%" fill="url(#ab)"/></svg>
  return <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:0.07,pointerEvents:'none'}}><defs><pattern id="ge" width="50" height="50" patternUnits="userSpaceOnUse"><polygon points="25,5 45,15 45,35 25,45 5,35 5,15" fill="none" stroke={accent} strokeWidth="0.6"/></pattern></defs><rect width="100%" height="100%" fill="url(#ge)"/></svg>
}

export default function CampaignBuilderPage() {
  return (
    <Suspense fallback={<div style={{minHeight:'100dvh',background:'#0f1f0f',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:'rgba(255,255,255,0.4)',fontFamily:'Georgia,serif',fontSize:'16px',fontStyle:'italic'}}>Verifying your link…</div></div>}>
      <CampaignBuilderInner/>
    </Suspense>
  )
}

function CampaignBuilderInner() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [tokenValid, setTokenValid] = useState<boolean|null>(null)
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [campaignCreated, setCampaignCreated] = useState(false)
  const [createdSlug, setCreatedSlug] = useState('')

  // Form fields
  const [honoreeNames, setHonoreeNames] = useState('')
  const [eventType, setEventType] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [location, setLocation] = useState('')
  const [theme, setTheme] = useState(THEMES[0])
  const [pattern, setPattern] = useState(PATTERNS[0])
  const [verse, setVerse] = useState(VERSES[0])
  const [customVerse, setCustomVerse] = useState('')
  const [greetingText, setGreetingText] = useState('')

  // Live preview transition
  const [previewTransition, setPreviewTransition] = useState(false)

  useEffect(()=>{
    if(!token){setTokenValid(false);return}
    fetch(`/api/campaigns/validate-token?token=${token}`)
      .then(r=>r.json())
      .then(data=>{
        if(data.valid){
          setTokenValid(true)
          setHonoreeNames(data.request?.honoree_names||'')
          setEventType(data.request?.event_type||'')
          setEventDate(data.request?.event_date||'')
          setGreetingText(`Welcome to the blessed ${data.request?.event_type||'celebration'} of ${data.request?.honoree_names||''}`)
        }else{setTokenValid(false)}
      })
      .catch(()=>setTokenValid(false))
  },[token])

  const changeTheme = (t: typeof THEMES[0]) => {
    setPreviewTransition(true)
    setTimeout(()=>{setTheme(t);setPreviewTransition(false)},200)
  }

  const handleCreate = async () => {
    setSaving(true);setError('')
    try{
      const res=await fetch('/api/campaigns',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,honoree_names:honoreeNames,event_type:eventType,event_date:eventDate,location,theme:{color_scheme:theme.id,bg:theme.bg,accent:theme.accent,pattern:pattern.id,verse:verse.id,custom_verse:verse.id==='custom'?customVerse:null,greeting_text:greetingText}})})
      const data=await res.json()
      if(data.campaign){setCreatedSlug(data.campaign.slug);setCampaignCreated(true)}
      else setError(data.error||'Something went wrong.')
    }catch{setError('Network error.')}
    setSaving(false)
  }

  if(tokenValid===false)return(
    <div style={{minHeight:'100dvh',background:'#0f1f0f',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',textAlign:'center'}}>
      <div><div style={{fontFamily:'var(--font-cinzel)',fontSize:'18px',color:'#fff',marginBottom:'12px'}}>Invalid or expired link</div><p style={{fontFamily:'var(--font-cormorant)',fontSize:'15px',color:'rgba(255,255,255,0.45)',fontStyle:'italic',lineHeight:1.7}}>This link is no longer valid. Please contact us for a new one.</p><a href="/contact" style={{display:'inline-block',marginTop:'20px',fontFamily:'var(--font-cinzel)',fontSize:'10px',letterSpacing:'0.14em',color:'#0f1f0f',background:'#d4af6e',padding:'12px 24px',borderRadius:'8px',textDecoration:'none'}}>Contact us</a></div>
    </div>
  )

  if(tokenValid===null)return(
    <div style={{minHeight:'100dvh',background:'#0f1f0f',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{fontFamily:'var(--font-cormorant)',fontSize:'16px',color:'rgba(255,255,255,0.4)',fontStyle:'italic'}}>Verifying your link…</div>
    </div>
  )

  if(campaignCreated)return(
    <div style={{minHeight:'100dvh',background:theme.bg,position:'relative',overflow:'hidden'}}>
      <PatternBg type={pattern.id} accent={theme.accent}/>
      <div style={{position:'relative',zIndex:2,display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100dvh',padding:'24px',textAlign:'center'}}>
        <div style={{maxWidth:'480px',background:'rgba(0,0,0,0.35)',backdropFilter:'blur(12px)',border:`0.5px solid ${theme.accent}30`,borderRadius:'20px',padding:'40px 36px'}}>
          <div style={{width:'64px',height:'64px',borderRadius:'50%',background:'rgba(46,107,46,0.15)',border:'0.5px solid rgba(46,107,46,0.4)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}><svg width="28" height="28" viewBox="0 0 28 28" fill="none"><polyline points="6,14 11,20 22,8" stroke="#4a9e4a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
          <h1 style={{fontFamily:'var(--font-cinzel)',fontSize:'22px',fontWeight:500,color:'#fff',marginBottom:'10px'}}>Campaign created!</h1>
          <p style={{fontFamily:'var(--font-cormorant)',fontSize:'15px',fontStyle:'italic',color:'rgba(255,255,255,0.5)',lineHeight:1.7,marginBottom:'24px'}}>Your Baab As-Sadaqah campaign is ready. Once activated by Green Emblem, it will be live at:</p>
          <div style={{background:'rgba(255,255,255,0.05)',border:`0.5px solid ${theme.accent}30`,borderRadius:'8px',padding:'12px 14px',marginBottom:'16px',display:'flex',alignItems:'center',gap:'10px'}}>
            <span style={{fontFamily:'var(--font-cormorant)',fontSize:'14px',color:'#fff',flex:1,textAlign:'left',wordBreak:'break-all'}}>green-emblem.com/give/{createdSlug}</span>
            <button onClick={()=>navigator.clipboard.writeText(`https://green-emblem.com/give/${createdSlug}`)} style={{fontFamily:'var(--font-cinzel)',fontSize:'9px',letterSpacing:'0.1em',color:theme.accent,background:'none',border:`0.5px solid ${theme.accent}40`,borderRadius:'6px',padding:'6px 10px',cursor:'pointer',whiteSpace:'nowrap'}}>Copy</button>
          </div>
          <a href={`/api/campaigns/${createdSlug}/qr`} download style={{display:'block',width:'100%',fontFamily:'var(--font-cinzel)',fontSize:'11px',letterSpacing:'0.16em',color:'#0f1f0f',background:theme.accent,borderRadius:'10px',padding:'14px',textDecoration:'none',marginBottom:'10px',textAlign:'center'}}>Download QR code (PNG)</a>
          <a href="/dashboard" style={{display:'block',width:'100%',fontFamily:'var(--font-cinzel)',fontSize:'11px',letterSpacing:'0.16em',color:theme.accent,border:`0.5px solid ${theme.accent}40`,borderRadius:'10px',padding:'14px',textDecoration:'none',textAlign:'center'}}>Go to my dashboard</a>
        </div>
      </div>
    </div>
  )

  // ── FULL-SCREEN LIVE PREVIEW BUILDER ──────────────────────────────────────
  return (
    <div style={{minHeight:'100dvh',position:'relative',overflow:'hidden',transition:'background 0.6s ease',background:theme.bg}}>
      <PatternBg type={pattern.id} accent={theme.accent}/>

      {/* Animated gradient overlay that transitions with theme */}
      <div style={{position:'absolute',inset:0,background:`radial-gradient(ellipse at 70% 30%, ${theme.accent}08 0%, transparent 60%)`,transition:'all 0.6s ease',pointerEvents:'none',zIndex:1}}/>

      {/* Top bar */}
      <div style={{position:'fixed',top:0,left:0,right:0,zIndex:100,padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',background:'rgba(0,0,0,0.3)',backdropFilter:'blur(16px)',borderBottom:`0.5px solid ${theme.accent}20`}}>
        <div style={{fontFamily:'var(--font-cinzel)',fontSize:'11px',letterSpacing:'0.2em',color:theme.accent,opacity:0.8}}>Green Emblem · Campaign Builder</div>
        {/* Step indicators */}
        <div style={{display:'flex',gap:'6px'}}>
          {['Details','Theme','Verse','Review'].map((s,i)=>(
            <div key={s} style={{display:'flex',alignItems:'center',gap:'4px',cursor:i<step-1?'pointer':'default'}} onClick={()=>{if(i<step-1)setStep(i+1)}}>
              <div style={{width:'20px',height:'20px',borderRadius:'50%',background:step>i+1?theme.accent:step===i+1?`${theme.accent}30`:'rgba(255,255,255,0.08)',border:`0.5px solid ${step>=i+1?theme.accent:'rgba(255,255,255,0.15)'}`,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.4s'}}>
                {step>i+1?<svg width="9" height="7" viewBox="0 0 9 7"><polyline points="1,3.5 3.5,6 8,1" fill="none" stroke="#0f1f0f" strokeWidth="1.5" strokeLinecap="round"/></svg>:<span style={{fontFamily:'var(--font-cinzel)',fontSize:'8px',color:step===i+1?theme.accent:'rgba(255,255,255,0.3)'}}>{i+1}</span>}
              </div>
              <span style={{fontFamily:'var(--font-cinzel)',fontSize:'8px',letterSpacing:'0.1em',color:step===i+1?theme.accent:'rgba(255,255,255,0.3)',display:'none'}}>BLARGH</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main layout: form left, live preview right */}
      <div style={{position:'relative',zIndex:2,display:'grid',gridTemplateColumns:'1fr 1fr',minHeight:'100dvh',paddingTop:'60px'}}>

        {/* Left: Form panel */}
        <div style={{padding:'32px 28px 40px',overflowY:'auto',maxHeight:'calc(100dvh - 60px)',borderRight:`0.5px solid ${theme.accent}15`}}>

          {error&&<div style={{background:'rgba(226,75,74,0.1)',border:'0.5px solid rgba(226,75,74,0.25)',borderRadius:'8px',padding:'12px 16px',marginBottom:'20px',fontFamily:'var(--font-cormorant)',fontSize:'14px',color:'#e24b4a'}}>{error}</div>}

          {/* STEP 1 */}
          {step===1&&(
            <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
              <div>
                <div style={{fontFamily:'var(--font-cinzel)',fontSize:'9px',letterSpacing:'0.28em',color:theme.accent,marginBottom:'8px',opacity:0.8}}>Step 1 of 4</div>
                <h2 style={{fontFamily:'var(--font-cinzel)',fontSize:'20px',color:'#fff',marginBottom:'6px'}}>Event details</h2>
                <p style={{fontFamily:'var(--font-cormorant)',fontSize:'14px',color:'rgba(255,255,255,0.45)',fontStyle:'italic',lineHeight:1.6}}>These details appear on your campaign page.</p>
              </div>
              {[{label:'Names to honour *',val:honoreeNames,set:setHonoreeNames,placeholder:'e.g. Aisha & Ibrahim'},{label:'Location (optional)',val:location,set:setLocation,placeholder:'e.g. The Grand Ballroom, Queens NY'}].map(({label,val,set,placeholder})=>(
                <div key={label}>
                  <label style={{fontFamily:'var(--font-cinzel)',fontSize:'8.5px',letterSpacing:'0.18em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'7px'}}>{label}</label>
                  <input type="text" value={val} onChange={e=>set(e.target.value)} placeholder={placeholder} style={{width:'100%',background:'rgba(255,255,255,0.05)',border:`0.5px solid ${theme.accent}30`,borderRadius:'8px',padding:'12px 14px',fontFamily:'var(--font-cormorant)',fontSize:'16px',color:'#fff',outline:'none',transition:'border-color 0.3s'}}/>
                </div>
              ))}
              <div>
                <label style={{fontFamily:'var(--font-cinzel)',fontSize:'8.5px',letterSpacing:'0.18em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'7px'}}>Event type *</label>
                <select value={eventType} onChange={e=>setEventType(e.target.value)} style={{width:'100%',background:'rgba(15,31,15,0.8)',border:`0.5px solid ${theme.accent}30`,borderRadius:'8px',padding:'12px 14px',fontFamily:'var(--font-cormorant)',fontSize:'16px',color:eventType?'#fff':'rgba(255,255,255,0.35)',outline:'none',appearance:'none',cursor:'pointer'}}>
                  <option value="">Select event type…</option>
                  {['Nikkah','Walima','Aqiqah','Eid','Graduation','Anniversary','Other'].map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontFamily:'var(--font-cinzel)',fontSize:'8.5px',letterSpacing:'0.18em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'7px'}}>Event date</label>
                <input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)} style={{width:'100%',background:'rgba(255,255,255,0.05)',border:`0.5px solid ${theme.accent}30`,borderRadius:'8px',padding:'12px 14px',fontFamily:'var(--font-cormorant)',fontSize:'16px',color:'#fff',outline:'none',colorScheme:'dark'}}/>
              </div>
              <div>
                <label style={{fontFamily:'var(--font-cinzel)',fontSize:'8.5px',letterSpacing:'0.18em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'7px'}}>Greeting message</label>
                <textarea value={greetingText} onChange={e=>setGreetingText(e.target.value)} style={{width:'100%',background:'rgba(255,255,255,0.05)',border:`0.5px solid ${theme.accent}30`,borderRadius:'8px',padding:'12px 14px',fontFamily:'var(--font-cormorant)',fontSize:'15px',color:'#fff',outline:'none',resize:'vertical',lineHeight:1.5,minHeight:'70px'}}/>
              </div>
              <button onClick={()=>setStep(2)} disabled={!honoreeNames||!eventType} style={{fontFamily:'var(--font-cinzel)',fontSize:'10px',letterSpacing:'0.16em',color:'#0f1f0f',background:(!honoreeNames||!eventType)?'rgba(255,255,255,0.1)':theme.accent,border:'none',borderRadius:'9px',padding:'14px',cursor:(!honoreeNames||!eventType)?'not-allowed':'pointer',opacity:(!honoreeNames||!eventType)?0.4:1,transition:'all 0.3s',marginTop:'4px'}}>
                Next: Choose theme →
              </button>
            </div>
          )}

          {/* STEP 2 */}
          {step===2&&(
            <div style={{display:'flex',flexDirection:'column',gap:'18px'}}>
              <div>
                <div style={{fontFamily:'var(--font-cinzel)',fontSize:'9px',letterSpacing:'0.28em',color:theme.accent,marginBottom:'8px',opacity:0.8}}>Step 2 of 4</div>
                <h2 style={{fontFamily:'var(--font-cinzel)',fontSize:'20px',color:'#fff',marginBottom:'6px'}}>Choose your theme</h2>
                <p style={{fontFamily:'var(--font-cormorant)',fontSize:'14px',color:'rgba(255,255,255,0.45)',fontStyle:'italic',lineHeight:1.6}}>Watch the preview update live as you select.</p>
              </div>
              <div>
                <label style={{fontFamily:'var(--font-cinzel)',fontSize:'8.5px',letterSpacing:'0.18em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'12px'}}>Colour scheme</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                  {THEMES.map(t=>(
                    <button key={t.id} onClick={()=>changeTheme(t)} style={{background:theme.id===t.id?`${t.accent}15`:'rgba(255,255,255,0.03)',border:`0.5px solid ${theme.id===t.id?t.accent+'60':'rgba(255,255,255,0.1)'}`,borderRadius:'10px',padding:'12px',cursor:'pointer',textAlign:'left',transition:'all 0.25s'}}>
                      <div style={{display:'flex',gap:'5px',marginBottom:'7px'}}>
                        {t.preview.map((c,i)=><div key={i} style={{width:'16px',height:'16px',borderRadius:'50%',background:c,border:'0.5px solid rgba(255,255,255,0.15)',transition:'background 0.3s'}}/>)}
                      </div>
                      <div style={{fontFamily:'var(--font-cinzel)',fontSize:'10px',letterSpacing:'0.08em',color:theme.id===t.id?t.accent:'rgba(255,255,255,0.55)',transition:'color 0.3s'}}>{t.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{fontFamily:'var(--font-cinzel)',fontSize:'8.5px',letterSpacing:'0.18em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'12px'}}>Background pattern</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                  {PATTERNS.map(p=>(
                    <button key={p.id} onClick={()=>setPattern(p)} style={{background:pattern.id===p.id?`${theme.accent}12`:'rgba(255,255,255,0.03)',border:`0.5px solid ${pattern.id===p.id?theme.accent+'50':'rgba(255,255,255,0.1)'}`,borderRadius:'8px',padding:'11px 12px',cursor:'pointer',fontFamily:'var(--font-cormorant)',fontSize:'14px',color:pattern.id===p.id?'#fff':'rgba(255,255,255,0.5)',textAlign:'left',transition:'all 0.2s'}}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{display:'flex',gap:'10px'}}>
                <button onClick={()=>setStep(1)} style={{flex:1,fontFamily:'var(--font-cinzel)',fontSize:'10px',letterSpacing:'0.14em',color:'rgba(255,255,255,0.5)',background:'transparent',border:'0.5px solid rgba(255,255,255,0.15)',borderRadius:'9px',padding:'13px',cursor:'pointer'}}>← Back</button>
                <button onClick={()=>setStep(3)} style={{flex:2,fontFamily:'var(--font-cinzel)',fontSize:'10px',letterSpacing:'0.16em',color:'#0f1f0f',background:theme.accent,border:'none',borderRadius:'9px',padding:'13px',cursor:'pointer',transition:'background 0.4s'}}>Next: Verse & greeting →</button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step===3&&(
            <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
              <div>
                <div style={{fontFamily:'var(--font-cinzel)',fontSize:'9px',letterSpacing:'0.28em',color:theme.accent,marginBottom:'8px',opacity:0.8}}>Step 3 of 4</div>
                <h2 style={{fontFamily:'var(--font-cinzel)',fontSize:'20px',color:'#fff',marginBottom:'6px'}}>Choose a verse</h2>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                {VERSES.map(v=>(
                  <button key={v.id} onClick={()=>setVerse(v)} style={{background:verse.id===v.id?`${theme.accent}10`:'rgba(255,255,255,0.03)',border:`0.5px solid ${verse.id===v.id?theme.accent+'40':'rgba(255,255,255,0.08)'}`,borderRadius:'10px',padding:'14px',cursor:'pointer',textAlign:'left',transition:'all 0.2s'}}>
                    <div style={{fontFamily:'var(--font-cinzel)',fontSize:'11px',color:verse.id===v.id?'#fff':'rgba(255,255,255,0.55)',marginBottom:v.preview?'5px':0}}>{v.label}</div>
                    {v.preview&&<div style={{fontFamily:'var(--font-cormorant)',fontSize:'13px',color:'rgba(255,255,255,0.35)',fontStyle:'italic'}}>{v.preview}</div>}
                  </button>
                ))}
              </div>
              {verse.id==='custom'&&(
                <div>
                  <label style={{fontFamily:'var(--font-cinzel)',fontSize:'8.5px',letterSpacing:'0.18em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'7px'}}>Your verse or du'a</label>
                  <textarea value={customVerse} onChange={e=>setCustomVerse(e.target.value)} placeholder="Enter your chosen verse…" style={{width:'100%',background:'rgba(255,255,255,0.05)',border:`0.5px solid ${theme.accent}30`,borderRadius:'8px',padding:'12px 14px',fontFamily:'var(--font-cormorant)',fontSize:'15px',color:'#fff',outline:'none',resize:'vertical',minHeight:'70px',lineHeight:1.5}}/>
                </div>
              )}
              <div style={{display:'flex',gap:'10px'}}>
                <button onClick={()=>setStep(2)} style={{flex:1,fontFamily:'var(--font-cinzel)',fontSize:'10px',letterSpacing:'0.14em',color:'rgba(255,255,255,0.5)',background:'transparent',border:'0.5px solid rgba(255,255,255,0.15)',borderRadius:'9px',padding:'13px',cursor:'pointer'}}>← Back</button>
                <button onClick={()=>setStep(4)} style={{flex:2,fontFamily:'var(--font-cinzel)',fontSize:'10px',letterSpacing:'0.16em',color:'#0f1f0f',background:theme.accent,border:'none',borderRadius:'9px',padding:'13px',cursor:'pointer',transition:'background 0.4s'}}>Review →</button>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step===4&&(
            <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
              <div>
                <div style={{fontFamily:'var(--font-cinzel)',fontSize:'9px',letterSpacing:'0.28em',color:theme.accent,marginBottom:'8px',opacity:0.8}}>Step 4 of 4</div>
                <h2 style={{fontFamily:'var(--font-cinzel)',fontSize:'20px',color:'#fff',marginBottom:'6px'}}>Review & submit</h2>
              </div>
              {[{label:'Honourees',val:honoreeNames},{label:'Event',val:eventType},{label:'Date',val:eventDate||'Not specified'},{label:'Location',val:location||'Not specified'},{label:'Theme',val:theme.label},{label:'Pattern',val:pattern.label},{label:'Verse',val:verse.label}].map(({label,val})=>(
                <div key={label} style={{display:'flex',gap:'12px',padding:'8px 0',borderBottom:'0.5px solid rgba(255,255,255,0.06)'}}>
                  <span style={{fontFamily:'var(--font-cinzel)',fontSize:'9px',letterSpacing:'0.12em',color:'rgba(255,255,255,0.3)',minWidth:'80px',paddingTop:'2px'}}>{label}</span>
                  <span style={{fontFamily:'var(--font-cormorant)',fontSize:'15px',color:'rgba(255,255,255,0.7)'}}>{val}</span>
                </div>
              ))}
              <div style={{background:`${theme.accent}08`,border:`0.5px solid ${theme.accent}20`,borderRadius:'8px',padding:'12px 14px',fontFamily:'var(--font-cormorant)',fontSize:'13px',color:'rgba(255,255,255,0.45)',fontStyle:'italic',lineHeight:1.6}}>
                Once submitted, your campaign will be reviewed within 48 hours. You'll receive a confirmation email with your live link and QR code.
              </div>
              <div style={{display:'flex',gap:'10px'}}>
                <button onClick={()=>setStep(3)} style={{flex:1,fontFamily:'var(--font-cinzel)',fontSize:'10px',color:'rgba(255,255,255,0.5)',background:'transparent',border:'0.5px solid rgba(255,255,255,0.15)',borderRadius:'9px',padding:'13px',cursor:'pointer'}}>← Back</button>
                <button onClick={handleCreate} disabled={saving} style={{flex:2,fontFamily:'var(--font-cinzel)',fontSize:'10px',letterSpacing:'0.14em',color:'#0f1f0f',background:theme.accent,border:'none',borderRadius:'9px',padding:'13px',cursor:saving?'not-allowed':'pointer',opacity:saving?0.6:1,transition:'all 0.3s'}}>
                  {saving?'Creating campaign…':'Create campaign'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Live preview */}
        <div style={{position:'relative',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}}>
          {/* Fade transition overlay */}
          <div style={{position:'absolute',inset:0,background:theme.bg,opacity:previewTransition?0.8:0,transition:'opacity 0.2s',zIndex:5,pointerEvents:'none'}}/>

          <div style={{width:'100%',maxWidth:'340px',background:'rgba(0,0,0,0.25)',backdropFilter:'blur(20px)',border:`0.5px solid ${theme.accent}25`,borderRadius:'20px',overflow:'hidden',transition:'all 0.6s ease',boxShadow:`0 20px 60px rgba(0,0,0,0.4), 0 0 40px ${theme.accent}08`}}>
            {/* Preview header */}
            <div style={{padding:'20px 18px 16px',textAlign:'center',borderBottom:`0.5px solid ${theme.accent}15`}}>
              <div style={{fontFamily:'var(--font-cinzel)',fontSize:'8px',letterSpacing:'0.22em',color:theme.accent,marginBottom:'8px',opacity:0.8,transition:'color 0.5s'}}>بَابُ الصَّدَقَة · Baab As-Sadaqah</div>
              <p style={{fontFamily:'var(--font-cormorant)',fontSize:'13px',fontStyle:'italic',color:'rgba(255,255,255,0.65)',lineHeight:1.5,marginBottom:'8px',transition:'all 0.4s'}}>
                {greetingText||`Welcome to the blessed ${eventType||'celebration'} of ${honoreeNames||'…'}`}
              </p>
              <h3 style={{fontFamily:'var(--font-cinzel)',fontSize:'18px',fontWeight:500,color:'#fff',marginBottom:'4px',lineHeight:1.2,transition:'all 0.4s'}}>
                {honoreeNames||'Your names here'}
              </h3>
              <div style={{fontFamily:'var(--font-cinzel)',fontSize:'9px',letterSpacing:'0.14em',color:'rgba(255,255,255,0.35)',transition:'all 0.4s'}}>
                {eventType||'Event type'}{eventDate?` · ${eventDate}`:''}
              </div>
            </div>
            {/* Verse preview */}
            {verse.id!=='custom'&&verse.preview&&(
              <div style={{padding:'14px 18px',background:`${theme.accent}06`,borderBottom:`0.5px solid ${theme.accent}10`,textAlign:'center',transition:'all 0.4s'}}>
                <p style={{fontFamily:'var(--font-cormorant)',fontSize:'12px',fontStyle:'italic',color:'rgba(255,255,255,0.5)',lineHeight:1.6,transition:'color 0.5s'}}>"{verse.preview}"</p>
              </div>
            )}
            {/* Charity selector preview */}
            <div style={{padding:'14px 18px'}}>
              <div style={{fontFamily:'var(--font-cinzel)',fontSize:'8px',letterSpacing:'0.16em',color:'rgba(255,255,255,0.3)',marginBottom:'8px'}}>Choose a charity</div>
              {['🌍 Share The Meal','☪️ Islamic Relief USA','🔵 UNICEF USA'].map((ch,i)=>(
                <div key={ch} style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px 10px',background:i===0?`${theme.accent}12`:'rgba(255,255,255,0.03)',border:`0.5px solid ${i===0?theme.accent+'40':'rgba(255,255,255,0.06)'}`,borderRadius:'8px',marginBottom:'5px',transition:'all 0.4s'}}>
                  <span style={{fontSize:'14px'}}>{ch.split(' ')[0]}</span>
                  <span style={{fontFamily:'var(--font-cinzel)',fontSize:'9px',color:i===0?'#fff':'rgba(255,255,255,0.45)',letterSpacing:'0.06em'}}>{ch.split(' ').slice(1).join(' ')}</span>
                </div>
              ))}
              {/* Amount buttons */}
              <div style={{display:'flex',gap:'5px',marginTop:'10px'}}>
                {[5,10,20,50].map((a,i)=>(
                  <div key={a} style={{flex:1,textAlign:'center',padding:'7px 4px',background:i===1?theme.accent:'rgba(255,255,255,0.04)',borderRadius:'100px',fontFamily:'var(--font-cinzel)',fontSize:'10px',color:i===1?'#0f1f0f':'rgba(255,255,255,0.5)',border:`0.5px solid ${i===1?theme.accent:'rgba(255,255,255,0.08)'}`,transition:'all 0.4s'}}>${a}</div>
                ))}
              </div>
              <div style={{marginTop:'10px',background:theme.accent,borderRadius:'8px',padding:'10px',textAlign:'center',fontFamily:'var(--font-cinzel)',fontSize:'10px',letterSpacing:'0.14em',color:'#0f1f0f',transition:'background 0.5s'}}>
                Give $10.00 →
              </div>
            </div>
            {/* Theme indicator */}
            <div style={{padding:'10px 18px',borderTop:`0.5px solid ${theme.accent}15`,display:'flex',alignItems:'center',gap:'8px'}}>
              <div style={{width:'12px',height:'12px',borderRadius:'50%',background:theme.accent,transition:'background 0.5s'}}/>
              <span style={{fontFamily:'var(--font-cinzel)',fontSize:'8px',letterSpacing:'0.1em',color:'rgba(255,255,255,0.3)',transition:'color 0.5s'}}>{theme.label} theme</span>
              <span style={{marginLeft:'auto',fontFamily:'var(--font-cinzel)',fontSize:'8px',letterSpacing:'0.1em',color:'rgba(255,255,255,0.2)'}}>{pattern.label}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
