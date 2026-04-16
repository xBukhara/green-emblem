// lib/donations.ts
// Handles donation routing to Share The Meal and impact calculations.
// KEY DESIGN: We never touch the money. We log intent, redirect to STM,
// then mark as confirmed when they return to our success page.

const COST_PER_MEAL = parseFloat(process.env.COST_PER_MEAL || '0.80')
const STM_BASE_URL = process.env.SHARE_THE_MEAL_DONATE_URL || 'https://sharethemeal.org/donate'

// ─── Build the Share The Meal redirect URL ────────────────────────────────────
// Share The Meal supports ?amount=XX in USD on their donate page.
// The donor lands on STM's own checkout — no Stripe fees on our end.
export function buildShareTheMealUrl(amountUsd: number): string {
  const url = new URL(STM_BASE_URL)
  // STM accepts amount in dollars
  url.searchParams.set('amount', amountUsd.toFixed(2))
  // UTM tracking so STM can attribute to Green Emblem
  url.searchParams.set('utm_source', 'green-emblem')
  url.searchParams.set('utm_medium', 'event-campaign')
  url.searchParams.set('utm_campaign', 'baab-as-sadaqah')
  return url.toString()
}

// ─── Calculate impact from donation amount ────────────────────────────────────
export function calculateImpact(amountUsd: number): {
  meals: number
  waterDays: number
  description: string
} {
  const meals = Math.floor(amountUsd / COST_PER_MEAL)

  // Rough impact equivalents for the dashboard
  // These are approximate and based on Share The Meal's published metrics
  const waterDays = Math.floor(amountUsd / 2.5)   // ~$2.50/day clean water (UNICEF approx)

  return {
    meals,
    waterDays,
    description: meals === 1
      ? '1 meal provided to a child in need'
      : `${meals} meals provided to children in need`,
  }
}

// ─── Charity options shown in the 3-tab UI ────────────────────────────────────
export const CHARITY_OPTIONS = [
  {
    id: 'share_the_meal',
    name: 'Share The Meal',
    description: 'WFP\'s mobile app — feeds children worldwide. ~$0.80 per meal.',
    impact_metric: 'meals',
    impact_rate: COST_PER_MEAL,
    impact_unit: 'meal',
    color: '#C9A96E',
    url: STM_BASE_URL,
    buildUrl: buildShareTheMealUrl,
    is_default: true,
  },
  {
    id: 'islamic_relief',
    name: 'Islamic Relief USA',
    description: 'Emergency aid, clean water, orphan care, and education.',
    impact_metric: 'aid',
    impact_rate: 1,
    impact_unit: 'dollar of relief',
    color: '#1D9E75',
    url: 'https://irusa.org/donate/',
    buildUrl: (amount: number) => {
      const url = new URL('https://irusa.org/donate/')
      url.searchParams.set('amount', amount.toFixed(2))
      return url.toString()
    },
    is_default: false,
  },
  {
    id: 'unicef',
    name: 'UNICEF USA',
    description: 'Children\'s health, nutrition, education, and protection worldwide.',
    impact_metric: 'children',
    impact_rate: 1,
    impact_unit: 'dollar to child welfare',
    color: '#378ADD',
    url: 'https://www.unicefusa.org/donate',
    buildUrl: (amount: number) => {
      const url = new URL('https://www.unicefusa.org/donate')
      url.searchParams.set('amount', amount.toFixed(2))
      return url.toString()
    },
    is_default: false,
  },
] as const

export type CharityId = typeof CHARITY_OPTIONS[number]['id']

export function getCharityById(id: CharityId) {
  return CHARITY_OPTIONS.find(c => c.id === id) || CHARITY_OPTIONS[0]
}

export function buildCharityUrl(charityId: CharityId, amountUsd: number): string {
  const charity = getCharityById(charityId)
  return charity.buildUrl(amountUsd)
}

// ─── Aggregate campaign stats ─────────────────────────────────────────────────
export function aggregateCampaignStats(donations: Array<{ amount: number; charity: string; confirmed: boolean }>) {
  const confirmed = donations.filter(d => d.confirmed)
  const totalRaised = confirmed.reduce((sum, d) => sum + d.amount, 0)
  const stmDonations = confirmed.filter(d => d.charity === 'share_the_meal')
  const stmTotal = stmDonations.reduce((sum, d) => sum + d.amount, 0)
  const mealsTotal = Math.floor(stmTotal / COST_PER_MEAL)

  return {
    totalRaised,
    donorCount: confirmed.length,
    mealsTotal,
    byCharity: {
      share_the_meal: stmTotal,
      islamic_relief: confirmed.filter(d => d.charity === 'islamic_relief').reduce((s, d) => s + d.amount, 0),
      unicef: confirmed.filter(d => d.charity === 'unicef').reduce((s, d) => s + d.amount, 0),
    },
  }
}
