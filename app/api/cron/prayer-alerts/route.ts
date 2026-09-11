import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendOnce } from '@/lib/push-server'
import { localDateKey, prayerDueNow, timeIn, usable, type PrayerSub } from '@/lib/prayer-push'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── Per-prayer alerts ────────────────────────────────────────────────────
// "Maghrib is at 7:14 PM" delivered at the moment the prayer comes in.
//
// ⚠ THIS ROUTE IS NOT IN vercel.json ON PURPOSE.
// It needs to run every few minutes, and Vercel's Hobby plan caps cron jobs
// at ONCE PER DAY (and two jobs total). Registering it on Hobby makes the
// deployment fail outright.
//
// To turn it on after upgrading to Vercel Pro, add to vercel.json:
//     { "path": "/api/cron/prayer-alerts", "schedule": "*/5 * * * *" }
//
// The window below must be >= the cron interval, or prayers that fall
// between runs are missed. */5 with WINDOW_MINUTES = 5 lines up exactly.
const WINDOW_MINUTES = 5

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, lat, lng, timezone, calc_method, madhab')
    .eq('notify_prayer_each', true)

  const eligible = ((subs || []) as PrayerSub[]).filter(usable)

  // Bucket everyone whose next prayer lands in this window, by prayer name,
  // so each distinct notification goes out as one batch.
  const buckets = new Map<string, { label: string; time: Date; tz: string; subs: PrayerSub[] }>()
  for (const s of eligible) {
    const due = prayerDueNow(s, now, WINDOW_MINUTES)
    if (!due) continue
    const key = `${due.key}|${s.timezone}|${timeIn(due.time, s.timezone!)}`
    const bucket = buckets.get(key)
    if (bucket) bucket.subs.push(s)
    else buckets.set(key, { label: due.label, time: due.time, tz: s.timezone!, subs: [s] })
  }

  let sent = 0
  for (const [key, bucket] of Array.from(buckets.entries())) {
    const prayerKey = key.split('|')[0]
    const dedupe = `${localDateKey(now, bucket.tz)}:${prayerKey}`
    const result = await sendOnce(
      bucket.subs.map(s => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })),
      {
        title: `${bucket.label} — ${timeIn(bucket.time, bucket.tz)}`,
        body: `It's time for ${bucket.label}.`,
        url: '/prayer',
        tag: `ge-prayer-${prayerKey}`,
        renotify: true,
      },
      `prayer_${prayerKey}`,
      dedupe
    )
    sent += result.sent
  }

  return NextResponse.json({
    success: true,
    ranAt: now.toISOString(),
    eligible: eligible.length,
    buckets: buckets.size,
    sent,
  })
}
