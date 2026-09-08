#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
#  Green Emblem — visual revamp + live homepage previews
#
#  Homepage as a platform showcase, each card previewing what's behind it.
#  Lighter green, white links, mobile-first.
#
#  Run from the project root:   bash apply-visual-revamp.sh
#  Safe to run more than once.
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

if [ ! -f package.json ] || ! grep -q '"green-emblem"' package.json; then
  echo "ERROR: run this from the green-emblem project root." >&2
  exit 1
fi
if [ ! -f tailwind.config.ts ]; then
  echo "ERROR: tailwind.config.ts not found — apply the UI foundation first." >&2
  exit 1
fi

echo "==> Installing server-only (build-time guard for server code)"
npm install server-only --silent
echo "  done"

echo
echo "==> Writing files"
cat > 'APPLY-VISUAL-REVAMP.md' <<'__GE_EOF_9a41__'
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
__GE_EOF_9a41__
echo "  wrote APPLY-VISUAL-REVAMP.md"
mkdir -p "app"
cat > 'app/globals.css' <<'__GE_EOF_9a41__'
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ── shadcn/ui semantic tokens, mapped to the Green Emblem palette ──────
   Values are HSL triplets (no hsl() wrapper) so Tailwind can compose them
   with opacity modifiers, e.g. bg-primary/10. */
@layer base {
  :root {
    --background:            120 44% 14%;   /* #143314 forest        */
    --foreground:            40 43% 93%;    /* #f5f0e6 cream         */
    --card:                  120 40% 18%;   /* #1b3f1b               */
    --card-foreground:       40 43% 93%;
    --popover:               120 45% 10%;   /* #0e250e               */
    --popover-foreground:    40 43% 93%;
    --primary:               38 54% 63%;    /* #d4af6e gold          */
    --primary-foreground:    120 45% 10%;
    --secondary:             120 37% 22%;   /* #234c23               */
    --secondary-foreground:  40 43% 93%;
    --muted:                 120 22% 22%;
    --muted-foreground:      120 6% 72%;
    --accent:                120 40% 30%;   /* #2e6b2e forest green  */
    --accent-foreground:     40 43% 93%;
    --destructive:           1 65% 55%;
    --destructive-foreground:40 43% 93%;
    --border:                38 28% 32%;
    --input:                 120 25% 26%;
    --ring:                  38 54% 63%;
    --radius: 0.75rem;
  }

  /* Tailwind's border utilities assume preflight's border defaults.
     Preflight is off here, so supply exactly those three declarations —
     and `border-width: 0` is NOT optional: the CSS initial width is
     `medium` (3px), so setting only `border-style: solid` paints a 3px
     border around every element on the page. Inline styles and class
     rules both outrank `*`, so the not-yet-migrated pages are untouched. */
  *, ::before, ::after {
    border-width: 0;
    border-style: solid;
    border-color: hsl(var(--border));
  }
}

/* ── RESET ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }

/* ── BRAND TOKENS ── */
:root {
  --forest:        #2e6b2e;
  --forest-deep:   #1b3f1b;   /* card / raised surface */
  --forest-dark:   #143314;   /* page background — lighter than the old #0f1f0f */
  --forest-deepest:#0e250e;   /* nav, footer, deepest chrome */
  --forest-raised: #234c23;
  --forest-mid:   #3a7a3a;
  --forest-light: #5a9e5a;
  --gold:         #d4af6e;
  --gold-light:   #f0d48a;
  --gold-dim:     #a07840;
  --gold-glow:    rgba(212,175,110,0.12);
  --cream:        #f5f0e6;
  --cream-dim:    #e8e0cc;
  --w90: rgba(255,255,255,0.90);
  --w60: rgba(255,255,255,0.60);
  --w35: rgba(255,255,255,0.35);
  --w15: rgba(255,255,255,0.15);
  --w08: rgba(255,255,255,0.08);
  --w04: rgba(255,255,255,0.04);
  --font-cinzel:    var(--font-cinzel), 'Palatino Linotype', serif;
  --font-cormorant: var(--font-cormorant), Georgia, serif;
  --font-arabic:    var(--font-arabic), serif;
  /* Quranic script stack — see @font-face below */
  --font-uthmani:   'KFGQPC Uthmanic Script HAFS', var(--font-amiri-quran), var(--font-arabic), serif;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
}

/* ── QURANIC SCRIPT ────────────────────────────────────────────────────
   Optional upgrade: drop the official KFGQPC Uthmanic Script HAFS font
   into /public/fonts/ and it is used automatically. Until then the stack
   falls through to Amiri Quran (loaded via next/font in app/layout.tsx),
   which is purpose-built for Quranic text and renders every Uthmani
   diacritic correctly — so the reader is never left with a face that
   mangles the marks. */
@font-face {
  font-family: 'KFGQPC Uthmanic Script HAFS';
  src: url('/fonts/UthmanicHafs.woff2') format('woff2'),
       url('/fonts/UthmanicHafs.ttf')  format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

/* ── BASE ── */
body {
  background: var(--forest-dark);
  color: #fff;
  font-family: var(--font-cormorant);
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

/* ── LINKS ──
   Links read white by default across the site; gold is reserved for
   headings, CTAs, icons and active indicators. */
a { color: #fff; }
a:hover { color: var(--gold-light); }

/* ── TYPOGRAPHY HELPERS ── */
.font-cinzel    { font-family: var(--font-cinzel); }
.font-cormorant { font-family: var(--font-cormorant); }
.font-arabic    { font-family: var(--font-arabic); direction: rtl; }

/* ── SHARED BUTTON STYLES ── */
.btn-gold {
  display: inline-flex; align-items: center; justify-content: center;
  font-family: var(--font-cinzel); font-size: 11px; letter-spacing: 0.16em;
  color: var(--forest-dark); background: var(--gold);
  border: none; border-radius: 8px; padding: 14px 28px;
  cursor: pointer; text-decoration: none;
  transition: opacity 0.18s, transform 0.18s var(--ease);
}
.btn-gold:hover  { opacity: 0.88; transform: translateY(-1px); }
.btn-gold:active { transform: translateY(0); }

.btn-outline {
  display: inline-flex; align-items: center; justify-content: center;
  font-family: var(--font-cinzel); font-size: 11px; letter-spacing: 0.16em;
  color: var(--gold); background: transparent;
  border: 0.5px solid rgba(212,175,110,0.5); border-radius: 8px; padding: 14px 28px;
  cursor: pointer; text-decoration: none;
  transition: all 0.18s var(--ease);
}
.btn-outline:hover { background: var(--gold-glow); border-color: var(--gold); transform: translateY(-1px); }

/* ── BACKGROUND TILE PATTERN ── */
.bg-tile {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  opacity: 0.028;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cg fill='none' stroke='%23d4af6e' stroke-width='0.7'%3E%3Crect x='25' y='25' width='50' height='50' rx='3'/%3E%3Crect x='25' y='25' width='50' height='50' rx='3' transform='rotate(45 50 50)'/%3E%3C/g%3E%3C/svg%3E");
}

/* ── PAGE WRAPPER ── */
.page-wrap {
  position: relative; z-index: 2;
  min-height: 100dvh;
}

/* ── ANIMATIONS ── */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.88); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes shimmer {
  0%   { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -300; }
}

.fade-up { opacity: 0; animation: fadeUp 0.7s var(--ease) forwards; }
.reveal  {
  opacity: 0; transform: translateY(28px);
  transition: opacity 0.7s var(--ease), transform 0.7s var(--ease);
}
.reveal.visible { opacity: 1; transform: translateY(0); }

/* ── FORM INPUTS ── */
.ge-input {
  width: 100%;
  background: rgba(255,255,255,0.04);
  border: 0.5px solid rgba(212,175,110,0.18);
  border-radius: 8px;
  padding: 12px 14px;
  font-family: var(--font-cormorant);
  font-size: 16px;
  color: #fff;
  outline: none;
  transition: border-color 0.2s;
  appearance: none;
  -webkit-appearance: none;
}
.ge-input::placeholder { color: var(--w35); font-style: italic; }
.ge-input:focus { border-color: rgba(212,175,110,0.5); }

/* ── SURFACE CARD ── */
.ge-card {
  background: rgba(27,63,27,0.72);
  border: 0.5px solid rgba(212,175,110,0.15);
  border-radius: 16px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* ── PILL / BADGE ── */
.ge-pill {
  display: inline-block;
  font-family: var(--font-cinzel);
  font-size: 8.5px; letter-spacing: 0.14em;
  padding: 3px 10px; border-radius: 100px;
}
.ge-pill-gold   { background: var(--gold-glow); color: var(--gold); border: 0.5px solid rgba(212,175,110,0.3); }
.ge-pill-green  { background: rgba(46,107,46,0.12); color: var(--forest-light); border: 0.5px solid rgba(46,107,46,0.3); }
.ge-pill-red    { background: rgba(226,75,74,0.08); color: #e24b4a; border: 0.5px solid rgba(226,75,74,0.2); }
.ge-pill-gray   { background: var(--w04); color: var(--w60); border: 0.5px solid var(--w15); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}

/* ── HOMEPAGE PILLAR CARDS ── */
.pillar-card:hover {
  border-color: rgba(212,175,110,0.35) !important;
  transform: translateY(-3px);
}

/* ════════════════════════════════════════════════════════════════
   2026 REFRESH — readable UI type, modern interaction layer
   ════════════════════════════════════════════════════════════════ */

:root {
  --font-inter: var(--font-inter), -apple-system, 'Segoe UI', sans-serif;
}

/* Readable body text: Inter for UI copy; Cormorant stays for quotes,
   verses and editorial italics via .font-cormorant */
body {
  font-family: var(--font-inter);
  font-size: 15px;
  line-height: 1.65;
  letter-spacing: 0.005em;
}

p, li, td, input, textarea, select, button, label {
  font-family: inherit;
}

/* Editorial accents keep the serif voice */
.serif-quote {
  font-family: var(--font-cormorant);
  font-style: italic;
}

/* ── Interactive layer ── */
a, button { -webkit-tap-highlight-color: transparent; }

:focus-visible {
  outline: 2px solid rgba(212,175,110,0.7);
  outline-offset: 2px;
  border-radius: 4px;
}

.hover-lift {
  transition: transform 0.25s var(--ease), box-shadow 0.25s var(--ease), border-color 0.25s var(--ease);
}
.hover-lift:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 40px rgba(0,0,0,0.35), 0 0 24px rgba(212,175,110,0.06);
  border-color: rgba(212,175,110,0.4) !important;
}

.btn-gold, .btn-outline {
  font-size: 12px;
  border-radius: 10px;
  position: relative;
  overflow: hidden;
}
.btn-gold::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.35) 50%, transparent 60%);
  transform: translateX(-120%);
  transition: transform 0.6s var(--ease);
}
.btn-gold:hover::after { transform: translateX(120%); }

/* Skeleton shimmer for loading states */
.skeleton {
  background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.05) 75%);
  background-size: 200% 100%;
  animation: skeletonWave 1.4s ease infinite;
  border-radius: 8px;
}
@keyframes skeletonWave {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Step transition for wizards */
@keyframes stepIn {
  from { opacity: 0; transform: translateX(18px); }
  to   { opacity: 1; transform: translateX(0); }
}
.step-in { animation: stepIn 0.35s var(--ease); }

/* Staggered reveal children */
.reveal-stagger > * { opacity: 0; transform: translateY(24px); transition: opacity 0.6s var(--ease), transform 0.6s var(--ease); }
.reveal-stagger.visible > * { opacity: 1; transform: translateY(0); }
.reveal-stagger.visible > *:nth-child(1) { transition-delay: 0.00s; }
.reveal-stagger.visible > *:nth-child(2) { transition-delay: 0.08s; }
.reveal-stagger.visible > *:nth-child(3) { transition-delay: 0.16s; }
.reveal-stagger.visible > *:nth-child(4) { transition-delay: 0.24s; }

/* Range slider (design studio) */
input[type="range"].ge-range {
  appearance: none; -webkit-appearance: none;
  width: 100%; height: 3px; border-radius: 2px;
  background: rgba(212,175,110,0.25);
  outline: none;
}
input[type="range"].ge-range::-webkit-slider-thumb {
  appearance: none; -webkit-appearance: none;
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--gold); cursor: pointer;
  border: 2px solid #0f1f0f;
}

/* Color swatch input */
input[type="color"].ge-color {
  appearance: none; -webkit-appearance: none;
  width: 34px; height: 34px; border: none; border-radius: 8px;
  background: none; cursor: pointer; padding: 0;
}
input[type="color"].ge-color::-webkit-color-swatch-wrapper { padding: 2px; }
input[type="color"].ge-color::-webkit-color-swatch { border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; }
__GE_EOF_9a41__
echo "  wrote app/globals.css"
cat > 'tailwind.config.ts' <<'__GE_EOF_9a41__'
import type { Config } from 'tailwindcss'

// ── Green Emblem × shadcn/ui ─────────────────────────────────────────────
// The brand palette drives the shadcn semantic tokens, so components look
// like Green Emblem out of the box rather than default shadcn slate.
//
// preflight is DELIBERATELY OFF. app/globals.css already ships its own
// reset, and the site's existing pages are built with inline styles that a
// second global reset would visibly break. Components are migrated to
// Tailwind page by page; nothing has to move all at once.

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1200px' },
    },
    extend: {
      colors: {
        // ── Brand ──
        forest: {
          DEFAULT: '#1b3f1b',   // card / raised surface
          dark:    '#143314',   // page background (lighter than the old #0f1f0f)
          deepest: '#0e250e',   // nav, footer, deepest chrome
          raised:  '#234c23',   // hover / elevated
          mid:     '#2e6b2e',
          light:   '#5a9e5a',
        },
        gold: {
          DEFAULT: '#d4af6e',
          light:   '#f0d48a',
          dim:     '#a07840',
        },
        cream:  '#f5f0e6',
        violet: '#9b8ec4',

        // ── shadcn semantic tokens (HSL vars in globals.css) ──
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary:   { DEFAULT: 'hsl(var(--primary))',   foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive:{ DEFAULT:'hsl(var(--destructive))',foreground: 'hsl(var(--destructive-foreground))' },
        muted:     { DEFAULT: 'hsl(var(--muted))',     foreground: 'hsl(var(--muted-foreground))' },
        accent:    { DEFAULT: 'hsl(var(--accent))',    foreground: 'hsl(var(--accent-foreground))' },
        popover:   { DEFAULT: 'hsl(var(--popover))',   foreground: 'hsl(var(--popover-foreground))' },
        card:      { DEFAULT: 'hsl(var(--card))',      foreground: 'hsl(var(--card-foreground))' },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        cinzel:    ['var(--font-cinzel)', 'Palatino Linotype', 'serif'],
        cormorant: ['var(--font-cormorant)', 'Georgia', 'serif'],
        sans:      ['var(--font-inter)', 'system-ui', 'sans-serif'],
        arabic:    ['var(--font-arabic)', 'serif'],
        uthmani:   ['var(--font-uthmani)', 'serif'],
      },
      letterSpacing: {
        brand: '0.22em',
        wider2: '0.16em',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up':   { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'fade-up':        { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        'fade-up':        'fade-up 0.35s cubic-bezier(0.22,1,0.36,1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
__GE_EOF_9a41__
echo "  wrote tailwind.config.ts"
mkdir -p "app"
cat > 'app/page.tsx' <<'__GE_EOF_9a41__'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight, Compass, BookOpen, MapPin, HeartHandshake,
  Tv, ShoppingBag, ShieldCheck, Users, Sparkles,
  type LucideIcon,
} from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import LogoIntro from '@/components/LogoIntro'
import ScrollReveal from '@/components/ScrollReveal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PreviewStrip } from '@/components/home/PreviewStrip'
import PrayerPreview from '@/components/home/PrayerPreview'
import QuranPreview from '@/components/home/QuranPreview'
import { getHomePreviews } from '@/lib/home-previews'

// Server component: the live previews are fetched here so they are already
// in the HTML rather than popping in after hydration. Refreshed every
// 5 minutes — fresh enough for a headline, cheap enough to stay fast.
export const revalidate = 300

// ── Shared bits ──────────────────────────────────────────────────────────

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-4 font-cinzel text-[10px] tracking-[0.28em] text-gold">{children}</div>
)

const GoldDivider = () => (
  <div className="mx-auto flex max-w-[120px] items-center gap-3">
    <div className="h-px flex-1 bg-gold/30" />
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
      <polygon points="4,0 5,3 8,3 5.5,5 6.5,8 4,6 1.5,8 2.5,5 0,3 3,3" fill="#d4af6e" opacity="0.6" />
    </svg>
    <div className="h-px flex-1 bg-gold/30" />
  </div>
)

const fmtEventDate = (iso: string) => {
  const d = new Date(iso)
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${time}`
}

const relativeDay = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const FACTS = [
  { stat: '114', label: 'surahs, Uthmani script' },
  { stat: '5×', label: 'daily prayer times, to your location' },
  { stat: '$0', label: 'taken from any sadaqah given' },
]

const VALUES = [
  {
    Icon: ShieldCheck,
    title: 'Worship stays free',
    desc: 'Prayer times, Qibla, and the Quran carry no ads, no upsells, and no paywall. That is a commitment, not a launch offer.',
  },
  {
    Icon: Users,
    title: 'Built around the masjid',
    desc: 'Masjids list and post at no cost. The community layer only works if the institutions at its centre are never charged for it.',
  },
  {
    Icon: Sparkles,
    title: 'Nothing held in between',
    desc: 'Giving goes directly to verified charities. Green Emblem never touches the money and takes no cut.',
  },
]

// ── Pillar card shell ────────────────────────────────────────────────────

function Pillar({
  href, Icon, tag, title, desc, children,
}: {
  href: string
  Icon: LucideIcon
  tag: string
  title: string
  desc: string
  children: React.ReactNode   // the preview strip
}) {
  return (
    <Link href={href} className="group no-underline">
      <Card className="flex h-full flex-col p-6 transition-all duration-200 hover:-translate-y-1 hover:border-gold/40">
        <div className="mb-5 flex items-center justify-between">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-gold/20 bg-gold/[0.08] transition-colors group-hover:bg-gold/15">
            <Icon className="h-5 w-5 text-gold" strokeWidth={1.6} />
          </span>
          <Badge variant="muted">{tag}</Badge>
        </div>

        <h3 className="mb-2.5 font-cinzel text-[17px] text-white">{title}</h3>
        <p className="font-cormorant text-[15px] leading-[1.7] text-white/55">{desc}</p>

        <div className="flex-1" />
        {children}

        <span className="mt-4 flex items-center gap-1.5 font-cinzel text-[9px] tracking-[0.18em] text-white">
          OPEN
          <ArrowRight className="h-3 w-3 text-gold transition-transform duration-200 group-hover:translate-x-1" />
        </span>
      </Card>
    </Link>
  )
}

export default async function HomePage() {
  const { greentv, event, shop, giving } = await getHomePreviews()

  return (
    <>
      <LogoIntro />
      <ScrollReveal />
      <div className="bg-tile" aria-hidden="true" />
      <Nav />

      <main className="relative z-[2]">

        {/* ══ HERO ══ */}
        <section className="relative flex min-h-[92dvh] flex-col items-center justify-center overflow-hidden px-5 pb-20 pt-28 text-center sm:px-6">
          <div className="pointer-events-none absolute left-1/2 top-1/2 w-[min(600px,120vw)] -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.035]">
            <svg viewBox="0 0 220 220" className="h-auto w-full" aria-hidden="true">
              <rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke="#d4af6e" strokeWidth="2" />
              <rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke="#d4af6e" strokeWidth="2" transform="rotate(45 110 110)" />
              <polygon points="110,42 158,42 190,74 190,146 158,178 62,178 30,146 30,74 62,42" fill="#d4af6e" />
            </svg>
          </div>

          <div className="fade-up" style={{ animationDelay: '0.1s' }}>
            <Image
              src="/logo-full.png"
              alt="Green Emblem"
              width={170}
              height={170}
              priority
              className="mx-auto mb-7 h-auto w-[140px] sm:w-[170px]"
            />
          </div>

          <div className="fade-up max-w-[860px]" style={{ animationDelay: '0.22s' }}>
            <div className="mb-5 font-cinzel text-[9px] tracking-[0.34em] text-gold/70 sm:text-[10px]">
              FAITH · STRENGTH · PURPOSE
            </div>
            <h1 className="mb-6 font-cinzel text-[clamp(30px,7vw,64px)] font-medium leading-[1.1] tracking-[-0.01em] text-white">
              One home for faith,<br className="hidden sm:block" />{' '}
              <span className="text-gold">community, and giving</span>
            </h1>
            <p className="mx-auto mb-9 max-w-[600px] font-cormorant text-[clamp(16px,2.2vw,20px)] italic leading-[1.75] text-white/65">
              Prayer times wherever you stand. The Quran in Uthmani script. Your masjid&apos;s
              events, halal food within reach, and a free way to turn any celebration into
              sadaqah.
            </p>
            <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Button asChild variant="brand" size="lg" className="w-full sm:w-auto">
                <Link href="/explore">Explore the app</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href="/prayer">Today&apos;s prayer times</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ══ FACT STRIP ══ */}
        <section className="border-y border-gold/10 bg-forest-deepest/60 px-5 py-9 sm:px-6">
          <div className="mx-auto grid max-w-[900px] grid-cols-1 gap-7 text-center sm:grid-cols-3 sm:gap-6">
            {FACTS.map(({ stat, label }) => (
              <div key={label}>
                <div className="font-cinzel text-[30px] leading-none text-gold sm:text-[34px]">{stat}</div>
                <div className="mt-2 font-cormorant text-sm italic text-white/55">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ══ THE PLATFORM — each card previews what's behind it ══ */}
        <section className="reveal mx-auto max-w-[1120px] px-5 py-20 sm:px-6 sm:py-24">
          <div className="mb-12 text-center">
            <Eyebrow>The platform</Eyebrow>
            <h2 className="mb-4 font-cinzel text-[clamp(24px,4.5vw,40px)] font-medium leading-tight text-white">
              Everything the day asks of you,<br className="hidden sm:block" /> in one place
            </h2>
            <p className="mx-auto max-w-[560px] font-cormorant text-[17px] italic leading-relaxed text-white/50">
              Six parts of Green Emblem, each built to be the best version of itself.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

            <Pillar
              href="/prayer" Icon={Compass} tag="WORSHIP" title="Prayer & Qibla"
              desc="Prayer times calculated for your exact coordinates, with a live compass to the Kaaba."
            >
              <PrayerPreview />
            </Pillar>

            <Pillar
              href="/prayer?tab=quran" Icon={BookOpen} tag="WORSHIP" title="The Quran"
              desc="All 114 surahs in Uthmani script, with translation and Tafsir Ibn Kathir."
            >
              <QuranPreview />
            </Pillar>

            <Pillar
              href="/greenworld-plus" Icon={MapPin} tag="COMMUNITY" title="GreenWorld+"
              desc="Follow your masjid, and find masjids and halal food inside the radius you set."
            >
              {event ? (
                <PreviewStrip
                  label="NEXT IN YOUR COMMUNITY"
                  value={event.title}
                  meta={[fmtEventDate(event.startsAt), event.masjid].filter(Boolean).join(' · ')}
                />
              ) : (
                <PreviewStrip
                  label="COMMUNITY EVENTS"
                  value="Follow a masjid to see its events here"
                  muted
                />
              )}
            </Pillar>

            <Pillar
              href="/sadaqah" Icon={HeartHandshake} tag="GIVING" title="Baab As-Sadaqah"
              desc="Turn a Nikkah, Walima, or Aqiqah into charity with a QR code guests scan."
            >
              {giving ? (
                <PreviewStrip
                  label="GIVEN SO FAR"
                  value={`${giving.meals.toLocaleString()} meals funded`}
                  meta="Through Green Emblem campaigns"
                />
              ) : (
                <PreviewStrip
                  label="WHAT IT COSTS"
                  value="Free — and no cut of what's given"
                  meta="Your design, your QR code, in minutes"
                />
              )}
            </Pillar>

            <Pillar
              href="/greentv" Icon={Tv} tag="MEDIA" title="GreenTV & GreenFitness"
              desc="Community news, clips, and training content — discipline and purpose."
            >
              {greentv ? (
                <PreviewStrip
                  label="LATEST"
                  value={greentv.headline}
                  meta={relativeDay(greentv.postedAt)}
                />
              ) : (
                <PreviewStrip label="LATEST" value="New posts land here as they go out" muted />
              )}
            </Pillar>

            <Pillar
              href="/shop" Icon={ShoppingBag} tag="SHOP" title="Islamic Shop"
              desc="Clothing and accessories for the Muslim home, including Stand in the Middle."
            >
              {shop ? (
                <PreviewStrip
                  label="IN THE SHOP"
                  value={shop.name}
                  meta={shop.price != null ? `$${shop.price.toFixed(2)}` : null}
                />
              ) : (
                <PreviewStrip label="IN THE SHOP" value="New pieces arriving soon" muted />
              )}
            </Pillar>

          </div>
        </section>

        {/* ══ SPOTLIGHT — community radius ══ */}
        <section className="reveal border-y border-gold/10 bg-forest-deepest/40 px-5 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto grid max-w-[1050px] items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <Eyebrow>Your neighbourhood</Eyebrow>
              <h2 className="mb-5 font-cinzel text-[clamp(23px,3.6vw,34px)] font-medium leading-tight text-white">
                Set how far you&apos;ll travel. We&apos;ll show you what&apos;s inside it.
              </h2>
              <p className="mb-7 font-cormorant text-[17px] italic leading-[1.8] text-white/60">
                Drag the radius and the map answers: the masjids you could pray at, halal food
                worth the drive, and community events close enough to actually attend. Follow a
                masjid and its announcements come to you first.
              </p>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href="/greenworld-plus">Open GreenWorld+</Link>
              </Button>
            </div>

            <div className="order-first lg:order-last">
              <Card className="aspect-[4/3] w-full overflow-hidden p-0">
                <svg viewBox="0 0 400 300" className="h-full w-full" role="img" aria-label="Illustration of a travel radius over a map">
                  <defs>
                    <radialGradient id="ring" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#d4af6e" stopOpacity="0.16" />
                      <stop offset="100%" stopColor="#d4af6e" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <g stroke="#d4af6e" strokeOpacity="0.07" strokeWidth="1">
                    {[0, 1, 2, 3, 4, 5].map(i => <line key={`h${i}`} x1="0" y1={i * 55 + 15} x2="400" y2={i * 55 + 15} />)}
                    {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <line key={`v${i}`} x1={i * 52 + 18} y1="0" x2={i * 52 + 18} y2="300" />)}
                  </g>
                  <circle cx="200" cy="150" r="112" fill="url(#ring)" />
                  <circle cx="200" cy="150" r="112" fill="none" stroke="#d4af6e" strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="5 5" />
                  <circle cx="200" cy="150" r="70" fill="none" stroke="#d4af6e" strokeOpacity="0.2" strokeWidth="1" />
                  {[[140, 108], [268, 128], [176, 214], [246, 205], [128, 176]].map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r="5" fill={i % 2 ? '#5a9e5a' : '#d4af6e'} />
                  ))}
                  <circle cx="200" cy="150" r="8" fill="#f5f0e6" />
                  <circle cx="200" cy="150" r="14" fill="none" stroke="#f5f0e6" strokeOpacity="0.35" strokeWidth="1.5" />
                </svg>
              </Card>
            </div>
          </div>
        </section>

        {/* ══ SPOTLIGHT — giving ══ */}
        <section className="reveal mx-auto max-w-[820px] px-5 py-20 text-center sm:px-6 sm:py-24">
          <GoldDivider />
          <div className="my-9">
            <div className="mb-5 font-arabic text-[26px] text-gold/75 sm:text-[30px]" lang="ar">
              بَابُ الصَّدَقَة
            </div>
            <h2 className="mb-4 font-cinzel text-[clamp(23px,4vw,36px)] font-medium text-white">
              A celebration that keeps giving
            </h2>
            <p className="mx-auto mb-8 max-w-[600px] font-cormorant text-[17px] italic leading-[1.8] text-white/60">
              Design a QR card for your Nikkah, Walima, or Aqiqah in minutes. Guests scan it,
              choose a verified charity, and give in the honourees&apos; name — directly, with
              nothing held in between. Free, permanently.
            </p>
            <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row">
              <Button asChild variant="brand" size="lg" className="w-full sm:w-auto">
                <Link href="/sadaqah">Start a campaign</Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="w-full font-cinzel text-[11px] tracking-wider2 text-white sm:w-auto">
                <Link href="/sadaqah/request">Request one instead</Link>
              </Button>
            </div>
          </div>
          <GoldDivider />
        </section>

        {/* ══ VALUES ══ */}
        <section className="reveal border-t border-gold/10 bg-forest-deepest/50 px-5 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-[1050px]">
            <div className="mb-12 text-center">
              <Eyebrow>What we hold to</Eyebrow>
              <h2 className="font-cinzel text-[clamp(23px,4vw,36px)] font-medium text-white">
                The parts we will never charge for
              </h2>
            </div>
            <div className="grid gap-8 sm:grid-cols-3 sm:gap-10">
              {VALUES.map(({ Icon, title, desc }) => (
                <div key={title} className="text-center sm:text-left">
                  <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-gold/20 bg-gold/[0.08]">
                    <Icon className="h-5 w-5 text-gold" strokeWidth={1.6} />
                  </span>
                  <h3 className="mb-2.5 font-cinzel text-[15px] text-white">{title}</h3>
                  <p className="font-cormorant text-[15px] leading-[1.75] text-white/55">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ CLOSING CTA ══ */}
        <section className="reveal mx-auto max-w-[720px] px-5 py-20 text-center sm:px-6 sm:py-28">
          <h2 className="mb-4 font-cinzel text-[clamp(24px,4.5vw,40px)] font-medium leading-tight text-white">
            Start where you are
          </h2>
          <p className="mb-9 font-cormorant text-[17px] italic leading-[1.8] text-white/55">
            Check today&apos;s prayer times, open the Quran, or find your masjid. No account
            needed to begin.
          </p>
          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row">
            <Button asChild variant="brand" size="lg" className="w-full sm:w-auto">
              <Link href="/explore">Explore the app</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link href="/auth/sign-in">Create an account</Link>
            </Button>
          </div>
        </section>

      </main>
      <Footer />
    </>
  )
}
__GE_EOF_9a41__
echo "  wrote app/page.tsx"
mkdir -p "app/explore"
cat > 'app/explore/page.tsx' <<'__GE_EOF_9a41__'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export const metadata = {
  title: 'Explore',
  description: 'Worship, community, and media — every part of Green Emblem in one place.',
}

type Section = {
  href: string | null
  tag: string
  tone: 'default' | 'green' | 'violet' | 'muted'
  title: string
  desc: string
}

const SECTIONS: Section[] = [
  {
    href: '/greenworld-plus', tone: 'violet', tag: 'COMMUNITY',
    title: 'GreenWorld+',
    desc: 'Follow your masjid, see local events, and explore masjids and halal food within your travel radius.',
  },
  {
    href: '/prayer', tone: 'default', tag: 'WORSHIP',
    title: 'Prayer & Qibla',
    desc: 'Accurate prayer times for your location, a live Qibla compass, and your madhab preferences.',
  },
  {
    href: '/prayer?tab=quran', tone: 'default', tag: 'WORSHIP',
    title: 'Quran',
    desc: 'Read any surah in Uthmani script with translation and Tafsir Ibn Kathir — your place remembered.',
  },
  {
    href: '/greentv', tone: 'green', tag: 'MEDIA',
    title: 'GreenTV',
    desc: 'News, community clips, and live moments from the Green Emblem community.',
  },
  {
    href: '/greenfitness', tone: 'green', tag: 'MEDIA',
    title: 'GreenFitness',
    desc: 'Fitness coaching and training content, rooted in discipline and purpose.',
  },
  {
    href: '/shop', tone: 'default', tag: 'SHOP',
    title: 'Islamic Shop',
    desc: 'Curated Islamic products and Green Emblem merchandise.',
  },
  {
    href: null, tone: 'muted', tag: 'COMING SOON',
    title: 'Local Businesses',
    desc: 'Muslim-owned businesses near you — reviews, halal verification, and community-first promotion.',
  },
]

export default function ExplorePage() {
  return (
    <>
      <div className="bg-tile" aria-hidden="true" />
      <Nav />

      <main className="relative z-[2] mx-auto min-h-[100dvh] max-w-[900px] px-5 pb-20 pt-32 sm:px-6">

        <header className="mb-11 text-center">
          <div className="mb-4 font-cinzel text-[10px] tracking-[0.3em] text-gold">EXPLORE</div>
          <h1 className="mb-3 font-cinzel text-[clamp(28px,5vw,44px)] font-medium text-white">
            Everything Green Emblem
          </h1>
          <p className="font-cormorant text-[17px] italic leading-[1.7] text-white/50">
            Worship, community, and media — one place.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map(s => {
            const body = (
              <Card
                className={cn(
                  'flex h-full flex-col p-6 transition-all duration-200',
                  s.href
                    ? 'hover:-translate-y-1 hover:border-gold/35'
                    : 'opacity-70'
                )}
              >
                <Badge variant={s.tone} className="mb-3.5 self-start">{s.tag}</Badge>
                <h2 className={cn('mb-2 font-cinzel text-lg', s.href ? 'text-white' : 'text-white/50')}>
                  {s.title}
                </h2>
                <p className="flex-1 font-cormorant text-sm italic leading-relaxed text-white/45">
                  {s.desc}
                </p>
                {s.href && (
                  <div className="mt-4 flex items-center gap-1.5 font-cinzel text-[9px] tracking-[0.18em] text-white">
                    OPEN
                    <ArrowRight className="h-3 w-3 text-gold transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                )}
              </Card>
            )

            return s.href ? (
              <Link key={s.title} href={s.href} className="group no-underline">{body}</Link>
            ) : (
              <div key={s.title}>{body}</div>
            )
          })}
        </div>
      </main>

      <Footer />
    </>
  )
}
__GE_EOF_9a41__
echo "  wrote app/explore/page.tsx"
mkdir -p "components"
cat > 'components/Nav.tsx' <<'__GE_EOF_9a41__'
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/prayer',            label: 'Prayer' },
  { href: '/prayer?tab=quran',  label: 'Quran' },
  { href: '/explore',           label: 'Explore' },
  { href: '/shop',              label: 'Shop' },
]

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [user, setUser] = useState<any>(null)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => { setMenuOpen(false) }, [pathname])

  // Lock body scroll while the mobile sheet is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const isActive = (href: string) => {
    const base = href.split('?')[0]
    const qs = href.split('?')[1]
    if (qs) return pathname === base && typeof window !== 'undefined' && window.location.search.includes(qs)
    return base === '/' ? pathname === '/' : pathname?.startsWith(base)
  }

  return (
    <>
      <nav
        role="navigation"
        aria-label="Main navigation"
        className={cn(
          'fixed inset-x-0 top-0 z-[100] h-[68px] border-b transition-colors duration-300',
          'backdrop-blur-xl',
          scrolled ? 'border-gold/25 bg-forest-deepest/95' : 'border-gold/10 bg-forest-dark/85'
        )}
      >
        <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-6 lg:px-10">

          <Link href="/" className="-my-1 flex min-h-[44px] items-center gap-3 py-1 no-underline">
            <Image src="/icon.png" alt="" width={32} height={32} className="rounded-md" priority />
            <span className="font-cinzel text-[13px] tracking-brand text-cream">
              GREEN <span className="text-gold">★</span> EMBLEM
            </span>
          </Link>

          {/* Desktop */}
          <ul className="hidden list-none items-center gap-8 lg:flex">
            {LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'relative font-cinzel text-[10px] tracking-wider2 no-underline transition-colors',
                    'after:absolute after:-bottom-1.5 after:left-0 after:h-px after:bg-gold after:transition-all after:duration-300',
                    isActive(href)
                      ? 'text-white after:w-full'
                      : 'text-white/70 hover:text-white after:w-0 hover:after:w-full'
                  )}
                >
                  {label}
                </Link>
              </li>
            ))}
            {user ? (
              <>
                <li>
                  <Link href="/dashboard" className="font-cinzel text-[10px] tracking-wider2 text-white/70 no-underline transition-colors hover:text-white">
                    My Dashboard
                  </Link>
                </li>
                <li>
                  <button onClick={signOut} className="cursor-pointer border-none bg-transparent p-0 font-cinzel text-[10px] tracking-wider2 text-white/70 transition-colors hover:text-white">
                    Sign out
                  </button>
                </li>
              </>
            ) : (
              <li>
                <Link href="/auth/sign-in" className="font-cinzel text-[10px] tracking-wider2 text-white/70 no-underline transition-colors hover:text-white">
                  Sign in
                </Link>
              </li>
            )}
            <li>
              <Button asChild variant="brand" size="sm">
                <Link href="/explore">Explore</Link>
              </Button>
            </li>
          </ul>

          {/* Mobile toggle */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="-mr-2 flex h-11 w-11 cursor-pointer items-center justify-center border-none bg-transparent text-gold lg:hidden"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile sheet */}
      <div
        className={cn(
          'fixed inset-x-0 top-[68px] z-[99] origin-top border-b border-gold/15 bg-forest-deepest/95 backdrop-blur-xl transition-all duration-200 lg:hidden',
          menuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
        )}
      >
        <div className="flex flex-col gap-1 p-5">
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'rounded-md px-3 py-3 font-cinzel text-[12px] tracking-wider2 no-underline transition-colors',
                isActive(href) ? 'bg-gold/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
              )}
            >
              {label}
            </Link>
          ))}
          {user ? (
            <>
              <Link href="/dashboard" className="rounded-md px-3 py-3 font-cinzel text-[12px] tracking-wider2 text-white/70 no-underline transition-colors hover:bg-white/5 hover:text-white">
                My Dashboard
              </Link>
              <button onClick={signOut} className="cursor-pointer rounded-md border-none bg-transparent px-3 py-3 text-left font-cinzel text-[12px] tracking-wider2 text-white/70 transition-colors hover:bg-white/5 hover:text-white">
                Sign out
              </button>
            </>
          ) : (
            <Link href="/auth/sign-in" className="rounded-md px-3 py-3 font-cinzel text-[12px] tracking-wider2 text-white no-underline transition-colors hover:bg-white/5">
              Sign in
            </Link>
          )}
          <Button asChild variant="brand" className="mt-2 w-full">
            <Link href="/explore">Explore</Link>
          </Button>
        </div>
      </div>
    </>
  )
}
__GE_EOF_9a41__
echo "  wrote components/Nav.tsx"
mkdir -p "components"
cat > 'components/Footer.tsx' <<'__GE_EOF_9a41__'
import Link from 'next/link'
import Image from 'next/image'
import { Separator } from '@/components/ui/separator'

const PLATFORM = [
  { href: '/sadaqah',           label: 'Baab As-Sadaqah' },
  { href: '/prayer',            label: 'Prayer & Qibla' },
  { href: '/prayer?tab=quran',  label: 'Quran' },
  { href: '/greenworld-plus',   label: 'GreenWorld+' },
  { href: '/shop',              label: 'Islamic Shop' },
]

const COMPANY = [
  { href: '/about',   label: 'About Us' },
  { href: '/contact', label: 'Contact' },
  { href: '/terms',   label: 'Terms of Service' },
  { href: '/privacy', label: 'Privacy Policy' },
]

const linkClass =
  'font-cormorant text-sm italic text-white/75 no-underline transition-colors hover:text-white'

const colTitleClass =
  'mb-4 font-cinzel text-[9px] tracking-[0.2em] text-gold/80'

export default function Footer() {
  return (
    <footer className="border-t border-gold/10 bg-forest-deepest px-5 sm:px-6 pb-8 pt-14 lg:px-10">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr] lg:gap-12">

          {/* Brand */}
          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <Image src="/icon.png" alt="" width={30} height={30} className="rounded-md" aria-hidden="true" />
              <span className="font-cinzel text-[13px] tracking-[0.2em] text-cream">
                GREEN <span className="text-gold">★</span> EMBLEM
              </span>
            </div>
            <div className="mb-3 font-cinzel text-[9px] tracking-[0.34em] text-gold/60">
              FAITH · STRENGTH · PURPOSE
            </div>
            <p className="max-w-[260px] font-cormorant text-sm italic leading-relaxed text-white/35">
              Islamic events, giving &amp; community. Every celebration honoured with intention.
            </p>
          </div>

          {/* Platform */}
          <div>
            <div className={colTitleClass}>Platform</div>
            <div className="flex flex-col gap-2.5">
              {PLATFORM.map(({ href, label }) => (
                <Link key={href} href={href} className={linkClass}>{label}</Link>
              ))}
            </div>
          </div>

          {/* Company */}
          <div>
            <div className={colTitleClass}>Company</div>
            <div className="flex flex-col gap-2.5">
              {COMPANY.map(({ href, label }) => (
                <Link key={href} href={href} className={linkClass}>{label}</Link>
              ))}
            </div>
          </div>
        </div>

        <Separator className="bg-white/[0.06]" />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-5">
          <span className="font-cinzel text-[11px] tracking-wide text-white/30">
            © 2026 Green Emblem. All rights reserved.
          </span>
          <span className="font-arabic text-sm text-gold/45" lang="ar">
            بَارَكَ اللَّهُ فِيهِ
          </span>
        </div>
      </div>
    </footer>
  )
}
__GE_EOF_9a41__
echo "  wrote components/Footer.tsx"
mkdir -p "components"
cat > 'components/BottomNav.tsx' <<'__GE_EOF_9a41__'
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Compass, HeartHandshake, LayoutGrid, User } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Mobile bottom tab bar ────────────────────────────────────────────────
// Pocket-check features one thumb-tap away. Hidden on desktop and admin.
const TABS = [
  { href: '/',          label: 'Home',    Icon: Home },
  { href: '/prayer',    label: 'Prayer',  Icon: Compass },
  { href: '/sadaqah',   label: 'Give',    Icon: HeartHandshake },
  { href: '/explore',   label: 'Explore', Icon: LayoutGrid },
  { href: '/dashboard', label: 'Profile', Icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()
  if (pathname?.startsWith('/admin')) return null

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname?.startsWith(href)

  return (
    <>
      <nav
        aria-label="Primary"
        className={cn(
          'fixed inset-x-0 bottom-0 z-[120] border-t border-gold/15 bg-forest-deepest/95 backdrop-blur-xl lg:hidden',
          'pb-[env(safe-area-inset-bottom,0px)]'
        )}
      >
        <div className="mx-auto flex h-[62px] max-w-[520px] items-stretch justify-around">
          {TABS.map(({ href, label, Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className="relative flex flex-1 flex-col items-center justify-center gap-[3px] no-underline"
              >
                {active && (
                  <span className="absolute top-0 h-0.5 w-6 rounded-full bg-gold" />
                )}
                <Icon
                  className={cn('h-[22px] w-[22px] transition-colors', active ? 'text-gold' : 'text-white/60')}
                  strokeWidth={active ? 2 : 1.6}
                />
                <span
                  className={cn(
                    'text-[9px] font-semibold tracking-wide transition-colors',
                    active ? 'text-white' : 'text-white/60'
                  )}
                >
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Keep page content clear of the bar on mobile */}
      <style>{`
        @media (max-width: 1023px) {
          body { padding-bottom: calc(62px + env(safe-area-inset-bottom, 0px)); }
        }
      `}</style>
    </>
  )
}
__GE_EOF_9a41__
echo "  wrote components/BottomNav.tsx"
mkdir -p "lib/supabase"
cat > 'lib/supabase/server.ts' <<'__GE_EOF_9a41__'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

// Public client — anon key, and crucially NO cookie access. Reading cookies
// opts a route into dynamic rendering, so any page that only needs public
// data (e.g. the homepage previews) must use this instead of createClient()
// or it will hit the database on every single request.
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Admin client — bypasses RLS. Server-side only, never expose to client.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
__GE_EOF_9a41__
echo "  wrote lib/supabase/server.ts"
mkdir -p "lib"
cat > 'lib/home-previews.ts' <<'__GE_EOF_9a41__'
import 'server-only'
import { createPublicClient, createAdminClient } from '@/lib/supabase/server'

// ── Homepage live previews (server-side) ─────────────────────────────────
// Each card on the homepage shows a glimpse of what's behind the link.
//
// RULES FOR THIS FILE:
//  1. Every fetch fails soft. A preview is a nicety — it must never break
//     the homepage, and an error returns null so the card falls back to its
//     static description.
//  2. Never invent or round up. If there is nothing real to show, show
//     nothing. An empty preview is honest; a fabricated one is not.

export type GreenTvPreview = { headline: string; postedAt: string }
export type EventPreview   = { title: string; startsAt: string; masjid: string | null }
export type ShopPreview    = { name: string; price: number | null }
export type GivingPreview  = { meals: number }

export type HomePreviews = {
  greentv: GreenTvPreview | null
  event:   EventPreview | null
  shop:    ShopPreview | null
  giving:  GivingPreview | null
}

// Telegram-fed posts have no title field — take the first sensible line of
// the body as a headline, trimmed to something that fits on a card.
function toHeadline(text: string | null): string | null {
  if (!text) return null
  const firstLine = text
    .split('\n')
    .map(l => l.trim())
    .find(l => l.length > 0)
  if (!firstLine) return null
  const clean = firstLine.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim()
  if (clean.length < 3) return null
  return clean.length > 110 ? clean.slice(0, 107).trimEnd() + '…' : clean
}

async function latestGreenTv(): Promise<GreenTvPreview | null> {
  try {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('greentv_posts')
      .select('text, posted_at')
      .order('posted_at', { ascending: false })
      .limit(5)
    for (const post of data || []) {
      const headline = toHeadline(post.text)
      if (headline) return { headline, postedAt: post.posted_at }
    }
    return null
  } catch { return null }
}

async function nextEvent(): Promise<EventPreview | null> {
  try {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('masjid_events')
      .select('title, event_start, masjids(name)')
      .eq('status', 'active')
      .gte('event_start', new Date().toISOString())
      .order('event_start', { ascending: true })
      .limit(1)
    const e: any = data?.[0]
    if (!e?.title) return null
    return {
      title: e.title,
      startsAt: e.event_start,
      masjid: e.masjids?.name ?? null,
    }
  } catch { return null }
}

async function featuredProduct(): Promise<ShopPreview | null> {
  try {
    const supabase = createPublicClient()
    // Prefer an explicitly featured item, else the first published one.
    for (const visibility of ['featured', 'published']) {
      const { data } = await supabase
        .from('products')
        .select('name, price')
        .eq('visibility', visibility)
        .order('sort_order', { ascending: true })
        .limit(1)
      const p: any = data?.[0]
      if (p?.name) return { name: p.name, price: typeof p.price === 'number' ? p.price : null }
    }
    return null
  } catch { return null }
}

// Aggregate only — no donor detail ever leaves this function. Returns null
// when nothing has been funded yet, so the card shows its static line
// instead of a hollow "0".
async function givingTotals(): Promise<GivingPreview | null> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('donations')
      .select('meals_funded')
      .eq('confirmed', true)
    const meals = (data || []).reduce((sum, d: any) => sum + (d.meals_funded || 0), 0)
    return meals > 0 ? { meals } : null
  } catch { return null }
}

export async function getHomePreviews(): Promise<HomePreviews> {
  const [greentv, event, shop, giving] = await Promise.all([
    latestGreenTv(),
    nextEvent(),
    featuredProduct(),
    givingTotals(),
  ])
  return { greentv, event, shop, giving }
}
__GE_EOF_9a41__
echo "  wrote lib/home-previews.ts"
mkdir -p "components/home"
cat > 'components/home/PreviewStrip.tsx' <<'__GE_EOF_9a41__'
import { cn } from '@/lib/utils'

// The inset panel at the foot of each pillar card. One shape for every
// card so the grid reads as a system, whatever the content.
export function PreviewStrip({
  label, value, meta, muted = false, className,
}: {
  label: string
  value: React.ReactNode
  meta?: string | null
  muted?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'mt-5 rounded-lg border border-gold/10 bg-black/15 px-3.5 py-3',
        className
      )}
    >
      <div className="mb-1 font-cinzel text-[8.5px] tracking-[0.2em] text-gold/70">{label}</div>
      <div
        className={cn(
          'font-cormorant text-[14px] leading-snug',
          muted ? 'italic text-white/45' : 'text-white'
        )}
      >
        {value}
      </div>
      {meta && <div className="mt-1 font-cinzel text-[9px] tracking-[0.1em] text-white/35">{meta}</div>}
    </div>
  )
}
__GE_EOF_9a41__
echo "  wrote components/home/PreviewStrip.tsx"
mkdir -p "components/home"
cat > 'components/home/PrayerPreview.tsx' <<'__GE_EOF_9a41__'
'use client'
import { useEffect, useState } from 'react'
import { computeDayTimes, orderedPrayers, fmtTime, type CalcMethodId } from '@/lib/prayer'
import { PreviewStrip } from './PreviewStrip'

const LOCATION_CACHE_KEY = 'ge_prayer_location'

// Shows the next prayer using the location the Prayer page already cached.
// Deliberately does NOT ask for geolocation — the homepage should never
// trigger a permission prompt. Visitors who haven't used the Prayer page yet
// see an invitation instead.
export default function PrayerPreview() {
  const [next, setNext] = useState<{ label: string; time: string; countdown: string } | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let coords: { lat: number; lng: number } | null = null
    let method: CalcMethodId = 'MuslimWorldLeague'
    let madhab: 'shafi' | 'hanafi' = 'shafi'
    try {
      const raw = localStorage.getItem(LOCATION_CACHE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        // Same 24h freshness window the Prayer page uses
        if (parsed?.coords && Date.now() - parsed.savedAt < 24 * 60 * 60 * 1000) coords = parsed.coords
      }
    } catch {}

    if (!coords) { setReady(true); return }

    const tick = () => {
      try {
        const now = new Date()
        const times = computeDayTimes(coords!.lat, coords!.lng, now, method)
        const prayers = orderedPrayers(times, madhab).filter(p => p.key !== 'sunrise')
        let upcoming = prayers.find(p => p.time > now)

        if (!upcoming) {
          // Past Isha — next is tomorrow's Fajr
          const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
          const t = computeDayTimes(coords!.lat, coords!.lng, tomorrow, method)
          upcoming = orderedPrayers(t, madhab)[0]
        }
        if (!upcoming) { setReady(true); return }

        const diffMin = Math.max(0, Math.round((upcoming.time.getTime() - now.getTime()) / 60000))
        const h = Math.floor(diffMin / 60)
        const m = diffMin % 60
        setNext({
          label: upcoming.label,
          time: fmtTime(upcoming.time),
          countdown: h > 0 ? `in ${h}h ${m}m` : `in ${m}m`,
        })
      } catch {}
      setReady(true)
    }

    tick()
    const id = setInterval(tick, 60000)
    return () => clearInterval(id)
  }, [])

  if (!ready) {
    return <PreviewStrip label="NEXT PRAYER" value="…" muted />
  }
  if (!next) {
    return <PreviewStrip label="NEXT PRAYER" value="Share your location to see today's times" muted />
  }
  return (
    <PreviewStrip
      label="NEXT PRAYER"
      value={
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-cinzel text-[15px] text-gold">{next.label}</span>
          <span className="text-white">{next.time}</span>
        </span>
      }
      meta={next.countdown}
    />
  )
}
__GE_EOF_9a41__
echo "  wrote components/home/PrayerPreview.tsx"
mkdir -p "components/home"
cat > 'components/home/QuranPreview.tsx' <<'__GE_EOF_9a41__'
'use client'
import { useEffect, useState } from 'react'
import { SURAHS } from '@/lib/quran'
import { PreviewStrip } from './PreviewStrip'

const PREF_KEY = 'ge_quran_prefs'

// Picks up where the reader left off, from the same key the reader writes.
export default function QuranPreview() {
  const [surah, setSurah] = useState<{ number: number; name: string } | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY)
      if (raw) {
        const p = JSON.parse(raw)
        const found = SURAHS.find(s => s.number === p?.surah)
        if (found && found.number !== 1) setSurah({ number: found.number, name: found.name })
      }
    } catch {}
    setReady(true)
  }, [])

  if (!ready) return <PreviewStrip label="THE QURAN" value="…" muted />

  return surah
    ? <PreviewStrip label="CONTINUE READING" value={`${surah.number}. ${surah.name}`} meta="Pick up where you left off" />
    : <PreviewStrip label="BEGIN WITH" value="1. Al-Fatihah" meta="The Opening · 7 verses" />
}
__GE_EOF_9a41__
echo "  wrote components/home/QuranPreview.tsx"

echo
echo "==> Verifying"
MISS=0
if [ ! -s "APPLY-VISUAL-REVAMP.md" ]; then echo "  MISSING APPLY-VISUAL-REVAMP.md"; MISS=1; fi
if [ ! -s "app/globals.css" ]; then echo "  MISSING app/globals.css"; MISS=1; fi
if [ ! -s "tailwind.config.ts" ]; then echo "  MISSING tailwind.config.ts"; MISS=1; fi
if [ ! -s "app/page.tsx" ]; then echo "  MISSING app/page.tsx"; MISS=1; fi
if [ ! -s "app/explore/page.tsx" ]; then echo "  MISSING app/explore/page.tsx"; MISS=1; fi
if [ ! -s "components/Nav.tsx" ]; then echo "  MISSING components/Nav.tsx"; MISS=1; fi
if [ ! -s "components/Footer.tsx" ]; then echo "  MISSING components/Footer.tsx"; MISS=1; fi
if [ ! -s "components/BottomNav.tsx" ]; then echo "  MISSING components/BottomNav.tsx"; MISS=1; fi
if [ ! -s "lib/supabase/server.ts" ]; then echo "  MISSING lib/supabase/server.ts"; MISS=1; fi
if [ ! -s "lib/home-previews.ts" ]; then echo "  MISSING lib/home-previews.ts"; MISS=1; fi
if [ ! -s "components/home/PreviewStrip.tsx" ]; then echo "  MISSING components/home/PreviewStrip.tsx"; MISS=1; fi
if [ ! -s "components/home/PrayerPreview.tsx" ]; then echo "  MISSING components/home/PrayerPreview.tsx"; MISS=1; fi
if [ ! -s "components/home/QuranPreview.tsx" ]; then echo "  MISSING components/home/QuranPreview.tsx"; MISS=1; fi
if [ "$MISS" = "1" ]; then echo; echo "Some files did not write."; exit 1; fi

grep -q "143314" app/globals.css      || { echo "  ERROR: lighter palette missing"; exit 1; }
grep -q "One home for faith" app/page.tsx || { echo "  ERROR: new homepage did not write"; exit 1; }
grep -q "getHomePreviews" app/page.tsx    || { echo "  ERROR: live previews not wired in"; exit 1; }
grep -q "createPublicClient" lib/supabase/server.ts || { echo "  ERROR: public supabase client missing"; exit 1; }

echo "  all files present; palette, homepage and live previews in place"
echo
echo "─────────────────────────────────────────────"
echo "  npm run build"
echo "  git add -A"
echo "  git commit -m 'feat: homepage platform showcase with live previews, lighter palette, white links, mobile polish'"
echo "  git push"
echo "─────────────────────────────────────────────"
