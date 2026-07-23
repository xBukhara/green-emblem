'use client'
import { useState } from 'react'
import Link from 'next/link'
import { MosqueAutocomplete, MosqueMapEmbed, type MosquePlace } from '@/components/MosqueMap'

const card: React.CSSProperties = { background: 'rgba(15,31,15,0.55)', border: '0.5px solid rgba(212,175,110,0.12)', borderRadius: '14px', padding: '22px' }
const sectionLabel: React.CSSProperties = { fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.2em', color: '#d4af6e', marginBottom: '16px' }
const inputStyle: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(212,175,110,0.25)', borderRadius: '9px', padding: '10px 12px', fontFamily: 'Georgia, serif', fontSize: '14px', color: '#fff', outline: 'none' }
const label: React.CSSProperties = { fontFamily: 'Georgia, serif', fontSize: '10px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '6px' }

export default function ProfileTab({ user, profile, campaigns, supabase, onProfileUpdate }: {
  user: any; profile: any; campaigns: any[]; supabase: any; onProfileUpdate: (p: any) => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    phone: profile?.phone || '',
    address_line1: profile?.address?.line1 || '',
    address_city: profile?.address?.city || '',
    address_state: profile?.address?.state || '',
    address_zip: profile?.address?.zip || '',
  })
  const [mosquePlace, setMosquePlace] = useState<MosquePlace | null>(
    profile?.mosque_place_id ? {
      name: profile.local_mosque, formattedAddress: profile.mosque_formatted_address,
      placeId: profile.mosque_place_id, lat: profile.mosque_lat, lng: profile.mosque_lng,
    } : null
  )

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const authedFetch = async (body: Record<string, any>) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Your session expired. Please sign in again.'); return null }
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Something went wrong.'); return null }
    return data.profile
  }

  const saveDetails = async () => {
    setSaving(true); setError('')
    const updated = await authedFetch({
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone || null,
      address: { line1: form.address_line1, city: form.address_city, state: form.address_state, zip: form.address_zip },
    })
    if (updated) { onProfileUpdate(updated); setEditing(false) }
    setSaving(false)
  }

  const saveMosque = async (place: MosquePlace) => {
    setMosquePlace(place)
    const updated = await authedFetch({
      local_mosque: place.name,
      mosque_place_id: place.placeId,
      mosque_lat: place.lat,
      mosque_lng: place.lng,
      mosque_formatted_address: place.formattedAddress,
    })
    if (updated) onProfileUpdate(updated)
  }

  const toggleSub = async (field: 'sub_greentv' | 'sub_greenfitness' | 'sub_greenworld_plus') => {
    const next = !profile?.[field]
    onProfileUpdate({ ...profile, [field]: next }) // optimistic
    const updated = await authedFetch({ [field]: next })
    if (updated) onProfileUpdate(updated)
  }

  const activeCampaigns = campaigns.filter(c => c.status === 'active')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* ── ACCOUNT DETAILS ── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={sectionLabel}>ACCOUNT DETAILS</div>
          {!editing && <button onClick={() => setEditing(true)} style={{ fontFamily: 'Georgia, serif', fontSize: '10px', color: '#d4af6e', background: 'none', border: '0.5px solid rgba(212,175,110,0.3)', borderRadius: '7px', padding: '5px 12px', cursor: 'pointer' }}>Edit</button>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
          {user?.user_metadata?.avatar_url && <img src={user.user_metadata.avatar_url} alt="" style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px solid rgba(212,175,110,0.3)' }}/>}
          <div>
            {!editing ? (
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '17px', color: '#fff', marginBottom: '3px' }}>{profile?.first_name} {profile?.last_name}</div>
            ) : null}
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}>{user?.email}</div>
          </div>
        </div>

        {error && <div style={{ background: 'rgba(226,75,74,0.1)', border: '0.5px solid rgba(226,75,74,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontFamily: 'Georgia, serif', fontSize: '13px', color: '#e87573' }}>{error}</div>}

        {!editing ? (
          <>
            {profile?.address?.line1 && (
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.3)', marginBottom: '5px' }}>ADDRESS</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                  {profile.address.line1}<br/>{profile.address.city}, {profile.address.state} {profile.address.zip}
                </div>
              </div>
            )}
            {profile?.phone && (
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>{profile.phone}</div>
            )}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {profile?.newsletter_opted_in && <span style={{ fontFamily: 'Georgia, serif', fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(46,107,46,0.12)', color: '#1D9E75', border: '0.5px solid rgba(46,107,46,0.3)' }}>Newsletter ✓</span>}
              {profile?.role === 'admin' && <span style={{ fontFamily: 'Georgia, serif', fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(212,175,110,0.1)', color: '#d4af6e', border: '0.5px solid rgba(212,175,110,0.3)' }}>Admin</span>}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div><label style={label}>First name</label><input style={inputStyle} value={form.first_name} onChange={e => set('first_name', e.target.value)}/></div>
              <div><label style={label}>Last name</label><input style={inputStyle} value={form.last_name} onChange={e => set('last_name', e.target.value)}/></div>
            </div>
            <div><label style={label}>Phone</label><input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 (555) 000-0000"/></div>
            <div><label style={label}>Street address</label><input style={inputStyle} value={form.address_line1} onChange={e => set('address_line1', e.target.value)}/></div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px' }}>
              <div><label style={label}>City</label><input style={inputStyle} value={form.address_city} onChange={e => set('address_city', e.target.value)}/></div>
              <div><label style={label}>State</label><input style={inputStyle} value={form.address_state} onChange={e => set('address_state', e.target.value)}/></div>
              <div><label style={label}>ZIP</label><input style={inputStyle} value={form.address_zip} onChange={e => set('address_zip', e.target.value)}/></div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button onClick={() => setEditing(false)} style={{ flex: 1, fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px', padding: '10px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveDetails} disabled={saving} style={{ flex: 2, fontFamily: 'Georgia, serif', fontSize: '11px', fontWeight: 600, color: '#0f1f0f', background: '#d4af6e', border: 'none', borderRadius: '8px', padding: '10px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </div>
        )}
      </div>

      {/* ── YOUR MASJID ── */}
      <div style={card}>
        <div style={sectionLabel}>YOUR MASJID</div>
        {mosquePlace?.placeId ? (
          <>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '15px', color: '#fff', marginBottom: '3px' }}>{mosquePlace.name}</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginBottom: '14px' }}>{mosquePlace.formattedAddress}</div>
            <MosqueMapEmbed placeId={mosquePlace.placeId} name={mosquePlace.name} height={200}/>
            <button onClick={() => setMosquePlace(null)} style={{ marginTop: '12px', fontFamily: 'Georgia, serif', fontSize: '10px', color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Change masjid</button>
          </>
        ) : (
          <>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', marginBottom: '14px' }}>Add your local masjid to see it on the map and, soon, community announcements from them.</p>
            <MosqueAutocomplete defaultValue={profile?.local_mosque} onSelect={saveMosque} inputStyle={inputStyle}/>
          </>
        )}
      </div>

      {/* ── COMMUNITY ANNOUNCEMENTS ── */}
      <div style={card}>
        <div style={sectionLabel}>COMMUNITY ANNOUNCEMENTS</div>
        <div style={{ textAlign: 'center', padding: '20px 10px' }}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', lineHeight: 1.7 }}>
            {mosquePlace?.placeId
              ? `We don't have a live feed connected for ${mosquePlace.name} yet — this is on our roadmap.`
              : 'Add your masjid above and we\u2019ll show announcements here once your masjid is connected.'}
          </p>
        </div>
      </div>

      {/* ── ACTIVE CAMPAIGNS SUMMARY ── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: activeCampaigns.length ? '14px' : 0 }}>
          <div style={{ ...sectionLabel, marginBottom: 0 }}>ACTIVE CAMPAIGNS ({activeCampaigns.length})</div>
          {activeCampaigns.length > 0 && <span style={{ fontFamily: 'Georgia, serif', fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>See "Campaigns" tab for full details</span>}
        </div>
        {activeCampaigns.length === 0 ? (
          <p style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>No active campaigns right now.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeCampaigns.slice(0, 3).map(c => (
              <a key={c.id} href={`/give/${c.slug}`} target="_blank" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px 12px', textDecoration: 'none' }}>
                <span style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: '#fff' }}>{c.honoree_names}</span>
                <span style={{ fontFamily: 'Georgia, serif', fontSize: '10px', color: '#d4af6e' }}>View →</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ── EXPLORE GREEN EMBLEM (channel subscriptions) ── */}
      <div style={card}>
        <div style={sectionLabel}>EXPLORE GREEN EMBLEM</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { field: 'sub_greentv' as const, href: '/greentv', name: 'GreenTV', desc: 'Islamic world news, curated', accent: '#5a9e5a' },
            { field: 'sub_greenfitness' as const, href: '/greenfitness', name: 'GreenFitness', desc: 'Faith-centered fitness coaching', accent: '#d4af6e' },
            { field: 'sub_greenworld_plus' as const, href: '/greenworld-plus', name: 'GreenWorld+', desc: 'More from Green Emblem, coming soon', accent: '#9b8ec4' },
          ].map(({ field, href, name, desc, accent }) => (
            <div key={field} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: `0.5px solid ${profile?.[field] ? accent + '50' : 'transparent'}`, borderRadius: '10px', padding: '12px 14px' }}>
              <Link href={href} style={{ textDecoration: 'none' }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '14px', color: '#fff', marginBottom: '2px' }}>{name}</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>{desc}</div>
              </Link>
              <button
                onClick={() => toggleSub(field)}
                style={{
                  fontFamily: 'Georgia, serif', fontSize: '9px', fontWeight: 600, letterSpacing: '0.04em',
                  padding: '6px 12px', borderRadius: '20px', border: `0.5px solid ${accent}`,
                  background: profile?.[field] ? accent : 'transparent', color: profile?.[field] ? '#0f1f0f' : accent,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {profile?.[field] ? 'Subscribed ✓' : 'Opt in'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── QUICK LINKS ── */}
      <div style={card}>
        <div style={sectionLabel}>QUICK LINKS</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[{ href: '/sadaqah/request', label: 'Request a campaign' }, { href: '/shop', label: 'Islamic shop' }].map(({ href, label }) => (
            <a key={href} href={href} style={{ fontFamily: 'Georgia, serif', fontSize: '10px', letterSpacing: '0.1em', color: '#d4af6e', border: '0.5px solid rgba(212,175,110,0.25)', padding: '8px 14px', borderRadius: '8px', textDecoration: 'none' }}>{label}</a>
          ))}
        </div>
      </div>
    </div>
  )
}
