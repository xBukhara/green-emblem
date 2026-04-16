import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { buildCharityUrl, calculateImpact, type CharityId } from '@/lib/donations'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const body = await request.json()
  const { campaign_id, amount, charity_id = 'share_the_meal' } = body

  if (!campaign_id)     return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 })
  if (!amount || amount < 1) return NextResponse.json({ error: 'Minimum donation is $1' }, { status: 400 })

  // Verify campaign is active
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, status, slug')
    .eq('id', campaign_id)
    .single()

  if (!campaign || campaign.status !== 'active') {
    return NextResponse.json({ error: 'Campaign not found or inactive' }, { status: 404 })
  }

  const impact = calculateImpact(amount)
  const redirectUrl = buildCharityUrl(charity_id as CharityId, amount)

  // Log donation INTENT before redirecting
  const admin = createAdminClient()
  const { data: donation, error } = await admin.from('donations').insert({
    campaign_id,
    user_id:     user?.id || null,
    donor_email: user?.email || null,
    amount,
    charity:     charity_id,
    redirect_url: redirectUrl,
    meals_funded: charity_id === 'share_the_meal' ? impact.meals : null,
    confirmed:   false, // Marked true when they return to /donate/confirmed
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    donationId:  donation.id,
    redirectUrl,
    impact,
  })
}
