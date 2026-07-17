'use client'
import { Suspense, useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  FONT_PAIRS, fontPair, googleFontsHref,
  PATTERNS, OVERLAYS, BUILTIN_TEMPLATES, VERSES,
  type CampaignTemplate,
} from '@/lib/campaign-design'

// ─────────────────────────────────────────────────────────────────────────────
//  BAAB AS-SADAQAH — DESIGN STUDIO
//  Left: control rail (Templates / Design / Type / Content)
//  Right: always-on live render of the guest-facing campaign page
// ─────────────────────────────────────────────────────────────────────────────

type Design = {
  bg: string
  accent: string
  text: string
  font_pair: string
  pattern: string
  overlay: string
  pattern_opacity: number
}

const TABS = [
  { id: 'templates', label: 'Templates', icon: '▦' },
  { id: 'design',    label: 'Design',    icon: '◐' },
  { id: 'type',      label: 'Type',      icon: 'Aa' },
  { id: 'content',   label: 'Content',   icon: '✎' },
] as const
type Tab = typeof TABS[number]['id']

// ── Pattern + overlay render layers ─────────────────────────────────────────
function PatternLayer({ type, accent, opacity }: { type: string; accent: string; opacity: number }) {
  if (type === 'none') return null
  const style: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', opacity, pointerEvents: 'none', transition: 'opacity 0.4s' }
  if (type === 'star8') return <svg style={style}><defs><pattern id="p-s8" width="80" height="80" patternUnits="userSpaceOnUse"><g fill="none" stroke={accent} strokeWidth="0.8"><rect x="20" y="20" width="40" height="40" rx="2"/><rect x="20" y="20" width="40" height="40" rx="2" transform="rotate(45 40 40)"/></g></pattern></defs><rect width="100%" height="100%" fill="url(#p-s8)"/></svg>
  if (type === 'arabesque') return <svg style={style}><defs><pattern id="p-ab" width="60" height="60" patternUnits="userSpaceOnUse"><circle cx="30" cy="30" r="20" fill="none" stroke={accent} strokeWidth="0.7"/><circle cx="30" cy="30" r="10" fill="none" stroke={accent} strokeWidth="0.5"/><line x1="10" y1="30" x2="50" y2="30" stroke={accent} strokeWidth="0.4"/><line x1="30" y1="10" x2="30" y2="50" stroke={accent} strokeWidth="0.4"/></pattern></defs><rect width="100%" height="100%" fill="url(#p-ab)"/></svg>
  if (type === 'lattice') return <svg style={style}><defs><pattern id="p-la" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M22 0 L44 22 L22 44 L0 22 Z" fill="none" stroke={accent} strokeWidth="0.6"/><circle cx="22" cy="22" r="4" fill="none" stroke={accent} strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#p-la)"/></svg>
  return <svg style={style}><defs><pattern id="p-ge" width="50" height="50" patternUnits="userSpaceOnUse"><polygon points="25,5 45,15 45,35 25,45 5,35 5,15" fill="none" stroke={accent} strokeWidth="0.6"/></pattern></defs><rect width="100%" height="100%" fill="url(#p-ge)"/></svg>
}

function OverlayLayer({ type, accent }: { type: string; accent: string }) {
  if (type === 'none') return null
  const base: React.CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none', transition: 'all 0.4s' }
  if (type === 'frame') return (
    <div style={{ ...base, border: `1px solid ${accent}55`, margin: '10px', borderRadius: '14px', boxShadow: `inset 0 0 0 3px transparent, inset 0 0 24px ${accent}0d` }}>
      <div style={{ position: 'absolute', inset: '4px', border: `0.5px solid ${accent}30`, borderRadius: '11px' }}/>
    </div>
  )
  if (type === 'corners') {
    const corner = (sx: 1 | -1, sy: 1 | -1, posStyle: React.CSSProperties) => (
      <svg key={`${sx}-${sy}`} width="46" height="46" viewBox="0 0 46 46" style={{ position: 'absolute', ...posStyle }}>
        <path
          d={`M ${sx === 1 ? 0 : 46} ${sy === 1 ? 32 : 14} Q ${sx === 1 ? 0 : 46} ${sy === 1 ? 0 : 46} ${sx === 1 ? 32 : 14} ${sy === 1 ? 0 : 46}`}
          fill="none" stroke={accent} strokeWidth="1.2" opacity="0.7"
        />
        <circle cx={sx === 1 ? 8 : 38} cy={sy === 1 ? 8 : 38} r="2.5" fill={accent} opacity="0.8"/>
      </svg>
    )
    return (
      <div style={base}>
        {corner(1, 1, { top: '10px', left: '10px' })}
        {corner(-1, 1, { top: '10px', right: '10px' })}
        {corner(1, -1, { bottom: '10px', left: '10px' })}
        {corner(-1, -1, { bottom: '10px', right: '10px' })}
      </div>
    )
  }
  if (type === 'arch') return (
    <div style={{ ...base, background: `radial-gradient(ellipse 70% 55% at 50% 0%, ${accent}14 0%, transparent 65%)` }}/>
  )
  // crescent watermark
  return (
    <svg style={{ ...base, opacity: 0.05 }} width="100%" height="100%" viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice">
      <path d="M150 40 A95 95 0 1 0 150 260 A75 75 0 1 1 150 40" fill={accent}/>
    </svg>
  )
}

// ── Live campaign preview (guest-facing render) ─────────────────────────────
function LivePreview({ d, honoreeNames, eventType, eventDate, greeting, verseText }: {
  d: Design; honoreeNames: string; eventType: string; eventDate: string; greeting: string; verseText: string
}) {
  const f = fontPair(d.font_pair)
  return (
    <div style={{
      width: '100%', maxWidth: '360px', borderRadius: '22px', overflow: 'hidden',
      background: d.bg, position: 'relative',
      border: `0.5px solid ${d.accent}30`,
      boxShadow: `0 24px 70px rgba(0,0,0,0.5), 0 0 50px ${d.accent}0a`,
      transition: 'background 0.5s, border-color 0.5s, box-shadow 0.5s',
    }}>
      <PatternLayer type={d.pattern} accent={d.accent} opacity={d.pattern_opacity}/>
      <OverlayLayer type={d.overlay} accent={d.accent}/>

      <div style={{ position: 'relative', zIndex: 2 }}>
        {/* Header */}
        <div style={{ padding: '26px 20px 18px', textAlign: 'center', borderBottom: `0.5px solid ${d.accent}18` }}>
          <div style={{ fontFamily: 'var(--font-arabic)', fontSize: '15px', color: d.accent, marginBottom: '6px', direction: 'rtl', transition: 'color 0.4s' }} lang="ar">بَابُ الصَّدَقَة</div>
          <div style={{ fontFamily: f.heading, fontSize: '8px', letterSpacing: '0.24em', color: d.accent, marginBottom: '12px', opacity: 0.75, textTransform: 'uppercase', transition: 'color 0.4s' }}>Baab As-Sadaqah</div>
          <p style={{ fontFamily: f.body, fontSize: '13px', fontStyle: 'italic', color: `${d.text}a8`, lineHeight: 1.55, marginBottom: '10px', transition: 'color 0.4s' }}>
            {greeting || `Welcome to the blessed ${eventType || 'celebration'} of ${honoreeNames || '…'}`}
          </p>
          <h3 style={{ fontFamily: f.heading, fontSize: '21px', fontWeight: 500, color: d.text, marginBottom: '5px', lineHeight: 1.2, transition: 'color 0.4s, font-family 0.2s' }}>
            {honoreeNames || 'Your names here'}
          </h3>
          <div style={{ fontFamily: f.heading, fontSize: '9px', letterSpacing: '0.16em', color: `${d.text}66`, textTransform: 'uppercase' }}>
            {eventType || 'Event type'}{eventDate ? ` · ${eventDate}` : ''}
          </div>
        </div>

        {/* Verse */}
        {verseText && (
          <div style={{ padding: '14px 20px', background: `${d.accent}09`, borderBottom: `0.5px solid ${d.accent}12`, textAlign: 'center' }}>
            <p style={{ fontFamily: f.body, fontSize: '12.5px', fontStyle: 'italic', color: `${d.text}90`, lineHeight: 1.65 }}>"{verseText}"</p>
          </div>
        )}

        {/* Charity chooser mock */}
        <div style={{ padding: '16px 20px 20px' }}>
          <div style={{ fontFamily: f.heading, fontSize: '8px', letterSpacing: '0.18em', color: `${d.text}55`, marginBottom: '9px', textTransform: 'uppercase' }}>Choose a charity</div>
          {['🌍 Share The Meal', '☪️ Islamic Relief USA', '🔵 UNICEF USA'].map((ch, i) => (
            <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 11px', background: i === 0 ? `${d.accent}16` : `${d.text}06`, border: `0.5px solid ${i === 0 ? d.accent + '48' : d.text + '10'}`, borderRadius: '9px', marginBottom: '6px', transition: 'all 0.4s' }}>
              <span style={{ fontSize: '13px' }}>{ch.split(' ')[0]}</span>
              <span style={{ fontFamily: f.body, fontSize: '12px', color: i === 0 ? d.text : `${d.text}80`, fontWeight: 500 }}>{ch.split(' ').slice(1).join(' ')}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
            {[5, 10, 20, 50].map((a, i) => (
              <div key={a} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', background: i === 1 ? d.accent : `${d.text}08`, borderRadius: '100px', fontFamily: f.heading, fontSize: '11px', color: i === 1 ? d.bg : `${d.text}80`, transition: 'all 0.4s' }}>${a}</div>
            ))}
          </div>
          <div style={{ marginTop: '12px', background: d.accent, borderRadius: '10px', padding: '12px', textAlign: 'center', fontFamily: f.heading, fontSize: '11px', letterSpacing: '0.14em', color: d.bg, textTransform: 'uppercase', transition: 'background 0.4s' }}>
            Give $10.00 →
          </div>
        </div>
      </div>
    </div>
  )
}

// ── QR card preview (client-side approximation of the printable download) ──
// The real card is generated server-side once the campaign has a live URL;
// this mirrors that layout with a placeholder QR grid so users can judge
// the print design before publishing.
function QrCardPreview({ d, honoreeNames, eventType, eventDate }: {
  d: Design; honoreeNames: string; eventType: string; eventDate: string
}) {
  const f = fontPair(d.font_pair)
  const eventLine = [eventType, eventDate].filter(Boolean).join('  ·  ')
  // Deterministic-looking placeholder QR grid (visual only, not a real code)
  const cells = useMemo(() => {
    const seed = (honoreeNames + eventType).length || 7
    const grid: boolean[] = []
    for (let i = 0; i < 17 * 17; i++) grid.push(((i * 928371 + seed * 131) % 7) < 3)
    return grid
  }, [honoreeNames, eventType])

  return (
    <div style={{
      width: '100%', maxWidth: '320px', aspectRatio: '1000 / 1300', borderRadius: '18px',
      background: d.bg, position: 'relative', overflow: 'hidden',
      border: `2px solid ${d.accent}90`,
      boxShadow: `0 24px 70px rgba(0,0,0,0.5)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '7% 8% 6%', transition: 'background 0.5s, border-color 0.5s',
    }}>
      <PatternLayer type={d.pattern} accent={d.accent} opacity={d.pattern_opacity + 0.03}/>
      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', width: '100%' }}>
        <div style={{ fontFamily: f.body, fontSize: '10px', letterSpacing: '0.3em', color: d.accent, opacity: 0.85, marginBottom: '6%' }}>BAAB AS-SADAQAH</div>
        <div style={{ fontFamily: f.heading, fontSize: 'clamp(16px,6vw,26px)', fontWeight: 600, color: d.text, marginBottom: '2%', lineHeight: 1.15 }}>{honoreeNames || 'Your Names Here'}</div>
        {eventLine && <div style={{ fontFamily: f.body, fontSize: '9px', letterSpacing: '0.15em', color: `${d.text}99`, marginBottom: '5%' }}>{eventLine.toUpperCase()}</div>}
        <div style={{ fontFamily: f.body, fontSize: '10px', fontStyle: 'italic', color: `${d.text}b0`, marginBottom: '7%' }}>Scan to give sadaqah in our honour</div>
      </div>
      <div style={{ position: 'relative', zIndex: 2, background: '#faf8f2', borderRadius: '12px', border: `2px solid ${d.accent}`, padding: '6%', width: '58%', aspectRatio: '1/1', display: 'grid', gridTemplateColumns: 'repeat(17, 1fr)', gap: '1px' }}>
        {cells.map((on, i) => <div key={i} style={{ background: on ? '#14210f' : 'transparent' }}/>)}
      </div>
      <div style={{ position: 'relative', zIndex: 2, marginTop: 'auto', textAlign: 'center' }}>
        <div style={{ fontFamily: f.heading, fontSize: '11px', letterSpacing: '0.3em', color: d.accent, marginTop: '8%' }}>GREEN ★ EMBLEM</div>
        <div style={{ fontFamily: f.body, fontSize: '8px', color: `${d.text}66`, marginTop: '3px' }}>green-emblem.com</div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CampaignBuilderPage() {
  return (
    <Suspense fallback={<StudioShellLoading/>}>
      <DesignStudio/>
    </Suspense>
  )
}

function StudioShellLoading() {
  return (
    <div style={{ minHeight: '100dvh', background: '#0b120b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-cormorant)', fontSize: '16px', fontStyle: 'italic' }}>Opening the studio…</div>
    </div>
  )
}

function DesignStudio() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('templates')
  const [previewMode, setPreviewMode] = useState<'give' | 'qr'>('give')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(false)
  const [createdSlug, setCreatedSlug] = useState('')

  // Content
  const [honoreeNames, setHonoreeNames] = useState('')
  const [eventType, setEventType] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [location, setLocation] = useState('')
  const [greeting, setGreeting] = useState('')
  const [verse, setVerse] = useState(VERSES[0])
  const [customVerse, setCustomVerse] = useState('')

  // Design
  const [templates, setTemplates] = useState<CampaignTemplate[]>(BUILTIN_TEMPLATES)
  const [activeTemplate, setActiveTemplate] = useState<string>(BUILTIN_TEMPLATES[0].id)
  const [d, setD] = useState<Design>({
    bg: BUILTIN_TEMPLATES[0].bg,
    accent: BUILTIN_TEMPLATES[0].accent,
    text: BUILTIN_TEMPLATES[0].text,
    font_pair: BUILTIN_TEMPLATES[0].font_pair,
    pattern: BUILTIN_TEMPLATES[0].pattern,
    overlay: BUILTIN_TEMPLATES[0].overlay,
    pattern_opacity: BUILTIN_TEMPLATES[0].pattern_opacity,
  })
  const set = (patch: Partial<Design>) => setD(prev => ({ ...prev, ...patch }))

  const verseText = verse.id === 'custom' ? customVerse : verse.text

  // Validate magic link
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
          setGreeting(`Welcome to the blessed ${data.request?.event_type || 'celebration'} of ${data.request?.honoree_names || ''}`)
        } else setTokenValid(false)
      })
      .catch(() => setTokenValid(false))
  }, [token])

  // Load published templates from admin gallery, merged after built-ins
  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.templates) && data.templates.length) {
          setTemplates([...BUILTIN_TEMPLATES, ...data.templates])
        }
      })
      .catch(() => {})
  }, [])

  // Load Google Fonts for every pair once (small set, keeps switching instant)
  useEffect(() => {
    FONT_PAIRS.forEach(f => {
      const id = `gf-${f.id}`
      if (document.getElementById(id)) return
      const link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      link.href = googleFontsHref(f.id)
      document.head.appendChild(link)
    })
  }, [])

  const applyTemplate = (t: CampaignTemplate) => {
    setActiveTemplate(t.id)
    setD({ bg: t.bg, accent: t.accent, text: t.text, font_pair: t.font_pair, pattern: t.pattern, overlay: t.overlay, pattern_opacity: t.pattern_opacity })
  }

  const handlePublish = async () => {
    if (!honoreeNames || !eventType) { setError('Please add the honouree names and event type in Content.'); setTab('content'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token, honoree_names: honoreeNames, event_type: eventType, event_date: eventDate, location,
          theme: {
            template_id: activeTemplate,
            bg: d.bg, accent: d.accent, text: d.text,
            font_pair: d.font_pair, pattern: d.pattern, overlay: d.overlay,
            pattern_opacity: d.pattern_opacity,
            verse: verse.id, custom_verse: verse.id === 'custom' ? customVerse : null,
            greeting_text: greeting,
          },
        }),
      })
      const data = await res.json()
      if (data.campaign) { setCreatedSlug(data.campaign.slug); setCreated(true) }
      else setError(data.error || 'Something went wrong.')
    } catch { setError('Network error.') }
    setSaving(false)
  }

  // ── Shared control styles ─────────────────────────────────────────────────
  const label: React.CSSProperties = { fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '8px', fontWeight: 500 }
  const input: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.05)', border: `0.5px solid ${d.accent}30`, borderRadius: '9px', padding: '11px 13px', fontFamily: 'var(--font-inter)', fontSize: '14px', color: '#fff', outline: 'none', transition: 'border-color 0.2s' }

  if (tokenValid === false) return (
    <div style={{ minHeight: '100dvh', background: '#0b120b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
      <div>
        <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '18px', color: '#fff', marginBottom: '12px' }}>Invalid or expired link</div>
        <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '15px', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', lineHeight: 1.7, maxWidth: '340px' }}>
          Builder links are valid for 7 days. Request a new campaign and you'll get a fresh link instantly.
        </p>
        <a href="/sadaqah/request" style={{ display: 'inline-block', marginTop: '20px', fontFamily: 'var(--font-inter)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', color: '#0f1f0f', background: '#d4af6e', padding: '12px 24px', borderRadius: '9px', textDecoration: 'none' }}>Request a new campaign</a>
      </div>
    </div>
  )

  if (tokenValid === null) return <StudioShellLoading/>

  if (created) return (
    <div style={{ minHeight: '100dvh', background: d.bg, position: 'relative', overflow: 'hidden' }}>
      <PatternLayer type={d.pattern} accent={d.accent} opacity={d.pattern_opacity}/>
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: '24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '480px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(14px)', border: `0.5px solid ${d.accent}30`, borderRadius: '22px', padding: '42px 36px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(46,107,46,0.15)', border: '0.5px solid rgba(46,107,46,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><polyline points="6,14 11,20 22,8" stroke="#4a9e4a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: '22px', fontWeight: 500, color: '#fff', marginBottom: '10px' }}>Your campaign is live</h1>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '15px', fontStyle: 'italic', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: '24px' }}>
            No waiting, no review queue. Guests can give right now at:
          </p>
          <div style={{ background: 'rgba(255,255,255,0.05)', border: `0.5px solid ${d.accent}30`, borderRadius: '9px', padding: '12px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: '#fff', flex: 1, textAlign: 'left', wordBreak: 'break-all' }}>green-emblem.com/give/{createdSlug}</span>
            <button onClick={() => navigator.clipboard.writeText(`https://green-emblem.com/give/${createdSlug}`)} style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 600, color: d.accent, background: 'none', border: `0.5px solid ${d.accent}40`, borderRadius: '7px', padding: '6px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Copy</button>
          </div>
          <a href={`/give/${createdSlug}`} target="_blank" style={{ display: 'block', width: '100%', fontFamily: 'var(--font-inter)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', color: '#0f1f0f', background: d.accent, borderRadius: '10px', padding: '14px', textDecoration: 'none', marginBottom: '10px', textAlign: 'center' }}>View live page ↗</a>
          <a href={`/api/campaigns/${createdSlug}/qr-card?format=png`} download style={{ display: 'block', width: '100%', fontFamily: 'var(--font-inter)', fontSize: '12px', fontWeight: 500, color: d.accent, border: `0.5px solid ${d.accent}40`, borderRadius: '10px', padding: '14px', textDecoration: 'none', marginBottom: '8px', textAlign: 'center' }}>Download printable QR card (PNG)</a>
          <a href={`/api/campaigns/${createdSlug}/qr-card?format=svg`} download style={{ display: 'block', width: '100%', fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 500, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', marginBottom: '10px', textAlign: 'center' }}>Prefer vector? Download as SVG (best for print shops)</a>
          <a href="/dashboard" style={{ display: 'block', width: '100%', fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(255,255,255,0.5)', borderRadius: '10px', padding: '10px', textDecoration: 'none', textAlign: 'center' }}>Go to my dashboard</a>
        </div>
      </div>
    </div>
  )

  // ── STUDIO LAYOUT ─────────────────────────────────────────────────────────
  return (
    <div className="ge-studio" style={{ minHeight: '100dvh', background: '#0b120b', display: 'grid', gridTemplateColumns: '400px 1fr' }}>

      {/* ── Control rail ── */}
      <div style={{ borderRight: '0.5px solid rgba(212,175,110,0.14)', display: 'flex', flexDirection: 'column', maxHeight: '100dvh' }}>
        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '0.5px solid rgba(212,175,110,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="" width={26} height={26} style={{ borderRadius: '6px' }}/>
          <div>
            <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '11px', letterSpacing: '0.18em', color: '#e9e4d8' }}>DESIGN STUDIO</div>
            <div style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>Baab As-Sadaqah</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '0.5px solid rgba(212,175,110,0.1)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: tab === t.id ? 'rgba(212,175,110,0.09)' : 'transparent',
              border: 'none', borderBottom: `2px solid ${tab === t.id ? '#d4af6e' : 'transparent'}`,
              padding: '12px 4px', cursor: 'pointer', transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: '13px', marginBottom: '3px', color: tab === t.id ? '#d4af6e' : 'rgba(255,255,255,0.4)' }}>{t.icon}</div>
              <div style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', fontWeight: 500, color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.4)' }}>{t.label}</div>
            </button>
          ))}
        </div>

        {/* Panel body */}
        <div key={tab} className="step-in" style={{ flex: 1, overflowY: 'auto', padding: '20px 22px 28px' }}>

          {error && <div style={{ background: 'rgba(226,75,74,0.1)', border: '0.5px solid rgba(226,75,74,0.25)', borderRadius: '9px', padding: '11px 14px', marginBottom: '16px', fontFamily: 'var(--font-inter)', fontSize: '13px', color: '#e87573' }}>{error}</div>}

          {/* ── TEMPLATES ── */}
          {tab === 'templates' && (
            <div>
              <label style={label}>Template gallery</label>
              <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, marginBottom: '16px' }}>
                Start from a curated look, then make it yours in the Design and Type tabs.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {templates.map(t => (
                  <button key={t.id} onClick={() => applyTemplate(t)} className="hover-lift" style={{
                    background: t.bg, border: `1.5px solid ${activeTemplate === t.id ? t.accent : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: '12px', padding: 0, overflow: 'hidden', cursor: 'pointer', textAlign: 'left',
                    boxShadow: activeTemplate === t.id ? `0 0 0 3px ${t.accent}25` : 'none',
                  }}>
                    {/* Mini render */}
                    <div style={{ position: 'relative', height: '84px', overflow: 'hidden' }}>
                      <PatternLayer type={t.pattern} accent={t.accent} opacity={t.pattern_opacity + 0.04}/>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                        <div style={{ width: '46%', height: '5px', borderRadius: '3px', background: t.accent }}/>
                        <div style={{ width: '64%', height: '3px', borderRadius: '2px', background: `${t.text}50` }}/>
                        <div style={{ width: '30%', height: '8px', borderRadius: '4px', background: t.accent, marginTop: '3px' }}/>
                      </div>
                    </div>
                    <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.35)' }}>
                      <div style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 500, color: '#fff' }}>{t.name}</div>
                      <div style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', color: 'rgba(255,255,255,0.35)' }}>{t.is_builtin ? 'Classic' : 'Featured'}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── DESIGN ── */}
          {tab === 'design' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              <div>
                <label style={label}>Colorway</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { key: 'bg' as const, name: 'Background' },
                    { key: 'accent' as const, name: 'Accent' },
                    { key: 'text' as const, name: 'Text' },
                  ].map(({ key, name }) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '8px 12px' }}>
                      <input type="color" className="ge-color" value={d[key]} onChange={e => set({ [key]: e.target.value } as any)}/>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', fontWeight: 500, color: '#fff' }}>{name}</div>
                        <div style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>{d[key]}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={label}>Background pattern</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {PATTERNS.map(p => (
                    <button key={p.id} onClick={() => set({ pattern: p.id })} style={{
                      position: 'relative', height: '58px', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer',
                      background: d.bg, border: `1.5px solid ${d.pattern === p.id ? d.accent : 'rgba(255,255,255,0.1)'}`,
                    }}>
                      <PatternLayer type={p.id} accent={d.accent} opacity={0.22}/>
                      <span style={{ position: 'absolute', bottom: '5px', left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-inter)', fontSize: '10px', fontWeight: 500, color: d.pattern === p.id ? '#fff' : 'rgba(255,255,255,0.5)' }}>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={label}>Pattern intensity — {(d.pattern_opacity * 100).toFixed(0)}%</label>
                <input type="range" className="ge-range" min={0.02} max={0.2} step={0.005} value={d.pattern_opacity} onChange={e => set({ pattern_opacity: parseFloat(e.target.value) })}/>
              </div>

              <div>
                <label style={label}>Overlay design</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {OVERLAYS.map(o => (
                    <button key={o.id} onClick={() => set({ overlay: o.id })} style={{
                      background: d.overlay === o.id ? `${d.accent}14` : 'rgba(255,255,255,0.04)',
                      border: `1.5px solid ${d.overlay === o.id ? d.accent : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '10px', padding: '11px 10px', cursor: 'pointer',
                      fontFamily: 'var(--font-inter)', fontSize: '12px', fontWeight: 500,
                      color: d.overlay === o.id ? '#fff' : 'rgba(255,255,255,0.55)', transition: 'all 0.2s',
                    }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TYPE ── */}
          {tab === 'type' && (
            <div>
              <label style={label}>Font pairing</label>
              <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, marginBottom: '16px' }}>
                Heading + body pairs, tuned for elegance and readability.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {FONT_PAIRS.map(f => (
                  <button key={f.id} onClick={() => set({ font_pair: f.id })} style={{
                    background: d.font_pair === f.id ? `${d.accent}12` : 'rgba(255,255,255,0.04)',
                    border: `1.5px solid ${d.font_pair === f.id ? d.accent : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '12px', padding: '14px 16px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                  }}>
                    <div style={{ fontFamily: f.heading, fontSize: '17px', color: '#fff', marginBottom: '3px' }}>{honoreeNames || 'Aisha & Ibrahim'}</div>
                    <div style={{ fontFamily: f.body, fontSize: '13px', color: 'rgba(255,255,255,0.55)', fontStyle: 'italic', marginBottom: '7px' }}>Whatever good you give is for yourselves.</div>
                    <div style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: d.font_pair === f.id ? d.accent : 'rgba(255,255,255,0.3)' }}>{f.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── CONTENT ── */}
          {tab === 'content' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={label}>Names to honour *</label>
                <input type="text" value={honoreeNames} onChange={e => setHonoreeNames(e.target.value)} placeholder="e.g. Aisha & Ibrahim" style={input}/>
              </div>
              <div>
                <label style={label}>Event type *</label>
                <select value={eventType} onChange={e => setEventType(e.target.value)} style={{ ...input, cursor: 'pointer', appearance: 'none', background: 'rgba(15,31,15,0.9)' }}>
                  <option value="">Select event type…</option>
                  {['Nikkah', 'Walima', 'Aqiqah', 'Eid', 'Graduation', 'Anniversary', 'Birthday', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={label}>Event date</label>
                  <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} style={{ ...input, colorScheme: 'dark' }}/>
                </div>
                <div>
                  <label style={label}>Location</label>
                  <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Queens, NY" style={input}/>
                </div>
              </div>
              <div>
                <label style={label}>Greeting message</label>
                <textarea value={greeting} onChange={e => setGreeting(e.target.value)} style={{ ...input, resize: 'vertical', minHeight: '70px', lineHeight: 1.5 }}/>
              </div>
              <div>
                <label style={label}>Verse or du'a</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {VERSES.map(v => (
                    <button key={v.id} onClick={() => setVerse(v)} style={{
                      background: verse.id === v.id ? `${d.accent}10` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${verse.id === v.id ? d.accent + '60' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: '10px', padding: '11px 13px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                    }}>
                      <div style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', fontWeight: 500, color: verse.id === v.id ? '#fff' : 'rgba(255,255,255,0.6)', marginBottom: v.text ? '3px' : 0 }}>{v.label}</div>
                      {v.text && <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '13px', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>{v.text}</div>}
                    </button>
                  ))}
                </div>
                {verse.id === 'custom' && (
                  <textarea value={customVerse} onChange={e => setCustomVerse(e.target.value)} placeholder="Enter your chosen verse…" style={{ ...input, resize: 'vertical', minHeight: '70px', lineHeight: 1.5, marginTop: '10px' }}/>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Publish bar */}
        <div style={{ padding: '14px 22px', borderTop: '0.5px solid rgba(212,175,110,0.12)', background: 'rgba(0,0,0,0.3)' }}>
          <button onClick={handlePublish} disabled={saving} className="btn-gold" style={{ width: '100%', opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Publishing…' : 'Publish campaign — goes live instantly'}
          </button>
        </div>
      </div>

      {/* ── Live render canvas ── */}
      <div style={{
        position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 32px', background: `radial-gradient(ellipse at 60% 20%, ${d.accent}0a 0%, transparent 55%), #0b120b`,
        transition: 'background 0.6s', overflowY: 'auto', maxHeight: '100dvh',
      }}>
        <div style={{ position: 'absolute', top: '20px', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
            {previewMode === 'give' ? 'Live preview — exactly what your guests will see' : 'Printable QR card preview'}
          </div>
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '100px', padding: '3px' }}>
            {(['give', 'qr'] as const).map(m => (
              <button key={m} onClick={() => setPreviewMode(m)} style={{
                fontFamily: 'var(--font-inter)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.04em',
                padding: '6px 14px', borderRadius: '100px', border: 'none', cursor: 'pointer',
                background: previewMode === m ? d.accent : 'transparent',
                color: previewMode === m ? d.bg : 'rgba(255,255,255,0.5)', transition: 'all 0.2s',
              }}>
                {m === 'give' ? 'Donation page' : 'QR card'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginTop: '56px' }}>
          {previewMode === 'give'
            ? <LivePreview d={d} honoreeNames={honoreeNames} eventType={eventType} eventDate={eventDate} greeting={greeting} verseText={verseText}/>
            : <QrCardPreview d={d} honoreeNames={honoreeNames} eventType={eventType} eventDate={eventDate}/>
          }
        </div>
      </div>

      {/* Responsive: stack on mobile */}
      <style>{`
        @media (max-width: 860px) {
          .ge-studio { grid-template-columns: 1fr !important; }
          .ge-studio > div:last-child { min-height: 60dvh; }
        }
      `}</style>
    </div>
  )
}
