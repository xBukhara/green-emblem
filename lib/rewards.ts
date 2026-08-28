'use client'
// Client helpers for the rewards system.
// awardPoints() is fire-and-forget: it silently no-ops for signed-out
// users and never throws into calling UI. On a successful award it emits
// a `ge-points` window event that PointsToaster / PointsBadge listen to.

export type AwardResult = {
  awarded?: boolean
  already_earned?: boolean
  points?: number
  streak_bonus?: number
  balance?: number
  current_streak?: number
  error?: string
}

export const ACTION_META: Record<string, { label: string; points: number }> = {
  quran_read:     { label: 'Read Quran',                points: 10 },
  prayer_times:   { label: 'Check prayer times',        points: 5 },
  prayer_fajr:    { label: 'Pray Fajr',                 points: 5 },
  prayer_dhuhr:   { label: 'Pray Dhuhr',                points: 5 },
  prayer_asr:     { label: 'Pray Asr',                  points: 5 },
  prayer_maghrib: { label: 'Pray Maghrib',              points: 5 },
  prayer_isha:    { label: 'Pray Isha',                 points: 5 },
  community:      { label: 'Visit your community feed', points: 10 },
  donation:       { label: 'Give sadaqah',              points: 50 },
}

export async function awardPoints(supabase: any, action: string): Promise<AwardResult | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null
    const res = await fetch('/api/rewards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ action }),
    })
    if (!res.ok) return null
    const data: AwardResult = await res.json()
    if (data?.awarded) {
      window.dispatchEvent(new CustomEvent('ge-points', { detail: { action, ...data } }))
    }
    return data
  } catch {
    return null
  }
}

export async function fetchRewards(supabase: any) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const res = await fetch('/api/rewards', {
    headers: { 'Authorization': `Bearer ${session.access_token}` },
  })
  if (!res.ok) return null
  return res.json()
}
