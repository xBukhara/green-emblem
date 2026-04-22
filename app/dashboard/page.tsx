'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createClient } from '@/lib/supabase/client'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [donations, setDonations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/sign-in'); return }
      setUser(user)

      const [profileRes, donationsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('donations')
          .select('*, campaigns(slug, honoree_names, event_type, event_date)')
          .eq('user_id', user.id)
          .eq('confirmed', true)
          .order('created_at', { ascending: false }),
      ])

      setProfile(profileRes.data)
      setDonations(donationsRes.data || [])
      setLoading(false)
    })
  }, [])

  const totalDonated = donations.reduce((s, d) => s + (d.amount || 0), 0)
  const totalMeals   = donations.reduce((s, d) => s + (d.meals_funded || 0), 0)
  const uniqueCampaigns = new Set(donations.map(d => d.campaign_id)).size

  const charityLabel = (id: string) => ({
    share_the_meal: 'Share The Meal',
    islamic_relief:  'Islamic Relief USA',
    unicef:          'UNICEF USA',
  }[id] || id)

  const charityColor = (id: string) => ({
    share_the_meal: '#E8A020',
    islamic_relief:  '#1D9E75',
    unicef:          '#378ADD',
  }[id] || '#d4af6e')

  if (loading) return (
    <>
      <Nav />
      <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#080f08' }}>
        <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'16px', color:'rgba(255,255,255,0.4)', fontStyle:'italic' }}>Loading your dashboard…</div>
      </div>
    </>
  )

  const firstName = profile?.full_name?.split(' ')[0] || user?.user_metadata?.given_name || 'there'

  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ paddingTop:'88px', minHeight:'100dvh', position:'relative', zIndex:2 }}>
        <div style={{ maxWidth:'900px', margin:'0 auto', padding:'40px 24px 80px' }}>

          {/* Header */}
          <div style={{ marginBottom:'40px' }}>
            <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.28em', color:'var(--gold)', marginBottom:'10px' }}>
              Your impact
            </div>
            <h1 style={{ fontFamily:'var(--font-cinzel)', fontSize:'clamp(28px,5vw,42px)', fontWeight:500, color:'#fff', marginBottom:'8px' }}>
              Assalamu Alaikum, {firstName}
            </h1>
            <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'17px', fontStyle:'italic', color:'rgba(255,255,255,0.45)', lineHeight:1.7 }}>
              Every act of sadaqah is recorded. Here is yours.
            </p>
          </div>

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'12px', marginBottom:'36px' }}>
            {[
              { label:'Total given', value:`$${totalDonated.toFixed(2)}`, sub:'In confirmed sadaqah', accent:'var(--gold)' },
              { label:'Meals funded', value:totalMeals.toLocaleString(), sub:'Via Share The Meal', accent:'#E8A020' },
              { label:'Events honoured', value:uniqueCampaigns, sub:'Campaigns supported', accent:'#1D9E75' },
              { label:'Donations made', value:donations.length, sub:'Individual gifts', accent:'var(--gold)' },
            ].map(({ label, value, sub, accent }) => (
              <div key={label} style={{ background:'rgba(15,31,15,0.55)', border:'0.5px solid rgba(212,175,110,0.12)', borderRadius:'14px', padding:'20px' }}>
                <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'8px', letterSpacing:'0.18em', color:'rgba(255,255,255,0.3)', marginBottom:'10px' }}>{label}</div>
                <div style={{ fontSize:'clamp(26px,4vw,36px)', fontWeight:300, color:accent, lineHeight:1, marginBottom:'5px', fontFamily:'var(--font-cormorant)' }}>{value}</div>
                <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.3)', fontStyle:'italic', fontFamily:'var(--font-cormorant)' }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Donation history */}
          <div style={{ marginBottom:'32px' }}>
            <h2 style={{ fontFamily:'var(--font-cinzel)', fontSize:'10px', letterSpacing:'0.22em', color:'var(--gold)', marginBottom:'16px', display:'flex', alignItems:'center', gap:'12px' }}>
              Donation history
              <span style={{ flex:1, height:'0.5px', background:'rgba(212,175,110,0.15)', display:'block' }}/>
            </h2>

            {donations.length === 0 ? (
              <div style={{ background:'rgba(15,31,15,0.4)', border:'0.5px solid rgba(212,175,110,0.1)', borderRadius:'14px', padding:'48px', textAlign:'center' }}>
                <div style={{ fontFamily:'var(--font-arabic)', fontSize:'28px', color:'var(--gold)', opacity:0.3, direction:'rtl', marginBottom:'14px' }} lang="ar">بَابُ الصَّدَقَة</div>
                <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'13px', color:'rgba(255,255,255,0.4)', marginBottom:'8px' }}>No donations yet</div>
                <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'15px', color:'rgba(255,255,255,0.3)', fontStyle:'italic', lineHeight:1.7, maxWidth:'320px', margin:'0 auto 20px' }}>
                  Scan a Baab As-Sadaqah QR code at an event, or give directly through a campaign link.
                </p>
                <a href="/sadaqah" style={{ fontFamily:'var(--font-cinzel)', fontSize:'10px', letterSpacing:'0.14em', color:'var(--forest-dark)', background:'var(--gold)', padding:'10px 20px', borderRadius:'8px', textDecoration:'none', display:'inline-block' }}>
                  Learn about Baab As-Sadaqah
                </a>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {donations.map(d => (
                  <div key={d.id} style={{ background:'rgba(15,31,15,0.55)', border:'0.5px solid rgba(212,175,110,0.1)', borderRadius:'12px', padding:'16px 20px', display:'flex', alignItems:'center', gap:'16px', flexWrap:'wrap' }}>
                    {/* Charity color bar */}
                    <div style={{ width:'3px', height:'44px', borderRadius:'2px', background:charityColor(d.charity), flexShrink:0 }}/>

                    {/* Main info */}
                    <div style={{ flex:1, minWidth:'160px' }}>
                      <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'16px', color:'#fff', marginBottom:'3px' }}>
                        {d.campaigns?.honoree_names || 'Anonymous campaign'}
                      </div>
                      <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.1em', color:'rgba(255,255,255,0.3)' }}>
                        {d.campaigns?.event_type && d.campaigns.event_type !== 'Other' ? d.campaigns.event_type : ''}
                        {d.campaigns?.event_date ? ` · ${d.campaigns.event_date}` : ''}
                      </div>
                    </div>

                    {/* Charity */}
                    <div style={{ textAlign:'center', minWidth:'120px' }}>
                      <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.1em', color:charityColor(d.charity), marginBottom:'2px' }}>
                        {charityLabel(d.charity)}
                      </div>
                      {d.meals_funded > 0 && (
                        <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'rgba(255,255,255,0.35)', fontStyle:'italic' }}>
                          {d.meals_funded} meals
                        </div>
                      )}
                    </div>

                    {/* Amount */}
                    <div style={{ textAlign:'right', minWidth:'80px' }}>
                      <div style={{ fontFamily:'var(--font-cinzel)', fontSize:'20px', color:'var(--gold)', lineHeight:1 }}>
                        ${d.amount?.toFixed(2)}
                      </div>
                      <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'11px', color:'rgba(255,255,255,0.25)', marginTop:'3px' }}>
                        {new Date(d.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                      </div>
                    </div>

                    {/* View campaign link */}
                    {d.campaigns?.slug && (
                      <a href={`/give/${d.campaigns.slug}`} style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.1em', color:'rgba(255,255,255,0.25)', textDecoration:'none', border:'0.5px solid rgba(255,255,255,0.1)', padding:'6px 10px', borderRadius:'6px', flexShrink:0, transition:'all 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--gold)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(212,175,110,0.3)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.25)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.1)' }}>
                        View
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Du'a section */}
          {donations.length > 0 && (
            <div style={{ background:'rgba(26,61,26,0.15)', border:'0.5px solid rgba(212,175,110,0.08)', borderRadius:'14px', padding:'28px', textAlign:'center' }}>
              <div style={{ fontFamily:'var(--font-arabic)', fontSize:'22px', color:'var(--gold)', opacity:0.6, direction:'rtl', marginBottom:'10px' }} lang="ar">
                تَقَبَّلَ اللَّهُ مِنَّا وَمِنكُمْ
              </div>
              <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'14px', color:'rgba(255,255,255,0.3)', fontStyle:'italic' }}>
                May Allah accept from us and from you.
              </div>
            </div>
          )}

          {/* Admin link if admin */}
          {profile?.role === 'admin' && (
            <div style={{ marginTop:'24px', textAlign:'center' }}>
              <a href="/admin" style={{ fontFamily:'var(--font-cinzel)', fontSize:'9px', letterSpacing:'0.14em', color:'rgba(255,255,255,0.25)', textDecoration:'none' }}>
                → Go to admin console
              </a>
            </div>
          )}

        </div>
      </main>
      <Footer />
    </>
  )
}
