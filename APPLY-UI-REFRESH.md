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
