// Type declarations for @hanzo/ui modules that ship without .d.ts
declare module '@hanzo/ui/billing' {
  import type { FC, ReactNode } from 'react'

  export type BillingSection =
    | 'overview' | 'usage' | 'cost' | 'invoices' | 'pricing'
    | 'credits' | 'transactions' | 'alerts' | 'payment' | 'members'
    | 'business' | 'tax' | 'team' | 'settings'

  export interface BillingAccount {
    id: string
    name: string
    orgId?: string
    [key: string]: any
  }

  export interface BillingAccountMember {
    id: string
    email: string
    role: string
    [key: string]: any
  }

  export type BillingRole = 'owner' | 'admin' | 'member' | 'viewer'

  export interface Subscription {
    id: string
    planId: string
    status: string
    [key: string]: any
  }

  export interface SubscriptionPlan {
    id: string
    name: string
    price: number
    [key: string]: any
  }

  export interface PaymentMethod {
    id: string
    type: string
    last4?: string
    [key: string]: any
  }

  export interface Invoice {
    id: string
    amount: number
    status: string
    [key: string]: any
  }

  export interface BusinessProfile {
    name?: string
    address?: any
    taxId?: string
    [key: string]: any
  }

  export interface TaxSettings {
    [key: string]: any
  }

  export interface ComplianceItem {
    [key: string]: any
  }

  export interface SpendAlert {
    id: string
    threshold: number
    [key: string]: any
  }

  export interface UsageSummary {
    [key: string]: any
  }

  export interface DiscountCode {
    code: string
    [key: string]: any
  }

  export interface CreditGrant {
    id: string
    amountCents: number
    remainingCents: number
    [key: string]: any
  }

  export interface TransactionRecord {
    id: string
    amountCents: number
    type: string
    [key: string]: any
  }

  export const OverviewDashboard: FC<any>
  export const UsagePanel: FC<any>
  export const CostExplorer: FC<any>
  export const InvoicesPayments: FC<any>
  export const SubscriptionPortal: FC<any>
  export const CreditsPanel: FC<any>
  export const TransactionsPanel: FC<any>
  export const SpendAlertsPanel: FC<any>
  export const PaymentMethodManager: FC<any>
  export const AccountMembers: FC<any>
  export const BusinessProfilePanel: FC<any>
  export const TaxCompliancePanel: FC<any>
}

declare module '@hanzo/ui/team' {
  import type { FC } from 'react'

  export type TeamApp = 'billing' | 'console' | 'org'
  export type TeamTier = 'viewer' | 'admin' | 'owner'
  export type RoleKey =
    | 'billing:viewer' | 'billing:admin'
    | 'console:viewer' | 'console:admin' | 'console:owner'
    | 'org:owner'

  export interface TeamManagementProps {
    app: TeamApp
    org: string
    currentUserRoles: string[]
    isGlobalAdmin?: boolean
    apiBase?: string
    getToken?: () => string | Promise<string> | undefined
    onError?: (err: Error) => void
    title?: string
  }
  export const TeamManagement: FC<TeamManagementProps>

  export interface TeamMember {
    id: string
    email: string
    name: string
    roleKey: RoleKey
    addedAt: string
  }
  export class TeamClient {
    constructor(opts: { org: string; apiBase?: string; getToken?: () => string | Promise<string> | undefined; fetchImpl?: typeof fetch })
    listMembers(app: TeamApp): Promise<TeamMember[]>
    invite(app: TeamApp, email: string, roleKey: RoleKey): Promise<void>
    changeRole(app: TeamApp, memberId: string, newRoleKey: RoleKey): Promise<void>
    remove(app: TeamApp, memberId: string): Promise<void>
  }

  export function assignableKeysForApp(callerKeys: readonly string[], app: TeamApp, isGlobalAdmin?: boolean): RoleKey[]
  export function canManageApp(callerKeys: readonly string[], app: TeamApp, isGlobalAdmin?: boolean): boolean
}

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
