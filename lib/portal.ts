import 'server-only'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// ── Portal auth helpers ──────────────────────────────────────────────────
// Every portal API route funnels through requireMasjidMember(), so there is
// exactly one place that decides whether someone may act for a masjid.

export type MasjidMembership = {
  userId: string
  masjidId: string
  role: string
  masjidName: string
}

export async function userFromRequest(request: Request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: { user } } = await anon.auth.getUser(token)
  return user
}

// Resolves the caller's masjid. Returns null when they administer none —
// membership is never taken from the request body, only from the database.
export async function requireMasjidMember(request: Request): Promise<MasjidMembership | null> {
  const user = await userFromRequest(request)
  if (!user) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('masjid_members')
    .select('masjid_id, role, masjids(name)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return {
    userId: user.id,
    masjidId: (data as any).masjid_id,
    role: (data as any).role,
    masjidName: (data as any).masjids?.name || 'Your masjid',
  }
}

export async function isPlatformAdmin(request: Request): Promise<string | null> {
  const user = await userFromRequest(request)
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  return data?.role === 'admin' ? user.id : null
}

export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
}

export function portalOrigin(): string {
  const host = process.env.NEXT_PUBLIC_PORTAL_HOST || 'masjid.green-emblem.com'
  return host.includes('localhost') ? `http://${host}` : `https://${host}`
}
