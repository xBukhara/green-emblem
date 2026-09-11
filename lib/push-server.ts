import 'server-only'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/server'

// ── Web Push sender ──────────────────────────────────────────────────────
// Requires three env vars:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY   (also read by the browser)
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT                  e.g. mailto:omer.a@green-emblem.com
//
// Generate a keypair once with:  npx web-push generate-vapid-keys
// The public key is safe to expose; the private key never leaves the server.

let configured: boolean | null = null

function ensureConfigured(): boolean {
  if (configured !== null) return configured
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:omer.a@green-emblem.com'
  if (!pub || !priv) {
    console.warn('[push] VAPID keys not set — notifications are disabled')
    configured = false
    return false
  }
  webpush.setVapidDetails(subject, pub, priv)
  configured = true
  return true
}

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
  renotify?: boolean
  requireInteraction?: boolean
}

export type Subscription = {
  id?: string
  endpoint: string
  p256dh: string
  auth: string
}

export type SendResult = { sent: number; failed: number; pruned: number }

// A subscription is gone for good on 404/410 — the browser has revoked it.
// Anything else (network blip, 5xx from the push service) is transient and
// must not delete the row.
const GONE = new Set([404, 410])

export async function sendToSubscriptions(
  subs: Subscription[],
  payload: PushPayload
): Promise<SendResult> {
  if (!ensureConfigured() || subs.length === 0) return { sent: 0, failed: 0, pruned: 0 }

  const admin = createAdminClient()
  const body = JSON.stringify(payload)
  const dead: string[] = []
  let sent = 0
  let failed = 0

  // Chunked so one very large audience can't blow the function's memory or
  // open thousands of sockets at once.
  const CHUNK = 100
  for (let i = 0; i < subs.length; i += CHUNK) {
    const batch = subs.slice(i, i + CHUNK)
    const results = await Promise.allSettled(
      batch.map(s =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 60 * 60 * 6 }   // a prayer alert is worthless a day later
        )
      )
    )
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') { sent++; return }
      failed++
      const status = (r.reason as any)?.statusCode
      if (GONE.has(status)) dead.push(batch[idx].endpoint)
      else console.warn('[push] send failed', status, (r.reason as any)?.body?.slice?.(0, 120))
    })
  }

  if (dead.length) {
    await admin.from('push_subscriptions').delete().in('endpoint', dead)
  }

  return { sent, failed, pruned: dead.length }
}

// Send once per (endpoint, kind, dedupeKey). Used by the prayer crons so a
// retry or an overlapping run can't notify the same person twice.
export async function sendOnce(
  subs: Subscription[],
  payload: PushPayload,
  kind: string,
  dedupeKey: string
): Promise<SendResult> {
  if (!ensureConfigured() || subs.length === 0) return { sent: 0, failed: 0, pruned: 0 }
  const admin = createAdminClient()

  const endpoints = subs.map(s => s.endpoint)
  const { data: already } = await admin
    .from('push_sent_log')
    .select('endpoint')
    .eq('kind', kind)
    .eq('dedupe_key', dedupeKey)
    .in('endpoint', endpoints)

  const seen = new Set((already || []).map((r: any) => r.endpoint))
  const fresh = subs.filter(s => !seen.has(s.endpoint))
  if (fresh.length === 0) return { sent: 0, failed: 0, pruned: 0 }

  // Claim before sending: if the send crashes mid-way we would rather skip a
  // notification than send it twice.
  await admin.from('push_sent_log').upsert(
    fresh.map(s => ({ endpoint: s.endpoint, kind, dedupe_key: dedupeKey })),
    { onConflict: 'endpoint,kind,dedupe_key', ignoreDuplicates: true }
  )

  return sendToSubscriptions(fresh, payload)
}

export async function getSubscriptionsForUsers(userIds: string[], column: string): Promise<Subscription[]> {
  if (userIds.length === 0) return []
  const admin = createAdminClient()
  const { data } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds)
    .eq(column, true)
  return (data || []) as Subscription[]
}

export function pushConfigured(): boolean {
  return ensureConfigured()
}
