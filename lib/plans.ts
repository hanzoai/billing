// SPDX-License-Identifier: Apache-2.0

import { getCommerce } from './commerce'
import type { Plan } from './commerce-client'
import { SALES_URL } from './config'
import type { SubscriptionPlan } from './billing/types'

// Subscription tiers shown on the pricing grid.
const PLAN_CATEGORIES = new Set(['personal', 'team', 'enterprise'])

export const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'For individuals exploring sovereign AI and local workflows.',
    price: 0,
    category: 'personal',
    billingPeriod: 'monthly',
    currency: 'usd',
    features: [
      'Unlimited local model access',
      'Up to 5 concurrent agent sandboxes',
      'Community support & documentation',
      'Standard vector index cache',
    ],
    limits: { sandboxes: 5, seats: 1 },
  },
  {
    id: 'developer',
    name: 'Developer',
    description: 'For power developers and independent AI builders.',
    price: 20,
    annualPrice: 16,
    category: 'personal',
    billingPeriod: 'monthly',
    currency: 'usd',
    highlighted: true,
    badge: 'Popular',
    features: [
      'Access to SOTA cloud models & reasoning APIs',
      'Sub-10ms microVM execution sandboxes',
      '50GB persistent NVMe storage',
      'Hardware KMS envelope encryption',
      'Full MCP & REST API access',
    ],
    limits: { sandboxes: 20, seats: 1 },
  },
  {
    id: 'team',
    name: 'Team',
    description: 'For engineering teams and autonomous agent swarms.',
    price: 49,
    annualPrice: 39,
    category: 'team',
    billingPeriod: 'monthly',
    currency: 'usd',
    perSeat: true,
    minSeats: 2,
    features: [
      'Shared multi-agent swarm workspaces',
      'Centralized team billing & virtual card spend limits',
      'Tamper-evident Merkle audit logs',
      'Priority GPU routing & custom microVM quotas',
      'Dedicated Slack & Discord channel',
    ],
    limits: { sandboxes: 100, seats: 2 },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom on-prem, dedicated hardware, and compliance isolation.',
    price: 0,
    category: 'enterprise',
    billingPeriod: 'monthly',
    currency: 'usd',
    contactSales: true,
    badge: 'Contact Sales',
    externalUrl: SALES_URL,
    features: [
      'Air-gapped on-premise & sovereign cluster deployments',
      'Custom SLA & 99.99% uptime guarantee',
      'Dedicated HSM keys & SOC2/HIPAA compliance',
      '24/7 technical engineering support & custom fine-tuning',
    ],
    limits: { sandboxes: 1000, seats: 10 },
  },
]

/**
 * Project a commerce catalog plan (prices in CENTS) onto the card the portal renders.
 */
export function mapCommercePlan(p: Plan): SubscriptionPlan {
  const limits: Record<string, number> = {}
  for (const [k, v] of Object.entries(p.limits ?? {})) {
    if (typeof v === 'number') limits[k] = v
  }
  const perSeat = p.perSeat ?? p.category === 'team'
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
    minSeats: perSeat ? limits.minSeats ?? 2 : undefined,
  }
}

/** The subscription tiers of a raw catalog, projected onto the card shape. */
export function selectPlans(rows: Plan[]): SubscriptionPlan[] {
  return rows.filter((p) => PLAN_CATEGORIES.has(p.category ?? '')).map(mapCommercePlan)
}

/** Fetch the catalog and project it onto the pricing-grid plan shape. */
export async function fetchPlans(commerceUrl: string, token?: string): Promise<SubscriptionPlan[]> {
  try {
    const plans = await getCommerce(commerceUrl, token).getPlans(token)
    const selected = selectPlans(plans)
    if (selected.length > 0) return selected
    return DEFAULT_PLANS
  } catch {
    return DEFAULT_PLANS
  }
}
