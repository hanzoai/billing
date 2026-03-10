import type { SubscriptionPlan } from '@hanzo/ui/billing'

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

const lux: BillingOrgConfig = {
  id: 'lux',
  displayName: 'Lux',
  iamServerUrl: 'https://lux.id',
  iamClientId: 'app-lux',
  commerceUrl: 'https://api.hanzo.ai',
  logo: '/logos/lux.svg',
  theme: {
    brand: '#6366f1',
    brandHover: '#4f46e5',
  },
}

const zoo: BillingOrgConfig = {
  id: 'zoo',
  displayName: 'Zoo',
  iamServerUrl: 'https://zoo.id',
  iamClientId: 'app-zoo',
  commerceUrl: 'https://api.hanzo.ai',
  logo: '/logos/zoo.svg',
  theme: {
    brand: '#22c55e',
    brandHover: '#16a34a',
  },
}

const pars: BillingOrgConfig = {
  id: 'pars',
  displayName: 'Pars',
  iamServerUrl: 'https://pars.id',
  iamClientId: 'app-pars',
  commerceUrl: 'https://api.hanzo.ai',
  logo: '/logos/pars.svg',
  theme: {
    brand: '#f59e0b',
    brandHover: '#d97706',
  },
}

const organizations: Record<string, BillingOrgConfig> = { hanzo, lux, zoo, pars }

export function getOrgByHost(host: string): BillingOrgConfig {
  if (host.includes('lux')) return lux
  if (host.includes('zoo')) return zoo
  if (host.includes('pars')) return pars
  return hanzo
}

export function isAdminUser(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

/**
 * Canonical Hanzo subscription plans — aligned with @hanzo/plans/subscription.json.
 * Source of truth: ~/work/hanzo/plans/subscription.json
 * IDs: developer, pro, team, enterprise, custom
 */
export const HANZO_PLANS: SubscriptionPlan[] = [
  {
    id: 'developer',
    name: 'Developer',
    description: 'Get started for free. Explore the API with generous included credits.',
    price: 0,
    billingPeriod: 'monthly',
    currency: 'usd',
    trialCreditCents: 500,
    features: [
      '$5 free credit',
      '60 requests/min',
      '100K tokens/min',
      'Community support',
      'API access',
      'Earn up to 20% on idle compute & LLM resale',
    ],
    limits: {
      requestsPerMinute: 60,
      tokensPerMinute: 100_000,
      freeCredit: 5,
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For developers shipping real products. Higher limits and priority support.',
    price: 49,
    annualPrice: 39,
    billingPeriod: 'monthly',
    currency: 'usd',
    highlighted: true,
    features: [
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
    description: 'For teams building together. SSO, shared billing, and custom training.',
    price: 199,
    annualPrice: 159,
    billingPeriod: 'monthly',
    currency: 'usd',
    features: [
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
    description: 'Full-scale AI infrastructure. Dedicated support, SLA, and on-prem deployment.',
    price: 9999,
    annualPrice: 7999,
    billingPeriod: 'monthly',
    currency: 'usd',
    badge: 'Contact Sales',
    contactSales: true,
    externalUrl: 'https://cal.com/hanzo',
    features: [
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
    contactSales: true,
    externalUrl: 'https://cal.com/hanzo',
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
