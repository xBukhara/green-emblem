'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Invite = { email: string; masjidName: string }

const PROBLEMS: Record<string, string> = {
  invalid: 'This invitation link isn’t valid. Ask Green Emblem to send a new one.',
  used: 'This invitation has already been used. Try signing in instead.',
  expired: 'This invitation has expired. Ask Green Emblem for a fresh link.',
  // Distinct on purpose: telling someone their invitation is invalid when
  // the truth is that we couldn't reach the server would send them chasing
  // a replacement link they don't need.
  unavailable: 'We couldn’t check this invitation just now. Refresh the page in a moment — the link is still good.',
}

export default function AcceptInvite({ params }: { params: { token: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const [invite, setInvite] = useState<Invite | null>(null)
  const [problem, setProblem] = useState('')
  const [loading, setLoading] = useState(true)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Never leave someone on "LOADING…" — if the check can't complete we
    // say so plainly instead of spinning.
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 8000)

    fetch(`/api/portal/invite/accept?token=${encodeURIComponent(params.token)}`, {
      signal: ac.signal,
    })
      .then(async r => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) {
          // A 5xx is our problem, not a bad link.
          setProblem(PROBLEMS[j.error] || (r.status >= 500 ? PROBLEMS.unavailable : PROBLEMS.invalid))
        } else setInvite(j)
      })
      .catch(() => setProblem(PROBLEMS.unavailable))
      .finally(() => { clearTimeout(timer); setLoading(false) })

    return () => { clearTimeout(timer); ac.abort() }
  }, [params.token])

  const tooShort = password.length > 0 && password.length < 10
  const mismatch = confirm.length > 0 && password !== confirm

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 10 || password !== confirm) return
    setBusy(true); setError('')

    const res = await fetch('/api/portal/invite/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: params.token, password }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setError(j.error || 'Something went wrong.'); setBusy(false); return }

    // Sign them straight in — no second password entry
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: j.email, password })
    if (signInErr) { router.replace('/portal/sign-in'); return }
    router.replace('/portal')
  }

  if (loading) {
    return <div className="flex min-h-[100dvh] items-center justify-center font-cinzel text-[11px] tracking-[0.2em] text-white/30">LOADING…</div>
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-5 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <Image src="/icons/icon-192.png" alt="" width={48} height={48} className="mx-auto mb-4 rounded-xl" />
          <div className="mb-1.5 font-cinzel text-[9px] tracking-[0.28em] text-gold">MASJID PORTAL</div>
        </div>

        {problem ? (
          <div className="rounded-xl border border-white/10 bg-[#0a1a0a] p-6 text-center">
            <p className="mb-5 font-cormorant text-[15px] italic leading-relaxed text-white/60">{problem}</p>
            <Button asChild variant="outline" className="w-full"><a href="/portal/sign-in">Go to sign in</a></Button>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-xl border border-white/10 bg-[#0a1a0a] p-6">
            <h1 className="mb-2 font-cinzel text-[20px] font-medium leading-snug text-white">
              Set your password
            </h1>
            <p className="mb-6 font-cormorant text-[14px] italic leading-relaxed text-white/55">
              You&apos;ve been invited to manage <span className="text-gold">{invite?.masjidName}</span>.
              Choose a password for <span className="text-white/80">{invite?.email}</span>.
            </p>

            <label className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-white/45">Password</label>
            <Input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="new-password" required className="mb-1"
            />
            <p className={`mb-4 text-[12px] ${tooShort ? 'text-destructive' : 'text-white/35'}`}>
              At least 10 characters.
            </p>

            <label className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-white/45">Confirm password</label>
            <Input
              type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password" required className="mb-1"
            />
            <p className={`mb-5 text-[12px] ${mismatch ? 'text-destructive' : 'text-transparent'}`}>
              Those don&apos;t match.
            </p>

            {error && <p className="mb-4 text-[13px] text-destructive">{error}</p>}

            <Button
              type="submit" variant="brand" className="w-full"
              disabled={busy || password.length < 10 || password !== confirm}
            >
              <Check className="h-4 w-4" />
              {busy ? 'Setting up…' : 'Set password and continue'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
