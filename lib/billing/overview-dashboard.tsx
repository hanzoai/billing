'use client'

import * as React from 'react'
import { useState, useEffect, useRef } from 'react'
import { SubscriptionPortal } from './subscription-portal'
import { BusinessProfilePanel } from './business-profile-panel'
import { PaymentMethodManager } from './payment-manager'
import type {
  Subscription,
  SubscriptionPlan,
  PaymentMethod,
  UsageSummary,
  CreditGrant,
  Invoice,
  SpendAlert,
  DiscountCode,
  BusinessProfile,
} from './types'
import type { Balance } from '../commerce-client'

export interface OverviewDashboardProps {
  subscription: Subscription
  plans: SubscriptionPlan[]
  paymentMethods: PaymentMethod[]
  usage: UsageSummary | null
  usageLoading: boolean
  balance: Balance | null
  creditGrants: CreditGrant[]
  creditBalance: number
  starterCredit: CreditGrant | null
  onAddFunds: (amount: number) => Promise<void>
  onClaimStarterCredit?: () => Promise<void>
  isAdmin: boolean
  onGrantCredit?: (email: string, amount: number) => Promise<void>
  userEmail: string
  invoices: Invoice[]
  spendAlerts: SpendAlert[]
  onNavigate: (target: string) => void
  onUpgrade?: (planId: string) => Promise<void>
  onDowngrade?: (planId: string) => Promise<void>
  onCancel?: (reason: string, feedback?: string) => Promise<void>
  onApplyDiscount?: (code: string) => Promise<DiscountCode | null>
  businessProfile: BusinessProfile
  onSaveBusinessProfile?: (profile: BusinessProfile) => Promise<void>
  onAddPaymentMethod?: (method: PaymentMethod) => Promise<void>
  onRemovePaymentMethod?: (id: string) => Promise<void>
  onSetDefaultPaymentMethod?: (id: string) => Promise<void>
}

function fmt(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtMonth(d: Date | string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function daysUntil(d: Date | string) {
  const diff = new Date(d).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

/* ── Circular progress ring ─────────────────────────────────── */
function CircularProgress({
  value,
  max,
  size = 64,
  strokeWidth = 5,
  className = '',
}: {
  value: number
  max: number
  size?: number
  strokeWidth?: number
  className?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  const [offset, setOffset] = useState(circumference)

  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      setOffset(circumference - pct * circumference)
    })
    return () => cancelAnimationFrame(timer)
  }, [pct, circumference])

  return (
    <svg width={size} height={size} className={className}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-white/10"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="text-white transition-[stroke-dashoffset] duration-1000 ease-out"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}

/* ── Fade-in animation wrapper ──────────────────────────────── */
function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.opacity = '0'
    el.style.transform = 'translateY(8px)'
    const timer = setTimeout(() => {
      el.style.transition = 'opacity 0.4s ease, transform 0.4s ease'
      el.style.opacity = '1'
      el.style.transform = 'translateY(0)'
    }, delay)
    return () => clearTimeout(timer)
  }, [delay])
  return <div ref={ref} className={className}>{children}</div>
}

/* ── Icons ──────────────────────────────────────────────────── */
const Icons = {
  chart: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 5-9" />
    </svg>
  ),
  barChart: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="12" width="4" height="9" rx="1" /><rect x="10" y="7" width="4" height="14" rx="1" /><rect x="17" y="3" width="4" height="18" rx="1" />
    </svg>
  ),
  creditCard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
    </svg>
  ),
  coins: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /><path d="M16.71 13.88l.7.71-2.82 2.82" />
    </svg>
  ),
  receipt: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h4" />
    </svg>
  ),
  shield: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  ),
  sparkles: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" /><path d="M22 5h-4" />
    </svg>
  ),
  arrow: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7" /><path d="M7 7h10v10" />
    </svg>
  ),
  user: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  mail: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  chevronRight: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  ),
}

/* ── Main component ─────────────────────────────────────────── */
export function OverviewDashboard(props: OverviewDashboardProps) {
  const [showPlanPicker, setShowPlanPicker] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showAddPayment, setShowAddPayment] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [applyingPromo, setApplyingPromo] = useState(false)
  const [purchaseAmount, setPurchaseAmount] = useState('')
  const [purchasing, setPurchasing] = useState(false)

  const currentPlan = props.plans.find(p => p.id === props.subscription.planId)
  const mtdSpend = props.usage?.totalCost ?? 0
  const currency = props.usage?.currency ?? 'usd'
  const periodEnd = props.subscription.currentPeriodEnd
  const daysLeft = daysUntil(periodEnd)

  // Credit calculations
  const freeCreditsTotal = props.creditGrants
    .filter(g => g.active && !g.voided && (g.name?.toLowerCase().includes('free') || g.name?.toLowerCase().includes('starter')))
    .reduce((sum, g) => sum + (g.amountCents ?? 0), 0) / 100
  const freeCreditsRemaining = props.creditGrants
    .filter(g => g.active && !g.voided && (g.name?.toLowerCase().includes('free') || g.name?.toLowerCase().includes('starter')))
    .reduce((sum, g) => sum + (g.remainingCents ?? 0), 0) / 100
  const purchasedCreditsTotal = props.creditGrants
    .filter(g => g.active && !g.voided && !g.name?.toLowerCase().includes('free') && !g.name?.toLowerCase().includes('starter'))
    .reduce((sum, g) => sum + (g.amountCents ?? 0), 0) / 100
  const purchasedCreditsRemaining = props.creditGrants
    .filter(g => g.active && !g.voided && !g.name?.toLowerCase().includes('free') && !g.name?.toLowerCase().includes('starter'))
    .reduce((sum, g) => sum + (g.remainingCents ?? 0), 0) / 100
  const totalCreditsRemaining = (props.balance?.available ?? 0) / 100

  // Spend limit
  const topAlert = props.spendAlerts.length > 0
    ? props.spendAlerts.reduce((a, b) => a.threshold > b.threshold ? a : b)
    : null
  const spendLimit = topAlert?.threshold ?? 50
  const spendPct = Math.min((mtdSpend / spendLimit) * 100, 100)
  const spendRemaining = Math.max(spendLimit - mtdSpend, 0)

  // Default payment method
  const defaultPm = props.paymentMethods.find(m => m.is_default || m.isDefault) ?? props.paymentMethods[0]

  // Latest invoices (max 5)
  const latestInvoices = props.invoices.slice(0, 5)

  const handleApplyPromo = async (code: string) => {
    if (!props.onApplyDiscount || !code.trim()) return
    setApplyingPromo(true)
    try {
      await props.onApplyDiscount(code.trim())
    } finally {
      setApplyingPromo(false)
    }
  }

  const handlePurchaseCredits = async (value: string) => {
    const amount = parseFloat(value)
    if (!amount || amount <= 0) return
    setPurchasing(true)
    try {
      await props.onAddFunds(amount)
    } finally {
      setPurchasing(false)
    }
  }

  // Deterministic bar chart heights (avoids hydration mismatch from Math.random)
  const barHeights = React.useMemo(() =>
    Array.from({ length: 28 }, (_, i) =>
      mtdSpend > 0 ? Math.max((i * 137 + 17) % 100, 4) : (i % 3 === 0 ? 2 : 1)
    ),
  [mtdSpend])

  return (
    <div className="space-y-6">
      {/* ── Card 1: Current billing cycle ── */}
      <FadeIn delay={0}>
        <div className="rounded-2xl border border-white/[0.08] bg-[#141419] overflow-hidden transition-colors duration-200 hover:border-white/[0.12]">
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <h3 className="text-[15px] font-semibold text-white">Current billing cycle</h3>
              <span className="text-sm text-white/50">{fmtMonth(periodEnd)}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: spend + chart area */}
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5">
                <div className="flex items-baseline justify-between mb-4">
                  <span className="text-sm text-white/60">API spend</span>
                  <span className="text-lg font-semibold text-white tabular-nums">{fmt(mtdSpend, currency)}</span>
                </div>
                {/* Mini chart placeholder */}
                <div className="h-16 flex items-end gap-[3px] mb-4">
                  {barHeights.map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-white/[0.08] transition-all duration-500"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <div className="flex items-baseline justify-between pt-3 border-t border-white/[0.06]">
                  <span className="text-sm text-white/60">Next invoice (API)</span>
                  <span className="text-lg font-semibold text-white tabular-nums">{fmt(mtdSpend, currency)}</span>
                </div>
              </div>
              {/* Right: no usage or usage chart */}
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 flex items-center justify-center">
                {mtdSpend === 0 ? (
                  <p className="text-sm text-white/30">No API usage.</p>
                ) : (
                  <div className="text-center">
                    <div className="text-white/40 mb-2">{Icons.barChart}</div>
                    <p className="text-sm text-white/50">Usage breakdown</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-white/[0.06] px-6 py-3 flex items-center justify-between bg-white/[0.02]">
            <p className="text-[13px] text-white/40">
              Your next billing period starts in <span className="text-white/60 font-medium">{daysLeft} day{daysLeft !== 1 ? 's' : ''}</span>
            </p>
            <div className="flex gap-1.5">
              <button type="button" aria-label="View line chart" className="p-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all">
                {Icons.chart}
              </button>
              <button type="button" aria-label="View bar chart" className="p-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all">
                {Icons.barChart}
              </button>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* ── Card 2: API credits ── */}
      <FadeIn delay={60}>
        <div className="rounded-2xl border border-white/[0.08] bg-[#141419] overflow-hidden transition-colors duration-200 hover:border-white/[0.12]">
          <div className="p-6">
            <h3 className="text-[15px] font-semibold text-white mb-1">API credits</h3>
            <p className="text-[13px] text-white/40 mb-6">You can add credits to pay for API usage</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:divide-x divide-white/[0.06]">
              {/* Free credits */}
              <div className="pr-0 md:pr-6 pb-6 md:pb-0">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-sm font-medium text-white">Free credits</span>
                  <span className="text-xl font-semibold text-white tabular-nums">{fmt(freeCreditsRemaining)}</span>
                </div>
                <p className="text-[13px] text-white/40 leading-relaxed mb-4">
                  Credits you have been granted<br />from Hanzo to use on our API.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={e => setPromoCode(e.target.value)}
                    placeholder="Enter code"
                    className="w-28 rounded-full border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/[0.25]"
                  />
                  <button
                    type="button"
                    disabled={!promoCode.trim() || applyingPromo}
                    onClick={() => handleApplyPromo(promoCode)}
                    className="rounded-full border border-white/[0.15] px-4 py-1.5 text-[13px] font-medium text-white/80 transition-all hover:bg-white/[0.06] hover:border-white/[0.25] active:scale-[0.97] disabled:opacity-40"
                  >
                    {applyingPromo ? 'Redeeming...' : 'Redeem promo code'}
                  </button>
                </div>
              </div>
              {/* Purchased credits */}
              <div className="pl-0 md:pl-6 pt-6 md:pt-0 border-t md:border-t-0 border-white/[0.06]">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-sm font-medium text-white">Purchased credits</span>
                  <span className="text-xl font-semibold text-white tabular-nums">{fmt(purchasedCreditsRemaining)}</span>
                </div>
                <p className="text-[13px] text-white/40 leading-relaxed mb-4">
                  Credits your team has purchased.<br />They are non-refundable.
                </p>
                <div className="flex gap-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-white/30">$</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={purchaseAmount}
                      onChange={e => setPurchaseAmount(e.target.value)}
                      placeholder="0"
                      className="w-20 rounded-full border border-white/[0.12] bg-white/[0.03] pl-6 pr-3 py-1.5 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/[0.25]"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!purchaseAmount || purchasing}
                    onClick={() => handlePurchaseCredits(purchaseAmount)}
                    className="rounded-full border border-white/[0.15] px-4 py-1.5 text-[13px] font-medium text-white/80 transition-all hover:bg-white/[0.06] hover:border-white/[0.25] active:scale-[0.97] disabled:opacity-40"
                  >
                    {purchasing ? 'Purchasing...' : 'Purchase credits'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-white/[0.06] px-6 py-3 bg-white/[0.02]">
            <p className="text-[13px] text-white/40">
              You have <span className="text-white/70 font-semibold">{fmt(totalCreditsRemaining)} credits</span> remaining.
            </p>
          </div>
        </div>
      </FadeIn>

      {/* ── Card 3: Invoiced billing ── */}
      <FadeIn delay={120}>
        <div className="rounded-2xl border border-white/[0.08] bg-[#141419] overflow-hidden transition-colors duration-200 hover:border-white/[0.12]">
          <div className="p-6">
            <div className="flex items-start justify-between mb-1">
              <h3 className="text-[15px] font-semibold text-white">Invoiced billing</h3>
              <button
                type="button"
                onClick={() => props.onNavigate('invoices')}
                className="rounded-full border border-white/[0.15] px-4 py-1.5 text-[13px] font-medium text-white/80 transition-all hover:bg-white/[0.06] hover:border-white/[0.25] active:scale-[0.97]"
              >
                Manage
              </button>
            </div>
            <p className="text-[13px] text-white/40 mb-6 max-w-md">
              Automatically invoice your team's usage at the<br />end of each month, up to a specified spend cap.
            </p>
          </div>
          <div className="border-t border-white/[0.06] px-6 py-5">
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-white">Current spend</p>
                <p className="text-lg font-semibold text-white tabular-nums">{fmt(mtdSpend, currency)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-white">Current limit</p>
                <p className="text-lg font-semibold text-white tabular-nums">{fmt(spendLimit)}</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                  spendPct >= 90 ? 'bg-red-500' : spendPct >= 70 ? 'bg-amber-500' : 'bg-blue-500'
                }`}
                style={{ width: `${spendPct}%` }}
              />
            </div>
          </div>
          <div className="border-t border-white/[0.06] px-6 py-3 bg-white/[0.02]">
            <p className="text-[13px] text-white/40">
              You have <span className="text-white/70 font-semibold">{fmt(spendRemaining)}</span> remaining of your spend cap in this billing period
            </p>
          </div>
        </div>
      </FadeIn>

      {/* ── Card 4: Subscriptions ── */}
      <FadeIn delay={180}>
        <div className="rounded-2xl border border-white/[0.08] bg-[#141419] overflow-hidden transition-colors duration-200 hover:border-white/[0.12]">
          <div className="p-6">
            <h3 className="text-[15px] font-semibold text-white mb-5">Subscriptions</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-white">
                  {currentPlan?.name ?? 'Hanzo Business'}
                </p>
                <p className="text-[13px] text-white/40 mt-1 max-w-sm">
                  {currentPlan?.description ?? "Give your team access to Hanzo's most powerful features."}
                </p>
                <button
                  type="button"
                  onClick={() => setShowPlanPicker(!showPlanPicker)}
                  className="mt-4 rounded-full border border-white/[0.15] px-4 py-1.5 text-[13px] font-medium text-white/80 transition-all hover:bg-white/[0.06] hover:border-white/[0.25] active:scale-[0.97]"
                >
                  {currentPlan ? 'Manage subscription' : 'Enable Hanzo Business'}
                </button>
              </div>
              {/* Decorative icon */}
              <div className="hidden md:flex h-16 w-16 items-center justify-center text-white/20">
                {Icons.sparkles}
              </div>
            </div>
          </div>
          {showPlanPicker && (
            <div className="border-t border-white/[0.06] p-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <SubscriptionPortal
                subscription={props.subscription}
                availablePlans={props.plans}
                onUpgrade={props.onUpgrade}
                onDowngrade={props.onDowngrade}
                onCancel={props.onCancel}
                onApplyDiscount={props.onApplyDiscount}
              />
            </div>
          )}
        </div>
      </FadeIn>

      {/* ── Card 5: Billing details ── */}
      <FadeIn delay={240}>
        <div className="rounded-2xl border border-white/[0.08] bg-[#141419] overflow-hidden transition-colors duration-200 hover:border-white/[0.12]">
          <div className="px-6 py-5 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-white">Billing details</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowEditProfile(!showEditProfile); setShowAddPayment(false) }}
                className="rounded-full border border-white/[0.15] px-4 py-1.5 text-[13px] font-medium text-white/80 transition-all hover:bg-white/[0.06] hover:border-white/[0.25] active:scale-[0.97]"
              >
                Edit information
              </button>
              <button
                type="button"
                onClick={() => { setShowAddPayment(!showAddPayment); setShowEditProfile(false) }}
                className="rounded-full border border-white/[0.15] px-4 py-1.5 text-[13px] font-medium text-white/80 transition-all hover:bg-white/[0.06] hover:border-white/[0.25] active:scale-[0.97]"
              >
                {props.paymentMethods.length > 0 ? 'Manage payment methods' : 'Add payment method'}
              </button>
            </div>
          </div>
          {/* Info rows */}
          <div className="border-t border-white/[0.06]">
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.06]">
              <div className="px-6 py-4">
                <p className="text-sm font-medium text-white mb-0.5">Billing email</p>
                <p className="text-[13px] text-white/50">{props.userEmail || '—'}</p>
              </div>
              <div className="px-6 py-4">
                <p className="text-sm font-medium text-white mb-0.5">Billing address</p>
                <p className="text-[13px] text-white/50">
                  {props.businessProfile.registeredAddress?.line1
                    ? `${props.businessProfile.registeredAddress.line1}, ${props.businessProfile.registeredAddress.city}, ${props.businessProfile.registeredAddress.zip}, ${props.businessProfile.registeredAddress.country}`
                    : '—'}
                </p>
              </div>
            </div>
          </div>
          {/* Payment method row */}
          {defaultPm && (
            <div className="border-t border-white/[0.06]">
              <div className="px-6 py-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/40">
                      <th className="py-2 text-left font-medium text-[13px]">Card</th>
                      <th className="py-2 text-left font-medium text-[13px]">Expiry</th>
                      <th className="py-2 text-left font-medium text-[13px]">Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-white/[0.06]">
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500/20 text-green-400">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                          <span className="text-white/70 text-[13px] font-mono">
                            {defaultPm.card ? `${defaultPm.card.brand} •••• ${defaultPm.card.last4}` : props.userEmail}
                          </span>
                          <span className="text-[11px] text-white/30">added {defaultPm.created_at ? fmtDate(defaultPm.created_at) : '—'}</span>
                          <span className="rounded-full border border-white/[0.12] px-2 py-0.5 text-[11px] text-white/50">Default</span>
                        </div>
                      </td>
                      <td className="py-3 text-[13px] text-white/50">
                        {defaultPm.card ? `${defaultPm.card.exp_month}/${defaultPm.card.exp_year}` : '—'}
                      </td>
                      <td className="py-3 text-[13px] text-white/50 font-mono tracking-wider">
                        {defaultPm.billing_details?.name?.toUpperCase() ?? '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* Expandable sections */}
          {showEditProfile && props.onSaveBusinessProfile && (
            <div className="border-t border-white/[0.06] p-6">
              <BusinessProfilePanel
                profile={props.businessProfile}
                onSave={props.onSaveBusinessProfile}
              />
            </div>
          )}
          {showAddPayment && (
            <div className="border-t border-white/[0.06] p-6">
              <PaymentMethodManager
                paymentMethods={props.paymentMethods}
                onAdd={props.onAddPaymentMethod}
                onRemove={props.onRemovePaymentMethod}
                onSetDefault={props.onSetDefaultPaymentMethod}
              />
            </div>
          )}
        </div>
      </FadeIn>

      {/* ── Card 6: Latest invoices ── */}
      <FadeIn delay={300}>
        <div className="rounded-2xl border border-white/[0.08] bg-[#141419] overflow-hidden transition-colors duration-200 hover:border-white/[0.12]">
          <div className="px-6 py-5 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-white">Latest invoices</h3>
            <button
              type="button"
              onClick={() => props.onNavigate('invoices')}
              className="rounded-full border border-white/[0.15] px-4 py-1.5 text-[13px] font-medium text-white/80 transition-all hover:bg-white/[0.06] hover:border-white/[0.25] active:scale-[0.97]"
            >
              View all
            </button>
          </div>
          <div className="border-t border-white/[0.06]">
            {latestInvoices.length === 0 ? (
              <p className="text-sm text-white/30 py-8 text-center">No invoices yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left">
                    <th className="px-6 py-3 text-[13px] font-medium text-white/40">Invoice #</th>
                    <th className="px-6 py-3 text-[13px] font-medium text-white/40">Date</th>
                    <th className="px-6 py-3 text-[13px] font-medium text-white/40">Type</th>
                    <th className="px-6 py-3 text-[13px] font-medium text-white/40 text-right">Amount</th>
                    <th className="px-6 py-3 text-[13px] font-medium text-white/40 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {latestInvoices.map((inv, i) => (
                    <tr
                      key={inv.id}
                      className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-6 py-3.5 text-[13px] text-white font-medium">
                        #{inv.invoiceNumber || inv.number || inv.id.slice(0, 15)}
                      </td>
                      <td className="px-6 py-3.5 text-[13px] text-white/50">{fmtDate(inv.date)}</td>
                      <td className="px-6 py-3.5 text-[13px] text-white/50">
                        {inv.items?.length === 1 ? 'Single Purchase' : 'Monthly Invoice'}
                      </td>
                      <td className="px-6 py-3.5 text-[13px] text-white font-medium text-right tabular-nums">
                        {fmt(inv.total, inv.currency)}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <InvoiceStatusBadge status={inv.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </FadeIn>
    </div>
  )
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const isPaid = status === 'paid' || status === 'active'
  const isFailed = status === 'failed' || status === 'uncollectible'
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
        isPaid
          ? 'bg-white/[0.08] text-white/80'
          : isFailed
            ? 'bg-red-500/15 text-red-400'
            : 'bg-amber-500/15 text-amber-400'
      }`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
