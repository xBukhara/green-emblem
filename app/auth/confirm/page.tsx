'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ConfirmPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let cancelled = false

    async function checkAndRoute() {
      // Wait briefly for cookies to settle after OAuth redirect
      await new Promise(r => setTimeout(r, 500))

      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Also try listening for auth state change (handles hash-fragment flows)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (cancelled) return
            if (session?.user) {
              subscription.unsubscribe()
              await routeUser(session.user.id)
            }
          }
        )
        // If nothing happens in 5s, send to sign-in
        setTimeout(() => {
          if (!cancelled) {
            subscription.unsubscribe()
            router.replace('/auth/sign-in')
          }
        }, 5000)
        return
      }

      await routeUser(user.id)
    }

    async function routeUser(userId: string) {
      if (cancelled) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_complete')
        .eq('id', userId)
        .single()

      if (cancelled) return

      if (!profile || !profile.onboarding_complete) {
        router.replace('/onboarding')
      } else {
        router.replace('/dashboard')
      }
    }

    checkAndRoute()
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1f0f' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '18px', color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', marginBottom: '16px' }}>
          Signing you in…
        </div>
        <div style={{
          width: '32px', height: '32px',
          border: '2px solid rgba(212,175,110,0.3)',
          borderTop: '2px solid #d4af6e',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto',
        }}/>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
