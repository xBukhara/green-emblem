import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/campaigns/validate-token?token=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) return NextResponse.json({ valid: false })

  const admin = createAdminClient()
  const { data: req } = await admin
    .from('campaign_requests')
    .select('*')
    .eq('magic_link_token', token)
    .eq('status', 'approved')
    .single()

  if (!req) return NextResponse.json({ valid: false })

  // Check 7-day expiry
  const sentAt = new Date(req.magic_link_sent_at)
  const daysSince = (Date.now() - sentAt.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSince > 7) return NextResponse.json({ valid: false, reason: 'expired' })

  return NextResponse.json({
    valid: true,
    request: {
      honoree_names: req.honoree_names,
      event_type:    req.event_type,
      event_date:    req.event_date,
      qr_tier:       req.qr_tier,
    },
  })
}
