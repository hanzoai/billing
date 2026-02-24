'use client'

import { useEffect, useState, useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import { useAuth, IamAuthService } from '@hanzo/auth'
import { BillingWorkspace } from '@hanzo/ui/billing'
import type {
  Subscription,
  SubscriptionPlan,
  PaymentMethod,
  Invoice,
  BusinessProfile,
  TaxSettings,
  ComplianceItem,
  BillingMetric,
} from '@hanzo/ui/billing'
import type { Balance } from '@hanzo/commerce'
import type { BillingOrgConfig } from '@/lib/config'
import { getCommerce } from '@/lib/commerce'
import { BalancePanel } from './balance-panel'

interface BillingShellProps {
  org: BillingOrgConfig
}

// Default empty state for required BillingWorkspace props
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
  registeredAddress: {
    line1: '',
    city: '',
    zip: '',
    country: 'US',
  },
}

const EMPTY_TAX_SETTINGS: TaxSettings = {
  automaticCollection: false,
  registrations: [],
}

export const BillingShell = observer(function BillingShell({ org }: BillingShellProps) {
  const auth = useAuth()
  const [balance, setBalance] = useState<Balance | null>(null)
  const [subscription, setSubscription] = useState<Subscription>(EMPTY_SUBSCRIPTION)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [usageMetrics, setUsageMetrics] = useState<BillingMetric[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(EMPTY_BUSINESS_PROFILE)
  const [taxSettings] = useState<TaxSettings>(EMPTY_TAX_SETTINGS)
  const [complianceItems] = useState<ComplianceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const getToken = useCallback(async (): Promise<string | null> => {
    const iam = auth as IamAuthService
    if (typeof iam.getAccessToken === 'function') {
      return iam.getAccessToken()
    }
    return null
  }, [auth])

  const loadBillingData = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) return

      const commerce = getCommerce(org.commerceUrl, token)
      const userId = auth.user?.email ?? ''

      const [bal, planList] = await Promise.allSettled([
        commerce.getBalance(userId),
        commerce.getPlans(),
      ])

      if (bal.status === 'fulfilled') setBalance(bal.value)
      if (planList.status === 'fulfilled') {
        setPlans(planList.value.map((p) => ({
          id: p.slug ?? '',
          name: p.name ?? '',
          description: p.description ?? '',
          price: p.price ?? 0,
          billingPeriod: (p.interval as 'monthly' | 'yearly') ?? 'monthly',
          features: [],
          currency: p.currency ?? 'usd',
        })))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing data')
    } finally {
      setLoading(false)
    }
  }, [auth, org, getToken])

  useEffect(() => {
    if (!auth.loggedIn) {
      const iam = auth as IamAuthService
      if (typeof iam.loginEmailAndPassword === 'function') {
        iam.loginEmailAndPassword('', '')
      }
      return
    }
    loadBillingData()
  }, [auth.loggedIn, loadBillingData])

  // ---- Callbacks wired to Commerce API ----

  const handleAddFunds = useCallback(async (amount: number) => {
    const token = await getToken()
    if (!token) return
    const commerce = getCommerce(org.commerceUrl, token)
    const userId = auth.user?.email ?? ''
    await commerce.addDeposit({ user: userId, amount, currency: 'usd' })
    const newBalance = await commerce.getBalance(userId)
    setBalance(newBalance)
  }, [auth, org, getToken])

  const handleUpgrade = useCallback(async (planId: string) => {
    const token = await getToken()
    if (!token) return
    const commerce = getCommerce(org.commerceUrl, token)
    const userId = auth.user?.email ?? ''
    const sub = await commerce.subscribe({ planId, userId })
    setSubscription((prev) => ({
      ...prev,
      planId: sub.planId ?? planId,
      status: (sub.status as Subscription['status']) ?? 'active',
    }))
  }, [auth, org, getToken])

  const handleDowngrade = useCallback(async (planId: string) => {
    await handleUpgrade(planId)
  }, [handleUpgrade])

  const handleCancel = useCallback(async (_reason: string, _feedback?: string) => {
    const token = await getToken()
    if (!token || !subscription.id) return
    const commerce = getCommerce(org.commerceUrl, token)
    await commerce.cancelSubscription(subscription.id)
    setSubscription((prev) => ({ ...prev, status: 'canceled' }))
  }, [subscription.id, org, getToken])

  const handleAddPaymentMethod = useCallback(async (method: PaymentMethod) => {
    setPaymentMethods((prev) => [...prev, method])
  }, [])

  const handleRemovePaymentMethod = useCallback(async (id: string) => {
    setPaymentMethods((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const handleSetDefaultPaymentMethod = useCallback(async (id: string) => {
    setPaymentMethods((prev) =>
      prev.map((m) => ({
        ...m,
        is_default: m.id === id,
        isDefault: m.id === id,
      }))
    )
  }, [])

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

  // ---- Render ----

  if (!auth.loggedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <div className="text-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-text-dim border-t-brand" />
          <p className="mt-4 text-sm text-text-muted">Redirecting to sign in...</p>
        </div>
      </main>
    )
  }

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
            <img src={org.logo} alt={org.displayName} className="h-6 w-6" />
            <span className="text-sm font-semibold text-text">{org.displayName}</span>
            <span className="text-text-dim">/</span>
            <span className="text-sm text-text-muted">Billing</span>
          </div>
          <div className="flex items-center gap-3">
            {auth.user && (
              <span className="text-sm text-text-muted">
                {auth.user.displayName ?? auth.user.email}
              </span>
            )}
            <button
              type="button"
              onClick={() => auth.logout()}
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

        {/* Balance panel */}
        <BalancePanel
          balance={balance}
          onAddFunds={handleAddFunds}
        />

        {/* Billing workspace from @hanzo/ui */}
        <div className="mt-6">
          <BillingWorkspace
            subscription={subscription}
            plans={plans}
            usageMetrics={usageMetrics}
            paymentMethods={paymentMethods}
            invoices={invoices}
            businessProfile={businessProfile}
            taxSettings={taxSettings}
            complianceItems={complianceItems}
            onUpgrade={handleUpgrade}
            onDowngrade={handleDowngrade}
            onCancel={handleCancel}
            onAddPaymentMethod={handleAddPaymentMethod}
            onRemovePaymentMethod={handleRemovePaymentMethod}
            onSetDefaultPaymentMethod={handleSetDefaultPaymentMethod}
            onDownloadInvoice={handleDownloadInvoice}
            onSaveBusinessProfile={handleSaveBusinessProfile}
            onToggleAutomaticTax={handleToggleAutomaticTax}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 text-xs text-text-dim">
          <span>{org.displayName} Billing</span>
          <div className="flex gap-4">
            <a href="https://docs.hanzo.ai" target="_blank" rel="noreferrer" className="hover:text-text-muted transition">Docs</a>
            <a href="https://hanzo.ai" target="_blank" rel="noreferrer" className="hover:text-text-muted transition">Hanzo</a>
          </div>
        </div>
      </footer>
    </div>
  )
})
