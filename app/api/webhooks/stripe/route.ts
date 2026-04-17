import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
import {
  sendOrderConfirmation,
  sendNewOrderToAdmin,
  sendClientConnectionConfirmed,
  sendAffiliateConnected,
} from '@/lib/email'
import type Stripe from 'stripe'


export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig  = request.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Webhook signature error:', err.message)
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  const admin = createAdminClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const meta = session.metadata || {}

    // ── FAVOUR / SHOP / SAMPLE ORDER ──────────────────────────────────────────
    if (meta.order_id && ['favours', 'shop', 'sample'].includes(meta.order_type)) {
      const shippingAddr = session.shipping_details?.address

      // Update order to processing
      await admin.from('orders').update({
        status: 'processing',
        stripe_payment_id: session.payment_intent as string,
        stripe_session_id: session.id,
        shipping_address: shippingAddr ? {
          name:  session.shipping_details?.name,
          line1: shippingAddr.line1,
          line2: shippingAddr.line2,
          city:  shippingAddr.city,
          state: shippingAddr.state,
          zip:   shippingAddr.postal_code,
        } : null,
        updated_at: new Date().toISOString(),
      }).eq('id', meta.order_id)

      // Fetch order for emails
      const { data: order } = await admin.from('orders').select('*').eq('id', meta.order_id).single()
      if (order) {
        const deliveryNote = order.order_type === 'favours'
          ? '2–3 weeks (production + shipping)'
          : order.order_type === 'sample'
          ? '2–3 business days (USPS Priority)'
          : '5–10 business days'

        await Promise.allSettled([
          sendOrderConfirmation({
            customerEmail:    session.customer_email || order.customer_email,
            customerName:     order.customer_name,
            orderNumber:      order.order_number,
            orderType:        order.order_type,
            items:            order.items,
            total:            order.total,
            shippingMethod:   order.shipping_method,
            estimatedDelivery: deliveryNote,
          }),
          sendNewOrderToAdmin({
            orderNumber:   order.order_number,
            customerEmail: order.customer_email,
            orderType:     order.order_type,
            total:         order.total,
            items:         order.items,
            eventType:     order.event_type,
            quantity:      order.bundle_quantity,
          }),
        ])
      }
    }

    // ── AFFILIATE $19 CONNECTION ───────────────────────────────────────────────
    if (meta.connection_id && meta.order_type === 'affiliate_connection') {
      // Update connection to 'connected'
      await admin.from('affiliate_connections').update({
        status:           'connected',
        stripe_payment_id: session.payment_intent as string,
        stripe_session_id: session.id,
        connected_at:      new Date().toISOString(),
      }).eq('id', meta.connection_id)

      // Fetch connection + affiliate + their profile
      const { data: conn } = await admin
        .from('affiliate_connections')
        .select(`
          *,
          affiliates (
            display_name, city, state, user_id
          )
        `)
        .eq('id', meta.connection_id)
        .single()

      if (conn?.affiliates) {
        const { data: affiliateProfile } = await admin
          .from('profiles')
          .select('email, full_name')
          .eq('id', conn.affiliates.user_id)
          .single()

        await Promise.allSettled([
          // Notify affiliate of new client
          affiliateProfile && sendAffiliateConnected({
            affiliateEmail:     affiliateProfile.email,
            affiliateFirstName: affiliateProfile.full_name?.split(' ')[0] || 'there',
            clientName:         session.customer_details?.name || 'A client',
            clientEmail:        conn.client_email,
            eventType:          conn.event_type,
            eventDate:          conn.event_date,
            guestCount:         conn.guest_count,
            notes:              conn.notes,
          }),
          // Confirm to client
          sendClientConnectionConfirmed({
            clientEmail:    conn.client_email,
            clientName:     session.customer_details?.name || 'there',
            affiliateName:  conn.affiliates.display_name,
            affiliateCity:  `${conn.affiliates.city}, ${conn.affiliates.state}`,
            eventType:      conn.event_type,
          }),
        ])
      }
    }
  }

  // Handle failed payments — revert order to cancelled
  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session
    const meta = session.metadata || {}
    if (meta.order_id) {
      await admin.from('orders').update({ status: 'cancelled' }).eq('id', meta.order_id)
    }
  }

  return NextResponse.json({ received: true })
}
