#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
#  Green Emblem — installable PWA + push notifications
#
#  Run from the project root:   bash apply-push-pwa.sh
#  Safe to run more than once.
#
#  AFTER running this you still need to:
#    1. npx web-push generate-vapid-keys  -> add the 3 env vars to Vercel
#    2. run push-notifications.sql in Supabase
#  See APPLY-PUSH-PWA.md for details.
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

if [ ! -f package.json ] || ! grep -q '"green-emblem"' package.json; then
  echo "ERROR: run this from the green-emblem project root." >&2
  exit 1
fi

echo "==> Installing web-push"
npm install web-push --silent
npm install -D @types/web-push --silent
echo "  done"

echo
echo "==> Writing files"
cat > 'APPLY-PUSH-PWA.md' <<'__GE_EOF_5d7c__'
# Green Emblem — Installable App + Push Notifications

---

## ⚠ One constraint shaped this whole build

**Vercel's Hobby plan allows two cron jobs, each at most once per day.** Both
slots were already used (`expire-events`, `sync-masjid-events`). A third cron
would have been rejected at deploy time — the exact failure that broke a deploy
in August.

So per-prayer alerts ("it's time for Maghrib") **cannot run on Hobby**. They
need a scheduler firing every few minutes. What you get instead:

| Notification | Works on Hobby? | How |
|---|---|---|
| **Your masjid posted an event** | ✅ **Yes, immediately** | Fires when an admin posts. No cron involved. |
| **Today's prayer times** (one morning digest, all five times) | ✅ **Yes** | Folded into the existing daily cron slot — no new cron added. |
| **Each prayer as it comes in** | ❌ Needs Vercel Pro ($20/mo) | Route is built and tested; add one line to `vercel.json` after upgrading. |

The toggle for per-prayer alerts is visible in settings but off by default, so
nobody is promised a notification that can't arrive.

### Turning on per-prayer alerts later
After upgrading to Pro, add to `vercel.json`:
```json
{ "path": "/api/cron/prayer-alerts", "schedule": "*/5 * * * *" }
```
The route's `WINDOW_MINUTES` is 5 and must stay ≥ the cron interval, or prayers
falling between runs get missed.

### About the cron change
`vercel.json` cron #1 now points at **`/api/cron/daily`**, which does
expire-events + log pruning + the prayer digest in one invocation.
`/api/cron/expire-events` is left in place so nothing breaks mid-deploy.
The digest goes out at 11:00 UTC (7am ET / 4am PT) — one fixed time for
everyone, which is the unavoidable cost of a single daily cron.

---

## Setup — three things before this works

### 1. Generate VAPID keys (once)
```bash
npx web-push generate-vapid-keys
```
Add to Vercel → Settings → Environment Variables:
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — the public key
- `VAPID_PRIVATE_KEY` — the private key (**server-side only, never commit it**)
- `VAPID_SUBJECT` — `mailto:omer.a@green-emblem.com`

I did not generate these for you on purpose — the private key would have been
sitting in a chat log. Without them the app still builds and runs; notifications
are simply disabled and the UI says so.

### 2. Run `push-notifications.sql` in Supabase
Creates `push_subscriptions`, `push_sent_log`, RLS, and the log-pruning function.

### 3. Confirm `CRON_SECRET` is set
Already required by the existing crons, so it probably is.

---

## What's in the box

**Installable app** — `manifest.json`, icons generated from your emblem at
192/512/maskable/apple-touch sizes, standalone display, brand theme colour, and
three home-screen shortcuts (Prayer, Quran, GreenWorld+).

**Service worker** (`public/sw.js`) — push handling, click-through, subscription
rotation, and an offline page. Caching is deliberately minimal: this app's value
is live data, and a stale cache is worse than a spinner. It never caches API
responses.

**Install prompt** — appears after 30 seconds of real use, dismissible, and
stays gone for 30 days. iOS gets Share → Add to Home Screen instructions, since
Safari never fires the install event.

**Notification settings** — in Dashboard → Profile. Permission flow, three
independent toggles, and a "send a test" button so you can prove it works on a
real device.

**iOS note:** web push requires iOS 16.4+ **and** the app added to the Home
Screen. Settings detects this and shows the install instructions rather than a
button that can't work.

---

## Privacy decisions worth knowing
- Prayer digests need a location. Coordinates are stored **rounded to 2 decimal
  places (~1.1 km)** — accurate to the second for prayer times, too coarse to
  identify a home address.
- The location comes from the cache the Prayer page already wrote. Enabling
  notifications never triggers a second geolocation prompt.
- Sends are deduplicated per (device, kind, day) so a cron retry can't notify
  someone twice, and the claim is written *before* sending — a crash mid-send
  skips a notification rather than repeating it.
- Dead subscriptions (404/410) are pruned automatically; transient failures are
  not, so a network blip doesn't unsubscribe anyone.

---

## Apply
```bash
bash apply-push-pwa.sh
npm run build
git add -A
git commit -m "feat: installable PWA with push notifications"
git push
```

## Verify after deploy
1. Open the site on Android Chrome → install prompt after ~30s → install
2. Dashboard → Profile → **Turn on notifications** → **Send a test**
3. On iPhone: Share → Add to Home Screen, reopen from the Home Screen, then the
   notification toggle appears
4. Post a masjid event in Admin → followers with notifications on get a push

Verified here with 33 automated browser checks: manifest validity, every icon's
real dimensions, PWA head tags, service worker activation, push payload handling
(including malformed and empty payloads), the offline page, and that all three
push endpoints reject anonymous callers.
__GE_EOF_5d7c__
echo "  wrote APPLY-PUSH-PWA.md"
cat > 'push-notifications.sql' <<'__GE_EOF_5d7c__'
-- ═══════════════════════════════════════════════════════════════════
--  GREEN EMBLEM — PUSH NOTIFICATIONS
--  Run in the Supabase SQL Editor. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Subscriptions ──────────────────────────────────────────────────
-- One row per browser/device. A user can have several (phone, laptop).
create table if not exists push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,

  -- Prayer alerts need a location and a timezone. Coordinates are stored
  -- rounded to 2dp (~1.1 km) — plenty for prayer times, and deliberately
  -- too coarse to identify a home address.
  lat           numeric(6,2),
  lng           numeric(6,2),
  timezone      text,
  calc_method   text default 'MuslimWorldLeague',
  madhab        text default 'shafi',

  -- Per-category opt-ins
  notify_prayer_daily  boolean not null default true,   -- one digest each morning
  notify_prayer_each   boolean not null default false,  -- per-prayer (needs Vercel Pro)
  notify_masjid_events boolean not null default true,

  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  last_sent_at  timestamptz,
  failure_count int not null default 0
);

create index if not exists push_subs_user_idx   on push_subscriptions (user_id);
create index if not exists push_subs_prayer_idx on push_subscriptions (notify_prayer_daily) where notify_prayer_daily;
create index if not exists push_subs_each_idx   on push_subscriptions (notify_prayer_each)  where notify_prayer_each;

-- 2. Delivery log — prevents double-sending a prayer alert when the
--    per-minute cron overlaps or retries.
create table if not exists push_sent_log (
  id           uuid primary key default gen_random_uuid(),
  endpoint     text not null,
  kind         text not null,          -- 'prayer_daily' | 'prayer_fajr' | ... | 'masjid_event'
  dedupe_key   text not null,          -- e.g. '2026-09-10:fajr'
  sent_at      timestamptz not null default now(),
  unique (endpoint, kind, dedupe_key)
);
create index if not exists push_log_sent_idx on push_sent_log (sent_at desc);

-- Keep the log from growing forever
create or replace function prune_push_log()
returns void language sql security definer set search_path = public as $$
  delete from push_sent_log where sent_at < now() - interval '14 days';
$$;

-- 3. RLS ────────────────────────────────────────────────────────────
alter table push_subscriptions enable row level security;
alter table push_sent_log      enable row level security;

drop policy if exists "own push subscriptions" on push_subscriptions;
create policy "own push subscriptions" on push_subscriptions
  for select using (user_id = auth.uid());

-- All writes go through the API using the service role, so there are no
-- client insert/update policies on purpose. The log is server-only.

drop policy if exists "admins read push log" on push_sent_log;
create policy "admins read push log" on push_sent_log
  for select using (exists (
    select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'
  ));
__GE_EOF_5d7c__
echo "  wrote push-notifications.sql"
cat > 'vercel.json' <<'__GE_EOF_5d7c__'
{
  "crons": [
    {
      "path": "/api/cron/daily",
      "schedule": "0 11 * * *"
    },
    {
      "path": "/api/cron/sync-masjid-events",
      "schedule": "15 6 * * *"
    }
  ]
}
__GE_EOF_5d7c__
echo "  wrote vercel.json"
mkdir -p "public"
cat > 'public/manifest.json' <<'__GE_EOF_5d7c__'
{
  "name": "Green Emblem — Faith, Community & Giving",
  "short_name": "Green Emblem",
  "description": "Prayer times and Qibla, the Quran in Uthmani script, your masjid's events, and a free way to turn any celebration into sadaqah.",
  "id": "/",
  "start_url": "/?source=pwa",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#143314",
  "theme_color": "#143314",
  "categories": ["lifestyle", "social", "education"],
  "lang": "en",
  "dir": "ltr",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    {
      "name": "Prayer times",
      "short_name": "Prayer",
      "url": "/prayer?source=shortcut",
      "icons": [{ "src": "/icons/icon-192.png", "sizes": "192x192" }]
    },
    {
      "name": "Read Quran",
      "short_name": "Quran",
      "url": "/prayer?tab=quran&source=shortcut",
      "icons": [{ "src": "/icons/icon-192.png", "sizes": "192x192" }]
    },
    {
      "name": "Nearby & events",
      "short_name": "GreenWorld+",
      "url": "/greenworld-plus?source=shortcut",
      "icons": [{ "src": "/icons/icon-192.png", "sizes": "192x192" }]
    }
  ]
}
__GE_EOF_5d7c__
echo "  wrote public/manifest.json"
mkdir -p "public"
cat > 'public/sw.js' <<'__GE_EOF_5d7c__'
/* Green Emblem service worker — push notifications + a light offline shell.
 *
 * Deliberately conservative about caching: this app's value is live data
 * (prayer times, events, the Quran API), and a stale cache is worse than a
 * spinner. We cache only the app shell and static assets, always try the
 * network first for pages, and never cache API responses.
 */

const VERSION = 'ge-v1'
const SHELL_CACHE = `${VERSION}-shell`
const OFFLINE_URL = '/offline.html'

const PRECACHE = [
  OFFLINE_URL,
  '/icons/icon-192.png',
  '/icons/badge-96.png',
  '/manifest.json',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())   // never block install on a cache miss
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// Network-first for navigations, with an offline page as the last resort.
// Everything else falls through to the network untouched.
self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return
  if (request.mode !== 'navigate') return

  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(OFFLINE_URL)
      return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
    })
  )
})

// ── Push ────────────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'Green Emblem', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'Green Emblem'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: payload.tag || 'green-emblem',
    renotify: !!payload.renotify,
    requireInteraction: !!payload.requireInteraction,
    silent: !!payload.silent,
    timestamp: payload.timestamp || Date.now(),
    data: { url: payload.url || '/', ...(payload.data || {}) },
    actions: payload.actions || [],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Focus an existing tab if one is open rather than piling up new ones.
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(target).catch(() => {})
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    })
  )
})

// If the browser rotates the subscription, tell the server so pushes keep
// arriving instead of silently dying.
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    try {
      const applicationServerKey = event.oldSubscription?.options?.applicationServerKey
      if (!applicationServerKey) return
      const fresh = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: fresh, rotatedFrom: event.oldSubscription?.endpoint }),
      })
    } catch {}
  })())
})
__GE_EOF_5d7c__
echo "  wrote public/sw.js"
mkdir -p "public"
cat > 'public/offline.html' <<'__GE_EOF_5d7c__'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Offline · Green Emblem</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0; min-height: 100dvh;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 18px; padding: 32px; text-align: center;
      background: #143314; color: #f5f0e6;
      font-family: Georgia, 'Times New Roman', serif;
    }
    img { width: 84px; height: 84px; border-radius: 16px; }
    h1 { font-size: 20px; font-weight: 500; letter-spacing: 0.02em; margin: 0; }
    p { margin: 0; max-width: 34ch; font-size: 15px; font-style: italic; line-height: 1.7; color: rgba(255,255,255,0.55); }
    button {
      margin-top: 6px; padding: 12px 26px; border: none; border-radius: 9px;
      background: #d4af6e; color: #143314;
      font-family: inherit; font-size: 12px; letter-spacing: 0.14em; cursor: pointer;
    }
  </style>
</head>
<body>
  <img src="/icons/icon-192.png" alt="" />
  <h1>You&rsquo;re offline</h1>
  <p>Green Emblem needs a connection for prayer times, the Quran, and your community feed. Reconnect and try again.</p>
  <button onclick="location.reload()">Try again</button>
</body>
</html>
__GE_EOF_5d7c__
echo "  wrote public/offline.html"
mkdir -p "lib"
cat > 'lib/push-server.ts' <<'__GE_EOF_5d7c__'
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
__GE_EOF_5d7c__
echo "  wrote lib/push-server.ts"
mkdir -p "lib"
cat > 'lib/push-client.ts' <<'__GE_EOF_5d7c__'
'use client'

// ── Web Push, browser side ───────────────────────────────────────────────

const LOCATION_CACHE_KEY = 'ge_prayer_location'

export type PushPrefs = {
  notify_prayer_daily: boolean
  notify_prayer_each: boolean
  notify_masjid_events: boolean
}

export type PushState =
  | 'unsupported'        // no service worker / Push API (e.g. iOS Safari in a tab)
  | 'ios-needs-install'  // iOS: web push only works once added to the Home Screen
  | 'denied'             // user blocked notifications at the OS/browser level
  | 'subscribed'
  | 'unsubscribed'

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1)
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
}

// VAPID keys are base64url; the browser wants a Uint8Array.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i)
  return output
}

export async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null
  try {
    return (await navigator.serviceWorker.ready) || null
  } catch {
    return null
  }
}

export async function currentState(): Promise<PushState> {
  if (!pushSupported()) {
    // iOS supports web push from 16.4, but only for installed PWAs.
    if (isIos() && !isStandalone()) return 'ios-needs-install'
    return 'unsupported'
  }
  if (isIos() && !isStandalone()) return 'ios-needs-install'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'subscribed' : 'unsubscribed'
}

export async function getEndpoint(): Promise<string | null> {
  const reg = await getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub?.endpoint ?? null
}

// Read (never request) the cached location so prayer digests can be
// calculated. Asking for geolocation here would be a second permission
// prompt stacked on the notification one.
function cachedLocation(): { lat: number; lng: number } | null {
  try {
    const raw = localStorage.getItem(LOCATION_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.coords ?? null
  } catch { return null }
}

function cachedPrayerPrefs(): { calcMethod?: string; madhab?: string } {
  return {}
}

export async function subscribe(
  supabase: any,
  prefs?: Partial<PushPrefs>
): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: false, error: 'This browser does not support notifications.' }

  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapid) return { ok: false, error: 'Notifications are not configured yet.' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { ok: false, error: permission === 'denied'
      ? 'Notifications are blocked. Enable them for this site in your browser settings.'
      : 'Notification permission was dismissed.' }
  }

  const reg = await getRegistration()
  if (!reg) return { ok: false, error: 'Could not start the notification service.' }

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
    })
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false, error: 'Please sign in first.' }

  const coords = cachedLocation()
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      lat: coords?.lat, lng: coords?.lng,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...cachedPrayerPrefs(),
      ...prefs,
    }),
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    return { ok: false, error: j.error || 'Could not save your subscription.' }
  }
  return { ok: true }
}

export async function unsubscribe(supabase: any): Promise<{ ok: boolean; error?: string }> {
  const reg = await getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  const endpoint = sub?.endpoint

  try { await sub?.unsubscribe() } catch {}

  if (endpoint) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {})
    }
  }
  return { ok: true }
}

export async function updatePrefs(supabase: any, prefs: Partial<PushPrefs>) {
  const reg = await getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return { ok: false, error: 'Not subscribed on this device.' }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false, error: 'Please sign in first.' }

  const coords = cachedLocation()
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      lat: coords?.lat, lng: coords?.lng,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...prefs,
    }),
  })
  return { ok: res.ok }
}

export async function fetchPrefs(supabase: any): Promise<PushPrefs | null> {
  const endpoint = await getEndpoint()
  if (!endpoint) return null
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const res = await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (!res.ok) return null
  const j = await res.json()
  return j.preferences || null
}

export async function sendTest(supabase: any): Promise<{ ok: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false, error: 'Please sign in first.' }
  const res = await fetch('/api/push/test', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const j = await res.json().catch(() => ({}))
  return res.ok ? { ok: true } : { ok: false, error: j.error || 'Could not send a test.' }
}
__GE_EOF_5d7c__
echo "  wrote lib/push-client.ts"
mkdir -p "lib"
cat > 'lib/prayer-push.ts' <<'__GE_EOF_5d7c__'
import 'server-only'
import { computeDayTimes, orderedPrayers, type CalcMethodId } from '@/lib/prayer'

export type PrayerSub = {
  endpoint: string
  p256dh: string
  auth: string
  lat: number | null
  lng: number | null
  timezone: string | null
  calc_method: string | null
  madhab: string | null
}

const PRAYER_LABEL: Record<string, string> = {
  fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha',
}

// Format a Date in a specific IANA zone — the server runs in UTC, so every
// user-facing time has to be rendered in *their* zone or it is simply wrong.
export function timeIn(date: Date, timeZone: string): string {
  try {
    return date.toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })
  } catch {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
}

// The calendar date in the user's own zone, as YYYY-MM-DD. Used as the
// dedupe key so "today" means today where they are.
export function localDateKey(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

export function usable(s: PrayerSub): boolean {
  return s.lat != null && s.lng != null && !!s.timezone
}

export function dayTimesFor(s: PrayerSub, when: Date) {
  const method = (s.calc_method || 'MuslimWorldLeague') as CalcMethodId
  const madhab = s.madhab === 'hanafi' ? 'hanafi' : 'shafi'
  const times = computeDayTimes(s.lat!, s.lng!, when, method)
  return orderedPrayers(times, madhab).filter(p => p.key !== 'sunrise')
}

// "Fajr 5:42 · Dhuhr 1:02 · Asr 4:31 · Maghrib 7:14 · Isha 8:33"
export function digestBody(s: PrayerSub, when: Date): string {
  return dayTimesFor(s, when)
    .map(p => `${PRAYER_LABEL[p.key] || p.label} ${timeIn(p.time, s.timezone!)}`)
    .join(' · ')
}

// Which prayer, if any, falls inside [now, now + windowMinutes)?
export function prayerDueNow(s: PrayerSub, now: Date, windowMinutes: number) {
  for (const p of dayTimesFor(s, now)) {
    const delta = (p.time.getTime() - now.getTime()) / 60000
    if (delta >= 0 && delta < windowMinutes) {
      return { key: p.key, label: PRAYER_LABEL[p.key] || p.label, time: p.time }
    }
  }
  return null
}
__GE_EOF_5d7c__
echo "  wrote lib/prayer-push.ts"
mkdir -p "app/api/push/subscribe"
cat > 'app/api/push/subscribe/route.ts' <<'__GE_EOF_5d7c__'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function admin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function userFrom(request: NextRequest) {
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

// Coordinates are stored at 2dp (~1.1 km) — accurate enough for prayer
// times, deliberately too coarse to pin down a home.
const coarse = (n: unknown) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : null

// POST /api/push/subscribe — save or refresh this device's subscription
export async function POST(request: NextRequest) {
  const user = await userFrom(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const sub = body.subscription
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  const db = admin()

  // A rotated subscription replaces the old row rather than leaving a
  // dead endpoint behind that will 410 forever.
  if (body.rotatedFrom && body.rotatedFrom !== sub.endpoint) {
    await db.from('push_subscriptions').delete().eq('endpoint', body.rotatedFrom)
  }

  const row: Record<string, any> = {
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    user_agent: (request.headers.get('user-agent') || '').slice(0, 300),
    last_seen_at: new Date().toISOString(),
    failure_count: 0,
  }
  if (body.lat != null) row.lat = coarse(body.lat)
  if (body.lng != null) row.lng = coarse(body.lng)
  if (body.timezone) row.timezone = String(body.timezone).slice(0, 64)
  if (body.calcMethod) row.calc_method = String(body.calcMethod).slice(0, 40)
  if (body.madhab) row.madhab = body.madhab === 'hanafi' ? 'hanafi' : 'shafi'
  for (const key of ['notify_prayer_daily', 'notify_prayer_each', 'notify_masjid_events']) {
    if (key in body) row[key] = !!body[key]
  }

  const { data, error } = await db
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'endpoint' })
    .select('notify_prayer_daily, notify_prayer_each, notify_masjid_events')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, preferences: data })
}

// GET /api/push/subscribe?endpoint=… — current state for this device
export async function GET(request: NextRequest) {
  const user = await userFrom(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const endpoint = request.nextUrl.searchParams.get('endpoint')
  if (!endpoint) return NextResponse.json({ subscribed: false })

  const { data } = await admin()
    .from('push_subscriptions')
    .select('notify_prayer_daily, notify_prayer_each, notify_masjid_events, lat, timezone')
    .eq('endpoint', endpoint)
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ subscribed: !!data, preferences: data || null })
}
__GE_EOF_5d7c__
echo "  wrote app/api/push/subscribe/route.ts"
mkdir -p "app/api/push/unsubscribe"
cat > 'app/api/push/unsubscribe/route.ts' <<'__GE_EOF_5d7c__'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// POST /api/push/unsubscribe { endpoint }
export async function POST(request: NextRequest) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: { user } } = await anon.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { endpoint } = await request.json().catch(() => ({}))
  if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 })

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  // Scoped to the caller so one user can't delete another's subscription.
  await admin.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
__GE_EOF_5d7c__
echo "  wrote app/api/push/unsubscribe/route.ts"
mkdir -p "app/api/push/test"
cat > 'app/api/push/test/route.ts' <<'__GE_EOF_5d7c__'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendToSubscriptions, pushConfigured } from '@/lib/push-server'

export const dynamic = 'force-dynamic'

// POST /api/push/test — send a notification to the caller's own devices.
// Rate-limited to once every 30s so it can't be used as a nuisance.
export async function POST(request: NextRequest) {
  if (!pushConfigured()) {
    return NextResponse.json({ error: 'Push is not configured on the server (VAPID keys missing).' }, { status: 503 })
  }

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: { user } } = await anon.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, last_sent_at')
    .eq('user_id', user.id)

  if (!subs?.length) {
    return NextResponse.json({ error: 'No device is subscribed yet.' }, { status: 400 })
  }

  const newest = subs.reduce((a: any, b: any) =>
    (a?.last_sent_at || '') > (b?.last_sent_at || '') ? a : b)
  if (newest?.last_sent_at && Date.now() - new Date(newest.last_sent_at).getTime() < 30_000) {
    return NextResponse.json({ error: 'Just a moment — try again in half a minute.' }, { status: 429 })
  }

  const result = await sendToSubscriptions(subs as any, {
    title: 'Green Emblem',
    body: 'Notifications are working. This is what a prayer alert will look like.',
    url: '/prayer',
    tag: 'ge-test',
    renotify: true,
  })

  await admin.from('push_subscriptions')
    .update({ last_sent_at: new Date().toISOString() })
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true, ...result })
}
__GE_EOF_5d7c__
echo "  wrote app/api/push/test/route.ts"
mkdir -p "app/api/cron/daily"
cat > 'app/api/cron/daily/route.ts' <<'__GE_EOF_5d7c__'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendOnce } from '@/lib/push-server'
import { digestBody, localDateKey, usable, type PrayerSub } from '@/lib/prayer-push'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── Combined daily maintenance ───────────────────────────────────────────
// WHY THIS ROUTE EXISTS: Vercel's Hobby plan allows only TWO cron jobs, and
// both slots were already taken (expire-events, sync-masjid-events). Adding
// a third for the prayer digest would have been rejected at deploy time —
// exactly the failure that broke a deploy back in August. So expire-events
// and the prayer digest share one slot here. Both are quick DB operations.
//
// vercel.json points cron #1 at this route. /api/cron/expire-events is kept
// so nothing breaks if the old schedule is still registered.

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const report: Record<string, any> = { ranAt: new Date().toISOString() }

  // ── 1. Expire stale masjid events ──
  try {
    const { error } = await admin.rpc('expire_old_masjid_events')
    report.expireEvents = error ? { error: error.message } : 'ok'
  } catch (e: any) {
    report.expireEvents = { error: e?.message || 'failed' }
  }

  // ── 2. Prune the push delivery log ──
  try {
    await admin.rpc('prune_push_log')
    report.pruneLog = 'ok'
  } catch (e: any) {
    report.pruneLog = { error: e?.message || 'failed' }
  }

  // ── 3. Daily prayer-times digest ──
  try {
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, lat, lng, timezone, calc_method, madhab')
      .eq('notify_prayer_daily', true)

    const eligible = ((subs || []) as PrayerSub[]).filter(usable)
    const now = new Date()
    let sent = 0, skipped = 0

    // Grouped by (timezone, rounded location) so identical digests are sent
    // as one batch instead of recomputing per subscriber.
    const groups = new Map<string, PrayerSub[]>()
    for (const s of eligible) {
      const key = `${s.timezone}|${s.lat}|${s.lng}|${s.calc_method}|${s.madhab}`
      const arr = groups.get(key)
      if (arr) arr.push(s); else groups.set(key, [s])
    }

    for (const group of Array.from(groups.values())) {
      const sample = group[0]
      const dateKey = localDateKey(now, sample.timezone!)
      const body = digestBody(sample, now)
      const result = await sendOnce(
        group.map(s => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })),
        {
          title: "Today's prayer times",
          body,
          url: '/prayer',
          tag: 'ge-prayer-daily',
          renotify: false,
        },
        'prayer_daily',
        dateKey
      )
      sent += result.sent
      skipped += group.length - result.sent
    }

    report.prayerDigest = { eligible: eligible.length, groups: groups.size, sent, skipped }
  } catch (e: any) {
    report.prayerDigest = { error: e?.message || 'failed' }
  }

  return NextResponse.json({ success: true, ...report })
}
__GE_EOF_5d7c__
echo "  wrote app/api/cron/daily/route.ts"
mkdir -p "app/api/cron/prayer-alerts"
cat > 'app/api/cron/prayer-alerts/route.ts' <<'__GE_EOF_5d7c__'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendOnce } from '@/lib/push-server'
import { localDateKey, prayerDueNow, timeIn, usable, type PrayerSub } from '@/lib/prayer-push'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── Per-prayer alerts ────────────────────────────────────────────────────
// "Maghrib is at 7:14 PM" delivered at the moment the prayer comes in.
//
// ⚠ THIS ROUTE IS NOT IN vercel.json ON PURPOSE.
// It needs to run every few minutes, and Vercel's Hobby plan caps cron jobs
// at ONCE PER DAY (and two jobs total). Registering it on Hobby makes the
// deployment fail outright.
//
// To turn it on after upgrading to Vercel Pro, add to vercel.json:
//     { "path": "/api/cron/prayer-alerts", "schedule": "*/5 * * * *" }
//
// The window below must be >= the cron interval, or prayers that fall
// between runs are missed. */5 with WINDOW_MINUTES = 5 lines up exactly.
const WINDOW_MINUTES = 5

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, lat, lng, timezone, calc_method, madhab')
    .eq('notify_prayer_each', true)

  const eligible = ((subs || []) as PrayerSub[]).filter(usable)

  // Bucket everyone whose next prayer lands in this window, by prayer name,
  // so each distinct notification goes out as one batch.
  const buckets = new Map<string, { label: string; time: Date; tz: string; subs: PrayerSub[] }>()
  for (const s of eligible) {
    const due = prayerDueNow(s, now, WINDOW_MINUTES)
    if (!due) continue
    const key = `${due.key}|${s.timezone}|${timeIn(due.time, s.timezone!)}`
    const bucket = buckets.get(key)
    if (bucket) bucket.subs.push(s)
    else buckets.set(key, { label: due.label, time: due.time, tz: s.timezone!, subs: [s] })
  }

  let sent = 0
  for (const [key, bucket] of Array.from(buckets.entries())) {
    const prayerKey = key.split('|')[0]
    const dedupe = `${localDateKey(now, bucket.tz)}:${prayerKey}`
    const result = await sendOnce(
      bucket.subs.map(s => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })),
      {
        title: `${bucket.label} — ${timeIn(bucket.time, bucket.tz)}`,
        body: `It's time for ${bucket.label}.`,
        url: '/prayer',
        tag: `ge-prayer-${prayerKey}`,
        renotify: true,
      },
      `prayer_${prayerKey}`,
      dedupe
    )
    sent += result.sent
  }

  return NextResponse.json({
    success: true,
    ranAt: now.toISOString(),
    eligible: eligible.length,
    buckets: buckets.size,
    sent,
  })
}
__GE_EOF_5d7c__
echo "  wrote app/api/cron/prayer-alerts/route.ts"
mkdir -p "app/api/masjid-events"
cat > 'app/api/masjid-events/route.ts' <<'__GE_EOF_5d7c__'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendNewEventNotification } from '@/lib/email'
import { sendToSubscriptions, getSubscriptionsForUsers } from '@/lib/push-server'

// GET /api/masjid-events — public, list active (non-expired) events.
// Optional ?masjid_id= to filter to one masjid.
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const masjidId = searchParams.get('masjid_id')

  let query = supabase
    .from('masjid_events')
    .select('*, masjids(name, city, state, lat, lng)')
    .eq('status', 'active')
    .order('event_start', { ascending: true })

  if (masjidId) query = query.eq('masjid_id', masjidId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ events: data })
}

// POST /api/masjid-events — admin only, add an event + notify followers of that masjid
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: adminProfile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (adminProfile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { masjid_id, title, description, image_url, event_start, event_end } = body

  if (!masjid_id || !title || !event_start || !event_end) {
    return NextResponse.json({ error: 'masjid_id, title, event_start, and event_end are required' }, { status: 400 })
  }

  const { data: event, error } = await admin.from('masjid_events').insert({
    masjid_id, title, description: description || null, image_url: image_url || null,
    event_start, event_end, source: 'admin', status: 'active', created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify followers of this masjid — best-effort, doesn't block the response
  const { data: masjid } = await admin.from('masjids').select('name').eq('id', masjid_id).maybeSingle()
  const { data: followers } = await admin.from('profiles').select('email, first_name').eq('followed_masjid_id', masjid_id)

  if (masjid && followers?.length) {
    // Push to followers' devices. Best-effort and non-blocking — a push
    // failure must never stop the event from being created.
    ;(async () => {
      try {
        const { data: followerRows } = await admin
          .from('profiles').select('id').eq('followed_masjid_id', masjid_id)
        const ids = (followerRows || []).map((r: any) => r.id)
        const subs = await getSubscriptionsForUsers(ids, 'notify_masjid_events')
        if (subs.length) {
          const when = new Date(event_start).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
          })
          await sendToSubscriptions(subs, {
            title: masjid.name,
            body: `${title} · ${when}`,
            url: '/greenworld-plus',
            tag: `ge-event-${event.id}`,
            renotify: true,
          })
        }
      } catch (e) {
        console.warn('[push] masjid event notification failed', e)
      }
    })()

    Promise.allSettled(
      followers.map(f => sendNewEventNotification({
        email: f.email,
        firstName: f.first_name,
        masjidName: masjid.name,
        eventTitle: title,
        eventDescription: description,
        eventStart: event_start,
        eventEnd: event_end,
      }))
    ).catch(() => {})
  }

  return NextResponse.json({ event }, { status: 201 })
}
__GE_EOF_5d7c__
echo "  wrote app/api/masjid-events/route.ts"
mkdir -p "app"
cat > 'app/layout.tsx' <<'__GE_EOF_5d7c__'
import type { Metadata, Viewport } from 'next'
import { Cinzel, Cormorant_Garamond, Noto_Naskh_Arabic, Inter, Amiri_Quran } from 'next/font/google'
import BottomNav from '@/components/BottomNav'
import PWARegister from '@/components/PWARegister'
import InstallPrompt from '@/components/InstallPrompt'
import './globals.css'

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-cinzel',
  display: 'swap',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

const arabic = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500'],
  variable: '--font-arabic',
  display: 'swap',
})

// Quranic typesetting face. Amiri Quran is purpose-built for Quranic text
// (full Uthmani diacritic coverage) and is always available from Google
// Fonts, so the reader can never fall back to a face that mangles the
// marks. If /public/fonts/UthmanicHafs.woff2 is present (see APPLY notes),
// the @font-face in globals.css takes precedence over this.
const amiriQuran = Amiri_Quran({
  subsets: ['arabic'],
  weight: ['400'],
  variable: '--font-amiri-quran',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: '#143314',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',   // lets content sit under the iOS home indicator
}

export const metadata: Metadata = {
  metadataBase: new URL('https://green-emblem.com'),
  title: {
    default: 'Green Emblem — Islamic Events, Giving & Community',
    template: '%s | Green Emblem',
  },
  description: 'Free QR-code charitable giving for Islamic events — turn any Nikkah, Walima, or Aqiqah into sadaqah given in someone\'s honour.',
  keywords: ['Islamic events', 'sadaqah', 'charity QR code', 'Nikkah', 'Walima', 'Aqiqah', 'halal', 'Muslim giving'],
  openGraph: {
    title: 'Green Emblem',
    description: 'Faith. Strength. Purpose.',
    url: 'https://green-emblem.com',
    siteName: 'Green Emblem',
    locale: 'en_US',
    type: 'website',
    images: ['/og-image.png'],
  },
  manifest: '/manifest.json',
  applicationName: 'Green Emblem',
  appleWebApp: {
    capable: true,
    title: 'Green Emblem',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icon.png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${cormorant.variable} ${arabic.variable} ${inter.variable} ${amiriQuran.variable}`}>
      <body>
        {children}
        <BottomNav/>
        <PWARegister/>
        <InstallPrompt/>
      </body>
    </html>
  )
}
__GE_EOF_5d7c__
echo "  wrote app/layout.tsx"
mkdir -p "components"
cat > 'components/PWARegister.tsx' <<'__GE_EOF_5d7c__'
'use client'
import { useEffect } from 'react'

// Registers the service worker once, on every page. Silent by design —
// a failed registration should never surface to the user.
export default function PWARegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV === 'development') return   // avoid stale SW during dev

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    }
    // Wait for load so the SW never competes with first paint for bandwidth
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])

  return null
}
__GE_EOF_5d7c__
echo "  wrote components/PWARegister.tsx"
mkdir -p "components"
cat > 'components/InstallPrompt.tsx' <<'__GE_EOF_5d7c__'
'use client'
import { useEffect, useState } from 'react'
import { Download, X, Share } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isIos, isStandalone } from '@/lib/push-client'

const DISMISS_KEY = 'ge_install_dismissed_at'
const DISMISS_DAYS = 30

// A quiet, dismissible invitation to install. Appears only after the visitor
// has actually used the site (30s), and stays gone for a month once
// dismissed — an install banner that nags is worse than none.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null)
  const [show, setShow] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0)
      if (at && Date.now() - at < DISMISS_DAYS * 86400000) return
    } catch {}

    // Android / desktop Chrome
    const onPrompt = (e: any) => {
      e.preventDefault()
      setDeferred(e)
      setTimeout(() => setShow(true), 30000)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    // iOS never fires that event — it needs manual Share → Add to Home Screen
    if (isIos()) {
      setIosHint(true)
      const t = setTimeout(() => setShow(true), 30000)
      return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', onPrompt) }
    }
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const dismiss = () => {
    setShow(false)
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
  }

  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    try { await deferred.userChoice } catch {}
    setDeferred(null)
    dismiss()
  }

  if (!show) return null

  return (
    <div
      role="dialog"
      aria-label="Install Green Emblem"
      className="fixed inset-x-3 bottom-[calc(74px+env(safe-area-inset-bottom,0px))] z-[130] rounded-xl border border-gold/25 bg-forest-deepest/97 p-4 shadow-2xl backdrop-blur-xl lg:inset-x-auto lg:right-6 lg:bottom-6 lg:max-w-[360px]"
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 flex h-9 w-9 cursor-pointer items-center justify-center border-none bg-transparent text-white/40 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mb-2 font-cinzel text-[10px] tracking-[0.2em] text-gold">ADD TO HOME SCREEN</div>
      <p className="mb-3.5 pr-6 font-cormorant text-[15px] italic leading-relaxed text-white/70">
        {iosHint
          ? 'Tap Share, then “Add to Home Screen” — that also lets Green Emblem send you prayer reminders.'
          : 'Open prayer times in one tap, and get reminders when a prayer comes in.'}
      </p>

      {iosHint ? (
        <div className="flex items-center gap-2 font-cinzel text-[10px] tracking-[0.12em] text-white/60">
          <Share className="h-4 w-4 text-gold" />
          Share → Add to Home Screen
        </div>
      ) : (
        <Button variant="brand" size="sm" className="w-full" onClick={install}>
          <Download className="h-4 w-4" />
          Install
        </Button>
      )}
    </div>
  )
}
__GE_EOF_5d7c__
echo "  wrote components/InstallPrompt.tsx"
mkdir -p "components"
cat > 'components/NotificationSettings.tsx' <<'__GE_EOF_5d7c__'
'use client'
import { useEffect, useState, useCallback } from 'react'
import { Bell, BellOff, Share, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  currentState, subscribe, unsubscribe, updatePrefs, fetchPrefs, sendTest,
  type PushState, type PushPrefs,
} from '@/lib/push-client'

const CATEGORIES: { key: keyof PushPrefs; label: string; desc: string }[] = [
  {
    key: 'notify_prayer_daily',
    label: "Today's prayer times",
    desc: 'One notification each morning with all five times for your location.',
  },
  {
    key: 'notify_prayer_each',
    label: 'Each prayer as it comes in',
    desc: 'A reminder at every prayer time. Requires the per-minute scheduler to be enabled.',
  },
  {
    key: 'notify_masjid_events',
    label: 'Events from your masjid',
    desc: 'When a masjid you follow posts something new.',
  },
]

export default function NotificationSettings() {
  const supabase = createClient()
  const [state, setState] = useState<PushState | null>(null)
  const [prefs, setPrefs] = useState<PushPrefs | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const refresh = useCallback(async () => {
    const s = await currentState()
    setState(s)
    if (s === 'subscribed') setPrefs(await fetchPrefs(supabase))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { refresh() }, [refresh])

  const enable = async () => {
    setBusy(true); setMsg(null)
    const res = await subscribe(supabase)
    setBusy(false)
    if (!res.ok) { setMsg({ kind: 'err', text: res.error || 'Could not enable notifications.' }); return }
    await refresh()
    setMsg({ kind: 'ok', text: 'Notifications are on for this device.' })
  }

  const disable = async () => {
    setBusy(true); setMsg(null)
    await unsubscribe(supabase)
    setBusy(false)
    setPrefs(null)
    await refresh()
  }

  const toggle = async (key: keyof PushPrefs) => {
    if (!prefs) return
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)                       // optimistic
    const res = await updatePrefs(supabase, { [key]: next[key] })
    if (!res.ok) setPrefs(prefs)         // roll back
  }

  const test = async () => {
    setBusy(true); setMsg(null)
    const res = await sendTest(supabase)
    setBusy(false)
    setMsg(res.ok
      ? { kind: 'ok', text: 'Sent — it should appear in a moment.' }
      : { kind: 'err', text: res.error || 'Could not send a test.' })
  }

  if (state === null) return null

  const card = 'rounded-lg border border-gold/15 bg-forest/60 p-6'

  // iOS only allows web push for installed PWAs — say so plainly instead of
  // showing a button that cannot work.
  if (state === 'ios-needs-install') {
    return (
      <div className={card}>
        <div className="mb-4 font-cinzel text-[9px] tracking-[0.2em] text-gold">NOTIFICATIONS</div>
        <p className="mb-4 font-cormorant text-[15px] italic leading-relaxed text-white/60">
          On iPhone and iPad, notifications work once Green Emblem is added to your Home Screen.
        </p>
        <div className="flex items-center gap-2 rounded-lg bg-black/20 px-3.5 py-3 font-cinzel text-[10px] tracking-[0.12em] text-white/70">
          <Share className="h-4 w-4 shrink-0 text-gold" />
          Tap Share → Add to Home Screen, then reopen from your Home Screen
        </div>
      </div>
    )
  }

  if (state === 'unsupported') {
    return (
      <div className={card}>
        <div className="mb-4 font-cinzel text-[9px] tracking-[0.2em] text-gold">NOTIFICATIONS</div>
        <p className="font-cormorant text-[15px] italic leading-relaxed text-white/50">
          This browser doesn&apos;t support notifications. Try Chrome, Edge, or Safari 16.4+.
        </p>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className={card}>
        <div className="mb-4 font-cinzel text-[9px] tracking-[0.2em] text-gold">NOTIFICATIONS</div>
        <p className="font-cormorant text-[15px] italic leading-relaxed text-white/60">
          Notifications are blocked for this site. Re-enable them in your browser&apos;s site
          settings, then reload this page.
        </p>
      </div>
    )
  }

  return (
    <div className={card}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="font-cinzel text-[9px] tracking-[0.2em] text-gold">NOTIFICATIONS</div>
        {state === 'subscribed' && (
          <span className="flex items-center gap-1.5 font-cinzel text-[9px] tracking-[0.1em] text-forest-light">
            <Check className="h-3 w-3" /> ON
          </span>
        )}
      </div>

      {state === 'unsubscribed' ? (
        <>
          <p className="mb-5 font-cormorant text-[15px] italic leading-relaxed text-white/60">
            Get prayer times each morning and hear first when your masjid posts an event.
            You can turn any of it off afterwards.
          </p>
          <Button variant="brand" onClick={enable} disabled={busy} className="w-full sm:w-auto">
            <Bell className="h-4 w-4" />
            {busy ? 'Enabling…' : 'Turn on notifications'}
          </Button>
        </>
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-1">
            {CATEGORIES.map(({ key, label, desc }) => {
              const on = !!prefs?.[key]
              return (
                <button
                  key={key}
                  onClick={() => toggle(key)}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border-none bg-transparent px-3 py-3 text-left transition-colors hover:bg-white/5"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
                      on ? 'bg-gold' : 'bg-white/15'
                    )}
                  >
                    <span className={cn(
                      'h-4 w-4 rounded-full bg-forest-deepest transition-transform',
                      on && 'translate-x-4'
                    )}/>
                  </span>
                  <span className="min-w-0">
                    <span className="block font-cinzel text-[13px] text-white">{label}</span>
                    <span className="block font-cormorant text-[13px] italic leading-snug text-white/45">{desc}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" size="sm" onClick={test} disabled={busy} className="w-full sm:w-auto">
              Send a test
            </Button>
            <Button variant="ghost" size="sm" onClick={disable} disabled={busy} className="w-full text-white/60 sm:w-auto">
              <BellOff className="h-4 w-4" />
              Turn off on this device
            </Button>
          </div>
        </>
      )}

      {msg && (
        <p className={cn(
          'mt-4 font-cormorant text-[13px] italic',
          msg.kind === 'ok' ? 'text-forest-light' : 'text-destructive'
        )}>
          {msg.text}
        </p>
      )}
    </div>
  )
}
__GE_EOF_5d7c__
echo "  wrote components/NotificationSettings.tsx"
mkdir -p "components"
cat > 'components/ProfileTab.tsx' <<'__GE_EOF_5d7c__'
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { MosqueAutocomplete, MosqueMapEmbed, type MosquePlace } from '@/components/MosqueMap'
import NotificationSettings from '@/components/NotificationSettings'

const card: React.CSSProperties = { background: 'rgba(15,31,15,0.55)', border: '0.5px solid rgba(212,175,110,0.12)', borderRadius: '14px', padding: '22px' }
const sectionLabel: React.CSSProperties = { fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.2em', color: '#d4af6e', marginBottom: '16px' }
const inputStyle: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(212,175,110,0.25)', borderRadius: '9px', padding: '10px 12px', fontFamily: 'Georgia, serif', fontSize: '14px', color: '#fff', outline: 'none' }
const label: React.CSSProperties = { fontFamily: 'Georgia, serif', fontSize: '10px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '6px' }

export default function ProfileTab({ user, profile, campaigns, supabase, onProfileUpdate }: {
  user: any; profile: any; campaigns: any[]; supabase: any; onProfileUpdate: (p: any) => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    phone: profile?.phone || '',
    address_line1: profile?.address?.line1 || '',
    address_city: profile?.address?.city || '',
    address_state: profile?.address?.state || '',
    address_zip: profile?.address?.zip || '',
  })
  const [mosquePlace, setMosquePlace] = useState<MosquePlace | null>(
    profile?.mosque_place_id ? {
      name: profile.local_mosque, formattedAddress: profile.mosque_formatted_address,
      placeId: profile.mosque_place_id, lat: profile.mosque_lat, lng: profile.mosque_lng,
    } : null
  )

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const authedFetch = async (body: Record<string, any>) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Your session expired. Please sign in again.'); return null }
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Something went wrong.'); return null }
    return data.profile
  }

  const saveDetails = async () => {
    setSaving(true); setError('')
    const updated = await authedFetch({
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone || null,
      address: { line1: form.address_line1, city: form.address_city, state: form.address_state, zip: form.address_zip },
    })
    if (updated) { onProfileUpdate(updated); setEditing(false) }
    setSaving(false)
  }

  const saveMosque = async (place: MosquePlace) => {
    setMosquePlace(place)
    const updated = await authedFetch({
      local_mosque: place.name,
      mosque_place_id: place.placeId,
      mosque_lat: place.lat,
      mosque_lng: place.lng,
      mosque_formatted_address: place.formattedAddress,
    })
    if (updated) onProfileUpdate(updated)
  }

  const toggleSub = async (field: 'sub_greentv' | 'sub_greenfitness' | 'sub_greenworld_plus') => {
    const next = !profile?.[field]
    onProfileUpdate({ ...profile, [field]: next }) // optimistic
    const updated = await authedFetch({ [field]: next })
    if (updated) onProfileUpdate(updated)
  }

  const activeCampaigns = campaigns.filter(c => c.status === 'active')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* ── ACCOUNT DETAILS ── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={sectionLabel}>ACCOUNT DETAILS</div>
          {!editing && <button onClick={() => setEditing(true)} style={{ fontFamily: 'Georgia, serif', fontSize: '10px', color: '#d4af6e', background: 'none', border: '0.5px solid rgba(212,175,110,0.3)', borderRadius: '7px', padding: '5px 12px', cursor: 'pointer' }}>Edit</button>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
          {user?.user_metadata?.avatar_url && <img src={user.user_metadata.avatar_url} alt="" style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px solid rgba(212,175,110,0.3)' }}/>}
          <div>
            {!editing ? (
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '17px', color: '#fff', marginBottom: '3px' }}>{profile?.first_name} {profile?.last_name}</div>
            ) : null}
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}>{user?.email}</div>
          </div>
        </div>

        {error && <div style={{ background: 'rgba(226,75,74,0.1)', border: '0.5px solid rgba(226,75,74,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontFamily: 'Georgia, serif', fontSize: '13px', color: '#e87573' }}>{error}</div>}

        {!editing ? (
          <>
            {profile?.address?.line1 && (
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.3)', marginBottom: '5px' }}>ADDRESS</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                  {profile.address.line1}<br/>{profile.address.city}, {profile.address.state} {profile.address.zip}
                </div>
              </div>
            )}
            {profile?.phone && (
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>{profile.phone}</div>
            )}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {profile?.newsletter_opted_in && <span style={{ fontFamily: 'Georgia, serif', fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(46,107,46,0.12)', color: '#1D9E75', border: '0.5px solid rgba(46,107,46,0.3)' }}>Newsletter ✓</span>}
              {profile?.role === 'admin' && <span style={{ fontFamily: 'Georgia, serif', fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(212,175,110,0.1)', color: '#d4af6e', border: '0.5px solid rgba(212,175,110,0.3)' }}>Admin</span>}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div><label style={label}>First name</label><input style={inputStyle} value={form.first_name} onChange={e => set('first_name', e.target.value)}/></div>
              <div><label style={label}>Last name</label><input style={inputStyle} value={form.last_name} onChange={e => set('last_name', e.target.value)}/></div>
            </div>
            <div><label style={label}>Phone</label><input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 (555) 000-0000"/></div>
            <div><label style={label}>Street address</label><input style={inputStyle} value={form.address_line1} onChange={e => set('address_line1', e.target.value)}/></div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px' }}>
              <div><label style={label}>City</label><input style={inputStyle} value={form.address_city} onChange={e => set('address_city', e.target.value)}/></div>
              <div><label style={label}>State</label><input style={inputStyle} value={form.address_state} onChange={e => set('address_state', e.target.value)}/></div>
              <div><label style={label}>ZIP</label><input style={inputStyle} value={form.address_zip} onChange={e => set('address_zip', e.target.value)}/></div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button onClick={() => setEditing(false)} style={{ flex: 1, fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px', padding: '10px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveDetails} disabled={saving} style={{ flex: 2, fontFamily: 'Georgia, serif', fontSize: '11px', fontWeight: 600, color: '#0f1f0f', background: '#d4af6e', border: 'none', borderRadius: '8px', padding: '10px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </div>
        )}
      </div>

      {/* ── YOUR MASJID ── */}
      <div style={card}>
        <div style={sectionLabel}>YOUR MASJID</div>
        {mosquePlace?.placeId ? (
          <>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '15px', color: '#fff', marginBottom: '3px' }}>{mosquePlace.name}</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginBottom: '14px' }}>{mosquePlace.formattedAddress}</div>
            <MosqueMapEmbed placeId={mosquePlace.placeId} name={mosquePlace.name} lat={mosquePlace.lat} lng={mosquePlace.lng} height={200}/>
            <button onClick={() => setMosquePlace(null)} style={{ marginTop: '12px', fontFamily: 'Georgia, serif', fontSize: '10px', color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Change masjid</button>
          </>
        ) : (
          <>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', marginBottom: '14px' }}>Add your local masjid to see it on the map and, soon, community announcements from them.</p>
            <MosqueAutocomplete defaultValue={profile?.local_mosque} onSelect={saveMosque} inputStyle={inputStyle}/>
          </>
        )}
      </div>

      {/* ── NOTIFICATIONS ── */}
      <NotificationSettings />

      {/* ── COMMUNITY ANNOUNCEMENTS ── */}
      <div style={card}>
        <div style={sectionLabel}>COMMUNITY ANNOUNCEMENTS</div>
        <div style={{ textAlign: 'center', padding: '20px 10px' }}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', lineHeight: 1.7, marginBottom: '14px' }}>
            {profile?.followed_masjid_id
              ? "You're following a masjid on GreenWorld+ — new events they post will show up there and in your email."
              : 'Follow your masjid on GreenWorld+ to see their events and get notified when they post something new.'}
          </p>
          <Link href="/greenworld-plus" style={{ fontFamily: 'Georgia, serif', fontSize: '10px', letterSpacing: '0.1em', color: '#9b8ec4', border: '0.5px solid rgba(155,142,196,0.4)', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block' }}>
            {profile?.followed_masjid_id ? 'View local events' : 'Follow your masjid'}
          </Link>
        </div>
      </div>

      {/* ── ACTIVE CAMPAIGNS SUMMARY ── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: activeCampaigns.length ? '14px' : 0 }}>
          <div style={{ ...sectionLabel, marginBottom: 0 }}>ACTIVE CAMPAIGNS ({activeCampaigns.length})</div>
          {activeCampaigns.length > 0 && <span style={{ fontFamily: 'Georgia, serif', fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>See "Campaigns" tab for full details</span>}
        </div>
        {activeCampaigns.length === 0 ? (
          <p style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>No active campaigns right now.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeCampaigns.slice(0, 3).map(c => (
              <a key={c.id} href={`/give/${c.slug}`} target="_blank" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px 12px', textDecoration: 'none' }}>
                <span style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: '#fff' }}>{c.honoree_names}</span>
                <span style={{ fontFamily: 'Georgia, serif', fontSize: '10px', color: '#d4af6e' }}>View →</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ── EXPLORE GREEN EMBLEM (channel subscriptions) ── */}
      <div style={card}>
        <div style={sectionLabel}>EXPLORE GREEN EMBLEM</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { field: 'sub_greentv' as const, href: '/greentv', name: 'GreenTV', desc: 'News, fitness coaching & live community', accent: '#5a9e5a' },
            { field: 'sub_greenworld_plus' as const, href: '/greenworld-plus', name: 'GreenWorld+', desc: 'Local masjid events, all in one place', accent: '#9b8ec4' },
          ].map(({ field, href, name, desc, accent }) => (
            <div key={field} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: `0.5px solid ${profile?.[field] ? accent + '50' : 'transparent'}`, borderRadius: '10px', padding: '12px 14px' }}>
              <Link href={href} style={{ textDecoration: 'none' }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '14px', color: '#fff', marginBottom: '2px' }}>{name}</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>{desc}</div>
              </Link>
              <button
                onClick={() => toggleSub(field)}
                style={{
                  fontFamily: 'Georgia, serif', fontSize: '9px', fontWeight: 600, letterSpacing: '0.04em',
                  padding: '6px 12px', borderRadius: '20px', border: `0.5px solid ${accent}`,
                  background: profile?.[field] ? accent : 'transparent', color: profile?.[field] ? '#0f1f0f' : accent,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {profile?.[field] ? 'Subscribed ✓' : 'Opt in'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── QUICK LINKS ── */}
      <div style={card}>
        <div style={sectionLabel}>QUICK LINKS</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[{ href: '/sadaqah/request', label: 'Request a campaign' }, { href: '/shop', label: 'Islamic shop' }].map(({ href, label }) => (
            <a key={href} href={href} style={{ fontFamily: 'Georgia, serif', fontSize: '10px', letterSpacing: '0.1em', color: '#d4af6e', border: '0.5px solid rgba(212,175,110,0.25)', padding: '8px 14px', borderRadius: '8px', textDecoration: 'none' }}>{label}</a>
          ))}
        </div>
      </div>
    </div>
  )
}
__GE_EOF_5d7c__
echo "  wrote components/ProfileTab.tsx"

echo
echo "==> Writing icons"
mkdir -p public/icons
base64 -d > 'public/icons/icon-192.png' <<'__GE_EOF_5d7c__'
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
/wdkaR59GbxpogAAAABJRU5ErkJggg==
__GE_EOF_5d7c__
echo "  wrote public/icons/icon-192.png"
base64 -d > 'public/icons/icon-512.png' <<'__GE_EOF_5d7c__'
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
6vP+iyBTAAAAAElFTkSuQmCC
__GE_EOF_5d7c__
echo "  wrote public/icons/icon-512.png"
base64 -d > 'public/icons/icon-maskable-512.png' <<'__GE_EOF_5d7c__'
iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAg
AElEQVR4nOzdd1yUV/42/ufvjcIwDPYoCAKi2MbeQUV670VBwU7vZWCGYQaYGXrHbqLGFBM1vW3K
bpJvkk2Pib2LYotJNrvP7/nj+r3uM2LcfJPd7G4iyH398X5p9mUM980s5zrnfM7n/B+VWgUiIiJS
ycr/6e8vgIiIiFT3HQMAERGRWn4YAIiIiNTywwBARESklh8GACIiIrX8MAAQERGp5YcBgIiISC0/
DABERERq+WEAICIiUssPAwAREZFafhgAiIiI1PLDAEBERKSWHwYAIiIitfwwABAREanlhwGAiIhI
LT8MAERERGr5YQAgIiJSyw8DABERkVp+GACIiIjU8sMAQEREpJYfBgAiIiK1/DAAEBERqeWHAYCI
iEgtPwwAREREavlhACAiIlLLDwMAERGRWn4YAIiIiNTywwBARESklh8GACIiIrX8MAAQERGp5YcB
gIiISIYYAIiIiNTywwBARESklh8GACIiIrX8MAAQERGp5YcBgIiISC0/DABERERq+WEAICIiUssP
AwAREZFafhgAiIiI1PLDAEBERKSWHwYAIiIitfwwABAREanlhwGAiIhILT8MAERERGr5YQAgIiJS
yw8DABERkQwxABAREanlhwGAiIhILT8MAERERGr5YQAgIiJSyw8DABERkVp+GACIiIjU8sMAQERE
pJYfBgAiIiK1/DAAEBERqeWHAYCIiEgtPwwAREREavlhACAiIlLLDwMAERGRWn4YAIiIiNTywwBA
RESklh8GACIiIhliACAiIlLLDwMAERGRWn4YAIiIiNTywwBARESklh8GACIiIrX8MAAQERGp5YcB
gIiISC0/DABERERq+WEAICIiUssPAwAREZFafhgAiIiI1PLDAEBERKSWHwYAIiIitfwwABAREanl
hwGAiIhILT8MAERERDLEAEBERKSWHwYAIiIitfwwABAREanlhwGAiIhILT8MAERERGr5YQAgIiJS
yw8DABERkVp+GACIiIjU8sMAQEREpJYfBgAiIiK1/DAAEBERqeWHAYCIiEgtPwwAREREavlhACAi
IlLLDwMAERGRWn4YAIiIiGSIAYCIiEgtPwwAREREavlhACAiIlLLDwMAERGRWn4YAIiIiNTywwBA
RESklh8GACIiIrX8MAAQERGp5YcBgIiISC0/DABERERq+WEAICIiUssPAwAREZFafhgAiIiI1PLD
AEBERKSWHwYAIiIitfwwABAREckQAwAREZFafhgAiIiI1PLDAEBERKSWHwYAIiIitfwwABAREanl
hwGAiIhILT8MAERERGr5YQAgIiJSyw8DABERkVp+GACIZM5+hr3Q318HEanuKwYAIjkP/NPtYT/N
HsppSgYBIrW8MAAQyZQ0+Nt52kHhbgc7dzsopzIAEKlkhAGASIbEbH+aPWxcbDB50SSM8RwDxUQ7
EQr6+2sjItV9wQBAJEcz7KH0VEIxXoGgGD8sC10KG2cbKKdatwL6/esjIvzeGACI5Gi6CrZutnCb
PQErgpZgU3YqRk0aBbtJdgwARGp5YAAgkhlpgJdm+rbOtlgWshhL/RdgzeYUxKbFwGaCDZTTWAtA
JAcMAEQyJM30R00ehajVIfAN9YJv2ErsfmIrRk8ZDbvJXAUgUskAAwCRzEhH/mxcbeC50AOpmYlY
EbwES1YsxM597QhPDhWrAKoZ1pWC/v5aiUj1u2EAIJIRaVCXZvgObg5YEbEU63KTsdRvERavWAhT
kx46iwYjJ40UxwP7/nx/f81EpPpdMAAQyarxj0rM/t1muyA+LRxpmYlYHrAUC70XwNJmQPM2E1ZE
eFtXAdQODABE6sGLAYBIZrN/hbMCfpHLEJ8ahk25axAQ4YuF3ovQuqMOLdtqUVCRCZWbCnaeHPyJ
VIMYAwCRnGb/E2zgNN0R8anhiEz0Q2bhOgSErcQCr4Vo6KxFQ4cB7dvroPaaKf6sA7cBiDBYMQAQ
yWX272kHuwl28ApehLg14QiN9cWWglSsCPTGrPmzUN9hhMFSgp2PtmJzwUbYOivEcUGVmgGASDUI
MQAQDXJ9l/woJiow3H0Y/KN8EL8mFDHJIdicn4Zl/l5Qz5uFpm1mlBsL0LHDBFNLJcZMHSu2DPr7
6yci1e+CAYBIFgFABVt3Owx3dcCywEWISPRHTHIwMgrWY5nvUsyaPxP1XTWoqiuFpVkLjSEfY2c4
WQPAzP5/BiJS/eYYAIhkEwAUGOE+HCtDliIkeiWConywJS8N3r5LMHPuDFQ3aqGtyUNLdxW0pkKM
ne7IAECkHrwYAIhkFABGe4xCWHwA4pLDEB7rh7SMVVi6cgmmz50BvbkMheUZaGo3QFtbDEeuABBh
MGMAIJJRABg1cRSCYnwRlxyCsFhfpG7pCwBqVJlLUVVfhG2PNqHSooHjjPEMAETqwYsBgEhmKwB+
EcsRGu2LwMgVSEtPgpe0BbBgJgx1Gmiq8tC+zQxjYwWc57pauwYyABBhMGIAIJJLAHCzxcOTRyMo
eiUiE4MQEuOLNZsS4OW3FLMXzUaVpVycAqitrxDFgB6LPe4EAId+fwYiUv3mGACIZBQAxnk+jLB4
P0QlBCMszh+pW5Lg7bcEc5bMhbGhAvWderTtNMHYqMFUr6ni6GDf39Hfz0FEqt8UAwCRbAKAQgSA
iPgAxKwOQ2hcANanp8DbzwvzvOfD3FKJypoiGE2lMLfqMHPFTAx1HgqHaQwARIMRAwDRICcG73sC
gFQEGL82CuEJQVifuQbeft6Yv2wBTM16VNdpYGnSoa7TiLkr52Koow0cpg6Dcrq1mVB/PwsRqX4z
DABEMgkACncFHKeOg2/oCoTGBSIyKRibctZhmf9yLFi2COaWKhgsGlhaKlHXbsAc3zkY4jQUqqkO
UE5XMgAQqQcXBgAiGQWA8WpHBET6IDBiJaKSQpBVtAUrApZj4bJFqG3Wo9JUCmNdOaqbKzDbdzZs
XW2hmq6C/XQO/kSqQYYBgEguWwDuCkyY6SwaAQVH+SEsLhC5JRnwCVyOBd7zUW4sQoWhAFW1xdCa
ikQAUExSwEHtwNk/kXrwYQAgktEKgPucCWLgj1kdivC4QGTkbxRFgAu8F8LcrBezf4O5BPr6Yszx
n8NjgETqwYsBgEhGjYA85kxAULQvIuICERLrj/T8jfDyWSICQMcuMzp2W0Qr4KZuIxaHLhLHAKUV
gP5+BiJS/eYYAIhkEgAUdwKAf8QKhMb4IywhEJkFm7DM1wtzl8yB3lyM+rZKtG2rxc69rQiI94ON
s41YPeAWAJFq0GEAIJJLAHBTwGOeOwIiVyImKRxRSaHIyN0I75VLRSvgwopMFGjSoavOxyMHOhCd
EoEh44bAYTprAIhUgxADAJGcVgDmuiM83h+xq8IQGOGLzXnrxQrA1FlToa0tQakhF1tyU9HaVYu4
tGg89PBDULEREBEGIwYAIlkEAHuxn+8+2wXLAhbCP2wZfEO9kVEgBYCl8Jg+GTqTBoZ6DUoqs9G9
pwGrNsb9VwGg77/bp7/fAxGp/gEDANEAdO+g6SC5U4n/nw6k0gqA3UQ7TFk8Cb6hyxAS7YfIpBDk
FG/GMr+lcJ/qgUpLKaobylFZU4g9j7UjNWO1CAD2U//9AVx8/VL3QKl/wHTpGRzEczAIEKkGDAYA
on7WNyj+46A/zDrz9rSH3SQ7q8l2UE5VWgfWf2Mglf6scppSBICZ3lMREu2LyIRgRCQEIbNgI5au
WAzXSa7Q1RShsqYYWmM+dh9oR3rRRgxxtIFyivLffh7pv6fwUGDo+KHiPgFbd1vx9zjcCQM/fV4G
AyLVfccAQNSP7i6RS4P+DAeopjtAMclOdOCTCvAeGv0QhrsNw3Sv6ZjmPQ2qySprCPh3AoDaHsqp
9lC6KjFv+SyExvojZlUowuMDsSV3HRZ7L8CESRPQ2FmNutZKlGiz0LmzAXkVWbB1UsDO0+7ffiYp
rIyd9jBWb4iDf6QPxs9who2jjQgEUhiw81TeXRngFgGRql8wABD1A+sSucp6xG6aSsyWxaDvOAQK
RwU853ogITUG1bXlaGwwQGcoRsTqMAyfPPzfmpH3hQu7yUrYOdth0cr5SFgTjsS1UYhICMbmvHVY
6L0A491c0LrNhK49FlQY89HSVYt8bRbsXJT/VgDoW/qXnsdp+jis2ZQEo1mHrh1tsDTXIDU9BTO9
Z0Ll6nB3ZUAKC31bBX1HDhkIiFS/OwYAovvkx31xaRZv/w+DvoOLCjOXzsC6jGS0d5pwYH83dmxv
RllFLoKifOA6ZwJGTBoO+8nW5fVfO0CKPzfdHspJSiidVVjiMw/hsf6IiA8UHQEzCzdg8bKFcHId
D40+D0ZTCTSVWWjdaroTAOz/oxUAqW5AMdFO9BEYP80R/uE+KNXkYueuDjz1zH50bm/CprwNmO87
DyMmDhdhwGaCjdimkFY4xP0DDAFE+D0xABD9ju4OYmKmby9660sDna2LDcZ4jsFiv0XYlJWKrq2N
ePa5J7B//1aU67IRErMS7jNdoXC2/nmpBuA/3f+XAoCdhxIqFxWWrpyLwPDliIwPRGxyKDLzN2Dp
skUY7+aMMn0OjJYi6GsL0bWrEUVVebB3U/1nAaCv7mCKnTh9IC39K8fbYdJsd4RF+6FcV4C9+3bi
yLOPo72rAalbUrDEbxEenjQWNk42IhjdXRn4Sb0AEal+EwwARL+DewcrMRv2UIjZ8HD34Zi3Yg42
ZKWhfWszXnv9Obz26iF0dTcidX0ipi30xDA3B9i42MDW7Z5BcMaPf++/HQCkEwAeSjhMcIC330KE
xwUgLjkc0UkhyC7ciKXeC+E4YbzoBFjTUIaa+jLsOtAKTW0JhnkM/7cDwL3P3/fft5+qgt0kJWzc
bGHrosBoj9GY5zUbaetXo6GxGgef3IfnXngG23Z0Ii09FdMXT4eDq+puzYD0Du8tHuzv7y+RahBg
ACD6jdwdnGdYC/qkQjdp9i4V8zlOd0Tk6jA0d9TjldeO4PXXn8Njj+2EvrII4dF+cJ3uDDsXO9hM
sIXizqAvHd37b2e+9waAYa7D4Be+AnEpEeIyoLC4AFEEuGTZIoxxGoeK6gLUtWpRVVOIlu5aVJhL
MdpzzH8UAH7p6xBL+yIQSdsDtlBNUMFjtrsoTNRqC/DY3m144fmn8ezzh9DQWofwpAiMnTxWvEMp
EEn1EsPUw7giQKT+7zEAEP2GA780wEmzdmkGbzNuKGYsmoqCskwcPLQPf/noT3j7jRfwyO525ORt
wDL/hXDyHIuhTrZicFNOkf59a43AbzW4/eMKwDD4hHojcW0k4laFIjTGDxuz1mKJ90KMdhyDwvIM
NHVVwdyiQ2NbNapb9Bg3w/E3CQD/62uSCv6mSacFlGK5X9rqcJvpAr8QL+TlbEB7qwUvPvcMPvrL
+zjywhHkleVi4lyPu0FAqqGQQhaPEhKp/mMMAET/hXs73YmBX9rfd7LFTK8ZKCvPwSsvPoXjX36A
d956Hl0ddSjM34jQCF+4q12gcFGI9ryqaQ4/zo5/40HspysAS1bOFwWAMUlhYtYtBYDFXgswcuxo
cQ9AZW0RGjursH1vM2paDXBSO/3mAeCn7036Z2lAFzN8N3tMWzQFweE+yNySgkaTDq8/fxhnzhzH
G++8gbKqQkxZ4AmbO6FJWk24990xBBCpfjUGAKL/wI+Fbj8O/NKe9RyvGSgs3oJnD+3DZx+9jbdf
fw6dLbXIyU1FVEwgPGe7w95FKVYIxCx25o/L2b/H4PVjALDDyIkj4OW7QCz9x64OQ1h8EDblpGHh
kvkYNmo4irU5KNPnorQyC+3bLKj9HQPAz71LaY/fbopSDOzDJjpg2oLJiI0JRH5WKuqrK/DH117C
mbMn8PZ7b6GsshgzlkwTIcrG1QZKqa+A1DhJzQBApPqVGACI/sPjfH0Dv8pNhcV+C5BdsBGdbSa8
+OxjePn5J/HI7g6Ul+UhOiEY0+Z7iIY+0sBvN1lx32asfQFAqsQfM2k0VgQtRWD4SkSvDkHM6nBk
5G8QAUA13AGllXkw1mlEI6DK6iKY2qvhOtf1dw8A//C1ii6IUv2E1AxJgVEeo7B4xVykpcahSpeP
be1NePuPL+Pc6eN4689/hMagwSLfhVA6KUWRZd+KAFcCiFT/EgMA0a91ZzCVZptiqX+8LeYum4W8
4kx0djRg/95t2LenEy31BjHwr1mXIFYEhrsPg52bnbW4b9r93a++GwA87DBm0hiEJwQgPiUCQeHW
dsDZBZswb9EcKByU0FTlw9Kqh85QBEOtBg3bzPBYPOm+BYB//JrvhKxJdlC4KjBy4kisDFqCspJM
1FVrsLOrGX/5n7dx82Yvvjz6OWosRkxZMMXaSGmi4k6TJW4JEKn+CQYAon/hHwr8JtmJQrRJc9zF
4LlrRxse3d2Fg0/twWOPbkO1sRQbNq7C8uAlGOkxQlT1S2fhpYG/P/aof1wBsMPYyWMQHO2LxNRI
MfhLjYCyCjZgzoJZsLFXILc0HZYWHRra9Ojc1YjOvW3w9Jp83wPAvV+7OA1x59SAOE0xeSxWp8XA
aCiFQVuExx7dgZ6LZ/HD377D2++/hZQtKRjhNkKstNj/TKEgEanuYgAg+hUV68rJd5aYne0RFuuP
Pbvb8cLhA3h87zY889Sj2Lu3G7ryPCQmR2HiXDfR2a7vDP+/27zn99oCcJw+TpwCCAxbiYj4AEQn
hWFLzlrMmDcdNg62yCxcj5LybJRoM2Bu0qJ5mxmTltz/FYD/9Qx3igRVUx3EiQGpUZBvqBeqa8qg
0xSgxWLA/7zzBr7/7hvc/u42du7djtnLZmGo41BroaBYDbAGgf7+PBGpBhAGAKJ/VuQ31V40r5H6
6M/1ngmdvgjPPL4bBx/bgQOPdOKpJ3ZiW2c98nM3wS9sOUZ6jBRFaff2te/v5+gLAOPVjgiMWo6o
xGCExQciKjkM6zJXi3sHhg63RV5FNurbq1BckY2cgk2o76yGesV0serRdx1xv30vpHbGd/b3Haaq
MNRpKCbPdkN2znrUVpWhVl+Kxx/bhVMnvsL3P3yPDz5+D5mFGXBXTxArB6ITIk8KEOFeDABEP2Ed
JKy37kkzeUfPcVi3cRV2bW/G4cd34cm9W/Hkvq3Yt7sd7S01SM9IwYzF06FwsYPtRNu7s82BMNjc
uwUwXj0OvuHLEJkYhIjEEEQkhSBlUwI8ZrlhyHAbZBRtQMu2WjS0G6Ex5GPHY51YFLRQzLrF9cT9
+v24l9RDwAFDXYZCNcEeAaHLoSvPhdlYhpb6arz+6vO4desart/oxVPPPImIhHAonGxh4yodG7Re
vtTf3xci1QDAAED0c7fZTVSIgrLZy2bCbNHi6QO78MyTu3Hk4KNi9r+zqwENdZWITw7D2CljRFGg
GFwGwKD/SysArrPGwzd8OQKiVlpXAFaHI2VLAibOdIXNaDuxGqA1FqCp04iaeg0OHN4DnwgfMdse
SJfz9H2PRLdFqaOgk404XpmRuQaW6lJUluZhz44OXLpwGv/v//0dx058hep6I9xnu4vVAKmIs6/L
Yn8/C5GqHzEAEN17tG+KtcJf5eKApNQY7NrVikd3tuLwU7vx0pHH8cTerehoMsFsrsCK4KVQTlCI
wXWgLi/fGwDcZ09AaJwfIhKDEBCxEpGrQrA2PRFu6gmwG6PEhuwUrE9PRqk2C/raYjx2cBcCY/zF
oDmQAsBPn81+ir0o+pNuVIxLCkFbiwFaTR7qzXqcPPYZ/t/f/4YbN67j7XfeRGxyNGzG24gVEfFM
/VifQaTqZwwAJHvWwd96WY002504yxUVugI8sW8b2htrsKOzAU/u34qulhpxxK/WUo7Z3mpxUY3U
738gDo4/FwAmL3BH1OpgJKVGIzo5DDFrwsUWgMv08SIAFJRnoFyfh0JNJiqM+dh3cCdCE4IGbAD4
8Xtnb71pUTopMHYI/EO90NxchSpdAaorCvHJB3/G//373/HXv/4NJ8+cRGF5AUZPHn3npED/PwOR
qp8wAJCs9Q3+0j63/Xh7+IV6o6nZgP0728TM/6l927F7ayPMVWVotOih0eZg4mxXURsgFaUN9M5z
9waAifNdEZ4QiPiUKKxaH4u4lEjEp0bBaYojbEYrkFm0ES1bq2FprhSFgHsOdCJ6TaQIAH3HGAf6
c0qB7KGHH8LspTNQUZ4Pg64I2uIMvPbiYXx3+xt8/+236Ll6Cbv37cBMr5ki8EmnNfoKNgfyMxKp
fmMMACRbYvC+M/iP8hiJ5LR47NzahEd3tmBXdxNePHIA+3e3wViRj5qqYqSuS8AYj9Fi8JfOmD8I
g0Vf0ZythwIe890QFOuL2JRwJKyNQtzaCCRuiBUBQDFWgU1562Bq1KF9uxl6UzF27W/Hqo0JGOIo
Pa9ywD9v35FNaUtg6HgbcbnQpvQUGKuKUF6UiSNP7seN3sviuOC3t2/gzT+9gbCkMCgnKGE30Q4O
0x2sVy8PgGchUt0HDAAkO3erye8M/i4znZGVuxFbOy3Y2mFGe2Mtnn36Eezd2YYqTS6qdHni5jyH
CdKfly7veXD2jvsGRVs3BaYs8kBoYgAik4IRGhuAmJRwrNoYJ7YAFGOU2JK/DuWVeTDUlqJYk4Wd
e1uRlrNGFNlJJyIelOcVg/g06zM/PHkM1qyLQ4NFD0NFAR7bsxVXLp3DDz98i29u9uLTTz9EfnmO
aJMsben0hYAH4VmJVP8lBgCSFTFATFNa2/m62MBz4WTR/Kaj2YjO5hpsbTfhwCNd2L2tETX6fNTX
lSE4ejmUrnbi6tqBuhf+z5/XHgo3BWatmIHIhECExwWIrYDYtRFYLQWAGeOhGKtEoTYb5foC6GuK
UNOkwZ7HO7G5YL043vigBIC7z3xnS0A6ljnCbRhWr41BW4sJlZp8dLWY0HP+FP72w7fovXwW588c
w/Y9XXCbMUGc/HiQAh6R6r/AAECyYR0YlNZiMUcbLFgxF/qqEjTXVaK7vVYs+0uFf4/v70J9dSk6
22sQFh8AW2dbaze8B/DoWF8zI+nWvFne0xER7y/6AIRE+4kVgJSN8XCe5gibMXYo0ReitlGHoopM
FGuzsPtABzJLtoglcikAqAZ4vcP//l5bv14pBNg7K5GQHIXGJiPKy3JhMWhw4qtP8f23N3Dl4hnc
vH4FL7/6IuZ5zxUhQBwV5HYAqQc3BgCShR9nhAprO9/4IDQ3G9HSoIfZUIq2BiOePbwXhw/uRleb
EZ0d1WLwH+os3d734A7+IgBMsYfCWYGZi6YgONwH0UnBiIgPQkRCCOLXRGD8nSLAEl0eGjqMKNFm
Y92m1WjpNKO4Mhf2btamSA/s912EAAVUzvaISghDQ10VykuyodfkihMC39++ht7L1hDwwV/eQ2hc
sGj7LE543MeLm4hU9xkDAA16fQOhWA52H4aU9fHYttWC9qZqNNfpUV9bjkd3tePIM49iR7cZnR1G
hCbcmflL/fwf0AFAPLdaBYWnEkoXOywPWoTI+ECERfkhUqoFSAxF3FrpFMA42Awfii2562Cqq0BV
TQkKNOlo314PTXURHDyGPbAB4N7vv2hp7OqA8JhAmE0VIgTU6Irxwbt/xLe3enD98mncuHJBhIC4
tbFQTFBYt30YAkg9ODEAkDwGf3dbjPEcjXXpq9HeZER9TQU6W2vQ1mDAgUe34rlD+9DVWo2uDpNo
liN++Hs+uIP/vaSBT1rGXxG8BBFxAQgKXwH/0OVI2RSP9ZkpcPR0xNCRQ7ElPw0t3Ra0b7WgRJuL
1u0WVJhKMXzyiAc6ANz7OZB6PUjFnFEJIaiv06GyPA8mfSk+eOc1fH+rF9d6zuLalQv46NP3sWZL
CuxcFGI7oO/v6O/nIFL9hhgAaNC6ewTO3Va0692ctRaN0pJ/tQZNlko011Xh8QPb8MoLT6GzzYxH
97QhMikIti62UE5RPpDL/j9HIc18J6jgE7gYIZG+Yv9/uf9SJKyNRlpWCh6ePBoPjR6CLYXr0ba1
Hrv2dqCqVgNLUyWq6jUYNWX0Ax8AfroSoHKxx6rUGDQ2VIkQUKMrwmcfvYP/7+/fobfnHK5euYAv
j36GTfkbYTN+KOynqOCg5tXCpBpUGABo0A/+IyeOwPrNSWhsqER1VQma6irR1lSFHd1NeP3lQ9i/
uwPPHNiBTVkp1sHf01ov0N/P8FtRTFJgmKsKKwIWIyLWH3EpYQiM8EF4bBBiUyJEb4OHxjyEtOw1
MDXrsOvRNnTtbEZDWy30dRqMmT5mUASAvs9F3+kAqSYgZV086uv0KCvJQm1VCc6dOoa///1b9F65
gKuXL+L0uZPYUrgZivEKKKUbBXlCgNSDBwMADTp9Z8GlwV/a809aEyl+uOvL89BgrkBLgwHtLSa8
8sKTOPzkI3j+0D5otbmwH6+0LhHfmen193P8VhQeCgxzd8DKkKWIiAlAWEwgwmL9ESUdBVwdijEe
IzFk7FAkbYpBoSYdpjotdj/WKVoBV9VX4uEZDw+aAND3+ZB+lT4foz1GYu3GJNTXV0FTnI0msx4X
zhzHX7+7hd6rF3Dl8kWcOHUcuWW5GD5hGGxd7aC6c+lTfz8Hkeq/xABAg3bwHzVpJDakJ6GpUScq
vqvK80QQaGuuxovPH8Dzh/fj8MFHUFOrwcPu0o1+0lW+g++HuxQAhrsPh2+YN+JTwkXlf3hsAKJX
hYj7AEZPHina/UanRqBIm42KqiJUmTXo3tWKmuYqjFWPtW6JDLLPiVgJcLOFywwn5BWmo6XJBE1J
NrZ1NODK5XP49vZN9PZcxLWrF3Hm3ElUVJVjhNsI0WBI6gfR389ApPovMQDQoFz2H+bqgDXrY9De
WImWeh1aGrSwGEth1BZi755OcbXvk/u60NRigMdsN9EF7kFp7/ufBICRHsOxPGAxQqJ8ERYbIH6N
XxOJ2DWRGDVplAgAMesiYWgoQ0u3Cca6cjR2mNC5sxkus13ENsJg/LyIjoEuNkMoCrwAACAASURB
VJi1aAaMhnI0N1SjSluIg4/vxq0bV8TRwOtXLuDmtR6cv3AWhRUFULpIK0V2P/4dA+BZiFT/AQYA
GlwzOndbqCbYI2FVOExVxWhr0qG90YCOpio0W3R47JFOcbXvzs4G7NjWiEV+8629/Qf4ZTf/bQAY
5TkSfhFeiIgLQkRSCPzClyMiMRBRycEYOWmEaH4TvS4CJbp8VNdXQGcqhrFOi6ee248pS6Zar0ie
Mbi2RgQpNE61x5BxQ7Ei0AtNjdVoMOth1Bbhj689i9u3enH6+FH0XDyD61cv4eTp40jLXGttFjTl
znXEg+2dEOSCAYAeeKLZzXSlKOyyG2+LhOQwMeNvqClHq6USW9uq0d5gwOOPbsXLzx1Ad6sZ+x9t
R/yaKNiOt1b8D+Yf4lIAGDftYfiGeyFmdShiUyJFI6SolDBErQ7FSA9rAIhMDUWZMR+62mLkFG1E
XlkGjrz0BOb5zLWGpEHYGa/v+27vaS+uEo5dFYGOVgtM1RrU6Evw0f+8jd6e8zj29Se4evkMrvde
xPETXyE6JVq8M+niocFUMEoqWWEAoAeedKmPdGZ/yMNDEBy5Em2NBjSbtehsMaK9wYjWukrs6KzD
C4f2Y9fWJuzf047i0kwMdxtuXTEY5Pu5UgAYP8sJK0KWICDcB5HxIYhMCEZSWgzi14Rj5MRhYjAL
XxMKTXU+9LUlKK7IQmlVDg4+uw8LfRdYt0gGaUiSnsthhgOUk5Ri9Sht4yq0tNSgqrwA9SYdThz7
DOfOHMepY1/g6qUzuHH1Ij794mMExgTCZrzNnaJArgSQ6oHDAEAPtL7LbqQZ6hKfuWiwaNFSp0d7
kwEdzdXoaq1Be6MRhw/uwcHHd2Df7nY0NOkwcbaruAzIftrg/8EtBQCX2eMRnhSA8LggxCSHIzwu
EKvXxyEhLRoj+gLA2lCU6nNgMJeiylIKXU0JDh7ZiyUBiwd1AOj7HEkzeenSpPFTxqGwIB3tLWbo
KwpFUeCFs8dx+sSXOHvyS1y9dBrXey/jjbf/CK9AL3H1sDgeOIjfD6kGJQYAevAr/l1t4THXHZVV
BWhtqEJnsxEdTUZ0ttSgwaTF3t2tePHwPuzf04nurWbMXT5LDP7i6lcZ/NCWAoDTTCcEx/ohPiUC
sasjEBkfZF0BSI2Gw0QHEQBCVgWiUJuBnKL10BhyYG6pxJOHH4FX0BLrFsAgf1d3r06WLk5aNB3V
NRq0NpuhKy/A4/t34dzpr3H00w9x4cwxsQpw/XovDj9/GNMWThOfJ9YDkOoBwwBAD/DgrxKD/yj3
EcjOSUNbsx7tjdXobjWJa307mg3obKnFC8/ux8EDW/HY3g5Ergq2zman9f8z3M8AMGH2eFH4Jx39
i0+2BgCxArAuBsPuBIDgpEDoG0pRWpmN9RmrkFu6Cfuf2gGf8OWDfgXgx8+UtShQujwpKNIXLc0m
NNUZUKUrxKsvHsbxLz/Fl5+9L+oBbl67gm9u3sC2PVsxdspYKCYqRA+J/n4OItWvxABAD6bp0sBm
B4WjHWITw0R3P6nH/7ZOCzpbzOhqqxEX/Rx6ag9eOLwfj+/tQnllHoZPHGk90iaj2ZoUACYucINf
xAqExviJToAhEb5YvS4Wq9fHiiZBIgCsCoK2pgw1jVpoa/KxKXsN9j6xFSEJgdYAMAiLAH8pWEqf
kVGTRmBTxlp0tFlg0BajwVyFLz/7EJ98+B6++OxDXO+9hBvXruLq9SuoqCmHraONOB5oP4MhgFQP
BAYAeuBIN9xJR7CGOg2Ft+981NeWYWuHGdu7G7BzawO2ddSJMHDg0S78+Y0jOPTETuze1Yx5y2fL
cqlWCgAeC90RFOOD6MQgxCWHITw+AMnr45C0IRYqV2sACE0JQW2LDrVNFTA2aFBSmYP9T+9E5Nrw
O6smSnl8vu7UA0hHH6fOn4zq6lK0NhpFf4BnDz2Gi+dP49O/vI9TJ4/ixvUeXL9+FafPnkTS+kQ8
NPYhcTKA7YJJ9QBgAKAHb4Y2VSUG8inzPFCpzUNXczW2d5qxY1sDulpqxd7/9o56vPHyM3j2mUfw
1OPbkbopEbbj79zsJrMfztYAMBGB0SvEdcDRiSEIjfVD8oZYJK2PEZXvUgDwj/dFQUU6jPWlMNRp
UFyZjb1PbkP8+jhRA6CUSQC4GzKnWkOmf7gPGhsMsFRXoFpXjI8+fAeXLp7BZx99iLOnj+FG72V8
c6MXn3z+MVaErBDvku2CSfUAYACgB4u07+9ui3GTxyI3f6O41Kez2brv31JvQJsoAqzB00/uxpuv
HcZzT+9BQ2MlnKaNg+1EBZQyG/z7AoDn4omiD0BIpA/ipS2ASF+s2RT/DwEgcm0YNuesRV7ZZlja
dNAYC7DnQDdSMlaJwCWrAHDnM2K9SMkBm9LXoLPFBL0mT2wxXek5j9MnjuHrLz7BhTMncOt6D25/
cwPPv/I8Js+bbG0XPBgbJxEGEwYAemCIq1wnW++2T1kfIyr+m+t02NFlwY6uOhEAWur1YhXg1Ree
wkuH9+HFZx+Df4TP3cI/2V3nKh1t81Bg0kI3+Id7IzDMugoQFOGD5PXSCkAs7O8EgKi1YWL5v0xf
gMraElQ3abHn8W6kZqfAdoJCVgHg3v4A0urHjAVTUVNdho7mGpTkbcLLLzyDWzetXQJPHvsCF86d
FNsBV6/2wNhQLd6pnbTaxCZBpB64GADowen2N0Upfhh7BSxAS3Ml2puNaLZUorGmAq31enH8r7ut
Fs89sxfvvvkc/vT6IRRX5MB+gjSTs5NFEdtP35kolnS3hftsFwRGSoN/EKISQhAe64fUTQlIXBdz
NwCEJgWhod2Alq1m1DTooLeUYd/BHdhUtB4KV3kGADGAT1FB4Sh1mIzE1jYLanVF0Jfl4ezp4+i9
chGnjn2Jr7/8FBfOn0JvzyV8ffwoopOtnQLlctSUVA8kBgB6YCqzbVxsMWmOK8orMtHWqMe29lox
6DfUlotrflvF/2bBW68fwduvPYPde9owZeFksWUgx05tfU2SFC4KTFngAW+/heISoKTUKBEEVqVF
IyY5DEoXawAIjPeFrqYUDW3VMDVrkafJxJ4DW5GtyYSdm53sAkDfO3S4UxA4caYbqnRF6GqzoKQw
A0/s34VrVy7jzKnjOHb0Mxz99GOcPvk1bly/gmdfPILJ8yaJY6qD7XppUg0aDAD0QNzwp/BQir3Y
9RvixeDf3VqLzoZqtNbp0WzWobVBjwZTBQ4e2IHXXngSRw7tFefc+2756+/n6Bd3Vk2kM+3zls9C
QOQyrAhcIpb/fYO8kLgmUtwFIN1uN2T8EPhEL4fGmA9Tkx6VNWUo0uZg1/4u5OlyoJxoL8sAID6D
Ut3IFHvYOtoiLDoQHe0WWEw6GCqL8elH76Hn8gUc++pznD55FMePfoazp77GlauXYGw0WrcCpJsD
uRVA6oGHAYAG/gxsuoMYyJf5L0R9rUbM+rd3WtDVXIPWuio0mnRortNia5sJb792CK+//BQ6uuow
Yaaz7JuzSPvQUs3EopXzEBLlB7/QZeK+BN9gbySmRSFqdRiUzlIAGArfmOXI12SI2wDNLVXQ1pai
e1crciqyYT9RJd8AcKdBkMJdAaep41CmyUF3ewMMumLs3dONnotncfrkMZw6+ZVoF3z0s7/g/JkT
OHf+NOLTEngqgDBQMQDQwB781Q5iEHee7oji4i1osVSgu7UG2zqkwj+LKPqTZv/1NRV46cjjePvV
I3j22QNISIsRoUHuPdqlokmpyt87cJFoAuQftgyBET7wC/VG7OpwRElbAM7W2gr/OB/ka9KRXbQF
ekspqsxlaOmqQ2bZFqg85BsArJ9FlSgilU5DBESswK6drWhuqEatQYOPPvgTrlw+hxPHv8T5s8fw
5Wcf4YuPP8T1az146923MGXhVNi42rA3AGGgYQCggWuGdQCT9rCjk0JRV1uKFku5GPSlC37qjeUw
V2tgqS4Tt/y9/+4rePXFg+joqsd49fi7s397uQcAd3t4BS5EeFwAgqNWIiRqJVYELkb8mgjEpIRb
awCkABDjA3OTVvQAyCnbjCJtJurbDMjUbIFqkoOsA4BE+hyJq5U9x6DapMHuHa2o1ORj7+4uXL96
AefPnsCFsydx5uTX+OKjD8URwe++vQVzs0lsBSgmy68QlVQDGgMADUhi0J6mEjPTBStmo6oyHyZD
MZotOrTWV6KlvhImQxnMxlKY9KV4+dkn8OZrh/Di808gITXWOvufLu/Zf18AcHC1xzwvNfyCvMX5
/8iEAKzwX4yktCgkpEbAXgoA423gE7MclhY9tj/Sgvq2amTkrYeuuhiFlbkY5jmcAaDv5klpuyTY
C13t9aiv0cKgK8QnH70nWgNfOncaPZfO4eTXX+Lzjz4QxwO/OvYlfCP8uSJFGGgYAGhgkgr/Jirg
OPVhZGevRX1NORrNFWgyadFk1qK1SY9GsxamqhIx+3/3rZfx6gtPY/vuNjhOcxT/rtxa/v5iAJho
j0Ur54grgBPWRIpOgCuDliI5LUZcB9xXA7A8arm4B6C124Ktu5thaa6CqbEKRYY8DJcCwFSl7N9n
X1+FEW7DUViSge1dDdAUpWP39lZ8c+sqei6dR8/l87h04TSOH/0cX3/+F1y7egk79+/GmMkP3y0I
lP17JAwEDAA0QBv+KGHrZIuA0GWo1heJwb+jxShu+JMu+ZEK/xrN5TAbyvD8of14/eVn8OZrRxCb
EiHat/Y1/envZxkIAUC67W9pwAJErQoRFwDFJIbCJ8gLyRvirAFgvDUAeIcthc5chtZuMxpaa9DU
XovmLhO05jKM9Bwl/i65v9O+gkBpNr/UdwE62mrFXRRl+Vvw+Wcf4JtbN3DpwllcvXIR165cxImv
vhDNgsRdARuSxL/H3gCkGiAYAGjgNfyZZi+KrTzUrigu2IS66jJ0tlSj0axDbWWxCANSHUCdsRxd
LWa8/tIhvPbS09i6oxljp1qvZZXjuf+fIw3aY6aMgnfAQqwM9EJg6ArEJgYjMGIF0rYkiUZAdiIA
2GBp6BJoqgvFoN+2rU782tBRg+atFrGqYu2nwEK2vlWAMZNGI69gE3Z01CMvPRV7drbj9rc30dtz
EZfOncHlC2fQc/EMTp34ElevXMChFw5hwmxXa23KTIYAUvU7BgAaUKTZlbhS1VmJ1Wui0dZUDYuh
XPT4b6itQKUmFwZdARpqNWL2f+CRbrz24tN49aWDCI8PvTP75yB1bwAYN/1hhMSuRFiMvzj+F5UQ
iLAYP2zMTBZ3ASjGK+4GgBJ9LmrqtWjdbkZjdw0MpjLsfKQdE2e7i2Y4rKv4scOijbMNfIKWoLXR
AHNVMQqz1+PoFx/j9q3rYvA/f+YkLl88g9MnjuL8uVPouXoZWcVZGDJO6hA4TITU/n4WUskaAwAN
vI5/E2wxZY4HjIYicdlPW5MBLRbrcb+mei1qDaUwVRahyaLFS88ewJ/feA7d2xvFUUGx9z+9/59l
IAUAJ7UTwuICECtdAxwXII4DhsX6IyN/HVZvioGtkwJDnW2wNHwJSiuzUF2nQWVNCTT6fGiNBdj7
RDemLvC8GwD6+5kGgr7jqa4zJ6CiPEccTS3ITMUTj+3B7W+u48a1HvReuYCrPRdw8fwpXLxwBt99
dxvvvv8uZnnNEuHBQS2FAHmHKVL1KwYAGjCkGZFSdFyzQVRMAGr1hajVl6DBpBU9/1vq9NYwUKeH
UVuA7jYL/vjS0/jjK09j3ZZk2DgNFZ3v+EP1pwHAEUGxKxGVGILIuCCxEhCVGITc4i1YvTEeNo62
1hWA8MUorMgQ9wFUmUtR3ViGUl0eduztwPQl0xkAfkLpaS+OUEorVR1NBlSV5cCoK8aJY1/i1o1r
d0LARVw4dwonjx3F1SuX8Ne//RXmJgsUTnZQTuZlQaTqVwwANCD0Ddq2brZwm+GMkuItMBukwb8C
FmM56mulC3+q0C6u/q2BpVqD5w7uw3tvvYAnH9+BectniwFKjtf9/usAMA6BUStE45/oxFCEx/qL
GwFzSzZj9cZY0eJWKgKUVgDyytPRvbsBVeYS6E3FqGvVY/eB7VB7qRkAfmYbYKjLUMxdOgM1Bmtt
SknBFrzw3FO4ffu6OA1w6vjX4n6Ar49+hmNff44ffvgeR78+iqX+S8URV+m2QX5eSdVPGABoYJ37
dxqKoPDlqKkqhKm6FJYaDZqlPv9mHRrMWnS01Ihft3fU44M/vYo/vX4YtSYNHp48RhRmcUb1vwOA
82wn+EYsQ2RCEBLXRCEiLgjL/BZhY8ZqJKZGw8bRRgSA+QHzkF26Gdv2NEJXU4T03HUorcrFnie2
YdayWQwA9+gbtBUedhjlPgJlJRloqzegojgbHS0WcQxQzPyPfy32/6Xff/HZRzh14mv87e/fo6au
GnZOCnHahZ9ZUvUTBgAaOC1/PaQ9VWeUlqWLo1V1pjLUm8phNmpQqy+FyVgmuv4ZdYV4/tA+fP35
e3jtxaeQvC4Ots62UE7l7P/nAoDbfFeEJvohKiEYiSkRWJUaieAoX2QXbURCWhRsnGzEbHSWz0ys
y16Nzh0W1DaWo9JcjA3Za9C21YKFfgtFbQYDgFXf50y6aGqo41Akro7E7h3NYqWqtqoUn3/6IW7c
uIIrPedx7swpnDtzApcvnsbxrz7HjWtX8P6H72PmkpnivbOwklT9hAGABkbx31R72LrYIiI+UMz+
G02lqKsuRY2+WFT719WUid/X6IvED1ip8c+nH7yFffu3Yq40O3WxYVX1LxxXc53rDN9QL0QlBGHV
2misSo1BeGwAsgo2IGZNOIaOsxHn02ctn4nkDQmwNFaiul6D7kcakJW/Bca6ciwNXswA8BNi0L5z
VfDkuR7o7q5DZ0stKopz8cpLR3Dr5jVcunAGly+exbkzJ3Hl0jnRKljqC9B79TJyi7OhcFJA6cm6
FVL1CwYAGhCkgcplljOKijfBqMuDvjwX9aY7rX4NJbDUWH9v0OZj17YWfPHxn/GnPz6PGlMFxkwe
zeX/nz1RoRSX0Eya6wq/8GUICFuB+ORwpG1OQExiCLbkpiEiOVRsAUinAOb4zEFaRjKaOmpQrM1G
+y4LWrtrxQrA8nBv2LryhMVP37H0mZOK+ewn2CEjKxXbOhtg0BZiW1cTrvVexo3rV8R2wLnTx8Vd
AT2XzooQcOP6Vbz4ygtwU7uL7xFXAUjVDxgAaIDM/m2wImgJ9NpcmKoKYNDlwajNh9lYIlRXFonK
f70mF88e3IeP/+dNvPTc40hOi8OQcTZc/v+Z96qcpsIQJxtMXTAJIXF+CIpcidikUMSvCoe37yLR
CChiVTCGjhsqlqLn+s7Bhqy1aN9mRoEmA7mFW9Cx3Yx9T22Hb6QPVwD+WWdA56Hw8luArnYLLNXl
0JcX4ovPPsCt61dx/sxpsQJw6vhXOHP6OHounxU9As6eO4lV66XugDbsXEnoDwwANCCWqUdPHoUN
W1ahpjJfDPZmYxFMhiI0N+rQZKkQqwDSqoDZWIZ33nwBH3/4Jo489xjmrrhTnMbOf/87AExRYqiT
DWYtnY6w2EDR/S9hTYQg3QaYUbQeUSnBGDJ2iBjA5vvNxabcVDR31kJfW4zalgpUGIvRvbsFgfH+
LAL8hfcsffakLonO6vEw11Via5t0P0Amnj/yJP76/TfiLgCpJ4C0HXD21DGcPvElTnz1Oa5d68He
xx/ByIkjxf8HeF0wqe4zBgDqN31tZaX9e+m2urLiDJgMhairLRM3rEl3AEhFf23i4p8KaIoy0Npo
xAfvvorPP/oTtu9swTDXYaISm8v/Px8AhjgOwZylM5CYGoWAsOUIj/FHclo0fAKWiir/6ORQPPTw
Q2IWOt9/LtLz0tDUVo1SbR5qG7WoaahAQ7sR/tG+XAH4F+/advxQrM9Iwe4d7SgryERHaz2+//42
bl6/hp7LF8X9AKdPHMOxo1/i7OnjuHzhLE6dPoGQ2CDeEUDoDwwA1H+kS3887cRd6dGxAajWFYi+
/011OpiMJag1llgL/yql1YBi6Mqy8ciOVnz8P6/ho/dfQ0beOjF7Fcun/f0sA/FCpSlKUeG/cPls
JK+LQbR0B0DYcsQlhSA02k8EgKjVwfjDmIdgM94GC+8cA9z5aAtaumvR1FGL6roK1NSXIzDWF7Zu
rAH4pXctfQalVZSlK+ejs90ijrDqtYViyf/7778VRX+9Vy7j0vmzuHzpLK72nBftgr+5fRNdOzth
M9bmbmMghgBS3ScMANTvV/66zHBEZsYamPRF6Ggwosmiu1v9L133a6wsFGFA2gI4cvARfPzeq3j7
zcOY7zNXLEtLRwj5Q/Pnw5XCWQGvgIVYtTZGFACGRfshINQb/qHeWJ+RjNDEADw05g9iBrowcD5y
yjajc0c9GlqN6NpZj8a2ajR3mhG+OphFgP9qG8DNFi7TnKCrLEZLoxFFuZvwx1dewP/9+w+41tuD
q9IlQRfOoafnvOgLIG0HXO+9gqPHvxTHLG1dbdkemHA/MQBQ/y2bTrcXA/gS3zli6b+1oQqP7GxG
o0WLqoo8GLQFqNTkiQAgXQDUaNHh3beex1ef/AlPPrUDoydZ904ZAH6ONQAoXeyw2HceEtZEigLA
yLhAhET6YGWQF9alr0ZQrC/+cE8AyCregJYuaeZfjjJtHjT6PNS1ViI6NRK2bnaiWVP/P9sAXXHx
tIPKTYXU9UnY3t0IfXkeutvqxUkAqer/8sXzuHRRWgE4J349ffIYLp4/jZu3bkBnqrBuA7AYkNT3
DwMA9esPTLsJdoiND4TFUIyOFiMe2dmCuupyGMrzUG+qQJ25QhT+GSoKsL29Dp988AaOffkeyvS5
4lY1qdKdy/+//H5VbvaYu2wmQmJ8ERETIGoAImL9EBS+AhvSkxEU64c/jP6D6AS4MEAKAJtQ11KF
xg4j6loNSM9ej8KSTMSujYDCzQ72U3lm/Zfet3QSxcbZFoERPuhqM6OiOAuawiycPHkUt2/fQM/l
C7h0/gyuXD4vQoHUKvjMqZO4dfM63nrnLbjMcrFeFcxAS+r7gwGA+oX0A07hroDTlDHISF8NfVm2
mDGJGgCLFgZtnuj7v/+RDrTUV6GyLAtPPNqNTz94UxQBBsSsvLP8zxnTL71fUV/hZo95y2ciLF7q
BBgomgGFRvsiKGIFNmelIijOD38Y9QdRAzDfbx5yNRmwNFehqCwbbdvNqG3QocpcjnVZKVBOsIe9
pz3s1Xzfv7ii5WKDWYunwVhVjMrSHJQVbsHnn36A27du4vJFaeZ/Tvx64bzUKvg0Lpw5jas9l3Dp
6mWEJ0WKVtjDZnAbgFT3BQMA9dMZdWm2ZANv/wUwVBbAVFWMal0+9GW5qKkqQpUuH5VluTAbSkUD
oPKiTLz87BP46tN38eorz2DK/Eni6BVnS7/gTgAY4TEc85fPhG/IUnEVcOzqUMQkBYsVAKmIsm8L
QJq5SgEgpzQdHdvrUVqZh5yidJiateje04T8ihyoXIbBbpKSx9V+8Z2r7oTacSguyUJzfRXS1yXi
2UNP4rtvv8Hly9L1wBfFCsDZk9ZTAFcun8PFc6dx+9tbaO1qg2qCdCPmAHgWghwwAFD/zU5d7ZCc
Gom6GqnbXylqq4pQWZ4r9v6NugLr7ysKUK0rRE1lCd57+zUc+/wD7NrdjhHuI6zd/7gC8IukdzzS
cyS8AhfBN8QL/kHeCInyRWR8AEKjfJFVuNG6AjDmIXGXwjzfOcjVpIvOfzUNOpRVFWJz9jrUNulQ
qs/DsAnDYeehhIoB4Jff+RQ7qFxVWLs+CV2tZmRtWIXWxmr09l4S1wH3XDovWgJfPHdG/L73ynmc
PXVcnBB4889vYNqiqaKYULolsL+fhVSDHgMA9cvZf2mv03WmEzIzk1FVngNDRT50JTmo1OSKY39S
EaAUAKRrf/Xl+WiuM+CLT97FF5+8g5ySdAxxko7/cSD6VwFglOcI+IZ5ISzGF2ExfgiK8EFwpA9C
ovyQW5yOoLgA/OFhKQAoRADILtssVgBq6rWwtBmgrS1GZsFm5JRmYJT7GNhN5FG1f9XVUtpOCY3y
x9bWWujLslBemoWjX34iCgGlZX9pBeBqzwWxFXDtykVxUZDUJEi6NTAhNcFaDMhrgkn9+2MAoH5p
nSrtlS5crkZJ/gZoSzJh0Eoz/1wx6Eu3/WlLs1BWlA5zdRlK8jaLHusnjn6Ed99+GaGxAXe70vGH
5C8TWwCTh2NlqBfiV4ciIjYQEXGBIgT4hyxDbtEWBMX646GHh0DhosA8v7nYnJuGumYDTM16GM1a
mJt1KNPnIac0E+Mmj4NiorXpEt/7P7nS2nEIvHwWoNGsg6myBCV5m/CnN1/BrZu9OHfmOM6fOYHe
nou4cb0H13ovicuCzp4+Jm4JNDdZ4OCqgtKT75dUvzsGAOqX5X8HN3vExAeiqiIXNfoCMeOXLgGy
VBej0VKB6soC6CusKwD5WevxxL4dOHPsE7z+2iEsWjn/7gUq/f08A38LYAT8IpYhbUsiUtbHIyou
CGFRvlgZuBSZhRvhF+2Lh8Y9BMUEBeatnIuMwnVo2VqL6voKmBr10BlLRUdAQ50G46Y43e26yADw
8/o6W06bPxnVhlK01RvE/RUvPncQt29dQ8+lMzh98mucPXtSnAKwtgm+KPoC3Lx2FS+/9iKmLrRu
A/A9k+p3xgBA93n2rxINT9xmOCIvdy1qpCY/hmJR9S8V+hkrC8TlPxUlmdBX5KGqPBe5mWl44fAT
OPnlX3Do6X3wnOMh/g7+gPzXAWD0tNEIjPJBUkok1myIQ1xiCMJi/LHcb4k4BbA8wltUnttMUGDO
ytnYkrsOVbWlKKvMR1N3DYyWCmirS1HbpIfzdGeuAPyaQsBJCjzs+TCKyzLR3W4SxwH37u7G9Ws9
Yq//6tVLohfAubMncf7sSVy6dEb0A7h25TJOnzmBqFXRGOI0FKqpKhZcXAv04QAAIABJREFUEn5P
DAB0n89KK61tZ73U0BRvRpO5ApYajbXoT5MjjgJqS7JRWrAJ2jJpGyADmuJMvPfWyzj2xfvo6KzD
mImjYTvR9m49QX8/10AOAGNnjEFkUhBS1sUifnU4YhKDERUfCJ+AJUhNT8aS0EVitikFqlkr1Mgr
S4fRUob8snTUNmnR0G6ArkaD+rZquM50gcKdAeDXvHepEHDjptXoajFBW5yF9hYzrly5hN7eK+i5
dEH0AZDuBuiRmgJdOIMzJ4+JFsHXr/ei3FABO2cllJOUYkuB75pUvxMGALov+n6I2U2yg8MEe0RE
+Yq90Rox4y8T+/5SIaBECgKlBVug0+SgKHcjTFUafPz+W/jLB2+gsCQL9s52sPNkQ5pfMxA5zXJE
RFIw4teEI3FNBOJWhyE6KQQrg7yxZnMSFgXPFwWZNm62mLlsBgo06bC06FCiy0aJNgfdu+qw/dEW
NLbXwm2mKwPAv9J3vfV4G8QnRqC7vU6sapkMGlHt/83tG7h86QKuXe3BlZ4LoiDw2tXLuHD+DM6e
PoHbt3rx2MF9YgVBbAOwzoXUvx8GALqv/dKlwcbRcww2bU5CbVWBmO1L+//Snr90/E+vyRGrAdqS
LFRV5KM4b5O4XvXzj9/Fn99+EWnpybB1sRUrCfzB+E9IJy08FHCe6YSAiOUICvMRM3+pD0B4TCD8
gr2RvCkBC4Lnie+JNNiovaahWJcJU5MWxbocpG1KQaEmAx076sTFQO6z3WDrrmAA+CfEe5muEtcw
RyaE4pE9nWgwaWE2asTe/w93Lgb65tY1XOu9jAvnzuDGjau4eaNXHBOUCgU/+fwjLPBZIGoJ+K5J
9TtiAKD7+oNRqt6fsWAyCvM2oVZfhOrKQrH3X1GUIQZ+qSeAVBdQWZYtbv/LzUjD43u344tP3sOr
Lz2N6FVh4gejcpqy359poHelkwb1CWpncQNgRFwAwqIDEBLhi5jEECz3XYSk1GjMD5p7NwBMXTQF
uWVboK8pRpWlFLmlGdiYlYaSijy0bW+A50JP0XyJg9I/Jx3hk7ZU5i6bhfZWM1oajDBWFuHTTz7A
D3/9Htd6r+Cbm9dx8/pVXLlyEdev9/1zr1gN6L1+Betz1ovjgPyck+p3xABA97X7n7Q0ujJgidjr
N5TniyI/qUhKmvGbDEWoLMtBad4WlBWmQ1uWjfzs9Xjh8AF89fn7ePHIASz1XSCuXeUJgH/+rqUe
CTYTbDFptjuCI1eKBkDRiSEIilgprgWOjAvAqvWxmB80xxoA3BWY4TUNpZU50BqKUFFViIqaQmTk
bUBxeS527mvDrOUzWZ3+KzjMdBCrLy5qZ5hMFdi5tQWlhVl4+skD+OGH78X+/63r13DzWi9u3bqG
W7eu49aNa7h14yp6ey6IMKA3acVVzsopXOki1e+GAYDuG7vJSrH/Hx8fJAZ6afm/oihTnPmXZvxS
J8DyQqn6Pxd6bT40JZniStW3Xn8On330Dg4/sw/qhdNEC2EGgH8dAGxdFJgyb5IY/APDVyIqKQQB
oT7wDfBCVFwA0tJX3V0BkPb2py2eirLKbNQ2VqCmvhwVhmIUV+QgM38D6lsMmMMA8KtI7amlWpdx
U8eiuqYcu7pbxCrXzq3t+O77b8WSv1QDcONGL24J1/DNzWu40duDi+dO4ca1Hjz21D6McBsuggTf
Nal+JwwAdN/8/+ydZ1SVWbqt/98uJVvZMouKucyWCZGcc855EzdpkzOoIEnFrCiiYk5V5oyIghhR
Medcqc/te/reH88da220T59zuqt6DNMpvx9z7L0BkW/tb+w11/vOd05dMR5l8gWhoR7kaGKlA2Ce
OPGnqaToT7QAinOTyUlPoLQojSxNDDkZCbSeOiIJwKZNqxn8rbFsIyjjUb+PAAyfNFRmADi4WeLi
YSvTAG2czaQRUESCPxNsx0oCoDdYj2GTTYiIDSQ5XUVpZY5U/ueXZKLJSmB2VQ4TLcYpBOB3QhCA
zwd9Sm5+KnXL55OZGkttdZnMBPjp55c8e/pYlvt//ukFL18848fnT3jx9BGP7t+Wz69d72Cy8LsQ
hlcfwPUoMPxDQiEACt4NRhnK/vGAUb1RRfuSlRYrZ/3zsxPJTo8jJSFCOv6J039RXrIkBuqYYNk7
bW89wbnWJmoWlkt1tDwVjVQ2oN8at9Ttp8e3U0fi6GaFvZsljq5W2DuZ4yLcAF3MCYnzZYJNFwEw
1mfYd0NJz08gMS2SGHUYOSVpVNWWkFesoWJBMTMcpigE4F8gAAb9DEjVxLFiaRUFOcnUVJTw44/P
ZfzvM5EL8OCeFAL+/NMz+ShMgZ4/eSjTAUVlwDfMS9vuUtZbwei3A4UAKHhn9r9C1PTt5CEkq0O1
m7+Y+89MJCctXhKC1IQIsjXxUvwnYlQFAaipKOJSexNtLUfJKdBgNPhTpS/6O7Pphbvft1OHy1O/
EAF6Bjji5m0nNQBO7paExfkxwUarARAhP4IAFJZlMrsih8xCNZHxIdIGuGx+IdVL5mLmYvqaALzv
a/zQoWeih14vXVJSY1izYr7UuORnpUgDoF9++ZFnzx5JYyBx4n/86K7c8H988UQrDHx0n19//Zm8
0mw+6fWJHCtU7ncFhm8BCgFQ8G7sf4fp061XN8ysJsvNXZT887MSZO9faACyNXFkpMaQmawiMyVG
fj9OFcji+XM413qC081H0OSmYDjYSJ5u3/c1/U+oAIhxyQmmY/APc8PN2wGvACd8g11x97bHWrQA
4gKY1KUB0B+sz9BJQ8gpTqF4bhZFZVlkF6dopwByE6msLcXczUxrwaycSH/7PRhqgM433YmOCWTl
4nJJdPMy1Ny6eVW2AcQpX4wCPnl0h+vXLnH7xlV++fE5P798zounj/nLn//M9t3b+HLIl4r9sgLe
FhQCoOCdQMb/9tPD2c2SnIx4Ke5LVUfJjV/0+TM1sWSkxJCdGisrA4W5ySTEBLNicRUXzjZz4fxp
UrKS0DfWbm7v+3r+Z7QAdJkwawyhKm+CIrxx83XA2tEMNx9bnDysUSWHMMlOWwEQrnNDJw0mM09N
4ZwMCuZkkleqISU7jsi4IFkVcAtwoJsQYCrudL+5/mKNPvnmE1y9bFlSO5u5hekUZiVzteMCv/z8
oyz5C9Hf4wfC/e8xNzo7JAn49acX/PLTC/7tl5+4dvMq40zHKm0XBbwtKARAwbtLpjPugY+/E1mp
MaSpI0hNiNSO+6XHkZWqIlMTgyZJhUYdLUcAYyP9WVu3iAvtLTSfOEREXAg6A3QVAvA7CYD+AD1G
TR6Gu48DAaGehER54+Jtj5OnjXQETM6OYeIrEeAQA4ZMHExmgVp6ABTMTpdEoHBOOomaKErKswhV
+aLTS/c1AVA2pH+8/oajjaSAb5r1ZBYtnE1ZUQaZKbGcb2/l119/ki6ATx8/kEmAwvxHlP5vXr/C
vdudPH9yX37/4eMHmDnO1FZdPoDrUmD4h4NCABS8s57o18O+ICjEXZ70k+PCtSr/9FjZBshMiSYj
NZqcTCEIDCM7TasBaKxfTtvpoxw98D3hsUHo9Ne6AL7v6/mfQAAMjPUZN204ju6WeAU6EhimJQFO
nrbYuVmSnBXN+C4RoL4gAJMGk5SlQpMVT7ImRpb+i8oyKanIombpXFTqUHS/0cVwmEIAfmv9xSig
WFdRgamuKGReaZa878+2NvOXv/zKw4d3XucBiM3+x5dPtXHBdzq5crGdy+fbePb8KT7hPlIIKEK0
lPVWYPiGoRAABW8fwgJY2NKO7EVoqCfJCWGkqiPISouRfv/aKYAwNMlRZGfEyupAliaWtKQItjau
puXkIZqb9hEWF0Q3hQD8/gqAsT6Tzcfg4m2Hi7ctvoGuBIV74uHngJnVNBn9O956zOsWgMnkIagS
golTh5GUoZLBQCrxvkg74DJUyRHo9NTBSBAAZQzzn66/NAMapMs401FUVxVSUZpFVmosbWdO8u9/
+Te58YsNX7QCRCVAVAB+/fUlP//8XCYDityAX//8C4VlRej21pPJgIajlfVWYPhGoRAABW8dwpZW
2PeOnjQEdUIwiTEhqGND5KNQ/2drYkiKC5EJgBp1lPT/T0mMIDYqgB1b1nL2zDFOHN9HQJivjK4V
M+7v+5r+JxAAIZicYjVB+v+7eNni7msvEwGdPawxt51OXFo44yzHvJ4CGDJxEIlpEeQUJlJclkH+
7AxSs+KITgimeG4m8WmR6PTS01YAFALwuwjAxFljWFI7l/kVxeRoEmltOclf//0vWgIglP/CCOjH
Z/z880vpCfDLzy/5P3/5M//251/4f//vr6xuWMOn/T+TosJXv/t9X58Cwz8MFAKg4K1CloqHG9Ct
1yfMNJ9AQZYI+RGxv4lSCyAes9Ni0ai1PgBpiZGkJ6vQJEWSGBvEgd1buNDWzInDe/AN9lQIwL9A
AD416cGkWWNwdLPAI9ABe1dLHIUhkJcNlramxKWEMdby29dGQEMnm6DWRJNbpKakPJt5Cwvkxp+W
HUfh7EzU6THo9zbAQCEAv5sATDYfx9LFFSyaP5csTQKnmo7x//7vX3n65BG//PJCCgAFhB2wEAf+
+osWv/z0I//3r39lz4G99B7RRzsJoBAABaPfLBQCoODtb0bD9NHt0x1ru2lS9Z+XGS8jUnM1ccwW
vvNpcWSmRGkjgDMSKMpLkjHA6rgQDu/dwZULZ2hu2o9PsIdCAH7vmg/X57OhnzJ51hgcXC1x9xME
wAJzuxk4uFvhHehEQkYkYyxGa62AJQEYQmJmFClZKm0ccF4iSWnRFMxOY0V9DZkFqRj0MZQEwFAh
AL+LAIydMVJqACpm50mB6/Gjh/jr//13njx+IAmAaAEIb4CXL4QG4IXEzz/9yJ///DP/+99+pe1c
G2NMx0gTLaErUNZcgeEbhEIAFLxlaAmAfj9dPDwtKchVk5EiHP8StEZAuWqK85KlHkCMAApPADEZ
IHQA6vgw9u3eyqX2U5w4ugevAHeFAPxLBOAzptlMwivYEU9/Z1x97LF0mClJQHCUJ/Gp4YwyG/Ga
AJhMNiEhLUq2AWKSQuX4nxgfDI72Yc68bPJK0jHsa4TBUIUA/F4CIIyY5pRkUl6SQ16WmpNNh/nr
X/+i9QEQc/9CB/D0oTYgSLz+SegAXvLi+RPZDjh38RzjZ41/TQDe97UpMPxDQSEACt46BAHoYWxI
UIgb+dlq0pMiSU+KojAvUZb8NepIstNiyBKVgGTh/x+HJkVFUnw4e3ZupO3UUY4e+gGvIIUA/CsE
4POhnzHZfDyufg74hbrj5G6LrbMFZlZTsbATRkB+jDQd9joMaOC4gSRoosgpVFM4V0Pu7DRJCPyC
PUjNjCOvKBWjfkbomwhhp0IAfg8BGDVlGOXl+cwrzSUvPYkzLSf4y//+VQr//ub+94QnDx/IZMBf
f3kpBYHPnz3mxbMndN64ho2HjRwFNBrdQ1lzBbxJKARAwTshAF+YfEa0yleO/qXEC/FftBwBzEmP
Jz1ZjABGydaAEAXKfICMOJISwti7ezPn205yqmk/AZGKCPBfIQBfDP+caVaTcHK3xjfIGa9AJ9x8
7bFzNcfUairRycGMNPsbAeg3ph8Jmggy8xPJLkomf7aG0ops8kpTmVuZS+m8HHoM+Ax9EwPFmOb3
tgDkFEAx8+bkkZOh5kxLE//+lz/z5PE9LQEQJ/2fnvPy5RNJCl4+ffyaFLx49oiHj+4TGBUoLYGN
RikEQIHhG4VCABS8EwLw1dDPCYvwRCPy5RMjyU6PkRGpOZnx5OUkSuW/GP0TbQGRB5CVHos6PlQS
gI7zpzlz6gihscF066uMAf5e3cXnQz9nqvUk7F3MZSCQm68tju5WzLKezlSzSUQnh7xuAegZ69F3
dF9Z+k/PiSMjL5GsgiSyCtUUl2dSvbCEkrJsPjP+XCEA/4IPwCSLsSycP0dqAHIzk2g93cRf/u1n
7t++wa8/PZen/ZfPn0gi8PzpA549fSg3/5fPHvHsyQNZCYhLiqPb193oMUJLAJR1V2D4hqAQAAXv
JBmt98iviYr2lW5/wvNfmKLkZsaRnR4rXf+yM+NIE2mAuckU5qeSqYkjSR3Bvu+30Hm5jdaWY0Qm
hNJdIQC/L3vBRI8vTD5nuuVkGf7j7G3LTKtpWNpNx9HDEhsXC+I0kYycOfxvFYDRfVFnRpNdkER2
YTLZhSlk5CaQkhlDTW0xZdX5fDH4C/RN9BUC8BvrLx6FE6C54wyWLplH1dwCCnNSONvWwv/5yy/c
7OzgyaN7Mg9AbP4vnz+WVYCXzx/x7PF9Xj57yNNHD3j58jm5hdnSf8FwuCICVGD4RqEQAAVvPQVQ
9C+Hjh1IhiZG6/4nhH5pMWgSo8hIjiY9JVqaAYl8APG6bHYmuVlqYqOD2L55LZfPtXC66SAqdQQ6
/RUr4N9c81EG6Brr0tPkK2Zaf4erjx3ewc7MtJrKDIvJMgcgNNaP5GwVI0z/RgAGjOkvvf+F6l+c
+gvnZJKWlYA6LYqi2RmU1xTy9bCe6A1RCMA/hwEGIgug5yfSfbFh9SLmzc6lOFfDpfNn+fMvL7lz
8yr379yUyX8/PteW/QUJ+PH5I148fcDjh3dlC0BMCpRVzkFfmAEN+xCuTYHhHwgKAVDw1k2ARAzw
2O+GUVqQSn6mmqLcJNnnF73/gmxt/K+oCGSlqaT6X3w9LSkSVaQfGxtWcOXiGc62Hic1W62EAf0O
aEmXDn2G9cLGeSbOnlYyBtjR3QJLR1PM7UylF0BiZgQjzbQEQEcQgLEDySxMIq84VdoAl1bmUDIv
h5SsOApK06lZXEqf0V0z6QoB+OfvwTADPvm6G9GqQNavmk/VnDwpBLzReYX//W8/8+DeDbnBv3j2
kB9fPpGlfmEHLEr/Tx/f49HDOxLiZ6pqyjHqq/2d7/u6FBj+oaAQAAVvFUKwJ4R74ycP15b8NbEy
Gz0zOZosTbR8XZCtlshJiyU1IYKUhFBSE8OJCvNlQ/0yOjvO0t7aRMHsbIyMP5X9bWXz+SdrPtJA
Zib0G9kbK8eZODhb4C4IgJuVtAR29LBipvVUQuN8GGE69DUB6D+mP5qcOLLyk4hNCkOVGEphWTpF
8zLJKUphbk0+A8cOlD9vpBCAfwpxj3b/pjsR4X6sqJ1HeXE288uLuSd6/7/+yMP74vR/T272zyUJ
EJv/YzkS+OLpQ6kHeHjvlnycX1uNkRy/VNZbgeEbhUIAFLwTAjBp2mh50hdiP5H2J0YBM5KjyM2M
7/paJDmaONKTVKQkhsscgOgIX9atWcztq+e41N5ETW05Xw4W+ei6cpN739f2QROAAToMGN0XCwdT
qfoXG7+rt53MARDOgOZ20whWeTFsusnfCMC3WgJQNFtDSmYsUYkhRMYGk5QeTWpWDAVz0qVdsEIA
fl/6ZY/+hmRmJFC3rJqKuXksqCiVPv9C+HfvTifPntyXp3xR7n/84K4U/b18oa0KCA3A86f3+enl
U1Y3rOAz48+kruN9X5cCwz8UFAKg4J0QgO9mjCE/N0n2+kUoSmaaSjr/FeYmkZMeR2JsiAwDykhV
ybCgTI2K6EhfqsoL6GhvprX5KPVrV9JveB8prlLS0f7Jmo80QHegLv1G9MbMegp2LrNk39/ZywYH
d0ssbKZhYT+D4Bhvhk4b8poAiCmAlKxYahaXULmohNzZGmISwwiPCSApI5r8uRkMmaz9ecWV7h/D
qEv4+uXgzygtzWRl7TxKclMlARAb/Y8vHnP/TmeX6v8BT55oKwGPHt7m8aM7PH1yXzsB8OS+rAis
qFvKZwMVAqDA8I1DIQAK3ir0RQ5A725MNxtPbnaiVPqL6F9h9SvCf3I18XIUUJz6kxPCSVVHkZIU
LsOAgnxdyc1I4MLpo7Qc38f3uzcxesoouvftjuHI939tHzLp0hmgy6CxA2XZ39HVRiYC2ruZY2E3
TeoCrBxmEh7n93cVgMETBqFKDCEjJ5Gy6lyqFhejyUkkNiWC1Ow4iudlMXyq1jdAIQD/GMIDQBAA
kX45ryKfRdWl5GckUbe0Rvb0xaZ//+517t26Lsv/z8SJ/8cnsi1w58ZVSQIePbjDo/u3JUlYtWYZ
nw/6XEsAvn3/16fA8A8DhQAoeKsQgj0hApxhMZHcrHhSE4UPQATJ8aLPHyHNf/JFa0AdKU/+6SlR
8lEVEUCQvyvJ8eG0njxEy4n9HNi/namW38l8dIUA/AYB6K/DyO+GERTuhU+IK86eNlg7mmHjNAtr
p1m4+FiRkBHKiP/gBCjCgJJzYqTqPz45gqx8NflzNKg1Kvk6b04qo2aMVAjAb0CaAA3WZdC4gcyd
ncOC6iIKc5JYu3IJL1484uGDO9y/f51bnZd4cPeGnP0XeQD3797g7q1rPLhzgyeP7/Dk0V2eP3nE
hk1r+GrIlwoBUMCbhkIAFLwTAmBqOVHO+2elqmTkryj1F+SoSYoLlxWB3IxYWQEQXxdZAYkxwVID
kBATwqnj+zl7+hgH92/HzG6GQgB+a81HaFsAQ8YMxMp+5usWgCj/CyMgG2dzLBxmEBrjzfAZWhGg
rrE+QycN0WoAyjPILFATlxJJUqaKnJIUcopSKSzLYpyFNj5YIQD/GEajjKQGY/zM0VRW5FNenCWn
Xzauq+PF84fcu9vJ3dvXuHXjErdudPD0yT0e3bvN44d3ePr0vtQJPLx7Q7YEnj9/ROPmdXxl8rWs
KijrrsDwDUIhAAreIQGIl3P+AsIJUHgBiI0+RW780bLvL8iBGAdMSQwlJtyPhJhgmo7+wLkzxzly
cAdOXraSACgiwH+y5iP0JQEYNGYAZjZTMLefpo0B9rHBydMaBzcLLOynyymA4aZ/IwDDvhtKalYs
+cWpzK3Oo6gsk+iEMKLVIZRWZrOoroJJNhMVAvBbPgwjDKR1r4ObFYvmz2ZOUTq5GYl8v3OTFP7d
uXWF+3c7pRDw9o0O7t+7wePHd3ny8L5MBxR4fP8OD+7dlD+/YYsgAD1lm8ZwhFbj8b6vU4HhHwIK
AVDw9glA727MMJ9EXo5IAoyRQUBpidp5//TkSDLSYqQGQOQB5GfEkZkaLQlAfHQgMZH+7N+9kQtn
jtF8fA/RCcHo9NORm5yyAf1zAjBs0hAcPCxw8rTCwcNKVgC8Ah1w9bSRkwExKSH/wQlQnyGThpCR
nyDd/3JLUlmwfDZzqvKIT40gIs6fonnpTLadpBCA31r/Yfro9NYhKi6YVcuqKMlLpSAnmSOHfpCn
/ds3r/D44W3u3b0hScC9u9e5e+u6/N4L4QjY5Qz49MkDOR64ZftGeg75Gt1+ehgNM1LufQW8KSgE
QME7mQKYMG0UWRmxUgSY2rX5Z2fEvFb+Z6ZFkxQXIjUB2RmxJKiCUccFExbsSf3yhVy90ELryYOU
ludg2F+rslY+BP85ARj5nYnc7F287HDzt8fW1RxrJ1PcvG1x93VAlRzCiFcEYLC+nPFPFJWY/ETi
UyPJyFNTtaiIykWFJKZFkpQRyWSlAvCbEL16owFGJKgjWb6onJK8NIrzMzjTfJSnj+9w93YnTx7f
5cH9W9y5dU1WAzqvXJD9f9EGEO6AQivw009PZUTw+sZ6vh70FXr99DEaaoTBcCUPQIHhG4FCABS8
9X60IACjxg8mXhVAYkwQ6rgQNKmRkghkiRjgVAEVyfFhWn+AtEj5M6nqCCJDPVm1pJrbnRdpP3WY
NWsX8fXQnugM1FHc6H6rAjBxCA7uFjILQOYB+Ngwy3aaNAGyc7FApQ7+OyvgoZNMpAYgMy8RdUY0
sclhcvyvuDyD2VVZFM/LxNR5mpYAfKsQgP8WowylALD/t31Jz0igvCSXkoJUqsqL6LjQxuP7t3h0
7xZPHomN/g53blzjzu1r3Lh2QYoCxXTAw/s3JBHQ+gI8Ye36OnoO+hq9vgYYmSgEQIHhG4NCABS8
/SyAft0ZOWEICbGBxMcEyZO+mPtPSQyT1r9iKkC0BDJSIklPjiAu0p/E2EBS1ZGown1lH/XujQty
HHDP7k2MmTZaiqwUAvCPCYCesS7fTh8uBYAu3tZaAyAPa4mp5lOYYjaR6OTA1xUA0V8WJj/puXGk
58aTmBZFYkaE7P/HJYejyYtjbk0uVl6z5M/3UAjAfwuxJuJ+H286hop5BVTOyacoP41FC8q4deMy
T4TQ79FdCWkA9Ej0+m9IUeDt65e1JODONekT8ODudfkzGzbW02voN+j11cfQpIdCABTwpqAQAAVv
35RmkC59R3xNZKQXqYni5B9OUlwoSXHBZAkxoCaGtETt6V+TGI4q3IfwEE9JEqLCfchIieNC6wku
Ch3AiX04edtLMyAxCaB8EP7jCsCEWd/iFeCEs4eWAIgqgIe/A65+9lg5mRGZGMiIGdoxQB1jXQaO
GUhcajjqjAh5+lepQ1BnRaJKDiUs1p+isnTs/ay0BGC00Xu/zg+S8A43oHuf7ljZz6Jybj7zKwqY
XZTB8kXVdFw8y83Oy1ovAGn0I0J/7nDn5hXu3Loq9QC3rndw/epFOjvO0Xm5nbu3rlJXv4wvB3+F
3kAD2QJQNAAKDN8QFAKg4O1H0wpb1IGGOLvN0or+UkTfPxp1TIh8TE2KICbST2YApMQLQ6BQVFH+
UgQYHe5DTFQgTYd/4PLZJtpOHUKdHidV1spJ6J9VAPSZbDGBoDAPAkI98At1l5u/8AMQQUCiEhCl
DmL4ayMgXQaNN5Yn/sjYQFRJwYSo/AiLDSAmOZSQWF8yi5JxDrJHx1hHqQD8o3t9mB4G/fXxCnCh
JD+DOYWZFOWnsHVjvUwAFCRAxP0KAiBm/W/fvCq//ujBTUkAhPJfVASEUPBaxzludF6kqDQP/T6G
GJoYYjhCW1V739eqwPAPAYUAKHjrH4pCFd1jkCFmlhOIVfnJ+F8x+icqAML4JyUhjISYQOJVwaSq
w9EkRZCcGEZSbCixkYFEhvmwZ+cGOtpPcrblEEuWV2PUX2u28uqAbYkNAAAgAElEQVT/eN/X+aER
AP1B+oyb+S3eAS5EJgTgG+KOg4cl9q6W0gjIwt5UVgBeTQEIAtBvTD/UmdrTf2RCEOFx/nj6uxEQ
7k1QtDfpBYl4hbvJMUwx666s+3/f///a5Ati40IoK8mmOC+NrPR4OQHw4vkjrl46y71b16TD34M7
N3l0X+gB7srnYhzw4YNbsj3w6MEtnj+7z61bHYRFB8lgIaPhRkrVSwFvEgoBUPDuCIDNZPx8HV/P
/qepw2UgkCABqckRqONDUMeHysmAzFQV2RlxZKXHEhHqxbrVi+k410zL8f0c2LsdkwlD5ElUUaP/
V8gS8WADSQCE2M/Vyw5nT2tcvGzxCHDExddWjgGGxfsxfPowuWnpmxjwhcnnBEZ5kF2iJiNfTUp2
HHGpYUTFBxES7U/hnHSikkL401d/wnCksu7/Ve+iL1tTQycMIT9fQ3V5AbNLNORkqTnbdlKG/Fw6
d4aOi208fnSbZ48f8PTxfZ48vsfDe7d5cP8md+90ShGgeP7jiyecaT2Bb6gXur31MBxuiMFoZc0V
GL4xKARAwTshAPoD9DG1nISvlyORod5S4Z+iDpeTAEnxIXI6IFUdRmJMCEliGiA1mtzsBPJz1IQG
uFM1t4DL7Sc5eeQH2luP4ehrJz9slVS6/54AGA4xZLrdZLwCHCUB8AhwwM3PXtsG8LaRhMDW3QKj
wZ+iJ96f4froDdRn8syxRMX7k1WgJrsgiczCRBJTI0nOiqFifjEpmXH8L0EAhCGNsu7/deS1X3e+
M5tISVEGxbka0pKiKMxP5crldnnqv9F5iebjBzl/9hQP5en/Po8e3ZVjgeL1/dvXuXPjCk8f3+XW
rSts2LRaEgC93nqyAiCJhrLuCka/GSgEQME7IAAG6PbTZdKM0QQGuBEW6CFL/cILIFMTjTo2RPb7
xeifmAyIjQxAkxolxYFCNBgR4kFmWixnTx3mdNMBLp8/RUZ+Cp9884nciETp9X1f5we13sOFWtwQ
U/speAc6SfGfCANy89f6ATh4WuHkaYHxuAFSsS7Kyvoj9bVtgNF9cPaxJTohCHV6NOq0aJkQGK0O
pWhuJul5aj75pjsGw5RN6L+su2i9DNDD0d2S4vwUivKSiVMFUFNdwoO7nTx5eFdu7J1XztHSdJhL
58+89gR48vCe/P7De7e4f+cGL57dZ+/+7SxeUYmdp5W27aJUXRSMfrNQCICCd1IBEARg1MQh+Pu7
Eh7sRWJcEJrkSLn5J8jNP1g+FxMCcaogKQwU1YFEVYj8EFVF+HF4zzY5DXCprYltOzfw5ZAvZfla
aQP8/XqLE73RYCNM7b6TG78Q/YlTv6OHyAEww8bZVFYHRGKggSgrj9QKy4S5Uo/Bn0ri4BfmTnRi
EGFCm6GJJDY1HE1uAmm5Cej20ZPv6fu+1g9u3U306GHcg5Bwb2YXaSjMTSZeFcTGxtVyQ3/2+K7M
Anj2+A43rl3k8qV2rnack3kA9+/clPG/oiXw+OE97t69Qt3qxVTXzmWc+Tg59qroLhQYvmEoBEDB
OzmR6g3QZcjYgXh62qOK8EUV6Svn/l+lAIoWgBACivK/qAIIrwAhAEyIDSIxLpTgAFcaG5Zw9WIL
bc1HuHCxBQuXWdo2gEIAXq+13IgG69PD2IhJM8diZj1NKv6dfW2xd7PA3H4Gth6z6P1tb3SNdV+L
yl6/TwP1GT1jJJ6BLlIEGJcWTlRiKAkZkWQXJaPJjUe/n3ay431f74cCee+NMpTmVCbjjcnJVVNW
kkVhXjIZaQm0tpzg2ZN7PHl8i6eP7/FUxP0+vCknAO7evipHA28KD4DrV+Xp/8nj27S0HKG+YRHV
i2bLmOZXepf3fa0KDP9QUAiAgndSGtUZ0J0Bo/tgZTeT6EhfIkJ9SOoKAdIIEWBimBz/Exu/rAqo
gmQlIDLUR1YHQoJcqSzL4+r5U7S1HOHalXbySrJlG8BA9KM/gGv9YDYiY10+G/gZplaTsXKcibO3
LS4+WuGfcAY0c5rGJ30+0YrKuk7/AvqiCmCsR79v++Hqb09wtL/0AIjTRBKVECrzATR5CRgNMERX
RNN+ANf8IQUAiTK9laMpVeV5EnnZiVRXFHP7Vod0+BMb/b3bIgmwk4ddY3+3OjtkBUBYAgt9wNXL
57l58xLbtzXQsH4RlbXF9B3dRxIAxfhKgeEbhkIAFLwzM6BeI3sy3XwiPr5OqFT+RIX5SAdAORIY
H0pCbDBJsV0EIDZYIirUW3oERIR5kpEaQ9upw1xoa+JiWxMbNq/5WxtA0QFoMVJ7Ev3C+Ats3Sxw
l+I/O5kCKMb/3P0d6D+mP90HdJeblt5wPfRN9NEfKoSAooytz6eDe2BqN5XY9AiSsmJJFdkA6dFk
FaaQWZDCp4M/Q3eIdgRTwd+8Lgz66RGvDqW2ppjK8jyyM+JpXL+Sxw9uaU/4N7QpgIIMiFn/J49u
c/vWVa5fv0jntUvcvHFZagQuXmxh7bolrN+4jJLyHL4Z/o1CABTwNqAQAAXvANr+6FcjvmC69WQs
7c2IjQ8mMsSX2Ah/ufnHRQeSGCsCgEKIVwVKEiC+npwovACEBsCX2Chf9uxcR3vLUY4f2M3xY/sw
tZ+udQVUPhz/jgD0NOmJlfMsbJ3Fqd8SezcRBDSLmfbTMBAlfBM9rWvdwO6MtxxDv3H9tOOAwwzQ
NzZk6MSh+EV6kVGaTHpBEonpQgwYR3ZxKp8N+UIhAP+l6qLDgNH9KS1JZ1FNCWWzM0lNUXFw306e
PLwl/f4FEbhz85o0+bl/u5PnT+9LE6CrV85xtaOd69cu8vjhTfbs2SRP/2sa5qPJjuerwV/KrAbl
Hldg+IahEAAFbx+jDOUJ6cthn2NqN0N7EvV1QqOJJSzIS3vaVwXJBECtIZC/jAGOjQqQlsFiYkAQ
g/BgD+qWVXLu9DGaj+6l7fRx6QrYvVf3LlGa8uEoCcAAXXqafMUs26mY203Hwc0SS4eZOHnZYDJh
MDr9dbQuimI6o0830vOS8Q73lhMBoiqgO0iP3iN7Y2o7g+iUcLIKk7UTARlRpOcn8uXQLyUBEIFA
7/16P4j5f0NZ/rd0MWV+VRFlxVnkZCRQXJjO9WvnpfhP9PYf378tR/1udnZIAvBMGADd7eRi+2nO
t53k8YMbnG07ztqGWtY3LmX12oUkZ8XSY0AP9IboSg8AhQAoMHyDUAiAgncCQQA+G/IpprZTsXez
Zqb1DBLSVMTGhhAe4kWcKlBu+KIiECd6z5G+sv8v2gSxUf4kx4dK/4A5RZmcO3OM1ubDnDl5jKUr
F9J7ZC+tK6DSBpCbUffXBGCahK3LLOzcLbH1sOQrsXkP1u1qy+jR0+RLSkuzWNWwDKOBRrIyIFoB
hoONmDBzDC6+DqTmxqPJT5SeAGl5ifQc0VMhAP/h9C+mJz41NiQpNZIFNUXUVORLE6tVS+fz8pkQ
/Ykxvzs8eyQmAe7x6P51Ht67yZMHt3l8/yZXLrTR2dHOsye32b6zgY2bVrB1xxp271uHShOBbj/t
1IWy+SswfMNQCICCdwLZI+2vx9ipo7F1scTSaRYOnnakZcQT6O+GKtJPegEkxgVriUCkPwliMiAu
CFW4SAcMIibKVxoIHdq3jZbjhzjddJAD+7dhJtoAfZVwIAlJAHToJVsAM7G0N8XUeiqu/o5Ms50i
A2XkeyH6/cb6TDAdRUlRGm1nTzLBfKJsHxh1/Y5BE42xcJxJeFwgafkJUgCYVZpM79G9FQLwHwiA
qJyMmTaShQuKpfuf6P8X5qdIx8r7d67LoB9h7StO/3dvXeP6lXPcvXGZ50/udrUFOnhy/ybt7U3U
rVnAtl1rWL9pBdu/r8faw1xbmRFCzY/93lbAm4ZCABS8Oy+APjqMmjgMaycLbFytMLMzJSw6gOjo
AMKCPWXPX4wAipl/ceqXBECKAYO6KgMBUgzYsHoxZ1uOcnjfdk6d2IcmOxH9vvry9Gr4sX9IyhaA
Dn2G9cLGeRZ2zrOYZT1FnuRNJpvIjV2YJ0lR5ohvcPKwojA/jc7OC5QvnMMnvbphMMxQa940QI9p
dpOlg2BCegSp2THklCYzQOgFPnIC8GrzF/e1Xj89gsK8WLSghPkVRZQUaigrzePy+RaudbRL618R
BXz9ykVudl7k8oUznGtr5vb1Szy8J1oBt3l0r5PGxpXUr1vEpq2rZAtg1ZoaRk8fIQWbSnVLgeFb
gEIAFLx1aGfMtTnpJuOMsXUxx9bVGmtnSxzcbIiJCyEizFuO+wkxoCrcl7ioAEkARO9fHRtMXKQ/
8TGBBPu7MK80mzMnD3Lwe1EJ2MfGTXUMGTtIEQO+FgFqHf3E2J+1o6l0prNynUWPIZ/LjVuMTYr3
YrLZWIJDPcnKSOLqpTbOXjjNoPGDZBVAeP2L9RRugZZOM/EP9yAtN5bMYjUDJwxQCIC4x7oqJcbf
9qcgP435FYXMKcwgJTGK1SsXcvPaRa5ebuXa5bNcv3pB4sa1C3Reaef82ZOcb22S1YDnj+/ScuoQ
q+tr2bRtNQ2Ny2ncvJwVDfMZPN5YErqP/r5WwNuAQgAUvBuMNETXWIc+I76WfWlrFwvs3KyxcjDH
N9idiAg/woI8ZM9fOP8JAiDCgYQ3gFpUAoRGINKf8GB3YsJ92LttA2dOHOD4wd20tzXhG+IpI4I/
+l5pFwEYNG4Azt5W0gfAPdCRsbNG061fN7n56w7W4zPjz/D2cyQowJ2s9CQutjdz6/olEjJipbeC
sJ3VH2qAbl9dJpmPx9HbGk1+LJrCRAZPHvzREwBRaRIuijp9dXDxtGVBZSGVc3KZU5iOJimGQ/t3
0Hn1HBfbT3H9ylk6L7dz+6aoApyn48IZWR24fK5FtgKuXW2nbk0tjZtWsnnbahq3Cg1APZWLSvjK
5Cv5fioEQIHhW4BCABS8M4hN46vBXzBlxnisHMywdjbHxskce3crQiJ8CfBzleI/KQiMDiAmwl9O
B8RHvhIHBhAV7o2HiyUrl1Zy5WILLU37uHHtLCvqal9HBH/UeemSaOkxdNJgbN3McfCwwsHbiq9H
9dQKJcXpf4AOIycNJTYmCE93Owpy07h07hSXL5xm267NfGXytRS2GXVVAfqN7ouVmylxmnCyZ6cx
dIqJQgCErmWIHj2H9iQ5VSWFf3NEAFB+KpXl+ZKUXjjXzNmW41xsb+Ha5TZuXL3AbTHzf/msbANc
6zjLw3vX2LqtnoWL57JxyyoaN6+U2L2ngZT8ePTkyKa+om9RwNuAQgAUvDPITaW/AVNMx+LoboWd
mxW2Xfn0PiEehEf5ExbqSXx0gDzxi1HAhJhgosN8iQj0JDrMW04I+HrZk5keR/uZI7Q27eP4we2c
O3sccyczOY71MX9YSk//QfoM/W4I06ymYO9uwUTrcXJdxISA3lB9DIwNcPKwIDbaF083WwoL0rl0
/hSnmw9xqvkIth7WXUmLRvI9MxyozzTriTJIKLM4mdFmoyQB6PGREoBX/f9u/bsz2XwCs0uzKCvW
UF6SIc2q1tcv5cqlVk6fPML59pNcOt/C1YutXD53hvbTJ+jsEJt/Kzc7L3CiaS9VC4pZ07CIdRuW
snFLnTQBqqtfiHuwE5/0ESOuXY6NH+k9rcDwrUEhAAreCcQMs1Cfi5LytxNNpC+9k4cNdq5W2Llb
4+hhg0pY/gZ6EBPuK0OBhPgvMsgLVbgPkaFeBPu5ERniSViQGz5e9mzfUseZpn0c3ruZK+dPsnh5
NYb9tETjYy2ZviIAxhOMpZufudN0er46/Yv2wCBd+o/uQ3CoG6GBzvh6O1CYn87F9pM0Hdsre9GF
Zbno9tOXPgHCF0Bm3E8egq3zLNTZKibbTZS/r8eYj5MAaEf/dDEc2IOgMG+q5+VRVqShvDSdvGw1
Rw/u5urlM7SdPsaF9mYunD0pqwCdV87SduoYLScOcE0QggvNLF5WwZIV82jctJy1DcvYun0NW7ev
on7jYqbZTOZPPT/B0MRIvg8f4/2swPCtQiEACt5hJoCBFDQZj+qDmcV32Lta4uBhIxPrHNys8PJz
QZ0UQUSQh+z3q8L8UIX5Eh8ljIH8CAt0J9jPBVWYN+5OFswtyeZ82zFOHv2e44d2cfliM5bOXVWA
j5QAGHYRgEETBmHjbs4Ei3Gy9y8jf4cZSBOgGRYTCQpwIcjfBS9PO/KyU2k7fZRTJw/ScvIQ23Zs
YOikYVrxmSANxjr0HPoVtm6ziE2NwMLDXH6vx+geH/Xo37DxJhQXapg3O5PKudnkZ8WzpLacK5fa
uHiuhcsXT0sNwIX2U1w6d5rrV9rpuHSa5qMHuHLxNFu21VE5v0iG/mzcuoItO9eweUud9ACoWFRC
r5G9ZQXAwMRQimhfhTa97zVQYPiHgUIAFLxby9RBOvQZ+hWm5pNw8rDGM8ARd19H3HwdsXKcRbgq
gNjoQEL8XKUQUJT8YyP9iI0QPgF+qCJ8iA71JtDHCVVUIM0n9tJ26hCH927h3JmjrFqzWOucJkcC
P0IS0KUBGD5tGLbelvTuCpIxGCXEf7p8Puhz3Dys8PKwISLEA3dXK3KykzjdfJhTJw7INkBLy1H8
wn1eBy3JtsFAQ6ZaTSA9LxGfCHcpuDQa1eOjW99XI63d+3SX92zF3HxKC9KYVyrU/+Hs/X4zd25d
5tL5M9LgR0wACELQ2XGWzo5zUmfR2dHGwYM75Oa/dOU8Vq9ZIOf/165fzIbG5WzaupKo5DB0+uqh
O0RfG9k84iMXtyrgbUAhAAreCeTpRQgBB+vyxaAeTJ05DnsX0QawwtHdGicPW1w87bB0MCM6NpiQ
ADdUod5Eh/qgEm6AEb5SAyCqACEBrrIl4OVmS93KBbS2HOLA7i3s27mRc+1NWLtZ0q1PNyli++g+
NIXD30A9RpmOZLrjVOkiJ21/u0r5IyeZ4O9vj5e7NaEhbjg7mpOXm8KZU4c4dXy/HK+83N5Mde08
jAYIDYBWOKgr4pzHGZOVryYgyoc/ff0nbQrjR7S+r0b/BKHqO7IP+QUpzCvJprw4k/zMeIoL0rh4
tlme9K9fOyeV/9cut8sRSzH/L3C78zJXOlpZtqKKBbVzWLt+Ees2LmbZsgpWrZ7Pxs3LaVhfi1ug
I9376rwu/X9M66zA8J1BIQAK3q0OYLg+BgP0GfPdUKzsp2PjNEsm1Tl72uDq44i1kzlOnraEh4lT
vjMxYuMP95Xq/xB/F4J8nQj0dSYy2BNfLzuy0uM4dXwfxw7tZt8PG2k6vo/5iypkFUAk3H10Bioi
4W+QPqPNRjBk8iC5cYsNXG+YHrr9dTGzmUKAvwOBfo74eTvg7DyLrIx4Tp3cx8njezh1bK/MWth/
YBeTLCZJ0tBjVA/0Buvz6cAe8mQanhhCt97aPIGPLvXPRA+dXt3wCXRhUU0xc4s1VM3NIT05kp3b
1nLvzlU5ASBO/Xdvd8jRyjs3LnP3zlUe3unkwd2rbNlaz9KVlaxrXMradUvZ+UM9GzcvY826Wrbt
WMWKNVXStVGObSriPwWj3x4UAqDgHQenCIc5XYxH98XC+jvcfWxx8bLF2csWR3dbXLztsXY2w9ff
hQBfF3nSF1MB4UEehPi5EB7oSmigK5HBXlIMGB3mw0FhDdx8kIN7t7Hv+83s378dM3tTqQUQSvaP
5QP0VTCNGBvrM6YXnw/9TD4Xp0jZxzf5GjdPG7w9bfH2sCHA1xEnh5lkpMdz9MAuThz+nuYT+zl5
bC8XzrcQlxrT1QYw0I4P9u3OVPupeEZ4oDtAKxJ839f8LtdWXxj/9BW9/0FUVRVQOSebeXOyKClI
omx2Flcut3Lj+kUunBd9/xY6Lp3lxtXz3L7ZIS2AH967weEju1m6oopNm1fJsb8t21azbUc923bU
sXrtAjZtW05ReaYcvZSGTB8bgVXAu4RCABS8M2hLmaKEqss3Q75khtk43DxtcRMnUU8bqQkQcPCw
lN4AwaEe+Hs7yqmAuAhfYsK9CQ9yl73rqFBPGRHs62nP4gVzOHPykCQAB/Zs5sSx7ymrLORT40+1
EwGjjT4y10V9ed2iAqIvTpDDDejWV4cxU0YQ6O9MgI8TPp72hAS6YG8zg5wsNaeb9tN6+pCWABzf
x/m2EzRsXEUvEbQ0SFdrDGRiwKdDe/DVyK/kc/2PqC8t2lcyQ6GvPuGR3iytKWVeaSbV5XmU5Cez
dVMdDx50cvH8aS5fbKXj8lnOtp6k/cxJ+fruzaucO3eS5Svms37TMrbuWM36Dcv5Yd96duysZ+Om
laxrXERDYy2RiYEYDRRETu+DuHYFhn9YKARAwTvDq16mcKL7tL8B4ycNx8HFHL8wV1x97HD2ssbR
ywZHT2tsXWfh4WuPn68zHq42xER4ERcptABCBOglIYyBgvycZXhQc9N+jh3+ngOCBPywRZ607L1s
pRZA2Np+NBtVV5XldelYjKyZ6Mt+voPTTIL9XQkLdiMk2I1AfyfsbKeTlZnImeZDEmdbj8lpgOOH
93Dhwmnsfez5RIyiDTXSitGGa0VwH1Np+lVlRSj/x00fTUVZNuUlGkkA5s3JpEoY/7Qek85/l6T6
v5WrV87L1+dbm7l8vlW6AG7Z2sDyuvls2LSSjVtW0NC4RFr+7j2wgd0/rGPDpuWsWFuDjdssuvfu
rtVufCRrrMDwvUAhAArefR9VBAP11WX4+EFYWk/B2c0Se2cL7N0scfSwws7VUs6cm9vNwD/YHU9P
W7w8rIgK8+pqBbgS1dUaEAmCYiSwYc1izrc3c/y4IAGbOHZkNyvrF0orVXmCHf3xkIBX6/x6ZG1A
dwaM7ktggCNBvo74eTng7WErvRRsbWeQnZlIi6gAnBIVgH0cO7iHo4d+4MrldmpX1WLUr4cMBhIh
Qa9K0h/TWmrn/vXpMcBQelXMryhgbmEac4szKMhOon5VLZ1Xzslxv8sXz3BFeP8Lz/+O81ILIIKA
9u3fwYIlZaxet5j1m1fSsHE56zcvo75xEes3LmPn7nq2f7+Gsup8Rk0ZTre+SgKgAsO3DoUAKHgv
J1QhLus77GvZBrB1MMXFy1raAtu5WmAvsutdLLBwmImzty0xsUG4OlrIICApCgzzRhXpIwOCkuNC
8XW3Ji4qiAvnT3J4/y727trIlo11nGo+QER8MH/q+Setqc0H9mH69+pusVkb/KfHLs95uZH/TQ3+
6rV2zFErrnzVXjH4z/9HV9962qzxhIW4E+DjQEiQK/5+jgT4O2JjPY3c3GRaTuyj6cgeTjUdoLX5
CGdbj3Pq+CE6OtqZZP4dn/TR5gP80+v5u9cG/wFdX/tP1/GP1+LDgfybRhjKStJ068nUVBXIxL/q
8nzZ/y8rzebUiYPaET+x+Xe0cflCqzz9X77Qxp0bHRw7/gPzqoupqp1NWVUh67eJmf/VNG5ZKdsB
6xqXsWPvWkkGotWhXaRVO8b6vq9fgeEfGgoBUPDO8Wom3aivAROnjcTCdhpOHpbaaQBvO5y9bbpM
gqywsJ9BQIg70aoA2QoQG78wCYqJEJ4AfsQJRPnh7DCL1atqOXFkH99vb+T7HevYtbWBAwe2Mdl8
oizffkgWwa+IkOiji5L6K8iy778A/f8W+hIyrMZYh08HfoqrhzVhwe74+zgSHOCCr489Pl52ONiZ
kpWeQEvTXlpPHeT0yYO0nT5Ce+sJKQa8fvUiiRmJdOvdTaspGN71t8pHbTtAPnb933/3943ogshm
EKdZMTYoJgdGiGkF7fNXLQV57R+Y292rv0VkJ/Qa2pPMrDiWLZ5L7YJSFlaVyNjftasXc/v6Za4J
AnCplasdZ7neqQ38udV5kXPtJ6leMJtlddVs3VlPeXUx5fML2bR9Fdt3N7D9+wZ27VnPDwcaqV1W
hp27lRzdFGv6d+RJgYLRbx4KAVDw3oRq3ft0Y9i4gcyy+g4rexFba4WDuxWW9jOxcTaT1QBr0Qqw
nU5IhDfBIZ74+zoTrwokMsSbKIFQb/naz8ue0AAvjhzazaH9Ozm8bztbGldx+MB2ahaV8+WQL+Uo
24dCAiQBEJv0EAMMBhrQrbcun3zTjT999Sf+9PUn8nm3XjryUfTg5eM3n2if/wcIq1j5b+S/+1PX
z35Ct16fyD7y//rifzFoZD/8/Z0I8HPE39cRH087PNys5TSAre000lJiOH54F8cO7qT15EFaTx3h
9MnDkgCcO3OcTVvX029kPz7p2Q3dPjpyBFAQgv/8t7zGN11/b6+uv/k1tP9G/J2vrlOgW89u6Bvr
S4LxQZGAUcI9UZ/uvXXw9HNk8YLZVJXlUVNZSHlpFsUF6ZxqOsjtGx1cudzGubPNWtHf+RauX23n
xvULrF23XI78bd5ezw/7N7Jh60rmVBWwZFUldWsXULduITv21LN152oK5mQwcsowuvfXwehjNLFS
wLuGQgAUvBeIU6E4nX4z9EtMLSbh4GqBs4cN9h6WWDrMlBu/jbMFtqIl4GqBndMsImMC8Pd3JjLU
Q7oEhgd4yJwAYR2sCvfG3noGVVXFNJ84wP4fNsuJgPX1Szh0cAchqkB0eutqhWzv+YNVa4qkPfka
Ghsw3XYy7r72BIR5oEoMITw2kMAwLwLDfQiN9ic8JohwVSDBkX4EhfvK7wVHeBEU7kVghBd+IR74
hbjLr0XFBqFKDCVGHUp0QiDRcUEkJITh5GSGq7OFJABi4/dws8Lb0w5rq6lo0lQc2r+VHZvWcPLo
D5xrPcbZ08doaznKmZOHaWs5zrzqEpLSY0nLSiQtM4GU9DjUGhUJKdHEJ0UQnxxBQnIUCSkqElK7
vp6sIjkjnrSsFNKyklFr4lAlRBAdH4Y6I4Hk7ERikqKIVkcyzW4KBoO1xPB9vz+v3iOjLuHfqO+G
UVmZL3v/lXNzqZidS05GHGvrFnHrxiWZ7He+rZkL7Sc5f7ZJQoQr7dzVwKKl81jdUEtD41JJAhq3
rmL5mhpWrV3IsjVVzKksYMXqGlasriYiPojPB3+uzW1Qygmni1cAACAASURBVP8KRr99KARAwfsT
Aw7Vw3CAPuOnj8TOxRx3HwcZECSmAUQLwNFdPLfByc0aG2dz3HzsiU0IxsvDXk4AiPFA4RgY6u9K
qL8bIYFu+Ho58v2uRg7v28Xe3ZvYuXUtO7euY9fuTXw7dZS2FfABnK60FQAD2esdNL4/rl4WJKpD
WLigmD3fr2Pvng1s3LCctfWLWLt6EQ3isW4hDWtqqV8zn5XLKqhfU83qukrqV1eztr6GtasXsnXL
KjZvWsmmjStoqK9lxdIKNjYuJSUlCkvLqXh62Er/fw9XKzxdrbG3m0FacjRNR3bLTIVDe3fQeuow
F9pP0NJ0iPYzJ+RkwJ7dm/jh+0b27t3M7h3r2bdnIz/sbmTP7kb279/C8aO7OHJwBydP7OHkiX20
nT4sbYXFZnjxwmnphX/tUisPH3Ty5NF1Oq+2cWDfNtauXYJKHcaAMf1kheZDqAC8Ek+KjfizIZ+R
kBzBktq5VJUXsKimlNJCDUVdEcodl9pobzshQ35E/O+5tiYZ/btj+1oKSzQsXlFGeWUhC5aWyV5/
w4blrKpfSP3aJfL1+s3LJSlYsrISK6H+l+5/7//+VGD4UUAhAArebzhQfx2MR/fB0sEUDz+H16ZA
7n4OePg54uJhi72z0AeI5EALAoQHQLS/PL1Gh3lJU6BgX2c5DhgZ5oWHqzWFeRpamg9z+MBODu3d
yu6t6zhxdA+l5QUY9DFAf8j7dwh8rQEYri+nFAz76zJ8wkCmzxgjryE/N4Fli8tZvaqGpYvKqK4s
lKpzMXc+b24WZbMzKRchNOU5VM7LpUI8luUytzSTqsoCahfMZt7cfOaWZLFsUTn1dQsI8HfF1mY6
7u7WuDia4+lmja31NFKTIjl9Yh9nTx+mteWwTLETvgqnTuzn4rkm9u3ZQkP9EurXLKK+biFrV9fK
qYu6FTWsqVvAuvpFNDYsZsOaxWxat5y9uzdyeN829u5sZPfWBunP0Np8iMvnxEa5n7WrFlAgTv+x
gUyZNQbd3jrS9OZDOv2L6oxOP13s3CyompdHxexsFi+cI0lAdmYCu3as5/rVc7SIlknLEa5dbuXK
5TN0Xm2nrfUY5RX5kgDU1JbKnr8gAGs3LJGbfX3jUnbuXc/uvY0cPLaNfYe3ULGwlMGTBsuq2Mc2
saLA8L1BIQAK3hukK+AgXb4c/DlTzMZh4zgLGxdzOQro6GGNvZsVto7mkgQIsyB3H0dcveyJTQwh
IT6UAB9H6QYYFqTNB5AIdCE40I0tm1dzZN8utm9qYPe2BnZvX8fhw3tw83WRUwFGH8Ap62+KfiMZ
uGM00IhhY42ZbjoW0xljcXOxID4uiIL8ZKor81m8cDYrls9jYVUxC6oLZB+6piqfmsoCqiryWbx4
NkUimKY8n2VL5rGodi411SXUVBSycmkFFeW52NvNxMF2Jo72s+Tvt7GaRkpytOz3Nx3dS/uZo7Sf
1pb+TzcfZP+eTWyoX87mjatoXLeUumU1rG9YzObGVWxYt4z1axdTt6yajQ1L2LJhOZvWrWD/95s4
fnAXx/bv4OSx7zm8fxubN66kZl4BWamxJMWHEh7uyZhpw9EboKu1bP5ARgvl3zDcULpIfjt1OAUF
yRTnp1CQk0JZSRY5GfFUlBfIuN8LbUIouY+mY/u5dF6bAdBx+Qx1q2spmpNBWVUeZZUFLFk9T5b9
121awaada6hdVsmqtbVs3r6abTsb2Lx1DdFJ4RgM0AYvfShrocDwDw+FACh4/22AgQaMGDsYc5sZ
2tO/rxOu3vaSAAhhoCAAnmJ+PdiNgFAPvPxdSEyNJDk5kgBfJyJDPYkM0XoERAqhoLcdaUlRchxw
7+7N7Ni+ji0bVrF39xa2bl/PqCkjZSvgQwoLkmTIRA/9froMGNWLqbNGM9NsHKYzxmBhMRl7B2GP
7Ey6JoZ5ZTksrp0jFenLlsxl4fxiWQVYtLBEWtJWVuSzZFGZJAALakqpqShgYXUhq1dWk6FRYWY6
EUfHWbg4WciKgCY1hubjezl+aDenmw5KAnCu7Rj7dm1k1bIatmxcSePa5WxuFG2FxdQtn88W4Vy3
ZgnrVteyekUNWxpXsGfnOvb/sInvt69j68aVsoIxrzyP7KxEEuKDiY8NIkMTQ1CYB4PHD0RvoJ6c
HHh1L3wwVtXGevQa+jUJieFUzsllTkkGs4szKClMIzsjgR92NdJxoYXTTYc439Ykvf/PtTbR2dHK
mvpFFJVmsnBpOUVzs6leWKLt+YvI3+11rN+0ghrx3q2qYduuBnbv3ciK+lqm2X0nxzU/FJGqAsOP
AgoBUPCe/dX15UbQb3gvpplPxk24/4V44OnnjLOHLU7uVji5W+PgaoWjmzUubjZSGyBChKKiA4iN
EdHBLsRG+cjAIEEExGsRGrRu7WKOH/6BXdvWsWvbWjbUL2X/3h0sWlHD1yZfa8utH0hWwOuWwFB9
OXb2+aBPGTd1OJY2kzEzG4+p2URmmE3AbNYkbO1NCQhyIzUliqrKPFaurKZuZRWrllezYH4J1VWF
LJxfyuJFc1ixvJyKshxZxl5cO5v61fNRRfoxfcpYvDy0UwCZ6fGcaT7AyaN7pQeAsAFuOvoDa1Yu
YMWSKjauX8bmDcvlJt+4bglr6hayYe0yNq9fwfZNq9mzq4Efdq2T611dXURmViKJ6lBiYvzlY2J8
MGmpkWgyonHwsODLIV+gIzZ/0e//AO7DV+svRhXFCVyYVHkFOLOgupiKuXmUzc2mfG4WedlJLF9S
0SX2O8HFc83S+e9aRxuP73fSsHYJ6rRolq6qZMmqKrIKUlm8fB4r6ubTsHEF67eson7dUpavnk/d
usXs2tvIjh/WkV2SxhdDvngt/vsQ7kcFhh8FFAKg4L1Caw2syxfGnzJm0ghsXczxCXLBO8BFagAc
Xa1xdreWOgAXTxspBBStAgubadItMF4dok0KDHAlLtpfpgSKiYBgXwfSU6I5uH8HO7Y2sKFhKY1r
l7KstpwjR78nOStRjqa9Krl+CHjdEuiakDDor8fICYNkaNLMWZOYYToBG7vpWFhPZZrpRKZM/RYb
++n4+DmTqolm4YJS1q1bzKoV1aypm8+qFZXUzi+hIFvNnFIN86vzWbF4Lo1rawnwc8LS4jscHWaS
k50ke//Nx/fJsb/2tmPS217oD+pW1rB8USVrVy9gzcr5NNTVsm1THXt2b2Tv3k1s3lxHzcJSsvIS
5ZRGSKQPYVG+JCSFkpISQUJCMMkpkSSlhjHFcjy6/XS1+Qwf0En39boPM5T3xBTLyRTkp1I+J4uq
qnxmF2VSlJtEQU4S+/ds4VzbCZpl2f8kl9pP8ejOdek8GRUTSEZuIvMXzaGoNIOsgiTqGmpZtUZE
/q6gft0SGjYuY23jEtas1woAV9bPx9nfXmtZ/QG0pRQYflRQCICCD8AaWA/9/nqYjO6PmfUUOQkg
Nn+vACe8A53x9nfFw9dRbv4iNEgQACcPK2ydzfHyc0SjiSY4wI3wYE9io4RBkBfRYZ74uNuwdHGZ
VK7XLV8gy9arlldRt6yKvQe2Y+FmIcuuH5rn+uvMhEG66PTWwWSsMabmE2QVwMx8Era2pjg6WWDv
PItZ1lOYMO1bvjMdh7WDKf4hHiSlRlFRkc/KlVWsWVXD4tpS5pVnU12VS+XcbJbVlNJQX4WnmxVm
MydQmJ8qT/6tzYe5cqlFbnKrVtRQt6KK5WKMbeV8OYmwddMqtmxaRUPDUhYvrSAjL5nwhCB8Qtzw
D3cnKj6QhORwEpPDiY0LIkK4NcYFEBHjy6jvTKR3gHBkfCVy+1DWXBoVDddu/mOnjfr/7L33W5uH
li76B+wdAzaOk53m3jtgOkIS6kINBKiACkhCEhLqBdFE7+69xyWxY8dxnMRO2+nZdfaZmXPn3uf+
cP+W9z5rCTyZc+aZ7T1nPJvE3w/rEcZNfCRe71rrLZieG8ToSBKD2X5MjCUxM5XBcCaEqxeP40+/
/4pVEn/88bf4w7e/xf/3//4Tfvfj5xjIxTAylcTs0igHUU3O5pAbi+Pmncs89RMAuHWHXi/h5p2L
uPPgCq5cP4Hpo8PYXb2zkPy3Sk4hQpW+MCUAAKFWhSlQEbmt7XkNddIKNLfKoG9Vw9CmZm+AdpuJ
X1XaRmgNUuhbFXwWaLU0w9imgs/fhYFcmOODez1W9PltCPps8Dha4HG24s7t8/jg/g32BKA19sVT
c/jwg9t498FNVDZVFKSBq2z6WjkJkAc9ScM2HXgTdU3lUGpF0GjFMJjk0OqlUDVLodJL2SxJqqqH
SFGLBjoVqETosOkRT/owNZPFsRPjuHBhAedPzeI02dHeOI3Tx8Yga6rC0EAE//zn7/Ev//wHfPnk
A9y6dpZVA+/evoB337mAm7fP4ezFRUwvDCORC6E71AVbTxs6XGY4/Fb4+13oT/gQiXsQT/sQ6nfD
77ciFO1Ch8OALYc28oTLLoCrbMVd2LisZ9LfzoqdGB3L4vjRcczO5JAfSXBOwuBAPxbmhllJQjf/
f/zzd/jLn77F//N//ZmNp+YWRzE5M4Rzl49i6eQkjp+ZweyxPNKDUdy+exV3HtDt/zKu3zyL67fP
4dbdi3j7nTM4d2kRNm9HwfmPYptX0XMRqvSFKAEACPV3rRUPe1oLv7x9HQ5X7+FGT+t+VgK0qJn0
R/JAan4tHQVgoG9V8q8xU3qgWY1guBvZgRAcjlZ43R3w9XSwbXCXRYt42M2NnwhsdAa4feUUrl88
ju+/fYIrNy5ge8V2ziZYTWvplWfDDXM/EdOK8crOl3Gkfj+aDRJodY0QS2sgVdZBphWhSS2C2iBD
c6ucm79EUYf6pkpU1h9Cg6SSfRY8PityA2EcO57H1UvH8PjRLaSSXgwNRvF///Pv8P03n+De3at4
9/ZFXL58DItH88gM9cMTcsLiNqGlU8dldhjQ5WmHo9cKh9eGQNSNeKYXyVQAmYEgEikfgv0OiLU1
eGX3Bn62bBO8ysJtVp4vnVve2PcG+uMenDw+hbnpIczPDmNmMouJ8TQ7Jd6+eRH/8j9/xwTJ/8HN
/0/47tvHWFjKY/7oKM5fWsSZC0tYOj1VAAD07IZjuH7jHO7cv8rrfzL/oTRAWv1fuXkS4wsDONhw
gJ/Pans2QpW+ECUAAKFWBwhY9gTYfmgj6sQV0BppC6DilT8ZBGmMcjSp6tFsKqz/De0qdg+k5k/g
wGhWIRR1I5UOwm41odtVkAQGfB2wmdWYyidx//ZlXL9AkrXzuHHpJN67dQH/8MffYuHkDNZtXc4n
WGUa7JVVORHmKEa5dNtaHKjdhSZNLRplNWhSN0CmboRMLYJSJ+Ef0yZA2SyGorkRDU1VqBGVo05a
iQbJEYibqqHRSdDZ1YLpyQwW5odw/vw8G/u8fe00jp2YRjrXj87udg5i0rYpoOtQsR6+xapDh8MI
i7MFDq8F7oAN7qAd3r4unvyzuQByAyGEok4cFu3Dms3FKN5TjLXU3JYDi1bTcy2Y/ZRgw64NsHW3
YnZqEPMzQzi6lMfc1CADAIpKPnViFt9+9TH+9OMX+NMPn+Nf/vEP+Kd/+g7z86MYGUvi2MkJHDsx
hctvH8fRU9NYOD6JqcUhZIYiOHvuKN57cA33H17nBECyAr7+zlmcvTgLT7gLr+zawM9oNT0boUpf
mBIAgFCrola2AK/sWo/ymr1oUtby1EqTvkor5eamNkoh14jRYqXTgBrNJgWfBugU0OHQo9kog7/P
iUTaj05bC4feOOx6dNl16OrQ4NLpOdy7danQ/G9fwNsXj+Ph3Wv4x//xHVL5OGcTsB/9KtsEFJ7P
Oqw9vJZXxRTNu618I8SaGsjUDZDI63g7otCI0KRsgFhey81frhWhXlKFWvERiGTVbLlMIIoAQm1j
OaprD0Gnk2J0NIqhXBRGowoKTSODLZOlGS0kxbRooaeMhg41tC0U19wMe7cZnj47XD4LeqNO9EXd
CIYdSGd88Ee6sKtyB9ZsLmKC5b9JMFxFz3LF6Y8Y/21deizND2NyLIOxkRRvAGjlT9yIo4t5fP3l
B/jLH7/Ed198iH/689f4yx+/xslT0xidSrDef2p2EPNLeZw8PYsTZ2bY3jeRDWFsNosbd87h1NlZ
zC4OY2ZxhAmC568u4ujpcYi0dU9PI6vp+QhV+sKUAACEWl1bgK1F2HrgDdSJy6HWi6HRS6A1NUHf
pkRzmwIKvQQKnQS6ViWfAtooPbC9GXqWCaqgNTYh0OdEKNwNS5sW7a0a2IhHQIqBQCfuv3MeNy+d
wq1rp3Dr+mkGAU8evYs///kr9MY8KKapdReFBq2uTcDKM+I43QPrsGb7GjZQqmw8CLGyBo1N1RBL
q6DQNkKiqEWTsh5SZT0aZdUcBUxnAFFTFW8ECCDQmcXQIuezQIdFh7HRFN577xqGhuJwuMz8HNUG
CmWS87M1d+rR7jCiw9mCji4TevosDAC6/XYEow5EUz1od+iw8eCbeGlbEZPqVlvjf/oMDxXAJpH+
KHqanBOPzed58p+eHMDMeA6L88OYmx7E/btX8fvvHuP73z7CH3/4DL/79jEuXlzExEwWS6fymJjO
YHJ2APMnRrGwOMaKiJPnZxCK+5DI9mFmfhBDI1GMTaexeHIMJ87O4tzVRUQzvXhz3+so2kHSv/84
ZlkooUqfUwkAQKhVU6QJp3UorbkPVu2GXN3ATHddqxw6swLNpsKNm9IC9W2qgi9Ahw5tNj0MLSro
WhRceqMCwbATPq8dLQYF2luVzHhvN8qQHwjhPmnZL57AOyRtu3wKNy4dx2+f3MOPP3yJvrgfpVtK
UbJz7aojBv70OXGY0vYilG4vxd6qnaiTVKBefARieU1hyifZoLyOG369uBIiaRU/T1OLAk6XCXa7
Di53K8anknC6zWhqqsFHH72Dv/zpG7x78yyW5gaRiHth6zTw90BjaGJPhg5KFezt4Obv9HXAF3bA
G+qEzCDC+t3rUbKrpLBBObR6mz+t/UldoTRIsbgwioWpQRxfGuOaGR/AwswwFmZHceedi/jsyT18
/sl9/PH7z/HDtx/j9OkZzCzlsHh8FFNzOUzODGDpZB7HT0/i9PlZnLkwj5Pn5xDL+BFPBzA2mcX8
0RHMHRvFHLk2np/BwtE81C0yTnskfsdqe05Clb4wJQAAoVbfFmB7ETbtfwN1TUd4EqVbv8mi5tu/
qV3Fa38yCbJSM+ppg7XTiI5OPUxthc+baX1t1sAf6EIw5IC5RQVzS8H7vqNFifnJNB7eu4o7Ny7g
wXtXcOfGObx36zyH4fzlT98jlunH2s2FRrHaiIH/5lmRhHJPCZ8EtpdtRq2kHI3SKoiklRDT5N9U
DZmyHjq9FDZbM3zedvTRzd7TAYulGeGwC7mhMDsM7j+4HXV15UwA/OazB/jo/bfxyQc38e6N8zhx
dAJDQ1H4g0602Q1osWhgcRjRE+yEzWvG4Yb9rO9nS99llv+qbf57ilGyhTz+1Th+YhwL04N8+z+2
kGcXxamxDKZGM7h5/Sy+/vIhHty5hh+++Qh/+N1nvPYfmUhiZnEI0/OD/EoAYHJ2kJUAJ05Psfc/
bQGiqV5MLGSxeHIcY1MDmFkcxtFTEzh+ZhLJXABbD2/mLc5qfFZClb4wJQAAoVZVrTS1l7eXoqxu
H5Q6MczLbH9DmxKmNjXM1mbY3S3odLXCajPAYtOzVTABAvp5vYm4Awo+CXR7LQiGutBpNcBuaYa9
Qw13pwGXzs2zoQ01uPffvYx3r5/Dh/eu4o8/fI6//MMP6Ev0sm69ZG/JqpOu/fRZMXdiXwm7B7KF
cFMlmmR1aDHJ0WnTwdPTBr+3A73eDnh72uF2tMDSroHH24GRfBTxpAcd1mY0iitx8OBOtLSo8eiD
W/jw/g08uvc2Pr5/E59+dIfr4w/fwa2bZ5FOBtHj6YDJosGWss0so+Ro41X8nFbW/hQJrWlV8ORP
wUlL8yNYnB/F7CQ1/zTywzFcOL2E77/+GJ9/chcP713npMNTp6aRHQ5jbCaDsck05o4OIz+dRnog
hOxgP8ZnMlg8OoqTZ6Zx7vICW1UHw26MTaUxvTSM0+fncPntYzhzcQ6tXc0oWvZE+Hs/G6FKX+gS
AIBQq9MXYEcRth7ahEZFDU//RPrTsQJAA2OHln0A7A4TOix6dNgNaLPq+RxgMCt4XU2OggbiBBhk
cPSYEYn2wNHZCneXCRaTgo2C3r58FNfPncSdWxfw3juXcPXscXz28R12xPuHf/gB4WwAv974a5bg
rWqiFq3b963Dr974FRoVVfB72+BztyHgtaDH0cpN3+VogcNu4Mnf6TJjbCKBRNKHSKIH7dZm1NeV
s9FQeflepNN9+PqLh/jw3g18TGDg/Rv46IOb+OThbfz2yfv49vMH+OLJPejbNPx3rvrmv0z4e+mt
lyDXizFLpL3JAYxko8gPxzE9kcWxxTxGB+M4c3IeP37/GN98+SGePLqDr758iImpASQyQb71j09n
kJ/MYPH4GJv9TC0MYuFkHlNztBUoeP+fu7jIk3804cfE7ACOn51m059L144zMZBJkiQ7XQXPR6jS
F7oEACDU6t0C7FiP8voDUOuly4oABVqtWpht1OjJC0CNTrcZNqcJdlcLjGbKCJCxVNBgVqHVqkGL
TcMKApenHclUL7qd7fC4W2FplSGb9HPAzZ0bl/DBneu4c+sibl0/gy+evI9vfvsYf/rzj0iPxLB+
y3qs2Vq0ejkBh0uxlrwCthTDbFXB52mFvb0ZXVYD3F1GuLpa0NVpgs2qg8Wq54l1Yi6F/ng3woke
3qiIxJUQi6shEtFrFS5fPI5vPv8QHz24jScf3sHjR3e4IT68d4M3Jt999QjhZID/TgIAq+25/GvS
Yik7KtI2R9sqx8LCCKbyGcxNZDE3PYDhgRib/UyNp3Hx7AJ+/O5T/Pj1E3z7xUOWiC4en2LPg9ml
YUwtDGF8ZoAZ/OT2N7NAzP5hzCyMYP5YHicvzOD0hTmcPj+Ps5cWcfbiAnsCXLhyHG/fPsMcgXaX
oXD7P0Dvc3U9M6FKX7gSAIBQq65WdO8l24qwad+bzGQ3tCvR3qlHm4WigXVos5P2X81mQBa7gc8B
7TYdEwbVBgmTBWkTQHI4kg+yEU6vDfG4F36vDZ1WHcytSpw8NoEP7t7goKB7717ClXPHcPvaGXz5
+B6+/vIj5gSMjmfx5t43eGpbSRBcLQ3vp01u48E30OXQw9ahQZdFhy6bAY5OPRw2A2wWHTosWvQG
ujAwGkFfvxuRpAeBqIuJkw0NFRA1HIG8qR7V1YdgsRrx+MM7+PyT9/HZJ/fwxeP7+PLT+3hw9zpz
Jz796B22vX1j/2s8Xa+W57HyTNjel27+u4qxftd69jQ4ujCGeUr2m85hmiR/wwlM0SZgMIb8UBIP
37uOP3z/Kb77/CP87usnuHL1JHxhF1zBTozP5jB3LI/J+SHMLo4wGJicH8TETA6zR0d5EzA+NcDx
v8fPTGPpxCQz/k9dmMeVm6dw+uI80kMh7DxSMJ1aL9j+ClX29y8BAAi1KotjWUkRsH0dDlTsZJ17
h10Pm8PIE2tHlwGWLhOv/+n2b3O0oL1LB42RPAPEMHaooDcrINOIoDZK+BzQ0q6Gy9OGUJ8LgYAD
dlsznDYjbt88iw/eu4FrF07gnZtncPH0Ai6fWcQXj+9yKt4ffvgC80tj2F6+rRAjfLB01ZDdVsKD
6H2V1e9Fp1UDe7sG3Y4WBgDtLWrYO7SwWbRwdbchnetDONaD/mQPT/9E5CP/BFF9BZqINCithVIt
wpHqg8hk+vGHHz7Dbz/7AF99+QE+/egeHt2/ifffvYQP3ruMmzfOokx0sEBmWyWs/xVARNsasvd9
Y9/r8PQ7cOHCEqbHshjPpzA5nsHURAajwwnkhwp1+fxRfP7xe/j2s4/w43dPcObMPCIpH2K5ADwh
B4byKcwsjbCe//iZKW78k7T2Xxxmhv/4dBZT84OYPz6GxVMTWDw5iaOnptge+PzVoxieSEBqaETx
tuJVK5EUqvSFKwEACLWqtwDkDvjGrldRIzrMagDaAFA6YEenAfYeM4cF0eRPLnVqkxxynYhlcNTw
rS4TWu1aaEwyGNtpW6BhUyEKFqImGIl50GkzIuCx4eH9a3jvnau4ev44bl4+hcvnCr75H75/Hd9/
9Ql+//3nuHz9NCokhwvJbbTCXQX/iBc4E+s4L0CmqkWXTcchSD3OVjjtRljJSbFVBYtVh2i6l2/Z
kYQXfdFuhJIe9ITsaDY2QSyqgqypBipFA9TKRiiV9aitK8OZU/P4yx+/wmcf38cnD9/Fk4/v4sG7
V/D+Oxfw8Ue3oDHLudFSrPNqeBas2lgO9tl9ZCcT8WZnhnDq5DSOLeUxMhRn0yO6/Q/lIsiPpHD+
zAI+fnAL3/32EX7/3Wc4dnIa/ogLsWwAmdEoPKEunvgnZoaQIm3/4gjf+2eOjmBiLofhsRTyUxlM
zAxwXsLC8TEsnCgAgUvXT2Du6Aj/t1qI/F29yhKhSl+4EgCAUKu2yD6WGO4lO0qw69AWdrBr4RwA
IvrJoTHKmB+gMUigMkjQpGmEQi+GrFkEOQcHydDcIoPaKIOWlQFq6MxKaIxNsNpb4A+6MDAYQbe7
nQOEHn94m0HAtUsncP3yUZw5MY3p0TRuXzuNH777GD98/xm++vpjWD1t+NXrv0LRrtWhEKBn9Oru
DTCYZPC6W9DrbYPX3YYuSzMDgrY2FbwBB1vTJrJBJIeCiKR7EUn7EIw5YWxXQiqpgVxWB626EWqF
CCa9DBq1GKLGKrxz8wJvQp58dAefffIePrz/Nm5fO4lHD66iL9mDEgqz+TuSJP/13r8eJXvXcfOv
V1VjemYEZyiqeDCKXKafU/3y+QSy6RAGM2EsLY7h/feu4qP3b+C7Lz/Ej98+xtT0ILoDNgZHFHBE
kb7+iBsTcwO4evsMcqNxjE6k+cdjUxkMjSSY6Dd7qAPyBQAAIABJREFUbBgjE2lMzQ9xNsDM0jDO
XFnEifMzSA714WD9Ppa3ksz17/3fi1BClS6XAACEWt21zOB+ddd6lNXug1on4ZwApUECOdndNouh
1DVCRa6BBhmn4xERkJq8SieBRFHPHxNpsLlFxSoCja6JLYZtDhM8XjumZgbg7bEgGnbi/t1LuHbp
JE7Oj+PU0jjOnZ7E/FQW1y4dw1dfPMD33zzG7373FWKZEF7d8Sqvv5kc+PdagS/f/7eXb4bFRqt/
E7zdZnQ7W+DqMqC9TQ23pwOZ4TDCMS8iSS/CSS/So30Ixd3oi7pgalVAIa+HWimCvlmKFqMC+mYZ
LBYd1OoG2G0GfPn5PXz12UM8fvQuPvrgbdy4RJkKF1j3/hpPtsV/t2ewohwhtcbareugMEgxOz/C
Dn9HF/I4c2oKk/k0sskQRkdjSCeCWJwb5a/p608f4JtPH+Lrzz/A/MIIvCEn+mKFZ9QX82BgLIbY
QAC9YScuXjuKE2emMLM0hOmFIZ76iRRI54C5o3lcfHuJ5X4L5C9wbIzZ/6OTKRitWjZsIkmp0PyF
Kl1FJQAAoVZ1rfzjXrK9GFv3v4W6xoqn8bcak5Qn/kZFLXvikz1wu13PHAEqsgpWaCUMDKjxk3RQ
16JCs1EOnUnBwTb0+fYOHXIj/XB0GtDntbFHwJkTUzixmMfJo3mcPDaGxblBXDwzj48e3OJY2D//
+TvMLo5hb81OvLRlDUoozvWn0+h/17Nh46RiVNTvZ8Z/j9MEp9UAp12PTpsebk87Urk+RFNermC0
h6fbvng3QrFu9Kd6YGhRQCmvX27+crSbNeggG2WzBp12A5qbJRjM9bMxzmcf38OTR7fx8N5lvH/n
Ij54+DYONx4q5Nn/N25DfsryJxUCcSDe2v8mnL1WHD0+gYFsP4ZzEfbyX5obwcxkBoMDIWTSfZie
yDB4+eSD2/juy0f47PF7mJ7JoS/Wg9xEDImBECKpXmSGQxgYiWJokrYALmSH+pEfT3LWRDLbh9RA
CLl8FENjMQwMR5Ab7sfEbJrBwcLxPPJTSfgjDmwv28rvb7XwJIQSqnS5BAAg1KqulX/kSRa4flsp
DlTsQqOyDipDEzd9UVMNxIo6yLWUfidmRntrhxY6owKq5ia+/9O5gNb/po5mNJuU0JsLboJtdj30
ZiUapJVMHCQPfJOpCZGgA2dOTWJhZgiLM0McFDM/lcPYUAwLs4P4+NFt/P6HL/Hjd5/h+ttnYbI2
o3RbwcGQVAL/XY2Q5ZL7SrB+Rynkqlp4Of2wHb6eNp7+nY4WpHJBJAb8HHWbzPUhkvGhL+5BOOlB
LONDJOWBzaGHRi2CydCEDrMa1nYtl629Gdb2ZnZQNBllOHt6Fl9/9gEePbiJB3cv471bZ/Hk41uw
+9oLDe6/Cfz8a/MvEEVLtpfgsPgQIqkAFmbzWFrIY3Z6ACNDMUxNpJEfiWMgG0Iq0YvhoSgunV/A
Zx+9iz/88IS9/lPpAPoTPRgY7ef44+xIBLF0AOG4jz+mM0B/0sfmPqPjSaQHC40/NxZBPBNAZjDE
DP9w3MOvi5QLcHwUmcEwGpRVWLNpzdNgpL/3/09CCVX6kxIAgFA/K4vgt3a9hrLag1DoxIWwG3kd
tC208pczAFBoxNDqZdC1yDktUKWTQm2QQmuUw2zVcbwwZQiQuyB5BRCPgPgDUlUdJKo66FtlMJrk
CAW6uPEvzA1hdCCKscEYZibSGBmMYigbwaOHt1kd8OWn7+PJ4/sYGkthe/lW1ptTYl9B5vV8gQAr
JXYV4429r8HcroTfQ7f/Qgxyl92AWNrLN/9gxI1Ezo/+pBexgV6E4j0IRl2sAogPBmBx6tFipslf
jbZWJTotOtjammG36vhju0UHk14KZ6cJH394k2WB79+5jFtXT+Hh/euYPTaKX29c89zNklYaP0U2
l+4vZTkdxenqrCoMjiTYw//EsQmcPDqFU8cmsDCTY6nfyEgEyXgv8qMJXDy3gPduXsTvv/0Ed++c
h6e7A/5wFzd1cvqjBk7PLDUURl/Ch1DCi3gqiGQuhNRgCLNLI7wdCNGzzPoRy/QimvIjOxzB0EQM
GXYFzGJyPgOb28ReFvQ9Wnn/f+//l4QSqvQnJQAAoX4WRet1vqFuLcHuw1tR03iE7/+k9Wf3P6MM
MpWI7/209ldoxTzdGy0aBggFa2DKEtCwVTDzBQxSaExNaNKIIFERmCj45xvbVTC2KuF2tSI/HMH4
UBxjwzHkB2OYGE1gOBdGLhnE+/eu4x/+9C0+fXQfX37+ADdvnIfWrMCv3vh1YSVOcsFlxvd/9T/+
vP4/tJYtgPcd2YluVwt6ukzMAbCYVejuaUd2rJ9T54jM1pfoQX/ai1CiB4GIC72RLoQzPVC1SrBx
/xvYVbEdRrMcXV1GTk90WJt5i+DqMsHeoeMwJbWqAZm0H99/QwZBN/Howdt4+P413H9wDVsqthYa
3X8x6Pk3ccIk7ztUyryLl958CeWSckQzQczNDvG25tTxKVw4N48LZ2exOJfH7NQAJsYTSCX8LP97
9+Y5PPnoNoOXo4ujHIJEk396sA+ZkX4MTyYxMp3EQD6OoakUsmMxhBI+RNJ+pIcjiGUC7ACYG40y
eKQkRAIAdCrIjUQxOp5mmWB+Ko3esAO7j+zgzYjA+heqdJWWAACE+lnUSsMjotdruzbgYMXup3I/
dbOUJ3+ZspEjbGkb0KRshEzdCJ1Zxf9YMy+AgoKsWrTbm9Fm18FoUUOmbUR9UzVqJVWoa6KqRJNW
BHOnDiqtGDabHlOTWcxM5JAfLACBscEIcqkAUlEvblw7jd//+Dk+evgOPv/kAb757SNe/W45uIlt
hDkd7zkAgafEt63FqJOUo8fZgk5LMxy2Zlg61PD3ORAMu3j9T1N/MNrNIKA34kRfohvdISuq5GUo
3VnKYIWa6hsHX4dc28DKgS6bnid/AgN0DqDTQKtJDqWsmkmRZBH8/t3LeP/uFXz+2T20OvTLBjcv
/5cDAHp2fAbat5YlmG8dfBO27jYsLk3g+OIY5qYGcOr4JI4ujSKXCmMin8L83CAmx9MYSAWRH0lw
6BOt/W/dOItUKgBHTyv8YQdC8W5+5e1I1s/NPjUcRiwXRDjpQzQTQGqwD+lcPyf8Eanv3MUFhKIe
+KNuDIxGMZiPYmIqgxOnpnH24jyGpxKokVXw96awFfn7//8jlFCl/04JAECon01x0yPL223F2LLv
TVTVH2JFABH6NPom/phUAM1GBQMBla6JCYPkCkhRtu12HW8A6AzQam9mfgDxCUSKaoiUdWhQ1KK6
qRINHKnbwL4D5CDo6mljEtnsVBbDmRByyQCGB/owmA4iFfNgbiKDe+9cxuOP7uCrJw/YPOfm2+fR
ajfi9d2v4aWNL6F4T8l/qZUw3//3lmDDzlJo9RL0uMxMYiTHv3DEjWC/E26PBb2hLvijLgQiTnj6
7PCGbDBYVdheuR1rtqzB2n3LK/VltQWtrCsbD6KtXcNAwExkSbMKbS1KfjU2S6BV1OPMyQk8+uAm
3nv3Mj7/9C5mlkbxqzd/hfWUbf9f8DWuuPnR6ad4XzFP0i/v2gBxswhD42mcP7vAQT75oTiv+udn
chjKhpFL9yGbDmNmOoPxfALj+TTef/cKvvnsPs6fnYEv6EBntxm+vk7Yuk2wOVvZHyE9FER6KMy6
/9RIPxIDdAYI8Ws8HWQeQC4fYeIk2fzefOcCpmaHsHhsFCdPT+LilWO4To5/56Zh7zbjlV2voGTP
6s1IEEooegYCABDqZ1XUFIgQWLK5BNv2bUZtYyW0hiboCAi0KpgESI2fOALU+CkPoHk5H4CihAkI
0LmgSdsIqVYEiaYO9bJqiBS1DAbqZDVokNVAqmpAo7wemlY5jB1qdNqN3GBGczFk4r3Ixn0MAAZT
ASTDPcilAzh9bJKDcyhIhuSCjz9+D8eOTUDfrsbLW1/m6ZVIezzRlv3ntwErKYBFO4uw9eBb6Ha2
ore7gz3/Y+TwF/PA7bPAE+yEy2eDw9MOp68DHU4DKsQH8PLOwv2cPfxpM7Fsm8uJeXtLsHbrWmw7
uAVKbT3aLRqYW1VoMcjQSgqBViV0GhG7DN599zw++fAWHj+6jXv3r2DToU1Myltf/p9vek9X/tT4
95YwSFm/vRQ1siNswnPq1Awunl3ChTNzOHE0z2eZ/GC0cKIZimJiLIGxsYLJD9n9vn/3Kr54fI81
/86edthcrXD7rfD3u9DWpeePc2NRvu8PELFvPI70UIRv/onBPiYBjk6lMDaTxcBojAmUxP6/e/8q
rt84g8XFMY4JfvfeBZw9N4dIwoMd5dtQtEMw/BGqdNWXAACE+llVQfq2FkW7irFu61rmA4hltTz9
E9FPZ1Lyq8ooZaUAcQKUWlIHyGHp1MPla+emTo2+Ud0AqU4EkbKWeQCyZjGTCsWKeih0Esg0jRAp
athzwEThQi0qJOMejAz0Ix33Ix33FcBAyo9MwodUzIuhbAgXzszj0yf38N3XH+PLzwpe+guLY2hQ
1GDdjnW8cucEPQYCf/tpYKVBUhOvrD+IcKATPQ4zAv5O9Mc86Om1oifQCZfXgi5PGxw+MzRtTZyu
WLS5iCd9kg/Sn0GAhG73P31Pa/etRfG25Ujm+r3QG5vQ2iJnmaBBJ4GFNiNqEXKZAD55eAMP71/F
J49uQdYq5hPNy+V/+xng6a8/tBxvvGUNBw0dFh1AOOHFqROTuHx+AW9fOY6rl4/h+MIYpkaT3Pyn
x9OYZIvfFCbHUhjMhjAxkuStzEcfvMNpfp3uNtjcregO2OHyWBEf8MMdtMHhbeeEvhxJ+fLE6u9D
PN2H9Eg/+lN+dgMcHItheDyBobE4sqMR+EJdmFscwTt3LvDa/+TpGRw9No7BkX7Uyo+gaEvRU2Mk
AQAIVbqKSwAAQv3sqrAeXoviHcV4ZfsGHCjbxc5/ar0MSm0TNPRK5kA6CW8EaIJv7dCg29uBrm4z
JJoG1CsLAKBRJYLKJIPOokaTVgyJsh5NKhFkGjFUxiY0KupQK6nkUKH2Th2b5rjsLRhIBZBJ+JGK
e5GOeZGI9DAISBNpLOxGpM+NS+cX8d3Xn7BvwDdfPmIjofx0FrXyKpRuW8uqhrU0cR+kSfzZmwWv
//evxdotxdAbJcz877KZEIn3wOO1ocdnRbfPgi63GZ2eVog0NSjdsTz171v+uw6sQ9GuIj6nlMkO
oUx6CC+tRB/TqYLAwZ7CzX3j3tchVdWyOkLfLIFeK4HJ2ASTTooLp6fx3u1zrA4g8xye2A8XApOe
/Xu5PPHvKebfX7SxCIcaDrAM79LFo3j76glcPDWHK+fnsTgzjPGRBHKpEMaG45iZymJ8KImpsQwm
8kkMJINs+nP/zhXcvnEesWQAnd52tjzu7GlnYNQbdvFt3+GzMFF0eDzJwT6pwTAypOfPxzA4HmPp
XzTrZ8nfwHAMQxMpDObjrKBw97TjxOkpnL94FMdOTGIkH2PXyXXb6DTzr+BOKKFKV3EJAECon2Wt
NMGSbSXMB6hsOIzmFiWT/cgHgG7/xObvdLXA4jDA4aXcABNHwko09RCp6tCoaYCEzgDqejQ1N0Ik
r0N9E20DGnkDIFWKICZ1gKoW1Y3lLBdsteggUzTAatVhOBvC6FAEqZiPAQBVKtqDbMKHWKQbbkcr
sskAHty/wXkCv338Pv74uy/w2ZP7vGIul5Zxw3hp60tPG/Mzr/93F+P13a/C0WWA3aJFoK8L/QkP
PH4rcxa6elpgsCmxp2YX1mwpZg/6lXU//V1rthVhw84NKGs8gK6+DkweG4bGokLJ5rX8ftYdWF/4
9ZQzQNn129ahQnQAagpaMjShlc4uahFbDj/64DK+/PQOjp2eYcc7+vP/lu8j/R0lO0uwfvt6HKrf
j96QC9eunOF0xgtnF3H96nHMTeUQ8TsQ9juQTQRZjjk2msD4SArT4xnMTWYxOhjDyaUJnvrPnl9C
d6+dNyDdQTt8EUcBAPR1Ikq+CCkfOpwmmLsMSAyFMXssj+RAGONzWUws5NjqlxQBmdF+jE4nMbkw
gJljw7wNIDUAsfzJVZGc/+aWRuHwm/GbHRv4WQmGP0KV/kxKAABC/Xxr2SCodMc67Di0GXWSSgYA
Le1a9gQgwx9LpwEdnXro25TLUr9aiLUNqJPXoqapCjXSStTJqlErrUKDssADoKlfJKstnAPoxwQW
lDUMAuj3E9eAtgtWix7pWC+GB/pZEZBkAOBBMuJBtM+FaMiNgNeOgM+G2fEs7r17GR9/+A6++vIh
fvj2Y9x97zKGJ9KoU1WjiCbvZ2gcK6x4kv8drNrFlr+OTiP6+mkq7YCzpw0WlwEidTVe3/8as/uJ
OFmYsgtEv+Jta7G1Ygsa1DX8Nct0UkTSAUwfH0Uw5cOeqt1sXrNu77qClHF5Oi/eWoSthzZCrKiE
gQCWoQlaVR0GU7347sv7uHP3CvY17ClE8BKx8Bmn/+IdRTjcsB/JwTAuXzmJhw+u4/K5JV7zz00P
YnggjEycQJYXqVgvhjJhjAxGONAnn4tjZjyNmbEMzp2ew7vvXMJwPoVWCkXqaWPVA0X6+vpdcPg6
YO+mz7kRjHXD6mqB029BOOXD5NwgUjkiAfZjbCaD/HQG2dECGTA7EuU0v9HJJG8IBsbiGJ/LwR92
YmAwjGjSg10V2xhU8fZEaP5Clf08SgAAQv1s62kD2V2CDbtexq5D27lBk95fbZCxFTClBja3Kljq
R9M8TfpSIgA2iyBW10OiFvEWoF5Rw6t+2gZQ6BD9OfVNVZCq65kgWC+thEhWg3pZFUSyajSb5ewV
0N6uRbC3E4PZIAbTAW5U6agXIW8nenssiPQ5EevvRijQiWjIxZPr+dOzePTwJu7fvYK7dy+jL+nl
wCM6BTzT10wNeXsRFM31cDta0ONug9PdBoe7Bbo2GXZVb8fanetQQlM/WeUeXFZPbC/mRLojTRVQ
GMX8DA7XHoShQ4v0SAS+qBvTR0cxe2ICmjYlSrcsT/8HljcHB9YyV2DDrvU4WL0bKnUDjKSyUNXj
2MIwvv/uMQzWZk4HfNa8ez5lbCuBxiDFsaNjuHr5OPv0T09kMTacZE4FAayJkRhGhiKIhj2Fz2X7
WZZJ7P/8UAzTkwOYXxxhuaPZpudm7/Jb4fR2oC/ZjWDMDae3HZ2eNpbvkR2yy98Bl8/CjogTMxkM
TyYQywSZ9De5kEVmKIRkLojkYD/Sg2GW+9GvGZlM4+jpMSQH/PD6baiTH8HaHWsLQEto/kKV/XxK
AABC/SJAADWm3+zcgEPV+6FslnImQHuXgd0Aa8VVBZ2/rBpijQjS5kY0KGvQ1CxCc5uCCYOkBKgR
H2GgQAoAChqS0q9V16FBVsVFckEi8onk1QwESDNP4ILuyHaHkfkAI9kQqwKCHjv8Xiv6ejvRH3Ty
eYA3AxEXQr0OTI1n8fblE7hwbhHdQRuKnxUAUEIiOQ1uL4XFooHDboDDYUKbTYMaWRle3fkyinYU
PyX00Rq/ZF9BOknAQGZshKZNAblODJG8FrXSShg7mjEynUV0IAR/3IeJxWFcuHUK8ZEQNh54i90N
Wc++fKunrQu9380H3oREXgWtpgEmfRMe3LuBsZlBFBMJjv7+Z/j+Fcyd1kKuqOOTyWCmD8PZCK/z
J0dTBROmkThyiRCDp2w6gIFEEGODUZxYGsPYSALBkBPBiAsObwecPgtHHVOoD8X4dvV0wNVrZQkk
kQBp4g9QBkLSg67uVnT7bQhFu9nHf3QyjcwIcQCiSGYCSGT9rOnPDPcjng0W7H9HI5iczWBqdoBz
FMSqGraoJvdHgfUvVOnPrAQAINQvxB9gLdZsXoONu99EvbSKiX+6FiVqxJWorC9DlbgCZXWHUF53
GEdE5agUl6NaWgGRqpbX/Dzly6vZA4BW/iJ5DeroLCCrgVhZy2oAKvq1FDfcIK9GRd1h/jXkJkiR
wzqDAsFeOwaSvYiHuxHsdSDU24VoyIlo2M3r60zSj3ikG6FeJy6fWcIH964yAKBAn78GAFbW/wR2
dpZtgc2ug9Wqgd4sw/ayLSiiUCJSRxws+OQXzILW8XahvOkQDFY1lBSgZJBCpqc0RTF7H7TY9Ria
ymCAJHDjUYQzfqTyEZy8sohjlxfRoK/jtf7KiYK3CrQNIMb/7vWoFO2HSlWDRNSDK9eOY1fl9mc+
A5C5T/GmImh0YnjcbXxK4eafT2FqLI2JUSL4JVl5MU6e/qkApsfSOHdyCumUH202PdqdRth6WtHl
b0dnTxt6gjbOPCASXyDuRnewk8FBl8cMV8DKAIAMgLroRNDvYKOf4bEkjp2Z5PU/2QGT6Q+FA8Uz
fgxPxDE4GUdmJIzscD/yUylkhoNQ6BtYKVG8k/gVwvQvVOnPrgQAINQv5xRAd+otxdhVRlbBFahr
rEK1qAIVdYdwqOYgDtccRHntIVRJjqBCVIFKSQVqmqohoVAhAgGqWm74lC5I6/96KQEC+ri6cEJQ
1kKuFUFMGQTLgIE4A8QtoDAirUmOlnYNXN1mvvsnIh7Ewz3oD7gQ6+9BKu5DrM/LZ4FkzIsbdO++
fwPuQCeKt//1DcDK+p+Y+XVNFTCb5ZAqqvDa7ld5VU/r9NKfNKIVYETngDLJATTpGqGkmGSTDBJN
I78SF6K104DhqQySwxEkhqKID0UQygbRE3ZjYmkU9qCNSXor7++n9rw0wZdsX4s9FdvQbGjE9FSa
1RN0BngWGRwRBon1r9GK0e1oRSzUzU0/n0sgn4tyANPUaKrwOQpjmhnG0aU8vL2dnOTY5jDC4jah
w9HCN/22TiPMVtL3W+ALOxGM96Cnr4vPAR0EFFyt8PW54A06GSx4gnZe86dyISydGsPIeBzRZC+G
JqJIDvQhEHYjnOzhhp/IFcyCKFRJb1FgA/n8M3dDmPyFKv1ZlgAAhPrFVIEPUIwNO1/GnvLtOFS1
H9XiI0zeo+m/rO4wKhrKUC2pRLW0EpUEEriJU0Ov52bfqKqHSF4PiaqhUOoGnvrJIlisImJgDRoY
ENTwj6WawrlArmuETCeGtk0BjUkOrbEJdiLn+R3c7GOhHkSCbt4EREIu9gy4e+s8Pnn0Drr7uv7q
CeBpw91Xgpd3rYdEXY3d5VuxdktJgeh34H9Pm1vZGFCT2nZkC58wSC7ZbFZCY1ZCZZJDrGlAh7sV
+ZkB9sAPJQPIjCUQG+pHMOnD3KlxaO1arNlWzFbM/9t7W47jJX7B63t+gxaLGi1WNdbvKmwJng0A
rIFWJ4G7y8TgaHw4zlK/0VyUCX8EABamh3D65DRGx5LodJvRam3me36Hw4QWq47PPR1dJji8FnhC
nXD77dz4uwOd6A7Y4Al3weJqgc1t5jwESkOkTYHLZ+VshGjah9GJJPKTSd4A0L1/ZDLGiX9kE0yB
SpmhPuTyIXQ4DHht7294EyNo/YUq/RmXAACE+uWlBtJqekcpth3YhAOVe1HVWI4qUQWqxEe4qsUF
5j8BAeYFqKjJF5IFJSoRGppo6q9hJUCTupGBQS3zA6qWTwCNBUWBgs4HtcwlUBglLC+kzyuaJVAY
CkXGRAQEej22pwAgHCRioAfv3jiPL57chyfkeCYS4MpE/5tDr+KNQ6+xPS7f0P+D9TN9nkDR1mUA
0CCrZVBDZkjNbSpItI2wuNv4dj8xP4yBsQQGxpOI5cIIxLw4dW0JRpcea7YW/bsA4Ok2gHwFdhbj
N/tfxf6GPXh534ZnAgB0Aljz5hpotI1w2Yws86NJfzQXQT4Xw9RIkpv/5EQWkYQPFpex0MhdrbC7
W/mu3+Ewoo3ij/0WePqcrPP39TvRE+yCN0TTvw1Or5V/H2n/CUC0WZvh7O3gn6cGnxoMYHKOUvwG
kBgIsNQvkQtwnHJ2pB9D4zEMTvTD0m3EpsMbC81fWPsLVfbzLgEACPWLqkIzWsvKgPU7SrHl4EYc
rN6LelkN6pqqUSerRb2ilj9m6Z+8lm2BKRSITIAkCpr863nlX91QvjztU1UyT0Cpk0BNa3S9hH8P
AQKlQQx1i4wVA/Q5IgaqjDJet2soqthEaYRK+HrtyKaDfCvv7+vGrbfP46svP4An5CwAgH9vwv5f
vzZi45P/ATV+lpz9lfXzssf/prKNqJFUsv0xOR9WNx6BQi9Go6oBjl47Fk5NYe7kBEZmMkgORRDJ
BpkUePraElQdKry0lfTt//77ezoFE+GQ3tsuen/P5mvAAT9vvcQAwGkzoN/vZCOfyZEUluZGOMUv
GvPB3Wtj296uHjOv7h2eNgYATn8HOr1mPgdYu1t56nd7bXB6LPCGu1j33xOkssPh6eBERFrlt9n1
MHSo0BtxIJzwID0cwsT8AIbzccSzfmTzYeYBDIz0Y+boIEanEnB4zNhxZAuTLAW5n1Clv4ASAIBQ
v6h6OpHS6ntvMa+id5RtRlntAW7WZPLDYEBSjQZe49ezDTAx4qnZixX0WsNNv7zuIDdKkv2JaPpX
1EKirGOVgFhRt7z6F0NtlHKjF6vq+CSgo/W6QQqlQcbkQAIDqlZ6bYLFbkQ82YtcOow7Ny+xJ4Cv
342SnWufXQbIjefZrWYZABx6C9XiCpYy0mmDVA8MbOQ16HCbMbk4jLG5AUSzfYiRtn0giGDCi9NX
FyE3NzHv4K819Keufit1+BkBwJu/hlJVzxuARNiDk0fHMTeTQ3/UA5vLDGfACjdN8b3WgrWxtx2u
3g44ey2s9beSoY+tGe1dRr71E+GPTgFk+0s8ACL99ZJ7X6+VI3xJArh4ahT+sBttnXqEkj3c6AdH
osz4H54gJ8Ao0oMhzJ8YwdhMGt29Vuyv3o0iAkLLNr9/7//WhRKq9P+wBAAg1C+bGLi3GBt2lWLb
oU0oqz8EEZn8yInVX8v3f2Lxk4EQcQU4DlhShXoGB9X8eaWhiTMBxPIaZvvLtCIo9RKWDlLjV7dI
2XWQtgJ0CpCqG6A1KdDcpoS6RQ6ZljYFYibG0rIKAAAgAElEQVTc0c2dJIjkMtjlNOPq1RP44cfH
CCV7UUw68r+yAfjPFgGAjQffYB4DeR0Q+CHyIoEVAgDkhhdNB9FPCoXBPmTGokgMh9Abc2Pp/BTE
RtEzAYB/8+yfsUHyCeCtl6BtboS3pw0JylcYCMHZ3QajRQtbtxlu8u8PWNHV24EWezNvASjgiLcB
nnb29Ld2tzAngFb89Gtp4nf6rPCEHXD4af3fyj/f3WeHxWVCON6DK9dPMNOfCIOD+QiG8jGMTCa5
4Q/nE5hezCE3EuO44ErJYSaYktzvWZ+DUEKVrvISAIBQL0R64Mu7S7Fp/0Ycrj7It3sCAfWyWp6I
m9QibuwyjQjKZgmv+YnRT7d8fZsaCp0UdZIjvDLWtSr557RmGRqYP1D/dM1PEz4FCpEJkb5DVfix
phFKgxRyAgkmOVStcjRqRNC0KBBLBXDy7Cw8USfW7iqEHD0vAPDWgddRJT7MoIakf8SFoPdOSgZ7
j5mT7rJjMUQH+hgERLMBBBI9WDg9gQZt3d8EAP6WIlIjBRTJ1PXQ6qT87Knp02RPN31q2uTeZ/OY
2dNf26Lgm787YOUbfpevnU1/2h0G/jrsyycCWv+TD4ArYEO7w8SbAToH+NgZ0Ik2uwGLJ/O4cuMk
unttiGV7MTaXxsBwlB3/phcHMTKRhDdoR5W0ghMS2VhJuPsLVfbLKQEACPVCbALoZs7ngMNbUSUq
g1QtglTVCLmmsdDQW2Q8ydNtn5qQyijnWz79HDVwMv4hbgABBZVezJM+bQ/ohl649cuha1NBa1bw
pK/Uk96+iTcICn0TnwHk+iYojE2Qkp++VYvsSBzRdB/UbfJnPgH8pwEAbwDojFHPzoe1TVWoZU5E
NSzdbawCGJnNoD/jRzjdi0w+ithgHxbPTqNWVf1cAEDBp2AtirYWY3fZNhyu3oc6aTWcfht6+hw8
3VtcZriCFpg7Dej0WljyV1j1W+CPu+Htd/CUb+sxoztkZSBATH/6vD/u4oZvdbXyZoDUAXwSiLrg
jziY/X/y3AxH/VI2wOhMClkGAGQFnGa//yOSMhRvKhaav1D4JZYAAIR6QSKE16F4Vwle2bUBu4/s
QKWogpshTegydSM3dLG8nu/6Cr2EmzYR+ngzQEFBihpemVOSoEzbALm+EU2aBk4QpEmfHAV1bUpo
TArIm6XMNZDpJGhqljDYoDMAAQIqia4R2lYlErkIMmNJSI2SZzIC+j8DAG8yR6HZrODTBJEf6dxB
RMgOVysyw1H0xb3w9Du5EkMhjM3ncPb6UVTIKp4bAFiRKW4p28KcCwIpXV4Lr+/ZvMfXAau7lVn+
/LGrhdf99HNM+KPo41BXwezH0wGLk04B7Sz7C7Dlbw96Qp3oS/SgL9ENb9gBf8SNcNrLJkC+sANj
0xnMHs9z2t/k4gAGx+Lo7XOgouEQSjaVLDf/v65oEEqo0p9ZCQBAqBeinkrVdhVjw+712FG2BYdr
9rMkTq6VMBigyF8iBCpoE2CSQqIqhAFRXgCdDKjx09qcwIKMdP+aQpQwKQDU5AZokvFqn6Z9OgXI
DRI08TZBVtgEEJ+AUga1jdCalYhmgkgNRyBrkaJo2/MBAOsIAOwpxpsHXkel+DCa1A1MTCQXQNpo
EACgFXlyKIxQqheJ4TBiQ33wRlzoS3pw7OIsDksOseTweRjekIphRaZYISpjdQat7bu8Vtg97XAF
rbB1t3HT90Q60d5l4gZPsb6BmBvdoU64eu3oCdjR6W5Db8zJv48AQF+8p9Do4y6e/rsDFnhDDoRT
XgQTPfBHXej2W+HutWDm2CBmFofY+c8TtKJKehglm2nyp82MMPkLVfqLLAEACPVC1E+lamwWtHs9
th3cjPK6A5wcSMQ8iVLEhj5aE63spYWIYHL5M4rZAIgmZpmmASpjgdhHjZTihbnZN0t4/a9tJSMg
OidI+HTAwIDOCyYZEwLlBilvDehkkBwIITUUgbxV+tw3AG8e+A1qJGXMASAiJG01CMQUSIBGZIgB
n48hlutDdiyK9Gg/vGEX0vkodtTsYGtfchl8Ht8XkmxuL9+CSnEZkzMdPit8ERfH97LDn7u1kO7H
PADaApjhDnYiEO9BKOVBX8KLUMLHfgqU+tfTZ4e3vwvhjBfeiANOv5X/LAIOwXg3mwD1pzzo7Xci
lHTDF7LD47chNeCH1WnE3updnGdA3BHylRCav1Clv9ASAIBQL6xt8Prdpdi8902U1+xHk6oBMo24
QAjUiHi9T8Y+Yk096mSVqG4sg1RZB20LgQOa9uVMDiQLYIoGJhUABwO1q6Ezq6AyNTGYKJwNKHGw
ETIiGNL0rZPwKj6RCyM7noCSAMC2oucKAN7Y9yoa1TXc+CkFkTIPyP+AXk2WZgyOJTA8lUJsIIhI
yo/kYIh5AbmZJDaWb2Sy3vP4XqylIKedxdhRvpUdGyXqOjh6LXCSjC9o49U+nQTojt9qM8BGpECe
8B3ME6CmH06Qtj+EeC7EigpPXxcsThOT/mibQNuBvmQPPH1093ciFOtm7X8k5UV8wI9o2osevwW2
bj0ON+7FS5vWFL5eweJXqLJfdgkAQKgXlxi4pwSl29diy943UFa1j0EAMf+lKhGfA+hmTqE/RPaj
tb+CvPT1Em70amOB6EesdLr78/rfJEezWcUfi9XLfIFm2ioUondp/U/nBYVBzDLBVD6O/PwQ5Kbn
DwBe3f0KRPIqKHViBiB00ljxAyArXSLCTS0MYXQmjfRIP6IrSXiTMbxZ9iaT9Z7P92EtcwC2H9mK
Kkk5AyZi7NOtn1b/1MApzY8d/DztsJEJEPkBeK0Fhz+y8o33ID4QQnKoHwP5GAJRD9q69OwTQNuA
FTMgAhW+kIOTACNJH5IDQcQzAYRibmhapdh08C0UU5LivoLUT2j+QpX+wksAAELhRVcHFG8txua9
r6Oidj8aZbVs4qOgpq2uf9r81czmL0z6ulYFlDopf87Qrl5u+nJu7jTlU4wwyeuIbU9nBCo5Ewsl
/EqfJzVAcrgfuYkUGrQNz40DQMUyyG3rUSUu49MFExNVDfx1kS0yEeymFocwuZRDerifzwHRbBDp
0SjiI3147eBrzw8AMAegBFsrNuNII70/ETd1ntxDdnQ4W1gBYHO3sQqAQBYR/Wzd7ejydPAmgOx/
eXORCSCaCiI9EoOdCIFuEwMH8hHwBDrRn/Xw/b8/7UM042MQEE64Gdi9uvtVbv7r9j+7iZFQQpX+
zEsAAEK90LUCAoo2r8Fbe17D4aq9qBVXcmhOPd/La3mib25R8itP/UY5u/0RCKCGZLKoeaqmQCFq
qkQsbKDoYLIG1hfIgAQKSBmgNMl4G0AngsxoFIPjSTTqG1D0DGmA/9kqpk3H1lJU1B/iDQYBEVET
OQLWsx9Au7MF2RFSAVBIjhcJ8gIYCGJoKoH+wSBePfCb5wIA+Pkvbyi2VW5DtfQI8yf6Uj54+12s
5SdPALNNz2cBd6iLNxckDexlkmIPItkAexYkBkOIpHuZC0DqBZIzWtwt6PK0858TjvXAG7Az6c8T
6OI44N5oFxqUlVi/dX3B3neZ6S80f6FKX5ASAIBQL3Q9TdnbsxZrNr+E13a/gn1HdqBWeoSneLm+
QNhrblVCaZTyBE3N39BGU7+CGf00tVKYkFgt4mChRkUdasVVbDgk0xMPQMSKAiICas0qnv6pcpNJ
jM8PPlcZYEEFUILSLetQUX+A8w5I2UDhSLTdqBRXQN+hYVJcIOJGPBfkCqW8yI5F4Im6sWFvIdjn
uTz/sgIfY3P5JpTV7WcpZTjjY7a+zdmGLm87Wjv1vPp3+Tv52RJg8YacHPhDwT+kVgjGPLwJcHit
iGVpG+BnP4CVdMDUSBiBcDd6Qw70xd3sBlgmPoCiLcUo3ilo/IUqfSFLAABCvfC1AgLYlGZHMcft
7izbysY0pOE3djTzrZ/X/rQF0Ek43EdvVjNnoL6pllP2KGiIjIGIXCdR1/MmgMJ3CCQUpH9ymGzN
rBbQW9QYnExh9uQY5GZZIW73OQEA2nBQbHBZw37eaFCmAeUCkOaepHcas4KNcGI5PxKDfYjn+hCI
diM9EoG7vwvrd69fBgDrnhsA2HT4LRys2Q1dmwL+WDefAJgEGOqCM2jjlT/p/sl0qd1lhLvPjrZO
A2cE0DaAFQARF6/+XT4bvGEnWwQTAHD32pGfTWF4Io6+mBstNhW2lW9haSMFKwlMf6FKX9ASAIBQ
Qv0UBNBJYHcxSrevw0YiB9YeZIfAZg74aWLZH20EjB1qlqZRrC5J6RqW0wZrJFUssyMFgUhJPgL1
kBGfQFtQAjQ1i/nH5AOQzccwTwCg5fmRAHm7sb+Efez3Ve1Eg6wSTaRuUJIRUDXKaw+xqoEm5kjG
h1g2gIF8FLmJOCaXRhgArNtZ+nwBwO5ibC7biErxQejblegO2Di61xWywRmwswqgzVG45xssGug7
1EwIbHcYebonAEAbA/b977Xy58gGmBQE3ogT3YFO9EV60BO0QtJci9f3/gbFO4qY5U/SRqH5C1X6
gpYAAIQS6n8FAuQauLuYteBv7PkNDlXv44ZZ0P0roG2R88d0CiApYFVjIUiIAnbIZ582AMQFoKbf
RBsANbkASiHRFiSBxAmQG5rYc//o+SkozbLnZwS0vNko3laEg3X7OBCIbY3VdZxlUNVYweeNbD7C
E38sF0QsF+A6enYKnqgLJdvX8p/xPBrl0xNAxSYcaTwIQ7sK/piLDX58UTe6gwUWvzNQIPORpt9k
1bL/P0kCO32U+leI+6WizQCFARHbPxT3IhjvgSdoQ7vTgD1VO1C6q+AIuRLnKzR/oUpf4BIAgFBC
/QcKAVoTv7LjZc4QIKtaauREpCNHQHolE6BC86+FVF1wEqTPkfMfSQGlGrIWpqwABX8sUpKxEJkM
ieCPdmPxzCT7AKzZ+vw2AARoSnYU4UD9Xk5APFJfxkFI9J4rReVoseuZjDg4kcTEUg6p4TBL7yYW
BtAVtKJoa8nzBQC8AdiEioYD0Lep4Ak54SeXP5rgya63n+79LoSSXoRTPrj9dnR5LDztW3vaOAeA
bvodThNsPa2cFRBJ+ZAeD/OmQGFqxFv7XudnXEIrf6HxCyUUqAQAIJRQ/1G2PdkH7yzCuu3r8Oae
17GnfAeqJZUFjb9GzGcBkvZR0TmAGPZEBOScgGa6/YuhbSsEBDXKV1QBtA1oRG/UjaWzU1C2yZ8v
ACD3w13F2F21HQ2KQiRwrbQQCVwjqeQ44NHZDAYnEhiZTmF8YQDRXAALp8Zh9bVhzZai578BKN+E
KvFBmDt18Me74Yu6WPpHLH5y/QtletEb7UZnjwWBuIdtgEnj74sWyIAEFogzYHOa0R2wI5bxocNl
Qrn4AIdAFe0o4u+l0PyFEqr0aQkAQCih/mqQ0FrW0pfsKOFtwJa9G3G4Zh8T/4jZT9I+mvLpPKDQ
iwvbgWX/f1r518tp2q5jQLDyc1J9I5y+DswdH4W6Q/7cSIArXwMBgK1lmyHW1LEFcJ2UOAtVqGos
51wAyiVIDpGZThijMxmkR8JYPDMFo9OAlzaveX4AgK2ACwDgcP0BBgAU2GN3t8MdsPHKn4iA1OS7
yAbY3cZhRbQ9oUZvc7Wwrp/8C4jE6PJaYXOaoDZLsa1sC4rpue5dK7j6CSVU2f9eAgAQSqi/QSVA
rnWlW9fhjZ2vYF/FDtQrqgtxwMQNaFXyiYCkg5wN0EKAQMJ6e5ICKilgiDYHOjEa1XXMUp9aGoTU
0IA1z5EESGY7JbtKsP3INl77syFRcyMamgrnAPIniA30MQ+AmmluIobUSD+WTk/D6NDj15tfwtrl
6fl5vD/2ATiyGXWyI2i163iyJxUAbQIo6Y9e3UE7PP0OdIcK5Yu4OdWvJ0xhQDYmMHqDNmhMYuyr
2YUNOzYUmv/yyv/v/d+QUEKVrsISAIBQQv3N3IC1KNpehJe3rseusm2oElfwap/Y6cSo53CgZdtf
mq4JEBTOAY2QUoqgXowGZQ2cASuOnZ9Co64BL21Zw7f65woAKrahTlHNdrvU9MkKmE4ABFyGJlMY
mc2wDJDW/+l8BOdvnkCLw4hfb/z1c5PKrXAANpW9hRppGYxtajb/ofV9J1kAB+zoCTkYAATi3WwQ
xByBiIvNfkIZHwMGIvnVyivwxt5XUUS3/t3rUHqgYPQkAAChhCr9d0sAAEIJ9bc21LJSniyZG7B1
LTbvewNldfsgltcyACAVALkAUtNX/P/t3elT1Neex/G/QOmGVnGJGzuILAea3leaHQUXBDWgIKvs
IqvggjGaWDE3qbo3dafmQZ5N1fyRn6nfac1kpmqq7kzocKfP+8GrTB7EoqlU/d59fud8z3DWPvBz
N5J2CE/PnU67EpDojWps6q5+/Pt7pQYTOnH1hH1YFWzcbp3fHrULpdsUzXbYn887pRDPRuxdAIff
vdDLdzt68XZdq7tzevpsUh9/fqvcUNYGQKGuxP3POQAX7SkA7/jfzPpj+7vxRv963/Dnnk1pYv6B
5tef2Kl/3kmFtZ05za08trHQcyetSnNFpTV+lXhHOJsCOvV51YaHPxD4HxEAwP/SlweLXQ1o9Nsj
dmeqTqu68apMrEmxXMjOAOi55U388y7/ySjd5+0BSKjndtZeD5zoienGaL/dBOjtByh4ANT6VGWu
2jHEoUyH2mNGqd6o4rmIhu7124mErz9s6/mLZa1uz9mZ+Ycf99WRbdOJihOFe5j+7hVApDNod/I/
mruvr2fu2Ye/FwFPt6btSsDM6pRevNu0Mwsez4/p9oMBhTuNyuvPyFdbotLrZQq0crwPCPyDCADg
D+8NyG+yK60q1fm6s6ozlWqPNinVG7M3BXrjbXuHvSmCnXYa4OC9HqW8SYH9SX376aX67uZsABRy
D4D383krAH0jXfZWwuZQs8KZ/PyCodEBvXy/bTcA2kt1tma1sb+kN59eqDHVaP9b78FamN9jPgBq
wlXqHIzbi4m8VYCRR8N69PS+phbHtbq7oMWt/P0A3r/fenhDsa4OVbRcUVm1X7567z1//u/iwQ8E
/mEEAHBER+28M+b+ulIFakp1sf6s6turFcu223kBXgTcHOnT8IN+DY502yX4SGeHnbjXP9rzJwSA
X5eaLtr7CbpvZBROBxWMtdojgcNjA9p57V0GNG1nAHhL7N6Qos23a6qN1th5CIX7/eVfAXgrAJ03
47o/edtujnxoh/yM2s2A3jS/+0/u6sZoj8KdQVW1VChQFZCv2m/3Y5R+vsTnuP8/AAL/zxAAwBGx
DyEbAn57tWygutTeMOhdLtSRNMoNpjQ40mNvEPT2CbTFW7W4Ma3+0S67CbBwAZBfobjUdEGhZJs6
exPK9MTsfQAdcaNb9/vsCODZ5Ql7EdD2q1VtH65r/dWaqqPV9jVHIX9n3gpAZfCKXQF4NDdmZ/l7
S/z3p+7Y0cBdN1MyyUZdbDxv7zTwVfvsz2Q3+LHJD9D/FQEAHKHf3j97IdCYnx3grQh4IVBvqhSM
tyjdHbO78MPZDi1uzqh/rMvuXC/8CsAFhdKtSnRGlelJ2IuBgvFW9d/27gKYtWNzvSuBN/eX9eEv
b7T//a6qwlUFDYDfvwLov5XRxNyoxudGdWt0QJn+mJqi9fnZ/VUlKqn1Hvyl+b0SPPgB/VEEAPAn
hEB+RSCg8w1nVd1cIRNpUjDRaifZ3XzQW9hJgJ9XAC5eu6BQotUOI/IiwBtOFM60qfdmRtsHy3b5
f2Vzzo7f3XmzpoMP26oIVhQsAL78frzTFA3RGg3dzenm3R51DcXVHKu33/j9VT77s3tT/PLDfBjo
AwSOCAEAFNCXh5Wdx9/otyNpS6tLdaH+rM5XnVUsE1T37bT8tf6CbwL0Rhl73/iTXd4+gPwNhZFs
0M4v2Dt8po29JW3sL+rJwgMtbsxo49WarrRfKWgAeA92bwiSSV1X11BM10I1OtdQLn/N7x787OwH
VAgEAPAn+O3h1RJQaaO3WdAvX6VPp2tP6bK5pNKGwrzP/v0rAC86gokWRTMhJboiSvfGFM2GNDjS
q+1Xa/aM/dLzaXud7s7hmrberOti88WCBoA3T8FX69eV1kv66vp5u7HPV+9dPsSDHwgUGAEAHMcM
AW+wjnd8sCH/wCu7XrhRu19WAC7UlSuSaVO6J6Z4LqxEd8T+OeSdAjh8pvXdBS14M/afPtT6zryW
dxd0oflCYTcBNpflg6jeb+9bsBf2fA4hHvxAoKAIAOCYhwkV8oH3X1cAyhXyVgDSQWV6Y0p1xxRO
BjU81q/t16t6uv5ESxvTWlib1Nr2vKZWxnX2WnnBTwH89jvgwQ/oz0QAAEXsv78CiGbaleoK230A
3sVEiVxYPUNZe/zPOwmw/HxaG/tP9eHHl1rYmtaZ+jMFPgUAIHBMCADAlQCoK1c002ZvJ0x2xZTt
8wIgZDcEbh6saOvVij0K6O0D+PaHAy3tzqu8wCsAAALHhgAAiphdTv8cAOfryu1kQu9SotxA0kp2
he3dBNtv1rT75plWd2Y1tzahb37Y08reAisAgCleBADgQAB4pw7O1pxWON2meGdEkVSHErmI/efe
2116frCijf1lzSxPaHLxgd79sK+FzScqq8kfXzzuzwEgcOQIAMCRACivOqVItt1+88/0JZQZSCjZ
E/18DHBF229W7c17i5veK4BXergwppMVJQQAYIoTAQA4sgfgVGVAbZGm/IVAQxl13cgo2R3TwN0e
uwLg7QF4tu9tBpzX248HGpsbk6/STwAApjgRAEAR+/0cgPLq0/YugnCq3S7/526m7a2Eg3d7P18F
vGDHAM+tPtb7H19p7WBJZ9gECKhYEQCACwFQ69OF+vNKesN/vD0AmZBSvTHFchH1DOfsbYAbLxa1
sjOr9b0FffPxpfa/29Zlc5kAAExxIgCAot8DUGYD4HLTJWX7Y/bYnxcBqe6IvQug51anVrfm7UVA
S1szdibANx/39e1Pr1QXq7UT+o77cwAIHDkCAChiXybreTfuVbReVrTTmwLo3QYYVjgVVCjRrq7B
jJ0D4B0D9PYBeCsBe4fr+uXXT4oPRHSy+qQCraeO/bMACBwpAgAoYvbCneYylVT71NBRq1DKqCNh
FEoYRdJBq7M/pfW9RW2+XNHc6iMtrE9p89WSfv33v2lkekQnKk4U5KIiAIFjRQAARcx7aHvv8P1V
fgVTrUr3RhVJt8tEWuyfoWS7nQg4szSumaUJTS+Na2VrWluvl/W3f/2k1YNlna4/bW/tKzMEABAo
IgQAUOR8DT6dayhXsiukZDaseDakYKxV0UyHfQ2Q7Y1rYX1Sq7tzWtqc0fLWjL0P4PufDvXxl/e6
GqyQr95n5wkc92cBEDgyBABQ5EOAvPf/la1X1NkfVyIbsu//g/FWRVJBdcTblBtMa3lzVrOrU5pb
e6zl7VntHK7r7Q97+vXfflGkN6yTVScVaPn8d/4TfDYAgT+MAACK+f1/U6lOVpWoOVavXH9cyVxY
kWTQrgCEE20ykWYN3OnV84Nlza9PaWLuvhY2nujl91t6/d2u/v7rz5paeaSTlb78awACAFCxIACA
Iua9/7/UekGZwah6bmSU60sp1RVTKN5mBwJFM0FNzo/r4N2Wdl6v2of/1OJDLW/O6N2nA/30L9/p
41+/UW201r4GKPsn+EwAAkeCAACKVpn81/y63PqV4l3tSnfH1Nmfvwcgmu2wewBSuZie7S3q8Pt9
vfluVwcftuwxwLXteb3/+UAf/vLSjgVO3kzKV+u3rxRYBQACRYEAAIqUt2vfW7YvrfKprq1a4WSb
YpkOe/a/I9lmA8A7Bji/NqkPP73SNz8eaO/tc228XNbi82n7SmBm+ZHG58dUYa7KV++3UwUJACBQ
FAgAoJiHALWU2UE+5+rOqi3apFCqXfFcRNF0SHFvM2DCaOB2tzYOnmpld05Plic0Pjum8dl7uvfo
lh7Ojirc3aGSyhL2AACmuBAAQLFvBLxeKl+VT9WmQolcWAN3u9U73KXum50Kp/PXA089/VoPp0Y0
ufRQT1YnNLn4UDPr4xqdvatz187l3//z8AdUTAgAoIjZh3ZLQCV1Pp2uPa3roQZ1DmY0/GDQfvMP
pTvUd6fb3gHwaP6+Fp5P239+sjShuWdTas226GTlSbuScNyfBUDgSBEAgCPjgP11fl1puqRIJqi+
W13qG84p1RvXwL0+Le8saHZ9UrOrk1rembG3Ag6NDypQE+AyIMAUJwIAcGUk8DW/ztSfVnOkQcmu
sLpvZpTujWtwpFcrO/N2D8DTzWnNrz3W5OJ91Yaq7QCgsmbuAQACRYgAAJwZClQmf61f1eaqotmg
ffinumPqu53T8tasVnfm9exgXgvrE8oNJeWr8Mnf6N0BcPw/P4DAkSMAAMdWAU7XnVJ7slmRTIdi
uZC6b2T09PmMtl+v2qX/qeX7qmyrzH/759gfoGJFAAAurQK0lNmBPhUtlxXLBu1sgMGRHh2839Th
pz2t7syo505aPm/0b2N+6Z8AAAJFiQAAHFwFCFSXqSV6Te3RJuUGUtp/91y7h+uaWf1aleaqTtaU
qIzLfwAVMwIAcHAVoKSmRBevX5CJXlcqF9bWyyXtvF1RbjilkqslClz/PEiIAABUrAgAwMERwXYV
oKpMdaZKsc6w1vfmtLgzo7PXzqmk3sfVv4ApfgQA4ORcgFKVVJfoq4bzimSDer6/qPhgVCcqTijA
sT9ALiAAAGf3ApSqpMKnYNpoZPK2AtWn5Gtg5C8QcAQBADjIvt9vLrNH/eqj9aoKVtkVgbImvv0D
AUcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQ
AAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAA
GPcQAAAAGPcQAAAAGPcQAAAAGPcQAOHJ3RcAAAIgSURBVAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQ
AAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAA
GPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQ
AAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAA
GPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQ
AAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAA
GPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQ
AAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAA
GPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQ
AAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAAGPcQAAAA
GPf8B+a25g9dEgwEAAAAAElFTkSuQmCC
__GE_EOF_5d7c__
echo "  wrote public/icons/icon-maskable-512.png"
base64 -d > 'public/icons/apple-touch-icon.png' <<'__GE_EOF_5d7c__'
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
AABJRU5ErkJggg==
__GE_EOF_5d7c__
echo "  wrote public/icons/apple-touch-icon.png"
base64 -d > 'public/icons/badge-96.png' <<'__GE_EOF_5d7c__'
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
/FsxKt1KSgAAAABJRU5ErkJggg==
__GE_EOF_5d7c__
echo "  wrote public/icons/badge-96.png"

echo
echo "==> Verifying"
MISS=0
if [ ! -s "APPLY-PUSH-PWA.md" ]; then echo "  MISSING APPLY-PUSH-PWA.md"; MISS=1; fi
if [ ! -s "push-notifications.sql" ]; then echo "  MISSING push-notifications.sql"; MISS=1; fi
if [ ! -s "vercel.json" ]; then echo "  MISSING vercel.json"; MISS=1; fi
if [ ! -s "public/manifest.json" ]; then echo "  MISSING public/manifest.json"; MISS=1; fi
if [ ! -s "public/sw.js" ]; then echo "  MISSING public/sw.js"; MISS=1; fi
if [ ! -s "public/offline.html" ]; then echo "  MISSING public/offline.html"; MISS=1; fi
if [ ! -s "lib/push-server.ts" ]; then echo "  MISSING lib/push-server.ts"; MISS=1; fi
if [ ! -s "lib/push-client.ts" ]; then echo "  MISSING lib/push-client.ts"; MISS=1; fi
if [ ! -s "lib/prayer-push.ts" ]; then echo "  MISSING lib/prayer-push.ts"; MISS=1; fi
if [ ! -s "app/api/push/subscribe/route.ts" ]; then echo "  MISSING app/api/push/subscribe/route.ts"; MISS=1; fi
if [ ! -s "app/api/push/unsubscribe/route.ts" ]; then echo "  MISSING app/api/push/unsubscribe/route.ts"; MISS=1; fi
if [ ! -s "app/api/push/test/route.ts" ]; then echo "  MISSING app/api/push/test/route.ts"; MISS=1; fi
if [ ! -s "app/api/cron/daily/route.ts" ]; then echo "  MISSING app/api/cron/daily/route.ts"; MISS=1; fi
if [ ! -s "app/api/cron/prayer-alerts/route.ts" ]; then echo "  MISSING app/api/cron/prayer-alerts/route.ts"; MISS=1; fi
if [ ! -s "app/api/masjid-events/route.ts" ]; then echo "  MISSING app/api/masjid-events/route.ts"; MISS=1; fi
if [ ! -s "app/layout.tsx" ]; then echo "  MISSING app/layout.tsx"; MISS=1; fi
if [ ! -s "components/PWARegister.tsx" ]; then echo "  MISSING components/PWARegister.tsx"; MISS=1; fi
if [ ! -s "components/InstallPrompt.tsx" ]; then echo "  MISSING components/InstallPrompt.tsx"; MISS=1; fi
if [ ! -s "components/NotificationSettings.tsx" ]; then echo "  MISSING components/NotificationSettings.tsx"; MISS=1; fi
if [ ! -s "components/ProfileTab.tsx" ]; then echo "  MISSING components/ProfileTab.tsx"; MISS=1; fi
if [ ! -s "public/icons/icon-192.png" ]; then echo "  MISSING public/icons/icon-192.png"; MISS=1; fi
if [ ! -s "public/icons/icon-512.png" ]; then echo "  MISSING public/icons/icon-512.png"; MISS=1; fi
if [ ! -s "public/icons/icon-maskable-512.png" ]; then echo "  MISSING public/icons/icon-maskable-512.png"; MISS=1; fi
if [ ! -s "public/icons/apple-touch-icon.png" ]; then echo "  MISSING public/icons/apple-touch-icon.png"; MISS=1; fi
if [ ! -s "public/icons/badge-96.png" ]; then echo "  MISSING public/icons/badge-96.png"; MISS=1; fi
if [ "$MISS" = "1" ]; then echo; echo "Some files did not write."; exit 1; fi

# Icons must be real PNGs, not truncated base64
for f in public/icons/*.png; do
  head -c 4 "$f" | grep -q 'PNG' || { echo "  ERROR: $f is not a valid PNG"; exit 1; }
done

grep -q '/api/cron/daily' vercel.json || { echo "  ERROR: vercel.json not updated"; exit 1; }
grep -c 'path' vercel.json | grep -qx 2 || { echo "  WARNING: vercel.json should have exactly 2 crons on Hobby"; }

echo "  all files present, icons valid, cron count OK"
echo
echo "─────────────────────────────────────────────"
echo "STILL TO DO (notifications stay off until both are done):"
echo "  1. npx web-push generate-vapid-keys"
echo "     -> add NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,"
echo "        VAPID_SUBJECT to Vercel env vars"
echo "  2. run push-notifications.sql in the Supabase SQL editor"
echo
echo "THEN:"
echo "  npm run build"
echo "  git add -A"
echo "  git commit -m 'feat: installable PWA with push notifications'"
echo "  git push"
echo "─────────────────────────────────────────────"
