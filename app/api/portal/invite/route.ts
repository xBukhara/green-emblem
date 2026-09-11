import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isPlatformAdmin, randomToken, portalOrigin } from '@/lib/portal'
import { sendMasjidInvite } from '@/lib/email'

export const dynamic = 'force-dynamic'

// POST /api/portal/invite { masjid_id, email, role }
// Platform-admin only. Creates a single-use, 7-day invitation and emails it.
// No password is ever generated here — the invitee sets their own.
export async function POST(request: NextRequest) {
  const adminId = await isPlatformAdmin(request)
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { masjid_id, email, role } = await request.json().catch(() => ({}))
  if (!masjid_id || !email) {
    return NextResponse.json({ error: 'masjid_id and email are required' }, { status: 400 })
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'That email address looks wrong' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data: masjid } = await db.from('masjids').select('name').eq('id', masjid_id).maybeSingle()
  if (!masjid) return NextResponse.json({ error: 'Masjid not found' }, { status: 404 })

  // Supersede any outstanding invite for this address so only the newest
  // link works.
  await db.from('masjid_invites')
    .delete()
    .eq('masjid_id', masjid_id)
    .eq('email', email.toLowerCase())
    .is('accepted_at', null)

  const token = randomToken()
  const { error } = await db.from('masjid_invites').insert({
    masjid_id,
    email: email.toLowerCase(),
    token,
    role: role === 'editor' ? 'editor' : 'owner',
    created_by: adminId,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const link = `${portalOrigin()}/invite/${token}`
  const mail = await sendMasjidInvite({ email, masjidName: masjid.name, link })

  return NextResponse.json({
    ok: true,
    link,                       // shown in the admin UI so you can send it manually if needed
    emailed: !mail?.error,
  })
}
