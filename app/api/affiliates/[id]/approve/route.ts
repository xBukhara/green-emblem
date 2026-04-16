import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendAffiliateApproved } from '@/lib/email'

async function requireAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin' ? user : null
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const user = await requireAdmin(supabase)
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // Fetch the application
  const { data: app, error: appErr } = await admin
    .from('affiliate_applications')
    .select('*')
    .eq('id', params.id)
    .single()

  if (appErr || !app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  if (app.status !== 'pending') return NextResponse.json({ error: 'Application already reviewed' }, { status: 409 })

  // Update application to approved
  await admin.from('affiliate_applications').update({
    status: 'approved',
    approved_by: user.id,
    approved_at: new Date().toISOString(),
  }).eq('id', params.id)

  // Create public affiliate profile
  const { data: affiliate, error: affErr } = await admin.from('affiliates').insert({
    application_id: params.id,
    display_name: `${app.first_name} ${app.last_name}`,
    bio: app.bio,
    city: app.city,
    state: app.state,
    service_radius: app.service_radius,
    affiliate_type: app.affiliate_type,
    event_types: app.event_types,
    portfolio_urls: app.portfolio_urls,
    instagram_url: app.instagram_url,
    is_active: true,
  }).select().single()

  if (affErr) return NextResponse.json({ error: affErr.message }, { status: 500 })

  // Send approval email
  sendAffiliateApproved({
    firstName: app.first_name,
    email: app.email,
    affiliateId: affiliate.id,
  }).catch(console.error)

  return NextResponse.json({ success: true, affiliateId: affiliate.id })
}
