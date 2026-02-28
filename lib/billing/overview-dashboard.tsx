'use client'

import * as React from 'react'
import { useEffect, useRef } from 'react'
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

function fmtMonth(d: Date | string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function daysUntil(d: Date | string) {
  const diff = new Date(d).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
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

/* ── Quick action definitions ─────────────────────────────────── */
const quickActions: Array<{ label: string; desc: string; section: string; icon: React.ReactNode }> = [
  {
    label: 'View Usage',
    desc: 'Monitor API usage and costs',
    section: 'usage',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 5-9" /></svg>,
  },
  {
    label: 'Manage Plan',
    desc: 'View or change your subscription',
    section: 'pricing',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /></svg>,
  },
  {
    label: 'Add Credits',
    desc: 'Purchase or redeem credits',
    section: 'credits',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /><path d="M16.71 13.88l.7.71-2.82 2.82" /></svg>,
  },
  {
    label: 'View Invoices',
    desc: 'Download and review invoices',
    section: 'invoices',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h4" /></svg>,
  },
  {
    label: 'Set Budget Alert',
    desc: 'Get notified at spend thresholds',
    section: 'alerts',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>,
  },
  {
    label: 'Payment Methods',
    desc: 'Add or manage payment methods',
    section: 'payment',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>,
  },
]

/* ── Main component ─────────────────────────────────────────── */
export function OverviewDashboard(props: OverviewDashboardProps) {
  const currentPlan = props.plans.find(p => p.id === props.subscription.planId)
  const mtdSpend = props.usage?.totalCost ?? 0
  const currency = props.usage?.currency ?? 'usd'
  const periodEnd = props.subscription.currentPeriodEnd
  const daysLeft = daysUntil(periodEnd)
  const totalCreditsRemaining = (props.balance?.available ?? 0) / 100
  const defaultPm = props.paymentMethods.find(m => m.is_default || m.isDefault) ?? props.paymentMethods[0]

  // Trial status
  const isTrialing = props.subscription.status === 'trialing'
  const trialDaysLeft = isTrialing ? daysUntil(props.subscription.currentPeriodEnd) : 0

  // Deterministic bar chart heights
  const barHeights = React.useMemo(() =>
    Array.from({ length: 28 }, (_, i) =>
      mtdSpend > 0 ? Math.max((i * 137 + 17) % 100, 4) : (i % 3 === 0 ? 2 : 1)
    ),
  [mtdSpend])

  return (
    <div className="space-y-6">
      {/* ── Trial banner ── */}
      {isTrialing && (
        <FadeIn delay={0}>
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-sky-400">Free trial active</p>
              <p className="text-[13px] text-white/50 mt-1">
                {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} remaining — add a payment method to continue after your trial.
              </p>
            </div>
            <button
              type="button"
              onClick={() => props.onNavigate('payment')}
              className="rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 active:scale-[0.97] flex-shrink-0"
            >
              Add payment method
            </button>
          </div>
        </FadeIn>
      )}

      {/* ── Welcome banner for new users ── */}
      {!isTrialing && mtdSpend === 0 && totalCreditsRemaining > 0 && !props.subscription.id && (
        <FadeIn delay={0}>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="text-emerald-400">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                  <path d="M20 3v4" /><path d="M22 5h-4" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-emerald-400">Welcome to Hanzo</p>
            </div>
            <p className="text-[13px] text-white/50">
              You have <span className="text-emerald-400 font-semibold">{fmt(totalCreditsRemaining)} in free credits</span> to get started.
              Explore the API, build something, or start a 7-day free trial on any plan.
            </p>
            <button
              type="button"
              onClick={() => props.onNavigate('pricing')}
              className="mt-3 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-white/90 active:scale-[0.97]"
            >
              Start 7-day free trial
            </button>
          </div>
        </FadeIn>
      )}

      {/* ── Card 1: Current billing cycle ── */}
      <FadeIn delay={0}>
        <div className="rounded-2xl border border-white/[0.08] bg-[#141419] overflow-hidden transition-colors duration-200 hover:border-white/[0.12]">
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <h3 className="text-[15px] font-semibold text-white">Current billing cycle</h3>
              <span className="text-sm text-white/50">{fmtMonth(periodEnd)}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5">
                <div className="flex items-baseline justify-between mb-4">
                  <span className="text-sm text-white/60">API spend</span>
                  <span className="text-lg font-semibold text-white tabular-nums">{fmt(mtdSpend, currency)}</span>
                </div>
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
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 flex items-center justify-center">
                {mtdSpend === 0 ? (
                  <p className="text-sm text-white/30">No API usage yet.</p>
                ) : (
                  <button type="button" onClick={() => props.onNavigate('usage')} className="text-center group">
                    <div className="text-white/40 mb-2 group-hover:text-white/60 transition-colors">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="12" width="4" height="9" rx="1" /><rect x="10" y="7" width="4" height="14" rx="1" /><rect x="17" y="3" width="4" height="18" rx="1" />
                      </svg>
                    </div>
                    <p className="text-sm text-white/50 group-hover:text-white/70 transition-colors">View usage breakdown</p>
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-white/[0.06] px-6 py-3 flex items-center justify-between bg-white/[0.02]">
            <p className="text-[13px] text-white/40">
              Your next billing period starts in <span className="text-white/60 font-medium">{daysLeft} day{daysLeft !== 1 ? 's' : ''}</span>
            </p>
            <button
              type="button"
              onClick={() => props.onNavigate('usage')}
              className="text-[13px] text-white/40 hover:text-white/60 transition-colors"
            >
              View details
            </button>
          </div>
        </div>
      </FadeIn>

      {/* ── Card 2: Quick stats ── */}
      <FadeIn delay={60}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Credit Balance */}
          <button
            type="button"
            onClick={() => props.onNavigate('credits')}
            className="rounded-2xl border border-white/[0.08] bg-[#141419] p-5 text-left transition-colors hover:border-white/[0.14] group"
          >
            <p className="text-[11px] uppercase tracking-wide text-white/30 mb-2">Credit Balance</p>
            <p className="text-xl font-semibold text-white tabular-nums">{fmt(totalCreditsRemaining)}</p>
            <p className="text-[13px] text-white/40 mt-1 group-hover:text-white/50 transition-colors">
              {props.creditGrants.filter(g => g.active && !g.voided).length} active grant{props.creditGrants.filter(g => g.active && !g.voided).length !== 1 ? 's' : ''}
            </p>
          </button>

          {/* Current Plan */}
          <button
            type="button"
            onClick={() => props.onNavigate('pricing')}
            className="rounded-2xl border border-white/[0.08] bg-[#141419] p-5 text-left transition-colors hover:border-white/[0.14] group"
          >
            <p className="text-[11px] uppercase tracking-wide text-white/30 mb-2">Current Plan</p>
            <p className="text-xl font-semibold text-white">{currentPlan?.name ?? 'Pay-as-you-go'}</p>
            <p className="text-[13px] text-white/40 mt-1 group-hover:text-white/50 transition-colors">
              {isTrialing ? `Trial · ${trialDaysLeft}d left` : currentPlan ? 'Active' : 'No subscription'}
            </p>
          </button>

          {/* Payment Method */}
          <button
            type="button"
            onClick={() => props.onNavigate('payment')}
            className="rounded-2xl border border-white/[0.08] bg-[#141419] p-5 text-left transition-colors hover:border-white/[0.14] group"
          >
            <p className="text-[11px] uppercase tracking-wide text-white/30 mb-2">Payment Method</p>
            <p className="text-xl font-semibold text-white">
              {defaultPm?.card ? `•••• ${defaultPm.card.last4}` : defaultPm ? 'Active' : 'None'}
            </p>
            <p className="text-[13px] text-white/40 mt-1 group-hover:text-white/50 transition-colors">
              {defaultPm?.card ? `${defaultPm.card.brand}` : defaultPm ? defaultPm.type : 'Add a payment method'}
            </p>
          </button>
        </div>
      </FadeIn>

      {/* ── Card 3: Quick actions ── */}
      <FadeIn delay={120}>
        <div className="rounded-2xl border border-white/[0.08] bg-[#141419] overflow-hidden">
          <div className="px-6 py-5">
            <h3 className="text-[15px] font-semibold text-white">Quick actions</h3>
          </div>
          <div className="border-t border-white/[0.06]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {quickActions.map((action, i) => (
                <button
                  key={action.section}
                  type="button"
                  onClick={() => props.onNavigate(action.section)}
                  className="flex items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-white/[0.03] border-b border-r border-white/[0.06] last:border-b-0 group"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-white/40 group-hover:text-white/60 group-hover:bg-white/[0.06] transition-colors">
                    {action.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white group-hover:text-white transition-colors">{action.label}</p>
                    <p className="text-[13px] text-white/30 group-hover:text-white/40 transition-colors">{action.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  )
}
