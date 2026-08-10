import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { syncMasjidEvents } from '@/lib/event-sync'

// POST /api/admin/sync-masjid/[id] — admin-triggered manual sync for one
// masjid (the "Sync now" button), separate from the scheduled cron job.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: masjid } = await admin.from('masjids').select('id, name, website, auto_sync_trusted').eq('id', params.id).maybeSingle()
  if (!masjid) return NextResponse.json({ error: 'Masjid not found' }, { status: 404 })
  if (!masjid.website) return NextResponse.json({ error: 'This masjid has no website URL set' }, { status: 400 })

  const { events, error } = await syncMasjidEvents(masjid.website, masjid.name)

  if (error) {
    await admin.from('masjids').update({
      last_synced_at: new Date().toISOString(), last_sync_status: 'error', last_sync_error: error, last_sync_event_count: 0,
    }).eq('id', masjid.id)
    return NextResponse.json({ error }, { status: 200 }) // 200 — this is an expected outcome, not a server failure
  }

  let insertedCount = 0
  for (const ev of events) {
    const { error: insertError } = await admin.from('masjid_events').insert({
      masjid_id: masjid.id, title: ev.title, description: ev.description,
      event_start: ev.event_start, event_end: ev.event_end,
      source: 'api', status: masjid.auto_sync_trusted ? 'active' : 'pending',
    })
    if (!insertError) insertedCount++
  }

  await admin.from('masjids').update({
    last_synced_at: new Date().toISOString(),
    last_sync_status: events.length ? 'success' : 'no_events_found',
    last_sync_error: null,
    last_sync_event_count: insertedCount,
  }).eq('id', masjid.id)

  return NextResponse.json({ newEvents: insertedCount, totalExtracted: events.length })
}
