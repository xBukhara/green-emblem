// lib/email.ts
// All transactional emails sent via Resend
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'fizzah@greenemblem.com'
const FROM = process.env.EMAIL_FROM || 'Green Emblem <noreply@green-emblem.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://green-emblem.com'

// Shared header HTML for all emails
const emailHeader = (title: string) => `
  <div style="background:#0f1f0f;padding:20px 32px;border-radius:12px 12px 0 0">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-family:'Cinzel',serif;font-size:14px;letter-spacing:0.2em;color:#d4af6e">
        Green Emblem
      </span>
    </div>
    <h1 style="color:#fff;font-family:Georgia,serif;font-size:20px;font-weight:400;margin:12px 0 0">${title}</h1>
  </div>
`

const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:24px;background:#f5f0e6;font-family:Georgia,serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid rgba(46,107,46,0.15)">
    ${content}
    <div style="background:#0f1f0f;padding:16px 32px;text-align:center">
      <p style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:0.1em;margin:0">
        BARAKALLAHU FEEKUM · GREEN EMBLEM · GREEN-EMBLEM.COM
      </p>
    </div>
  </div>
</body>
</html>
`

// ─── 1. AFFILIATE APPLICATION → ADMIN ────────────────────────────────────────
export async function sendAffiliateApplicationToAdmin(data: {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  city: string
  state: string
  affiliateType: string
  eventTypes: string[]
  yearsExperience?: string
  bio: string
  instagramUrl?: string
}) {
  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New affiliate application — ${data.firstName} ${data.lastName} (${data.city}, ${data.state})`,
    html: emailWrapper(`
      ${emailHeader('New Affiliate Application')}
      <div style="padding:24px 32px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#666;width:140px">Name</td><td style="padding:6px 0;font-weight:bold">${data.firstName} ${data.lastName}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0"><a href="mailto:${data.email}" style="color:#2e6b2e">${data.email}</a></td></tr>
          <tr><td style="padding:6px 0;color:#666">Phone</td><td style="padding:6px 0">${data.phone || 'Not provided'}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Location</td><td style="padding:6px 0">${data.city}, ${data.state}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Type</td><td style="padding:6px 0">${data.affiliateType}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Event types</td><td style="padding:6px 0">${data.eventTypes.join(', ')}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Experience</td><td style="padding:6px 0">${data.yearsExperience || 'Not specified'}</td></tr>
          ${data.instagramUrl ? `<tr><td style="padding:6px 0;color:#666">Instagram</td><td style="padding:6px 0"><a href="${data.instagramUrl}" style="color:#2e6b2e">${data.instagramUrl}</a></td></tr>` : ''}
        </table>
        <div style="background:#f5f5f5;border-radius:8px;padding:14px;margin:16px 0">
          <p style="color:#666;font-size:12px;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.1em">Bio</p>
          <p style="margin:0;line-height:1.6;color:#333">${data.bio}</p>
        </div>
        <div style="margin-top:20px;display:flex;gap:12px">
          <a href="${APP_URL}/admin?panel=affiliates&id=${data.id}&action=approve"
             style="background:#2e6b2e;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;display:inline-block">
            Approve & send magic link
          </a>
          <a href="${APP_URL}/admin?panel=affiliates&id=${data.id}&action=decline"
             style="background:#f5f5f5;color:#333;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;display:inline-block;border:1px solid #ddd">
            Decline
          </a>
        </div>
      </div>
    `),
  })
}

// ─── 2. AFFILIATE APPLICATION CONFIRMED → APPLICANT ──────────────────────────
export async function sendApplicationReceived(data: {
  firstName: string
  email: string
}) {
  await resend.emails.send({
    from: FROM,
    to: data.email,
    subject: 'Your Green Emblem affiliate application has been received',
    html: emailWrapper(`
      ${emailHeader('Application received')}
      <div style="padding:24px 32px">
        <p style="font-size:16px;line-height:1.7;color:#333">Assalamu Alaikum ${data.firstName},</p>
        <p style="font-size:15px;line-height:1.7;color:#333">
          Thank you for applying to join the Green Emblem affiliate network. Your application has been received and will be reviewed personally within 48 hours, in sha Allah.
        </p>
        <p style="font-size:15px;line-height:1.7;color:#333">
          If approved, you'll receive a confirmation email with next steps. If you have any questions in the meantime, simply reply to this email.
        </p>
        <p style="font-size:14px;color:#888;font-style:italic;margin-top:20px">
          Barak Allahu feek — may Allah bless your work.
        </p>
      </div>
    `),
  })
}

// ─── 3. AFFILIATE APPROVED — WELCOME EMAIL ────────────────────────────────────
export async function sendAffiliateApproved(data: {
  firstName: string
  email: string
  affiliateId: string
}) {
  await resend.emails.send({
    from: FROM,
    to: data.email,
    subject: '🌙 You\'re in — Welcome to Green Emblem',
    html: emailWrapper(`
      ${emailHeader('Welcome to the network')}
      <div style="padding:24px 32px">
        <p style="font-size:16px;line-height:1.7;color:#333">Assalamu Alaikum ${data.firstName},</p>
        <p style="font-size:15px;line-height:1.7;color:#333">
          Alhamdulillah — your application has been approved! You are now a verified Green Emblem affiliate decorator.
        </p>
        <div style="background:#f0f8f0;border:1px solid rgba(46,107,46,0.2);border-radius:8px;padding:16px;margin:16px 0">
          <p style="font-size:13px;color:#2e6b2e;font-weight:bold;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.1em">What happens next</p>
          <ul style="margin:0;padding:0 0 0 18px;line-height:2;color:#333;font-size:14px">
            <li>Your profile is now live on our decorator directory</li>
            <li>When a client pays the $19 connection fee and selects you, we'll email you their details immediately</li>
            <li>You have 1–2 business days to reach out to the client</li>
            <li>You quote and charge your own decoration fees directly</li>
          </ul>
        </div>
        <a href="${APP_URL}/affiliates/dashboard"
           style="background:#2e6b2e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;display:inline-block;margin-top:12px">
          View your affiliate profile
        </a>
        <p style="font-size:14px;color:#888;font-style:italic;margin-top:24px">
          Barak Allahu feekum. We're excited to have you.
        </p>
      </div>
    `),
  })
}

// ─── 4. AFFILIATE CONNECTION — NOTIFY AFFILIATE ───────────────────────────────
export async function sendAffiliateConnected(data: {
  affiliateEmail: string
  affiliateFirstName: string
  clientName: string
  clientEmail: string
  clientPhone?: string
  eventType?: string
  eventDate?: string
  guestCount?: number
  notes?: string
}) {
  await resend.emails.send({
    from: FROM,
    to: data.affiliateEmail,
    subject: `New client connection — ${data.clientName} · ${data.eventType || 'Event'}`,
    html: emailWrapper(`
      ${emailHeader('You have a new client')}
      <div style="padding:24px 32px">
        <p style="font-size:16px;line-height:1.7;color:#333">Assalamu Alaikum ${data.affiliateFirstName},</p>
        <p style="font-size:15px;line-height:1.7;color:#333">
          A client has connected with you through Green Emblem. <strong>Please reach out within 1–2 business days.</strong>
        </p>
        <div style="background:#f5f0e6;border:1px solid rgba(212,175,110,0.3);border-radius:8px;padding:16px;margin:16px 0">
          <p style="font-size:12px;color:#7a5c1e;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.1em">Client details</p>
          <table style="width:100%;font-size:14px;border-collapse:collapse">
            <tr><td style="padding:4px 0;color:#666;width:120px">Name</td><td style="padding:4px 0;font-weight:bold;color:#333">${data.clientName}</td></tr>
            <tr><td style="padding:4px 0;color:#666">Email</td><td style="padding:4px 0"><a href="mailto:${data.clientEmail}" style="color:#2e6b2e">${data.clientEmail}</a></td></tr>
            ${data.clientPhone ? `<tr><td style="padding:4px 0;color:#666">Phone</td><td style="padding:4px 0"><a href="tel:${data.clientPhone}" style="color:#2e6b2e">${data.clientPhone}</a></td></tr>` : ''}
            ${data.eventType ? `<tr><td style="padding:4px 0;color:#666">Event</td><td style="padding:4px 0">${data.eventType}</td></tr>` : ''}
            ${data.eventDate ? `<tr><td style="padding:4px 0;color:#666">Date</td><td style="padding:4px 0">${data.eventDate}</td></tr>` : ''}
            ${data.guestCount ? `<tr><td style="padding:4px 0;color:#666">Guests</td><td style="padding:4px 0">~${data.guestCount}</td></tr>` : ''}
          </table>
          ${data.notes ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(212,175,110,0.2)"><p style="font-size:12px;color:#666;margin:0 0 4px">Client notes:</p><p style="margin:0;color:#333;font-style:italic;line-height:1.6">${data.notes}</p></div>` : ''}
        </div>
        <p style="font-size:13px;color:#888;line-height:1.6">
          Remember: you set your own decoration prices. Green Emblem takes no cut of your service fee.
          All party favour orders go through Green Emblem directly — you can recommend our catalogue to the client.
        </p>
      </div>
    `),
  })
}

// ─── 5. CLIENT — CONNECTION CONFIRMED ────────────────────────────────────────
export async function sendClientConnectionConfirmed(data: {
  clientEmail: string
  clientName: string
  affiliateName: string
  affiliateCity: string
  eventType?: string
}) {
  await resend.emails.send({
    from: FROM,
    to: data.clientEmail,
    subject: `You're connected with ${data.affiliateName} — Green Emblem`,
    html: emailWrapper(`
      ${emailHeader('You\'re connected!')}
      <div style="padding:24px 32px">
        <p style="font-size:15px;line-height:1.7;color:#333">
          Your connection with <strong>${data.affiliateName}</strong> in ${data.affiliateCity} is confirmed.
        </p>
        <p style="font-size:15px;line-height:1.7;color:#333">
          They will reach out to you within <strong>1–2 business days</strong> to schedule a meeting and walk you through exactly what they can provide for your ${data.eventType || 'event'}.
        </p>
        <div style="background:#f5f0e6;border-radius:8px;padding:14px;margin:16px 0">
          <p style="font-size:13px;color:#7a5c1e;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.1em">Important reminders</p>
          <ul style="margin:0;padding:0 0 0 18px;line-height:1.9;color:#555;font-size:13px">
            <li>The $19 connection fee you paid is non-refundable</li>
            <li>Decoration prices are set by your decorator — not by Green Emblem</li>
            <li>For party favours, order through <a href="${APP_URL}/favours" style="color:#2e6b2e">green-emblem.com/favours</a></li>
          </ul>
        </div>
        <a href="${APP_URL}/favours"
           style="background:#d4af6e;color:#0f1f0f;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;display:inline-block;margin-top:8px">
          Browse our party favours
        </a>
      </div>
    `),
  })
}

// ─── 6. ORDER CONFIRMATION → CUSTOMER ─────────────────────────────────────────
export async function sendOrderConfirmation(data: {
  customerEmail: string
  customerName?: string
  orderNumber: string
  orderType: string
  items: Array<{ name: string; qty: number; price: number }>
  total: number
  shippingMethod?: string
  estimatedDelivery?: string
}) {
  const itemRows = data.items.map(item =>
    `<tr>
      <td style="padding:8px 0;color:#333;border-bottom:1px solid #eee">${item.name}</td>
      <td style="padding:8px 0;color:#666;text-align:center;border-bottom:1px solid #eee">×${item.qty}</td>
      <td style="padding:8px 0;color:#333;text-align:right;border-bottom:1px solid #eee">$${(item.price * item.qty).toFixed(2)}</td>
    </tr>`
  ).join('')

  await resend.emails.send({
    from: FROM,
    to: data.customerEmail,
    subject: `Order confirmed — ${data.orderNumber} · Green Emblem`,
    html: emailWrapper(`
      ${emailHeader(`Order ${data.orderNumber} confirmed`)}
      <div style="padding:24px 32px">
        <p style="font-size:15px;line-height:1.7;color:#333">
          ${data.customerName ? `Assalamu Alaikum ${data.customerName},` : 'Assalamu Alaikum,'}
        </p>
        <p style="font-size:15px;line-height:1.7;color:#333">Your order has been confirmed and is being prepared with care.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          <thead>
            <tr style="background:#f5f0e6">
              <th style="padding:10px;text-align:left;color:#7a5c1e;font-size:11px;letter-spacing:0.1em;text-transform:uppercase">Item</th>
              <th style="padding:10px;text-align:center;color:#7a5c1e;font-size:11px;letter-spacing:0.1em;text-transform:uppercase">Qty</th>
              <th style="padding:10px;text-align:right;color:#7a5c1e;font-size:11px;letter-spacing:0.1em;text-transform:uppercase">Price</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding:10px 0;font-weight:bold;color:#333">Total</td>
              <td style="padding:10px 0;font-weight:bold;color:#333;text-align:right">$${data.total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        ${data.shippingMethod ? `
          <div style="background:#f5f5f5;border-radius:8px;padding:12px;margin:12px 0;font-size:13px;color:#555">
            <strong>Shipping:</strong> ${data.shippingMethod}
            ${data.estimatedDelivery ? ` · Estimated delivery: ${data.estimatedDelivery}` : ''}
            ${data.orderType === 'favours' ? '<br/><em>Favour orders take a minimum of 2 weeks to prepare and ship.</em>' : ''}
          </div>
        ` : ''}
        <a href="${APP_URL}/dashboard"
           style="background:#2e6b2e;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;display:inline-block;margin-top:12px">
          Track your order
        </a>
        <p style="font-size:13px;color:#888;font-style:italic;margin-top:20px">
          Barak Allahu feekum. May Allah bless your celebration.
        </p>
      </div>
    `),
  })
}

// ─── 7. NEW ORDER NOTIFICATION → ADMIN ───────────────────────────────────────
export async function sendNewOrderToAdmin(data: {
  orderNumber: string
  customerEmail: string
  orderType: string
  total: number
  items: Array<{ name: string; qty: number }>
  eventType?: string
  quantity?: number
}) {
  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New order ${data.orderNumber} — $${data.total.toFixed(2)} · ${data.orderType}`,
    html: emailWrapper(`
      ${emailHeader(`New order: ${data.orderNumber}`)}
      <div style="padding:24px 32px">
        <table style="width:100%;font-size:14px;border-collapse:collapse">
          <tr><td style="padding:5px 0;color:#666;width:140px">Order</td><td style="padding:5px 0;font-weight:bold">${data.orderNumber}</td></tr>
          <tr><td style="padding:5px 0;color:#666">Type</td><td style="padding:5px 0">${data.orderType}</td></tr>
          <tr><td style="padding:5px 0;color:#666">Customer</td><td style="padding:5px 0"><a href="mailto:${data.customerEmail}" style="color:#2e6b2e">${data.customerEmail}</a></td></tr>
          <tr><td style="padding:5px 0;color:#666">Total</td><td style="padding:5px 0;font-weight:bold;color:#2e6b2e">$${data.total.toFixed(2)}</td></tr>
          ${data.eventType ? `<tr><td style="padding:5px 0;color:#666">Event</td><td style="padding:5px 0">${data.eventType}</td></tr>` : ''}
          ${data.quantity ? `<tr><td style="padding:5px 0;color:#666">Bags</td><td style="padding:5px 0">${data.quantity}</td></tr>` : ''}
        </table>
        <a href="${APP_URL}/admin?panel=orders"
           style="background:#2e6b2e;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;display:inline-block;margin-top:16px">
          View in admin console
        </a>
      </div>
    `),
  })
}

// ─── 8. CAMPAIGN REQUEST → ADMIN ─────────────────────────────────────────────
export async function sendCampaignRequestToAdmin(data: {
  id: string
  firstName: string
  lastName: string
  email: string
  eventType: string
  honoreeNames: string
  eventDate?: string
  guestCount?: number
  qrTier: string
  message?: string
}) {
  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `Baab As-Sadaqah request — ${data.honoreeNames} · ${data.qrTier === 'premium' ? 'PREMIUM QR' : 'Free QR'}`,
    html: emailWrapper(`
      ${emailHeader('New Campaign Request')}
      <div style="padding:24px 32px">
        <table style="width:100%;font-size:14px;border-collapse:collapse">
          <tr><td style="padding:5px 0;color:#666;width:140px">Name</td><td style="padding:5px 0;font-weight:bold">${data.firstName} ${data.lastName}</td></tr>
          <tr><td style="padding:5px 0;color:#666">Email</td><td style="padding:5px 0"><a href="mailto:${data.email}" style="color:#2e6b2e">${data.email}</a></td></tr>
          <tr><td style="padding:5px 0;color:#666">Event</td><td style="padding:5px 0">${data.eventType}</td></tr>
          <tr><td style="padding:5px 0;color:#666">Honourees</td><td style="padding:5px 0">${data.honoreeNames}</td></tr>
          ${data.eventDate ? `<tr><td style="padding:5px 0;color:#666">Date</td><td style="padding:5px 0">${data.eventDate}</td></tr>` : ''}
          ${data.guestCount ? `<tr><td style="padding:5px 0;color:#666">Guests</td><td style="padding:5px 0">~${data.guestCount}</td></tr>` : ''}
          <tr><td style="padding:5px 0;color:#666">QR tier</td><td style="padding:5px 0"><strong style="color:${data.qrTier === 'premium' ? '#d4af6e' : '#2e6b2e'}">${data.qrTier.toUpperCase()}</strong></td></tr>
        </table>
        ${data.message ? `<div style="background:#f5f5f5;border-radius:8px;padding:14px;margin:16px 0"><p style="font-size:12px;color:#666;margin:0 0 6px">Message:</p><p style="margin:0;line-height:1.6;color:#333;font-style:italic">${data.message}</p></div>` : ''}
        <a href="${APP_URL}/admin?panel=sadaqah&id=${data.id}&action=approve"
           style="background:#2e6b2e;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;display:inline-block;margin-top:16px">
          Approve &amp; send magic link
        </a>
      </div>
    `),
  })
}

// ─── 9. MAGIC LINK → CAMPAIGN ORGANISER ──────────────────────────────────────
export async function sendMagicLink(data: {
  firstName: string
  email: string
  magicToken: string
  honoreeNames: string
}) {
  const magicUrl = `${APP_URL}/campaigns/build?token=${data.magicToken}`

  await resend.emails.send({
    from: FROM,
    to: data.email,
    subject: `Your Green Emblem campaign is approved — build it now`,
    html: emailWrapper(`
      ${emailHeader('Your campaign is approved')}
      <div style="padding:24px 32px">
        <p style="font-size:16px;line-height:1.7;color:#333">Assalamu Alaikum ${data.firstName},</p>
        <p style="font-size:15px;line-height:1.7;color:#333">
          Barak Allahu feekum! Your Baab As-Sadaqah campaign for <strong>${data.honoreeNames}</strong> has been approved.
        </p>
        <p style="font-size:15px;line-height:1.7;color:#333">
          Click the button below to design your campaign page, choose your Islamic theme, and generate your QR code. This link is unique to your campaign.
        </p>
        <div style="text-align:center;margin:28px 0">
          <a href="${magicUrl}"
             style="background:#d4af6e;color:#0f1f0f;padding:16px 32px;border-radius:10px;text-decoration:none;font-size:16px;display:inline-block;font-weight:bold;letter-spacing:0.04em">
            Build my campaign →
          </a>
        </div>
        <p style="font-size:12px;color:#999;text-align:center;line-height:1.6">
          This link is private and unique to you. Do not share it.<br/>
          It expires in 7 days. If you need a new link, contact us.
        </p>
      </div>
    `),
  })
}
