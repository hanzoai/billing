import { getCommerce } from './commerce'
import type { Plan } from './commerce-client'
import { SALES_URL } from './config'
import type { SubscriptionPlan } from './billing/types'

/**
 * The plan catalog — ONE source, ONE unit, ONE projection.
 *
 * There used to be two. This file read a second catalog
 * (api.hanzo.ai/v1/plans/subscriptions, prices in DOLLARS) on the stated grounds
 * that "the commerce catalog is IAM-gated and 403s logged-out", and the shell read
 * commerce's (prices in CENTS) with its own projection beside it. The premise was
 * false — measured against production, GET /v1/billing/plans answers 200
 * unauthenticated on api.hanzo.ai and returns
 * `access-control-allow-origin: https://billing.hanzo.ai` — and the cost of the
 * split was real: two unit conventions on one screen, two projections that each
 * promised in a comment to mirror the other, and a live divergence in how they
 * decided a tier was per-seat.
 *
 * So the logged-out grid and the signed-in grid now read the same rows through the
 * same function. `token` is optional because the catalog is public; passing one
 * changes nothing about what comes back.
 */

// Subscription tiers shown on the pricing grid (the catalog also carries dns and
// world/social plans, which have their own product surfaces).
const PLAN_CATEGORIES = new Set(['personal', 'team', 'enterprise'])

/**
 * Project a commerce catalog plan (prices in CENTS) onto the card the portal
 * renders. The catalog is the ONE source of plan copy — features, prices, tiers.
 */
export function mapCommercePlan(p: Plan): SubscriptionPlan {
  const limits: Record<string, number> = {}
  for (const [k, v] of Object.entries(p.limits ?? {})) {
    if (typeof v === 'number') limits[k] = v
  }
  // The catalog answers per-seat-ness directly; `category === 'team'` is only the
  // fallback for a row that does not say. Inferring it from the category alone put
  // a per-seat flag on the wrong tier the day a per-seat personal plan is added.
  const perSeat = p.perSeat ?? p.category === 'team'
  // A tier with NO price is sold by a person even when the catalog forgets to flag
  // it. Deriving it here is what keeps the fact alive past the `?? 0` below —
  // otherwise a plan priced `null` and unflagged reaches the cards as a zero and
  // renders as "Free".
  const sold = !!p.contactSales || p.price == null
  return {
    id: p.slug ?? '',
    name: p.name ?? '',
    description: p.description ?? '',
    price: (p.price ?? 0) / 100,
    annualPrice: p.priceAnnual ? p.priceAnnual / 100 : undefined,
    category: p.category,
    billingPeriod: 'monthly',
    currency: p.currency ?? 'usd',
    features: p.features ?? [],
    limits,
    highlighted: p.popular,
    badge: sold ? 'Contact Sales' : p.popular ? 'Popular' : undefined,
    contactSales: sold,
    externalUrl: sold ? SALES_URL : undefined,
    trialDays: p.trialPeriodDays || undefined,
    trialCreditCents: limits.freeCredit ? limits.freeCredit * 100 : undefined,
    perSeat,
    promoPercent: p.promoPercent || undefined,
    // minSeats comes from the catalog; commerce rejects fewer than 2 seats on
    // per-seat tiers, so the selector enforces the same floor and the grid can
    // never propose an amount the checkout refuses.
    minSeats: perSeat ? limits.minSeats ?? 2 : undefined,
  }
}

/** The subscription tiers of a raw catalog, projected onto the card shape. */
export function selectPlans(rows: Plan[]): SubscriptionPlan[] {
  return rows.filter((p) => PLAN_CATEGORIES.has(p.category ?? '')).map(mapCommercePlan)
}

/** Fetch the catalog and project it onto the pricing-grid plan shape. */
export async function fetchPlans(commerceUrl: string, token?: string): Promise<SubscriptionPlan[]> {
  return selectPlans(await getCommerce(commerceUrl, token).getPlans(token))
}
