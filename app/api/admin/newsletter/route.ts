import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify admin
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { subject, body } = await request.json()
  if (!subject || !body) return NextResponse.json({ error: 'Missing subject or body' }, { status: 400 })

  // Get all active subscribers
  const { data: subscribers } = await adminClient
    .from('newsletter_subscribers')
    .select('email, first_name')
    .eq('is_active', true)

  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ success: true, sent: 0 })
  }

  // Send via Resend in batches of 50
  const batchSize = 50
  let sent = 0
  for (let i = 0; i < subscribers.length; i += batchSize) {
    const batch = subscribers.slice(i, i + batchSize)
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Green Emblem <noreply@green-emblem.com>',
      to: batch.map(s => s.email),
      subject,
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="margin:0;padding:24px;background:#f5f0e6;font-family:Georgia,serif">
        <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid rgba(46,107,46,0.15)">
          <div style="background:#0f1f0f;padding:20px 32px">
            <div style="font-family:Georgia,serif;font-size:14px;letter-spacing:0.2em;color:#d4af6e">Green Emblem</div>
          </div>
          <div style="padding:28px 32px;font-size:15px;line-height:1.8;color:#333">${body.replace(/\n/g, '<br/>')}</div>
          <div style="background:#0f1f0f;padding:16px 32px;text-align:center">
            <p style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:0.1em;margin:0">GREEN-EMBLEM.COM</p>
          </div>
        </div>
      </body></html>`,
    })
    sent += batch.length
  }

  return NextResponse.json({ success: true, sent })
}
