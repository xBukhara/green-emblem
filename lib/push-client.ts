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
