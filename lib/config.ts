// Same deploy-shape selection as next.config.ts: embedded build serves under
// /admin/billing, standalone (billing.hanzo.ai) builds with NEXT_PUBLIC_BASE_PATH="".
// Raw <a href> / window.location targets must carry it themselves.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/admin/billing'

/**
 * Where a tier that is sold by a person sends the buyer.
 *
 * ONE address, because it was written in two files and a third surface linked
 * somewhere else entirely — so "talk to sales" meant three destinations. Moving
 * it is one edit here.
 */
export const SALES_URL = 'https://cal.com/hanzo'

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
  iamClientId: 'hanzo-billing',
  commerceUrl: 'https://commerce-api.hanzo.ai',
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
  iamClientId: 'lux-billing',
  commerceUrl: 'https://commerce-api.hanzo.ai',
  logo: '/logos/lux.svg',
  theme: {
    brand: '#6366f1',
    brandHover: '#4f46e5',
  },
}

const zoo: BillingOrgConfig = {
  id: 'zoo',
  displayName: 'Zoo',
  iamServerUrl: 'https://zoolabs.id',
  iamClientId: 'zoo-billing',
  commerceUrl: 'https://commerce-api.hanzo.ai',
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
  iamClientId: 'pars-billing',
  commerceUrl: 'https://commerce-api.hanzo.ai',
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
 * Plan copy lives in ONE place: the commerce catalog (GET /v1/billing/plans,
 * projected from @hanzo/plans/subscription.json). The SPA fetches it at
 * runtime and renders a skeleton until it arrives — no local plan table.
 */
