'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'

export default function DonateSuccessPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100dvh', background:'#0f1f0f' }}/>}>
      <SuccessInner />
    </Suspense>
  )
}

function SuccessInner() {
  const params = useSearchParams()
  const slug = params.get('campaign')

  return (
    <div style={{ minHeight:'100dvh', background:'#0f1f0f', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', position:'relative' }}>
      <div className="bg-tile" aria-hidden="true"/>
      <div style={{ position:'relative', zIndex:2, textAlign:'center', maxWidth:'440px' }}>
        <div style={{ width:'72px', height:'72px', borderRadius:'50%', background:'rgba(46,107,46,0.15)', border:'0.5px solid rgba(46,107,46,0.4)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px' }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><polyline points="7,16 13,23 25,9" stroke="#4a9e4a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.28em', color:'var(--gold)', marginBottom:'14px' }}>Jazak Allahu Khairan</div>
        <h1 style={{ fontFamily:'var(--font-cinzel)', fontSize:'clamp(24px,5vw,36px)', fontWeight:500, color:'#fff', lineHeight:1.15, marginBottom:'12px' }}>
          May Allah accept your sadaqah
        </h1>
        <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'17px', fontStyle:'italic', color:'rgba(255,255,255,0.55)', lineHeight:1.7, marginBottom:'8px' }}>
          Your generosity honours those celebrating today. Every gift given in their name is a blessing that endures.
        </p>
        <div style={{ fontFamily:'var(--font-arabic)', fontSize:'22px', color:'var(--gold)', opacity:0.65, direction:'rtl', margin:'24px 0' }} lang="ar">
          تَقَبَّلَ اللَّهُ مِنَّا وَمِنكُمْ
        </div>
        {slug && (
          <Link href={`/give/${slug}`} style={{ display:'inline-block', fontFamily:'var(--font-cinzel)', fontSize:'10px', letterSpacing:'0.14em', color:'var(--gold)', border:'0.5px solid rgba(212,175,110,0.4)', padding:'12px 24px', borderRadius:'8px', textDecoration:'none', marginBottom:'12px' }}>
            ← Back to campaign
          </Link>
        )}
      </div>
    </div>
  )
}
