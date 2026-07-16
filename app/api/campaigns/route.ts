import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// POST /api/campaigns — create from magic link
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { token, honoree_names, event_type, event_date, location, theme } = body

  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const admin = createAdminClient()

  // Validate the magic link token
  const { data: req, error: reqErr } = await admin
    .from('campaign_requests')
    .select('*')
    .eq('magic_link_token', token)
    .eq('status', 'approved')
    .single()

  if (reqErr || !req) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 403 })

  // Check token isn't stale (7-day expiry)
  const sentAt = new Date(req.magic_link_sent_at)
  const daysSince = (Date.now() - sentAt.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSince > 7) return NextResponse.json({ error: 'This link has expired. Please contact us for a new one.' }, { status: 403 })

  // Generate URL-safe slug
  const base = `${honoree_names.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().getFullYear()}`
  const slug = base.replace(/^-+|-+$/g, '').substring(0, 60)

  const { data: campaign, error } = await admin.from('campaigns').insert({
    request_id:     req.id,
    slug,
    honoree_names,
    event_type,
    event_date:     event_date || null,
    location:       location || null,
    theme:          theme || {},
    status:         'active', // Live immediately — no approval step
    qr_tier:        req.qr_tier,
  }).select().single()

  if (error) {
    if (error.code === '23505') {
      // Slug collision — append random suffix
      const { data: campaign2, error: err2 } = await admin.from('campaigns').insert({
        request_id: req.id,
        slug: `${slug}-${Math.random().toString(36).slice(2, 6)}`,
        honoree_names, event_type,
        event_date: event_date || null,
        location: location || null,
        theme: theme || {},
        status: 'active',
        qr_tier: req.qr_tier,
      }).select().single()
      if (err2) return NextResponse.json({ error: err2.message }, { status: 500 })
      return NextResponse.json({ campaign: campaign2 }, { status: 201 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ campaign }, { status: 201 })
}

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaigns: data })
}
