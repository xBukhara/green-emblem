// app/api/affiliates/directory/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const city  = searchParams.get('city')
  const state = searchParams.get('state')
  const type  = searchParams.get('type')

  let query = supabase
    .from('affiliates')
    .select('id, display_name, bio, city, state, affiliate_type, event_types, portfolio_urls, instagram_url, review_count, avg_rating, jobs_completed, service_radius')
    .eq('is_active', true)
    .order('jobs_completed', { ascending: false })

  if (state) query = query.eq('state', state)
  if (city)  query = query.ilike('city', `%${city}%`)
  if (type && type !== 'all') query = query.in('affiliate_type', [type, 'both'])

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ affiliates: data })
}
