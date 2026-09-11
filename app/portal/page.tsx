'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Users, Megaphone, Plus, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PortalShell from '@/components/portal/PortalShell'
import { usePortalSession, PortalLoading } from '@/components/portal/PortalGuard'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TYPE_LABEL: Record<string, string> = {
  event: 'Event', fundraiser: 'Fundraiser', program: 'Program', youth: 'Youth',
}

export default function PortalHome() {
  const { loading, membership } = usePortalSession()
  const supabase = createClient()
  const [posts, setPosts] = useState<any[]>([])
  const [followers, setFollowers] = useState<number | null>(null)

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

      const { count } = await supabase
        .from('profiles').select('id', { count: 'exact', head: true })
        .eq('followed_masjid_id', membership.masjidId)
      setFollowers(count ?? 0)
    })()
  }, [membership]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PortalLoading />

  const now = Date.now()
  const upcoming = posts.filter(p => p.starts_at && new Date(p.starts_at).getTime() > now)
  const totalGoing = posts.reduce((s, p) => s + (p.going || 0), 0)

  const stats = [
    { label: 'Followers', value: followers ?? '—', Icon: Users,
      hint: 'People who get your posts as notifications' },
    { label: 'Upcoming', value: upcoming.length, Icon: CalendarDays,
      hint: 'Events and programs still ahead' },
    { label: 'Attending', value: totalGoing, Icon: Megaphone,
      hint: 'Total RSVPs across your posts' },
  ]

  return (
    <PortalShell masjidName={membership?.masjidName}>
      <div className="mx-auto max-w-[980px]">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="mb-1 font-cinzel text-[24px] font-medium text-white">Overview</h1>
            <p className="font-cormorant text-[15px] italic text-white/45">
              Everything your community sees, in one place.
            </p>
          </div>
          <Button asChild variant="brand">
            <Link href="/portal/posts/new"><Plus className="h-4 w-4" />New post</Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          {stats.map(({ label, value, Icon, hint }) => (
            <div key={label} className="rounded-xl border border-white/10 bg-[#0a1a0a] p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</span>
                <Icon className="h-4 w-4 text-gold/70" strokeWidth={1.7} />
              </div>
              <div className="font-cinzel text-[30px] leading-none text-white">{value}</div>
              <div className="mt-2 font-cormorant text-[13px] italic leading-snug text-white/35">{hint}</div>
            </div>
          ))}
        </div>

        {/* Recent posts */}
        <div className="rounded-xl border border-white/10 bg-[#0a1a0a]">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
            <h2 className="font-cinzel text-[13px] tracking-wide text-white">Recent posts</h2>
            <Link href="/portal/posts" className="flex items-center gap-1 text-[12px] text-white/50 no-underline hover:text-white">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {posts.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="mb-5 font-cormorant text-[15px] italic leading-relaxed text-white/45">
                Nothing posted yet. Your first event will reach everyone following your masjid.
              </p>
              <Button asChild variant="outline"><Link href="/portal/posts/new">Create your first post</Link></Button>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {posts.slice(0, 6).map(p => (
                <Link
                  key={p.id}
                  href={`/portal/posts/${p.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 no-underline transition-colors hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[14px] text-white">{p.title}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[12px] text-white/35">
                      <span className="text-gold/70">{TYPE_LABEL[p.type]}</span>
                      {p.starts_at && (
                        <>·<span>{new Date(p.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></>
                      )}
                      {p.status === 'draft' && <><span>·</span><span className="text-white/50">Draft</span></>}
                    </div>
                  </div>
                  <div className={cn('shrink-0 text-[12px]', p.going ? 'text-gold' : 'text-white/25')}>
                    {p.rsvp_enabled ? `${p.going || 0} going` : '—'}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  )
}
