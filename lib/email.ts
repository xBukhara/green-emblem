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

export async function sendCampaignActivated(data: {
  firstName: string
  email: string
  honoreeNames: string
  eventType: string
  campaignSlug: string
  qrDownloadUrl: string
}) {
  const campaignUrl = `${process.env.NEXT_PUBLIC_APP_URL}/give/${data.campaignSlug}`
  const qrUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/campaigns/${data.campaignSlug}/qr`

  return resend.emails.send({
    from: process.env.EMAIL_FROM || 'Green Emblem <onboarding@resend.dev>',
    to: data.email,
    subject: `Your Baab As-Sadaqah campaign is live — ${data.honoreeNames}`,
    html: emailWrapper(`
      ${emailHeader('Your campaign is live!')}
      <div style="padding:24px 32px">
        <p style="font-size:16px;line-height:1.7;color:#333">Assalamu Alaikum ${data.firstName},</p>
        <p style="font-size:15px;line-height:1.7;color:#333">
          Alhamdulillah! Your Baab As-Sadaqah campaign for <strong>${data.honoreeNames}</strong> is now live and ready to share.
        </p>
        <div style="background:#f5f0e6;border-radius:10px;padding:16px 20px;margin:20px 0;border-left:3px solid #d4af6e">
          <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:0.15em;color:#2e6b2e;margin-bottom:6px">YOUR CAMPAIGN LINK</div>
          <div style="font-size:14px;color:#333;word-break:break-all">${campaignUrl}</div>
        </div>
        <p style="font-size:15px;line-height:1.7;color:#333">
          Share this link with your guests, or download your QR code to place on tables, in programmes, and on display boards at your event.
        </p>
        <div style="text-align:center;margin:28px 0;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <a href="${campaignUrl}" style="background:#d4af6e;color:#0f1f0f;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:15px;display:inline-block;font-weight:bold">
            View my campaign →
          </a>
          <a href="${qrUrl}" style="background:#0f1f0f;color:#d4af6e;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:15px;display:inline-block;border:1px solid #d4af6e">
            Download QR code
          </a>
        </div>
        <p style="font-size:14px;line-height:1.7;color:#888">
          Your campaign will remain active for 30 days. You can view live donation stats on your <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="color:#2e6b2e">dashboard</a> at any time.
        </p>
        <div style="text-align:center;margin:20px 0;font-size:18px;color:#2e6b2e;font-family:serif">
          تَقَبَّلَ اللَّهُ مِنَّا وَمِنكُمْ
        </div>
      </div>
    `),
  })
}


export async function sendCampaignEnded(data: {
  firstName: string
  email: string
  honoreeNames: string
  eventType: string
  campaignSlug: string
  totalRaised: number
  donorCount: number
  mealsFunded: number
}) {
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`

  return resend.emails.send({
    from: process.env.EMAIL_FROM || 'Green Emblem <onboarding@resend.dev>',
    to: data.email,
    subject: `MashaAllah — your campaign for ${data.honoreeNames} has ended`,
    html: emailWrapper(`
      ${emailHeader('JazakAllahu Khairan')}
      <div style="padding:24px 32px">
        <p style="font-size:16px;line-height:1.7;color:#333">Assalamu Alaikum ${data.firstName},</p>
        <p style="font-size:15px;line-height:1.7;color:#333">
          MashaAllah! Your Baab As-Sadaqah campaign for <strong>${data.honoreeNames}</strong> has come to a close.
          Here is a summary of the barakah your event generated:
        </p>

        <div style="background:#f5f0e6;border-radius:12px;padding:20px 24px;margin:20px 0;text-align:center">
          <div style="display:flex;justify-content:center;gap:32px;flex-wrap:wrap">
            <div style="text-align:center">
              <div style="font-size:32px;font-weight:bold;color:#2e6b2e">$${data.totalRaised.toFixed(2)}</div>
              <div style="font-size:12px;color:#666;letter-spacing:0.1em;margin-top:4px">RAISED</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:32px;font-weight:bold;color:#2e6b2e">${data.donorCount}</div>
              <div style="font-size:12px;color:#666;letter-spacing:0.1em;margin-top:4px">DONORS</div>
            </div>
            ${data.mealsFunded > 0 ? `<div style="text-align:center">
              <div style="font-size:32px;font-weight:bold;color:#2e6b2e">${data.mealsFunded}</div>
              <div style="font-size:12px;color:#666;letter-spacing:0.1em;margin-top:4px">MEALS FUNDED</div>
            </div>` : ''}
          </div>
        </div>

        <p style="font-size:15px;line-height:1.8;color:#333;font-style:italic;border-left:3px solid #d4af6e;padding-left:16px;margin:20px 0">
          "The Prophet ﷺ said: 'When a person dies, his deeds come to an end except for three: 
          ongoing charity (sadaqah jariyah), knowledge that is benefited from, and a righteous child who prays for him.'"
          <br/><span style="font-size:12px;color:#888">— Sahih Muslim</span>
        </p>

        <p style="font-size:15px;line-height:1.7;color:#333">
          Every meal funded, every dollar given in the names of your honourees — these are deeds that endure.
          May Allah accept it from you and from them, and may He bless the occasion it was given for.
        </p>

        <div style="text-align:center;margin:24px 0;font-size:20px;color:#2e6b2e;font-family:serif">
          تَقَبَّلَ اللَّهُ مِنَّا وَمِنكُمْ
        </div>
        <div style="text-align:center;font-size:13px;color:#888;margin-bottom:20px;font-style:italic">
          May Allah accept from us and from you.
        </div>

        <div style="text-align:center;margin:24px 0">
          <a href="${dashboardUrl}" style="background:#d4af6e;color:#0f1f0f;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:15px;display:inline-block;font-weight:bold">
            View your impact dashboard →
          </a>
        </div>

        <p style="font-size:13px;line-height:1.7;color:#888;text-align:center">
          Planning another event? <a href="${process.env.NEXT_PUBLIC_APP_URL}/sadaqah/request" style="color:#2e6b2e">Request a new campaign</a> anytime.
        </p>
      </div>
    `),
  })
}
