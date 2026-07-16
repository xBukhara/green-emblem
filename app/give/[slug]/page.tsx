'use client'
import { useState, useEffect, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fontPair, googleFontsHref } from '@/lib/campaign-design'
import Link from 'next/link'

const CHARITIES = [
  { id:'share_the_meal', name:'Share The Meal', emoji:'🌍', desc:'WFP — feeds children worldwide', rate:'$0.80 per meal', color:'#E8A020', impact:(a:number)=>`${Math.floor(a/0.80)} meals`, url:(a:number)=>`https://sharethemeal.org/donate?amount=${a.toFixed(2)}` },
  { id:'islamic_relief',  name:'Islamic Relief USA', emoji:'☪️', desc:'Emergency aid, water, orphan care', rate:'100% to aid', color:'#1D9E75', impact:(a:number)=>`$${a.toFixed(2)} in relief`, url:(a:number)=>`https://irusa.org/donate/?amount=${a.toFixed(2)}` },
  { id:'unicef', name:'UNICEF USA', emoji:'🔵', desc:"Children's health & education", rate:'100% to children', color:'#378ADD', impact:(a:number)=>`$${a.toFixed(2)} for children`, url:(a:number)=>`https://www.unicefusa.org/donate?amount=${a.toFixed(2)}` },
]
const AMOUNTS = [5,10,20,50,100]

const VERSE_TEXT:Record<string,{ar:string;en:string;source:string}> = {
  tirmidhi_shade:{ar:'الْجَوَادُ قَرِيبٌ مِنَ اللَّهِ',en:'The generous person is close to Allah, close to people, and close to Paradise.',source:'Tirmidhi'},
  quran_2_272:{ar:'وَمَا تُنفِقُوا مِنْ خَيْرٍ فَلِأَنفُسِكُمْ',en:'Whatever good you give is for yourselves, and you only give seeking the countenance of Allah.',source:'Quran 2:272'},
  tirmidhi_fire:{ar:'اتَّقُوا النَّارَ وَلَوْ بِشِقِّ تَمْرَةٍ',en:'Save yourselves from Hellfire even by giving half a date in charity.',source:'Bukhari & Muslim'},
}

function OverlayFx({type,accent}:{type:string;accent:string}) {
  if(type==='none')return null
  const base:React.CSSProperties={position:'absolute',inset:0,pointerEvents:'none',zIndex:1}
  if(type==='frame')return <div style={{...base,border:`1px solid ${accent}55`,margin:'14px',borderRadius:'16px'}}><div style={{position:'absolute',inset:'5px',border:`0.5px solid ${accent}30`,borderRadius:'12px'}}/></div>
  if(type==='arch')return <div style={{...base,background:`radial-gradient(ellipse 70% 55% at 50% 0%, ${accent}14 0%, transparent 65%)`}}/>
  if(type==='corners')return <svg style={base} width="100%" height="100%"><g stroke={accent} strokeWidth="1.2" fill="none" opacity="0.7"><path d="M 14 46 Q 14 14 46 14"/><circle cx="22" cy="22" r="2.5" fill={accent}/></g></svg>
  return <svg style={{...base,opacity:0.05}} width="100%" height="100%" viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice"><path d="M150 40 A95 95 0 1 0 150 260 A75 75 0 1 1 150 40" fill={accent}/></svg>
}

function PatternBg({type,accent,opacity=0.07}:{type:string;accent:string;opacity?:number}) {
  const op = 0.07
  if (type==='arch') return (
    <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:op,pointerEvents:'none'}}>
      <defs><pattern id="arch" width="100" height="120" patternUnits="userSpaceOnUse">
        <path d="M50,10 Q80,10 80,50 L80,110 L20,110 L20,50 Q20,10 50,10 Z" fill="none" stroke={accent} strokeWidth="1"/>
        <rect x="10" y="110" width="80" height="8" fill="none" stroke={accent} strokeWidth="0.5"/>
      </pattern></defs>
      <rect width="100%" height="100%" fill="url(#arch)"/>
    </svg>
  )
  if (type==='mosque_window') return (
    <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:op,pointerEvents:'none'}}>
      <defs><pattern id="mw" width="80" height="80" patternUnits="userSpaceOnUse">
        <circle cx="40" cy="40" r="28" fill="none" stroke={accent} strokeWidth="0.8"/>
        <circle cx="40" cy="40" r="18" fill="none" stroke={accent} strokeWidth="0.5"/>
        <line x1="12" y1="40" x2="68" y2="40" stroke={accent} strokeWidth="0.4"/>
        <line x1="40" y1="12" x2="40" y2="68" stroke={accent} strokeWidth="0.4"/>
        <line x1="20" y1="20" x2="60" y2="60" stroke={accent} strokeWidth="0.3"/>
        <line x1="60" y1="20" x2="20" y2="60" stroke={accent} strokeWidth="0.3"/>
      </pattern></defs>
      <rect width="100%" height="100%" fill="url(#mw)"/>
    </svg>
  )
  return (
    <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:op,pointerEvents:'none'}}>
      <defs><pattern id="gt" width="80" height="80" patternUnits="userSpaceOnUse">
        <g fill="none" stroke={accent} strokeWidth="0.8">
          <rect x="20" y="20" width="40" height="40" rx="2"/>
          <rect x="20" y="20" width="40" height="40" rx="2" transform="rotate(45 40 40)"/>
          <circle cx="40" cy="40" r="8"/>
        </g>
      </pattern></defs>
      <rect width="100%" height="100%" fill="url(#gt)"/>
    </svg>
  )
}

export default function CampaignPage() {
  return (
    <Suspense fallback={<div style={{minHeight:'100dvh',background:'#0f1f0f'}}/>}>
      <CampaignInner/>
    </Suspense>
  )
}

function CampaignInner() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClient()
  const [campaign, setCampaign] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [amount, setAmount] = useState(10)
  const [custom, setCustom] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [charity, setCharity] = useState(CHARITIES[0])
  const [step, setStep] = useState<'give'|'confirm'|'thanks'>('give')
  const [donationId, setDonationId] = useState('')
  const [donating, setDonating] = useState(false)

  // Theme from campaign (supports both legacy themes and design-studio themes)
  const themeId = campaign?.theme?.color_scheme || campaign?.theme?.template_id || 'forest_gold'
  const bg = campaign?.theme?.bg || '#0f1f0f'
  const accent = campaign?.theme?.accent || '#d4af6e'
  const textColor = campaign?.theme?.text || '#ffffff'
  const pattern = campaign?.theme?.pattern || 'geometric_tile'
  const patternOpacity = campaign?.theme?.pattern_opacity ?? 0.07
  const overlay = campaign?.theme?.overlay || 'none'
  const fonts = fontPair(campaign?.theme?.font_pair)
  const verse = campaign?.theme?.verse === 'custom'
    ? campaign?.theme?.custom_verse
    : (campaign?.theme?.verse ? VERSE_TEXT[campaign.theme.verse] : null)
  const greeting = campaign?.theme?.greeting_text || `Welcome to the blessed ${campaign?.event_type || 'celebration'} of ${campaign?.honoree_names || ''}`

  // Load the campaign's Google Font pairing
  useEffect(() => {
    if (!campaign?.theme?.font_pair) return
    const id = `gf-${campaign.theme.font_pair}`
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = googleFontsHref(campaign.theme.font_pair)
    document.head.appendChild(link)
  }, [campaign?.theme?.font_pair])

  useEffect(() => {
    supabase.from('campaigns').select('*').eq('slug', slug).eq('status','active').single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); setLoading(false); return }
        setCampaign(data); setLoading(false)
      })
  }, [slug])

  useEffect(() => {
    if (!campaign) return
    const interval = setInterval(async () => {
      const { data } = await supabase.from('campaigns').select('total_raised,donor_count,meals_funded').eq('id', campaign.id).single()
      if (data) setCampaign((c:any) => ({...c,...data}))
    }, 30000)
    return () => clearInterval(interval)
  }, [campaign?.id])

  const finalAmount = useCustom ? parseFloat(custom) || 0 : amount

  const handleDonate = async () => {
    if (finalAmount < 1) return
    setDonating(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: donation } = await supabase.from('donations').insert({
      campaign_id: campaign.id,
      user_id: user?.id || null,
      donor_email: user?.email || null,
      amount: finalAmount,
      charity: charity.id,
      meals_funded: charity.id === 'share_the_meal' ? Math.floor(finalAmount/0.80) : null,
      confirmed: false,
    }).select().single()
    if (donation) setDonationId(donation.id)
    setStep('confirm')
    setDonating(false)
  }

  const handleConfirm = async () => {
    if (donationId) {
      await supabase.from('donations').update({ confirmed: true }).eq('id', donationId)
      await supabase.rpc('increment_campaign_stats', {
        p_campaign_id: campaign.id,
        p_amount: finalAmount,
        p_meals: charity.id === 'share_the_meal' ? Math.floor(finalAmount/0.80) : 0,
      })
    }
    setStep('thanks')
    setTimeout(() => window.open(charity.url(finalAmount), '_blank'), 600)
  }

  if (loading) return <div style={{minHeight:'100dvh',background:'#0f1f0f',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{fontFamily:fonts.body,fontSize:'16px',color:'rgba(255,255,255,0.4)',fontStyle:'italic'}}>Loading…</div></div>

  // ── NOT FOUND ────────────────────────────────────────────────────────────────
  if (notFound) return (
    <div style={{minHeight:'100dvh',background:'#0f1f0f',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',textAlign:'center'}}>
      <div style={{maxWidth:'420px'}}>
        <div style={{fontFamily:fonts.body,fontSize:'9px',letterSpacing:'0.28em',color:'rgba(212,175,110,0.6)',marginBottom:'14px'}}>Baab As-Sadaqah</div>
        <h1 style={{fontFamily:fonts.body,fontSize:'22px',color:'#fff',marginBottom:'12px'}}>Campaign not found</h1>
        <p style={{fontFamily:fonts.body,fontSize:'15px',color:'rgba(255,255,255,0.5)',fontStyle:'italic',lineHeight:1.7,marginBottom:'24px'}}>This campaign may have ended or the link is incorrect.</p>
        <Link href="/" style={{fontFamily:fonts.body,fontSize:'10px',letterSpacing:'0.14em',color:'#0f1f0f',background:'#d4af6e',padding:'12px 24px',borderRadius:'8px',textDecoration:'none'}}>Return to Green Emblem</Link>
      </div>
    </div>
  )

  // ── THANKS — only here do we show signup prompt ─────────────────────────────
  if (step === 'thanks') return (
    <div style={{minHeight:'100dvh',background:bg,position:'relative',overflow:'hidden'}}>
      <PatternBg type={pattern} accent={accent} opacity={patternOpacity}/><OverlayFx type={overlay} accent={accent}/>
      {/* Minimal top link — no signup prompt here */}
      <div style={{position:'absolute',top:0,left:0,right:0,padding:'16px 24px',zIndex:10}}>
        <Link href="/" style={{fontFamily:fonts.body,fontSize:'10px',letterSpacing:'0.18em',color:accent,textDecoration:'none',opacity:0.7}}>Green Emblem</Link>
      </div>
      <div style={{position:'relative',zIndex:2,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100dvh',padding:'80px 24px 40px',textAlign:'center'}}>
        <div style={{width:'72px',height:'72px',borderRadius:'50%',background:'rgba(29,158,117,0.1)',border:'0.5px solid rgba(29,158,117,0.3)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 24px'}}>
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none"><polyline points="7,15 12,21 23,9" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{fontFamily:fonts.body,fontSize:'9px',letterSpacing:'0.28em',color:accent,marginBottom:'14px'}}>Jazak Allahu Khairan</div>
        <h1 style={{fontFamily:fonts.body,fontSize:'clamp(22px,5vw,34px)',fontWeight:400,color:'#fff',lineHeight:1.15,marginBottom:'12px'}}>May Allah accept your sadaqah</h1>
        <p style={{fontFamily:fonts.body,fontSize:'17px',fontStyle:'italic',color:'rgba(255,255,255,0.6)',lineHeight:1.7,marginBottom:'6px',maxWidth:'400px'}}>
          Your gift of <strong style={{color:accent}}>${finalAmount.toFixed(2)}</strong> in honour of <strong style={{color:'#fff'}}>{campaign.honoree_names}</strong>.
        </p>
        {charity.id==='share_the_meal' && <p style={{fontFamily:fonts.body,fontSize:'16px',color:'rgba(255,255,255,0.5)',fontStyle:'italic',marginBottom:'28px'}}>{Math.floor(finalAmount/0.80)} meals funded for children in need.</p>}
        <div style={{fontFamily:fonts.body,fontSize:'22px',color:accent,opacity:0.6,direction:'rtl',marginBottom:'32px'}} lang="ar">تَقَبَّلَ اللَّهُ مِنَّا وَمِنكُمْ</div>

        {/* Signup CTA — shown ONLY on thanks page after donation */}
        <div style={{background:'rgba(0,0,0,0.35)',backdropFilter:'blur(16px)',border:`0.5px solid ${accent}30`,borderRadius:'20px',padding:'28px 24px',maxWidth:'400px',width:'100%',marginBottom:'16px'}}>
          <div style={{fontFamily:fonts.body,fontSize:'9px',letterSpacing:'0.22em',color:accent,marginBottom:'10px'}}>Track your impact</div>
          <h2 style={{fontFamily:fonts.body,fontSize:'18px',color:'#fff',marginBottom:'10px',fontWeight:400,lineHeight:1.2}}>See every meal you've funded</h2>
          <p style={{fontFamily:fonts.body,fontSize:'14px',color:'rgba(255,255,255,0.5)',fontStyle:'italic',lineHeight:1.7,marginBottom:'20px'}}>
            Create a free Green Emblem account to track your donations, see lifetime impact, and get <strong style={{color:accent}}>15% off your first order</strong>.
          </p>
          <Link href="/auth/sign-in" style={{display:'block',fontFamily:fonts.body,fontSize:'11px',letterSpacing:'0.16em',color:'#0f1f0f',background:accent,borderRadius:'10px',padding:'14px',textDecoration:'none',marginBottom:'10px',textAlign:'center'}}>
            Create free account →
          </Link>
          <Link href="/sadaqah/request" style={{display:'block',fontFamily:fonts.body,fontSize:'10px',letterSpacing:'0.14em',color:accent,border:`0.5px solid ${accent}50`,borderRadius:'10px',padding:'12px',textDecoration:'none',textAlign:'center'}}>
            Start your own campaign
          </Link>
        </div>
        <Link href="https://green-emblem.com" style={{fontFamily:fonts.body,fontSize:'9px',letterSpacing:'0.14em',color:'rgba(255,255,255,0.2)',textDecoration:'none',marginTop:'20px'}}>Powered by Green Emblem →</Link>
      </div>
    </div>
  )

  // ── CONFIRM ──────────────────────────────────────────────────────────────────
  if (step === 'confirm') return (
    <div style={{minHeight:'100dvh',background:bg,position:'relative',overflow:'hidden'}}>
      <PatternBg type={pattern} accent={accent} opacity={patternOpacity}/><OverlayFx type={overlay} accent={accent}/>
      <div style={{position:'absolute',top:0,left:0,right:0,padding:'16px 24px',zIndex:10}}>
        <Link href="/" style={{fontFamily:fonts.body,fontSize:'10px',letterSpacing:'0.18em',color:accent,textDecoration:'none',opacity:0.7}}>Green Emblem</Link>
      </div>
      <div style={{position:'relative',zIndex:2,display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100dvh',padding:'24px'}}>
        <div style={{background:'rgba(0,0,0,0.3)',backdropFilter:'blur(12px)',border:`0.5px solid ${accent}30`,borderRadius:'20px',width:'100%',maxWidth:'400px',padding:'32px 28px',textAlign:'center'}}>
          <div style={{fontFamily:fonts.body,fontSize:'9px',letterSpacing:'0.28em',color:accent,marginBottom:'20px'}}>Confirm your sadaqah</div>
          <div style={{background:'rgba(255,255,255,0.05)',borderRadius:'12px',padding:'20px',marginBottom:'20px'}}>
            <div style={{fontFamily:fonts.body,fontSize:'36px',color:accent,marginBottom:'4px'}}>${finalAmount.toFixed(2)}</div>
            <div style={{fontFamily:fonts.body,fontSize:'15px',color:'rgba(255,255,255,0.6)',fontStyle:'italic',marginBottom:'6px'}}>via {charity.name}</div>
            <div style={{fontFamily:fonts.body,fontSize:'14px',color:'rgba(255,255,255,0.5)',fontStyle:'italic'}}>In honour of {campaign.honoree_names}</div>
            {charity.id==='share_the_meal' && <div style={{marginTop:'10px',fontFamily:fonts.body,fontSize:'12px',letterSpacing:'0.08em',color:'rgba(255,255,255,0.35)'}}>{Math.floor(finalAmount/0.80)} meals for children</div>}
          </div>
          <p style={{fontFamily:fonts.body,fontSize:'13px',color:'rgba(255,255,255,0.4)',fontStyle:'italic',lineHeight:1.6,marginBottom:'20px'}}>You'll be taken to {charity.name}'s website. Green Emblem never handles your payment.</p>
          <button onClick={handleConfirm} style={{width:'100%',fontFamily:fonts.body,fontSize:'11px',letterSpacing:'0.16em',color:'#0f1f0f',background:accent,border:'none',borderRadius:'10px',padding:'15px',cursor:'pointer',marginBottom:'10px'}}>
            Continue to {charity.name} →
          </button>
          <button onClick={() => setStep('give')} style={{background:'none',border:'none',fontFamily:fonts.body,fontSize:'9px',letterSpacing:'0.12em',color:'rgba(255,255,255,0.3)',cursor:'pointer'}}>← Go back</button>
        </div>
      </div>
    </div>
  )

  // ── MAIN GIVING PAGE — no signup prompt here ─────────────────────────────────
  return (
    <div style={{minHeight:'100dvh',background:bg,position:'relative',overflow:'hidden'}}>
      <PatternBg type={pattern} accent={accent} opacity={patternOpacity}/><OverlayFx type={overlay} accent={accent}/>
      {/* Minimal top bar — no sign up button */}
      <div style={{position:'absolute',top:0,left:0,right:0,padding:'14px 20px',zIndex:10,display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(0,0,0,0.12)',backdropFilter:'blur(6px)'}}>
        <Link href="/" style={{fontFamily:fonts.body,fontSize:'10px',letterSpacing:'0.18em',color:accent,textDecoration:'none',opacity:0.75}}>Green Emblem</Link>
        <div style={{fontFamily:fonts.body,fontSize:'9px',letterSpacing:'0.2em',color:'rgba(255,255,255,0.25)'}}>بَابُ الصَّدَقَة</div>
      </div>

      <div style={{position:'relative',zIndex:2,maxWidth:'500px',margin:'0 auto',padding:'68px 20px 60px'}}>
        {/* Header */}
        <div style={{textAlign:'center',marginBottom:'24px'}}>
          <div style={{fontFamily:fonts.body,fontSize:'8px',letterSpacing:'0.28em',color:accent,marginBottom:'10px',opacity:0.8}}>Baab As-Sadaqah</div>
          <p style={{fontFamily:fonts.body,fontSize:'clamp(14px,3vw,17px)',fontStyle:'italic',color:'rgba(255,255,255,0.65)',lineHeight:1.65,marginBottom:'12px'}}>{greeting}</p>
          <h1 style={{fontFamily:fonts.heading,fontSize:'clamp(24px,6vw,40px)',fontWeight:500,color:textColor,lineHeight:1.1,marginBottom:'6px'}}>{campaign.honoree_names}</h1>
          <div style={{fontFamily:fonts.body,fontSize:'10px',letterSpacing:'0.16em',color:'rgba(255,255,255,0.3)',marginBottom:'18px'}}>
            {campaign.event_type&&campaign.event_type!=='Other'?campaign.event_type:''}{campaign.event_date?` · ${campaign.event_date}`:''}{campaign.location?` · ${campaign.location}`:''}
          </div>

          {verse && (
            <div style={{background:'rgba(255,255,255,0.04)',border:`0.5px solid ${accent}20`,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
              <div style={{fontFamily:fonts.body,fontSize:'16px',color:accent,direction:'rtl',marginBottom:'8px',lineHeight:1.6,opacity:0.85}} lang="ar">{verse.ar}</div>
              <p style={{fontFamily:fonts.body,fontSize:'13px',fontStyle:'italic',color:'rgba(255,255,255,0.55)',lineHeight:1.7,marginBottom:'4px'}}>"{verse.en}"</p>
              <div style={{fontFamily:fonts.body,fontSize:'9px',letterSpacing:'0.1em',color:'rgba(255,255,255,0.25)'}}>— {verse.source}</div>
            </div>
          )}

          {(campaign.total_raised > 0 || campaign.donor_count > 0) && (
            <div style={{display:'flex',gap:'8px',justifyContent:'center',marginBottom:'16px'}}>
              {[{label:'Raised',value:`$${campaign.total_raised?.toFixed(2)||'0.00'}`},{label:'Donors',value:campaign.donor_count||0},...(campaign.meals_funded>0?[{label:'Meals',value:campaign.meals_funded}]:[])].map(({label,value}) => (
                <div key={label} style={{background:'rgba(255,255,255,0.06)',borderRadius:'10px',padding:'10px 14px',flex:1,textAlign:'center'}}>
                  <div style={{fontFamily:fonts.body,fontSize:'18px',color:accent,marginBottom:'2px'}}>{value}</div>
                  <div style={{fontFamily:fonts.body,fontSize:'8px',letterSpacing:'0.12em',color:'rgba(255,255,255,0.3)'}}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Giving card */}
        <div style={{background:'rgba(0,0,0,0.3)',backdropFilter:'blur(16px)',border:`0.5px solid ${accent}22`,borderRadius:'20px',padding:'22px'}}>
          {/* Charity */}
          <div style={{marginBottom:'16px'}}>
            <div style={{fontFamily:fonts.body,fontSize:'8.5px',letterSpacing:'0.2em',color:'rgba(255,255,255,0.35)',marginBottom:'10px'}}>Choose a charity</div>
            <div style={{display:'flex',flexDirection:'column',gap:'7px'}}>
              {CHARITIES.map(ch => (
                <button key={ch.id} onClick={() => setCharity(ch)} style={{display:'flex',alignItems:'center',gap:'11px',padding:'11px 13px',background:charity.id===ch.id?`${ch.color}15`:'rgba(255,255,255,0.03)',border:`0.5px solid ${charity.id===ch.id?ch.color+'55':'rgba(255,255,255,0.08)'}`,borderRadius:'10px',cursor:'pointer',textAlign:'left',transition:'all 0.15s'}}>
                  <span style={{fontSize:'18px'}}>{ch.emoji}</span>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:fonts.body,fontSize:'11px',color:charity.id===ch.id?'#fff':'rgba(255,255,255,0.55)',marginBottom:'2px'}}>{ch.name}</div>
                    <div style={{fontFamily:fonts.body,fontSize:'11px',color:'rgba(255,255,255,0.3)',fontStyle:'italic'}}>{ch.desc} · {ch.rate}</div>
                  </div>
                  {charity.id===ch.id && <div style={{width:'16px',height:'16px',borderRadius:'50%',background:ch.color,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><svg width="8" height="6" viewBox="0 0 8 6"><polyline points="1,3 3,5 7,1" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg></div>}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div style={{marginBottom:'16px'}}>
            <div style={{fontFamily:fonts.body,fontSize:'8.5px',letterSpacing:'0.2em',color:'rgba(255,255,255,0.35)',marginBottom:'10px'}}>Choose an amount</div>
            <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'9px'}}>
              {AMOUNTS.map(a => (
                <button key={a} onClick={() => {setAmount(a);setUseCustom(false)}} style={{fontFamily:fonts.body,fontSize:'13px',padding:'9px 0',borderRadius:'100px',cursor:'pointer',flex:'1',minWidth:'44px',background:!useCustom&&amount===a?accent:'rgba(255,255,255,0.05)',color:!useCustom&&amount===a?'#0f1f0f':'rgba(255,255,255,0.6)',border:`0.5px solid ${!useCustom&&amount===a?accent:'rgba(255,255,255,0.1)'}`,transition:'all 0.15s'}}>
                  ${a}
                </button>
              ))}
              <button onClick={() => setUseCustom(true)} style={{fontFamily:fonts.body,fontSize:'13px',padding:'9px 12px',borderRadius:'100px',cursor:'pointer',background:useCustom?accent:'rgba(255,255,255,0.05)',color:useCustom?'#0f1f0f':'rgba(255,255,255,0.6)',border:`0.5px solid ${useCustom?accent:'rgba(255,255,255,0.1)'}`,flex:'1',minWidth:'52px'}}>
                Other
              </button>
            </div>
            {useCustom && (
              <div style={{position:'relative'}}>
                <span style={{position:'absolute',left:'13px',top:'50%',transform:'translateY(-50%)',fontFamily:fonts.body,fontSize:'17px',color:'rgba(255,255,255,0.4)'}}>$</span>
                <input type="number" value={custom} onChange={e => setCustom(e.target.value)} placeholder="Enter amount" min="1" style={{width:'100%',background:'rgba(255,255,255,0.06)',border:`0.5px solid ${accent}35`,borderRadius:'10px',padding:'11px 13px 11px 27px',fontFamily:fonts.body,fontSize:'18px',color:'#fff',outline:'none'}}/>
              </div>
            )}
            {finalAmount >= 1 && (
              <div style={{marginTop:'8px',fontFamily:fonts.body,fontSize:'13px',fontStyle:'italic',color:'rgba(255,255,255,0.4)',textAlign:'center'}}>
                ${finalAmount.toFixed(2)} = <span style={{color:accent}}>{charity.impact(finalAmount)}</span> via {charity.name}
              </div>
            )}
          </div>

          <button onClick={handleDonate} disabled={finalAmount < 1 || donating} style={{width:'100%',fontFamily:fonts.body,fontSize:'12px',letterSpacing:'0.18em',color:finalAmount>=1?'#0f1f0f':'rgba(255,255,255,0.25)',background:finalAmount>=1?accent:'rgba(255,255,255,0.06)',border:'none',borderRadius:'12px',padding:'15px',cursor:finalAmount>=1?'pointer':'not-allowed',transition:'all 0.18s',opacity:donating?0.7:1}}>
            {donating?'Preparing…':finalAmount>=1?`Give $${finalAmount.toFixed(2)} →`:'Select an amount'}
          </button>
          <p style={{fontFamily:fonts.body,fontSize:'12px',color:'rgba(255,255,255,0.2)',textAlign:'center',marginTop:'10px',lineHeight:1.6,fontStyle:'italic'}}>Your donation goes directly to {charity.name}. Green Emblem never handles your payment.</p>
        </div>

        <div style={{textAlign:'center',marginTop:'24px'}}>
          <div style={{fontFamily:fonts.body,fontSize:'15px',color:accent,direction:'rtl',opacity:0.35,marginBottom:'8px'}} lang="ar">بَارَكَ اللَّهُ فِيكُمْ</div>
          <Link href="https://green-emblem.com" style={{fontFamily:fonts.body,fontSize:'9px',letterSpacing:'0.14em',color:'rgba(255,255,255,0.18)',textDecoration:'none'}}>Powered by Green Emblem</Link>
        </div>
      </div>
    </div>
  )
}
