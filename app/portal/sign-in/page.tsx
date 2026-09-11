'use client'
import { useState, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function PortalSignIn() {
  return <Suspense fallback={null}><SignInInner/></Suspense>
}

function SignInInner() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(
    params.get('denied') ? 'That account doesn’t manage a masjid. Ask Green Emblem for an invitation.' : ''
  )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) { setError('That email and password don’t match.'); setBusy(false); return }
    router.replace('/portal')
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-5 py-12">
      <div className="w-full max-w-[390px]">
        <div className="mb-8 text-center">
          <Image src="/icons/icon-192.png" alt="" width={48} height={48} className="mx-auto mb-4 rounded-xl" />
          <div className="mb-1.5 font-cinzel text-[9px] tracking-[0.28em] text-gold">MASJID PORTAL</div>
          <h1 className="font-cinzel text-[22px] font-medium text-white">Sign in</h1>
        </div>

        <form onSubmit={submit} className="rounded-xl border border-white/10 bg-[#0a1a0a] p-6">
          <label className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-white/45">Email</label>
          <Input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            autoComplete="username" required className="mb-4"
          />

          <label className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-white/45">Password</label>
          <Input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            autoComplete="current-password" required className="mb-5"
          />

          {error && <p className="mb-4 text-[13px] text-destructive">{error}</p>}

          <Button type="submit" variant="brand" className="w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-5 text-center font-cormorant text-[13px] italic leading-relaxed text-white/35">
          Access is by invitation. If your masjid isn’t set up yet, contact Green Emblem.
        </p>
      </div>
    </div>
  )
}
