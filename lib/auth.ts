import type { IamAuthConfig } from './iam-auth'
import type { BillingOrgConfig } from './config'

function getBasePath(): string {
  if (typeof window === 'undefined') return ''
  // Detect basePath from current URL (handles GitHub Pages /billing/ prefix)
  const path = window.location.pathname
  // If path starts with /billing, we're on GitHub Pages
  if (path.startsWith('/billing')) return '/billing'
  return ''
}

export function makeAuthConf(org: BillingOrgConfig): IamAuthConfig {
  const basePath = getBasePath()
  return {
    iamServerUrl: org.iamServerUrl,
    clientId: org.iamClientId,
    redirectUri: typeof window !== 'undefined'
      ? `${window.location.origin}${basePath}/auth/callback`
      : '',
    orgName: org.id,
    appName: 'app-hanzo',
  }
}
