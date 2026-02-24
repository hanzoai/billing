import type { AuthServiceConf } from '@hanzo/auth'
import type { BillingOrgConfig } from './config'

export function makeAuthConf(org: BillingOrgConfig): AuthServiceConf {
  return {
    iamServerUrl: org.iamServerUrl,
    iamClientId: org.iamClientId,
    iamRedirectUri: typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : '',
    iamOrgName: org.id,
    iamAppName: `billing-${org.id}`,
  }
}
