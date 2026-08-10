import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendNewEventNotification } from '@/lib/email'

// GET /api/masjid-events — public, list active (non-expired) events.
// Optional ?masjid_id= to filter to one masjid.
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const masjidId = searchParams.get('masjid_id')

  let query = supabase
    .from('masjid_events')
    .select('*, masjids(name, city, state)')
    .eq('status', 'active')
    .order('event_start', { ascending: true })

  if (masjidId) query = query.eq('masjid_id', masjidId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ events: data })
}

// POST /api/masjid-events — admin only, add an event + notify followers of that masjid
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: adminProfile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (adminProfile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { masjid_id, title, description, image_url, event_start, event_end } = body

  if (!masjid_id || !title || !event_start || !event_end) {
    return NextResponse.json({ error: 'masjid_id, title, event_start, and event_end are required' }, { status: 400 })
  }

  const { data: event, error } = await admin.from('masjid_events').insert({
    masjid_id, title, description: description || null, image_url: image_url || null,
    event_start, event_end, source: 'admin', status: 'active', created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify followers of this masjid — best-effort, doesn't block the response
  const { data: masjid } = await admin.from('masjids').select('name').eq('id', masjid_id).maybeSingle()
  const { data: followers } = await admin.from('profiles').select('email, first_name').eq('followed_masjid_id', masjid_id)

  if (masjid && followers?.length) {
    Promise.allSettled(
      followers.map(f => sendNewEventNotification({
        email: f.email,
        firstName: f.first_name,
        masjidName: masjid.name,
        eventTitle: title,
        eventDescription: description,
        eventStart: event_start,
        eventEnd: event_end,
      }))
    ).catch(() => {})
  }

  return NextResponse.json({ event }, { status: 201 })
}
