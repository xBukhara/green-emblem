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
