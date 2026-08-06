import type { SubscriptionPlan } from './billing/types'
import { SALES_URL } from './config'

/**
 * Public plan catalog — the ONE logged-out source of pricing.
 *
 * The commerce catalog (GET /v1/billing/plans on commerce-api) is IAM-gated and
 * 403s logged-out, so a prospect hitting the pricing grid without a session used
 * to land on a login wall. The same @hanzo/plans catalog is served publicly by
 * cloud, but the direct cloud host (api.cloud.hanzo.ai/v1/plans/subscriptions)
 * emits NO Access-Control-Allow-Origin — a cross-origin browser fetch from
 * billing.hanzo.ai is blocked. The gateway (api.hanzo.ai) proxies the identical
 * route, is public (200 unauthenticated), AND returns
 * `access-control-allow-origin: https://billing.hanzo.ai`, so it is the correct
 * browser-facing source. Prices here are in DOLLARS (priceMonthly: 20), unlike
 * commerce's cents.
 */
export const PUBLIC_PLANS_URL = 'https://api.hanzo.ai/v1/plans/subscriptions'

// Subscription tiers shown on the pricing grid (the catalog also carries
// world/social plans, which have their own product surfaces).
const PLAN_CATEGORIES = new Set(['personal', 'team', 'enterprise'])

interface PublicPlan {
  id?: string
  name?: string
  description?: string
  category?: string
  priceMonthly?: number // DOLLARS (0 = free)
  priceAnnual?: number // DOLLARS per month billed annually
  currency?: string
  features?: string[]
  limits?: Record<string, number | null | undefined>
  popular?: boolean
  contactSales?: boolean
  trialPeriodDays?: number
  price_ref?: { recurring?: { per_seat?: boolean } }
}

function mapPublicPlan(p: PublicPlan): SubscriptionPlan {
  const limits: Record<string, number> = {}
  for (const [k, v] of Object.entries(p.limits ?? {})) {
    if (typeof v === 'number') limits[k] = v
  }
  const perSeat = p.price_ref?.recurring?.per_seat ?? p.category === 'team'
  // A tier with NO price is sold by a person, whether or not the catalog also
  // flags it. Deriving it here is what keeps the fact alive past `?? 0` below —
  // otherwise a plan priced `null` and unflagged reaches the cards as a zero and
  // renders as "Free".
  const sold = !!p.contactSales || p.priceMonthly == null
  return {
    id: p.id ?? '',
    name: p.name ?? '',
    description: p.description ?? '',
    // A tier sold by a person has NO price, and `?? 0` erased that distinction:
    // Enterprise arrives as `priceMonthly: null` and every downstream reader
    // then saw a zero, which renders as "Free". The zero is kept — the shape
    // wants a number — but `contactSales` below carries the fact that survives
    // it, and every price-rendering site asks that FIRST.
    price: p.priceMonthly ?? 0,
    annualPrice: p.priceAnnual || undefined,
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
    perSeat,
    // commerce rejects fewer than 2 seats on per-seat tiers; the selector floor
    // matches so the public grid can't propose an amount the checkout refuses.
    minSeats: perSeat ? limits.minSeats ?? 2 : undefined,
  }
}

/** Fetch and project the public catalog onto the pricing-grid plan shape. */
export async function fetchPublicPlans(): Promise<SubscriptionPlan[]> {
  const res = await fetch(PUBLIC_PLANS_URL, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`plan catalog HTTP ${res.status}`)
  const data = (await res.json()) as { plans?: PublicPlan[] }
  const plans = Array.isArray(data.plans) ? data.plans : []
  return plans.filter((p) => PLAN_CATEGORIES.has(p.category ?? '')).map(mapPublicPlan)
}
