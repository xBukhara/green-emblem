import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

const ProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.enum(['favours', 'clothing', 'accessories', 'decor', 'art']),
  price: z.number().positive('Price must be positive'),
  description: z.string().optional(),
  images: z.array(z.string()).optional().default([]),
  sizes: z.array(z.string()).optional().default([]),
  variants: z.array(z.string()).optional().default([]),
  stock_status: z.enum(['in_stock', 'low', 'out', 'seasonal']).default('in_stock'),
  visibility: z.enum(['published', 'draft', 'featured']).default('draft'),
  is_favour_item: z.boolean().default(false),
  sort_order: z.number().optional().default(0),
})

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const visibility = searchParams.get('visibility') || 'published'
  const favour_only = searchParams.get('favour_only') === 'true'
  const all = searchParams.get('all') === 'true' // admin: fetch all visibilities

  // Check if admin requesting all
  let isAdmin = false
  if (all) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      isAdmin = profile?.role === 'admin'
    }
  }

  let query = supabase.from('products').select('*').order('sort_order', { ascending: true })

  if (category) query = query.eq('category', category)
  if (!isAdmin) query = query.in('visibility', ['published', 'featured'])
  if (favour_only) query = query.eq('is_favour_item', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ products: data })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = ProductSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('products').insert(parsed.data).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ product: data }, { status: 201 })
}
