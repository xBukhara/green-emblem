# Green Emblem — Visual Revamp + Live Homepage Previews

**One script, two rounds of work.** This supersedes the earlier
`apply-visual-revamp.sh` — if you never ran that one, this is the only one you
need.

---

## 1. Homepage — platform showcase with live previews

Baab As-Sadaqah is no longer *the* homepage; it's one of six pillars. And each
pillar card now shows a glimpse of what's actually behind the link:

| Card | Preview | Source |
|---|---|---|
| Prayer & Qibla | Next prayer + countdown (`Maghrib · 7:17 PM · in 2h 41m`) | computed in-browser from the location the Prayer page already cached |
| The Quran | `CONTINUE READING · 18. Al-Kahf` | localStorage, same key the reader writes |
| GreenWorld+ | Next community event, date, masjid | `masjid_events`, server-side |
| Baab As-Sadaqah | Meals funded to date | aggregate over confirmed donations |
| GreenTV | Latest headline + how long ago | `greentv_posts`, first line of the newest post |
| Islamic Shop | Featured product + price | `products`, featured then published |

### Two design rules baked in

**Nothing is fabricated.** If a query returns nothing, the card falls back to
honest static copy — never a `0`, never a spinner, never a placeholder that
looks like data. Zero meals funded shows *"Free — and no cut of what's given"*
instead of *"0 meals funded"*.

**The homepage never asks for location.** The prayer countdown reads the
location the Prayer page already cached (24h window). A first-time visitor sees
*"Share your location to see today's times"* rather than getting hit with a
browser permission prompt on arrival.

### Performance note
Previews are fetched **server-side** so they're in the HTML rather than popping
in after hydration. The page stays statically rendered with ISR
(`revalidate = 300`) — this required a new `createPublicClient()` in
`lib/supabase/server.ts`, because the existing `createClient()` reads cookies,
and reading cookies forces Next into dynamic rendering, meaning a database hit
on *every* homepage visit.

Page structure: hero → fact strip → six pillars → GreenWorld+ spotlight →
giving spotlight → commitments → closing CTA. Nav CTA is "Explore".

The fact strip uses only truthful product statements (114 surahs, 5× daily
prayer times, $0 taken). No invented user counts or testimonials.

---

## 2. Colour scheme
Background lightened `#0f1f0f` (9% lightness) → **`#143314`** (14%). Layered:

| Token | Hex | Use |
|---|---|---|
| `forest-deepest` | `#0e250e` | nav, footer |
| `forest-dark` | `#143314` | page background |
| `forest` | `#1b3f1b` | cards |
| `forest-raised` | `#234c23` | hover |

Contrast verified against WCAG (AA needs 4.5:1):

| Surface | Gold | White |
|---|---|---|
| `#0e250e` | 7.88 | 16.28 |
| `#143314` | **6.71** | **13.88** |
| `#1b3f1b` | 5.73 | 11.84 |
| `#234c23` | 4.77 | 9.86 |

**Links are white.** Gold is reserved for headings, eyebrows, CTA buttons,
icons and active indicators. A base `a { color: #fff }` also covers pages not
yet migrated to Tailwind; class rules and inline styles outrank it, so nothing
existing breaks. `.ge-card` moved off the old dark green too, so unmigrated
pages pick up the lighter scheme automatically.

---

## 3. Mobile
- No horizontal overflow at **320 / 390 / 768 / 1280px**
- CTAs stack full-width below 640px
- Every tap target ≥ 44px (the logo was 32px and the hamburger 26px)

---

## 4. Apply
```bash
bash apply-visual-revamp.sh
npm run build
git add -A
git commit -m "feat: homepage platform showcase with live previews, lighter palette, white links, mobile polish"
git push
```

The script installs one new dependency (`server-only`, a build-time guard that
stops server code being imported into a client bundle).

---

## 5. Verified here
40 automated checks against a real headless browser: overflow at four
viewports, all six pillars present, every card carrying a non-empty preview
strip, no `undefined`/`NaN`/`null`/`0 meals` leaking into the UI, the prayer
countdown computing correctly in `America/New_York` from a seeded cache with
**no permission prompt fired**, the fresh-visitor fallback copy, tap-target
sizes, computed background colour, and console errors. All passing.

The populated previews were verified by stubbing fixture data, screenshotting,
then reverting — the sandbox can't reach your Supabase, so what you'll see on
your own deploy is the real thing.
