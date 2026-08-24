'use client'
import { useState } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

const label: React.CSSProperties = { fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }
const inp: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(212,175,110,0.25)', borderRadius: '9px', padding: '12px 14px', fontFamily: 'var(--font-inter)', fontSize: '14px', color: '#fff', outline: 'none' }

const TOPICS = ['General question', 'Baab As-Sadaqah / campaign help', 'GreenWorld+ / masjid listing', 'Shop order', 'Press / partnership', 'Something else']

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', topic: TOPICS[0], message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.name || !form.email || !form.message) {
      setError('Please fill in your name, email, and message.')
      return
    }
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong. Please try again.'); setSending(false); return }
      setSent(true)
    } catch {
      setError('Network error. Please check your connection and try again.')
      setSending(false)
    }
  }

  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ paddingTop: '88px', minHeight: '100dvh', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: '560px', margin: '0 auto', padding: '60px 24px 100px' }}>

          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '9px', letterSpacing: '0.28em', color: 'var(--gold)', marginBottom: '14px' }}>GET IN TOUCH</div>
            <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: 'clamp(28px,5vw,42px)', fontWeight: 500, color: '#fff', marginBottom: '12px' }}>Contact us</h1>
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '17px', fontStyle: 'italic', color: 'rgba(255,255,255,0.5)' }}>
              Questions, ideas, or something not working right — we read everything.
            </p>
          </div>

          {sent ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', background: 'rgba(15,31,15,0.5)', border: '0.5px solid rgba(212,175,110,0.15)', borderRadius: '16px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(46,107,46,0.15)', border: '0.5px solid rgba(46,107,46,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                <svg width="22" height="22" viewBox="0 0 28 28" fill="none"><polyline points="6,14 11,20 22,8" stroke="#4a9e4a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '18px', color: '#fff', marginBottom: '10px' }}>Message sent</div>
              <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '15px', fontStyle: 'italic', color: 'rgba(255,255,255,0.5)' }}>
                We'll get back to you at {form.email} as soon as we can.
              </p>
            </div>
          ) : (
            <div style={{ background: 'rgba(15,31,15,0.5)', border: '0.5px solid rgba(212,175,110,0.15)', borderRadius: '16px', padding: '28px' }}>
              {error && <div style={{ background: 'rgba(226,75,74,0.1)', border: '0.5px solid rgba(226,75,74,0.3)', borderRadius: '9px', padding: '11px 14px', marginBottom: '18px', fontFamily: 'var(--font-inter)', fontSize: '13px', color: '#e87573' }}>{error}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={label}>Name</label>
                  <input type="text" value={form.name} onChange={e => set('name', e.target.value)} style={inp}/>
                </div>
                <div>
                  <label style={label}>Email</label>
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inp}/>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={label}>Topic</label>
                <select value={form.topic} onChange={e => set('topic', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                  {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: '22px' }}>
                <label style={label}>Message</label>
                <textarea value={form.message} onChange={e => set('message', e.target.value)} rows={6} style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }}/>
              </div>

              <button onClick={submit} disabled={sending} className="btn-gold" style={{ width: '100%', opacity: sending ? 0.6 : 1, cursor: sending ? 'not-allowed' : 'pointer' }}>
                {sending ? 'Sending…' : 'Send message'}
              </button>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '32px' }}>
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '14px', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
              Or reach us directly at <a href="mailto:hello@green-emblem.com" style={{ color: 'var(--gold)', textDecoration: 'none' }}>hello@green-emblem.com</a>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
