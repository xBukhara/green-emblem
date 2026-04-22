'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const CHARITY_OPTIONS = [
  {
    id: 'share_the_meal',
    name: 'Share The Meal',
    logo: '🌍',
    desc: 'WFP\'s app — feeds children worldwide',
    impact: (amt: number) => `${Math.floor(amt / 0.80)} meals`,
    rate: '$0.80 per meal',
    color: '#E8A020',
    buildUrl: (amt: number) => `https://sharethemeal.org/donate?amount=${amt.toFixed(2)}&utm_source=green-emblem&utm_medium=event-qr&utm_campaign=baab-as-sadaqah`,
  },
  {
    id: 'islamic_relief',
    name: 'Islamic Relief USA',
    logo: '☪️',
    desc: 'Emergency aid, water, orphan care',
    impact: (amt: number) => `$${amt.toFixed(2)} in relief`,
    rate: '100% to aid',
    color: '#1D9E75',
    buildUrl: (amt: number) => `https://irusa.org/donate/?amount=${amt.toFixed(2)}`,
  },
  {
    id: 'unicef',
    name: 'UNICEF USA',
    logo: '🔵',
    desc: 'Children\'s health & education worldwide',
    impact: (amt: number) => `$${amt.toFixed(2)} for children`,
    rate: '100% to children',
    color: '#378ADD',
    buildUrl: (amt: number) => `https://www.unicefusa.org/donate?amount=${amt.toFixed(2)}`,
  },
]

const PRESET_AMOUNTS = [5, 10, 20, 50, 100]

const THEME_CONFIGS: Record<string, { bg: string; accent: string; pattern: string }> = {
  forest_gold:  { bg: '#0f1f0f', accent: '#d4af6e', pattern: 'star8' },
  navy_gold:    { bg: '#0a1628', accent: '#d4af6e', pattern: 'arabesque' },
  burgundy:     { bg: '#1a0508', accent: '#c9956c', pattern: 'geometric' },
  purple:       { bg: '#120a1e', accent: '#9b8ec4', pattern: 'star8' },
  terracotta:   { bg: '#1a0f08', accent: '#8fad8a', pattern: 'geometric' },
  charcoal:     { bg: '#111111', accent: '#c4906a', pattern: 'none' },
}

const VERSE_TEXT: Record<string, { ar: string; en: string; source: string }> = {
  tirmidhi_shade: {
    ar: 'الْجَوَادُ قَرِيبٌ مِنَ اللَّهِ',
    en: 'The generous person is close to Allah, close to people, close to Paradise, and far from Hellfire.',
    source: 'Tirmidhi',
  },
  quran_2_272: {
    ar: 'وَمَا تُنفِقُوا مِنْ خَيْرٍ فَلِأَنفُسِكُمْ',
    en: 'Whatever good you give is for yourselves, and you only give seeking the countenance of Allah.',
    source: 'Quran 2:272',
  },
  tirmidhi_fire: {
    ar: 'اتَّقُوا النَّارَ وَلَوْ بِشِقِّ تَمْرَةٍ',
    en: 'Save yourselves from Hellfire even by giving half a date in charity.',
    source: 'Bukhari & Muslim',
  },
}

// SVG background patterns
function PatternBg({ type, accent }: { type: string; accent: string }) {
  if (type === 'none') return null
  const op = 0.06
  if (type === 'star8') return (
    <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:op }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="star8" width="80" height="80" patternUnits="userSpaceOnUse">
          <g fill="none" stroke={accent} strokeWidth="0.7">
            <rect x="20" y="20" width="40" height="40" rx="2"/>
            <rect x="20" y="20" width="40" height="40" rx="2" transform="rotate(45 40 40)"/>
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#star8)"/>
    </svg>
  )
  if (type === 'arabesque') return (
    <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:op }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="arabesque" width="60" height="60" patternUnits="userSpaceOnUse">
          <circle cx="30" cy="30" r="20" fill="none" stroke={accent} strokeWidth="0.7"/>
          <circle cx="30" cy="30" r="10" fill="none" stroke={accent} strokeWidth="0.5"/>
          <line x1="10" y1="30" x2="50" y2="30" stroke={accent} strokeWidth="0.4"/>
          <line x1="30" y1="10" x2="30" y2="50" stroke={accent} strokeWidth="0.4"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#arabesque)"/>
    </svg>
  )
  return (
    <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:op }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="geo" width="50" height="50" patternUnits="userSpaceOnUse">
          <polygon points="25,5 45,15 45,35 25,45 5,35 5,15" fill="none" stroke={accent} strokeWidth="0.6"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#geo)"/>
    </svg>
  )
}

export default function CampaignPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClient()

  const [campaign, setCampaign] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [amount, setAmount] = useState(10)
  const [customAmount, setCustomAmount] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [charity, setCharity] = useState(CHARITY_OPTIONS[0])
  const [donating, setDonating] = useState(false)
  const [step, setStep] = useState<'give'|'confirm'|'thanks'>('give')
  const [donationId, setDonationId] = useState('')

  const theme = THEME_CONFIGS[campaign?.theme?.color_scheme] || THEME_CONFIGS.forest_gold
  const verse = campaign?.theme?.verse ? VERSE_TEXT[campaign.theme.verse] : null
  const customVerseText = campaign?.theme?.custom_verse
  const greeting = campaign?.theme?.greeting_text || `Welcome to the blessed ${campaign?.event_type || 'celebration'} of ${campaign?.honoree_names || ''}`

  useEffect(() => {
    supabase.from('campaigns').select('*').eq('slug', slug).eq('status', 'active').single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); setLoading(false); return }
        setCampaign(data)
        setLoading(false)
      })
  }, [slug])

  const finalAmount = useCustom ? parseFloat(customAmount) || 0 : amount

  const handleDonate = async () => {
    if (finalAmount < 1) return
    setDonating(true)

    // Log donation intent
    const { data: { user } } = await supabase.auth.getUser()
    const { data: donation } = await supabase.from('donations').insert({
      campaign_id: campaign.id,
      user_id: user?.id || null,
      donor_email: user?.email || null,
      amount: finalAmount,
      charity: charity.id,
      redirect_url: charity.buildUrl(finalAmount),
      meals_funded: charity.id === 'share_the_meal' ? Math.floor(finalAmount / 0.80) : null,
      confirmed: false,
    }).select().single()

    if (donation) {
      setDonationId(donation.id)
      setStep('confirm')
    }
    setDonating(false)
  }

  const handleConfirm = async () => {
    // Mark confirmed and redirect to charity
    if (donationId) {
      await supabase.from('donations').update({ confirmed: true }).eq('id', donationId)
      // Update campaign stats
      await supabase.rpc('increment_campaign_stats', {
        p_campaign_id: campaign.id,
        p_amount: finalAmount,
        p_meals: charity.id === 'share_the_meal' ? Math.floor(finalAmount / 0.80) : 0,
      })
    }
    // Open charity in new tab, show thanks screen
    window.open(charity.buildUrl(finalAmount), '_blank')
    setStep('thanks')
  }

  if (loading) return (
    <div style={{ minHeight:'100dvh', background:'#0f1f0f', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'16px', color:'rgba(255,255,255,0.4)', fontStyle:'italic' }}>Loading campaign…</div>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight:'100dvh', background:'#0f1f0f', display:'flex', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'24px' }}>
      <div>
        <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.28em', color:'rgba(212,175,110,0.5)', marginBottom:'14px' }}>Baab As-Sadaqah</div>
        <h1 style={{ fontFamily:'var(--font-cinzel)', fontSize:'24px', color:'#fff', marginBottom:'12px' }}>Campaign not found</h1>
        <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'16px', color:'rgba(255,255,255,0.45)', fontStyle:'italic' }}>
          This campaign may have ended or the link is incorrect.
        </p>
        <a href="/" style={{ display:'inline-block', marginTop:'24px', fontFamily:'var(--font-cinzel)', fontSize:'10px', letterSpacing:'0.14em', color:'#0f1f0f', background:'#d4af6e', padding:'12px 24px', borderRadius:'8px', textDecoration:'none' }}>
          Return home
        </a>
      </div>
    </div>
  )

  const bgColor = theme.bg
  const accentColor = theme.accent

  // ── THANKS SCREEN ──────────────────────────────────────────────────────────
  if (step === 'thanks') return (
    <div style={{ minHeight:'100dvh', background:bgColor, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', position:'relative', overflow:'hidden' }}>
      <PatternBg type={theme.pattern} accent={accentColor}/>
      <div style={{ position:'relative', zIndex:2, textAlign:'center', maxWidth:'440px' }}>
        <div style={{ width:'72px', height:'72px', borderRadius:'50%', background:'rgba(29,158,117,0.12)', border:`0.5px solid rgba(29,158,117,0.35)`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px' }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><polyline points="7,16 13,23 25,9" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.28em', color:accentColor, marginBottom:'14px' }}>Barak Allahu Feek</div>
        <h1 style={{ fontFamily:'var(--font-cinzel)', fontSize:'clamp(24px,5vw,36px)', fontWeight:500, color:'#fff', lineHeight:1.15, marginBottom:'12px' }}>
          Jazak Allahu Khairan
        </h1>
        <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'17px', fontStyle:'italic', color:'rgba(255,255,255,0.6)', lineHeight:1.7, marginBottom:'8px' }}>
          Your sadaqah of <strong style={{ color:accentColor }}>${finalAmount.toFixed(2)}</strong> has been given in honour of <strong style={{ color:'#fff' }}>{campaign.honoree_names}</strong>.
        </p>
        {charity.id === 'share_the_meal' && (
          <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'16px', color:'rgba(255,255,255,0.5)', fontStyle:'italic', marginBottom:'24px' }}>
            That's <strong style={{ color:accentColor }}>{Math.floor(finalAmount / 0.80)} meals</strong> for children in need. In sha Allah it is accepted.
          </p>
        )}
        <div style={{ fontFamily:'var(--font-arabic)', fontSize:'22px', color:accentColor, opacity:0.7, direction:'rtl', marginBottom:'24px' }} lang="ar">
          تَقَبَّلَ اللَّهُ مِنَّا وَمِنكُمْ
        </div>
        <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'rgba(255,255,255,0.3)', fontStyle:'italic' }}>
          May Allah accept from us and from you.
        </div>
      </div>
    </div>
  )

  // ── CONFIRM SCREEN ─────────────────────────────────────────────────────────
  if (step === 'confirm') return (
    <div style={{ minHeight:'100dvh', background:bgColor, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', position:'relative', overflow:'hidden' }}>
      <PatternBg type={theme.pattern} accent={accentColor}/>
      <div style={{ position:'relative', zIndex:2, maxWidth:'420px', width:'100%' }}>
        <div style={{ background:'rgba(0,0,0,0.3)', backdropFilter:'blur(12px)', border:`0.5px solid ${accentColor}30`, borderRadius:'20px', padding:'32px 28px', textAlign:'center' }}>
          <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.28em', color:accentColor, marginBottom:'20px' }}>Confirm your sadaqah</div>
          <div style={{ background:'rgba(255,255,255,0.05)', borderRadius:'12px', padding:'20px', marginBottom:'20px' }}>
            <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'32px', color:accentColor, marginBottom:'4px' }}>${finalAmount.toFixed(2)}</div>
            <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'15px', color:'rgba(255,255,255,0.6)', fontStyle:'italic', marginBottom:'8px' }}>
              via {charity.name}
            </div>
            <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'14px', color:'rgba(255,255,255,0.5)', fontStyle:'italic' }}>
              In honour of {campaign.honoree_names}
            </div>
            {charity.id === 'share_the_meal' && (
              <div style={{ marginTop:'12px', fontFamily:'var(--font-cinzel)', fontSize:'10px', letterSpacing:'0.1em', color:'rgba(255,255,255,0.4)' }}>
                = {Math.floor(finalAmount / 0.80)} meals for children
              </div>
            )}
          </div>
          <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'rgba(255,255,255,0.4)', fontStyle:'italic', lineHeight:1.6, marginBottom:'20px' }}>
            You'll be taken to {charity.name}'s website to complete your donation. Your payment is handled entirely by them — Green Emblem never touches your money.
          </p>
          <button onClick={handleConfirm} style={{ width:'100%', fontFamily:'var(--font-cinzel)', fontSize:'11px', letterSpacing:'0.16em', color:'#0f1f0f', background:accentColor, border:'none', borderRadius:'10px', padding:'15px', cursor:'pointer', marginBottom:'10px' }}>
            Continue to {charity.name} →
          </button>
          <button onClick={() => setStep('give')} style={{ background:'none', border:'none', fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.12em', color:'rgba(255,255,255,0.3)', cursor:'pointer' }}>
            ← Go back
          </button>
        </div>
      </div>
    </div>
  )

  // ── MAIN GIVING PAGE ───────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100dvh', background:bgColor, position:'relative', overflow:'hidden' }}>
      <PatternBg type={theme.pattern} accent={accentColor}/>

      <div style={{ position:'relative', zIndex:2, maxWidth:'520px', margin:'0 auto', padding:'0 20px 60px' }}>

        {/* Header */}
        <div style={{ paddingTop:'48px', textAlign:'center', marginBottom:'32px' }}>
          {/* Green Emblem logo mark */}
          <div style={{ display:'flex', justifyContent:'center', marginBottom:'20px' }}>
            <svg width="48" height="48" viewBox="25 35 170 155" xmlns="http://www.w3.org/2000/svg">
              <rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke={accentColor} strokeWidth="2" transform="rotate(0 110 110)" opacity="0.5"/>
              <rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke={accentColor} strokeWidth="2" transform="rotate(45 110 110)" opacity="0.5"/>
              <polygon points="110,42 158,42 190,74 190,146 158,178 62,178 30,146 30,74 62,42" fill="#2e6b2e" stroke={accentColor} strokeWidth="2"/>
              <circle cx="103" cy="104" r="44" fill={accentColor}/>
              <circle cx="117" cy="96" r="37" fill="#2e6b2e"/>
              <g transform="translate(158,82)"><polygon points="0,-16 3.8,-6.2 14.8,-5 6.8,3 9.4,14 0,8.2 -9.4,14 -6.8,3 -14.8,-5 -3.8,-6.2" fill={accentColor}/></g>
            </svg>
          </div>

          <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'8.5px', letterSpacing:'0.28em', color:accentColor, marginBottom:'10px', opacity:0.8 }}>
            بَابُ الصَّدَقَة · Baab As-Sadaqah
          </div>

          {/* Greeting */}
          <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'clamp(16px,4vw,20px)', fontStyle:'italic', color:'rgba(255,255,255,0.7)', lineHeight:1.6, marginBottom:'16px' }}>
            {greeting}
          </p>

          <h1 style={{ fontFamily:'var(--font-cinzel)', fontSize:'clamp(24px,6vw,40px)', fontWeight:500, color:'#fff', lineHeight:1.1, marginBottom:'6px' }}>
            {campaign.honoree_names}
          </h1>
          <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'10px', letterSpacing:'0.18em', color:'rgba(255,255,255,0.35)', marginBottom:'24px' }}>
            {campaign.event_type && campaign.event_type !== 'Other' ? campaign.event_type : ''}{campaign.event_date ? ` · ${campaign.event_date}` : ''}{campaign.location ? ` · ${campaign.location}` : ''}
          </div>

          {/* Verse */}
          {(verse || customVerseText) && (
            <div style={{ background:'rgba(255,255,255,0.04)', border:`0.5px solid ${accentColor}25`, borderRadius:'12px', padding:'18px', marginBottom:'24px' }}>
              {verse && (
                <div style={{ fontFamily:'var(--font-arabic)', fontSize:'18px', color:accentColor, direction:'rtl', marginBottom:'10px', lineHeight:1.6, opacity:0.9 }} lang="ar">
                  {verse.ar}
                </div>
              )}
              <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'15px', fontStyle:'italic', color:'rgba(255,255,255,0.6)', lineHeight:1.7, marginBottom:'6px' }}>
                "{verse?.en || customVerseText}"
              </p>
              {verse?.source && (
                <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.12em', color:'rgba(255,255,255,0.25)' }}>— {verse.source}</div>
              )}
            </div>
          )}

          {/* Live stats */}
          {(campaign.total_raised > 0 || campaign.donor_count > 0) && (
            <div style={{ display:'flex', gap:'12px', justifyContent:'center', marginBottom:'24px' }}>
              {[
                { label:'Raised', value:`$${campaign.total_raised?.toFixed(2) || '0.00'}` },
                { label:'Donors', value:campaign.donor_count || 0 },
                ...(campaign.meals_funded > 0 ? [{ label:'Meals', value:campaign.meals_funded }] : []),
              ].map(({ label, value }) => (
                <div key={label} style={{ background:'rgba(255,255,255,0.05)', borderRadius:'10px', padding:'12px 16px', textAlign:'center', flex:1 }}>
                  <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'18px', color:accentColor, marginBottom:'3px' }}>{value}</div>
                  <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.14em', color:'rgba(255,255,255,0.3)' }}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Giving card */}
        <div style={{ background:'rgba(0,0,0,0.3)', backdropFilter:'blur(16px)', border:`0.5px solid ${accentColor}25`, borderRadius:'20px', padding:'24px' }}>

          {/* Charity selector */}
          <div style={{ marginBottom:'20px' }}>
            <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'8.5px', letterSpacing:'0.2em', color:'rgba(255,255,255,0.35)', marginBottom:'10px' }}>Choose a charity</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {CHARITY_OPTIONS.map(ch => (
                <button key={ch.id} onClick={() => setCharity(ch)} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', background: charity.id === ch.id ? `${ch.color}18` : 'rgba(255,255,255,0.03)', border:`0.5px solid ${charity.id === ch.id ? ch.color+'60' : 'rgba(255,255,255,0.08)'}`, borderRadius:'10px', cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}>
                  <span style={{ fontSize:'20px' }}>{ch.logo}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'11px', color: charity.id === ch.id ? '#fff' : 'rgba(255,255,255,0.55)', marginBottom:'2px' }}>{ch.name}</div>
                    <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'rgba(255,255,255,0.35)', fontStyle:'italic' }}>{ch.desc} · {ch.rate}</div>
                  </div>
                  {charity.id === ch.id && (
                    <div style={{ width:'16px', height:'16px', borderRadius:'50%', background:ch.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <svg width="8" height="6" viewBox="0 0 8 6"><polyline points="1,3 3,5 7,1" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Amount selector */}
          <div style={{ marginBottom:'20px' }}>
            <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'8.5px', letterSpacing:'0.2em', color:'rgba(255,255,255,0.35)', marginBottom:'10px' }}>Choose an amount</div>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'10px' }}>
              {PRESET_AMOUNTS.map(a => (
                <button key={a} onClick={() => { setAmount(a); setUseCustom(false) }} style={{ fontFamily:'var(--font-cinzel)', fontSize:'12px', letterSpacing:'0.08em', padding:'10px 16px', borderRadius:'100px', cursor:'pointer', flex:'1', minWidth:'52px', background: !useCustom && amount === a ? accentColor : 'rgba(255,255,255,0.05)', color: !useCustom && amount === a ? '#0f1f0f' : 'rgba(255,255,255,0.6)', border:`0.5px solid ${!useCustom && amount === a ? accentColor : 'rgba(255,255,255,0.1)'}`, transition:'all 0.15s' }}>
                  ${a}
                </button>
              ))}
              <button onClick={() => setUseCustom(true)} style={{ fontFamily:'var(--font-cinzel)', fontSize:'12px', letterSpacing:'0.08em', padding:'10px 16px', borderRadius:'100px', cursor:'pointer', background: useCustom ? accentColor : 'rgba(255,255,255,0.05)', color: useCustom ? '#0f1f0f' : 'rgba(255,255,255,0.6)', border:`0.5px solid ${useCustom ? accentColor : 'rgba(255,255,255,0.1)'}`, flex:'1', minWidth:'52px' }}>
                Other
              </button>
            </div>
            {useCustom && (
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)', fontFamily:'var(--font-cinzel)', fontSize:'16px', color:'rgba(255,255,255,0.5)' }}>$</span>
                <input type="number" value={customAmount} onChange={e => setCustomAmount(e.target.value)} placeholder="Enter amount" min="1" style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:`0.5px solid ${accentColor}40`, borderRadius:'10px', padding:'12px 14px 12px 28px', fontFamily:'var(--font-cinzel)', fontSize:'18px', color:'#fff', outline:'none' }}/>
              </div>
            )}

            {/* Impact preview */}
            {finalAmount >= 1 && (
              <div style={{ marginTop:'10px', fontFamily:'var(--font-cormorant)', fontSize:'14px', fontStyle:'italic', color:'rgba(255,255,255,0.45)', textAlign:'center' }}>
                ${finalAmount.toFixed(2)} = <span style={{ color:accentColor }}>{charity.impact(finalAmount)}</span> via {charity.name}
              </div>
            )}
          </div>

          {/* Donate button */}
          <button
            onClick={handleDonate}
            disabled={finalAmount < 1 || donating}
            style={{ width:'100%', fontFamily:'var(--font-cinzel)', fontSize:'12px', letterSpacing:'0.18em', color: finalAmount >= 1 ? '#0f1f0f' : 'rgba(255,255,255,0.3)', background: finalAmount >= 1 ? accentColor : 'rgba(255,255,255,0.06)', border:'none', borderRadius:'12px', padding:'16px', cursor: finalAmount >= 1 ? 'pointer' : 'not-allowed', transition:'all 0.18s', opacity: donating ? 0.7 : 1 }}
          >
            {donating ? 'Preparing…' : finalAmount >= 1 ? `Give $${finalAmount.toFixed(2)} →` : 'Select an amount'}
          </button>

          <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'rgba(255,255,255,0.25)', textAlign:'center', marginTop:'12px', lineHeight:1.6, fontStyle:'italic' }}>
            Your donation goes directly to {charity.name}. Green Emblem never handles your payment.
          </p>
        </div>

        {/* Footer */}
        <div style={{ textAlign:'center', marginTop:'32px' }}>
          <div style={{ fontFamily:'var(--font-arabic)', fontSize:'18px', color:accentColor, direction:'rtl', opacity:0.5, marginBottom:'8px' }} lang="ar">بَارَكَ اللَّهُ فِيكُمْ</div>
          <a href="https://green-emblem.com" style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.14em', color:'rgba(255,255,255,0.2)', textDecoration:'none' }}>
            Powered by Green Emblem
          </a>
        </div>
      </div>
    </div>
  )
}
