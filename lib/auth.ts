import type { IamAuthConfig } from './iam-auth'
import type { BillingOrgConfig } from './config'

export function makeAuthConf(org: BillingOrgConfig): IamAuthConfig {
  return {
    iamServerUrl: org.iamServerUrl,
    clientId: org.iamClientId,
    redirectUri: typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : '',
    orgName: org.id,
    appName: `billing-${org.id}`,
  }
}
