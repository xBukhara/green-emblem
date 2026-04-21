'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ConfirmPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/dashboard')
        return
      }
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session) router.replace('/dashboard')
      })
      const timeout = setTimeout(() => router.replace('/auth/sign-in'), 5000)
      return () => { subscription.unsubscribe(); clearTimeout(timeout) }
    })
  }, [])

  return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f1f0f' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'18px', color:'rgba(255,255,255,0.6)', fontStyle:'italic', marginBottom:'16px' }}>Signing you in…</div>
        <div style={{ width:'32px', height:'32px', border:'2px solid rgba(212,175,110,0.3)', borderTop:'2px solid #d4af6e', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto' }}/>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
