import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { syncMasjidEvents } from '@/lib/event-sync'

// GET /api/cron/sync-masjid-events — called on a schedule by Vercel Cron.
// For every masjid with auto_sync_enabled, fetches their website, asks
// Claude to extract event listings, and inserts new ones.
//
// New events land as status='pending' UNLESS the masjid is marked
// auto_sync_trusted — pending events aren't shown publicly and don't
// trigger follower notifications until an admin approves them in the
// admin panel. This protects against a bad extraction going out as a
// wrong notification email.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: masjids, error: masjidsError } = await admin
    .from('masjids')
    .select('id, name, website, auto_sync_trusted')
    .eq('active', true)
    .eq('auto_sync_enabled', true)
    .not('website', 'is', null)

  if (masjidsError) return NextResponse.json({ error: masjidsError.message }, { status: 500 })
  if (!masjids?.length) return NextResponse.json({ synced: 0, message: 'No masjids have auto-sync enabled' })

  const results: any[] = []

  for (const masjid of masjids) {
    const { events, error } = await syncMasjidEvents(masjid.website!, masjid.name)

    if (error) {
      await admin.from('masjids').update({
        last_synced_at: new Date().toISOString(),
        last_sync_status: 'error',
        last_sync_error: error,
        last_sync_event_count: 0,
      }).eq('id', masjid.id)
      results.push({ masjid: masjid.name, status: 'error', error })
      continue
    }

    if (!events.length) {
      await admin.from('masjids').update({
        last_synced_at: new Date().toISOString(),
        last_sync_status: 'no_events_found',
        last_sync_error: null,
        last_sync_event_count: 0,
      }).eq('id', masjid.id)
      results.push({ masjid: masjid.name, status: 'no_events_found' })
      continue
    }

    // Insert new events — the unique index on (masjid_id, title, event_start)
    // silently skips anything we've already ingested on a prior run.
    let insertedCount = 0
    for (const ev of events) {
      const { error: insertError } = await admin.from('masjid_events').insert({
        masjid_id: masjid.id,
        title: ev.title,
        description: ev.description,
        event_start: ev.event_start,
        event_end: ev.event_end,
        source: 'api',
        status: masjid.auto_sync_trusted ? 'active' : 'pending',
      })
      // 23505 = unique violation = we've already seen this exact event before. Expected, not an error.
      if (!insertError) insertedCount++
    }

    await admin.from('masjids').update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: 'success',
      last_sync_error: null,
      last_sync_event_count: insertedCount,
    }).eq('id', masjid.id)

    results.push({ masjid: masjid.name, status: 'success', newEvents: insertedCount, totalExtracted: events.length })
  }

  return NextResponse.json({ synced: masjids.length, results })
}
