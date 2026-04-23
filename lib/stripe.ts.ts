// lib/stripe.ts
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
  typescript: true,
})

// ─── FAVOUR ORDER CHECKOUT ────────────────────────────────────────────────────
export async function createFavourCheckout({
  items,
  eventType,
  quantity,
  customMessage,
  shippingAddress,
  customerEmail,
  orderId,
  shippingCost,
}: {
  items: Array<{ name: string; price: number; qty: number }>
  eventType: string
  quantity: number
  customMessage?: string
  shippingAddress?: Record<string, string>
  customerEmail: string
  orderId: string
  shippingCost: number
}) {
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(item => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: item.name,
        description: `${quantity} bags · ${eventType} event`,
      },
      unit_amount: Math.round(item.price * 100),
    },
    quantity: item.qty,
  }))

  // Add shipping as a line item if applicable
  if (shippingCost > 0) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Shipping & Handling' },
        unit_amount: Math.round(shippingCost * 100),
      },
      quantity: 1,
    })
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    customer_email: customerEmail,
    metadata: {
      order_id: orderId,
      order_type: 'favours',
      event_type: eventType,
      quantity: quantity.toString(),
      custom_message: customMessage || '',
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/orders/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/favours?cancelled=true`,
    shipping_address_collection: {
      allowed_countries: ['US'],
    },
    custom_text: {
      submit: { message: 'Orders take a minimum of 2 weeks to arrive. Sample express shipping available separately.' }
    },
  })

  return session
}

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

// ─── AFFILIATE $19 CONNECTION FEE ────────────────────────────────────────────
export async function createAffiliateConnectionCheckout({
  clientEmail,
  affiliateName,
  affiliateCity,
  connectionId,
  eventType,
}: {
  clientEmail: string
  affiliateName: string
  affiliateCity: string
  connectionId: string
  eventType?: string
}) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Decorator Connection Fee',
            description: `Connect with ${affiliateName} in ${affiliateCity}${eventType ? ` · ${eventType}` : ''}. Non-refundable.`,
          },
          unit_amount: 1900, // $19.00
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    customer_email: clientEmail,
    metadata: {
      connection_id: connectionId,
      order_type: 'affiliate_connection',
    },
    payment_intent_data: {
      description: `Green Emblem — Decorator connection: ${affiliateName}`,
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/events/connected?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/events?cancelled=true`,
    custom_text: {
      submit: {
        message: 'This $19 connection fee is non-refundable. Your decorator will contact you within 1–2 business days.',
      },
    },
  })

  return session
}

// ─── SAMPLE ORDER CHECKOUT ────────────────────────────────────────────────────
export async function createSampleCheckout({
  customerEmail,
  items,
  orderId,
}: {
  customerEmail: string
  items: Array<{ name: string; price: number }>
  orderId: string
}) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      ...items.map(item => ({
        price_data: {
          currency: 'usd',
          product_data: { name: `Sample: ${item.name}` },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: 1,
      })),
      {
        price_data: {
          currency: 'usd',
          product_data: { name: 'Express Shipping (USPS Priority, 2–3 days)' },
          unit_amount: 1499,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    customer_email: customerEmail,
    metadata: { order_id: orderId, order_type: 'sample' },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/orders/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/favours?cancelled=true`,
    shipping_address_collection: { allowed_countries: ['US'] },
  })

  return session
}

// Premium QR checkout — $0.99
export async function createPremiumQRCheckout({
  customerEmail,
  campaignSlug,
  campaignId,
  designId,
}: {
  customerEmail: string
  campaignSlug: string
  campaignId: string
  designId: string
}) {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: customerEmail,
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Baab As-Sadaqah Premium QR',
          description: 'Printable QR card designs with Islamic artwork for your event',
        },
        unit_amount: 99, // $0.99
      },
      quantity: 1,
    }],
    metadata: {
      order_type:    'premium_qr',
      campaign_id:   campaignId,
      campaign_slug: campaignSlug,
      design_id:     designId,
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?premium_qr=success&campaign=${campaignSlug}`,
    cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  })
  return session
}

export async function createPremiumQRCheckout({
  customerEmail,
  campaignSlug,
  campaignId,
  designId,
}: {
  customerEmail: string
  campaignSlug: string
  campaignId: string
  designId: string
}) {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: customerEmail,
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Baab As-Sadaqah Premium QR',
          description: 'Printable QR card designs with Islamic artwork for your event',
        },
        unit_amount: 99,
      },
      quantity: 1,
    }],
    metadata: {
      order_type:    'premium_qr',
      campaign_id:   campaignId,
      campaign_slug: campaignSlug,
      design_id:     designId,
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?premium_qr=success&campaign=${campaignSlug}`,
    cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  })
  return session
}
