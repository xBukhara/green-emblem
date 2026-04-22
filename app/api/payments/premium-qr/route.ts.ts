import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createPremiumQRCheckout } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify token
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { campaign_slug, campaign_id, design_id } = await request.json()
  if (!campaign_slug || !campaign_id) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  try {
    const session = await createPremiumQRCheckout({
      customerEmail: user.email!,
      campaignSlug: campaign_slug,
      campaignId: campaign_id,
      designId: design_id,
    })
    return NextResponse.json({ checkoutUrl: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
