import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendMagicLink, sendCampaignRequestToAdmin } from '@/lib/email'
import { randomUUID } from 'crypto'

// POST /api/campaigns/request
// Creates a campaign request, auto-approves it, and returns the builder
// link immediately — no admin review gate. The link is also emailed.
export async function POST(request: NextRequest) {
  const body = await request.json()
  const {
    first_name, last_name, email, phone,
    event_type, honoree_names, event_date,
    guest_count, location, qr_tier, message,
  } = body

  if (!first_name || !last_name || !email || !event_type || !honoree_names) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()
  const token = randomUUID()

  const { data: req, error } = await admin.from('campaign_requests').insert({
    first_name,
    last_name,
    email,
    phone: phone || null,
    event_type,
    honoree_names,
    event_date: event_date || null,
    guest_count: guest_count ? parseInt(String(guest_count)) : null,
    location: location || null,
    qr_tier: qr_tier || 'free',
    message: message || null,
    status: 'approved',                       // auto-approved — no review step
    magic_link_token: token,
    magic_link_sent_at: new Date().toISOString(),
  }).select().single()

  if (error || !req) {
    return NextResponse.json({ error: error?.message || 'Could not create request' }, { status: 500 })
  }

  // Email the builder link (non-blocking for the response if it fails)
  try {
    await sendMagicLink({
      firstName: first_name,
      email,
      magicToken: token,
      honoreeNames: honoree_names,
    })
  } catch (e) {
    console.error('Magic link email failed:', e)
  }

  // Notify admin (informational only — no action required anymore)
  try {
    await sendCampaignRequestToAdmin({
      id: req.id,
      firstName: first_name,
      lastName: last_name,
      email,
      eventType: event_type,
      honoreeNames: honoree_names,
      eventDate: event_date || undefined,
      guestCount: guest_count ? parseInt(String(guest_count)) : undefined,
      qrTier: qr_tier || 'free',
      message: message || undefined,
    })
  } catch {}

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://green-emblem.com'
  return NextResponse.json({
    success: true,
    builder_url: `${appUrl}/campaigns/build?token=${token}`,
  }, { status: 201 })
}
