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
