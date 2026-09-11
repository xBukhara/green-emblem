'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Trash2, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PortalShell from '@/components/portal/PortalShell'
import PostForm from '@/components/portal/PostForm'
import { usePortalSession, PortalLoading } from '@/components/portal/PortalGuard'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'

export default function EditPost({ params }: { params: { id: string } }) {
  const { loading, membership } = usePortalSession()
  const router = useRouter()
  const supabase = createClient()
  const [post, setPost] = useState<any>(null)
  const [attendees, setAttendees] = useState<any[]>([])
  const [notFound, setNotFound] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!membership) return
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`/api/portal/posts/${params.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) { setNotFound(true); return }
      const j = await res.json()
      setPost(j.post)
      setAttendees(j.attendees || [])
    })()
  }, [membership, params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async () => {
    setDeleting(true)
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`/api/portal/posts/${params.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    router.push('/portal/posts')
    router.refresh()
  }

  if (loading) return <PortalLoading />

  return (
    <PortalShell masjidName={membership?.masjidName}>
      <div className="mx-auto max-w-[720px]">
        <button
          onClick={() => router.push('/portal/posts')}
          className="mb-5 flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[12.5px] text-white/45 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All posts
        </button>

        {notFound ? (
          <p className="font-cormorant text-[15px] italic text-white/50">That post no longer exists.</p>
        ) : !post ? (
          <div className="font-cinzel text-[11px] tracking-[0.2em] text-white/25">LOADING…</div>
        ) : (
          <>
            <PostForm existing={post} />

            {/* Attendee roster — masjid-only. Nothing here is ever public. */}
            {post.rsvp_enabled && (
              <div className="mt-5 rounded-xl border border-white/10 bg-[#0a1a0a]">
                <div className="flex items-center gap-2 border-b border-white/8 px-5 py-4">
                  <Users className="h-4 w-4 text-gold/70" />
                  <h2 className="font-cinzel text-[13px] text-white">
                    Attending ({attendees.length})
                  </h2>
                </div>
                {attendees.length === 0 ? (
                  <p className="px-5 py-8 text-center font-cormorant text-[14px] italic text-white/35">
                    No RSVPs yet.
                  </p>
                ) : (
                  <div className="max-h-[300px] divide-y divide-white/5 overflow-y-auto">
                    {attendees.map((a, i) => (
                      <div key={i} className="flex items-center justify-between px-5 py-2.5">
                        <span className="truncate text-[13.5px] text-white/80">
                          {a.profiles?.full_name || a.profiles?.email || 'Guest'}
                        </span>
                        <span className="shrink-0 text-[11.5px] text-white/30">
                          {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5">
              <Button
                variant="ghost" size="sm"
                onClick={() => setConfirmDelete(true)}
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" /> Remove this post
              </Button>
            </div>

            <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Remove this post?</DialogTitle>
                  <DialogDescription>
                    It disappears from your community&apos;s feed straight away. RSVPs are kept in case
                    you need the headcount.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>Keep it</Button>
                  <Button variant="destructive" onClick={remove} disabled={deleting}>
                    {deleting ? 'Removing…' : 'Remove'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </PortalShell>
  )
}
