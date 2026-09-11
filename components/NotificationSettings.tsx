'use client'
import { useEffect, useState, useCallback } from 'react'
import { Bell, BellOff, Share, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  currentState, subscribe, unsubscribe, updatePrefs, fetchPrefs, sendTest,
  type PushState, type PushPrefs,
} from '@/lib/push-client'

const CATEGORIES: { key: keyof PushPrefs; label: string; desc: string }[] = [
  {
    key: 'notify_prayer_daily',
    label: "Today's prayer times",
    desc: 'One notification each morning with all five times for your location.',
  },
  {
    key: 'notify_prayer_each',
    label: 'Each prayer as it comes in',
    desc: 'A reminder at every prayer time. Requires the per-minute scheduler to be enabled.',
  },
  {
    key: 'notify_masjid_events',
    label: 'Events from your masjid',
    desc: 'When a masjid you follow posts something new.',
  },
]

export default function NotificationSettings() {
  const supabase = createClient()
  const [state, setState] = useState<PushState | null>(null)
  const [prefs, setPrefs] = useState<PushPrefs | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const refresh = useCallback(async () => {
    const s = await currentState()
    setState(s)
    if (s === 'subscribed') setPrefs(await fetchPrefs(supabase))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { refresh() }, [refresh])

  const enable = async () => {
    setBusy(true); setMsg(null)
    const res = await subscribe(supabase)
    setBusy(false)
    if (!res.ok) { setMsg({ kind: 'err', text: res.error || 'Could not enable notifications.' }); return }
    await refresh()
    setMsg({ kind: 'ok', text: 'Notifications are on for this device.' })
  }

  const disable = async () => {
    setBusy(true); setMsg(null)
    await unsubscribe(supabase)
    setBusy(false)
    setPrefs(null)
    await refresh()
  }

  const toggle = async (key: keyof PushPrefs) => {
    if (!prefs) return
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)                       // optimistic
    const res = await updatePrefs(supabase, { [key]: next[key] })
    if (!res.ok) setPrefs(prefs)         // roll back
  }

  const test = async () => {
    setBusy(true); setMsg(null)
    const res = await sendTest(supabase)
    setBusy(false)
    setMsg(res.ok
      ? { kind: 'ok', text: 'Sent — it should appear in a moment.' }
      : { kind: 'err', text: res.error || 'Could not send a test.' })
  }

  if (state === null) return null

  const card = 'rounded-lg border border-gold/15 bg-forest/60 p-6'

  // iOS only allows web push for installed PWAs — say so plainly instead of
  // showing a button that cannot work.
  if (state === 'ios-needs-install') {
    return (
      <div className={card}>
        <div className="mb-4 font-cinzel text-[9px] tracking-[0.2em] text-gold">NOTIFICATIONS</div>
        <p className="mb-4 font-cormorant text-[15px] italic leading-relaxed text-white/60">
          On iPhone and iPad, notifications work once Green Emblem is added to your Home Screen.
        </p>
        <div className="flex items-center gap-2 rounded-lg bg-black/20 px-3.5 py-3 font-cinzel text-[10px] tracking-[0.12em] text-white/70">
          <Share className="h-4 w-4 shrink-0 text-gold" />
          Tap Share → Add to Home Screen, then reopen from your Home Screen
        </div>
      </div>
    )
  }

  if (state === 'unsupported') {
    return (
      <div className={card}>
        <div className="mb-4 font-cinzel text-[9px] tracking-[0.2em] text-gold">NOTIFICATIONS</div>
        <p className="font-cormorant text-[15px] italic leading-relaxed text-white/50">
          This browser doesn&apos;t support notifications. Try Chrome, Edge, or Safari 16.4+.
        </p>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className={card}>
        <div className="mb-4 font-cinzel text-[9px] tracking-[0.2em] text-gold">NOTIFICATIONS</div>
        <p className="font-cormorant text-[15px] italic leading-relaxed text-white/60">
          Notifications are blocked for this site. Re-enable them in your browser&apos;s site
          settings, then reload this page.
        </p>
      </div>
    )
  }

  return (
    <div className={card}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="font-cinzel text-[9px] tracking-[0.2em] text-gold">NOTIFICATIONS</div>
        {state === 'subscribed' && (
          <span className="flex items-center gap-1.5 font-cinzel text-[9px] tracking-[0.1em] text-forest-light">
            <Check className="h-3 w-3" /> ON
          </span>
        )}
      </div>

      {state === 'unsubscribed' ? (
        <>
          <p className="mb-5 font-cormorant text-[15px] italic leading-relaxed text-white/60">
            Get prayer times each morning and hear first when your masjid posts an event.
            You can turn any of it off afterwards.
          </p>
          <Button variant="brand" onClick={enable} disabled={busy} className="w-full sm:w-auto">
            <Bell className="h-4 w-4" />
            {busy ? 'Enabling…' : 'Turn on notifications'}
          </Button>
        </>
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-1">
            {CATEGORIES.map(({ key, label, desc }) => {
              const on = !!prefs?.[key]
              return (
                <button
                  key={key}
                  onClick={() => toggle(key)}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border-none bg-transparent px-3 py-3 text-left transition-colors hover:bg-white/5"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
                      on ? 'bg-gold' : 'bg-white/15'
                    )}
                  >
                    <span className={cn(
                      'h-4 w-4 rounded-full bg-forest-deepest transition-transform',
                      on && 'translate-x-4'
                    )}/>
                  </span>
                  <span className="min-w-0">
                    <span className="block font-cinzel text-[13px] text-white">{label}</span>
                    <span className="block font-cormorant text-[13px] italic leading-snug text-white/45">{desc}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" size="sm" onClick={test} disabled={busy} className="w-full sm:w-auto">
              Send a test
            </Button>
            <Button variant="ghost" size="sm" onClick={disable} disabled={busy} className="w-full text-white/60 sm:w-auto">
              <BellOff className="h-4 w-4" />
              Turn off on this device
            </Button>
          </div>
        </>
      )}

      {msg && (
        <p className={cn(
          'mt-4 font-cormorant text-[13px] italic',
          msg.kind === 'ok' ? 'text-forest-light' : 'text-destructive'
        )}>
          {msg.text}
        </p>
      )}
    </div>
  )
}
