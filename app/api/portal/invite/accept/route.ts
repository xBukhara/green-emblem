import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/portal/invite/accept?token=… — what is this invite for?
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const db = createAdminClient()
  const { data } = await db
    .from('masjid_invites')
    .select('email, expires_at, accepted_at, masjids(name)')
    .eq('token', token)
    .maybeSingle()

  if (!data) return NextResponse.json({ error: 'invalid' }, { status: 404 })
  if (data.accepted_at) return NextResponse.json({ error: 'used' }, { status: 410 })
  if (new Date(data.expires_at) < new Date()) return NextResponse.json({ error: 'expired' }, { status: 410 })

  return NextResponse.json({
    email: data.email,
    masjidName: (data as any).masjids?.name || 'your masjid',
  })
}

// POST /api/portal/invite/accept { token, password }
// Creates (or links) the account, sets the password the invitee chose, and
// grants membership. The token is consumed in the same transaction-ish flow.
export async function POST(request: NextRequest) {
  const { token, password } = await request.json().catch(() => ({}))
  if (!token || !password) {
    return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
  }
  if (String(password).length < 10) {
    return NextResponse.json({ error: 'Use at least 10 characters.' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data: invite } = await db
    .from('masjid_invites')
    .select('id, masjid_id, email, role, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite) return NextResponse.json({ error: 'This invitation is not valid.' }, { status: 404 })
  if (invite.accepted_at) return NextResponse.json({ error: 'This invitation has already been used.' }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This invitation has expired. Ask for a new one.' }, { status: 410 })
  }

  // The email may already have a Green Emblem account (they might be a
  // regular user too) — link it rather than failing.
  let userId: string | null = null
  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
  })

  if (created?.user) {
    userId = created.user.id
  } else if (createErr) {
    const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
    const existing = list?.users?.find(u => (u.email || '').toLowerCase() === invite.email)
    if (!existing) return NextResponse.json({ error: createErr.message }, { status: 500 })
    // Accepting an invite re-sets the password for that address, which is
    // the behaviour the invitee expects.
    await db.auth.admin.updateUserById(existing.id, { password })
    userId = existing.id
  }
  if (!userId) return NextResponse.json({ error: 'Could not create the account.' }, { status: 500 })

  // profiles row may be created by a trigger; upsert defensively
  await db.from('profiles').upsert({ id: userId, email: invite.email }, { onConflict: 'id' })

  const { error: memberErr } = await db.from('masjid_members').upsert(
    { masjid_id: invite.masjid_id, user_id: userId, role: invite.role },
    { onConflict: 'masjid_id,user_id' }
  )
  if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 })

  await db.from('masjid_invites')
    .update({ accepted_at: new Date().toISOString(), accepted_by: userId })
    .eq('id', invite.id)

  return NextResponse.json({ ok: true, email: invite.email })
}
