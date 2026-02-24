'use client'

import { useEffect, useState, useCallback } from 'react'
import { BillingWorkspace } from '@/lib/billing'
import type {
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
} from '@/lib/billing'
import type { Balance, CommerceInvoice, CommercePaymentMethod, CommerceSpendAlert } from '@/lib/commerce-client'
import type { IamUser } from '@/lib/iam-auth'
import { getAccessToken, logout } from '@/lib/iam-auth'
import { type BillingOrgConfig, isAdminUser, HANZO_PLANS, mergePlans } from '@/lib/config'
import { getCommerce } from '@/lib/commerce'
import { BalancePanel } from './balance-panel'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadBillingData = useCallback(async () => {
    try {
      const token = getAccessToken()
      if (!token) return

      const commerce = getCommerce(org.commerceUrl, token)
      const userId = user.email || user.sub

      const [bal, planList, subs, invList, pmList, alertList] = await Promise.allSettled([
        commerce.getBalance(userId),
        commerce.getPlans(),
        commerce.getUserSubscriptions(userId),
        commerce.getInvoices(userId, { limit: 50 }),
        commerce.getPaymentMethods(userId),
        commerce.getSpendAlerts(userId),
      ])

      if (bal.status === 'fulfilled') setBalance(bal.value)

      if (planList.status === 'fulfilled') {
        const remotePlans: SubscriptionPlan[] = planList.value.map((p) => ({
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

      if (subs.status === 'fulfilled' && subs.value.length > 0) {
        const activeSub = subs.value.find((s) => s.status === 'active' || s.status === 'trialing') ?? subs.value[0]
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
        setInvoices(invList.value.map(mapCommerceInvoice))
      }

      if (pmList.status === 'fulfilled') {
        setPaymentMethods(pmList.value.map(mapCommercePaymentMethod))
      }

      if (alertList.status === 'fulfilled') {
        setSpendAlerts(alertList.value.map(mapCommerceSpendAlert))
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

  const handleLogout = useCallback(() => {
    logout()
    window.location.href = '/'
  }, [])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <div className="text-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-text-dim border-t-brand" />
          <p className="mt-4 text-sm text-text-muted">Loading billing...</p>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <nav className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 67 67" xmlns="http://www.w3.org/2000/svg" className="text-brand">
              <path d="M22.21 67V44.6369H0V67H22.21Z" fill="currentColor" />
              <path d="M66.7038 22.3184H22.2534L0.0878906 44.6367H44.4634L66.7038 22.3184Z" fill="currentColor" />
              <path d="M22.21 0H0V22.3184H22.21V0Z" fill="currentColor" />
              <path d="M66.7198 0H44.5098V22.3184H66.7198V0Z" fill="currentColor" />
              <path d="M66.7198 67V44.6369H44.5098V67H66.7198Z" fill="currentColor" />
            </svg>
            <span className="text-sm font-semibold text-text">{org.displayName}</span>
            <span className="text-text-dim">/</span>
            <span className="text-sm text-text-muted">Billing</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-muted">
              {user.displayName ?? user.email}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition hover:bg-bg-elevated hover:text-text"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <BalancePanel
          balance={balance}
          isAdmin={admin}
          userEmail={user.email}
          onAddFunds={handleAddFunds}
          onGrantCredit={admin ? handleGrantCredit : undefined}
        />

        <div className="mt-6">
          <BillingWorkspace
            subscription={subscription}
            plans={plans}
            paymentMethods={paymentMethods}
            invoices={invoices}
            businessProfile={businessProfile}
            taxSettings={taxSettings}
            complianceItems={complianceItems}
            spendAlerts={spendAlerts}
            usage={usage}
            usageLoading={usageLoading}
            onUpgrade={handleUpgrade}
            onDowngrade={handleDowngrade}
            onCancel={handleCancel}
            onApplyDiscount={handleApplyDiscount}
            onAddPaymentMethod={handleAddPaymentMethod}
            onRemovePaymentMethod={handleRemovePaymentMethod}
            onSetDefaultPaymentMethod={handleSetDefaultPaymentMethod}
            onDownloadInvoice={handleDownloadInvoice}
            onSaveBusinessProfile={handleSaveBusinessProfile}
            onToggleAutomaticTax={handleToggleAutomaticTax}
            onCreateSpendAlert={handleCreateSpendAlert}
            onUpdateSpendAlert={handleUpdateSpendAlert}
            onDeleteSpendAlert={handleDeleteSpendAlert}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 text-xs text-text-dim">
          <span>{org.displayName} Billing</span>
          <div className="flex gap-4">
            <a href="https://docs.hanzo.ai" target="_blank" rel="noreferrer" className="transition hover:text-text-muted">Docs</a>
            <a href="https://hanzo.ai" target="_blank" rel="noreferrer" className="transition hover:text-text-muted">Hanzo</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
