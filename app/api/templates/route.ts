import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/templates — published templates for the design studio gallery
export async function GET() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('campaign_templates')
    .select('id, name, bg, accent, text, font_pair, pattern, overlay, pattern_opacity')
    .eq('published', true)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ templates: [] })
  return NextResponse.json({ templates: data || [] })
}
