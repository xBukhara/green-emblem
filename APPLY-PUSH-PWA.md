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
