'use client'

import * as React from 'react'
import type {
  BillingMetric,
  Subscription,
  SubscriptionPlan,
  RetentionOffer,
  SubscriptionHistory,
  DiscountCode,
} from './types'

export interface SubscriptionPortalProps {
  subscription: Subscription
  availablePlans: SubscriptionPlan[]
  usageMetrics?: BillingMetric[]
  retentionOffers?: RetentionOffer[]
  subscriptionHistory?: SubscriptionHistory[]
  onUpgrade?: (planId: string) => Promise<void>
  onDowngrade?: (planId: string) => Promise<void>
  onCancel?: (reason: string, feedback?: string) => Promise<void>
  onAcceptOffer?: (offerId: string) => Promise<void>
  onApplyDiscount?: (code: string) => Promise<DiscountCode | null>
  showHistory?: boolean
  defaultView?: 'overview' | 'plans' | 'history'
}

function formatCurrency(value: number, currency: string = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

const statusTone: Record<
  Subscription['status'],
  { label: string; className: string }
> = {
  active: {
    label: 'Active',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  },
  canceled: {
    label: 'Canceled',
    className: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  },
  past_due: {
    label: 'Past due',
    className: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  },
  trialing: {
    label: 'Trialing',
    className: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  },
  unpaid: {
    label: 'Unpaid',
    className: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  },
  incomplete: {
    label: 'Incomplete',
    className: 'bg-zinc-100 text-zinc-700 ring-zinc-600/20',
  },
}

export function SubscriptionPortal(props: SubscriptionPortalProps) {
  const {
    subscription,
    availablePlans,
    usageMetrics = [],
    retentionOffers = [],
    subscriptionHistory = [],
    onUpgrade,
    onDowngrade,
    onCancel,
    onApplyDiscount,
    defaultView = 'overview',
  } = props

  const [view, setView] = React.useState<'overview' | 'plans' | 'history'>(defaultView)
  const [busyPlanId, setBusyPlanId] = React.useState<string | null>(null)

  // Discount code state
  const [discountCode, setDiscountCode] = React.useState('')
  const [applyingDiscount, setApplyingDiscount] = React.useState(false)
  const [discountResult, setDiscountResult] = React.useState<{ success: boolean; message: string } | null>(null)

  // Cancel confirmation
  const [showCancelConfirm, setShowCancelConfirm] = React.useState(false)
  const [cancelReason, setCancelReason] = React.useState('')
  const [canceling, setCanceling] = React.useState(false)

  const currentPlan = React.useMemo(
    () => availablePlans.find((p) => p.id === subscription.planId),
    [availablePlans, subscription.planId],
  )

  const handlePlanChange = React.useCallback(
    async (plan: SubscriptionPlan) => {
      if (!currentPlan || plan.id === currentPlan.id) return
      setBusyPlanId(plan.id)

      try {
        if (plan.price >= currentPlan.price) {
          await onUpgrade?.(plan.id)
        } else {
          await onDowngrade?.(plan.id)
        }
      } finally {
        setBusyPlanId(null)
      }
    },
    [currentPlan, onDowngrade, onUpgrade],
  )

  const handleApplyDiscount = React.useCallback(async () => {
    if (!onApplyDiscount || !discountCode.trim()) return
    setApplyingDiscount(true)
    setDiscountResult(null)
    try {
      const result = await onApplyDiscount(discountCode.trim())
      if (result && result.valid) {
        const desc = result.kind === 'percent'
          ? `${result.value}% off`
          : `${formatCurrency(result.value)} off`
        setDiscountResult({ success: true, message: `Applied: ${result.name || result.code} (${desc})` })
        setDiscountCode('')
      } else {
        setDiscountResult({ success: false, message: 'Invalid or expired discount code' })
      }
    } catch (err) {
      setDiscountResult({ success: false, message: err instanceof Error ? err.message : 'Failed to apply code' })
    } finally {
      setApplyingDiscount(false)
    }
  }, [onApplyDiscount, discountCode])

  const handleCancel = React.useCallback(async () => {
    if (!onCancel || !cancelReason.trim()) return
    setCanceling(true)
    try {
      await onCancel(cancelReason.trim())
      setShowCancelConfirm(false)
      setCancelReason('')
    } finally {
      setCanceling(false)
    }
  }, [onCancel, cancelReason])

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Subscription
            </p>
            <h2 className="text-2xl font-semibold text-zinc-900">
              {currentPlan?.name ?? 'No active plan'}
            </h2>
            <p className="text-sm text-zinc-600">
              {subscription.id
                ? `Billing period ends on ${formatDate(subscription.currentPeriodEnd)}`
                : 'Select a plan to get started'}
            </p>
            {subscription.discount && (
              <p className="text-sm text-emerald-600">
                Discount: {subscription.discount.name || subscription.discount.code} (
                {subscription.discount.kind === 'percent'
                  ? `${subscription.discount.value}% off`
                  : `${formatCurrency(subscription.discount.value)} off`}
                {subscription.discount.duration === 'repeating' && subscription.discount.durationInMonths
                  ? ` for ${subscription.discount.durationInMonths} months`
                  : subscription.discount.duration === 'forever'
                    ? ' forever'
                    : ''})
              </p>
            )}
          </div>
          {subscription.id && (
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusTone[subscription.status].className}`}
            >
              {statusTone[subscription.status].label}
            </span>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setView('overview')}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              view === 'overview'
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setView('plans')}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              view === 'plans'
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            Plans
          </button>
          <button
            type="button"
            onClick={() => setView('history')}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              view === 'history'
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            History
          </button>
        </div>
      </div>

      {view === 'overview' && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Current spend</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">
              {formatCurrency(currentPlan?.price ?? 0)}
              <span className="text-sm font-normal text-zinc-500">/{currentPlan?.billingPeriod ?? 'monthly'}</span>
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Next invoice</p>
            <p className="mt-2 text-lg font-semibold text-zinc-900">
              {subscription.id ? formatDate(subscription.currentPeriodEnd) : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Status</p>
            <p className="mt-2 text-lg font-semibold text-zinc-900">
              {subscription.cancelAtPeriodEnd
                ? 'Cancels at period end'
                : subscription.id
                  ? 'Auto-renewing'
                  : 'No subscription'}
            </p>
          </div>

          {/* Discount code */}
          {onApplyDiscount && subscription.id && (
            <div className="md:col-span-3 rounded-xl border border-zinc-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Discount code</p>
              <div className="mt-3 flex gap-2">
                <input
                  value={discountCode}
                  onChange={(e) => {
                    setDiscountCode(e.target.value.toUpperCase())
                    setDiscountResult(null)
                  }}
                  placeholder="Enter promo code"
                  className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono uppercase outline-none transition focus:border-zinc-900"
                />
                <button
                  type="button"
                  disabled={!discountCode.trim() || applyingDiscount}
                  onClick={handleApplyDiscount}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {applyingDiscount ? 'Applying…' : 'Apply'}
                </button>
              </div>
              {discountResult && (
                <p className={`mt-2 text-sm ${discountResult.success ? 'text-emerald-600' : 'text-red-600'}`}>
                  {discountResult.message}
                </p>
              )}
            </div>
          )}

          {usageMetrics.length > 0 && (
            <div className="md:col-span-3 rounded-xl border border-zinc-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Usage metrics</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {usageMetrics.map((metric) => {
                  const utilization =
                    metric.limit && metric.limit > 0
                      ? Math.min((metric.current / metric.limit) * 100, 100)
                      : 0
                  return (
                    <div key={metric.id} className="rounded-lg border border-zinc-200 p-3">
                      <p className="text-sm text-zinc-600">{metric.label}</p>
                      <p className="mt-1 text-lg font-semibold text-zinc-900">
                        {metric.current.toLocaleString()}
                        {metric.unit ? ` ${metric.unit}` : ''}
                      </p>
                      {metric.limit ? (
                        <>
                          <p className="text-xs text-zinc-500">
                            of {metric.limit.toLocaleString()} {metric.unit ?? ''}
                          </p>
                          <div className="mt-2 h-2 rounded-full bg-zinc-100">
                            <div
                              className="h-2 rounded-full bg-zinc-900"
                              style={{ width: `${utilization}%` }}
                            />
                          </div>
                        </>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {retentionOffers.length > 0 && (
            <div className="md:col-span-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <p className="text-xs uppercase tracking-wide text-amber-700">Retention offers</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {retentionOffers.map((offer) => (
                  <div key={offer.id} className="rounded-lg border border-amber-200 bg-white p-3">
                    <p className="font-medium text-zinc-900">{offer.title}</p>
                    <p className="mt-1 text-sm text-zinc-600">{offer.description}</p>
                    <p className="mt-2 text-sm font-semibold text-amber-700">
                      Save {offer.discount}% for {offer.durationMonths} months
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cancel subscription */}
          {subscription.id && subscription.status === 'active' && !subscription.cancelAtPeriodEnd && onCancel && (
            <div className="md:col-span-3">
              {showCancelConfirm ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                  <p className="text-sm font-medium text-rose-900">Cancel subscription</p>
                  <p className="mt-1 text-sm text-rose-700">
                    Your subscription will remain active until {formatDate(subscription.currentPeriodEnd)}.
                  </p>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Why are you canceling? (required)"
                    rows={2}
                    className="mt-3 w-full rounded-lg border border-rose-200 px-3 py-2 text-sm outline-none transition focus:border-rose-400"
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={!cancelReason.trim() || canceling}
                      onClick={handleCancel}
                      className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {canceling ? 'Canceling…' : 'Confirm cancellation'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCancelConfirm(false)
                        setCancelReason('')
                      }}
                      className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
                    >
                      Keep subscription
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  className="text-sm text-zinc-500 transition hover:text-rose-600"
                >
                  Cancel subscription
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {view === 'plans' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {availablePlans.map((plan) => {
            const isCurrent = plan.id === subscription.planId
            const isBusy = busyPlanId === plan.id
            const isFree = plan.price === 0
            const periodPrice = isFree ? 'Free' : `${formatCurrency(plan.price)}/${plan.billingPeriod}`

            return (
              <div
                key={plan.id}
                className={`relative rounded-xl border p-5 ${
                  plan.highlighted && !isCurrent
                    ? 'border-2 border-zinc-900 bg-white text-zinc-900'
                    : isCurrent
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-white text-zinc-900'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold">{plan.name}</p>
                    <p className={`text-sm ${isCurrent ? 'text-zinc-300' : 'text-zinc-600'}`}>
                      {plan.description}
                    </p>
                  </div>
                  {plan.badge ? (
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        isCurrent ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      {plan.badge}
                    </span>
                  ) : null}
                </div>

                <p className="mt-4 text-2xl font-semibold">{periodPrice}</p>

                <ul className={`mt-4 space-y-2 text-sm ${isCurrent ? 'text-zinc-200' : 'text-zinc-700'}`}>
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className={`mt-0.5 ${isCurrent ? 'text-zinc-400' : 'text-emerald-500'}`}>✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={isCurrent || isBusy}
                  onClick={() => handlePlanChange(plan)}
                  className={`mt-5 w-full rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isCurrent
                      ? 'cursor-not-allowed bg-zinc-700 text-zinc-300'
                      : isBusy
                        ? 'cursor-wait bg-zinc-300 text-zinc-600'
                        : plan.highlighted
                          ? 'bg-zinc-900 text-white hover:bg-zinc-700'
                          : 'bg-zinc-900 text-white hover:bg-zinc-700'
                  }`}
                >
                  {isCurrent
                    ? 'Current plan'
                    : isBusy
                      ? 'Applying…'
                      : currentPlan && plan.price < currentPlan.price
                        ? 'Downgrade'
                        : 'Upgrade'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {view === 'history' && (
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-zinc-900">Subscription timeline</h3>
          </div>
          {subscriptionHistory.length === 0 ? (
            <div className="p-6 text-sm text-zinc-500">No history entries yet.</div>
          ) : (
            <div className="divide-y divide-zinc-200">
              {subscriptionHistory.map((entry) => (
                <div key={entry.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{entry.action}</p>
                    <p className="text-sm text-zinc-600">{entry.details}</p>
                    {entry.fromPlan || entry.toPlan ? (
                      <p className="text-xs text-zinc-500">
                        {entry.fromPlan ?? '—'} → {entry.toPlan ?? '—'}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-xs text-zinc-500">{formatDate(entry.date)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
