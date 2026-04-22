import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendMagicLink } from '@/lib/email'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const { request_id } = await request.json()
  if (!request_id) return NextResponse.json({ error: 'request_id required' }, { status: 400 })

  const admin = createAdminClient()
  const token = randomUUID()

  const { data: req, error } = await admin
    .from('campaign_requests')
    .update({
      status: 'approved',
      magic_link_token: token,
      magic_link_sent_at: new Date().toISOString(),
    })
    .eq('id', request_id)
    .select()
    .single()

  if (error || !req) return NextResponse.json({ error: error?.message || 'Not found' }, { status: 500 })

  await sendMagicLink({
    firstName: req.first_name,
    email: req.email,
    magicToken: token,
    honoreeNames: req.honoree_names,
  })

  return NextResponse.json({ success: true })
}
