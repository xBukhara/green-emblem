import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendOnce } from '@/lib/push-server'
import { digestBody, localDateKey, usable, type PrayerSub } from '@/lib/prayer-push'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── Combined daily maintenance ───────────────────────────────────────────
// WHY THIS ROUTE EXISTS: Vercel's Hobby plan allows only TWO cron jobs, and
// both slots were already taken (expire-events, sync-masjid-events). Adding
// a third for the prayer digest would have been rejected at deploy time —
// exactly the failure that broke a deploy back in August. So expire-events
// and the prayer digest share one slot here. Both are quick DB operations.
//
// vercel.json points cron #1 at this route. /api/cron/expire-events is kept
// so nothing breaks if the old schedule is still registered.

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const report: Record<string, any> = { ranAt: new Date().toISOString() }

  // ── 1. Expire stale masjid events ──
  try {
    const { error } = await admin.rpc('expire_old_masjid_events')
    report.expireEvents = error ? { error: error.message } : 'ok'
  } catch (e: any) {
    report.expireEvents = { error: e?.message || 'failed' }
  }

  // ── 2. Prune the push delivery log ──
  try {
    await admin.rpc('prune_push_log')
    report.pruneLog = 'ok'
  } catch (e: any) {
    report.pruneLog = { error: e?.message || 'failed' }
  }

  // ── 3. Daily prayer-times digest ──
  try {
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, lat, lng, timezone, calc_method, madhab')
      .eq('notify_prayer_daily', true)

    const eligible = ((subs || []) as PrayerSub[]).filter(usable)
    const now = new Date()
    let sent = 0, skipped = 0

    // Grouped by (timezone, rounded location) so identical digests are sent
    // as one batch instead of recomputing per subscriber.
    const groups = new Map<string, PrayerSub[]>()
    for (const s of eligible) {
      const key = `${s.timezone}|${s.lat}|${s.lng}|${s.calc_method}|${s.madhab}`
      const arr = groups.get(key)
      if (arr) arr.push(s); else groups.set(key, [s])
    }

    for (const group of Array.from(groups.values())) {
      const sample = group[0]
      const dateKey = localDateKey(now, sample.timezone!)
      const body = digestBody(sample, now)
      const result = await sendOnce(
        group.map(s => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })),
        {
          title: "Today's prayer times",
          body,
          url: '/prayer',
          tag: 'ge-prayer-daily',
          renotify: false,
        },
        'prayer_daily',
        dateKey
      )
      sent += result.sent
      skipped += group.length - result.sent
    }

    report.prayerDigest = { eligible: eligible.length, groups: groups.size, sent, skipped }
  } catch (e: any) {
    report.prayerDigest = { error: e?.message || 'failed' }
  }

  return NextResponse.json({ success: true, ...report })
}
