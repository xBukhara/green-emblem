import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/masjids — public, list active masjids (for the directory / follow picker)
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  let query = supabase.from('masjids').select('*').eq('active', true).order('name', { ascending: true })
  if (q) query = query.ilike('name', `%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ masjids: data })
}

// POST /api/masjids — admin only, add a masjid to the directory
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { name, denomination, address, city, state, zip, lat, lng, place_id, phone, website, instagram_handle, facebook_page, verified, auto_sync_enabled } = body

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { data, error } = await admin.from('masjids').insert({
    name, denomination: denomination || 'sunni', address, city, state, zip,
    lat: lat ?? null, lng: lng ?? null, place_id: place_id || null,
    phone: phone || null, website: website || null,
    instagram_handle: instagram_handle || null, facebook_page: facebook_page || null,
    verified: !!verified, auto_sync_enabled: !!auto_sync_enabled,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ masjid: data }, { status: 201 })
}
