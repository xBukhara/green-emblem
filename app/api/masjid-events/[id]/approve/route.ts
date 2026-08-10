import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendNewEventNotification } from '@/lib/email'

// POST /api/masjid-events/[id]/approve — admin approves a pending
// (AI-extracted) event: publishes it and notifies followers, same as a
// manually-posted event would.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: event, error } = await admin.from('masjid_events').update({ status: 'active' }).eq('id', params.id).select('*, masjids(name)').single()
  if (error || !event) return NextResponse.json({ error: error?.message || 'Event not found' }, { status: 404 })

  const { data: followers } = await admin.from('profiles').select('email, first_name').eq('followed_masjid_id', event.masjid_id)
  const masjidName = (event.masjids as any)?.name || 'your masjid'

  if (followers?.length) {
    Promise.allSettled(
      followers.map(f => sendNewEventNotification({
        email: f.email, firstName: f.first_name, masjidName,
        eventTitle: event.title, eventDescription: event.description,
        eventStart: event.event_start, eventEnd: event.event_end,
      }))
    ).catch(() => {})
  }

  return NextResponse.json({ event })
}
