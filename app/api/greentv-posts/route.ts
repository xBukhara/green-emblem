import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/greentv-posts — public feed, most recent first.
// ?before= (ISO timestamp) for simple pagination.
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const before = searchParams.get('before')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

  let query = supabase.from('greentv_posts').select('*').order('posted_at', { ascending: false }).limit(limit)
  if (before) query = query.lt('posted_at', before)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data })
}
