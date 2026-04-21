'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ConfirmPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push('/dashboard')
      } else if (event === 'SIGNED_OUT') {
        router.push('/auth/sign-in')
      }
    })

    // Also check immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontFamily:'var(--font-cormorant)', fontSize:'18px', color:'rgba(255,255,255,0.6)', fontStyle:'italic' }}>
        Signing you in…
      </div>
    </div>
  )
}
