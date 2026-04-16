import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendAffiliateApplicationToAdmin, sendApplicationReceived } from '@/lib/email'
import { z } from 'zod'

const ApplicationSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  instagram_url: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  service_radius: z.string().optional(),
  affiliate_type: z.enum(['decorator', 'favours', 'both']),
  event_types: z.array(z.string()).min(1, 'Select at least one event type'),
  years_experience: z.string().optional(),
  monthly_capacity: z.string().optional(),
  bio: z.string().min(20, 'Please write at least a short bio'),
  storage_situation: z.string().optional(),
  portfolio_urls: z.array(z.string()).min(1, 'At least one portfolio photo required'),
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = ApplicationSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('affiliate_applications')
    .insert(parsed.data)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire emails in parallel — don't block the response on email
  Promise.all([
    sendAffiliateApplicationToAdmin({
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      phone: data.phone,
      city: data.city,
      state: data.state,
      affiliateType: data.affiliate_type,
      eventTypes: data.event_types,
      yearsExperience: data.years_experience,
      bio: data.bio,
      instagramUrl: data.instagram_url,
    }),
    sendApplicationReceived({ firstName: data.first_name, email: data.email }),
  ]).catch(console.error)

  return NextResponse.json({ success: true, applicationId: data.id }, { status: 201 })
}
