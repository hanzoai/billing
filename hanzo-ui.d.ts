// Type declarations for @hanzo/ui modules that ship without .d.ts.
// NOTE: '@hanzo/ui/billing' is deliberately absent — billing surfaces come from
// the local `lib/billing` barrel (real types), never the published bundle.
declare module '@hanzo/ui/navigation/hanzo-shell' {
  export type OrgDomains = {
    id: string
    iam: string
    billing: string
    console: string
    chat: string
    platform: string
    storage: string
    s3: string
  }

  export const ORG_DOMAINS: Record<string, OrgDomains>
  export function getAppsForOrg(orgSlug: string): any[]

  export const HanzoHeader: import('react').FC<any>
  export const HanzoMark: import('react').FC<any>
  export const AppSwitcher: import('react').FC<any>
  export const UserOrgDropdown: import('react').FC<any>
  export function useHanzoAuth(): any
  export const HanzoCommandPalette: import('react').FC<any>

  export const DEFAULT_HANZO_APPS: any[]

  export type HanzoApp = { name: string; href: string; icon?: any; description?: string }
  export type HanzoOrg = { id: string; displayName: string; slug: string }
  export type HanzoUser = { sub: string; name?: string; email?: string; avatar?: string }
  export type HanzoShellProps = Record<string, any>
  export type HanzoMarkProps = Record<string, any>
}
