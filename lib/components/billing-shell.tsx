'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  OverviewDashboard,
  UsagePanel,
  CostExplorer,
  InvoicesPayments,
  SubscriptionPortal,
  CreditsPanel,
  TransactionsPanel,
  SpendAlertsPanel,
  PaymentMethodManager,
  AccountMembers,
  BusinessProfilePanel,
  TaxCompliancePanel,
} from '@hanzo/ui/billing'
import type { BillingSection } from '@hanzo/ui/billing'
import type {
  BillingAccount,
  BillingAccountMember,
  BillingRole,
  Subscription,
  SubscriptionPlan,
  PaymentMethod,
  Invoice,
  BusinessProfile,
  TaxSettings,
  ComplianceItem,
  SpendAlert,
  UsageSummary,
  DiscountCode,
  CreditGrant,
  TransactionRecord,
} from '@hanzo/ui/billing'
import type { Balance, CommerceBillingAccount, CommerceBillingAccountMember, CommerceInvoice, CommercePaymentMethod, CommerceSpendAlert, CommerceCreditGrant, Transaction, Plan, Subscription as CommerceSubscription } from '@/lib/commerce-client'
import type { IamUser } from '@/lib/iam-auth'
import { getAccessToken, logout } from '@/lib/iam-auth'
import { type BillingOrgConfig, isAdminUser, HANZO_PLANS, mergePlans } from '@/lib/config'
import { getCommerce } from '@/lib/commerce'

import { ORG_DOMAINS } from '@hanzo/ui/navigation/hanzo-shell'
type OrgDomains = { iam: string; console: string; chat: string; platform: string; storage: string; billing: string }

/* ── Sidebar section config ───────────────────────────────────── */
const SIDEBAR_SECTIONS: Array<{ id: BillingSection; label: string; icon: React.ReactNode; group: 'main' | 'manage' }> = [
  { id: 'overview', label: 'Overview', group: 'main', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg> },
  { id: 'usage', label: 'Usage', group: 'main', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 5-9" /></svg> },
  { id: 'invoices', label: 'Invoices', group: 'main', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h4" /></svg> },
  { id: 'pricing', label: 'Pricing', group: 'main', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /></svg> },
  { id: 'credits', label: 'Credits', group: 'main', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /><path d="M16.71 13.88l.7.71-2.82 2.82" /></svg> },
  { id: 'transactions', label: 'Transactions', group: 'main', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3l4 4-4 4" /><path d="M3 11h18" /><path d="M7 21l-4-4 4-4" /><path d="M21 13H3" /></svg> },
  { id: 'alerts', label: 'Budgets & Alerts', group: 'manage', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg> },
  { id: 'payment', label: 'Payment Methods', group: 'manage', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg> },
  { id: 'team', label: 'Team', group: 'manage', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
  { id: 'settings', label: 'Settings', group: 'manage', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg> },
]

const SECTION_TITLES: Record<BillingSection, string> = {
  overview: 'Overview',
  usage: 'Usage & Cost Analysis',
  invoices: 'Invoices',
  pricing: 'Pricing & Plans',
  credits: 'Credits',
  transactions: 'Transactions',
  alerts: 'Budgets & Alerts',
  payment: 'Payment Methods',
  team: 'Team',
  settings: 'Settings',
  tax: 'Tax & Compliance',
  members: 'Team Members',
  cost: 'Cost Explorer',
  business: 'Business Profile',
}

function getInitialSection(): BillingSection {
  if (typeof window === 'undefined') return 'overview'
  const hash = window.location.hash.replace('#', '') as BillingSection
  if (hash && hash in SECTION_TITLES) return hash
  return 'overview'
}

interface BillingShellProps {
  org: BillingOrgConfig
  user: IamUser
}

const EMPTY_SUBSCRIPTION: Subscription = {
  id: '',
  customerId: '',
  planId: '',
  status: 'active',
  currentPeriodStart: new Date(),
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
}

const EMPTY_BUSINESS_PROFILE: BusinessProfile = {
  legalName: '',
  displayName: '',
  registeredAddress: { line1: '', city: '', zip: '', country: 'US' },
}

const EMPTY_TAX_SETTINGS: TaxSettings = {
  automaticCollection: false,
  registrations: [],
}

function mapCommerceInvoice(ci: CommerceInvoice): Invoice {
  return {
    id: ci.id ?? '',
    invoiceNumber: ci.number ?? ci.id ?? '',
    date: ci.createdAt ? new Date(ci.createdAt) : new Date(),
    dueDate: ci.dueAt ? new Date(ci.dueAt) : undefined,
    amount: (ci.amount ?? 0) / 100,
    tax: ci.tax ? ci.tax / 100 : undefined,
    total: (ci.total ?? ci.amount ?? 0) / 100,
    status: (ci.status as Invoice['status']) ?? 'pending',
    pdfUrl: ci.pdfUrl ?? undefined,
    currency: ci.currency ?? 'usd',
    number: ci.number,
    items: ci.items?.map((item) => ({
      id: item.id ?? '',
      description: item.description ?? '',
      quantity: item.quantity ?? 1,
      unitPrice: (item.unitPrice ?? 0) / 100,
      total: (item.total ?? 0) / 100,
    })),
  }
}

function mapCommercePaymentMethod(cpm: CommercePaymentMethod): PaymentMethod {
  return {
    id: cpm.id ?? '',
    type: (cpm.type as PaymentMethod['type']) ?? 'card',
    is_default: cpm.isDefault ?? false,
    created_at: cpm.createdAt ?? new Date().toISOString(),
    isDefault: cpm.isDefault ?? false,
    card: cpm.card ? {
      brand: cpm.card.brand ?? '',
      last4: cpm.card.last4 ?? '',
      exp_month: cpm.card.expMonth ?? 0,
      exp_year: cpm.card.expYear ?? 0,
      funding: cpm.card.funding ?? 'credit',
    } : undefined,
    crypto: cpm.crypto ? {
      network: (cpm.crypto.network as PaymentMethod['crypto'] extends undefined ? never : NonNullable<PaymentMethod['crypto']>['network']) ?? 'ethereum',
      walletAddress: cpm.crypto.walletAddress ?? '',
      label: cpm.crypto.label ?? undefined,
    } : undefined,
    wire: cpm.wire ? {
      bankName: cpm.wire.bankName ?? '',
      accountHolder: cpm.wire.accountHolder ?? '',
      routingNumber: cpm.wire.routingNumber ?? undefined,
      accountLast4: cpm.wire.accountLast4 ?? undefined,
      swift: cpm.wire.swift ?? undefined,
      iban: cpm.wire.iban ?? undefined,
      country: cpm.wire.country ?? undefined,
    } : undefined,
    paypal: cpm.paypal ? { email: cpm.paypal.email ?? '' } : undefined,
    bank_account: cpm.bankAccount ? {
      bankName: cpm.bankAccount.bankName ?? undefined,
      last4: cpm.bankAccount.last4 ?? undefined,
      country: cpm.bankAccount.country ?? undefined,
      currency: cpm.bankAccount.currency ?? undefined,
    } : undefined,
    billing_details: cpm.billingDetails ? {
      name: cpm.billingDetails.name ?? undefined,
      email: cpm.billingDetails.email ?? undefined,
    } : undefined,
  }
}

function mapCommerceCreditGrant(cg: CommerceCreditGrant): CreditGrant {
  return {
    id: cg.id ?? '',
    userId: cg.userId,
    name: cg.name ?? 'Credit',
    amountCents: cg.amountCents ?? 0,
    remainingCents: cg.remainingCents ?? 0,
    currency: cg.currency ?? 'usd',
    expiresAt: cg.expiresAt,
    priority: cg.priority,
    eligibility: cg.eligibility,
    voided: cg.voided ?? false,
    active: cg.active ?? true,
    createdAt: cg.createdAt,
  }
}

function mapCommerceTransaction(tx: Transaction): TransactionRecord {
  return {
    id: tx.id ?? '',
    type: tx.type,
    amountCents: tx.amount ?? 0,
    currency: tx.currency ?? 'usd',
    description: tx.metadata?.description as string | undefined,
    balanceAfter: tx.metadata?.balanceAfter as number | undefined,
    tags: tx.tags,
    createdAt: tx.createdAt ?? new Date().toISOString(),
  }
}

function mapCommerceBillingAccount(cba: CommerceBillingAccount): BillingAccount {
  return {
    id: cba.id ?? '',
    name: cba.name ?? '',
    orgId: cba.orgId ?? '',
    orgName: cba.orgName ?? '',
    balance: cba.balance ?? 0,
    currency: cba.currency ?? 'usd',
    plan: cba.plan ?? 'free',
    role: (cba.role as BillingRole) ?? 'viewer',
    createdAt: cba.createdAt ?? new Date().toISOString(),
  }
}

function mapCommerceBillingAccountMember(cbm: CommerceBillingAccountMember): BillingAccountMember {
  return {
    id: cbm.id ?? '',
    userId: cbm.userId ?? '',
    email: cbm.email ?? '',
    name: cbm.name ?? '',
    role: (cbm.role as BillingRole) ?? 'viewer',
    addedAt: cbm.addedAt ?? new Date().toISOString(),
  }
}

function mapCommerceSpendAlert(csa: CommerceSpendAlert): SpendAlert {
  return {
    id: csa.id ?? '',
    title: csa.title ?? '',
    threshold: csa.threshold ?? 0,
    currency: csa.currency ?? 'USD',
    triggeredAt: csa.triggeredAt ?? null,
    createdAt: csa.createdAt ?? new Date().toISOString(),
    updatedAt: csa.updatedAt ?? new Date().toISOString(),
  }
}

/** Normalise any API envelope (array / {data:[]} / {items:[]} etc.) to a plain array. */
function asList<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[]
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>
    for (const key of ['data', 'items', 'records', 'results', 'list']) {
      if (Array.isArray(o[key])) return o[key] as T[]
    }
  }
  return []
}

export function BillingShell({ org, user }: BillingShellProps) {
  const [balance, setBalance] = useState<Balance | null>(null)
  const [subscription, setSubscription] = useState<Subscription>(EMPTY_SUBSCRIPTION)
  const [plans, setPlans] = useState<SubscriptionPlan[]>(HANZO_PLANS)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(EMPTY_BUSINESS_PROFILE)
  const [taxSettings] = useState<TaxSettings>(EMPTY_TAX_SETTINGS)
  const [complianceItems] = useState<ComplianceItem[]>([])
  const [spendAlerts, setSpendAlerts] = useState<SpendAlert[]>([])
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [creditGrants, setCreditGrants] = useState<CreditGrant[]>([])
  const [creditBalance, setCreditBalance] = useState(0)
  const [transactions, setTransactions] = useState<TransactionRecord[]>([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [billingAccounts, setBillingAccounts] = useState<BillingAccount[]>([])
  const [activeBillingAccountId, setActiveBillingAccountId] = useState<string | null>(null)
  const [accountMembers, setAccountMembers] = useState<BillingAccountMember[]>([])
  const [userRole, setUserRole] = useState<BillingRole>('owner')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadBillingData = useCallback(async () => {
    try {
      const token = getAccessToken()
      if (!token) return

      const commerce = getCommerce(org.commerceUrl, token)
      const userId = user.email || user.sub

      const [bal, planList, subs, invList, pmList, alertList, cgList, cBal, txList, acctList] = await Promise.allSettled([
        commerce.getBalance(userId),
        commerce.getPlans(),
        commerce.getUserSubscriptions(userId),
        commerce.getInvoices(userId, { limit: 50 }),
        commerce.getPaymentMethods(userId),
        commerce.getSpendAlerts(userId),
        commerce.getCreditGrants(userId),
        commerce.getCreditBalance(userId),
        commerce.getTransactions(userId, { limit: 100 }),
        commerce.listBillingAccounts(),
      ])

      if (bal.status === 'fulfilled') setBalance(bal.value)

      if (planList.status === 'fulfilled') {
        const remotePlans: SubscriptionPlan[] = asList<Plan>(planList.value).map((p) => ({
          id: p.slug ?? '',
          name: p.name ?? '',
          description: p.description ?? '',
          price: p.price ?? 0,
          billingPeriod: (p.interval as 'monthly' | 'yearly') ?? 'monthly',
          features: [],
          currency: p.currency ?? 'usd',
        }))
        setPlans(mergePlans(remotePlans))
      }

      if (subs.status === 'fulfilled' && asList<CommerceSubscription>(subs.value).length > 0) {
        const subsList = asList<CommerceSubscription>(subs.value)
        const activeSub = subsList.find((s) => s.status === 'active' || s.status === 'trialing') ?? subsList[0]
        setSubscription({
          id: activeSub.id ?? '',
          customerId: activeSub.userId ?? userId,
          planId: activeSub.planId ?? '',
          status: (activeSub.status as Subscription['status']) ?? 'active',
          currentPeriodStart: activeSub.periodStart ? new Date(activeSub.periodStart) : new Date(),
          currentPeriodEnd: activeSub.periodEnd ? new Date(activeSub.periodEnd) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          discount: activeSub.discount ?? null,
        })
      }

      if (invList.status === 'fulfilled') {
        setInvoices(asList<CommerceInvoice>(invList.value).map(mapCommerceInvoice))
      }

      if (pmList.status === 'fulfilled') {
        setPaymentMethods(asList<CommercePaymentMethod>(pmList.value).map(mapCommercePaymentMethod))
      }

      if (alertList.status === 'fulfilled') {
        setSpendAlerts(asList<CommerceSpendAlert>(alertList.value).map(mapCommerceSpendAlert))
      }

      if (cgList.status === 'fulfilled') {
        setCreditGrants(asList<CommerceCreditGrant>(cgList.value).map(mapCommerceCreditGrant))
      }

      if (cBal.status === 'fulfilled') {
        const balances = cBal.value.balances ?? []
        const usdBal = balances.find((b) => (b.currency ?? 'usd').toLowerCase() === 'usd')
        setCreditBalance(usdBal?.available ?? 0)
      }

      if (txList.status === 'fulfilled') {
        setTransactions(asList<Transaction>(txList.value).map(mapCommerceTransaction))
      }

      if (acctList.status === 'fulfilled' && asList<CommerceBillingAccount>(acctList.value).length > 0) {
        const mapped = asList<CommerceBillingAccount>(acctList.value).map(mapCommerceBillingAccount)
        setBillingAccounts(mapped)
        // Set active to first account if none selected
        setActiveBillingAccountId((prev) => prev ?? mapped[0].id)
        // Set user role from active (or first) account
        const active = mapped.find((a) => a.id === activeBillingAccountId) ?? mapped[0]
        setUserRole(active.role)
        // Load members for active account
        try {
          const members = await commerce.listAccountMembers(active.id)
          setAccountMembers(members.map(mapCommerceBillingAccountMember))
        } catch {
          // Members endpoint optional
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing data')
    } finally {
      setLoading(false)
    }
  }, [org, user])

  const loadUsage = useCallback(async () => {
    try {
      const token = getAccessToken()
      if (!token) return
      setUsageLoading(true)

      const commerce = getCommerce(org.commerceUrl, token)
      const userId = user.email || user.sub
      const usageData = await commerce.getUsage(userId)

      if (usageData && usageData.records && usageData.records.length > 0) {
        setUsage({
          totalCost: usageData.totalCost ?? 0,
          currency: usageData.currency ?? 'usd',
          period: {
            start: usageData.period?.start ?? new Date().toISOString(),
            end: usageData.period?.end ?? new Date().toISOString(),
          },
          records: usageData.records.map((r) => ({
            meterId: (r.meterId as UsageSummary['records'][0]['meterId']) ?? 'api_calls',
            label: r.label ?? r.meterId ?? '',
            current: r.current ?? 0,
            limit: r.limit ?? null,
            unit: r.unit ?? '',
            cost: r.cost ?? 0,
            periodStart: r.periodStart ?? '',
            periodEnd: r.periodEnd ?? '',
          })),
        })
      }
    } catch {
      // Usage data is optional — don't block the UI
    } finally {
      setUsageLoading(false)
    }
  }, [org, user])

  useEffect(() => {
    loadBillingData()
    loadUsage()
  }, [loadBillingData, loadUsage])

  // Auto-grant $5 starter credit for new users on first visit
  useEffect(() => {
    if (loading || creditGrants.length > 0) return
    const autoGrant = async () => {
      try {
        const token = getAccessToken()
        if (!token) return
        const commerce = getCommerce(org.commerceUrl, token)
        const userId = user.email || user.sub
        await commerce.grantStarterCredit(userId)
        await loadBillingData()
      } catch {
        // Starter credit may already exist or endpoint unavailable
      }
    }
    autoGrant()
  }, [loading, creditGrants.length, org, user, loadBillingData])

  const admin = isAdminUser(user.email)

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleAddFunds = useCallback(async (amount: number) => {
    const token = getAccessToken()
    if (!token) return
    const commerce = getCommerce(org.commerceUrl, token)
    const userId = user.email || user.sub
    await commerce.addDeposit({ user: userId, amount: Math.round(amount * 100), currency: 'usd' })
    const newBalance = await commerce.getBalance(userId)
    setBalance(newBalance)
  }, [org, user])

  const handleGrantCredit = useCallback(async (email: string, amount: number) => {
    const token = getAccessToken()
    if (!token) return
    const commerce = getCommerce(org.commerceUrl, token)
    await commerce.addDeposit({ user: email, amount: Math.round(amount * 100), currency: 'usd', notes: `Admin credit grant by ${user.email}` })
    if (email === user.email || email === user.sub) {
      const newBalance = await commerce.getBalance(email)
      setBalance(newBalance)
    }
  }, [org, user])

  const handleUpgrade = useCallback(async (planId: string) => {
    const token = getAccessToken()
    if (!token) return
    const commerce = getCommerce(org.commerceUrl, token)
    const userId = user.email || user.sub
    if (subscription.id) {
      await commerce.updateSubscription(subscription.id, { planId })
    } else {
      await commerce.subscribe({ planId, userId })
    }
    await loadBillingData()
  }, [org, user, subscription.id, loadBillingData])

  const handleDowngrade = useCallback(async (planId: string) => {
    await handleUpgrade(planId)
  }, [handleUpgrade])

  const handleCancel = useCallback(async (_reason: string, _feedback?: string) => {
    const token = getAccessToken()
    if (!token || !subscription.id) return
    const commerce = getCommerce(org.commerceUrl, token)
    await commerce.cancelSubscription(subscription.id)
    await loadBillingData()
  }, [subscription.id, org, loadBillingData])

  const handleApplyDiscount = useCallback(async (code: string): Promise<DiscountCode | null> => {
    const token = getAccessToken()
    if (!token || !subscription.id) return null
    const commerce = getCommerce(org.commerceUrl, token)
    const result = await commerce.applyDiscount(subscription.id, code)
    if (result) {
      await loadBillingData()
      return {
        id: result.id ?? '',
        code: result.code ?? code,
        name: result.name ?? null,
        kind: result.kind ?? 'percent',
        value: result.value ?? 0,
        currency: result.currency ?? null,
        duration: result.duration ?? null,
        durationInMonths: result.durationInMonths ?? null,
        valid: result.valid ?? true,
      }
    }
    return null
  }, [subscription.id, org, loadBillingData])

  const handleAddPaymentMethod = useCallback(async (method: PaymentMethod) => {
    const token = getAccessToken()
    if (!token) return
    const commerce = getCommerce(org.commerceUrl, token)
    const userId = user.email || user.sub
    await commerce.addPaymentMethod({
      userId,
      type: method.type,
      isDefault: method.is_default,
      card: method.card ? {
        brand: method.card.brand,
        last4: method.card.last4,
        expMonth: method.card.exp_month,
        expYear: method.card.exp_year,
        funding: method.card.funding,
      } : undefined,
      crypto: method.crypto,
      wire: method.wire,
      paypal: method.paypal,
      bankAccount: method.bank_account ? {
        bankName: method.bank_account.bankName,
        last4: method.bank_account.last4,
        country: method.bank_account.country,
        currency: method.bank_account.currency,
      } : undefined,
      billingDetails: method.billing_details ? {
        name: method.billing_details.name,
        email: method.billing_details.email,
      } : undefined,
    })
    setPaymentMethods((prev: PaymentMethod[]) => [...prev, method])
  }, [org, user])

  const handleRemovePaymentMethod = useCallback(async (id: string) => {
    const token = getAccessToken()
    if (!token) return
    const commerce = getCommerce(org.commerceUrl, token)
    await commerce.removePaymentMethod(id)
    setPaymentMethods((prev: PaymentMethod[]) => prev.filter((m) => m.id !== id))
  }, [org])

  const handleSetDefaultPaymentMethod = useCallback(async (id: string) => {
    const token = getAccessToken()
    if (!token) return
    const commerce = getCommerce(org.commerceUrl, token)
    await commerce.setDefaultPaymentMethod(id)
    setPaymentMethods((prev: PaymentMethod[]) =>
      prev.map((m) => ({ ...m, is_default: m.id === id, isDefault: m.id === id }))
    )
  }, [org])

  const handleDownloadInvoice = useCallback(async (invoice: Invoice) => {
    const url = invoice.pdfUrl ?? invoice.invoicePdfUrl
    if (url) window.open(url, '_blank')
  }, [])

  const handleSaveBusinessProfile = useCallback(async (profile: BusinessProfile) => {
    setBusinessProfile(profile)
  }, [])

  const handleToggleAutomaticTax = useCallback(async (_enabled: boolean) => {
    // Persisted via Commerce API when available
  }, [])

  const handleCreateSpendAlert = useCallback(async (title: string, threshold: number) => {
    const token = getAccessToken()
    if (!token) return
    const commerce = getCommerce(org.commerceUrl, token)
    const userId = user.email || user.sub
    const result = await commerce.createSpendAlert({ userId, title, threshold, currency: 'usd' })
    setSpendAlerts((prev) => [...prev, mapCommerceSpendAlert(result)])
  }, [org, user])

  const handleUpdateSpendAlert = useCallback(async (id: string, title: string, threshold: number) => {
    const token = getAccessToken()
    if (!token) return
    const commerce = getCommerce(org.commerceUrl, token)
    const result = await commerce.updateSpendAlert(id, { title, threshold })
    setSpendAlerts((prev) => prev.map((a) => a.id === id ? mapCommerceSpendAlert(result) : a))
  }, [org])

  const handleDeleteSpendAlert = useCallback(async (id: string) => {
    const token = getAccessToken()
    if (!token) return
    const commerce = getCommerce(org.commerceUrl, token)
    await commerce.deleteSpendAlert(id)
    setSpendAlerts((prev) => prev.filter((a) => a.id !== id))
  }, [org])

  const handleClaimStarterCredit = useCallback(async () => {
    const token = getAccessToken()
    if (!token) return
    const commerce = getCommerce(org.commerceUrl, token)
    const userId = user.email || user.sub
    await commerce.grantStarterCredit(userId)
    await loadBillingData()
  }, [org, user, loadBillingData])

  const handleSubscribeSupport = useCallback(async (tierId: string) => {
    const token = getAccessToken()
    if (!token) return
    const commerce = getCommerce(org.commerceUrl, token)
    const userId = user.email || user.sub
    await commerce.subscribe({ planId: `support-${tierId}`, userId })
    await loadBillingData()
  }, [org, user, loadBillingData])

  const handleSwitchAccount = useCallback(async (accountId: string) => {
    setActiveBillingAccountId(accountId)
    const account = billingAccounts.find((a) => a.id === accountId)
    if (account) setUserRole(account.role)
    // Reload members for new account
    try {
      const token = getAccessToken()
      if (!token) return
      const commerce = getCommerce(org.commerceUrl, token)
      const members = await commerce.listAccountMembers(accountId)
      setAccountMembers(members.map(mapCommerceBillingAccountMember))
    } catch {
      setAccountMembers([])
    }
    // Reload billing data
    await loadBillingData()
  }, [billingAccounts, org, loadBillingData])

  const handleCreateBillingAccount = useCallback(async () => {
    const name = window.prompt('Billing account name:')
    if (!name) return
    const token = getAccessToken()
    if (!token) return
    const commerce = getCommerce(org.commerceUrl, token)
    const result = await commerce.createBillingAccount({ name, orgId: org.id })
    const mapped = mapCommerceBillingAccount(result)
    setBillingAccounts((prev) => [...prev, mapped])
    setActiveBillingAccountId(mapped.id)
    setUserRole(mapped.role)
  }, [org])

  const handleInviteMember = useCallback(async (email: string, role: BillingRole) => {
    const token = getAccessToken()
    if (!token || !activeBillingAccountId) return
    const commerce = getCommerce(org.commerceUrl, token)
    const result = await commerce.addAccountMember(activeBillingAccountId, { email, role })
    setAccountMembers((prev) => [...prev, mapCommerceBillingAccountMember(result)])
  }, [org, activeBillingAccountId])

  const handleChangeMemberRole = useCallback(async (memberId: string, role: BillingRole) => {
    const token = getAccessToken()
    if (!token || !activeBillingAccountId) return
    const commerce = getCommerce(org.commerceUrl, token)
    const result = await commerce.updateMemberRole(activeBillingAccountId, memberId, role)
    setAccountMembers((prev) =>
      prev.map((m) => m.id === memberId ? mapCommerceBillingAccountMember(result) : m)
    )
  }, [org, activeBillingAccountId])

  const handleRemoveMember = useCallback(async (memberId: string) => {
    const token = getAccessToken()
    if (!token || !activeBillingAccountId) return
    const commerce = getCommerce(org.commerceUrl, token)
    await commerce.removeAccountMember(activeBillingAccountId, memberId)
    setAccountMembers((prev) => prev.filter((m) => m.id !== memberId))
  }, [org, activeBillingAccountId])

  const handleLogout = useCallback(() => {
    logout()
    window.location.href = '/'
  }, [])

  // ── Section routing ─────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<BillingSection>(getInitialSection)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navigate = useCallback((section: BillingSection) => {
    setActiveSection(section)
    setMobileMenuOpen(false)
    window.history.replaceState(null, '', `#${section}`)
  }, [])

  // Sync hash changes (back/forward buttons)
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '') as BillingSection
      if (hash && hash in SECTION_TITLES) setActiveSection(hash)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const starterCredit = creditGrants.find((g) => g.active && g.name?.toLowerCase().includes('starter')) ?? null

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090b]">
        <div className="text-center">
          <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
          <p className="mt-4 text-[13px] text-white/30">Loading billing…</p>
        </div>
      </main>
    )
  }

  /* ── Sidebar nav content (shared by desktop + mobile) ──────── */
  const sidebarNav = (
    <nav className="flex flex-col gap-0.5 px-3 py-4">
      {SIDEBAR_SECTIONS.map((s, i) => {
        const prev = SIDEBAR_SECTIONS[i - 1]
        const showSeparator = prev && prev.group !== s.group
        return (
          <div key={s.id}>
            {showSeparator && <div className="my-2 border-t border-white/[0.08]" />}
            <button
              type="button"
              onClick={() => navigate(s.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                activeSection === s.id
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
              }`}
            >
              <span className="flex-shrink-0">{s.icon}</span>
              {s.label}
            </button>
          </div>
        )
      })}
    </nav>
  )

  /* ── Section content ────────────────────────────────────────── */
  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <OverviewDashboard
            subscription={subscription}
            plans={plans}
            paymentMethods={paymentMethods}
            usage={usage}
            usageLoading={usageLoading}
            balance={balance}
            creditGrants={creditGrants}
            creditBalance={creditBalance}
            starterCredit={starterCredit}
            onAddFunds={handleAddFunds}
            onClaimStarterCredit={handleClaimStarterCredit}
            isAdmin={admin}
            onGrantCredit={admin ? handleGrantCredit : undefined}
            userEmail={user.email}
            invoices={invoices}
            spendAlerts={spendAlerts}
            onNavigate={(target: string) => navigate(target.split(':')[0] as BillingSection)}
            onUpgrade={handleUpgrade}
            onDowngrade={handleDowngrade}
            onCancel={handleCancel}
            onApplyDiscount={handleApplyDiscount}
            businessProfile={businessProfile}
            onSaveBusinessProfile={handleSaveBusinessProfile}
            onAddPaymentMethod={handleAddPaymentMethod}
            onRemovePaymentMethod={handleRemovePaymentMethod}
            onSetDefaultPaymentMethod={handleSetDefaultPaymentMethod}
          />
        )
      case 'usage':
        return (
          <div className="space-y-6">
            <UsagePanel usage={usage} loading={usageLoading} />
            <CostExplorer usage={usage} usageLoading={usageLoading} />
          </div>
        )
      case 'invoices':
        return <InvoicesPayments invoices={invoices} onDownloadInvoice={handleDownloadInvoice} />
      case 'pricing':
        return (
          <SubscriptionPortal
            subscription={subscription}
            availablePlans={plans}
            onUpgrade={handleUpgrade}
            onDowngrade={handleDowngrade}
            onCancel={handleCancel}
            onApplyDiscount={handleApplyDiscount}
          />
        )
      case 'credits':
        return (
          <CreditsPanel
            creditGrants={creditGrants}
            creditBalance={creditBalance}
            onClaimStarterCredit={handleClaimStarterCredit}
          />
        )
      case 'transactions':
        return <TransactionsPanel transactions={transactions} loading={transactionsLoading} />
      case 'alerts':
        return (
          <SpendAlertsPanel
            alerts={spendAlerts}
            onCreateAlert={handleCreateSpendAlert}
            onUpdateAlert={handleUpdateSpendAlert}
            onDeleteAlert={handleDeleteSpendAlert}
          />
        )
      case 'payment':
        return (
          <PaymentMethodManager
            paymentMethods={paymentMethods}
            onAdd={handleAddPaymentMethod}
            onRemove={handleRemovePaymentMethod}
            onSetDefault={handleSetDefaultPaymentMethod}
          />
        )
      case 'team':
        return (
          <AccountMembers
            members={accountMembers}
            userRole={userRole}
            onInvite={handleInviteMember}
            onChangeRole={handleChangeMemberRole}
            onRemove={handleRemoveMember}
          />
        )
      case 'settings':
        return (
          <div className="space-y-6">
            <BusinessProfilePanel profile={businessProfile} onSave={handleSaveBusinessProfile} />
            <TaxCompliancePanel
              taxSettings={taxSettings}
              complianceItems={complianceItems}
              onToggleAutomaticTax={handleToggleAutomaticTax}
            />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#09090b]">
      {/* ── Header (shared HanzoHeader design) ──────────────────────── */}
      <header className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b border-white/[0.07] bg-[#09090b]/90 px-4 backdrop-blur-xl">
        {/* Left: logo / breadcrumb / app switcher / mobile hamburger */}
        <div className="flex min-w-0 items-center gap-2.5">
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex-shrink-0 rounded-lg p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white/70 md:hidden"
            aria-label="Toggle menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {mobileMenuOpen
                ? <><path d="M18 6L6 18" /><path d="M6 6l12 12" /></>
                : <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>}
            </svg>
          </button>

          {/* Official Hanzo H-mark (with shadow paths + hover animation) */}
          <a
            href={`${(ORG_DOMAINS[org.id as keyof typeof ORG_DOMAINS] || ORG_DOMAINS.hanzo).iam}/account`}
            className="flex-shrink-0 rounded transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            aria-label={`${org.displayName} Account`}
          >
            <svg width="22" height="22" viewBox="0 0 67 67" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.21 67V44.6369H0V67H22.21Z" fill="#ffffff" />
              <path d="M0 44.6369L22.21 46.8285V44.6369H0Z" fill="#DDDDDD" />
              <path d="M66.7038 22.3184H22.2534L0.0878906 44.6367H44.4634L66.7038 22.3184Z" fill="#ffffff" />
              <path d="M22.21 0H0V22.3184H22.21V0Z" fill="#ffffff" />
              <path d="M66.7198 0H44.5098V22.3184H66.7198V0Z" fill="#ffffff" />
              <path d="M66.6753 22.3185L44.5098 20.0822V22.3185H66.6753Z" fill="#DDDDDD" />
              <path d="M66.7198 67V44.6369H44.5098V67H66.7198Z" fill="#ffffff" />
            </svg>
          </a>

          <span className="select-none text-white/[0.15]">/</span>
          <span className="truncate text-[13px] font-medium text-white/50">Billing</span>

          {/* App switcher */}
          <div className="relative hidden md:block" id="billing-app-switcher">
            <div className="ml-1 flex items-center gap-0.5">
              {((() => {
                const d = ORG_DOMAINS[org.id as keyof typeof ORG_DOMAINS] || ORG_DOMAINS.hanzo
                return [
                  { label: 'Account', href: `${d.iam}/account` },
                  { label: 'Console', href: d.console },
                  { label: 'Chat', href: d.chat },
                  { label: 'Platform', href: d.platform },
                  { label: 'Storage', href: d.storage },
                ]
              })() as { label: string; href: string }[]).map((app) => (
                <a
                  key={app.label}
                  href={app.href}
                  className="rounded-md px-2.5 py-1 text-[11px] font-medium text-white/25 transition-colors hover:bg-white/[0.05] hover:text-white/60"
                >
                  {app.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Right: user email + sign out */}
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="hidden text-[11px] text-white/30 sm:inline">{user.email}</span>
          <a
            href={`${(ORG_DOMAINS[org.id as keyof typeof ORG_DOMAINS] || ORG_DOMAINS.hanzo).iam}/account`}
            className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-white/35 transition hover:bg-white/[0.05] hover:text-white/60 sm:flex"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Account
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-white/35 transition hover:bg-white/[0.05] hover:text-white/60"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* ── Desktop sidebar ──────────────────────────────── */}
        <aside className="hidden w-60 flex-shrink-0 border-r border-white/[0.07] bg-[#0d0d10] md:block">
          {sidebarNav}
        </aside>

        {/* ── Mobile sidebar drawer ────────────────────────── */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-white/[0.07] bg-[#0d0d10] pt-14 md:hidden">
              {sidebarNav}
            </aside>
          </>
        )}

        {/* ── Main content ─────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-8 py-8">
            {error && (
              <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {activeSection !== 'overview' && (
              <h1 className="mb-6 text-2xl font-bold tracking-tight text-white">
                {SECTION_TITLES[activeSection]}
              </h1>
            )}

            {renderSection()}
          </div>
        </main>
      </div>
    </div>
  )
}
