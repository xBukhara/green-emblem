'use client'
import { useEffect, useState } from 'react'
import { Check, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ── "Going" only ─────────────────────────────────────────────────────────
// There is no "can't make it" button anywhere in this component, and the
// API has no state for it. Tapping again withdraws — people's plans change,
// and without that the headcount inflates until it's useless to the masjid.
// What we never do is ask someone to announce that they're not coming, or
// show a tally of absences.

export default function RsvpButton({
  postId, initialCount = 0, size = 'default',
}: {
  postId: string
  initialCount?: number
  size?: 'default' | 'sm'
}) {
  const supabase = createClient()
  const [going, setGoing] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/posts/${postId}/rsvp`, {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      if (cancelled || !res.ok) { setReady(true); return }
      const j = await res.json()
      setGoing(!!j.going)
      setCount(j.count ?? 0)
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [postId]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async () => {
    setBusy(true); setNote('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setBusy(false)
      setNote('Sign in to let them know you’re coming.')
      return
    }

    // Optimistic — the network round trip shouldn't make the tap feel slow
    const wasGoing = going
    setGoing(!wasGoing)
    setCount(c => Math.max(0, c + (wasGoing ? -1 : 1)))

    const res = await fetch(`/api/posts/${postId}/rsvp`, {
      method: wasGoing ? 'DELETE' : 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) {
      setGoing(wasGoing)                                   // roll back
      setCount(c => Math.max(0, c + (wasGoing ? 1 : -1)))
      const j = await res.json().catch(() => ({}))
      setNote(j.error || 'Could not update your RSVP.')
    } else {
      const j = await res.json()
      setGoing(j.going)
      setCount(j.count ?? 0)
    }
    setBusy(false)
  }

  if (!ready) return null

  const compact = size === 'sm'

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={toggle}
        disabled={busy}
        aria-pressed={going}
        className={cn(
          'inline-flex cursor-pointer items-center gap-2 rounded-lg border font-cinzel tracking-wider2 transition-all',
          compact ? 'px-3.5 py-2 text-[10px]' : 'px-5 py-2.5 text-[11px]',
          going
            ? 'border-forest-mid bg-forest-mid/20 text-forest-light'
            : 'border-gold bg-gold text-forest-deepest hover:opacity-90'
        )}
      >
        {going ? <Check className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> : null}
        {going ? "You're going" : 'Going'}
      </button>

      {count > 0 && (
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-white/50">
          <Users className="h-3.5 w-3.5 text-gold/70" />
          {count} {count === 1 ? 'person' : 'people'} going
        </span>
      )}

      {note && <span className="font-cormorant text-[13px] italic text-white/45">{note}</span>}
    </div>
  )
}
