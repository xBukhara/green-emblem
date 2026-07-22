// lib/stripe.ts
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
  typescript: true,
})

// ─── SHOP ORDER CHECKOUT ──────────────────────────────────────────────────────
export async function createShopCheckout({
  items,
  customerEmail,
  orderId,
}: {
  items: Array<{ name: string; price: number; qty: number; image?: string }>
  customerEmail: string
  orderId: string
}) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          ...(item.image && { images: [item.image] }),
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.qty,
    })),
    mode: 'payment',
    customer_email: customerEmail,
    metadata: { order_id: orderId, order_type: 'shop' },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/orders/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/shop?cancelled=true`,
    shipping_address_collection: { allowed_countries: ['US'] },
    shipping_options: [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: 699, currency: 'usd' },
          display_name: 'Standard shipping (5–10 business days)',
        },
      },
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: 1499, currency: 'usd' },
          display_name: 'Express shipping (2–3 business days)',
        },
      },
    ],
  })

  return session
}

