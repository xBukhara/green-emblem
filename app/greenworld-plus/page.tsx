'use client'
import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createClient } from '@/lib/supabase/client'
import { ExploreNearbyMap } from '@/components/MosqueMap'

type Masjid = { id: string; name: string; city: string; state: string; verified: boolean }
type EventRow = {
  id: string; title: string; description: string | null; event_start: string; event_end: string
  masjid_id?: string
  masjids: { name: string; city: string; state: string; lat: number | null; lng: number | null } | null
}

export default function GreenWorldPlusPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [checked, setChecked] = useState(false)

  const [masjids, setMasjids] = useState<Masjid[]>([])
  const [search, setSearch] = useState('')
  const [events, setEvents] = useState<EventRow[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user)
      if (user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        setProfile(p)
      }
      setChecked(true)
    })
    fetch('/api/masjid-events').then(r => r.json()).then(d => { setEvents(d.events || []); setLoadingEvents(false) }).catch(() => setLoadingEvents(false))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/masjids${search ? `?q=${encodeURIComponent(search)}` : ''}`)
        .then(r => r.json()).then(d => setMasjids(d.masjids || []))
    }, 250)
    return () => clearTimeout(t)
  }, [search])

  const followMasjid = async (masjidId: string | null) => {
    if (!user) { window.location.href = '/auth/sign-in'; return }
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ followed_masjid_id: masjidId, sub_greenworld_plus: true }),
      })
      const data = await res.json()
      if (data.profile) setProfile(data.profile)
    }
    setSaving(false)
  }

  const saveTravelRadius = async (mi: number) => {
    if (!user) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ travel_radius_miles: mi }),
    }).catch(() => {})
  }

  const followedMasjid = masjids.find(m => m.id === profile?.followed_masjid_id)
  const displayedEvents = events

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ position: 'relative', zIndex: 2, minHeight: '100dvh', padding: '120px 24px 80px', maxWidth: '760px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '0.3em', color: '#9b8ec4', marginBottom: '16px' }}>GREENWORLD+</div>
          <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: 'clamp(28px,5vw,44px)', fontWeight: 500, color: '#fff', marginBottom: '12px' }}>Local events, all in one place</h1>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '17px', fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
            Follow your masjid to get notified the moment they post something new.
          </p>
        </div>

        {/* Follow a masjid */}
        <div style={{ background: 'rgba(15,31,15,0.55)', border: '0.5px solid rgba(155,142,196,0.2)', borderRadius: '16px', padding: '22px', marginBottom: '28px' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.2em', color: '#9b8ec4', marginBottom: '14px' }}>YOUR MASJID</div>

          {followedMasjid ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '15px', color: '#fff' }}>{followedMasjid.name}</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{followedMasjid.city}, {followedMasjid.state}</div>
              </div>
              <button onClick={() => followMasjid(null)} disabled={saving} style={{ fontFamily: 'Georgia, serif', fontSize: '10px', color: 'rgba(255,255,255,0.4)', background: 'none', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: '7px', padding: '7px 12px', cursor: 'pointer' }}>Unfollow</button>
            </div>
          ) : (
            <>
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search verified Sunni masjids and Islamic institutes…"
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(155,142,196,0.3)', borderRadius: '9px', padding: '11px 13px', fontFamily: 'Georgia, serif', fontSize: '14px', color: '#fff', outline: 'none', marginBottom: masjids.length ? '10px' : 0 }}
              />
              {masjids.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                  {masjids.map(m => (
                    <button key={m.id} onClick={() => followMasjid(m.id)} disabled={saving} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: 'none', borderRadius: '8px', padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}>
                      <span>
                        <span style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: '#fff' }}>{m.name}</span>
                        <span style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginLeft: '8px' }}>{m.city}, {m.state}</span>
                      </span>
                      <span style={{ fontFamily: 'Georgia, serif', fontSize: '10px', color: '#9b8ec4' }}>Follow +</span>
                    </button>
                  ))}
                </div>
              )}
              {search && masjids.length === 0 && (
                <p style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', marginTop: '8px' }}>No masjids found yet — our directory is growing. Check back soon.</p>
              )}
            </>
          )}
        </div>

        {/* Explore nearby — radius-bounded community map */}
        <div style={{ background: 'rgba(15,31,15,0.55)', border: '0.5px solid rgba(212,175,110,0.14)', borderRadius: '16px', padding: '22px', marginBottom: '28px' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.2em', color: '#d4af6e', marginBottom: '6px' }}>EXPLORE NEARBY</div>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '14px', fontStyle: 'italic', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: '16px' }}>
            Set how far you&apos;re willing to travel — masjids, halal food, and community events within your boundary.
          </p>
          <ExploreNearbyMap
            initialRadiusMi={profile?.travel_radius_miles}
            events={events}
            onRadiusSave={saveTravelRadius}
          />
        </div>

        {/* Events feed */}
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)', marginBottom: '14px' }}>
          UPCOMING EVENTS
        </div>

        {loadingEvents ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Loading events…</div>
        ) : displayedEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 24px', background: 'rgba(15,31,15,0.4)', borderRadius: '14px' }}>
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '16px', fontStyle: 'italic', color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>
              No events posted yet. As masjids join our directory, their events will show up here — and you'll be notified if you follow them.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {displayedEvents.map(e => (
              <div key={e.id} style={{ background: 'rgba(15,31,15,0.5)', border: '0.5px solid rgba(212,175,110,0.12)', borderRadius: '12px', padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '6px' }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', color: '#fff' }}>{e.title}</div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: '#9b8ec4', whiteSpace: 'nowrap' }}>{fmtDate(e.event_start)} · {fmtTime(e.event_start)}</div>
                </div>
                {e.masjids?.name && <div style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>{e.masjids.name} · {e.masjids.city}, {e.masjids.state}</div>}
                {e.description && <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, fontStyle: 'italic' }}>{e.description}</p>}
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
