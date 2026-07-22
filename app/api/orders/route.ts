import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createShopCheckout } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const body = await request.json()
  const {
    items = [],
    customer_email,
    customer_name,
    shipping_method = 'ground',
  } = body

  if (!customer_email) return NextResponse.json({ error: 'Customer email is required' }, { status: 400 })
  if (!items.length)   return NextResponse.json({ error: 'No items in order' }, { status: 400 })

  const subtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.qty), 0)
  const shippingCost = 6.99
  const total = subtotal + shippingCost

  // Create order in DB (pending — Stripe webhook updates to processing)
  const admin = createAdminClient()
  const { data: order, error: orderError } = await admin.from('orders').insert({
    user_id: user?.id || null,
    customer_email,
    customer_name,
    order_type: 'shop',
    items,
    subtotal,
    shipping_cost: shippingCost,
    total,
    shipping_method,
    status: 'pending',
  }).select().single()

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 })

  // Create Stripe checkout session
  try {
    const session = await createShopCheckout({
      items,
      customerEmail: customer_email,
      orderId: order.id,
    })

    // Store session ID on order
    await admin.from('orders').update({ stripe_session_id: session.id }).eq('id', order.id)

    return NextResponse.json({ orderId: order.id, checkoutUrl: session.url })
  } catch (stripeErr: any) {
    // Clean up the pending order if Stripe fails
    await admin.from('orders').delete().eq('id', order.id)
    return NextResponse.json({ error: `Payment setup failed: ${stripeErr.message}` }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  let query = supabase.from('orders').select('*').order('created_at', { ascending: false })

  if (profile?.role !== 'admin') {
    query = query.eq('user_id', user.id)
  }

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orders: data })
}
