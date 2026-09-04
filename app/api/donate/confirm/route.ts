import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const { donation_id } = await request.json()
  if (!donation_id) return NextResponse.json({ error: 'Donation ID required' }, { status: 400 })

  const admin = createAdminClient()

  // Mark confirmed
  const { data: donation, error } = await admin
    .from('donations')
    .update({ confirmed: true })
    .eq('id', donation_id)
    .eq('confirmed', false) // idempotent
    .select()
    .single()

  if (error || !donation) return NextResponse.json({ error: 'Not found or already confirmed' }, { status: 404 })

  // Atomically update campaign totals
  await admin.rpc('increment_campaign_stats', {
    p_campaign_id: donation.campaign_id,
    p_amount:      donation.amount,
    p_meals:       donation.meals_funded || 0,
  })

  // Update user lifetime total if signed in
  if (donation.user_id) {
    await admin.rpc('increment_user_donated', {
      p_user_id: donation.user_id,
      p_amount:  donation.amount,
    })
  }

  return NextResponse.json({ success: true, donation })
}
