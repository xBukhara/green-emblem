'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fetchRewards, ACTION_META } from '@/lib/rewards'

// ── Points toast — "+10 · Read Quran" ────────────────────────────────────
// Mounted once (in Nav, which every page renders). Listens for ge-points.
export function PointsToaster() {
  const [toast, setToast] = useState<{ points: number; bonus: number; label: string } | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const handler = (e: any) => {
      const { action, points, streak_bonus } = e.detail || {}
      if (!points) return
      setToast({ points, bonus: streak_bonus || 0, label: ACTION_META[action]?.label || 'Earned' })
      clearTimeout(timer)
      timer = setTimeout(() => setToast(null), 3200)
    }
    window.addEventListener('ge-points', handler)
    return () => { window.removeEventListener('ge-points', handler); clearTimeout(timer) }
  }, [])

  if (!toast) return null
  return (
    <div style={{
      position: 'fixed', bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))', left: '50%', transform: 'translateX(-50%)',
      zIndex: 200, background: 'rgba(8,15,8,0.96)', border: '0.5px solid rgba(212,175,110,0.4)',
      borderRadius: '100px', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px',
      boxShadow: '0 6px 24px rgba(0,0,0,0.45)', animation: 'geToastIn 0.25s ease-out',
    }}>
      <span style={{ color: '#d4af6e', fontSize: '14px' }}>✦</span>
      <span style={{ fontFamily: 'var(--font-inter, Georgia, serif)', fontSize: '13px', fontWeight: 600, color: '#f0d48a' }}>
        +{toast.points + toast.bonus}
      </span>
      <span style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
        {toast.label}{toast.bonus > 0 ? ` · streak +${toast.bonus}` : ''}
      </span>
      <style>{`@keyframes geToastIn { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
    </div>
  )
}

// ── Points badge for the nav — ✦ 240 ─────────────────────────────────────
export function PointsBadge({ compact = false }: { compact?: boolean }) {
  const supabase = createClient()
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true
    fetchRewards(supabase).then(d => { if (mounted && d) setBalance(d.points?.balance ?? 0) })
    const handler = (e: any) => { if (typeof e.detail?.balance === 'number') setBalance(e.detail.balance) }
    window.addEventListener('ge-points', handler)
    return () => { mounted = false; window.removeEventListener('ge-points', handler) }
  }, [])

  if (balance === null) return null
  return (
    <Link href="/rewards" title="Your rewards" style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none',
      background: 'rgba(212,175,110,0.1)', border: '0.5px solid rgba(212,175,110,0.3)',
      borderRadius: '100px', padding: compact ? '5px 12px' : '6px 14px',
    }}>
      <span style={{ color: '#d4af6e', fontSize: compact ? '11px' : '12px' }}>✦</span>
      <span style={{ fontFamily: 'var(--font-inter, Georgia, serif)', fontSize: compact ? '11px' : '12px', fontWeight: 600, color: '#f0d48a' }}>
        {balance.toLocaleString()}
      </span>
    </Link>
  )
}
