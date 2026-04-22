'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import { createClient } from '@/lib/supabase/client'

// ── Faceless Islamic illustration SVGs ────────────────────────────────────────
const ILLUSTRATIONS = {
  couple_nikkah: (accent: string) => (
    <svg viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      {/* Groom */}
      <circle cx="75" cy="52" r="18" fill="#2e6b2e" opacity="0.9"/>
      <rect x="58" y="70" width="34" height="55" rx="6" fill="#1a3d1a"/>
      <rect x="62" y="125" width="12" height="30" rx="4" fill="#1a3d1a"/>
      <rect x="80" y="125" width="12" height="30" rx="4" fill="#1a3d1a"/>
      <rect x="40" y="72" width="16" height="40" rx="5" fill="#1a3d1a"/>
      <rect x="93" y="72" width="16" height="40" rx="5" fill="#1a3d1a"/>
      {/* Thobe detail */}
      <line x1="75" y1="75" x2="75" y2="120" stroke={accent} strokeWidth="1.5" opacity="0.5"/>
      {/* Bride */}
      <circle cx="130" cy="52" r="18" fill={accent} opacity="0.3"/>
      <ellipse cx="130" cy="52" rx="22" ry="26" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.6"/>
      {/* Hijab */}
      <ellipse cx="130" cy="48" rx="20" ry="22" fill="#2e6b2e" opacity="0.85"/>
      <rect x="112" y="68" width="36" height="58" rx="6" fill="#2e6b2e" opacity="0.85"/>
      <rect x="116" y="126" width="12" height="28" rx="4" fill="#2e6b2e" opacity="0.85"/>
      <rect x="132" y="126" width="12" height="28" rx="4" fill="#2e6b2e" opacity="0.85"/>
      {/* Abaya detail */}
      <line x1="130" y1="72" x2="130" y2="118" stroke={accent} strokeWidth="1" opacity="0.4"/>
      {/* Floral between */}
      <circle cx="102" cy="90" r="4" fill={accent} opacity="0.6"/>
      <circle cx="102" cy="90" r="7" fill="none" stroke={accent} strokeWidth="0.8" opacity="0.4"/>
      {/* Ground shadow */}
      <ellipse cx="102" cy="158" rx="48" ry="6" fill="rgba(0,0,0,0.15)"/>
    </svg>
  ),
  family_aqiqah: (accent: string) => (
    <svg viewBox="0 0 220 180" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      {/* Father */}
      <circle cx="55" cy="48" r="16" fill="#2e6b2e" opacity="0.9"/>
      <rect x="40" y="64" width="30" height="55" rx="5" fill="#1a3d1a"/>
      <rect x="26" y="66" width="13" height="38" rx="4" fill="#1a3d1a"/>
      <rect x="71" y="66" width="13" height="38" rx="4" fill="#1a3d1a"/>
      <rect x="43" y="119" width="10" height="28" rx="3" fill="#1a3d1a"/>
      <rect x="57" y="119" width="10" height="28" rx="3" fill="#1a3d1a"/>
      {/* Mother */}
      <ellipse cx="155" cy="46" rx="18" ry="20" fill="#2e6b2e" opacity="0.85"/>
      <rect x="138" y="64" width="34" height="58" rx="5" fill="#2e6b2e" opacity="0.85"/>
      <rect x="124" y="66" width="13" height="38" rx="4" fill="#2e6b2e" opacity="0.85"/>
      <rect x="173" y="66" width="13" height="38" rx="4" fill="#2e6b2e" opacity="0.85"/>
      <rect x="141" y="122" width="11" height="26" rx="3" fill="#2e6b2e" opacity="0.85"/>
      <rect x="158" y="122" width="11" height="26" rx="3" fill="#2e6b2e" opacity="0.85"/>
      {/* Baby in arms */}
      <circle cx="173" cy="82" r="10" fill={accent} opacity="0.7"/>
      <rect x="165" y="90" width="20" height="22" rx="5" fill={accent} opacity="0.6"/>
      {/* Girl child */}
      <ellipse cx="108" cy="88" rx="13" ry="14" fill="#3a7a3a" opacity="0.85"/>
      <rect x="96" y="100" width="24" height="38" rx="4" fill="#3a7a3a" opacity="0.8"/>
      <rect x="90" y="102" width="10" height="28" rx="3" fill="#3a7a3a" opacity="0.8"/>
      <rect x="111" y="102" width="10" height="28" rx="3" fill="#3a7a3a" opacity="0.8"/>
      <rect x="98" y="138" width="9" height="20" rx="3" fill="#3a7a3a" opacity="0.8"/>
      <rect x="111" y="138" width="9" height="20" rx="3" fill="#3a7a3a" opacity="0.8"/>
      {/* Stars */}
      <text x="108" y="60" fill={accent} fontSize="10" opacity="0.5" textAnchor="middle">✦</text>
      <text x="85" y="45" fill={accent} fontSize="7" opacity="0.35" textAnchor="middle">✦</text>
      <text x="130" y="50" fill={accent} fontSize="7" opacity="0.35" textAnchor="middle">✦</text>
      {/* Ground */}
      <ellipse cx="110" cy="162" rx="65" ry="6" fill="rgba(0,0,0,0.12)"/>
    </svg>
  ),
  couple_seated: (accent: string) => (
    <svg viewBox="0 0 200 170" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      {/* Meal spread */}
      <ellipse cx="100" cy="130" rx="70" ry="20" fill={accent} opacity="0.12"/>
      <ellipse cx="100" cy="128" rx="65" ry="16" fill="none" stroke={accent} strokeWidth="1" opacity="0.3"/>
      {/* Bowls */}
      <ellipse cx="70" cy="125" rx="14" ry="8" fill={accent} opacity="0.25"/>
      <ellipse cx="100" cy="122" rx="16" ry="9" fill={accent} opacity="0.2"/>
      <ellipse cx="130" cy="125" rx="14" ry="8" fill={accent} opacity="0.25"/>
      {/* Man seated left */}
      <circle cx="45" cy="65" r="16" fill="#2e6b2e" opacity="0.9"/>
      <path d="M28 85 Q45 75 62 85 L65 120 L25 120 Z" fill="#1a3d1a"/>
      <circle cx="38" cy="95" r="8" fill="#1a3d1a"/>
      {/* Woman seated right */}
      <ellipse cx="155" cy="63" rx="18" ry="19" fill="#2e6b2e" opacity="0.85"/>
      <path d="M135 83 Q155 73 175 83 L178 120 L132 120 Z" fill="#2e6b2e" opacity="0.85"/>
      <circle cx="162" cy="93" r="8" fill="#2e6b2e" opacity="0.85"/>
      {/* Boy child center */}
      <ellipse cx="100" cy="78" rx="13" ry="14" fill="#3a7a3a" opacity="0.85"/>
      <path d="M87 96 Q100 88 113 96 L115 120 L85 120 Z" fill="#3a7a3a" opacity="0.8"/>
      {/* Decorative dots */}
      <circle cx="100" cy="105" r="2" fill={accent} opacity="0.4"/>
      <circle cx="85" cy="108" r="1.5" fill={accent} opacity="0.3"/>
      <circle cx="115" cy="108" r="1.5" fill={accent} opacity="0.3"/>
    </svg>
  ),
  single_dua: (accent: string) => (
    <svg viewBox="0 0 160 180" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      {/* Person in sajdah/dua position */}
      <ellipse cx="80" cy="50" rx="18" ry="20" fill="#2e6b2e" opacity="0.85"/>
      <rect x="62" y="68" width="36" height="52" rx="6" fill="#2e6b2e" opacity="0.85"/>
      {/* Hands raised in dua */}
      <path d="M62 80 Q40 70 35 55" stroke="#2e6b2e" strokeWidth="12" fill="none" strokeLinecap="round"/>
      <path d="M98 80 Q120 70 125 55" stroke="#2e6b2e" strokeWidth="12" fill="none" strokeLinecap="round"/>
      <ellipse cx="35" cy="50" rx="9" ry="11" fill="#2e6b2e" opacity="0.8"/>
      <ellipse cx="125" cy="50" rx="9" ry="11" fill="#2e6b2e" opacity="0.8"/>
      {/* Light rays */}
      <line x1="80" y1="20" x2="80" y2="5" stroke={accent} strokeWidth="1.5" opacity="0.5"/>
      <line x1="95" y1="24" x2="103" y2="12" stroke={accent} strokeWidth="1" opacity="0.35"/>
      <line x1="65" y1="24" x2="57" y2="12" stroke={accent} strokeWidth="1" opacity="0.35"/>
      {/* Arabic text area */}
      <text x="80" y="148" fill={accent} fontSize="14" opacity="0.6" textAnchor="middle" fontFamily="serif">اللَّهُمَّ</text>
      {/* Seated */}
      <rect x="65" y="120" width="30" height="18" rx="4" fill="#2e6b2e" opacity="0.7"/>
      <ellipse cx="80" cy="145" rx="32" ry="8" fill={accent} opacity="0.08"/>
    </svg>
  ),
}

// ── QR Card Design Templates ──────────────────────────────────────────────────
const QR_DESIGNS = [
  {
    id: 'nikkah_arch',
    name: 'Nikkah Arch',
    desc: 'Elegant arch with geometric border',
    occasion: 'Nikkah / Walima',
    illustration: 'couple_nikkah',
    colors: { bg: '#0f1f0f', card: '#1a3d1a', accent: '#d4af6e', text: '#fff' },
    premium: false,
  },
  {
    id: 'aqiqah_family',
    name: 'Family Blessing',
    desc: 'Warm family illustration with crescent',
    occasion: 'Aqiqah / New baby',
    illustration: 'family_aqiqah',
    colors: { bg: '#0d1b2e', card: '#1a2e4a', accent: '#d4af6e', text: '#fff' },
    premium: true,
  },
  {
    id: 'eid_feast',
    name: 'Eid Gathering',
    desc: 'Family meal scene, festive & warm',
    occasion: 'Eid / Graduation',
    illustration: 'couple_seated',
    colors: { bg: '#2d0c12', card: '#4a1520', accent: '#c9956c', text: '#fff' },
    premium: true,
  },
  {
    id: 'dua_gold',
    name: 'Du\'a in Gold',
    desc: 'Solitary figure raising hands in prayer',
    occasion: 'Any occasion',
    illustration: 'single_dua',
    colors: { bg: '#111111', card: '#1e1e1e', accent: '#c4906a', text: '#fff' },
    premium: true,
  },
  {
    id: 'geometric_forest',
    name: 'Geometric Forest',
    desc: 'Pure Islamic geometry, no illustration',
    occasion: 'Any occasion',
    illustration: null,
    colors: { bg: '#0f1f0f', card: '#2e6b2e', accent: '#d4af6e', text: '#fff' },
    premium: false,
  },
  {
    id: 'crescent_cream',
    name: 'Crescent & Cream',
    desc: 'Light, clean — cream background',
    occasion: 'Any occasion',
    illustration: null,
    colors: { bg: '#f5f0e6', card: '#fff', accent: '#2e6b2e', text: '#1a3d1a' },
    premium: true,
  },
]

// ── QR Card Preview Component ─────────────────────────────────────────────────
function QRCardPreview({
  design,
  campaign,
  qrUrl,
}: {
  design: typeof QR_DESIGNS[0]
  campaign: any
  qrUrl: string
}) {
  const { colors, illustration } = design
  const IllustrationEl = illustration ? ILLUSTRATIONS[illustration as keyof typeof ILLUSTRATIONS] : null

  return (
    <div style={{
      width: '280px', height: '420px', borderRadius: '16px',
      background: colors.bg, position: 'relative', overflow: 'hidden',
      border: `1px solid ${colors.accent}40`, flexShrink: 0,
    }}>
      {/* Background pattern */}
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.06 }}>
        <defs>
          <pattern id={`pat-${design.id}`} width="60" height="60" patternUnits="userSpaceOnUse">
            <rect x="15" y="15" width="30" height="30" rx="2" fill="none" stroke={colors.accent} strokeWidth="0.8"/>
            <rect x="15" y="15" width="30" height="30" rx="2" fill="none" stroke={colors.accent} strokeWidth="0.8" transform="rotate(45 30 30)"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#pat-${design.id})`}/>
      </svg>

      {/* Header */}
      <div style={{ position:'relative', zIndex:2, padding:'18px 18px 0', textAlign:'center' }}>
        <div style={{ fontFamily:'var(--font-arabic)', fontSize:'13px', color:colors.accent, direction:'rtl', opacity:0.8 }} lang="ar">
          بَابُ الصَّدَقَة
        </div>
        <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'7px', letterSpacing:'0.2em', color:colors.accent, marginBottom:'10px', opacity:0.7 }}>
          BAAB AS-SADAQAH
        </div>

        {/* Illustration */}
        {IllustrationEl && (
          <div style={{ height:'130px', margin:'0 auto', width:'160px' }}>
            {IllustrationEl(colors.accent)}
          </div>
        )}

        {/* Geometric placeholder if no illustration */}
        {!IllustrationEl && (
          <div style={{ height:'80px', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="70" height="70" viewBox="0 0 70 70">
              <polygon points="35,2 67,18 67,52 35,68 3,52 3,18" fill="none" stroke={colors.accent} strokeWidth="1.5" opacity="0.6"/>
              <polygon points="35,10 59,22 59,48 35,60 11,48 11,22" fill="none" stroke={colors.accent} strokeWidth="1" opacity="0.4"/>
              <circle cx="35" cy="35" r="10" fill={colors.accent} opacity="0.3"/>
              <circle cx="35" cy="35" r="5" fill={colors.accent} opacity="0.5"/>
            </svg>
          </div>
        )}
      </div>

      {/* Campaign info */}
      <div style={{ position:'relative', zIndex:2, textAlign:'center', padding:'8px 14px 6px' }}>
        <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'11px', color:colors.text, fontWeight:500, lineHeight:1.2, marginBottom:'3px' }}>
          {campaign?.honoree_names || 'Aisha & Ibrahim'}
        </div>
        <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'10px', color:colors.accent, fontStyle:'italic', opacity:0.8 }}>
          {campaign?.event_type || 'Nikkah'}{campaign?.event_date ? ` · ${campaign.event_date}` : ''}
        </div>
      </div>

      {/* QR code placeholder */}
      <div style={{ position:'relative', zIndex:2, display:'flex', justifyContent:'center', padding:'8px 0 6px' }}>
        <div style={{ width:'88px', height:'88px', background:colors.card, borderRadius:'8px', border:`1px solid ${colors.accent}40`, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
          {qrUrl ? (
            <img src={qrUrl} alt="QR" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
          ) : (
            <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
              <rect x="2" y="2" width="24" height="24" rx="2" fill="none" stroke={colors.accent} strokeWidth="2"/>
              <rect x="8" y="8" width="12" height="12" fill={colors.accent} opacity="0.5"/>
              <rect x="34" y="2" width="24" height="24" rx="2" fill="none" stroke={colors.accent} strokeWidth="2"/>
              <rect x="40" y="8" width="12" height="12" fill={colors.accent} opacity="0.5"/>
              <rect x="2" y="34" width="24" height="24" rx="2" fill="none" stroke={colors.accent} strokeWidth="2"/>
              <rect x="8" y="40" width="12" height="12" fill={colors.accent} opacity="0.5"/>
              <rect x="34" y="34" width="6" height="6" fill={colors.accent} opacity="0.5"/>
              <rect x="42" y="34" width="6" height="6" fill={colors.accent} opacity="0.5"/>
              <rect x="34" y="42" width="6" height="6" fill={colors.accent} opacity="0.5"/>
              <rect x="50" y="42" width="8" height="8" fill={colors.accent} opacity="0.5"/>
            </svg>
          )}
        </div>
      </div>

      {/* CTA text */}
      <div style={{ position:'relative', zIndex:2, textAlign:'center', padding:'0 14px 12px' }}>
        <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'7px', letterSpacing:'0.14em', color:colors.accent, opacity:0.7 }}>
          SCAN TO GIVE SADAQAH
        </div>
        <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'9px', color:colors.text, opacity:0.4, marginTop:'3px' }}>
          green-emblem.com
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PremiumQRPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100dvh', background:'#0f1f0f' }}/>}>
      <PremiumQRInner />
    </Suspense>
  )
}

function PremiumQRInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const campaignSlug = searchParams.get('campaign')

  const [campaign, setCampaign] = useState<any>(null)
  const [selectedDesign, setSelectedDesign] = useState(QR_DESIGNS[0])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [showFreeOnly, setShowFreeOnly] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth/sign-in'); return }
      setUser(user)
    })

    if (campaignSlug) {
      supabase.from('campaigns').select('*').eq('slug', campaignSlug).single()
        .then(({ data }) => { setCampaign(data); setLoading(false) })
    } else {
      setLoading(false)
    }
  }, [])

  const handleGetPremium = async () => {
    if (!selectedDesign.premium) {
      // Free design — just download
      const link = document.createElement('a')
      link.href = `/api/campaigns/${campaignSlug}/qr`
      link.download = `green-emblem-qr-${campaignSlug}.png`
      link.click()
      return
    }

    setPaying(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/payments/premium-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        campaign_slug: campaignSlug,
        campaign_id: campaign?.id,
        design_id: selectedDesign.id,
      }),
    })
    const data = await res.json()
    if (data.checkoutUrl) window.location.href = data.checkoutUrl
    setPaying(false)
  }

  if (loading) return (
    <div style={{ minHeight:'100dvh', background:'#0f1f0f', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'16px', color:'rgba(255,255,255,0.4)', fontStyle:'italic' }}>Loading…</div>
    </div>
  )

  const qrPreviewUrl = campaignSlug ? `/api/campaigns/${campaignSlug}/qr` : ''

  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ paddingTop:'88px', minHeight:'100dvh', position:'relative', zIndex:2 }}>
        <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'40px 24px 80px' }}>

          {/* Header */}
          <div style={{ textAlign:'center', marginBottom:'48px' }}>
            <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.28em', color:'var(--gold)', marginBottom:'14px' }}>
              Premium QR
            </div>
            <h1 style={{ fontFamily:'var(--font-cinzel)', fontSize:'clamp(26px,5vw,42px)', fontWeight:500, color:'#fff', lineHeight:1.15, marginBottom:'12px' }}>
              A QR card worthy of<br/><span style={{ color:'var(--gold)' }}>the occasion</span>
            </h1>
            <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'17px', fontStyle:'italic', color:'rgba(255,255,255,0.5)', lineHeight:1.7, maxWidth:'500px', margin:'0 auto' }}>
              Choose an Islamic design, preview your campaign card, and download a print-ready file. Perfect for table cards, programmes, and display boards.
            </p>
            <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', marginTop:'16px', background:'rgba(212,175,110,0.08)', border:'0.5px solid rgba(212,175,110,0.25)', borderRadius:'100px', padding:'6px 16px' }}>
              <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'18px', color:'var(--gold)' }}>$0.99</span>
              <span style={{ fontFamily:'var(--font-cormorant)', fontSize:'14px', color:'rgba(255,255,255,0.5)', fontStyle:'italic' }}>per campaign · unlimited downloads</span>
            </div>
          </div>

          {/* Main layout — designs left, preview right */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:'32px', alignItems:'start' }}>

            {/* Design grid */}
            <div>
              <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.22em', color:'var(--gold)', marginBottom:'16px', display:'flex', alignItems:'center', gap:'10px' }}>
                Choose your design
                <span style={{ flex:1, height:'0.5px', background:'rgba(212,175,110,0.15)', display:'block' }}/>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'12px' }}>
                {QR_DESIGNS.map(design => (
                  <button key={design.id} onClick={() => setSelectedDesign(design)} style={{
                    background: selectedDesign.id === design.id ? 'rgba(212,175,110,0.08)' : 'rgba(15,31,15,0.4)',
                    border: `0.5px solid ${selectedDesign.id === design.id ? 'rgba(212,175,110,0.5)' : 'rgba(212,175,110,0.12)'}`,
                    borderRadius:'12px', padding:'0', overflow:'hidden', cursor:'pointer', textAlign:'left',
                    transition:'all 0.18s',
                  }}>
                    {/* Mini preview */}
                    <div style={{ height:'110px', background:design.colors.bg, display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
                      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.06 }}>
                        <rect width="100%" height="100%" fill={`url(#pat-${design.id})`}/>
                      </svg>
                      {design.illustration && (
                        <div style={{ height:'90px', width:'120px', position:'relative', zIndex:1 }}>
                          {ILLUSTRATIONS[design.illustration as keyof typeof ILLUSTRATIONS](design.colors.accent)}
                        </div>
                      )}
                      {!design.illustration && (
                        <svg width="60" height="60" viewBox="0 0 70 70" style={{ position:'relative', zIndex:1 }}>
                          <polygon points="35,2 67,18 67,52 35,68 3,52 3,18" fill="none" stroke={design.colors.accent} strokeWidth="1.5" opacity="0.6"/>
                          <circle cx="35" cy="35" r="12" fill={design.colors.accent} opacity="0.25"/>
                        </svg>
                      )}
                      {/* Premium badge */}
                      {design.premium && (
                        <div style={{ position:'absolute', top:'8px', right:'8px', background:'rgba(212,175,110,0.9)', borderRadius:'4px', padding:'2px 7px', fontFamily:'var(--font-cinzel)', fontSize:'7px', letterSpacing:'0.1em', color:'#0f1f0f' }}>
                          PREMIUM
                        </div>
                      )}
                      {!design.premium && (
                        <div style={{ position:'absolute', top:'8px', right:'8px', background:'rgba(29,158,117,0.9)', borderRadius:'4px', padding:'2px 7px', fontFamily:'var(--font-cinzel)', fontSize:'7px', letterSpacing:'0.1em', color:'#fff' }}>
                          FREE
                        </div>
                      )}
                    </div>
                    <div style={{ padding:'12px' }}>
                      <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'11px', color:'#fff', marginBottom:'3px' }}>{design.name}</div>
                      <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'rgba(255,255,255,0.45)', fontStyle:'italic', marginBottom:'4px' }}>{design.desc}</div>
                      <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.08em', color:design.colors.accent, opacity:0.7 }}>{design.occasion}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* What's included */}
              <div style={{ background:'rgba(15,31,15,0.4)', border:'0.5px solid rgba(212,175,110,0.1)', borderRadius:'12px', padding:'20px 24px', marginTop:'24px' }}>
                <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.2em', color:'var(--gold)', marginBottom:'14px' }}>What's included in Premium</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                  {[
                    'Print-ready PDF (A5 + A4)',
                    'Islamic illustration artwork',
                    'Arabic calligraphy detail',
                    'Table tent format',
                    'Bookmark strip format',
                    'Unlimited re-downloads',
                    '60-day campaign (vs 30)',
                    'Priority 4hr review',
                  ].map(item => (
                    <div key={item} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="rgba(29,158,117,0.15)"/><polyline points="4,7 6,9.5 10,4.5" fill="none" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      <span style={{ fontFamily:'var(--font-cormorant)', fontSize:'13px', color:'rgba(255,255,255,0.6)' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview + CTA (sticky) */}
            <div style={{ position:'sticky', top:'88px', display:'flex', flexDirection:'column', gap:'16px', alignItems:'center' }}>
              <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.18em', color:'rgba(255,255,255,0.35)', marginBottom:'4px', alignSelf:'flex-start' }}>
                Preview
              </div>

              <QRCardPreview
                design={selectedDesign}
                campaign={campaign}
                qrUrl={qrPreviewUrl}
              />

              {/* CTA */}
              <div style={{ width:'100%', background:'rgba(15,31,15,0.6)', border:'0.5px solid rgba(212,175,110,0.15)', borderRadius:'14px', padding:'20px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'12px' }}>
                  <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'11px', color:'rgba(255,255,255,0.7)' }}>{selectedDesign.name}</span>
                  <span style={{ fontFamily:'var(--font-cinzel)', fontSize:'18px', color:'var(--gold)' }}>
                    {selectedDesign.premium ? '$0.99' : 'Free'}
                  </span>
                </div>
                <button onClick={handleGetPremium} disabled={paying || !campaignSlug}
                  style={{ width:'100%', fontFamily:'var(--font-cinzel)', fontSize:'11px', letterSpacing:'0.16em', color:'var(--forest-dark)', background:'var(--gold)', border:'none', borderRadius:'10px', padding:'14px', cursor: (paying || !campaignSlug) ? 'not-allowed' : 'pointer', opacity: paying ? 0.6 : 1, marginBottom:'8px' }}>
                  {paying ? 'Preparing checkout…' : selectedDesign.premium ? 'Get Premium QR — $0.99' : 'Download Free QR'}
                </button>
                {!campaignSlug && (
                  <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'rgba(255,255,255,0.3)', textAlign:'center', fontStyle:'italic' }}>
                    Select a campaign from your dashboard to download
                  </div>
                )}
                {selectedDesign.premium && campaignSlug && (
                  <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'rgba(255,255,255,0.3)', textAlign:'center', fontStyle:'italic' }}>
                    One-time payment · Unlimited downloads · Print anywhere
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
