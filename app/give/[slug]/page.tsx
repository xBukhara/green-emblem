'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const CHARITY_OPTIONS = [
  { id:'share_the_meal', name:'Share The Meal', logo:'🌍', desc:"WFP's app — feeds children worldwide", impact:(amt:number)=>`${Math.floor(amt/0.80)} meals`, rate:'$0.80 per meal', color:'#E8A020', buildUrl:(amt:number)=>`https://sharethemeal.org/donate?amount=${amt.toFixed(2)}` },
  { id:'islamic_relief',  name:'Islamic Relief USA', logo:'☪️', desc:'Emergency aid, water, orphan care', impact:(amt:number)=>`$${amt.toFixed(2)} in relief`, rate:'100% to aid', color:'#1D9E75', buildUrl:(amt:number)=>`https://irusa.org/donate/?amount=${amt.toFixed(2)}` },
  { id:'unicef', name:'UNICEF USA', logo:'🔵', desc:"Children's health & education worldwide", impact:(amt:number)=>`$${amt.toFixed(2)} for children`, rate:'100% to children', color:'#378ADD', buildUrl:(amt:number)=>`https://www.unicefusa.org/donate?amount=${amt.toFixed(2)}` },
]
const PRESET_AMOUNTS = [5,10,20,50,100]
const THEME_CONFIGS:Record<string,{bg:string;accent:string;pattern:string}> = {
  forest_gold:{bg:'#0f1f0f',accent:'#d4af6e',pattern:'star8'},
  navy_gold:{bg:'#0a1628',accent:'#d4af6e',pattern:'arabesque'},
  burgundy:{bg:'#1a0508',accent:'#c9956c',pattern:'geometric'},
  purple:{bg:'#120a1e',accent:'#9b8ec4',pattern:'star8'},
  terracotta:{bg:'#1a0f08',accent:'#8fad8a',pattern:'geometric'},
  charcoal:{bg:'#111111',accent:'#c4906a',pattern:'none'},
}
const VERSE_TEXT:Record<string,{ar:string;en:string;source:string}> = {
  tirmidhi_shade:{ar:'الْجَوَادُ قَرِيبٌ مِنَ اللَّهِ',en:'The generous person is close to Allah, close to people, close to Paradise, and far from Hellfire.',source:'Tirmidhi'},
  quran_2_272:{ar:'وَمَا تُنفِقُوا مِنْ خَيْرٍ فَلِأَنفُسِكُمْ',en:'Whatever good you give is for yourselves, and you only give seeking the countenance of Allah.',source:'Quran 2:272'},
  tirmidhi_fire:{ar:'اتَّقُوا النَّارَ وَلَوْ بِشِقِّ تَمْرَةٍ',en:'Save yourselves from Hellfire even by giving half a date in charity.',source:'Bukhari & Muslim'},
}
function PatternBg({type,accent}:{type:string;accent:string}) {
  if(type==='none') return null
  const op=0.06
  if(type==='star8') return <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:op}}><defs><pattern id="star8" width="80" height="80" patternUnits="userSpaceOnUse"><g fill="none" stroke={accent} strokeWidth="0.7"><rect x="20" y="20" width="40" height="40" rx="2"/><rect x="20" y="20" width="40" height="40" rx="2" transform="rotate(45 40 40)"/></g></pattern></defs><rect width="100%" height="100%" fill="url(#star8)"/></svg>
  if(type==='arabesque') return <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:op}}><defs><pattern id="ar" width="60" height="60" patternUnits="userSpaceOnUse"><circle cx="30" cy="30" r="20" fill="none" stroke={accent} strokeWidth="0.7"/><circle cx="30" cy="30" r="10" fill="none" stroke={accent} strokeWidth="0.5"/><line x1="10" y1="30" x2="50" y2="30" stroke={accent} strokeWidth="0.4"/><line x1="30" y1="10" x2="30" y2="50" stroke={accent} strokeWidth="0.4"/></pattern></defs><rect width="100%" height="100%" fill="url(#ar)"/></svg>
  return <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:op}}><defs><pattern id="geo" width="50" height="50" patternUnits="userSpaceOnUse"><polygon points="25,5 45,15 45,35 25,45 5,35 5,15" fill="none" stroke={accent} strokeWidth="0.6"/></pattern></defs><rect width="100%" height="100%" fill="url(#geo)"/></svg>
}

export default function CampaignPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClient()
  const [campaign,setCampaign]=useState<any>(null)
  const [loading,setLoading]=useState(true)
  const [notFound,setNotFound]=useState(false)
  const [amount,setAmount]=useState(10)
  const [customAmount,setCustomAmount]=useState('')
  const [useCustom,setUseCustom]=useState(false)
  const [charity,setCharity]=useState(CHARITY_OPTIONS[0])
  const [donating,setDonating]=useState(false)
  const [step,setStep]=useState<'give'|'confirm'|'thanks'>('give')
  const [donationId,setDonationId]=useState('')
  const [showSignup,setShowSignup]=useState(false)
  const [email,setEmail]=useState('')
  const [signupDone,setSignupDone]=useState(false)
  const [user,setUser]=useState<any>(null)

  const theme=THEME_CONFIGS[campaign?.theme?.color_scheme]||THEME_CONFIGS.forest_gold
  const verse=campaign?.theme?.verse?VERSE_TEXT[campaign.theme.verse]:null
  const greeting=campaign?.theme?.greeting_text||`Welcome to the blessed ${campaign?.event_type||'celebration'} of ${campaign?.honoree_names||''}`

  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>setUser(user))
    supabase.from('campaigns').select('*').eq('slug',slug).eq('status','active').single()
      .then(({data,error})=>{
        if(error||!data){setNotFound(true);setLoading(false);return}
        setCampaign(data);setLoading(false)
      })
  },[slug])

  useEffect(()=>{
    if(!campaign)return
    const interval=setInterval(async()=>{
      const{data}=await supabase.from('campaigns').select('total_raised,donor_count,meals_funded').eq('id',campaign.id).single()
      if(data)setCampaign((c:any)=>({...c,...data}))
    },30000)
    return()=>clearInterval(interval)
  },[campaign?.id])

  const finalAmount=useCustom?parseFloat(customAmount)||0:amount

  const handleDonate=async()=>{
    if(finalAmount<1)return
    setDonating(true)
    const{data:{user}}=await supabase.auth.getUser()
    const{data:donation}=await supabase.from('donations').insert({
      campaign_id:campaign.id,user_id:user?.id||null,donor_email:user?.email||null,
      amount:finalAmount,charity:charity.id,redirect_url:charity.buildUrl(finalAmount),
      meals_funded:charity.id==='share_the_meal'?Math.floor(finalAmount/0.80):null,confirmed:false,
    }).select().single()
    if(donation)setDonationId(donation.id)
    setStep('confirm')
    setDonating(false)
  }

  const handleConfirm=async()=>{
    if(donationId){
      await supabase.from('donations').update({confirmed:true}).eq('id',donationId)
      await supabase.rpc('increment_campaign_stats',{p_campaign_id:campaign.id,p_amount:finalAmount,p_meals:charity.id==='share_the_meal'?Math.floor(finalAmount/0.80):0})
    }
    setStep('thanks')
    setTimeout(()=>window.open(charity.buildUrl(finalAmount),'_blank'),800)
  }

  const handleNewsletterSignup=async()=>{
    if(!email)return
    await supabase.from('profiles').upsert({email,newsletter:true},{onConflict:'email'}).select()
    setSignupDone(true)
  }

  if(loading) return <div style={{minHeight:'100dvh',background:'#0f1f0f',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{fontFamily:'var(--font-cormorant)',fontSize:'16px',color:'rgba(255,255,255,0.4)',fontStyle:'italic'}}>Loading campaign…</div></div>

  if(notFound) return (
    <div style={{minHeight:'100dvh',background:'#0f1f0f',position:'relative',overflow:'hidden'}}>
      <div className="bg-tile" aria-hidden="true"/>
      <div style={{position:'relative',zIndex:2,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100dvh',padding:'40px 24px',textAlign:'center'}}>
        <Link href="/" style={{position:'absolute',top:'20px',left:'50%',transform:'translateX(-50%)',fontFamily:'var(--font-cinzel)',fontSize:'11px',letterSpacing:'0.2em',color:'rgba(212,175,110,0.6)',textDecoration:'none'}}>Green Emblem</Link>
        <h1 style={{fontFamily:'var(--font-cinzel)',fontSize:'22px',color:'#fff',marginBottom:'12px'}}>Campaign pending or not found</h1>
        <p style={{fontFamily:'var(--font-cormorant)',fontSize:'16px',fontStyle:'italic',color:'rgba(255,255,255,0.5)',lineHeight:1.7,maxWidth:'380px',marginBottom:'24px'}}>This campaign may still be under review or the link is incorrect.</p>
        <Link href="/" style={{fontFamily:'var(--font-cinzel)',fontSize:'10px',letterSpacing:'0.14em',color:'var(--forest-dark)',background:'var(--gold)',padding:'12px 24px',borderRadius:'8px',textDecoration:'none'}}>Visit Green Emblem</Link>
      </div>
    </div>
  )

  const bg=theme.bg,accent=theme.accent

  // ── THANKS + SIGNUP ─────────────────────────────────────────────────────────
  if(step==='thanks') return (
    <div style={{minHeight:'100dvh',background:bg,position:'relative',overflow:'hidden'}}>
      <PatternBg type={theme.pattern} accent={accent}/>
      {/* Top nav link */}
      <div style={{position:'absolute',top:0,left:0,right:0,padding:'16px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',zIndex:10}}>
        <Link href="/" style={{fontFamily:'var(--font-cinzel)',fontSize:'10px',letterSpacing:'0.2em',color:accent,textDecoration:'none',opacity:0.7}}>Green Emblem</Link>
        {!user&&<Link href="/auth/sign-in" style={{fontFamily:'var(--font-cinzel)',fontSize:'10px',letterSpacing:'0.14em',color:bg,background:accent,padding:'7px 14px',borderRadius:'6px',textDecoration:'none'}}>Sign in</Link>}
      </div>
      <div style={{position:'relative',zIndex:2,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100dvh',padding:'80px 24px 40px',textAlign:'center'}}>
        <div style={{width:'72px',height:'72px',borderRadius:'50%',background:'rgba(29,158,117,0.12)',border:'0.5px solid rgba(29,158,117,0.35)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 24px'}}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><polyline points="7,16 13,23 25,9" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{fontFamily:'var(--font-cinzel)',fontSize:'9px',letterSpacing:'0.28em',color:accent,marginBottom:'14px'}}>Jazak Allahu Khairan</div>
        <h1 style={{fontFamily:'var(--font-cinzel)',fontSize:'clamp(22px,5vw,34px)',fontWeight:500,color:'#fff',lineHeight:1.15,marginBottom:'12px'}}>May Allah accept your sadaqah</h1>
        <p style={{fontFamily:'var(--font-cormorant)',fontSize:'17px',fontStyle:'italic',color:'rgba(255,255,255,0.6)',lineHeight:1.7,marginBottom:'6px',maxWidth:'400px'}}>
          Your gift of <strong style={{color:accent}}>${finalAmount.toFixed(2)}</strong> in honour of <strong style={{color:'#fff'}}>{campaign.honoree_names}</strong> has been given.
        </p>
        {charity.id==='share_the_meal'&&<p style={{fontFamily:'var(--font-cormorant)',fontSize:'16px',color:'rgba(255,255,255,0.5)',fontStyle:'italic',marginBottom:'28px'}}>That's <strong style={{color:accent}}>{Math.floor(finalAmount/0.80)} meals</strong> for children in need.</p>}
        <div style={{fontFamily:'var(--font-arabic)',fontSize:'22px',color:accent,opacity:0.7,direction:'rtl',marginBottom:'32px'}} lang="ar">تَقَبَّلَ اللَّهُ مِنَّا وَمِنكُمْ</div>

        {/* Sign up / engagement section */}
        {!user&&(
          <div style={{background:'rgba(0,0,0,0.35)',backdropFilter:'blur(16px)',border:`0.5px solid ${accent}30`,borderRadius:'20px',padding:'28px 24px',maxWidth:'420px',width:'100%',marginBottom:'20px'}}>
            <div style={{fontFamily:'var(--font-cinzel)',fontSize:'9px',letterSpacing:'0.22em',color:accent,marginBottom:'10px'}}>See your impact grow</div>
            <h2 style={{fontFamily:'var(--font-cinzel)',fontSize:'18px',color:'#fff',marginBottom:'10px',lineHeight:1.2}}>Track every meal you fund</h2>
            <p style={{fontFamily:'var(--font-cormorant)',fontSize:'14px',color:'rgba(255,255,255,0.55)',fontStyle:'italic',lineHeight:1.7,marginBottom:'20px'}}>
              Create a free Green Emblem account to track your donations, see your lifetime impact, and get <strong style={{color:accent}}>15% off your first shop order</strong>.
            </p>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              <Link href="/auth/sign-in" style={{fontFamily:'var(--font-cinzel)',fontSize:'11px',letterSpacing:'0.16em',color:bg,background:accent,border:'none',borderRadius:'10px',padding:'14px',textDecoration:'none',textAlign:'center',display:'block'}}>
                Create free account →
              </Link>
              <Link href="/sadaqah/request" style={{fontFamily:'var(--font-cinzel)',fontSize:'10px',letterSpacing:'0.14em',color:accent,border:`0.5px solid ${accent}50`,borderRadius:'10px',padding:'12px',textDecoration:'none',textAlign:'center',display:'block'}}>
                Start your own campaign
              </Link>
            </div>
          </div>
        )}

        {/* Newsletter signup */}
        <div style={{background:'rgba(0,0,0,0.25)',backdropFilter:'blur(12px)',border:`0.5px solid ${accent}20`,borderRadius:'16px',padding:'20px 24px',maxWidth:'420px',width:'100%'}}>
          {signupDone?(
            <div style={{textAlign:'center'}}>
              <div style={{fontFamily:'var(--font-cinzel)',fontSize:'12px',color:accent,marginBottom:'4px'}}>JazakAllahu Khairan</div>
              <div style={{fontFamily:'var(--font-cormorant)',fontSize:'14px',color:'rgba(255,255,255,0.5)',fontStyle:'italic'}}>You're on the list. We'll be in touch, in sha Allah.</div>
            </div>
          ):(
            <>
              <div style={{fontFamily:'var(--font-cinzel)',fontSize:'9px',letterSpacing:'0.18em',color:accent,marginBottom:'8px'}}>Stay connected</div>
              <p style={{fontFamily:'var(--font-cormorant)',fontSize:'13px',color:'rgba(255,255,255,0.5)',fontStyle:'italic',lineHeight:1.6,marginBottom:'14px'}}>
                Join our newsletter for an immersive experience with Green Emblem — prayer times, halal guides, Islamic events near you, and more.
              </p>
              <div style={{display:'flex',gap:'8px'}}>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" style={{flex:1,background:'rgba(255,255,255,0.07)',border:`0.5px solid ${accent}30`,borderRadius:'8px',padding:'10px 12px',fontFamily:'var(--font-cormorant)',fontSize:'14px',color:'#fff',outline:'none'}}/>
                <button onClick={handleNewsletterSignup} style={{fontFamily:'var(--font-cinzel)',fontSize:'9px',letterSpacing:'0.12em',color:bg,background:accent,border:'none',borderRadius:'8px',padding:'10px 14px',cursor:'pointer',whiteSpace:'nowrap'}}>Join</button>
              </div>
            </>
          )}
        </div>

        <Link href="https://green-emblem.com" style={{fontFamily:'var(--font-cinzel)',fontSize:'9px',letterSpacing:'0.14em',color:'rgba(255,255,255,0.2)',textDecoration:'none',marginTop:'28px'}}>
          Powered by Green Emblem →
        </Link>
      </div>
    </div>
  )

  // ── CONFIRM ─────────────────────────────────────────────────────────────────
  if(step==='confirm') return (
    <div style={{minHeight:'100dvh',background:bg,position:'relative',overflow:'hidden'}}>
      <PatternBg type={theme.pattern} accent={accent}/>
      <div style={{position:'absolute',top:0,left:0,right:0,padding:'16px 24px',zIndex:10}}>
        <Link href="/" style={{fontFamily:'var(--font-cinzel)',fontSize:'10px',letterSpacing:'0.2em',color:accent,textDecoration:'none',opacity:0.7}}>Green Emblem</Link>
      </div>
      <div style={{position:'relative',zIndex:2,display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100dvh',padding:'24px'}}>
        <div style={{background:'rgba(0,0,0,0.3)',backdropFilter:'blur(12px)',border:`0.5px solid ${accent}30`,borderRadius:'20px',width:'100%',maxWidth:'420px',padding:'32px 28px',textAlign:'center'}}>
          <div style={{fontFamily:'var(--font-cinzel)',fontSize:'9px',letterSpacing:'0.28em',color:accent,marginBottom:'20px'}}>Confirm your sadaqah</div>
          <div style={{background:'rgba(255,255,255,0.05)',borderRadius:'12px',padding:'20px',marginBottom:'20px'}}>
            <div style={{fontFamily:'var(--font-cinzel)',fontSize:'32px',color:accent,marginBottom:'4px'}}>${finalAmount.toFixed(2)}</div>
            <div style={{fontFamily:'var(--font-cormorant)',fontSize:'15px',color:'rgba(255,255,255,0.6)',fontStyle:'italic',marginBottom:'8px'}}>via {charity.name}</div>
            <div style={{fontFamily:'var(--font-cormorant)',fontSize:'14px',color:'rgba(255,255,255,0.5)',fontStyle:'italic'}}>In honour of {campaign.honoree_names}</div>
            {charity.id==='share_the_meal'&&<div style={{marginTop:'12px',fontFamily:'var(--font-cinzel)',fontSize:'10px',letterSpacing:'0.1em',color:'rgba(255,255,255,0.4)'}}>= {Math.floor(finalAmount/0.80)} meals for children</div>}
          </div>
          <p style={{fontFamily:'var(--font-cormorant)',fontSize:'13px',color:'rgba(255,255,255,0.4)',fontStyle:'italic',lineHeight:1.6,marginBottom:'20px'}}>You'll be taken to {charity.name}'s website to complete your donation. Green Emblem never handles your payment.</p>
          <button onClick={handleConfirm} style={{width:'100%',fontFamily:'var(--font-cinzel)',fontSize:'11px',letterSpacing:'0.16em',color:bg,background:accent,border:'none',borderRadius:'10px',padding:'15px',cursor:'pointer',marginBottom:'10px'}}>Continue to {charity.name} →</button>
          <button onClick={()=>setStep('give')} style={{background:'none',border:'none',fontFamily:'var(--font-cinzel)',fontSize:'9px',letterSpacing:'0.12em',color:'rgba(255,255,255,0.3)',cursor:'pointer'}}>← Go back</button>
        </div>
      </div>
    </div>
  )

  // ── MAIN GIVING PAGE ─────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:'100dvh',background:bg,position:'relative',overflow:'hidden'}}>
      <PatternBg type={theme.pattern} accent={accent}/>
      {/* Top bar */}
      <div style={{position:'absolute',top:0,left:0,right:0,padding:'16px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',zIndex:10,background:'rgba(0,0,0,0.15)',backdropFilter:'blur(8px)'}}>
        <Link href="/" style={{fontFamily:'var(--font-cinzel)',fontSize:'10px',letterSpacing:'0.18em',color:accent,textDecoration:'none',opacity:0.8}}>Green Emblem</Link>
        {!user?(
          <Link href="/auth/sign-in" style={{fontFamily:'var(--font-cinzel)',fontSize:'9px',letterSpacing:'0.12em',color:bg,background:accent,padding:'6px 14px',borderRadius:'6px',textDecoration:'none',opacity:0.9}}>Sign in</Link>
        ):(
          <Link href="/dashboard" style={{fontFamily:'var(--font-cinzel)',fontSize:'9px',letterSpacing:'0.12em',color:accent,border:`0.5px solid ${accent}50`,padding:'6px 12px',borderRadius:'6px',textDecoration:'none'}}>My dashboard</Link>
        )}
      </div>

      <div style={{position:'relative',zIndex:2,maxWidth:'520px',margin:'0 auto',padding:'72px 20px 60px'}}>
        {/* Header */}
        <div style={{textAlign:'center',marginBottom:'28px'}}>
          <div style={{display:'flex',justifyContent:'center',marginBottom:'16px'}}>
            <svg width="44" height="44" viewBox="25 35 170 155"><rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke={accent} strokeWidth="2" transform="rotate(0 110 110)" opacity="0.5"/><rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke={accent} strokeWidth="2" transform="rotate(45 110 110)" opacity="0.5"/><polygon points="110,42 158,42 190,74 190,146 158,178 62,178 30,146 30,74 62,42" fill="#2e6b2e" stroke={accent} strokeWidth="2"/><circle cx="103" cy="104" r="44" fill={accent}/><circle cx="117" cy="96" r="37" fill="#2e6b2e"/><g transform="translate(158,82)"><polygon points="0,-16 3.8,-6.2 14.8,-5 6.8,3 9.4,14 0,8.2 -9.4,14 -6.8,3 -14.8,-5 -3.8,-6.2" fill={accent}/></g></svg>
          </div>
          <div style={{fontFamily:'var(--font-cinzel)',fontSize:'8px',letterSpacing:'0.28em',color:accent,marginBottom:'10px',opacity:0.8}}>بَابُ الصَّدَقَة · Baab As-Sadaqah</div>
          <p style={{fontFamily:'var(--font-cormorant)',fontSize:'clamp(15px,3.5vw,18px)',fontStyle:'italic',color:'rgba(255,255,255,0.7)',lineHeight:1.6,marginBottom:'14px'}}>{greeting}</p>
          <h1 style={{fontFamily:'var(--font-cinzel)',fontSize:'clamp(22px,6vw,38px)',fontWeight:500,color:'#fff',lineHeight:1.1,marginBottom:'6px'}}>{campaign.honoree_names}</h1>
          <div style={{fontFamily:'var(--font-cinzel)',fontSize:'10px',letterSpacing:'0.18em',color:'rgba(255,255,255,0.35)',marginBottom:'20px'}}>
            {campaign.event_type&&campaign.event_type!=='Other'?campaign.event_type:''}{campaign.event_date?` · ${campaign.event_date}`:''}{campaign.location?` · ${campaign.location}`:''}
          </div>
          {verse&&(
            <div style={{background:'rgba(255,255,255,0.04)',border:`0.5px solid ${accent}25`,borderRadius:'12px',padding:'16px',marginBottom:'20px'}}>
              <div style={{fontFamily:'var(--font-arabic)',fontSize:'17px',color:accent,direction:'rtl',marginBottom:'8px',lineHeight:1.6,opacity:0.9}} lang="ar">{verse.ar}</div>
              <p style={{fontFamily:'var(--font-cormorant)',fontSize:'14px',fontStyle:'italic',color:'rgba(255,255,255,0.6)',lineHeight:1.7,marginBottom:'5px'}}>"{verse.en}"</p>
              <div style={{fontFamily:'var(--font-cinzel)',fontSize:'9px',letterSpacing:'0.12em',color:'rgba(255,255,255,0.25)'}}>— {verse.source}</div>
            </div>
          )}
          {(campaign.total_raised>0||campaign.donor_count>0)&&(
            <div style={{display:'flex',gap:'10px',justifyContent:'center',marginBottom:'20px'}}>
              {[{label:'Raised',value:`$${campaign.total_raised?.toFixed(2)||'0.00'}`},{label:'Donors',value:campaign.donor_count||0},...(campaign.meals_funded>0?[{label:'Meals',value:campaign.meals_funded}]:[])].map(({label,value})=>(
                <div key={label} style={{background:'rgba(255,255,255,0.06)',borderRadius:'10px',padding:'10px 14px',textAlign:'center',flex:1}}>
                  <div style={{fontFamily:'var(--font-cinzel)',fontSize:'18px',color:accent,marginBottom:'3px'}}>{value}</div>
                  <div style={{fontFamily:'var(--font-cinzel)',fontSize:'8px',letterSpacing:'0.14em',color:'rgba(255,255,255,0.3)'}}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Giving card */}
        <div style={{background:'rgba(0,0,0,0.3)',backdropFilter:'blur(16px)',border:`0.5px solid ${accent}25`,borderRadius:'20px',padding:'22px'}}>
          {/* Charity selector */}
          <div style={{marginBottom:'18px'}}>
            <div style={{fontFamily:'var(--font-cinzel)',fontSize:'8.5px',letterSpacing:'0.2em',color:'rgba(255,255,255,0.35)',marginBottom:'10px'}}>Choose a charity</div>
            <div style={{display:'flex',flexDirection:'column',gap:'7px'}}>
              {CHARITY_OPTIONS.map(ch=>(
                <button key={ch.id} onClick={()=>setCharity(ch)} style={{display:'flex',alignItems:'center',gap:'12px',padding:'11px 13px',background:charity.id===ch.id?`${ch.color}18`:'rgba(255,255,255,0.03)',border:`0.5px solid ${charity.id===ch.id?ch.color+'60':'rgba(255,255,255,0.08)'}`,borderRadius:'10px',cursor:'pointer',textAlign:'left',transition:'all 0.15s'}}>
                  <span style={{fontSize:'18px'}}>{ch.logo}</span>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:'var(--font-cinzel)',fontSize:'10px',color:charity.id===ch.id?'#fff':'rgba(255,255,255,0.55)',marginBottom:'2px'}}>{ch.name}</div>
                    <div style={{fontFamily:'var(--font-cormorant)',fontSize:'12px',color:'rgba(255,255,255,0.35)',fontStyle:'italic'}}>{ch.desc} · {ch.rate}</div>
                  </div>
                  {charity.id===ch.id&&<div style={{width:'16px',height:'16px',borderRadius:'50%',background:ch.color,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><svg width="8" height="6" viewBox="0 0 8 6"><polyline points="1,3 3,5 7,1" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg></div>}
                </button>
              ))}
            </div>
          </div>
          {/* Amount */}
          <div style={{marginBottom:'18px'}}>
            <div style={{fontFamily:'var(--font-cinzel)',fontSize:'8.5px',letterSpacing:'0.2em',color:'rgba(255,255,255,0.35)',marginBottom:'10px'}}>Choose an amount</div>
            <div style={{display:'flex',gap:'7px',flexWrap:'wrap',marginBottom:'9px'}}>
              {PRESET_AMOUNTS.map(a=>(
                <button key={a} onClick={()=>{setAmount(a);setUseCustom(false)}} style={{fontFamily:'var(--font-cinzel)',fontSize:'12px',letterSpacing:'0.08em',padding:'9px 14px',borderRadius:'100px',cursor:'pointer',flex:'1',minWidth:'48px',background:!useCustom&&amount===a?accent:'rgba(255,255,255,0.05)',color:!useCustom&&amount===a?bg:'rgba(255,255,255,0.6)',border:`0.5px solid ${!useCustom&&amount===a?accent:'rgba(255,255,255,0.1)'}`,transition:'all 0.15s'}}>
                  ${a}
                </button>
              ))}
              <button onClick={()=>setUseCustom(true)} style={{fontFamily:'var(--font-cinzel)',fontSize:'12px',letterSpacing:'0.08em',padding:'9px 14px',borderRadius:'100px',cursor:'pointer',background:useCustom?accent:'rgba(255,255,255,0.05)',color:useCustom?bg:'rgba(255,255,255,0.6)',border:`0.5px solid ${useCustom?accent:'rgba(255,255,255,0.1)'}`,flex:'1',minWidth:'48px'}}>
                Other
              </button>
            </div>
            {useCustom&&(
              <div style={{position:'relative'}}>
                <span style={{position:'absolute',left:'13px',top:'50%',transform:'translateY(-50%)',fontFamily:'var(--font-cinzel)',fontSize:'16px',color:'rgba(255,255,255,0.5)'}}>$</span>
                <input type="number" value={customAmount} onChange={e=>setCustomAmount(e.target.value)} placeholder="Enter amount" min="1" style={{width:'100%',background:'rgba(255,255,255,0.06)',border:`0.5px solid ${accent}40`,borderRadius:'10px',padding:'11px 13px 11px 27px',fontFamily:'var(--font-cinzel)',fontSize:'18px',color:'#fff',outline:'none'}}/>
              </div>
            )}
            {finalAmount>=1&&(
              <div style={{marginTop:'9px',fontFamily:'var(--font-cormorant)',fontSize:'14px',fontStyle:'italic',color:'rgba(255,255,255,0.45)',textAlign:'center'}}>
                ${finalAmount.toFixed(2)} = <span style={{color:accent}}>{charity.impact(finalAmount)}</span> via {charity.name}
              </div>
            )}
          </div>
          <button onClick={handleDonate} disabled={finalAmount<1||donating} style={{width:'100%',fontFamily:'var(--font-cinzel)',fontSize:'12px',letterSpacing:'0.18em',color:finalAmount>=1?bg:'rgba(255,255,255,0.3)',background:finalAmount>=1?accent:'rgba(255,255,255,0.06)',border:'none',borderRadius:'12px',padding:'15px',cursor:finalAmount>=1?'pointer':'not-allowed',transition:'all 0.18s',opacity:donating?0.7:1}}>
            {donating?'Preparing…':finalAmount>=1?`Give $${finalAmount.toFixed(2)} →`:'Select an amount'}
          </button>
          <p style={{fontFamily:'var(--font-cormorant)',fontSize:'12px',color:'rgba(255,255,255,0.25)',textAlign:'center',marginTop:'10px',lineHeight:1.6,fontStyle:'italic'}}>Your donation goes directly to {charity.name}. Green Emblem never handles your payment.</p>
        </div>

        {/* Footer */}
        <div style={{textAlign:'center',marginTop:'28px'}}>
          <div style={{fontFamily:'var(--font-arabic)',fontSize:'16px',color:accent,direction:'rtl',opacity:0.45,marginBottom:'8px'}} lang="ar">بَارَكَ اللَّهُ فِيكُمْ</div>
          <Link href="https://green-emblem.com" style={{fontFamily:'var(--font-cinzel)',fontSize:'9px',letterSpacing:'0.14em',color:'rgba(255,255,255,0.2)',textDecoration:'none'}}>Powered by Green Emblem →</Link>
        </div>
      </div>
    </div>
  )
}
