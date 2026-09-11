'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PortalShell from '@/components/portal/PortalShell'
import { usePortalSession, PortalLoading } from '@/components/portal/PortalGuard'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'event', label: 'Events' },
  { id: 'youth', label: 'Youth' },
  { id: 'program', label: 'Programs' },
  { id: 'fundraiser', label: 'Fundraisers' },
]

const TYPE_LABEL: Record<string, string> = {
  event: 'Event', fundraiser: 'Fundraiser', program: 'Program', youth: 'Youth',
}

export default function PostsList() {
  const { loading, membership } = usePortalSession()
  const supabase = createClient()
  const [posts, setPosts] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [fetched, setFetched] = useState(false)

  useEffect(() => {
    if (!membership) return
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/portal/posts', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const j = await res.json().catch(() => ({}))
      setPosts(j.posts || [])
      setFetched(true)
    })()
  }, [membership]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PortalLoading />

  const shown = filter === 'all' ? posts : posts.filter(p => p.type === filter)

  return (
    <PortalShell masjidName={membership?.masjidName}>
      <div className="mx-auto max-w-[980px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-cinzel text-[24px] font-medium text-white">Posts</h1>
          <Button asChild variant="brand">
            <Link href="/portal/posts/new"><Plus className="h-4 w-4" />New post</Link>
          </Button>
        </div>

        <div className="mb-5 flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'cursor-pointer rounded-full border px-3.5 py-1.5 text-[12px] transition-colors',
                filter === f.id
                  ? 'border-gold/50 bg-gold/10 text-gold'
                  : 'border-white/10 bg-transparent text-white/50 hover:text-white'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a1a0a]">
          {!fetched ? (
            <div className="px-5 py-12 text-center font-cinzel text-[11px] tracking-[0.2em] text-white/25">LOADING…</div>
          ) : shown.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <p className="mb-5 font-cormorant text-[15px] italic text-white/45">
                {filter === 'all' ? 'Nothing posted yet.' : `No ${FILTERS.find(f => f.id === filter)?.label.toLowerCase()} yet.`}
              </p>
              <Button asChild variant="outline"><Link href="/portal/posts/new">Create one</Link></Button>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {shown.map(p => (
                <Link
                  key={p.id}
                  href={`/portal/posts/${p.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 no-underline transition-colors hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14.5px] text-white">{p.title}</span>
                      {p.status === 'draft' && (
                        <span className="shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/50">Draft</span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-white/35">
                      <span className="text-gold/70">{TYPE_LABEL[p.type]}</span>
                      {p.starts_at && (
                        <>·<span>{new Date(p.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                          <span>{new Date(p.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span></>
                      )}
                      {p.type === 'program' && p.schedule_text && <>·<span>{p.schedule_text}</span></>}
                      {p.type === 'fundraiser' && p.goal_amount && (
                        <>·<span>${Number(p.raised_amount || 0).toLocaleString()} of ${Number(p.goal_amount).toLocaleString()}</span></>
                      )}
                    </div>
                  </div>
                  {p.rsvp_enabled && (
                    <div className={cn('flex shrink-0 items-center gap-1.5 text-[12.5px]', p.going ? 'text-gold' : 'text-white/25')}>
                      <Users className="h-3.5 w-3.5" />
                      {p.going || 0}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  )
}
