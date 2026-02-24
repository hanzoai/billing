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
} from '@/lib/billing'
import type { Balance } from '@/lib/commerce-client'
import type { IamUser } from '@/lib/iam-auth'
import { getAccessToken, logout } from '@/lib/iam-auth'
import type { BillingOrgConfig } from '@/lib/config'
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

export function BillingShell({ org, user }: BillingShellProps) {
  const [balance, setBalance] = useState<Balance | null>(null)
  const [subscription] = useState<Subscription>(EMPTY_SUBSCRIPTION)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [invoices] = useState<Invoice[]>([])
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(EMPTY_BUSINESS_PROFILE)
  const [taxSettings] = useState<TaxSettings>(EMPTY_TAX_SETTINGS)
  const [complianceItems] = useState<ComplianceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadBillingData = useCallback(async () => {
    try {
      const token = getAccessToken()
      if (!token) return

      const commerce = getCommerce(org.commerceUrl, token)
      const userId = user.email || user.sub

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
  }, [org, user])

  useEffect(() => {
    loadBillingData()
  }, [loadBillingData])

  const handleAddFunds = useCallback(async (amount: number) => {
    const token = getAccessToken()
    if (!token) return
    const commerce = getCommerce(org.commerceUrl, token)
    const userId = user.email || user.sub
    await commerce.addDeposit({ user: userId, amount, currency: 'usd' })
    const newBalance = await commerce.getBalance(userId)
    setBalance(newBalance)
  }, [org, user])

  const handleUpgrade = useCallback(async (planId: string) => {
    const token = getAccessToken()
    if (!token) return
    const commerce = getCommerce(org.commerceUrl, token)
    const userId = user.email || user.sub
    await commerce.subscribe({ planId, userId })
  }, [org, user])

  const handleDowngrade = useCallback(async (planId: string) => {
    await handleUpgrade(planId)
  }, [handleUpgrade])

  const handleCancel = useCallback(async (_reason: string, _feedback?: string) => {
    const token = getAccessToken()
    if (!token || !subscription.id) return
    const commerce = getCommerce(org.commerceUrl, token)
    await commerce.cancelSubscription(subscription.id)
  }, [subscription.id, org])

  const handleAddPaymentMethod = useCallback(async (method: PaymentMethod) => {
    setPaymentMethods((prev: PaymentMethod[]) => [...prev, method])
  }, [])

  const handleRemovePaymentMethod = useCallback(async (id: string) => {
    setPaymentMethods((prev: PaymentMethod[]) => prev.filter((m) => m.id !== id))
  }, [])

  const handleSetDefaultPaymentMethod = useCallback(async (id: string) => {
    setPaymentMethods((prev: PaymentMethod[]) =>
      prev.map((m) => ({ ...m, is_default: m.id === id, isDefault: m.id === id }))
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

        <BalancePanel balance={balance} onAddFunds={handleAddFunds} />

        <div className="mt-6">
          <BillingWorkspace
            subscription={subscription}
            plans={plans}
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
            <a href="https://docs.hanzo.ai" target="_blank" rel="noreferrer" className="transition hover:text-text-muted">Docs</a>
            <a href="https://hanzo.ai" target="_blank" rel="noreferrer" className="transition hover:text-text-muted">Hanzo</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
