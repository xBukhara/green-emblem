import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
import { sendOrderConfirmation, sendNewOrderToAdmin } from '@/lib/email'
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

    // ── SHOP ORDER ──────────────────────────────────────────────────────────
    if (meta.order_id && meta.order_type === 'shop') {
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
      const { data: order } = await admin.from('orders').select('*').eq('id', meta.order_id).maybeSingle()
      if (order) {
        await Promise.allSettled([
          sendOrderConfirmation({
            customerEmail:    session.customer_email || order.customer_email,
            customerName:     order.customer_name,
            orderNumber:      order.order_number,
            orderType:        order.order_type,
            items:            order.items,
            total:            order.total,
            shippingMethod:   order.shipping_method,
            estimatedDelivery: '5–10 business days',
          }),
          sendNewOrderToAdmin({
            orderNumber:   order.order_number,
            customerEmail: order.customer_email,
            orderType:     order.order_type,
            total:         order.total,
            items:         order.items,
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
