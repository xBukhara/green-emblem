import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendMagicLink, sendCampaignRequestToAdmin } from '@/lib/email'
import { randomUUID } from 'crypto'

async function requireAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin' ? user : null
}

// POST /api/admin/magic-link — approve a campaign request and send builder link
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const user = await requireAdmin(supabase)
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { request_id } = await request.json()
  if (!request_id) return NextResponse.json({ error: 'request_id required' }, { status: 400 })

  const admin = createAdminClient()
  const token = randomUUID()

  const { data: req, error } = await admin
    .from('campaign_requests')
    .update({
      status:             'approved',
      magic_link_token:   token,
      magic_link_sent_at: new Date().toISOString(),
      approved_by:        user.id,
      approved_at:        new Date().toISOString(),
    })
    .eq('id', request_id)
    .select()
    .single()

  if (error || !req) return NextResponse.json({ error: error?.message || 'Not found' }, { status: 500 })

  // Send magic link email to organiser
  await sendMagicLink({
    firstName:     req.first_name,
    email:         req.email,
    magicToken:    token,
    honoreeNames:  req.honoree_names,
  })

  return NextResponse.json({ success: true })
}
