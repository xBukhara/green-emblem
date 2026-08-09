'use client'
import { useEffect, useState } from 'react'

type Post = { id: string; text: string | null; image_url: string | null; posted_at: string }

export default function GreenTVFeed({ compact = false }: { compact?: boolean }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const load = async (before?: string) => {
    const url = `/api/greentv-posts?limit=${compact ? 5 : 20}${before ? `&before=${encodeURIComponent(before)}` : ''}`
    const res = await fetch(url)
    const data = await res.json()
    const newPosts: Post[] = data.posts || []
    setPosts(prev => before ? [...prev, ...newPosts] : newPosts)
    setHasMore(newPosts.length >= (compact ? 5 : 20))
  }

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [])

  const loadMore = async () => {
    if (!posts.length) return
    setLoadingMore(true)
    await load(posts[posts.length - 1].posted_at)
    setLoadingMore(false)
  }

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffH = (now.getTime() - d.getTime()) / 36e5
    if (diffH < 1) return 'Just now'
    if (diffH < 24) return `${Math.floor(diffH)}h ago`
    if (diffH < 48) return 'Yesterday'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: '80px', borderRadius: '12px' }}/>
        ))}
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 24px', background: 'rgba(15,31,15,0.4)', borderRadius: '14px' }}>
        <p style={{ fontFamily: 'var(--font-cormorant, Georgia, serif)', fontSize: '15px', fontStyle: 'italic', color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>
          No updates yet — check back soon.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {posts.map(post => (
        <div key={post.id} style={{ background: 'rgba(15,31,15,0.5)', border: '0.5px solid rgba(90,158,90,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
          {post.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.image_url} alt="" style={{ width: '100%', maxHeight: compact ? '160px' : '320px', objectFit: 'cover', display: 'block' }}/>
          )}
          <div style={{ padding: '14px 16px' }}>
            {post.text && (
              <p style={{ fontFamily: 'Georgia, serif', fontSize: '14px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, marginBottom: '8px', whiteSpace: 'pre-wrap' }}>
                {post.text}
              </p>
            )}
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '10px', letterSpacing: '0.08em', color: '#5a9e5a' }}>{fmtDate(post.posted_at)}</div>
          </div>
        </div>
      ))}
      {hasMore && !compact && (
        <button onClick={loadMore} disabled={loadingMore} style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.03)', border: 'none', borderRadius: '8px', padding: '12px', cursor: loadingMore ? 'not-allowed' : 'pointer', marginTop: '4px' }}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}
