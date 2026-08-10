import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/cron/expire-events — called on a schedule by Vercel Cron (see
// vercel.json). Marks events as 'expired' once 24 hours have passed since
// their event_end. Protected by CRON_SECRET so it can't be triggered by
// anyone who finds the URL.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { error } = await admin.rpc('expire_old_masjid_events')

  if (error) {
    console.error('expire_old_masjid_events failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, ranAt: new Date().toISOString() })
}
