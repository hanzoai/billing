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
  iamClientId: 'hanzo-app-client-id',
  commerceUrl: 'https://commerce.hanzo.ai',
  logo: '/logos/hanzo.svg',
  theme: {
    brand: '#fd4444',
    brandHover: '#e03e3e',
  },
}

const organizations: Record<string, BillingOrgConfig> = { hanzo }

export function getOrgByHost(host: string): BillingOrgConfig {
  for (const [, org] of Object.entries(organizations)) {
    if (host.includes(org.id)) return org
  }
  return hanzo
}
