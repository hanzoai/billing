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
    description: 'Get started for free. $5 credit included — no card required.',
    price: 0,
    billingPeriod: 'monthly',
    currency: 'usd',
    trialCreditCents: 500,
    features: [
      '$5 free credit to start',
      '60 requests/min',
      '100K tokens/min',
      'Community support',
      'API access',
      'Earn up to 20% on idle compute & LLM resale',
    ],
    limits: {
      requestsPerMinute: 60,
      tokensPerMinute: 100_000,
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For developers shipping real products. 7-day free trial with $5 credit.',
    price: 49,
    billingPeriod: 'monthly',
    currency: 'usd',
    highlighted: true,
    badge: '7-Day Free Trial',
    trialDays: 7,
    trialCreditCents: 500,
    features: [
      '7-day free trial + $5 credit',
      '500 requests/min',
      '1M tokens/min',
      'Email support',
      'Analytics dashboard',
      'Priority inference',
      'Earn up to 20% on idle compute & LLM resale',
    ],
    limits: {
      requestsPerMinute: 500,
      tokensPerMinute: 1_000_000,
    },
  },
  {
    id: 'team',
    name: 'Team',
    description: 'For teams building together. 7-day free trial with $5 credit.',
    price: 199,
    billingPeriod: 'monthly',
    currency: 'usd',
    trialDays: 7,
    trialCreditCents: 500,
    features: [
      '7-day free trial + $5 credit',
      'Up to 10 members',
      'SSO / SAML',
      'Priority support',
      'Custom model training',
      'Shared billing',
      'Usage analytics',
      'Earn up to 20% on idle compute & LLM resale',
    ],
    limits: {
      requestsPerMinute: 2_000,
      tokensPerMinute: 5_000_000,
      maxMembers: 10,
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Full-scale AI infrastructure. 7-day free trial with $5 credit.',
    price: 9999,
    billingPeriod: 'monthly',
    currency: 'usd',
    trialDays: 7,
    trialCreditCents: 500,
    features: [
      '7-day free trial + $5 credit',
      'Unlimited members',
      '99.99% SLA',
      'Dedicated account manager',
      'Custom rate limits',
      'On-premise deployment',
      'SOC 2 compliance',
      'Custom model fine-tuning',
      'Priority inference across all models',
      'Earn up to 20% on idle compute & LLM resale',
    ],
    limits: {
      requestsPerMinute: 50_000,
      tokensPerMinute: 100_000_000,
    },
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Need more? We\'ll build a plan around your infrastructure, compliance, and scale requirements.',
    price: 0,
    billingPeriod: 'monthly',
    currency: 'usd',
    features: [
      'Everything in Enterprise',
      'Custom SLA (up to 99.999%)',
      'Dedicated compute cluster',
      'Air-gapped / on-prem deployment',
      'Custom model training & hosting',
      'White-glove onboarding',
      '24/7 engineering support',
      'Earn up to 20% on idle compute & LLM resale',
    ],
    limits: {
      requestsPerMinute: -1,
      tokensPerMinute: -1,
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
