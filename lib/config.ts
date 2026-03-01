import type { SubscriptionPlan } from './billing/types'

export interface BillingOrgConfig {
  id: string
  displayName: string
  iamServerUrl: string
  iamClientId: string
  commerceUrl: string
  logo: string
  theme: {
    brand: string
    brandHover: string
  }
}

const hanzo: BillingOrgConfig = {
  id: 'hanzo',
  displayName: 'Hanzo',
  iamServerUrl: 'https://hanzo.id',
  iamClientId: 'app-hanzo',
  commerceUrl: 'https://api.hanzo.ai',
  logo: '/logos/hanzo.svg',
  theme: {
    brand: '#ffffff',
    brandHover: '#d4d4d4',
  },
}

/** Emails with admin/super-user billing access (can grant credits to anyone). */
const ADMIN_EMAILS = [
  'admin@hanzo.ai',
  'zach@hanzo.ai',
  'ant@hanzo.ai',
]

const organizations: Record<string, BillingOrgConfig> = { hanzo }

export function getOrgByHost(host: string): BillingOrgConfig {
  for (const [, org] of Object.entries(organizations)) {
    if (host.includes(org.id)) return org
  }
  return hanzo
}

export function isAdminUser(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

/** Canonical Hanzo subscription plans with feature lists. */
export const HANZO_PLANS: SubscriptionPlan[] = [
  {
    id: 'developer',
    name: 'Developer',
    description: 'Free to start. $5 credit included — no card required.',
    price: 0,
    billingPeriod: 'monthly',
    currency: 'usd',
    trialCreditCents: 500,
    features: [
      '$5 free AI credit to start',
      'Access to all Zen AI models',
      '60 requests/min',
      '100K tokens/min',
      'API + chat access',
      'Community support',
      'Pay-as-you-go after credit',
    ],
    limits: {
      requestsPerMinute: 60,
      tokensPerMinute: 100_000,
    },
  },
  {
    id: 'unified-ai',
    name: 'Unified AI',
    description: 'Full access to all Hanzo AI — chat, API, agents, and models. 7-day free trial.',
    price: 20,
    annualPrice: 200,
    billingPeriod: 'monthly',
    currency: 'usd',
    highlighted: true,
    badge: '7-Day Free Trial',
    trialDays: 7,
    trialCreditCents: 500,
    features: [
      '7-day free trial + $5 credit',
      'All 14+ Zen AI models (up to 1M ctx)',
      'Unlimited chat at chat.hanzo.ai',
      'MCP tools + agent access',
      '500 requests/min',
      '2M tokens/min',
      'Priority inference',
      'Email support',
      'Usage analytics',
      '$200/yr (save $40)',
    ],
    limits: {
      requestsPerMinute: 500,
      tokensPerMinute: 2_000_000,
    },
  },
  {
    id: 'team',
    name: 'Team',
    description: 'Collaborate with your team. Includes hanzo.team workspace access.',
    price: 25,
    billingPeriod: 'monthly',
    currency: 'usd',
    badge: 'Includes hanzo.team',
    trialDays: 7,
    trialCreditCents: 500,
    externalUrl: 'https://hanzo.team',
    features: [
      'Everything in Unified AI',
      'hanzo.team workspace included',
      'Shared team credits & billing',
      'Up to 25 members',
      'Team usage analytics',
      'SSO / SAML',
      'Priority support',
      'Custom model fine-tuning',
      '5M tokens/min',
      '$25/mo per seat',
    ],
    limits: {
      requestsPerMinute: 2_000,
      tokensPerMinute: 5_000_000,
      maxMembers: 25,
    },
  },
  {
    id: 'agency',
    name: 'Agency',
    description: 'Full-scale AI infrastructure for agencies. Starts at $9,999/mo at hanzo.agency.',
    price: 9999,
    billingPeriod: 'monthly',
    currency: 'usd',
    badge: 'Contact Sales',
    contactSales: true,
    externalUrl: 'https://cal.com/hanzo',
    features: [
      'Everything in Team',
      'hanzo.agency white-label suite',
      'Unlimited members',
      '99.99% SLA guarantee',
      'Dedicated account manager',
      'Custom rate limits & quotas',
      'On-premise / air-gapped deployment',
      'SOC 2 Type II compliance',
      'Custom model training & hosting',
      '24/7 engineering support',
      'White-glove onboarding',
    ],
    limits: {
      requestsPerMinute: 50_000,
      tokensPerMinute: 100_000_000,
    },
  },
]

/**
 * Merge server-side plans from Commerce API with local feature definitions.
 * Commerce API returns pricing/interval but not features; local config has features.
 */
export function mergePlans(commercePlans: SubscriptionPlan[], localPlans: SubscriptionPlan[] = HANZO_PLANS): SubscriptionPlan[] {
  if (commercePlans.length === 0) return localPlans

  return localPlans.map((local) => {
    const remote = commercePlans.find((p) => p.id === local.id || p.name === local.name)
    if (remote) {
      return {
        ...local,
        price: remote.price || local.price,
        billingPeriod: remote.billingPeriod || local.billingPeriod,
        currency: remote.currency || local.currency,
        priceId: remote.priceId || local.priceId,
      }
    }
    return local
  })
}
