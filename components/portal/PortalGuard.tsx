'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export type Membership = { masjidId: string; masjidName: string; role: string }

// Client-side gate for every portal page. Anyone without a masjid membership
// is bounced to sign-in — including signed-in consumer users who happen to
// land on the portal hostname.
export function usePortalSession() {
  const router = useRouter()
  const supabase = createClient()
  const [state, setState] = useState<{ loading: boolean; membership: Membership | null }>({
    loading: true, membership: null,
  })

  useEffect(() => {
    let cancelled = false

    // A gate that hangs is a gate that's open. If auth or the membership
    // check can't answer — network down, Supabase unreachable, a malformed
    // response — we fail CLOSED and send them to sign-in rather than
    // leaving them on a portal page forever showing "LOADING…".
    const timer = setTimeout(() => {
      if (!cancelled) router.replace('/portal/sign-in?retry=1')
    }, 8000)

    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled) return
        if (!session) { router.replace('/portal/sign-in'); return }

        const res = await fetch('/api/portal/posts', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (cancelled) return
        if (res.status === 401 || res.status === 403) {
          router.replace('/portal/sign-in?denied=1'); return
        }
        if (!res.ok) { router.replace('/portal/sign-in?retry=1'); return }

        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        setState({
          loading: false,
          membership: json.masjid
            ? { masjidId: json.masjid.id, masjidName: json.masjid.name, role: 'owner' }
            : null,
        })
      } catch {
        if (!cancelled) router.replace('/portal/sign-in?retry=1')
      } finally {
        clearTimeout(timer)
      }
    })()

    return () => { cancelled = true; clearTimeout(timer) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}

export function PortalLoading() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <div className="font-cinzel text-[11px] tracking-[0.2em] text-white/30">LOADING…</div>
    </div>
  )
}
