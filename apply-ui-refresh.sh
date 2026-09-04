#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
#  Green Emblem — remove rewards + Tailwind/shadcn UI foundation
#
#  Run from the project root:   bash apply-ui-refresh.sh
#  Safe to run more than once.
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

if [ ! -f package.json ] || ! grep -q '"green-emblem"' package.json; then
  echo "ERROR: run this from the green-emblem project root." >&2
  exit 1
fi

echo "==> Removing the rewards system"
rm -rf "app/rewards" && echo "  removed app/rewards" || true
rm -rf "app/api/rewards" && echo "  removed app/api/rewards" || true
rm -rf "components/RewardsWidgets.tsx" && echo "  removed components/RewardsWidgets.tsx" || true
rm -rf "lib/rewards.ts" && echo "  removed lib/rewards.ts" || true
rm -rf "rewards.sql" && echo "  removed rewards.sql" || true
rm -rf "APPLY-REWARDS.md" && echo "  removed APPLY-REWARDS.md" || true

echo
echo "==> Installing Tailwind + shadcn dependencies (this takes a minute)"
npm install class-variance-authority clsx tailwind-merge lucide-react @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-select @radix-ui/react-dropdown-menu @radix-ui/react-separator @radix-ui/react-label --silent
npm install -D tailwindcss@3 postcss autoprefixer tailwindcss-animate --silent
echo "  dependencies installed"

echo
echo "==> Writing files"
cat > 'APPLY-UI-REFRESH.md' <<'__GE_EOF_4b8e1f__'
# Green Emblem — Rewards Removed + Tailwind/shadcn UI Foundation

Two changes: the rewards system is gone, and the site now runs on Tailwind CSS
with shadcn/ui components themed to the Green Emblem brand.

---

## 1. Rewards system — removed

Deleted: `app/rewards/`, `app/api/rewards/`, `components/RewardsWidgets.tsx`,
`lib/rewards.ts`, `rewards.sql`, `APPLY-REWARDS.md`.

Stripped from: the prayer page (mark-as-prayed ✓ buttons), Quran reader,
GreenWorld+, donate confirmation, Nav, Footer, Explore, and the admin console
(the Rewards panel is gone).

`/rewards` now returns 404 and no page mentions points or streaks.

### Optional: drop the database tables
`rewards-teardown.sql` removes `point_events`, `user_points`,
`rewards_catalog`, `redemptions` and their functions.

**This is optional and destructive** — it permanently deletes every point
balance and redemption record. The app no longer touches those tables, so
leaving them in place is completely harmless. Only run it if you're sure you
won't reinstate rewards.

---

## 2. Tailwind CSS + shadcn/ui

### Why it's set up this way
Your site was built entirely with inline styles. A standard shadcn install
enables Tailwind's **preflight** — a global CSS reset — which would have
visibly broken every page that hasn't been migrated yet.

So preflight is **deliberately disabled** (`tailwind.config.ts`), and
`globals.css` supplies only the three border defaults Tailwind's `border`
utilities actually need. Inline styles and existing class rules both outrank
those, so **every page you haven't converted looks exactly as it did.** Pages
migrate one at a time, whenever you want.

### Your brand drives the theme
The palette is mapped into the shadcn token system, so components come out
Green Emblem–coloured rather than default shadcn grey:

- `primary` → gold `#d4af6e` · `background` → forest `#0f1f0f` · `accent` → `#2e6b2e`
- Fonts available as `font-cinzel`, `font-cormorant`, `font-sans`, `font-uthmani`
- Brand colours direct: `text-gold`, `bg-forest-dark`, `border-gold/15`, `text-cream`

### Components now available (`components/ui/`)
`Button` (with a `brand` variant matching your gold CTA), `Card`, `Badge`,
`Input`, `Select`, `Dialog`, `Tabs`, `Separator`, `Skeleton`.

```tsx
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'

<Button asChild variant="brand" size="lg">
  <Link href="/sadaqah">Start Baab As-Sadaqah</Link>
</Button>
```

### Converted so far
- **Nav** — active-link underline, proper mobile sheet with scroll lock, real icons
- **Footer** — responsive grid (was fixed 3-column and cramped on mobile)
- **BottomNav** — lucide icons, cleaner active state
- **Homepage** — hero, step cards, highlight and shop sections
- **Explore** — card grid with badges

Everything else still uses inline styles and is untouched. Migrate the
dashboard, shop, and sadaqah flows next when you're ready.

> ⚠️ One Tailwind gotcha worth knowing: opacity modifiers only accept
> multiples of 5. `bg-black/97` silently produces **no background at all**.
> Use `/95`. This bit the bottom nav during the build and is fixed.

---

## 3. Apply

From your project root:

```bash
bash apply-ui-refresh.sh
```

It writes every file, installs the new dependencies, and verifies nothing is
missing. Safe to run more than once.

Then:

```bash
npm run build
git add -A
git commit -m "feat: remove rewards system; add Tailwind + shadcn UI foundation"
git push
```

---

## 4. Verify

The build was checked here against a real headless browser — 24 automated
checks passed, covering: all 11 public routes returning 200, no rewards
wording anywhere, `/rewards` 404ing, no stray borders, nav backgrounds
rendering, responsive grids collapsing correctly, and zero console errors.

After deploying, spot-check:
- **Homepage** — hero and the three step cards
- **Explore** — three columns on desktop, one on mobile, no Rewards card
- **Mobile** — bottom bar is solid (not see-through), hamburger menu opens
- **A page not yet converted** (`/dashboard`, `/shop`) — should look unchanged
__GE_EOF_4b8e1f__
echo "  wrote APPLY-UI-REFRESH.md"
cat > 'rewards-teardown.sql' <<'__GE_EOF_4b8e1f__'
-- ═══════════════════════════════════════════════════════════════════
--  REMOVE THE REWARDS SYSTEM
--  Run in the Supabase SQL Editor AFTER deploying the code that no
--  longer references these objects.
--
--  ⚠  This permanently deletes every point balance, streak, and
--     redemption record. If you might reinstate rewards later, take a
--     backup first (Supabase → Database → Backups), or simply skip
--     this file — the tables are harmless if left in place and the app
--     no longer touches them.
-- ═══════════════════════════════════════════════════════════════════

drop function if exists award_points(uuid, text);
drop function if exists redeem_reward(uuid, uuid, jsonb);
drop function if exists today_actions(uuid);

drop table if exists redemptions;
drop table if exists rewards_catalog;
drop table if exists point_events;
drop table if exists user_points;
__GE_EOF_4b8e1f__
echo "  wrote rewards-teardown.sql"
cat > 'tailwind.config.ts' <<'__GE_EOF_4b8e1f__'
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
          DEFAULT: '#1a3d1a',
          dark:    '#0f1f0f',
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
__GE_EOF_4b8e1f__
echo "  wrote tailwind.config.ts"
cat > 'postcss.config.js' <<'__GE_EOF_4b8e1f__'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
__GE_EOF_4b8e1f__
echo "  wrote postcss.config.js"
mkdir -p "lib"
cat > 'lib/utils.ts' <<'__GE_EOF_4b8e1f__'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Merge Tailwind classes so later ones win over earlier conflicting ones.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
__GE_EOF_4b8e1f__
echo "  wrote lib/utils.ts"
mkdir -p "app"
cat > 'app/globals.css' <<'__GE_EOF_4b8e1f__'
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ── shadcn/ui semantic tokens, mapped to the Green Emblem palette ──────
   Values are HSL triplets (no hsl() wrapper) so Tailwind can compose them
   with opacity modifiers, e.g. bg-primary/10. */
@layer base {
  :root {
    --background:            120 35% 9%;    /* #0f1f0f deep forest   */
    --foreground:            40 43% 93%;    /* #f5f0e6 cream         */
    --card:                  120 40% 12%;
    --card-foreground:       40 43% 93%;
    --popover:               120 38% 7%;
    --popover-foreground:    40 43% 93%;
    --primary:               38 54% 63%;    /* #d4af6e gold          */
    --primary-foreground:    120 35% 9%;
    --secondary:             120 40% 17%;   /* #1a3d1a               */
    --secondary-foreground:  40 43% 93%;
    --muted:                 120 20% 16%;
    --muted-foreground:      120 8% 65%;
    --accent:                120 40% 30%;   /* #2e6b2e forest green  */
    --accent-foreground:     40 43% 93%;
    --destructive:           1 65% 55%;
    --destructive-foreground:40 43% 93%;
    --border:                38 30% 26%;
    --input:                 120 25% 20%;
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
  --forest:       #2e6b2e;
  --forest-deep:  #1a3d1a;
  --forest-dark:  #0f1f0f;
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
  background: rgba(15,31,15,0.7);
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
__GE_EOF_4b8e1f__
echo "  wrote app/globals.css"
mkdir -p "app"
cat > 'app/layout.tsx' <<'__GE_EOF_4b8e1f__'
import type { Metadata } from 'next'
import { Cinzel, Cormorant_Garamond, Noto_Naskh_Arabic, Inter, Amiri_Quran } from 'next/font/google'
import BottomNav from '@/components/BottomNav'
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
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${cormorant.variable} ${arabic.variable} ${inter.variable} ${amiriQuran.variable}`}>
      <body>
        {children}
        <BottomNav/>
      </body>
    </html>
  )
}
__GE_EOF_4b8e1f__
echo "  wrote app/layout.tsx"
mkdir -p "app"
cat > 'app/page.tsx' <<'__GE_EOF_4b8e1f__'
'use client'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import LogoIntro from '@/components/LogoIntro'
import ScrollReveal from '@/components/ScrollReveal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const GoldDivider = () => (
  <div className="mx-auto flex max-w-[120px] items-center gap-3">
    <div className="h-px flex-1 bg-gold/30" />
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
      <polygon points="4,0 5,3 8,3 5.5,5 6.5,8 4,6 1.5,8 2.5,5 0,3 3,3" fill="#d4af6e" opacity="0.6" />
    </svg>
    <div className="h-px flex-1 bg-gold/30" />
  </div>
)

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-3.5 font-cinzel text-[9px] tracking-[0.28em] text-gold">{children}</div>
)

const STEPS = [
  {
    num: '01',
    title: 'Tell us the occasion',
    desc: 'Share the honourees’ names, the event type, and the date. Takes under a minute.',
    cta: 'Request a campaign',
    href: '/sadaqah/request',
  },
  {
    num: '02',
    title: 'Design it yourself',
    desc: 'Pick a colorway, font, and pattern in the design studio. See it rendered live as you go. Goes live the moment you publish — no approval wait.',
    cta: 'See the design studio',
    href: '/sadaqah',
  },
  {
    num: '03',
    title: 'Print and share the code',
    desc: 'Download a QR card styled to match your event. Place it on tables. Guests scan, choose a charity, and give — directly, with nothing held by Green Emblem.',
    cta: 'How giving works',
    href: '/sadaqah',
  },
]

export default function HomePage() {
  return (
    <>
      <LogoIntro />
      <ScrollReveal />
      <div className="bg-tile" aria-hidden="true" />
      <Nav />

      <main className="relative z-[2]">

        {/* ── HERO ── */}
        <section className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 pb-16 pt-28 text-center">
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.03]">
            <svg width="600" height="600" viewBox="0 0 220 220" aria-hidden="true">
              <rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke="#d4af6e" strokeWidth="2" />
              <rect x="42" y="42" width="136" height="136" rx="6" fill="none" stroke="#d4af6e" strokeWidth="2" transform="rotate(45 110 110)" />
              <polygon points="110,42 158,42 190,74 190,146 158,178 62,178 30,146 30,74 62,42" fill="#d4af6e" />
            </svg>
          </div>

          <div className="fade-up" style={{ animationDelay: '0.1s' }}>
            <div className="mb-5 font-arabic text-[22px] text-gold/60" lang="ar">
              بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
            </div>
          </div>

          <div className="fade-up" style={{ animationDelay: '0.2s' }}>
            <Image
              src="/logo-full.png"
              alt="Green Emblem — Faith. Strength. Purpose."
              width={190}
              height={190}
              priority
              className="mx-auto mb-6 h-auto w-[190px]"
            />
          </div>

          <div className="fade-up" style={{ animationDelay: '0.3s' }}>
            <div className="mb-3.5 font-arabic text-[26px] text-gold/75" lang="ar">
              بَابُ الصَّدَقَة
            </div>
            <h1 className="mb-5 font-cinzel text-[clamp(36px,7vw,72px)] font-medium leading-[1.08] tracking-[-0.01em] text-white">
              Every celebration<br />
              <span className="text-gold">honoured with</span><br />
              sadaqah
            </h1>
          </div>

          <div className="fade-up max-w-[520px]" style={{ animationDelay: '0.5s' }}>
            <p className="mb-10 font-cormorant text-[clamp(16px,2.5vw,20px)] italic leading-[1.75] text-white/55">
              Scan a QR code at any Nikkah, Walima, or Aqiqah, and turn the celebration into charity
              given in someone&apos;s honour. Free to start. No fees. No middleman.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild variant="brand" size="lg">
                <Link href="/sadaqah">Start Baab As-Sadaqah</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/shop">Visit the shop</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="reveal mx-auto max-w-[1100px] px-6 py-20">
          <div className="mb-14 text-center">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="font-cinzel text-[clamp(24px,4vw,38px)] font-medium leading-tight text-white">
              From request to QR code<br />in minutes
            </h2>
          </div>

          <div className="reveal reveal-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map(({ num, title, desc, cta, href }) => (
              <Link key={num} href={href} className="group no-underline">
                <Card className="h-full p-7 transition-all duration-200 hover:-translate-y-1 hover:border-gold/35">
                  <div className="mb-3.5 font-cinzel text-[26px] text-gold/50 transition-colors group-hover:text-gold/80">
                    {num}
                  </div>
                  <div className="mb-3 font-cinzel text-[15px] font-medium text-white">{title}</div>
                  <p className="mb-5 font-cormorant text-[15px] leading-[1.7] text-white/60">{desc}</p>
                  <div className="flex items-center gap-1.5 font-cinzel text-[9px] tracking-[0.18em] text-gold">
                    {cta}
                    <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* ── SADAQAH HIGHLIGHT ── */}
        <section className="reveal border-y border-gold/10 bg-forest/20 px-6 py-[70px]">
          <div className="mx-auto max-w-[800px] text-center">
            <GoldDivider />
            <div className="my-8">
              <div className="mb-4 font-arabic text-[28px] text-gold/70" lang="ar">
                بَابُ الصَّدَقَة
              </div>
              <h2 className="mb-3.5 font-cinzel text-[clamp(22px,4vw,36px)] font-medium text-white">
                Free, because it should be
              </h2>
              <p className="mx-auto mb-8 max-w-[560px] font-cormorant text-lg italic leading-[1.8] text-white/55">
                Baab As-Sadaqah will always be free to use. Guests give directly to verified charities
                like Share The Meal, Islamic Relief USA, and UNICEF USA — Green Emblem never touches
                the money.
              </p>
              <Button asChild variant="brand" size="lg">
                <Link href="/sadaqah">Request a campaign</Link>
              </Button>
            </div>
            <GoldDivider />
          </div>
        </section>

        {/* ── SHOP TEASER ── */}
        <section className="reveal mx-auto max-w-[700px] px-6 py-20 text-center">
          <SectionLabel>The shop</SectionLabel>
          <h2 className="mb-3.5 font-cinzel text-[clamp(22px,4vw,36px)] font-medium text-white">
            Stand in the Middle
          </h2>
          <p className="mb-8 font-cormorant text-lg italic leading-[1.75] text-white/50">
            Clothing and accessories for the Muslim home — a reminder to take the balanced path,
            and refrain from division.
          </p>
          <Button asChild variant="brand" size="lg">
            <Link href="/shop">Visit the shop</Link>
          </Button>
        </section>

      </main>
      <Footer />
    </>
  )
}
__GE_EOF_4b8e1f__
echo "  wrote app/page.tsx"
mkdir -p "app/explore"
cat > 'app/explore/page.tsx' <<'__GE_EOF_4b8e1f__'
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

      <main className="relative z-[2] mx-auto min-h-[100dvh] max-w-[900px] px-6 pb-20 pt-32">

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
                  <div className="mt-4 flex items-center gap-1.5 font-cinzel text-[9px] tracking-[0.18em] text-gold">
                    OPEN
                    <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
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
__GE_EOF_4b8e1f__
echo "  wrote app/explore/page.tsx"
mkdir -p "app/prayer"
cat > 'app/prayer/page.tsx' <<'__GE_EOF_4b8e1f__'
'use client'
import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createClient } from '@/lib/supabase/client'
import { CALC_METHODS, computeDayTimes, qiblaBearing, fmtTime, orderedPrayers, type CalcMethodId, type DayPrayerTimes } from '@/lib/prayer'
import QuranReader from '@/components/QuranReader'
import QiblaCompass from '@/components/QiblaCompass'

const LOCATION_CACHE_KEY = 'ge_prayer_location'

type Coords = { lat: number; lng: number; label?: string }

// Suspense wrapper — useSearchParams requires one for static prerendering
export default function PrayerPage() {
  return (
    <Suspense fallback={null}>
      <PrayerPageInner/>
    </Suspense>
  )
}

function PrayerPageInner() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)

  const [coords, setCoords] = useState<Coords | null>(null)
  const [locStatus, setLocStatus] = useState<'idle' | 'locating' | 'granted' | 'denied' | 'error'>('idle')

  const [method, setMethod] = useState<CalcMethodId>('MuslimWorldLeague')
  const [primaryAsr, setPrimaryAsr] = useState<'shafi' | 'hanafi'>('shafi')
  const [times, setTimes] = useState<DayPrayerTimes | null>(null)
  const [bearing, setBearing] = useState<number | null>(null)
  const [now, setNow] = useState(new Date())
  const [subTab, setSubTab] = useState<'prayer' | 'quran'>('prayer')

  // Deep link: /prayer?tab=quran opens the Quran reader directly, and the
  // nav's Prayer/Quran links keep working even when already on this page.
  const searchParams = useSearchParams()
  useEffect(() => {
    setSubTab(searchParams.get('tab') === 'quran' ? 'quran' : 'prayer')
  }, [searchParams])

  // ── Load saved preference (signed-in users) + cached location ──────────
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user)
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('prayer_calc_method, prayer_madhab').eq('id', user.id).maybeSingle()
        if (profile?.prayer_calc_method) setMethod(profile.prayer_calc_method as CalcMethodId)
        if (profile?.prayer_madhab) setPrimaryAsr(profile.prayer_madhab as 'shafi' | 'hanafi')
      }
    })

    try {
      const cached = localStorage.getItem(LOCATION_CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Date.now() - parsed.savedAt < 24 * 60 * 60 * 1000) {
          setCoords(parsed.coords)
          setLocStatus('granted')
        }
      }
    } catch {}

    requestLocation()

    const tick = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(tick)
  }, [])

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocStatus('error'); return }
    setLocStatus('locating')
    navigator.geolocation.getCurrentPosition(
      pos => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setCoords(c)
        setLocStatus('granted')
        try { localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ coords: c, savedAt: Date.now() })) } catch {}
      },
      err => setLocStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error'),
      { timeout: 10000 }
    )
  }, [])

  // ── Recompute whenever location/method/madhab changes ──────────────────
  useEffect(() => {
    if (!coords) return
    setTimes(computeDayTimes(coords.lat, coords.lng, new Date(), method))
    setBearing(qiblaBearing(coords.lat, coords.lng))
  }, [coords, method])

  const savePreference = async (patch: { prayer_calc_method?: string; prayer_madhab?: string }) => {
    if (!user) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify(patch),
    }).catch(() => {})
  }

  const prayers = times ? orderedPrayers(times, primaryAsr) : []
  const nextIdx = (() => {
    if (!prayers.length) return -1
    const idx = prayers.findIndex(p => p.time > now)
    return idx === -1 ? 0 : idx // if past Isha, next is tomorrow's Fajr — highlight Fajr
  })()

  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ position: 'relative', zIndex: 2, minHeight: '100dvh', padding: '120px 24px 80px', maxWidth: subTab === 'quran' ? '920px' : '640px', margin: '0 auto', transition: 'max-width 0.2s' }}>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontFamily: 'var(--font-arabic)', fontSize: '26px', color: 'var(--gold)', opacity: 0.75, marginBottom: '14px' }} lang="ar">الصَّلَاة</div>
          <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '0.3em', color: 'var(--gold)', marginBottom: '16px' }}>PRAYER</div>
          <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: 'clamp(28px,5vw,44px)', fontWeight: 500, color: '#fff', marginBottom: '10px' }}>Prayer, Qibla &amp; Quran</h1>
          {subTab === 'prayer' && coords && (
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '14px', fontStyle: 'italic', color: 'rgba(255,255,255,0.4)' }}>
              Based on your current location · {coords.lat.toFixed(3)}, {coords.lng.toFixed(3)}
            </p>
          )}
        </div>

        {/* ── Sub-tab selector ── */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(212,175,110,0.15)', borderRadius: '100px', padding: '4px' }}>
            {(['prayer', 'quran'] as const).map(t => (
              <button key={t} onClick={() => setSubTab(t)} style={{
                fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em',
                padding: '9px 22px', borderRadius: '100px', border: 'none', cursor: 'pointer',
                background: subTab === t ? 'var(--gold)' : 'transparent',
                color: subTab === t ? '#0f1f0f' : 'rgba(255,255,255,0.5)', transition: 'all 0.2s',
              }}>
                {t === 'prayer' ? 'Prayer & Qibla' : 'Quran'}
              </button>
            ))}
          </div>
        </div>

        {subTab === 'quran' ? (
          <QuranReader/>
        ) : (
        <>
        {/* ── Location gate ── */}
        {locStatus !== 'granted' && (
          <div style={{ textAlign: 'center', padding: '32px 24px', background: 'rgba(15,31,15,0.5)', borderRadius: '14px', marginBottom: '28px' }}>
            {locStatus === 'locating' && <p style={{ fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>Finding your location…</p>}
            {locStatus === 'denied' && (
              <>
                <p style={{ fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', marginBottom: '14px' }}>
                  Location access was denied. Prayer times and Qibla direction need your location to be accurate — please enable location access for this site in your browser settings, then try again.
                </p>
                <button onClick={requestLocation} style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', fontWeight: 600, color: '#0f1f0f', background: 'var(--gold)', border: 'none', borderRadius: '9px', padding: '10px 22px', cursor: 'pointer' }}>Try again</button>
              </>
            )}
            {(locStatus === 'idle' || locStatus === 'error') && (
              <>
                <p style={{ fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', marginBottom: '14px' }}>
                  {locStatus === 'error' ? "Couldn't get your location." : 'Share your location to see accurate prayer times.'}
                </p>
                <button onClick={requestLocation} style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', fontWeight: 600, color: '#0f1f0f', background: 'var(--gold)', border: 'none', borderRadius: '9px', padding: '10px 22px', cursor: 'pointer' }}>Share location</button>
              </>
            )}
          </div>
        )}

        {times && (
          <>
            {/* ── Settings ── */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <select
                value={method}
                onChange={e => { const v = e.target.value as CalcMethodId; setMethod(v); savePreference({ prayer_calc_method: v }) }}
                style={{ flex: 1, minWidth: '180px', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(212,175,110,0.25)', borderRadius: '9px', padding: '10px 12px', fontFamily: 'Georgia, serif', fontSize: '13px', color: '#fff', outline: 'none' }}
              >
                {CALC_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <div style={{ display: 'flex', border: '0.5px solid rgba(212,175,110,0.25)', borderRadius: '9px', overflow: 'hidden' }}>
                {(['shafi', 'hanafi'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => { setPrimaryAsr(m); savePreference({ prayer_madhab: m }) }}
                    style={{
                      fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 600, padding: '10px 16px', border: 'none', cursor: 'pointer',
                      background: primaryAsr === m ? 'var(--gold)' : 'transparent', color: primaryAsr === m ? '#0f1f0f' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {m === 'shafi' ? 'Standard Asr' : 'Hanafi Asr'}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Times table ── */}
            <div style={{ background: 'rgba(15,31,15,0.55)', border: '0.5px solid rgba(212,175,110,0.12)', borderRadius: '14px', overflow: 'hidden', marginBottom: '24px' }}>
              {prayers.map((p, i) => (
                <div key={p.key} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px',
                  background: i === nextIdx ? 'rgba(212,175,110,0.1)' : 'transparent',
                  borderBottom: i < prayers.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: '14px', color: i === nextIdx ? 'var(--gold)' : '#fff' }}>{p.label}</span>
                    {i === nextIdx && <span style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.08em', color: 'var(--gold)', border: '0.5px solid rgba(212,175,110,0.4)', borderRadius: '20px', padding: '2px 8px' }}>NEXT</span>}
                  </div>
                  <span style={{ fontFamily: 'Georgia, serif', fontSize: '15px', color: i === nextIdx ? 'var(--gold)' : 'rgba(255,255,255,0.75)' }}>{fmtTime(p.time)}</span>
                </div>
              ))}
              {/* Both Asr times, always visible for reference regardless of the toggle above */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', background: 'rgba(255,255,255,0.02)', fontSize: '11px' }}>
                <span style={{ fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>Standard Asr: {fmtTime(times.asrShafi)}</span>
                <span style={{ fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>Hanafi Asr: {fmtTime(times.asrHanafi)}</span>
              </div>
            </div>

            {/* ── Qibla ── */}
            {bearing !== null && <QiblaCompass bearing={bearing} />}
          </>
        )}
        </>
        )}
      </main>
      <Footer />
    </>
  )
}
__GE_EOF_4b8e1f__
echo "  wrote app/prayer/page.tsx"
mkdir -p "app/greenworld-plus"
cat > 'app/greenworld-plus/page.tsx' <<'__GE_EOF_4b8e1f__'
'use client'
import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createClient } from '@/lib/supabase/client'
import { ExploreNearbyMap } from '@/components/MosqueMap'

type Masjid = { id: string; name: string; city: string; state: string; verified: boolean }
type EventRow = {
  id: string; title: string; description: string | null; event_start: string; event_end: string
  masjid_id?: string
  masjids: { name: string; city: string; state: string; lat: number | null; lng: number | null } | null
}

export default function GreenWorldPlusPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [checked, setChecked] = useState(false)

  const [masjids, setMasjids] = useState<Masjid[]>([])
  const [search, setSearch] = useState('')
  const [events, setEvents] = useState<EventRow[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user)
      if (user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        setProfile(p)
      }
      setChecked(true)
    })
    fetch('/api/masjid-events').then(r => r.json()).then(d => { setEvents(d.events || []); setLoadingEvents(false) }).catch(() => setLoadingEvents(false))

  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/masjids${search ? `?q=${encodeURIComponent(search)}` : ''}`)
        .then(r => r.json()).then(d => setMasjids(d.masjids || []))
    }, 250)
    return () => clearTimeout(t)
  }, [search])

  const followMasjid = async (masjidId: string | null) => {
    if (!user) { window.location.href = '/auth/sign-in'; return }
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ followed_masjid_id: masjidId, sub_greenworld_plus: true }),
      })
      const data = await res.json()
      if (data.profile) setProfile(data.profile)
    }
    setSaving(false)
  }

  const saveTravelRadius = async (mi: number) => {
    if (!user) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ travel_radius_miles: mi }),
    }).catch(() => {})
  }

  const followedMasjid = masjids.find(m => m.id === profile?.followed_masjid_id)
  const displayedEvents = events

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <>
      <div className="bg-tile" aria-hidden="true"/>
      <Nav />
      <main style={{ position: 'relative', zIndex: 2, minHeight: '100dvh', padding: '120px 24px 80px', maxWidth: '760px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '0.3em', color: '#9b8ec4', marginBottom: '16px' }}>GREENWORLD+</div>
          <h1 style={{ fontFamily: 'var(--font-cinzel)', fontSize: 'clamp(28px,5vw,44px)', fontWeight: 500, color: '#fff', marginBottom: '12px' }}>Local events, all in one place</h1>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '17px', fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
            Follow your masjid to get notified the moment they post something new.
          </p>
        </div>

        {/* Follow a masjid */}
        <div style={{ background: 'rgba(15,31,15,0.55)', border: '0.5px solid rgba(155,142,196,0.2)', borderRadius: '16px', padding: '22px', marginBottom: '28px' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.2em', color: '#9b8ec4', marginBottom: '14px' }}>YOUR MASJID</div>

          {followedMasjid ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '15px', color: '#fff' }}>{followedMasjid.name}</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{followedMasjid.city}, {followedMasjid.state}</div>
              </div>
              <button onClick={() => followMasjid(null)} disabled={saving} style={{ fontFamily: 'Georgia, serif', fontSize: '10px', color: 'rgba(255,255,255,0.4)', background: 'none', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: '7px', padding: '7px 12px', cursor: 'pointer' }}>Unfollow</button>
            </div>
          ) : (
            <>
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search verified Sunni masjids and Islamic institutes…"
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(155,142,196,0.3)', borderRadius: '9px', padding: '11px 13px', fontFamily: 'Georgia, serif', fontSize: '14px', color: '#fff', outline: 'none', marginBottom: masjids.length ? '10px' : 0 }}
              />
              {masjids.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                  {masjids.map(m => (
                    <button key={m.id} onClick={() => followMasjid(m.id)} disabled={saving} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: 'none', borderRadius: '8px', padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}>
                      <span>
                        <span style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: '#fff' }}>{m.name}</span>
                        <span style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginLeft: '8px' }}>{m.city}, {m.state}</span>
                      </span>
                      <span style={{ fontFamily: 'Georgia, serif', fontSize: '10px', color: '#9b8ec4' }}>Follow +</span>
                    </button>
                  ))}
                </div>
              )}
              {search && masjids.length === 0 && (
                <p style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', marginTop: '8px' }}>No masjids found yet — our directory is growing. Check back soon.</p>
              )}
            </>
          )}
        </div>

        {/* Explore nearby — radius-bounded community map */}
        <div style={{ background: 'rgba(15,31,15,0.55)', border: '0.5px solid rgba(212,175,110,0.14)', borderRadius: '16px', padding: '22px', marginBottom: '28px' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.2em', color: '#d4af6e', marginBottom: '6px' }}>EXPLORE NEARBY</div>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '14px', fontStyle: 'italic', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: '16px' }}>
            Set how far you&apos;re willing to travel — masjids, halal food, and community events within your boundary.
          </p>
          <ExploreNearbyMap
            initialRadiusMi={profile?.travel_radius_miles}
            events={events}
            onRadiusSave={saveTravelRadius}
          />
        </div>

        {/* Events feed */}
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)', marginBottom: '14px' }}>
          UPCOMING EVENTS
        </div>

        {loadingEvents ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Loading events…</div>
        ) : displayedEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 24px', background: 'rgba(15,31,15,0.4)', borderRadius: '14px' }}>
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '16px', fontStyle: 'italic', color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>
              No events posted yet. As masjids join our directory, their events will show up here — and you'll be notified if you follow them.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {displayedEvents.map(e => (
              <div key={e.id} style={{ background: 'rgba(15,31,15,0.5)', border: '0.5px solid rgba(212,175,110,0.12)', borderRadius: '12px', padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '6px' }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', color: '#fff' }}>{e.title}</div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: '#9b8ec4', whiteSpace: 'nowrap' }}>{fmtDate(e.event_start)} · {fmtTime(e.event_start)}</div>
                </div>
                {e.masjids?.name && <div style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>{e.masjids.name} · {e.masjids.city}, {e.masjids.state}</div>}
                {e.description && <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, fontStyle: 'italic' }}>{e.description}</p>}
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
__GE_EOF_4b8e1f__
echo "  wrote app/greenworld-plus/page.tsx"
mkdir -p "app/admin"
cat > 'app/admin/page.tsx' <<'__GE_EOF_4b8e1f__'
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { FONT_PAIRS, PATTERNS, OVERLAYS } from '@/lib/campaign-design'
import { MosqueAutocomplete, type MosquePlace } from '@/components/MosqueMap'

const PANELS = ['overview','campaigns','requests','templates','masjids','orders','users','newsletter'] as const
type Panel = typeof PANELS[number]

export default function AdminPage() {
  const supabase = createClient()
  const router = useRouter()
  const [panel, setPanel] = useState<Panel>('overview')
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  // Data
  const [stats, setStats] = useState({ campaigns:0, activeCampaigns:0, donations:0, totalRaised:0, mealsFunded:0, orders:0, orderRevenue:0, subscribers:0, users:0 })
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [subscribers, setSubscribers] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [masjids, setMasjids] = useState<any[]>([])
  const [masjidEvents, setMasjidEvents] = useState<any[]>([])
  const [masjidModal, setMasjidModal] = useState(false)
  const [masjidPlace, setMasjidPlace] = useState<MosquePlace | null>(null)
  const [masjidForm, setMasjidForm] = useState({ name:'', instagram_handle:'', facebook_page:'', phone:'', website:'', verified:true, auto_sync_enabled:false })
  const [masjidSaving, setMasjidSaving] = useState(false)
  const [eventModal, setEventModal] = useState<string | null>(null) // masjid_id
  const [eventForm, setEventForm] = useState({ title:'', description:'', event_start:'', event_end:'' })
  const [eventSaving, setEventSaving] = useState(false)

  // Template editor
  const [tplModal, setTplModal] = useState(false)
  const [tplEdit, setTplEdit] = useState<any>(null)
  const emptyTpl = { name:'', bg:'#0f1f0f', accent:'#d4af6e', text:'#f5f0e6', font_pair:'cinzel', pattern:'star8', overlay:'frame', pattern_opacity:0.07, published:true, sort_order:0 }
  const [tplForm, setTplForm] = useState<any>(emptyTpl)
  const [tplSaving, setTplSaving] = useState(false)

  // Newsletter composer
  const [newsletterSubject, setNewsletterSubject] = useState('')
  const [newsletterBody, setNewsletterBody] = useState('')
  const [sendingNewsletter, setSendingNewsletter] = useState(false)
  const [newsletterSent, setNewsletterSent] = useState(false)

  // Product modal
  const [productModal, setProductModal] = useState(false)
  const [editProduct, setEditProduct] = useState<any>(null)
  const [pForm, setPForm] = useState({ name:'', category:'shop', price:'', description:'', visibility:'draft' })

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/sign-in'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin') { router.push('/dashboard'); return }
      setAuthorized(true)
      await loadAll()
      setLoading(false)
    })
  }, [])

  const loadAll = async () => {
    const [campaignsRes, requestsRes, ordersRes, usersRes, subscribersRes, donationsRes, templatesRes, masjidsRes, masjidEventsRes] = await Promise.all([
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('campaign_requests').select('*').order('submitted_at', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('newsletter_subscribers').select('*').eq('is_active', true).order('subscribed_at', { ascending: false }),
      supabase.from('donations').select('amount,meals_funded,confirmed').eq('confirmed', true),
      supabase.from('campaign_templates').select('*').order('sort_order', { ascending: true }),
      supabase.from('masjids').select('*').eq('active', true).order('name', { ascending: true }),
      supabase.from('masjid_events').select('*').order('event_start', { ascending: false }),
    ])

    const camps = campaignsRes.data || []
    const ords = ordersRes.data || []
    const donations = donationsRes.data || []
    const subs = subscribersRes.data || []

    setCampaigns(camps)
    setRequests(requestsRes.data || [])
    setOrders(ords)
    setUsers(usersRes.data || [])
    setSubscribers(subs)
    setTemplates(templatesRes.data || [])
    setMasjids(masjidsRes.data || [])
    setMasjidEvents(masjidEventsRes.data || [])

    setStats({
      campaigns: camps.length,
      activeCampaigns: camps.filter(c => c.status === 'active').length,
      donations: donations.length,
      totalRaised: donations.reduce((s,d) => s + (d.amount||0), 0),
      mealsFunded: donations.reduce((s,d) => s + (d.meals_funded||0), 0),
      orders: ords.length,
      orderRevenue: ords.reduce((s,o) => s + (o.total||0), 0),
      subscribers: subs.length,
      users: (usersRes.data||[]).length,
    })
  }

  const updateCampaignStatus = async (id: string, status: string) => {
    await supabase.from('campaigns').update({ status }).eq('id', id)
    setCampaigns(cs => cs.map(c => c.id === id ? { ...c, status } : c))
    setStats(s => ({ ...s, activeCampaigns: status === 'active' ? s.activeCampaigns + 1 : s.activeCampaigns - 1 }))
  }

  const sendMagicLink = async (requestId: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/admin/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ request_id: requestId }),
    })
    await supabase.from('campaign_requests').update({ status: 'approved' }).eq('id', requestId)
    setRequests(rs => rs.map(r => r.id === requestId ? { ...r, status: 'approved' } : r))
  }

  const saveMasjid = async () => {
    if (!masjidForm.name) return
    setMasjidSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/masjids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        ...masjidForm,
        address: masjidPlace?.formattedAddress,
        lat: masjidPlace?.lat, lng: masjidPlace?.lng, place_id: masjidPlace?.placeId,
        city: masjidPlace?.formattedAddress?.split(',')[1]?.trim(),
        state: masjidPlace?.formattedAddress?.split(',')[2]?.trim()?.split(' ')[0],
      }),
    })
    const data = await res.json()
    if (data.masjid) setMasjids(ms => [...ms, data.masjid].sort((a,b) => a.name.localeCompare(b.name)))
    setMasjidSaving(false)
    setMasjidModal(false)
    setMasjidForm({ name:'', instagram_handle:'', facebook_page:'', phone:'', website:'', verified:true, auto_sync_enabled:false })
    setMasjidPlace(null)
  }

  const deleteMasjid = async (id: string) => {
    if (!confirm('Remove this masjid from the directory?')) return
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`/api/masjids/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${session?.access_token}` } })
    setMasjids(ms => ms.filter(m => m.id !== id))
  }

  const saveEvent = async (masjidId: string) => {
    if (!eventForm.title || !eventForm.event_start || !eventForm.event_end) return
    setEventSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/masjid-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ masjid_id: masjidId, ...eventForm }),
    })
    const data = await res.json()
    if (data.event) setMasjidEvents(es => [data.event, ...es])
    setEventSaving(false)
    setEventModal(null)
    setEventForm({ title:'', description:'', event_start:'', event_end:'' })
  }

  const cancelEvent = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`/api/masjid-events/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${session?.access_token}` } })
    setMasjidEvents(es => es.map(e => e.id === id ? { ...e, status: 'cancelled' } : e))
  }

  const approveEvent = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/masjid-events/${id}/approve`, { method: 'POST', headers: { 'Authorization': `Bearer ${session?.access_token}` } })
    if (res.ok) setMasjidEvents(es => es.map(e => e.id === id ? { ...e, status: 'active' } : e))
  }

  const [syncingMasjid, setSyncingMasjid] = useState<string | null>(null)
  const syncMasjidNow = async (id: string) => {
    setSyncingMasjid(id)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/admin/sync-masjid/${id}`, { method: 'POST', headers: { 'Authorization': `Bearer ${session?.access_token}` } })
    const data = await res.json()
    await loadAll() // refresh masjid sync status + any new pending events
    setSyncingMasjid(null)
    if (data.error) alert(`Sync issue: ${data.error}`)
    else alert(`Sync complete — found ${data.totalExtracted} event(s), ${data.newEvents} new.`)
  }

  const sendNewsletter = async () => {
    if (!newsletterSubject || !newsletterBody) return
    setSendingNewsletter(true)
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/admin/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ subject: newsletterSubject, body: newsletterBody }),
    })
    setNewsletterSent(true)
    setSendingNewsletter(false)
    setTimeout(() => { setNewsletterSent(false); setNewsletterSubject(''); setNewsletterBody('') }, 3000)
  }


  const openTplModal = (t?: any) => {
    setTplEdit(t || null)
    setTplForm(t ? { name:t.name, bg:t.bg, accent:t.accent, text:t.text, font_pair:t.font_pair, pattern:t.pattern, overlay:t.overlay, pattern_opacity:t.pattern_opacity, published:t.published, sort_order:t.sort_order||0 } : emptyTpl)
    setTplModal(true)
  }

  const saveTemplate = async () => {
    if (!tplForm.name) return
    setTplSaving(true)
    if (tplEdit) {
      const { data } = await supabase.from('campaign_templates').update(tplForm).eq('id', tplEdit.id).select().single()
      if (data) setTemplates(ts => ts.map(t => t.id === tplEdit.id ? data : t))
    } else {
      const { data } = await supabase.from('campaign_templates').insert(tplForm).select().single()
      if (data) setTemplates(ts => [...ts, data])
    }
    setTplSaving(false)
    setTplModal(false)
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template? Campaigns already using it are unaffected.')) return
    await supabase.from('campaign_templates').delete().eq('id', id)
    setTemplates(ts => ts.filter(t => t.id !== id))
  }

  const toggleTemplatePublished = async (t: any) => {
    const { data } = await supabase.from('campaign_templates').update({ published: !t.published }).eq('id', t.id).select().single()
    if (data) setTemplates(ts => ts.map(x => x.id === t.id ? data : x))
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const c = {
    page: { minHeight:'100dvh', background:'#080f08', display:'grid', gridTemplateColumns:'220px 1fr' } as React.CSSProperties,
    sidebar: { background:'rgba(15,31,15,0.95)', borderRight:'0.5px solid rgba(212,175,110,0.12)', padding:'0', display:'flex', flexDirection:'column' as const, position:'sticky' as const, top:0, height:'100dvh', overflowY:'auto' as const },
    main: { padding:'32px', overflowY:'auto' as const },
    navItem: (active:boolean) => ({ display:'flex', alignItems:'center', gap:'10px', padding:'10px 18px', cursor:'pointer', background:active?'rgba(212,175,110,0.08)':'transparent', borderLeft:`2px solid ${active?'#d4af6e':'transparent'}`, transition:'all 0.15s', border:'none', width:'100%', textAlign:'left' as const } as React.CSSProperties),
    navLabel: (active:boolean) => ({ fontFamily:'Georgia,serif', fontSize:'11px', letterSpacing:'0.12em', color:active?'#d4af6e':'rgba(255,255,255,0.45)' }),
    card: { background:'rgba(15,31,15,0.6)', border:'0.5px solid rgba(212,175,110,0.12)', borderRadius:'12px', padding:'18px' } as React.CSSProperties,
    statCard: { background:'rgba(15,31,15,0.6)', border:'0.5px solid rgba(212,175,110,0.12)', borderRadius:'12px', padding:'16px' } as React.CSSProperties,
    th: { fontFamily:'Georgia,serif', fontSize:'9px', letterSpacing:'0.14em', color:'rgba(255,255,255,0.35)', padding:'10px 14px', textAlign:'left' as const, borderBottom:'0.5px solid rgba(212,175,110,0.08)', fontWeight:400 },
    td: { padding:'11px 14px', borderBottom:'0.5px solid rgba(212,175,110,0.05)', fontFamily:'Georgia,serif', fontSize:'13px', color:'rgba(255,255,255,0.75)', verticalAlign:'middle' as const },
    h2: { fontFamily:'Georgia,serif', fontSize:'10px', letterSpacing:'0.24em', color:'#d4af6e', marginBottom:'16px', display:'flex', alignItems:'center', gap:'10px' } as React.CSSProperties,
    inp: { width:'100%', background:'rgba(255,255,255,0.05)', border:'0.5px solid rgba(212,175,110,0.2)', borderRadius:'8px', padding:'10px 13px', fontFamily:'Georgia,serif', fontSize:'14px', color:'#fff', outline:'none' } as React.CSSProperties,
    badge: (color:string) => ({ fontFamily:'Georgia,serif', fontSize:'9px', padding:'2px 9px', borderRadius:'20px', background:`${color}18`, color, border:`0.5px solid ${color}40` }),
    btn: (color:string='gold') => ({ fontFamily:'Georgia,serif', fontSize:'9px', letterSpacing:'0.1em', padding:'6px 13px', borderRadius:'7px', cursor:'pointer', border:'none', background:color==='gold'?'#d4af6e':color==='red'?'rgba(226,75,74,0.15)':'rgba(29,158,117,0.15)', color:color==='gold'?'#0f1f0f':color==='red'?'#e24b4a':'#1D9E75', transition:'all 0.15s' } as React.CSSProperties),
  }

  const sectionTitle = (t:string) => (
    <h2 style={c.h2}>{t}<span style={{flex:1,height:'0.5px',background:'rgba(212,175,110,0.12)',display:'block'}}/></h2>
  )

  if (!authorized && !loading) return <div style={{minHeight:'100dvh',background:'#080f08',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:'rgba(255,255,255,0.4)',fontFamily:'Georgia,serif'}}>Access denied.</div></div>
  if (loading) return <div style={{minHeight:'100dvh',background:'#080f08',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:'rgba(255,255,255,0.4)',fontFamily:'Georgia,serif',fontStyle:'italic'}}>Loading admin…</div></div>

  const navItems: {id:Panel;label:string;icon:string}[] = [
    {id:'overview',label:'Overview',icon:'◈'},
    {id:'campaigns',label:'Campaigns',icon:'◉'},
    {id:'requests',label:'Sadaqah Requests',icon:'◎'},
    {id:'templates',label:'Design Templates',icon:'▦'},
    {id:'masjids',label:'Masjids & Events',icon:'\u25b3'},
    {id:'orders',label:'Orders',icon:'◐'},
    {id:'users',label:'Users',icon:'◑'},
    {id:'newsletter',label:'Newsletter',icon:'◓'},
  ]

  return (
    <div style={c.page}>
      {/* Sidebar */}
      <aside style={c.sidebar}>
        <div style={{padding:'20px 18px 16px',borderBottom:'0.5px solid rgba(212,175,110,0.1)'}}>
          <div style={{fontFamily:'Georgia,serif',fontSize:'10px',letterSpacing:'0.22em',color:'#d4af6e',marginBottom:'3px'}}>GREEN EMBLEM</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:'11px',color:'rgba(255,255,255,0.3)',letterSpacing:'0.08em'}}>Admin Console</div>
        </div>
        <nav style={{flex:1,paddingTop:'8px'}}>
          {navItems.map(item => (
            <button key={item.id} style={c.navItem(panel===item.id)} onClick={() => setPanel(item.id)}>
              <span style={{fontSize:'14px',color:panel===item.id?'#d4af6e':'rgba(255,255,255,0.3)'}}>{item.icon}</span>
              <span style={c.navLabel(panel===item.id)}>{item.label}</span>
            </button>
          ))}
        </nav>
        <div style={{padding:'14px 18px',borderTop:'0.5px solid rgba(212,175,110,0.08)'}}>
          <a href="/" style={{fontFamily:'Georgia,serif',fontSize:'10px',letterSpacing:'0.1em',color:'rgba(255,255,255,0.25)',textDecoration:'none'}}>← Back to site</a>
        </div>
      </aside>

      {/* Main content */}
      <main style={c.main}>

        {/* ── OVERVIEW ── */}
        {panel === 'overview' && (
          <div style={{display:'flex',flexDirection:'column',gap:'20px'}}>
            {sectionTitle('Overview')}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:'12px'}}>
              {[
                {label:'Active campaigns',value:stats.activeCampaigns,color:'#1D9E75'},
                {label:'Total raised',value:`$${stats.totalRaised.toFixed(2)}`,color:'#d4af6e'},
                {label:'Meals funded',value:stats.mealsFunded.toLocaleString(),color:'#E8A020'},
                {label:'Orders',value:stats.orders,color:'#d4af6e'},
                {label:'Order revenue',value:`$${stats.orderRevenue.toFixed(2)}`,color:'#1D9E75'},
                {label:'Newsletter',value:`${stats.subscribers} subs`,color:'#378ADD'},
                {label:'Total users',value:stats.users,color:'rgba(255,255,255,0.6)'},
              ].map(({label,value,color}) => (
                <div key={label} style={c.statCard}>
                  <div style={{fontFamily:'Georgia,serif',fontSize:'8px',letterSpacing:'0.18em',color:'rgba(255,255,255,0.3)',marginBottom:'6px'}}>{label}</div>
                  <div style={{fontFamily:'Georgia,serif',fontSize:'clamp(20px,3vw,28px)',color,fontWeight:300,lineHeight:1}}>{value}</div>
                </div>
              ))}
            </div>

            {/* Recent campaigns */}
            <div style={c.card}>
              {sectionTitle('Recent campaigns')}
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Campaign','Event','Status','Raised','Donors'].map(h => <th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {campaigns.slice(0,5).map(campaign => (
                    <tr key={campaign.id}>
                      <td style={c.td}>{campaign.honoree_names}</td>
                      <td style={{...c.td,color:'rgba(255,255,255,0.4)',fontSize:'12px'}}>{campaign.event_type}</td>
                      <td style={c.td}><span style={c.badge(campaign.status==='active'?'#1D9E75':campaign.status==='ended'?'rgba(255,255,255,0.3)':'#d4a017')}>{campaign.status}</span></td>
                      <td style={{...c.td,color:'#d4af6e'}}>${(campaign.total_raised||0).toFixed(2)}</td>
                      <td style={c.td}>{campaign.donor_count||0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Recent orders */}
            <div style={c.card}>
              {sectionTitle('Recent orders')}
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Order #','Type','Total','Status'].map(h => <th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {orders.slice(0,5).map(order => (
                    <tr key={order.id}>
                      <td style={{...c.td,fontSize:'11px',color:'rgba(255,255,255,0.35)',letterSpacing:'0.06em'}}>{order.order_number}</td>
                      <td style={c.td}>{order.order_type}</td>
                      <td style={{...c.td,color:'#d4af6e'}}>${order.total?.toFixed(2)}</td>
                      <td style={c.td}><span style={c.badge(order.status==='delivered'?'#1D9E75':'#d4a017')}>{order.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CAMPAIGNS ── */}
        {panel === 'campaigns' && (
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            {sectionTitle(`Campaigns (${campaigns.length})`)}
            <div style={c.card}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Campaign','Event','Date','Status','Raised','Donors','Meals','Actions'].map(h => <th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {campaigns.map(camp => (
                    <tr key={camp.id}>
                      <td style={c.td}><a href={`/give/${camp.slug}`} target="_blank" style={{color:'#d4af6e',textDecoration:'none'}}>{camp.honoree_names}</a></td>
                      <td style={{...c.td,fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>{camp.event_type}</td>
                      <td style={{...c.td,fontSize:'11px',color:'rgba(255,255,255,0.3)'}}>{camp.event_date||'—'}</td>
                      <td style={c.td}><span style={c.badge(camp.status==='active'?'#1D9E75':camp.status==='ended'?'rgba(255,255,255,0.4)':'#d4a017')}>{camp.status}</span></td>
                      <td style={{...c.td,color:'#d4af6e'}}>${(camp.total_raised||0).toFixed(2)}</td>
                      <td style={c.td}>{camp.donor_count||0}</td>
                      <td style={c.td}>{camp.meals_funded||0}</td>
                      <td style={{...c.td,display:'flex',gap:'6px',flexWrap:'wrap'}}>
                        {camp.status !== 'active' && <button style={c.btn('green')} onClick={() => updateCampaignStatus(camp.id,'active')}>Activate</button>}
                        {camp.status === 'active' && <button style={c.btn('red')} onClick={() => updateCampaignStatus(camp.id,'ended')}>End</button>}
                        <a href={`/api/campaigns/${camp.slug}/qr-card?format=png`} download style={{...c.btn(), textDecoration:'none', display:'inline-block'}}>QR</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── SADAQAH REQUESTS ── */}
        {panel === 'requests' && (
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            {sectionTitle(`Sadaqah requests (${requests.length})`)}
            <div style={c.card}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Name','Email','Event','Date','Status','Actions'].map(h => <th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {requests.map(req => (
                    <tr key={req.id}>
                      <td style={c.td}>{req.first_name} {req.last_name}</td>
                      <td style={{...c.td,fontSize:'12px',color:'rgba(255,255,255,0.5)'}}>{req.email}</td>
                      <td style={{...c.td,fontSize:'12px'}}>{req.event_type}</td>
                      <td style={{...c.td,fontSize:'11px',color:'rgba(255,255,255,0.35)'}}>{req.event_date||'—'}</td>
                      <td style={c.td}><span style={c.badge(req.status==='approved'?'#1D9E75':'#d4a017')}>{req.status}</span></td>
                      <td style={c.td}>
                        <button style={c.btn('gold')} onClick={() => sendMagicLink(req.id)}>
                          Resend builder link
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── DESIGN TEMPLATES ── */}
        {panel === 'templates' && (
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            {sectionTitle(`Design templates (${templates.length})`)}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <p style={{fontFamily:'Georgia,serif',fontSize:'12px',color:'rgba(255,255,255,0.4)',fontStyle:'italic'}}>
                Published templates appear in the campaign design studio gallery for all users.
              </p>
              <button style={c.btn('gold')} onClick={() => openTplModal()}>+ New template</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))',gap:'14px'}}>
              {templates.length === 0 && (
                <div style={{...c.card,gridColumn:'1/-1',textAlign:'center',padding:'40px',color:'rgba(255,255,255,0.3)',fontFamily:'Georgia,serif',fontStyle:'italic'}}>
                  No custom templates yet. The 8 built-in classics always show in the studio — templates you add here appear alongside them.
                </div>
              )}
              {templates.map(t => (
                <div key={t.id} style={{...c.card,padding:0,overflow:'hidden'}}>
                  <div style={{position:'relative',height:'90px',background:t.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'5px'}}>
                    <div style={{width:'46%',height:'6px',borderRadius:'3px',background:t.accent}}/>
                    <div style={{width:'64%',height:'3px',borderRadius:'2px',background:`${t.text}55`}}/>
                    <div style={{width:'30%',height:'9px',borderRadius:'5px',background:t.accent,marginTop:'3px'}}/>
                    {!t.published && <span style={{position:'absolute',top:'7px',right:'7px',...c.badge('#d4a017')}}>draft</span>}
                  </div>
                  <div style={{padding:'12px 14px'}}>
                    <div style={{fontFamily:'Georgia,serif',fontSize:'13px',color:'#fff',marginBottom:'2px'}}>{t.name}</div>
                    <div style={{fontFamily:'Georgia,serif',fontSize:'10px',color:'rgba(255,255,255,0.3)',marginBottom:'10px'}}>{t.font_pair} · {t.pattern} · {t.overlay}</div>
                    <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                      <button style={c.btn()} onClick={() => openTplModal(t)}>Edit</button>
                      <button style={c.btn('green')} onClick={() => toggleTemplatePublished(t)}>{t.published ? 'Unpublish' : 'Publish'}</button>
                      <button style={c.btn('red')} onClick={() => deleteTemplate(t.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Editor modal */}
            {tplModal && (
              <div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}} onClick={() => setTplModal(false)}>
                <div style={{...c.card,width:'100%',maxWidth:'520px',maxHeight:'86dvh',overflowY:'auto',padding:'24px'}} onClick={e => e.stopPropagation()}>
                  <div style={{fontFamily:'Georgia,serif',fontSize:'11px',letterSpacing:'0.18em',color:'#d4af6e',marginBottom:'18px'}}>{tplEdit ? 'EDIT TEMPLATE' : 'NEW TEMPLATE'}</div>

                  {/* Live mini preview */}
                  <div style={{position:'relative',height:'110px',background:tplForm.bg,borderRadius:'10px',marginBottom:'18px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'6px',border:'0.5px solid rgba(255,255,255,0.1)'}}>
                    <div style={{width:'40%',height:'7px',borderRadius:'4px',background:tplForm.accent}}/>
                    <div style={{width:'58%',height:'4px',borderRadius:'2px',background:`${tplForm.text}55`}}/>
                    <div style={{width:'26%',height:'11px',borderRadius:'6px',background:tplForm.accent,marginTop:'4px'}}/>
                  </div>

                  <div style={{display:'flex',flexDirection:'column',gap:'13px'}}>
                    <div>
                      <label style={{fontFamily:'Georgia,serif',fontSize:'9px',letterSpacing:'0.16em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'6px'}}>NAME</label>
                      <input type="text" value={tplForm.name} onChange={e => setTplForm({...tplForm,name:e.target.value})} placeholder="e.g. Ramadan Nights" style={c.inp}/>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px'}}>
                      {[['bg','BACKGROUND'],['accent','ACCENT'],['text','TEXT']].map(([k,lab]) => (
                        <div key={k}>
                          <label style={{fontFamily:'Georgia,serif',fontSize:'9px',letterSpacing:'0.16em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'6px'}}>{lab}</label>
                          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                            <input type="color" className="ge-color" value={tplForm[k]} onChange={e => setTplForm({...tplForm,[k]:e.target.value})}/>
                            <span style={{fontFamily:'Georgia,serif',fontSize:'10px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase'}}>{tplForm[k]}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                      <div>
                        <label style={{fontFamily:'Georgia,serif',fontSize:'9px',letterSpacing:'0.16em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'6px'}}>FONT PAIR</label>
                        <select value={tplForm.font_pair} onChange={e => setTplForm({...tplForm,font_pair:e.target.value})} style={{...c.inp,cursor:'pointer'}}>
                          {FONT_PAIRS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{fontFamily:'Georgia,serif',fontSize:'9px',letterSpacing:'0.16em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'6px'}}>PATTERN</label>
                        <select value={tplForm.pattern} onChange={e => setTplForm({...tplForm,pattern:e.target.value})} style={{...c.inp,cursor:'pointer'}}>
                          {PATTERNS.map(pt => <option key={pt.id} value={pt.id}>{pt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{fontFamily:'Georgia,serif',fontSize:'9px',letterSpacing:'0.16em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'6px'}}>OVERLAY</label>
                        <select value={tplForm.overlay} onChange={e => setTplForm({...tplForm,overlay:e.target.value})} style={{...c.inp,cursor:'pointer'}}>
                          {OVERLAYS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{fontFamily:'Georgia,serif',fontSize:'9px',letterSpacing:'0.16em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'6px'}}>PATTERN OPACITY — {(tplForm.pattern_opacity*100).toFixed(0)}%</label>
                        <input type="range" className="ge-range" min={0.02} max={0.2} step={0.005} value={tplForm.pattern_opacity} onChange={e => setTplForm({...tplForm,pattern_opacity:parseFloat(e.target.value)})} style={{marginTop:'12px'}}/>
                      </div>
                    </div>
                    <label style={{display:'flex',alignItems:'center',gap:'10px',cursor:'pointer',fontFamily:'Georgia,serif',fontSize:'12px',color:'rgba(255,255,255,0.6)'}}>
                      <input type="checkbox" checked={tplForm.published} onChange={e => setTplForm({...tplForm,published:e.target.checked})}/>
                      Published — visible in the studio gallery
                    </label>
                    <div style={{display:'flex',gap:'10px',marginTop:'6px'}}>
                      <button style={{...c.btn(),flex:1,padding:'11px',background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.5)'}} onClick={() => setTplModal(false)}>Cancel</button>
                      <button style={{...c.btn('gold'),flex:2,padding:'11px',opacity:tplSaving?0.6:1}} onClick={saveTemplate} disabled={tplSaving}>{tplSaving ? 'Saving…' : tplEdit ? 'Save changes' : 'Create template'}</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MASJIDS & EVENTS ── */}
        {panel === 'masjids' && (
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            {sectionTitle(`Masjids & Events (${masjids.length})`)}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <p style={{fontFamily:'Georgia,serif',fontSize:'12px',color:'rgba(255,255,255,0.4)',fontStyle:'italic'}}>
                Verified Sunni masjids and Islamic institutes. Add events here — followers are notified automatically, and events auto-expire 24h after they end.
              </p>
              <button style={c.btn('gold')} onClick={() => setMasjidModal(true)}>+ Add masjid</button>
            </div>

            {masjids.length === 0 && (
              <div style={{...c.card,textAlign:'center',padding:'40px',color:'rgba(255,255,255,0.3)',fontFamily:'Georgia,serif',fontStyle:'italic'}}>
                No masjids in the directory yet. Add your first one to start posting events.
              </div>
            )}

            {masjids.map(m => {
              const events = masjidEvents.filter(e => e.masjid_id === m.id)
              return (
                <div key={m.id} style={c.card}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                        <span style={{fontFamily:'Georgia,serif',fontSize:'15px',color:'#fff'}}>{m.name}</span>
                        {m.verified && <span style={c.badge('#1D9E75')}>verified</span>}
                        {m.auto_sync_enabled && <span style={c.badge('#9b8ec4')}>auto-sync {m.auto_sync_trusted ? '· trusted' : '· review'}</span>}
                      </div>
                      <div style={{fontFamily:'Georgia,serif',fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>{m.address}</div>
                      {m.auto_sync_enabled && (
                        <div style={{fontFamily:'Georgia,serif',fontSize:'10px',color:'rgba(255,255,255,0.3)',marginTop:'4px'}}>
                          {m.last_synced_at
                            ? <>Last synced {new Date(m.last_synced_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} — {m.last_sync_status === 'error' ? <span style={{color:'#e24b4a'}}>error: {m.last_sync_error}</span> : m.last_sync_status === 'no_events_found' ? 'no events found' : `${m.last_sync_event_count ?? 0} new event(s)`}</>
                            : 'Not synced yet'}
                        </div>
                      )}
                    </div>
                    <div style={{display:'flex',gap:'6px',flexWrap:'wrap',justifyContent:'flex-end'}}>
                      {m.auto_sync_enabled && <button style={c.btn()} onClick={() => syncMasjidNow(m.id)} disabled={syncingMasjid === m.id}>{syncingMasjid === m.id ? 'Syncing…' : 'Sync now'}</button>}
                      <button style={c.btn('gold')} onClick={() => setEventModal(m.id)}>+ Event</button>
                      <button style={c.btn('red')} onClick={() => deleteMasjid(m.id)}>Remove</button>
                    </div>
                  </div>

                  {events.length > 0 && (
                    <div style={{display:'flex',flexDirection:'column',gap:'6px',marginTop:'10px',borderTop:'0.5px solid rgba(255,255,255,0.06)',paddingTop:'10px'}}>
                      {events.map(e => (
                        <div key={e.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'12px'}}>
                          <span style={{fontFamily:'Georgia,serif',color: e.status==='active' ? '#fff' : 'rgba(255,255,255,0.3)'}}>
                            {e.title} <span style={{color:'rgba(255,255,255,0.35)'}}>· {new Date(e.event_start).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                          </span>
                          <span style={{display:'flex',alignItems:'center',gap:'8px'}}>
                            <span style={c.badge(e.status==='active'?'#1D9E75':e.status==='cancelled'?'#e24b4a':e.status==='pending'?'#d4a017':'#666')}>{e.status}</span>
                            {e.status === 'pending' && <button onClick={() => approveEvent(e.id)} style={{fontFamily:'Georgia,serif',fontSize:'10px',color:'#1D9E75',background:'none',border:'none',cursor:'pointer'}}>Approve</button>}
                            {e.status === 'active' && <button onClick={() => cancelEvent(e.id)} style={{fontFamily:'Georgia,serif',fontSize:'10px',color:'rgba(255,255,255,0.3)',background:'none',border:'none',cursor:'pointer'}}>Cancel</button>}
                            {e.status === 'pending' && <button onClick={() => cancelEvent(e.id)} style={{fontFamily:'Georgia,serif',fontSize:'10px',color:'#e24b4a',background:'none',border:'none',cursor:'pointer'}}>Reject</button>}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add-event modal, scoped to this masjid */}
                  {eventModal === m.id && (
                    <div style={{marginTop:'14px',borderTop:'0.5px solid rgba(212,175,110,0.15)',paddingTop:'14px',display:'flex',flexDirection:'column',gap:'10px'}}>
                      <input type="text" placeholder="Event title" value={eventForm.title} onChange={e => setEventForm({...eventForm,title:e.target.value})} style={c.inp}/>
                      <textarea placeholder="Description (optional)" value={eventForm.description} onChange={e => setEventForm({...eventForm,description:e.target.value})} style={{...c.inp,minHeight:'60px',resize:'vertical'}}/>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                        <div>
                          <label style={{fontFamily:'Georgia,serif',fontSize:'9px',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'4px'}}>STARTS</label>
                          <input type="datetime-local" value={eventForm.event_start} onChange={e => setEventForm({...eventForm,event_start:e.target.value})} style={{...c.inp,colorScheme:'dark'}}/>
                        </div>
                        <div>
                          <label style={{fontFamily:'Georgia,serif',fontSize:'9px',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'4px'}}>ENDS</label>
                          <input type="datetime-local" value={eventForm.event_end} onChange={e => setEventForm({...eventForm,event_end:e.target.value})} style={{...c.inp,colorScheme:'dark'}}/>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:'8px'}}>
                        <button style={{...c.btn(),flex:1}} onClick={() => setEventModal(null)}>Cancel</button>
                        <button style={{...c.btn('gold'),flex:2,opacity:eventSaving?0.6:1}} onClick={() => saveEvent(m.id)} disabled={eventSaving}>{eventSaving ? 'Posting…' : 'Post event & notify followers'}</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Add-masjid modal */}
            {masjidModal && (
              <div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}} onClick={() => setMasjidModal(false)}>
                <div style={{...c.card,width:'100%',maxWidth:'480px',padding:'24px'}} onClick={e => e.stopPropagation()}>
                  <div style={{fontFamily:'Georgia,serif',fontSize:'11px',letterSpacing:'0.18em',color:'#d4af6e',marginBottom:'18px'}}>ADD MASJID</div>
                  <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                    <div>
                      <label style={{fontFamily:'Georgia,serif',fontSize:'9px',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'5px'}}>NAME</label>
                      <input type="text" value={masjidForm.name} onChange={e => setMasjidForm({...masjidForm,name:e.target.value})} placeholder="Masjid Al-Noor" style={c.inp}/>
                    </div>
                    <div>
                      <label style={{fontFamily:'Georgia,serif',fontSize:'9px',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'5px'}}>ADDRESS (search Google Maps)</label>
                      <MosqueAutocomplete onSelect={setMasjidPlace} inputStyle={c.inp}/>
                      {masjidPlace && <div style={{fontFamily:'Georgia,serif',fontSize:'11px',color:'#1D9E75',marginTop:'6px'}}>✓ {masjidPlace.formattedAddress}</div>}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                      <input type="text" placeholder="Instagram handle" value={masjidForm.instagram_handle} onChange={e => setMasjidForm({...masjidForm,instagram_handle:e.target.value})} style={c.inp}/>
                      <input type="text" placeholder="Phone" value={masjidForm.phone} onChange={e => setMasjidForm({...masjidForm,phone:e.target.value})} style={c.inp}/>
                    </div>
                    <div>
                      <label style={{fontFamily:'Georgia,serif',fontSize:'9px',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'5px'}}>WEBSITE (their events/announcements page, if they have one)</label>
                      <input type="text" placeholder="https://masjidname.org/events" value={masjidForm.website} onChange={e => setMasjidForm({...masjidForm,website:e.target.value})} style={c.inp}/>
                    </div>
                    <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',fontFamily:'Georgia,serif',fontSize:'12px',color:'rgba(255,255,255,0.6)'}}>
                      <input type="checkbox" checked={masjidForm.auto_sync_enabled} onChange={e => setMasjidForm({...masjidForm,auto_sync_enabled:e.target.checked})} disabled={!masjidForm.website}/>
                      Auto-sync events from their website (AI-extracted, held for your review before publishing)
                    </label>
                    <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',fontFamily:'Georgia,serif',fontSize:'12px',color:'rgba(255,255,255,0.6)'}}>
                      <input type="checkbox" checked={masjidForm.verified} onChange={e => setMasjidForm({...masjidForm,verified:e.target.checked})}/>
                      Verified (confirmed real, active institution)
                    </label>
                    <div style={{display:'flex',gap:'10px',marginTop:'6px'}}>
                      <button style={{...c.btn(),flex:1}} onClick={() => setMasjidModal(false)}>Cancel</button>
                      <button style={{...c.btn('gold'),flex:2,opacity:masjidSaving?0.6:1}} onClick={saveMasjid} disabled={masjidSaving || !masjidForm.name}>{masjidSaving ? 'Saving…' : 'Add to directory'}</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ORDERS ── */}
        {panel === 'orders' && (
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            {sectionTitle(`Orders (${orders.length})`)}
            <div style={c.card}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Order #','Customer','Type','Total','Status','Date'].map(h => <th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id}>
                      <td style={{...c.td,fontSize:'11px',color:'rgba(255,255,255,0.35)',letterSpacing:'0.06em'}}>{order.order_number}</td>
                      <td style={c.td}>{order.customer_name || order.customer_email}</td>
                      <td style={{...c.td,fontSize:'12px'}}>{order.order_type}</td>
                      <td style={{...c.td,color:'#d4af6e'}}>${order.total?.toFixed(2)}</td>
                      <td style={c.td}>
                        <select value={order.status} onChange={async e => {
                          await supabase.from('orders').update({status:e.target.value}).eq('id',order.id)
                          setOrders(os => os.map(o => o.id===order.id?{...o,status:e.target.value}:o))
                        }} style={{background:'rgba(255,255,255,0.05)',border:'0.5px solid rgba(212,175,110,0.2)',borderRadius:'6px',padding:'4px 8px',fontFamily:'Georgia,serif',fontSize:'11px',color:'#fff',cursor:'pointer'}}>
                          {['pending','processing','shipped','delivered','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{...c.td,fontSize:'11px',color:'rgba(255,255,255,0.3)'}}>{new Date(order.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── USERS ── */}
        {panel === 'users' && (
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            {sectionTitle(`Users (${users.length})`)}
            <div style={c.card}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Name','Email','Mosque','Newsletter','Onboarded','Role'].map(h => <th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td style={c.td}>{user.first_name||''} {user.last_name||''} <span style={{fontSize:'11px',color:'rgba(255,255,255,0.3)'}}>{user.full_name&&!user.first_name?`(${user.full_name})`:''}</span></td>
                      <td style={{...c.td,fontSize:'12px',color:'rgba(255,255,255,0.5)'}}>{user.email}</td>
                      <td style={{...c.td,fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>{user.local_mosque||'—'}</td>
                      <td style={c.td}><span style={c.badge(user.newsletter_opted_in?'#1D9E75':'rgba(255,255,255,0.25)')}>{user.newsletter_opted_in?'Yes':'No'}</span></td>
                      <td style={c.td}><span style={c.badge(user.onboarding_complete?'#1D9E75':'#d4a017')}>{user.onboarding_complete?'Yes':'Pending'}</span></td>
                      <td style={c.td}><span style={c.badge(user.role==='admin'?'#d4af6e':'rgba(255,255,255,0.25)')}>{user.role||'user'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── NEWSLETTER ── */}
        {panel === 'newsletter' && (
          <div style={{display:'flex',flexDirection:'column',gap:'20px'}}>
            {sectionTitle(`Newsletter (${subscribers.length} subscribers)`)}

            {/* Compose */}
            <div style={c.card}>
              <div style={{fontFamily:'Georgia,serif',fontSize:'11px',letterSpacing:'0.18em',color:'rgba(255,255,255,0.5)',marginBottom:'16px'}}>COMPOSE NEWSLETTER</div>
              <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                <div>
                  <label style={{fontFamily:'Georgia,serif',fontSize:'9px',letterSpacing:'0.16em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'7px'}}>SUBJECT LINE</label>
                  <input type="text" value={newsletterSubject} onChange={e => setNewsletterSubject(e.target.value)} placeholder="e.g. Ramadan Mubarak from Green Emblem" style={c.inp}/>
                </div>
                <div>
                  <label style={{fontFamily:'Georgia,serif',fontSize:'9px',letterSpacing:'0.16em',color:'rgba(255,255,255,0.35)',display:'block',marginBottom:'7px'}}>BODY (plain text or HTML)</label>
                  <textarea value={newsletterBody} onChange={e => setNewsletterBody(e.target.value)} placeholder="Write your newsletter here…" rows={10} style={{...c.inp,resize:'vertical' as const,lineHeight:1.6}}/>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'14px'}}>
                  <button onClick={sendNewsletter} disabled={sendingNewsletter||!newsletterSubject||!newsletterBody} style={{fontFamily:'Georgia,serif',fontSize:'10px',letterSpacing:'0.14em',color:'#0f1f0f',background:newsletterSubject&&newsletterBody?'#d4af6e':'rgba(255,255,255,0.15)',border:'none',borderRadius:'8px',padding:'12px 24px',cursor:newsletterSubject&&newsletterBody?'pointer':'not-allowed',opacity:sendingNewsletter?0.6:1}}>
                    {sendingNewsletter?'Sending…':newsletterSent?'Sent!`':`Send to ${subscribers.length} subscribers`}
                  </button>
                  <span style={{fontFamily:'Georgia,serif',fontSize:'12px',color:'rgba(255,255,255,0.3)',fontStyle:'italic'}}>Via Resend · green-emblem.com</span>
                </div>
              </div>
            </div>

            {/* Subscriber list */}
            <div style={c.card}>
              <div style={{fontFamily:'Georgia,serif',fontSize:'11px',letterSpacing:'0.18em',color:'rgba(255,255,255,0.5)',marginBottom:'16px'}}>SUBSCRIBER LIST</div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Name','Email','Source','Subscribed'].map(h => <th key={h} style={c.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {subscribers.map(sub => (
                    <tr key={sub.id}>
                      <td style={c.td}>{sub.first_name||''} {sub.last_name||''}</td>
                      <td style={{...c.td,fontSize:'12px',color:'rgba(255,255,255,0.5)'}}>{sub.email}</td>
                      <td style={{...c.td,fontSize:'11px',color:'rgba(255,255,255,0.3)'}}>{sub.source}</td>
                      <td style={{...c.td,fontSize:'11px',color:'rgba(255,255,255,0.3)'}}>{new Date(sub.subscribed_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
__GE_EOF_4b8e1f__
echo "  wrote app/admin/page.tsx"
mkdir -p "app/api/donate/confirm"
cat > 'app/api/donate/confirm/route.ts' <<'__GE_EOF_4b8e1f__'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const { donation_id } = await request.json()
  if (!donation_id) return NextResponse.json({ error: 'Donation ID required' }, { status: 400 })

  const admin = createAdminClient()

  // Mark confirmed
  const { data: donation, error } = await admin
    .from('donations')
    .update({ confirmed: true })
    .eq('id', donation_id)
    .eq('confirmed', false) // idempotent
    .select()
    .single()

  if (error || !donation) return NextResponse.json({ error: 'Not found or already confirmed' }, { status: 404 })

  // Atomically update campaign totals
  await admin.rpc('increment_campaign_stats', {
    p_campaign_id: donation.campaign_id,
    p_amount:      donation.amount,
    p_meals:       donation.meals_funded || 0,
  })

  // Update user lifetime total if signed in
  if (donation.user_id) {
    await admin.rpc('increment_user_donated', {
      p_user_id: donation.user_id,
      p_amount:  donation.amount,
    })
  }

  return NextResponse.json({ success: true, donation })
}
__GE_EOF_4b8e1f__
echo "  wrote app/api/donate/confirm/route.ts"
mkdir -p "components"
cat > 'components/Nav.tsx' <<'__GE_EOF_4b8e1f__'
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
          'backdrop-blur-xl supports-[backdrop-filter]:bg-forest-dark/80',
          scrolled ? 'border-gold/20 bg-[#080f08]/95' : 'border-gold/10 bg-forest-dark/85'
        )}
      >
        <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-6 lg:px-10">

          <Link href="/" className="flex items-center gap-3 no-underline">
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
                      ? 'text-gold after:w-full'
                      : 'text-white/55 hover:text-white after:w-0 hover:after:w-full'
                  )}
                >
                  {label}
                </Link>
              </li>
            ))}
            {user ? (
              <>
                <li>
                  <Link href="/dashboard" className="font-cinzel text-[10px] tracking-wider2 text-white/55 no-underline transition-colors hover:text-white">
                    My Dashboard
                  </Link>
                </li>
                <li>
                  <button onClick={signOut} className="cursor-pointer border-none bg-transparent p-0 font-cinzel text-[10px] tracking-wider2 text-white/55 transition-colors hover:text-white">
                    Sign out
                  </button>
                </li>
              </>
            ) : (
              <li>
                <Link href="/auth/sign-in" className="font-cinzel text-[10px] tracking-wider2 text-white/55 no-underline transition-colors hover:text-white">
                  Sign in
                </Link>
              </li>
            )}
            <li>
              <Button asChild variant="brand" size="sm">
                <Link href="/sadaqah">Start Baab As-Sadaqah</Link>
              </Button>
            </li>
          </ul>

          {/* Mobile toggle */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="flex cursor-pointer items-center justify-center border-none bg-transparent p-1 text-gold lg:hidden"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile sheet */}
      <div
        className={cn(
          'fixed inset-x-0 top-[68px] z-[99] origin-top border-b border-gold/15 bg-[#080f08]/95 backdrop-blur-xl transition-all duration-200 lg:hidden',
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
                isActive(href) ? 'bg-gold/10 text-gold' : 'text-white/60 hover:bg-white/5 hover:text-white'
              )}
            >
              {label}
            </Link>
          ))}
          {user ? (
            <>
              <Link href="/dashboard" className="rounded-md px-3 py-3 font-cinzel text-[12px] tracking-wider2 text-white/60 no-underline transition-colors hover:bg-white/5 hover:text-white">
                My Dashboard
              </Link>
              <button onClick={signOut} className="cursor-pointer rounded-md border-none bg-transparent px-3 py-3 text-left font-cinzel text-[12px] tracking-wider2 text-white/60 transition-colors hover:bg-white/5 hover:text-white">
                Sign out
              </button>
            </>
          ) : (
            <Link href="/auth/sign-in" className="rounded-md px-3 py-3 font-cinzel text-[12px] tracking-wider2 text-gold no-underline transition-colors hover:bg-white/5">
              Sign in
            </Link>
          )}
          <Button asChild variant="brand" className="mt-2 w-full">
            <Link href="/sadaqah">Start Baab As-Sadaqah</Link>
          </Button>
        </div>
      </div>
    </>
  )
}
__GE_EOF_4b8e1f__
echo "  wrote components/Nav.tsx"
mkdir -p "components"
cat > 'components/Footer.tsx' <<'__GE_EOF_4b8e1f__'
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
  'font-cormorant text-sm italic text-white/55 no-underline transition-colors hover:text-gold'

const colTitleClass =
  'mb-4 font-cinzel text-[9px] tracking-[0.2em] text-gold/80'

export default function Footer() {
  return (
    <footer className="border-t border-gold/10 bg-[#080f08] px-6 pb-8 pt-14 lg:px-10">
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
__GE_EOF_4b8e1f__
echo "  wrote components/Footer.tsx"
mkdir -p "components"
cat > 'components/BottomNav.tsx' <<'__GE_EOF_4b8e1f__'
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
          'fixed inset-x-0 bottom-0 z-[120] border-t border-gold/15 bg-[#080f08]/95 backdrop-blur-xl lg:hidden',
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
                  className={cn('h-[22px] w-[22px] transition-colors', active ? 'text-gold' : 'text-white/45')}
                  strokeWidth={active ? 2 : 1.6}
                />
                <span
                  className={cn(
                    'text-[9px] font-semibold tracking-wide transition-colors',
                    active ? 'text-gold' : 'text-white/40'
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
__GE_EOF_4b8e1f__
echo "  wrote components/BottomNav.tsx"
mkdir -p "components"
cat > 'components/QuranReader.tsx' <<'__GE_EOF_4b8e1f__'
'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  SURAHS, fetchChapters, fetchTranslations, fetchSurah, fetchTafsir,
  toArabicNumber, DEFAULT_TRANSLATION_ID,
  type Chapter, type SurahPayload, type TranslationOption,
} from '@/lib/quran'

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(212,175,110,0.25)',
  borderRadius: '9px', padding: '9px 12px', fontFamily: 'var(--font-inter)',
  fontSize: '13px', color: '#fff', outline: 'none',
}

// Uthmani script only — no script picker, by design.
const UTHMANI: React.CSSProperties = {
  fontFamily: 'var(--font-uthmani)',
  direction: 'rtl',
  textAlign: 'right',
  lineHeight: 2.25,
  letterSpacing: 0,
}

const PREF_KEY = 'ge_quran_prefs'

export default function QuranReader() {
  const [search, setSearch] = useState('')
  const [surahNumber, setSurahNumber] = useState(1)
  const [chapters, setChapters] = useState<Chapter[] | null>(null)

  const [translations, setTranslations] = useState<TranslationOption[]>([])
  const [translationId, setTranslationId] = useState(DEFAULT_TRANSLATION_ID)

  const [data, setData] = useState<SurahPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const [tafsirFor, setTafsirFor] = useState<number | null>(null)
  const [tafsir, setTafsir] = useState<{ text: string; name: string } | null>(null)
  const [tafsirLoading, setTafsirLoading] = useState(false)
  const [tafsirMissing, setTafsirMissing] = useState(false)

  // Restore last-read position + translation choice
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY)
      if (raw) {
        const p = JSON.parse(raw)
        if (p.surah >= 1 && p.surah <= 114) setSurahNumber(p.surah)
        if (p.translationId) setTranslationId(p.translationId)
      }
    } catch {}
    fetchChapters().then(setChapters)
    fetchTranslations().then(list => {
      setTranslations(list)
      // If the saved/default translation isn't offered, fall back to the first
      setTranslationId(prev => (list.length && !list.some(t => t.id === prev)) ? list[0].id : prev)
    })
  }, [])

  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ surah: surahNumber, translationId })) } catch {}
  }, [surahNumber, translationId])

  // Load the surah
  useEffect(() => {
    let cancelled = false
    setLoading(true); setFailed(false); setTafsirFor(null)
    fetchSurah(surahNumber, translationId).then(payload => {
      if (cancelled) return
      if (!payload) { setFailed(true); setData(null) } else { setData(payload) }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [surahNumber, translationId])

  const retry = useCallback(() => {
    setLoading(true); setFailed(false)
    fetchSurah(surahNumber, translationId).then(p => {
      if (p) { setData(p); setFailed(false) } else { setFailed(true) }
      setLoading(false)
    })
  }, [surahNumber, translationId])

  const openTafsir = useCallback(async (ayah: number) => {
    if (tafsirFor === ayah) { setTafsirFor(null); return }
    setTafsirFor(ayah); setTafsir(null); setTafsirMissing(false); setTafsirLoading(true)
    const t = await fetchTafsir(surahNumber, ayah)
    setTafsirLoading(false)
    if (t) setTafsir(t); else setTafsirMissing(true)
  }, [tafsirFor, surahNumber])

  // Sidebar list — API chapters when available, local list until then
  const list = chapters
    ? chapters.map(c => ({ number: c.id, name: c.name_simple, arabicName: c.name_arabic, ayahs: c.verses_count, type: c.revelation_place === 'makkah' ? 'Meccan' : 'Medinan' }))
    : SURAHS.map(s => ({ ...s }))

  const filtered = list.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || String(s.number).includes(search)
  )
  const current = list.find(s => s.number === surahNumber)

  return (
    <div className="quran-grid" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '22px', alignItems: 'start' }}>

      {/* ── Surah list ── */}
      <aside className="quran-sidebar" style={{ background: 'rgba(15,31,15,0.5)', border: '0.5px solid rgba(212,175,110,0.12)', borderRadius: '14px', padding: '14px', maxHeight: '72vh', overflowY: 'auto', position: 'sticky', top: '92px' }}>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search surah…" style={{ ...inputStyle, width: '100%', marginBottom: '10px' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {filtered.map(s => {
            const active = s.number === surahNumber
            return (
              <button
                key={s.number}
                onClick={() => { setSurahNumber(s.number); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
                  background: active ? 'rgba(212,175,110,0.12)' : 'transparent',
                  border: 'none', borderRadius: '8px', padding: '9px 10px', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                  <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', color: active ? 'var(--gold)' : 'rgba(255,255,255,0.3)', minWidth: '18px' }}>{s.number}</span>
                  <span style={{ fontFamily: 'var(--font-inter)', fontSize: '12.5px', color: active ? 'var(--gold)' : 'rgba(255,255,255,0.72)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                </span>
                <span style={{ fontFamily: 'var(--font-uthmani)', fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>{s.arabicName}</span>
              </button>
            )
          })}
        </div>
      </aside>

      {/* ── Reader ── */}
      <div>
        {/* Translation picker (script is always Uthmani) */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.35)' }}>TRANSLATION</span>
          <select
            value={translationId}
            onChange={e => setTranslationId(Number(e.target.value))}
            style={{ ...inputStyle, cursor: 'pointer', flex: 1, minWidth: '220px' }}
          >
            {translations.length === 0 && <option value={DEFAULT_TRANSLATION_ID}>The Clear Quran — Dr. Mustafa Khattab</option>}
            {translations.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* Surah header */}
        {current && (
          <div style={{ textAlign: 'center', marginBottom: '26px', paddingBottom: '22px', borderBottom: '0.5px solid rgba(212,175,110,0.14)' }}>
            <div style={{ fontFamily: 'var(--font-uthmani)', fontSize: '38px', color: 'var(--gold)', lineHeight: 1.6, marginBottom: '8px' }} dir="rtl">{current.arabicName}</div>
            <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '16px', color: '#fff', marginBottom: '4px' }}>{current.number}. {current.name}</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '11px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)' }}>
              {current.type.toUpperCase()} · {current.ayahs} VERSES
            </div>
          </div>
        )}

        {/* Bismillah — rendered as its own header, never merged into verse 1 */}
        {!loading && data?.showBismillah && data.bismillah && (
          <div style={{ ...UTHMANI, textAlign: 'center', fontSize: '27px', color: 'rgba(245,240,230,0.92)', margin: '0 0 30px', lineHeight: 2 }} dir="rtl">
            {data.bismillah}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '110px', borderRadius: '12px' }}/>)}
          </div>
        ) : failed || !data ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: 'rgba(226,75,74,0.06)', border: '0.5px solid rgba(226,75,74,0.2)', borderRadius: '14px' }}>
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '16px', fontStyle: 'italic', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: '16px' }}>
              We couldn&apos;t load this surah right now. Rather than show text we can&apos;t verify, we&apos;ve stopped here.
            </p>
            <button onClick={retry} style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 600, color: '#0f1f0f', background: 'var(--gold)', border: 'none', borderRadius: '9px', padding: '10px 22px', cursor: 'pointer' }}>
              Try again
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data.verses.map(v => (
              <div key={v.key} style={{ background: 'rgba(15,31,15,0.4)', border: '0.5px solid rgba(212,175,110,0.1)', borderRadius: '12px', padding: '20px 22px' }}>

                {/* verse key + actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.08em', color: 'rgba(212,175,110,0.75)', background: 'rgba(212,175,110,0.08)', borderRadius: '20px', padding: '3px 10px' }}>{v.key}</span>
                  <button
                    onClick={() => openTafsir(v.number)}
                    style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.06em', color: tafsirFor === v.number ? 'var(--gold)' : 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {tafsirFor === v.number ? 'Hide tafsir ▲' : 'Tafsir ▼'}
                  </button>
                </div>

                {/* Uthmani text with end-of-ayah marker */}
                <p style={{ ...UTHMANI, fontSize: '30px', color: '#f5f0e6', margin: '0 0 16px' }} dir="rtl" lang="ar">
                  {v.uthmani}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '34px', height: '34px', margin: '0 8px', verticalAlign: 'middle',
                    borderRadius: '50%', border: '1px solid rgba(212,175,110,0.5)',
                    fontFamily: 'var(--font-uthmani)', fontSize: '13px', color: 'var(--gold)', lineHeight: 1,
                  }} aria-label={`Ayah ${v.number}`}>
                    {toArabicNumber(v.number)}
                  </span>
                </p>

                {/* Translation */}
                {v.translation && (
                  <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '16px', color: 'rgba(255,255,255,0.62)', lineHeight: 1.75, margin: 0 }}>
                    {v.translation}
                  </p>
                )}

                {/* Tafsir — Ibn Kathir (English) only */}
                {tafsirFor === v.number && (
                  <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.12em', color: 'rgba(212,175,110,0.7)', marginBottom: '10px', textTransform: 'uppercase' }}>
                      Tafsir Ibn Kathir
                    </div>
                    {tafsirLoading ? (
                      <div className="skeleton" style={{ height: '60px', borderRadius: '8px' }}/>
                    ) : tafsirMissing || !tafsir ? (
                      <div style={{ fontFamily: 'Georgia, serif', fontSize: '12.5px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                        No Ibn Kathir commentary is available for this verse.
                      </div>
                    ) : (
                      <div
                        className="tafsir-body"
                        style={{ fontFamily: 'Georgia, serif', fontSize: '14px', color: 'rgba(255,255,255,0.58)', lineHeight: 1.8 }}
                        dangerouslySetInnerHTML={{ __html: tafsir.text }}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', textAlign: 'center', marginTop: '24px', lineHeight: 1.7 }}>
          Arabic text (Uthmani script), translations and Tafsir Ibn Kathir are served by the Quran.com API.
          <br/>Offered for reading and reflection, not as a substitute for scholarly guidance.
        </p>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .quran-grid { grid-template-columns: 1fr !important; }
          .quran-sidebar { position: static !important; max-height: 260px !important; }
        }
        .tafsir-body p { margin: 0 0 10px; }
        .tafsir-body h1, .tafsir-body h2, .tafsir-body h3, .tafsir-body h4 {
          font-family: var(--font-cinzel); font-size: 13px; color: rgba(212,175,110,0.85);
          margin: 14px 0 8px; font-weight: 500; letter-spacing: 0.04em;
        }
        .tafsir-body ul, .tafsir-body ol { margin: 0 0 10px; padding-inline-start: 20px; }
        .tafsir-body blockquote {
          margin: 10px 0; padding-inline-start: 14px;
          border-inline-start: 2px solid rgba(212,175,110,0.3); color: rgba(255,255,255,0.7);
        }
      `}</style>
    </div>
  )
}
__GE_EOF_4b8e1f__
echo "  wrote components/QuranReader.tsx"
mkdir -p "components/ui"
cat > 'components/ui/button.tsx' <<'__GE_EOF_4b8e1f__'
'use client'
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 cursor-pointer no-underline [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:     'bg-primary text-primary-foreground hover:opacity-90 hover:-translate-y-px active:translate-y-0',
        // The signature Green Emblem CTA — Cinzel, wide tracking, gold
        brand:       'bg-gold text-forest-dark font-cinzel text-[11px] tracking-wider2 hover:opacity-90 hover:-translate-y-px active:translate-y-0',
        outline:     'border border-gold/50 bg-transparent text-gold font-cinzel text-[11px] tracking-wider2 hover:bg-gold/10 hover:border-gold hover:-translate-y-px',
        secondary:   'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:       'text-foreground/70 hover:bg-white/5 hover:text-foreground',
        link:        'text-gold underline-offset-4 hover:underline',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        sm:      'h-9 px-4 text-xs',
        default: 'h-10 px-5 py-2',
        lg:      'h-12 px-8',
        icon:    'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
__GE_EOF_4b8e1f__
echo "  wrote components/ui/button.tsx"
mkdir -p "components/ui"
cat > 'components/ui/card.tsx' <<'__GE_EOF_4b8e1f__'
import * as React from 'react'
import { cn } from '@/lib/utils'

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border border-gold/15 bg-forest-dark/70 text-card-foreground backdrop-blur-md',
        className
      )}
      {...props}
    />
  )
)
Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  )
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('font-cinzel text-lg font-medium leading-snug tracking-tight text-white', className)} {...props} />
  )
)
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('font-cormorant text-sm italic leading-relaxed text-white/45', className)} {...props} />
  )
)
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  )
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
__GE_EOF_4b8e1f__
echo "  wrote components/ui/card.tsx"
mkdir -p "components/ui"
cat > 'components/ui/badge.tsx' <<'__GE_EOF_4b8e1f__'
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 font-cinzel text-[9px] tracking-[0.14em] transition-colors',
  {
    variants: {
      variant: {
        default: 'border-gold/30 bg-gold/10 text-gold',
        green:   'border-forest-mid/30 bg-forest-mid/15 text-forest-light',
        violet:  'border-violet/30 bg-violet/10 text-violet',
        muted:   'border-white/15 bg-white/5 text-white/60',
        destructive: 'border-destructive/25 bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
__GE_EOF_4b8e1f__
echo "  wrote components/ui/badge.tsx"
mkdir -p "components/ui"
cat > 'components/ui/input.tsx' <<'__GE_EOF_4b8e1f__'
import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-md border border-gold/20 bg-white/[0.04] px-3.5 py-2',
        'font-cormorant text-base text-white outline-none transition-colors',
        'placeholder:italic placeholder:text-white/35',
        'focus:border-gold/50 focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

export { Input }
__GE_EOF_4b8e1f__
echo "  wrote components/ui/input.tsx"
mkdir -p "components/ui"
cat > 'components/ui/select.tsx' <<'__GE_EOF_4b8e1f__'
'use client'
import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-11 w-full items-center justify-between gap-2 rounded-md border border-gold/20 bg-white/[0.04] px-3.5 py-2',
      'font-cormorant text-base text-white outline-none transition-colors cursor-pointer',
      'focus:border-gold/50 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:truncate',
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 shrink-0 text-gold/60" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-gold/20 bg-[#0d1a0d] shadow-xl',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
        className
      )}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn('p-1', position === 'popper' && 'w-full min-w-[var(--radix-select-trigger-width)]')}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2',
      'font-cormorant text-sm text-white/80 outline-none transition-colors',
      'focus:bg-gold/10 focus:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-3.5 w-3.5 text-gold" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem }
__GE_EOF_4b8e1f__
echo "  wrote components/ui/select.tsx"
mkdir -p "components/ui"
cat > 'components/ui/dialog.tsx' <<'__GE_EOF_4b8e1f__'
'use client'
import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/75 backdrop-blur-sm',
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4',
        'rounded-lg border border-gold/20 bg-[#101f10] p-6 shadow-2xl',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm text-white/40 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-left', className)} {...props} />
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
)
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('font-cinzel text-lg font-medium text-white', className)} {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('font-cormorant text-sm italic text-white/50', className)} {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog, DialogPortal, DialogOverlay, DialogTrigger, DialogClose,
  DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
}
__GE_EOF_4b8e1f__
echo "  wrote components/ui/dialog.tsx"
mkdir -p "components/ui"
cat > 'components/ui/tabs.tsx' <<'__GE_EOF_4b8e1f__'
'use client'
import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center gap-1 rounded-full border border-gold/15 bg-white/[0.05] p-1',
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-full px-6 py-2',
      'text-[11px] font-semibold tracking-wide text-white/50 transition-all cursor-pointer',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
      'data-[state=active]:bg-gold data-[state=active]:text-forest-dark',
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('mt-2 focus-visible:outline-none', className)}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
__GE_EOF_4b8e1f__
echo "  wrote components/ui/tabs.tsx"
mkdir -p "components/ui"
cat > 'components/ui/separator.tsx' <<'__GE_EOF_4b8e1f__'
'use client'
import * as React from 'react'
import * as SeparatorPrimitive from '@radix-ui/react-separator'
import { cn } from '@/lib/utils'

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      'shrink-0 bg-gold/15',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className
    )}
    {...props}
  />
))
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }
__GE_EOF_4b8e1f__
echo "  wrote components/ui/separator.tsx"
mkdir -p "components/ui"
cat > 'components/ui/skeleton.tsx' <<'__GE_EOF_4b8e1f__'
import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-white/[0.06]', className)} {...props} />
}

export { Skeleton }
__GE_EOF_4b8e1f__
echo "  wrote components/ui/skeleton.tsx"

echo
echo "==> Verifying"
MISS=0
if [ ! -s "APPLY-UI-REFRESH.md" ]; then echo "  MISSING APPLY-UI-REFRESH.md"; MISS=1; fi
if [ ! -s "rewards-teardown.sql" ]; then echo "  MISSING rewards-teardown.sql"; MISS=1; fi
if [ ! -s "tailwind.config.ts" ]; then echo "  MISSING tailwind.config.ts"; MISS=1; fi
if [ ! -s "postcss.config.js" ]; then echo "  MISSING postcss.config.js"; MISS=1; fi
if [ ! -s "lib/utils.ts" ]; then echo "  MISSING lib/utils.ts"; MISS=1; fi
if [ ! -s "app/globals.css" ]; then echo "  MISSING app/globals.css"; MISS=1; fi
if [ ! -s "app/layout.tsx" ]; then echo "  MISSING app/layout.tsx"; MISS=1; fi
if [ ! -s "app/page.tsx" ]; then echo "  MISSING app/page.tsx"; MISS=1; fi
if [ ! -s "app/explore/page.tsx" ]; then echo "  MISSING app/explore/page.tsx"; MISS=1; fi
if [ ! -s "app/prayer/page.tsx" ]; then echo "  MISSING app/prayer/page.tsx"; MISS=1; fi
if [ ! -s "app/greenworld-plus/page.tsx" ]; then echo "  MISSING app/greenworld-plus/page.tsx"; MISS=1; fi
if [ ! -s "app/admin/page.tsx" ]; then echo "  MISSING app/admin/page.tsx"; MISS=1; fi
if [ ! -s "app/api/donate/confirm/route.ts" ]; then echo "  MISSING app/api/donate/confirm/route.ts"; MISS=1; fi
if [ ! -s "components/Nav.tsx" ]; then echo "  MISSING components/Nav.tsx"; MISS=1; fi
if [ ! -s "components/Footer.tsx" ]; then echo "  MISSING components/Footer.tsx"; MISS=1; fi
if [ ! -s "components/BottomNav.tsx" ]; then echo "  MISSING components/BottomNav.tsx"; MISS=1; fi
if [ ! -s "components/QuranReader.tsx" ]; then echo "  MISSING components/QuranReader.tsx"; MISS=1; fi
if [ ! -s "components/ui/button.tsx" ]; then echo "  MISSING components/ui/button.tsx"; MISS=1; fi
if [ ! -s "components/ui/card.tsx" ]; then echo "  MISSING components/ui/card.tsx"; MISS=1; fi
if [ ! -s "components/ui/badge.tsx" ]; then echo "  MISSING components/ui/badge.tsx"; MISS=1; fi
if [ ! -s "components/ui/input.tsx" ]; then echo "  MISSING components/ui/input.tsx"; MISS=1; fi
if [ ! -s "components/ui/select.tsx" ]; then echo "  MISSING components/ui/select.tsx"; MISS=1; fi
if [ ! -s "components/ui/dialog.tsx" ]; then echo "  MISSING components/ui/dialog.tsx"; MISS=1; fi
if [ ! -s "components/ui/tabs.tsx" ]; then echo "  MISSING components/ui/tabs.tsx"; MISS=1; fi
if [ ! -s "components/ui/separator.tsx" ]; then echo "  MISSING components/ui/separator.tsx"; MISS=1; fi
if [ ! -s "components/ui/skeleton.tsx" ]; then echo "  MISSING components/ui/skeleton.tsx"; MISS=1; fi
if [ "$MISS" = "1" ]; then echo; echo "Some files did not write (listed above)."; exit 1; fi

if grep -rqsE "awardPoints|PointsBadge|PointsToaster|RewardsWidgets|lib/rewards" app components lib; then
  echo
  echo "ERROR: a rewards reference survived:"
  grep -rnsE "awardPoints|PointsBadge|PointsToaster|RewardsWidgets|lib/rewards" app components lib || true
  exit 1
fi

# Tailwind opacity modifiers only accept multiples of 5 — anything else
# silently compiles to nothing (this cost us a see-through bottom nav).
if grep -rqsE '(bg|text|border)-\[?#?[A-Za-z0-9]*\]?/(9[1-46-9]|[0-9]*[1-46-9])\b' components/ui components/Nav.tsx components/BottomNav.tsx 2>/dev/null; then
  echo "  note: check opacity modifiers are multiples of 5"
fi

echo "  all files present, no rewards references remain"
echo
echo "─────────────────────────────────────────────"
echo "Next:"
echo "  npm run build"
echo "  git add -A"
echo "  git commit -m 'feat: remove rewards system; add Tailwind + shadcn UI foundation'"
echo "  git push"
echo
echo "Optional (DESTRUCTIVE — deletes all point balances):"
echo "  run rewards-teardown.sql in the Supabase SQL editor"
echo "─────────────────────────────────────────────"
