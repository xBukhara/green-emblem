import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createAffiliateConnectionCheckout } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'You must be signed in to connect with a decorator.' }, { status: 401 })
  }

  const { affiliate_id, event_type, event_date, guest_count, notes } = await request.json()
  if (!affiliate_id) return NextResponse.json({ error: 'affiliate_id required' }, { status: 400 })

  // Get affiliate details
  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('display_name, city, state')
    .eq('id', affiliate_id)
    .single()

  if (!affiliate) return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 })

  // Create connection record (status: 'paid' will update to 'connected' via webhook)
  const admin = createAdminClient()
  const { data: connection, error } = await admin.from('affiliate_connections').insert({
    client_user_id: user.id,
    client_email:   user.email!,
    affiliate_id,
    event_type,
    event_date:     event_date || null,
    guest_count:    guest_count || null,
    notes:          notes || null,
    amount_paid:    19.00,
    status:         'paid',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Create $19 Stripe session
  try {
    const session = await createAffiliateConnectionCheckout({
      clientEmail:    user.email!,
      affiliateName:  affiliate.display_name,
      affiliateCity:  `${affiliate.city}, ${affiliate.state}`,
      connectionId:   connection.id,
      eventType:      event_type,
    })
    return NextResponse.json({ checkoutUrl: session.url })
  } catch (err: any) {
    await admin.from('affiliate_connections').delete().eq('id', connection.id)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
