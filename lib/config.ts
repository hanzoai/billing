// SPDX-License-Identifier: Apache-2.0

// Base path configuration: standalone builds (billing.hanzo.ai) serve at root,
// while embedded builds (/admin/billing) set NEXT_PUBLIC_BASE_PATH.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

/**
 * The unified Hanzo API endpoint (never a fragmented per-service host).
 */
export const COMMERCE_URL = process.env.NEXT_PUBLIC_COMMERCE_URL ?? 'https://api.hanzo.ai'

/**
 * Direct sales booking calendar.
 */
export const SALES_URL = 'https://cal.hanzo.ai/'

export interface BillingOrgConfig {
  id: string
  displayName: string
  iamServerUrl: string
  iamClientId: string
  commerceUrl: string
  payUrl: string
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
  commerceUrl: COMMERCE_URL,
  payUrl: 'https://pay.hanzo.ai',
  logo: '/logos/hanzo.svg',
  theme: {
    brand: '#ffffff',
    brandHover: '#d4d4d4',
  },
}

const lux: BillingOrgConfig = {
  id: 'lux',
  displayName: 'Lux',
  iamServerUrl: 'https://lux.id',
  iamClientId: 'lux-billing',
  commerceUrl: COMMERCE_URL,
  payUrl: 'https://pay.lux.cloud',
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
  commerceUrl: COMMERCE_URL,
  payUrl: 'https://pay.zoo.cloud',
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
  commerceUrl: COMMERCE_URL,
  payUrl: 'https://pay.hanzo.ai',
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
