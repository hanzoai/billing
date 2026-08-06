'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
// Every billing surface comes from ONE place: the local `lib/billing` barrel.
// Two reasons, and both still hold. The published @hanzo/ui/billing bundle drags
// in a first-party card form that reads the raw PAN into JS — Square Web Payments
// hosted fields are the only card entry path here, and scripts/pci-scope.mjs
// fails the build on an import of it. And @hanzo/ui 8 dropped ./billing anyway.
// The local copies were always the correct ones: PaymentMethodManager tokenizes
// through the Square SDK, and SubscriptionPortal gives per-seat plans a seat
// selector and paid tiers the honest activation flow rather than the mint-gated
// subscribe POST that 403s for non-platform callers.
import {
  OverviewDashboard,
  UsagePanel,
  CostExplorer,
  InvoicesPayments,
  CreditsPanel,
  TransactionsPanel,
  SpendAlertsPanel,
  PaymentMethodManager,
  AccountMembers,
  BusinessProfilePanel,
  TaxCompliancePanel,
  SubscriptionPortal,
  GuidedSetup,
} from '@/lib/billing'
import type {
  BillingSection,
  BillingAccount,
  BillingAccountMember,
  BillingRole,
  PaymentMethod,
  Invoice,
  BusinessProfile,
  TaxSettings,
  ComplianceItem,
  SpendAlert,
  UsageSummary,
  CreditGrant,
  TransactionRecord,
  Subscription,
  SubscriptionPlan,
  DiscountCode,
} from '@/lib/billing'
import type { Balance, CardInput, CommerceBillingAccount, CommerceBillingAccountMember, CommerceInvoice, CommercePaymentMethod, CommerceSpendAlert, CommerceCreditGrant, Transaction, Plan, Subscription as CommerceSubscription } from '@/lib/commerce-client'
import type { IamUser } from '@/lib/iam-auth'
import { getAccessToken, logout } from '@/lib/iam-auth'
import { type BillingOrgConfig, isAdminUser, BASE_PATH, SALES_URL } from '@/lib/config'
import { topupHref } from '@/lib/topup'
import { getCommerce } from '@/lib/commerce'

import { OrgHeader, type HanzoOrg } from '@hanzogui/shell'

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
    description: tx.notes ?? (tx.metadata?.description as string | undefined),
    balanceAfter: tx.metadata?.balanceAfter as number | undefined,
    // commerce serialises tags as a comma-joined string when there is only one
    tags: typeof tx.tags === 'string' ? tx.tags.split(',').filter(Boolean) : tx.tags,
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

// Subscription tiers shown on the pricing grid (the catalog also carries
// dns/world/social plans, which have their own product surfaces).
const PLAN_CATEGORIES = new Set(['personal', 'team', 'enterprise'])

/**
 * Project a commerce catalog plan (prices in cents, from
 * @hanzo/plans/subscription.json) onto the card the portal renders.
 * The catalog is the ONE source of plan copy — features, prices, tiers.
 */
function mapCommercePlan(p: Plan): SubscriptionPlan {
  const limits: Record<string, number> = {}
  for (const [k, v] of Object.entries(p.limits ?? {})) {
    if (typeof v === 'number') limits[k] = v
  }
  const perSeat = p.category === 'team'
  // Same rule as the public projection (lib/plans.ts): a tier with NO price is
  // sold by a person even when the catalog forgets to flag it. This is the
  // AUTHENTICATED copy of that projection — commerce sends cents here, the
  // gateway sends dollars there — and the two must agree on who sells what.
  const sold = !!p.contactSales || p.price == null
  return {
    id: p.slug ?? '',
    name: p.name ?? '',
    description: p.description ?? '',
    price: (p.price ?? 0) / 100,
    annualPrice: p.priceAnnual ? p.priceAnnual / 100 : undefined,
    billingPeriod: 'monthly',
    currency: p.currency ?? 'usd',
    features: p.features ?? [],
    limits,
    highlighted: p.popular,
    badge: sold ? 'Contact Sales' : p.popular ? 'Popular' : undefined,
    contactSales: sold,
    externalUrl: sold ? SALES_URL : undefined,
    trialDays: p.trialPeriodDays || undefined,
    trialCreditCents: limits.freeCredit ? limits.freeCredit * 100 : undefined,
    perSeat,
    // minSeats comes from the catalog when projected; commerce rejects fewer
    // than 2 seats on per-seat tiers, so the selector enforces the same floor.
    minSeats: perSeat ? limits.minSeats ?? 2 : undefined,
  }
}

/** Normalise any API envelope (array / {data:[]} / {items:[]} etc.) to a plain array. */
function asList<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[]
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>
    for (const key of ['data', 'items', 'records', 'results', 'list', 'grants', 'transactions']) {
      if (Array.isArray(o[key])) return o[key] as T[]
    }
  }
  return []
}

export function BillingShell({ org, user }: BillingShellProps) {
  const [balance, setBalance] = useState<Balance | null>(null)
  const [subscription, setSubscription] = useState<Subscription>(EMPTY_SUBSCRIPTION)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(EMPTY_BUSINESS_PROFILE)
  const [taxSettings] = useState<TaxSettings>(EMPTY_TAX_SETTINGS)
  const [complianceItems] = useState<ComplianceItem[]>([])
  const [spendAlerts, setSpendAlerts] = useState<SpendAlert[]>([])
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageError, setUsageError] = useState<string | null>(null)
  // Why a fetch produced nothing, per panel. An empty list and a failed read
  // look identical once they reach a component, and on a money page the
  // difference is the whole message: "you have no transactions" is a fact about
  // the account, "we could not read them" is a fact about us. The commerce
  // client no longer turns a 404 or a 502 into an empty success, so the
  // rejection actually arrives here and the panel can say which one it has.
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({})
  const [creditGrants, setCreditGrants] = useState<CreditGrant[]>([])
  const [creditBalance, setCreditBalance] = useState(0)
  const [transactions, setTransactions] = useState<TransactionRecord[]>([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [billingAccounts, setBillingAccounts] = useState<BillingAccount[]>([])
  const [activeBillingAccountId, setActiveBillingAccountId] = useState<string | null>(null)
  // The org the customer switched the header to — null is the signed-in
  // subject (the token's owner slug, which every read below is keyed on).
  const [subjectOrgId, setSubjectOrgId] = useState<string | null>(null)
  const [accountMembers, setAccountMembers] = useState<BillingAccountMember[]>([])
  const [userRole, setUserRole] = useState<BillingRole>('owner')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadBillingData = useCallback(async () => {
    try {
      const token = getAccessToken()
      if (!token) return

      const commerce = getCommerce(org.commerceUrl, token)
      const userId = user.commerceUserId || user.email || user.sub

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

      const failed: Record<string, string> = {}
      const why = (r: PromiseSettledResult<unknown>) =>
        r.status === 'rejected'
          ? (r.reason instanceof Error ? r.reason.message : String(r.reason))
          : ''
      for (const [panel, result] of [
        ['balance', bal], ['plans', planList], ['subscriptions', subs],
        ['invoices', invList], ['payment', pmList], ['alerts', alertList],
        ['credits', cgList], ['creditBalance', cBal], ['transactions', txList],
        ['accounts', acctList],
      ] as const) {
        if (result.status === 'rejected') failed[panel] = why(result)
      }
      setLoadErrors(failed)

      if (bal.status === 'fulfilled') setBalance(bal.value)

      if (planList.status === 'fulfilled') {
        setPlans(
          asList<Plan>(planList.value)
            .filter((p) => PLAN_CATEGORIES.has(p.category ?? ''))
            .map(mapCommercePlan),
        )
      }
      // Loading is over either way; a rejected fetch leaves plans empty and
      // the portal shows an honest catalog error, never stale local copy.
      setPlansLoading(false)

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
        const grants = asList<CommerceCreditGrant>(cgList.value).map(mapCommerceCreditGrant)
        if (grants.length > 0) {
          setCreditGrants(grants)
        } else if (txList.status === 'fulfilled') {
          // Starter credits are no longer issued, but accounts that hold one
          // still hold real money. Commerce recorded it as a Deposit transaction
          // tagged "starter-credit" (deliberately NOT a credit-grant — it nets
          // into the balance ledger), so getCreditGrants() is empty and we
          // synthesize a grant from that transaction to keep it visible.
          const txs = asList<Transaction>(txList.value)
          const creditTxs = txs.filter((tx) => tx.type === 'deposit' && (tx.tags === 'starter-credit' || (Array.isArray(tx.tags) && tx.tags.includes('starter-credit'))))
          setCreditGrants(creditTxs.map((tx): CreditGrant => ({
            id: tx.id ?? '',
            // The tag is the source of truth for what this deposit is; the
            // transaction's notes are freeform ("Welcome credit: $100.00 USD …")
            // and make a poor row label.
            name: 'Starter Credit',
            amountCents: tx.amount ?? 0,
            remainingCents: tx.amount ?? 0,
            currency: tx.currency ?? 'usd',
            expiresAt: tx.expiresAt,
            active: true,
            createdAt: tx.createdAt ?? new Date().toISOString(),
          })))
        }
      }

      if (cBal.status === 'fulfilled') {
        const balances = cBal.value.balances ?? []
        const usdBal = balances.find((b) => (b.currency ?? 'usd').toLowerCase() === 'usd')
        const creditGrantBalance = usdBal?.available ?? 0
        // Credit grants are a separate entity from the transaction-based balance.
        // The starter credit is recorded as a transaction, so prefer the
        // transaction balance when credit-grant balance is zero.
        if (creditGrantBalance > 0) {
          setCreditBalance(creditGrantBalance)
        } else if (bal.status === 'fulfilled') {
          setCreditBalance(bal.value.available ?? 0)
        }
      } else if (bal.status === 'fulfilled') {
        // credit-balance endpoint failed — fall back to transaction balance
        setCreditBalance(bal.value.available ?? 0)
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
      setPlansLoading(false)
    }
  }, [org, user])

  const loadUsage = useCallback(async () => {
    try {
      const token = getAccessToken()
      if (!token) return
      setUsageLoading(true)
      setUsageError(null)

      const commerce = getCommerce(org.commerceUrl, token)
      const userId = user.commerceUserId || user.email || user.sub
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
    } catch (e) {
      // Usage does not block the UI, but a FAILURE is not an absence. Swallowing
      // it left `usage` null, and null already meant "no usage this period" — so
      // a 502 from the meter rendered as "No usage data available", telling a
      // customer their account was idle while the service that knows was down.
      // The two facts get two values now, and the panel says which one it has.
      setUsageError(e instanceof Error ? e.message : 'Usage is unavailable right now.')
    } finally {
      setUsageLoading(false)
    }
  }, [org, user])

  useEffect(() => {
    loadBillingData()
    loadUsage()
  }, [loadBillingData, loadUsage])

  const admin = isAdminUser(user.email)

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleAddFunds = useCallback(async (amount: number) => {
    const cents = Math.round(amount * 100)
    // POST /v1/billing/deposit is mint-gated (platform only). The self-serve
    // money-in is the Square top-up page — send everyone else there instead
    // of firing a deposit that 403s.
    if (!admin) {
      window.location.href = topupHref(cents)
      return
    }
    const token = getAccessToken()
    if (!token) return
    const commerce = getCommerce(org.commerceUrl, token)
    const userId = user.commerceUserId || user.email || user.sub
    await commerce.addDeposit({ user: userId, amount: cents, currency: 'usd' })
    const newBalance = await commerce.getBalance(userId)
    setBalance(newBalance)
  }, [org, user, admin])

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
    // Paid-tier subscribe is mint-gated server-side (403 for non-platform
    // callers). For overview-originated upgrades, land on the pricing section
    // where the honest activation flow (top-up + request) lives.
    const target = plans.find((p) => p.id === planId)
    if (target && target.price > 0 && !admin) {
      window.location.hash = 'pricing'
      return
    }
    const token = getAccessToken()
    if (!token) return
    const commerce = getCommerce(org.commerceUrl, token)
    const userId = user.commerceUserId || user.email || user.sub
    if (subscription.id) {
      await commerce.updateSubscription(subscription.id, { planId })
    } else {
      await commerce.subscribe({ planId, userId })
    }
    await loadBillingData()
  }, [org, user, subscription.id, loadBillingData, plans, admin])

  const handleDowngrade = useCallback(async (planId: string) => {
    await handleUpgrade(planId)
  }, [handleUpgrade])

  // Self-serve paid checkout: charge a fresh Square nonce OR a saved card and
  // start the subscription. Rethrows CommerceApiError (with .status) so
  // SubscribeCardForm can branch on 402/404/409/422/500 with honest UI. On
  // success, refresh state to show the plan.
  const handleSubscribeWithCard = useCallback(async (planId: string, card: CardInput, quantity: number, idempotencyKey: string) => {
    const token = getAccessToken()
    if (!token) throw new Error('Your session expired. Please sign in again.')
    const commerce = getCommerce(org.commerceUrl, token)
    const userId = user.commerceUserId || user.email || user.sub
    await commerce.subscribeWithCard(
      { ...card, planId, userId, quantity, currency: 'usd' },
      { idempotencyKey },
    )
    await loadBillingData()
  }, [org, user, loadBillingData])

  // Cards on file the checkout can charge directly. Only card methods qualify;
  // the label is the receipt name commerce stamps ("Visa ending in 4242") or
  // the card facts, falling back to a generic that is still honest.
  const savedCards = useMemo(() => paymentMethods
    .filter((m) => m.type === 'card')
    .map((m) => ({
      id: m.id,
      label: m.card?.brand && m.card?.last4
        ? `${m.card.brand} ending in ${m.card.last4}`
        : 'Saved card',
      isDefault: m.isDefault ?? m.is_default,
    })), [paymentMethods])

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
    const userId = user.commerceUserId || user.email || user.sub

    // If the method has a Square sourceId token, use the dedicated
    // tokenizeAndAddCard flow which does real $1 pre-auth verification.
    if (method._sourceToken && method.type === 'card') {
      await commerce.tokenizeAndAddCard(method._sourceToken, userId)
      await loadBillingData()
      return
    }

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
    const userId = user.commerceUserId || user.email || user.sub
    await commerce.setDefaultPaymentMethod(id, undefined, userId)
    setPaymentMethods((prev: PaymentMethod[]) =>
      prev.map((m) => ({ ...m, is_default: m.id === id, isDefault: m.id === id }))
    )
  }, [org, user])

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
    const userId = user.commerceUserId || user.email || user.sub
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

  const handleSubscribeSupport = useCallback(async (tierId: string) => {
    const token = getAccessToken()
    if (!token) return
    const commerce = getCommerce(org.commerceUrl, token)
    const userId = user.commerceUserId || user.email || user.sub
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

  // ── Subject switcher ─────────────────────────────────────────────────
  //
  // ONE switcher: the shell header's own dropdown, the same control every
  // Hanzo app switches subject with. It is fed every subject billing can
  // name — the signed-in subject first (the token's owner slug, named by
  // what it is), then each billing account's org. An account scoped to the
  // signed-in subject's own org enriches that row rather than appearing
  // twice.
  const organizations = useMemo<HanzoOrg[]>(() => {
    const orgs: HanzoOrg[] = [
      { id: user.commerceUserId, name: user.commerceUserId, slug: user.commerceUserId },
    ]
    for (const a of billingAccounts) {
      if (!a.orgId) continue
      const existing = orgs.find((o) => o.id === a.orgId)
      if (existing) {
        existing.role = a.role
        continue
      }
      orgs.push({ id: a.orgId, name: a.orgName || a.name, role: a.role })
    }
    return orgs
  }, [billingAccounts, user.commerceUserId])

  // Switching re-scopes what the client can re-scope today: the account
  // plane (role, members) switches for real, and every read is re-issued.
  // commerce's EdgeAuth locks the money reads' subject to the token's owner
  // claim server-side, so those follow the signed-in subject until commerce
  // honors an org scope — the switch never pretends otherwise.
  const handleOrgSwitch = useCallback(
    (orgId: string) => {
      setSubjectOrgId(orgId === user.commerceUserId ? null : orgId)
      const account = billingAccounts.find((a) => a.orgId === orgId)
      if (account) {
        void handleSwitchAccount(account.id)
      } else {
        void loadBillingData()
      }
    },
    [billingAccounts, handleSwitchAccount, loadBillingData, user.commerceUserId],
  )

  const handleLogout = useCallback(() => {
    logout()
    window.location.href = `${BASE_PATH}/`
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

  // The overview IS the setup card until the account can pay — but only until
  // then. An account holding real credit has plenty honest to show (its
  // balance, its usage, its invoices), and walling that behind "choose a plan"
  // once trapped a six-figure prepaid account in onboarding and swallowed its
  // Add-credit click. So: funded accounts always see the dashboard; the card
  // remains the whole overview for accounts with no way to pay yet, which is
  // where "paying is not optional" genuinely applies. There is still no
  // dismiss, and every other section stays reachable from the sidebar.
  const funded = (balance?.available ?? 0) > 0 || creditBalance > 0
  const setupIncomplete = !funded && (paymentMethods.length === 0 || !subscription.id)

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <div className="text-center">
          <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-ink/10 border-t-ink/60" />
          <p className="mt-4 text-[13px] text-ink/30">Loading billing…</p>
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
            {showSeparator && <div className="my-2 border-t border-ink/[0.08]" />}
            <button
              type="button"
              onClick={() => navigate(s.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                activeSection === s.id
                  ? 'bg-ink/[0.08] text-text'
                  : 'text-ink/40 hover:text-ink/70 hover:bg-ink/[0.04]'
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
        if (setupIncomplete) {
          return (
            <GuidedSetup
              hasPaymentMethod={paymentMethods.length > 0}
              hasSubscription={!!subscription.id}
              hasSpendAlert={spendAlerts.length > 0}
              onAddPaymentMethod={() => navigate('payment')}
              onPickPlan={() => navigate('pricing')}
              onSetSpendLimit={() => navigate('alerts')}
            />
          )
        }
        return (
          <OverviewDashboard
            subscription={subscription}
            plans={plans}
            paymentMethods={paymentMethods}
            usage={usage}
            usageLoading={usageLoading}
            usageError={usageError}
            balance={balance}
            creditGrants={creditGrants}
            creditBalance={creditBalance}
            onAddFunds={handleAddFunds}
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
            <UsagePanel usage={usage} loading={usageLoading} error={usageError} onRetry={loadUsage} />
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
            plansLoading={plansLoading}
            canDirectSubscribe={admin}
            defaultView="plans"
            onUpgrade={handleUpgrade}
            onDowngrade={handleDowngrade}
            onCancel={handleCancel}
            onApplyDiscount={handleApplyDiscount}
            onSubscribeWithCard={handleSubscribeWithCard}
            savedCards={savedCards}
          />
        )
      case 'credits':
        return (
          <CreditsPanel
            creditGrants={creditGrants}
            creditBalance={creditBalance}
            error={loadErrors.credits ?? null}
          />
        )
      case 'transactions':
        return <TransactionsPanel transactions={transactions} loading={transactionsLoading} error={loadErrors.transactions ?? null} onRetry={loadBillingData} />
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
            paymentMethods={paymentMethods as any}
            onAdd={handleAddPaymentMethod}
            onRemove={handleRemovePaymentMethod}
            onSetDefault={handleSetDefaultPaymentMethod}
          />
        )
      case 'team':
        return (
          <AccountMembers
            error={loadErrors.accounts ?? null}
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
    <div className="flex min-h-screen flex-col bg-bg">
      {/* ── Unified Hanzo Header ──────────────────────── */}
      <OrgHeader
        currentApp="Billing"
        currentAppId="billing"
        user={{ name: user.displayName ?? '', email: user.email ?? '', avatar: user.avatar ?? '' }}
        organizations={organizations}
        currentOrgId={subjectOrgId ?? user.commerceUserId}
        onOrgSwitch={handleOrgSwitch}
        onSignOut={handleLogout}
        headerRight={
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex-shrink-0 rounded-lg p-1.5 text-ink/40 hover:bg-ink/[0.06] hover:text-ink/70 md:hidden"
            aria-label="Toggle menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {mobileMenuOpen
                ? <><path d="M18 6L6 18" /><path d="M6 6l12 12" /></>
                : <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>}
            </svg>
          </button>
        }
      />

      <div className="flex flex-1">
        {/* ── Desktop sidebar ──────────────────────────────── */}
        <aside className="hidden w-60 flex-shrink-0 border-r border-ink/[0.07] bg-bg md:block">
          {sidebarNav}
        </aside>

        {/* ── Mobile sidebar drawer ────────────────────────── */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-ink/[0.07] bg-bg pt-14 md:hidden">
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
              <h1 className="mb-6 text-2xl font-bold tracking-tight text-text">
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
