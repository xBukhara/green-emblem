'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignInPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100dvh', background:'#0f1f0f' }}/>}>
      <SignInInner />
    </Suspense>
  )
}

function SignInInner() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard')
    })
  }, [])

  const signInWithGoogle = async () => {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://green-emblem.com/auth/confirm',
        queryParams: { access_type: 'offline', prompt: 'consent' },
        skipBrowserRedirect: false,
      },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', position:'relative', zIndex:2, background:'#0f1f0f' }}>
      <div style={{ background:'rgba(15,31,15,0.75)', border:'0.5px solid rgba(212,175,110,0.2)', borderRadius:'20px', padding:'40px 36px', width:'100%', maxWidth:'400px', textAlign:'center', backdropFilter:'blur(12px)' }}>
        <svg width="64" height="64" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom:'20px' }}>
          <rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke="#c8a050" strokeWidth="2" transform="rotate(0 110 110)"/>
          <rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke="#c8a050" strokeWidth="2" transform="rotate(45 110 110)"/>
          <polygon points="110,42 158,42 190,74 190,146 158,178 62,178 30,146 30,74 62,42" fill="#2e6b2e" stroke="#c8a050" strokeWidth="2"/>
          <circle cx="103" cy="104" r="44" fill="#d4af6e"/>
          <circle cx="117" cy="96" r="37" fill="#2e6b2e"/>
          <g transform="translate(158,82)"><polygon points="0,-16 3.8,-6.2 14.8,-5 6.8,3 9.4,14 0,8.2 -9.4,14 -6.8,3 -14.8,-5 -3.8,-6.2" fill="#d4af6e"/></g>
        </svg>
        <h1 style={{ fontFamily:'var(--font-cinzel)', fontSize:'22px', fontWeight:500, color:'#fff', marginBottom:'8px' }}>Green Emblem</h1>
        <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'15px', fontStyle:'italic', color:'rgba(255,255,255,0.5)', marginBottom:'32px', lineHeight:1.6 }}>
          Sign in to manage your orders, donations, and event campaigns.
        </p>
        {error && (
          <div style={{ background:'rgba(226,75,74,0.1)', border:'0.5px solid rgba(226,75,74,0.3)', borderRadius:'8px', padding:'10px 14px', marginBottom:'16px', fontSize:'13px', color:'#e24b4a' }}>{error}</div>
        )}
        <button onClick={signInWithGoogle} disabled={loading} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'12px', background:'#fff', color:'#1a1a1a', border:'none', borderRadius:'10px', padding:'14px 20px', fontFamily:'var(--font-cormorant)', fontSize:'17px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          {loading ? 'Redirecting…' : 'Continue with Google'}
        </button>
        <p style={{ fontFamily:'var(--font-cormorant)', fontSize:'12px', color:'rgba(255,255,255,0.3)', marginTop:'16px', lineHeight:1.6, fontStyle:'italic' }}>
          By signing in you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
