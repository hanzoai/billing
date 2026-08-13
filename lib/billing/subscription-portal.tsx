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
  /** Plans are still loading from the catalog — render a skeleton grid */
  plansLoading?: boolean
  /**
   * Caller may create paid-tier subscriptions directly (platform admin) via the
   * mint-gated POST /v1/billing/subscriptions. When false, paid plans run the
   * self-serve card checkout (Square nonce → POST subscribe/card).
   */
  canDirectSubscribe?: boolean
  usageMetrics?: BillingMetric[]
  retentionOffers?: RetentionOffer[]
  subscriptionHistory?: SubscriptionHistory[]
  onUpgrade?: (planId: string) => Promise<void>
  onDowngrade?: (planId: string) => Promise<void>
  onCancel?: (reason: string, feedback?: string) => Promise<void>
  onAcceptOffer?: (offerId: string) => Promise<void>
  onApplyDiscount?: (code: string) => Promise<DiscountCode | null>
  /**
   * Self-serve paid checkout: charge a fresh Square nonce OR a saved card and
   * start the subscription. Rejects with a CommerceApiError carrying the HTTP
   * status for honest UI.
   */
  onSubscribeWithCard?: (planId: string, card: CardInput, quantity: number, idempotencyKey: string) => Promise<void>
  /** Cards already on file, offered in the checkout before the blank form. */
  savedCards?: SavedCard[]
  /**
   * Logged-out public pricing: every plan CTA calls this (start sign-in) instead
   * of subscribing. Auth gates the subscribe action, not viewing prices.
   */
  onRequireAuth?: () => void
  showHistory?: boolean
  defaultView?: 'overview' | 'plans' | 'history'
}

import { SubscribeCardForm, type SavedCard } from './subscribe-card-form'
import type { CardInput } from '@/lib/commerce-client'
import { cents, money } from '@/lib/money'

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
    className: 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20',
  },
  canceled: {
    label: 'Canceled',
    className: 'bg-rose-500/10 text-rose-500 ring-rose-500/20',
  },
  past_due: {
    label: 'Past due',
    className: 'bg-amber-500/10 text-amber-500 ring-amber-500/20',
  },
  trialing: {
    label: 'Trialing',
    className: 'bg-sky-500/10 text-sky-500 ring-sky-500/20',
  },
  unpaid: {
    label: 'Unpaid',
    className: 'bg-rose-500/10 text-rose-500 ring-rose-500/20',
  },
  incomplete: {
    label: 'Incomplete',
    className: 'bg-text-dim/10 text-text-muted ring-text-dim/20',
  },
}

export function SubscriptionPortal(props: SubscriptionPortalProps) {
  const {
    subscription,
    availablePlans,
    plansLoading = false,
    canDirectSubscribe = false,
    usageMetrics = [],
    retentionOffers = [],
    subscriptionHistory = [],
    onUpgrade,
    onDowngrade,
    onCancel,
    onApplyDiscount,
    onSubscribeWithCard,
    savedCards = [],
    onRequireAuth,
    defaultView = 'overview',
  } = props

  const [view, setView] = React.useState<'overview' | 'plans' | 'history'>(defaultView)
  // AUDIENCE and INTERVAL are the two axes the catalog already carries, surfaced
  // as controls instead of as more cards. Six tiers in one row asked a visitor to
  // compare a $9 personal plan against a negotiated enterprise contract; they are
  // different purchases and now sit on different tabs.
  const [audience, setAudience] = React.useState<'personal' | 'business'>('personal')
  const [interval, setInterval] = React.useState<'monthly' | 'annual'>('monthly')
  const [busyPlanId, setBusyPlanId] = React.useState<string | null>(null)
  const [planError, setPlanError] = React.useState<string | null>(null)
  // Paid plan whose self-serve card checkout panel is open.
  const [activationPlanId, setActivationPlanId] = React.useState<string | null>(null)
  // Paid plan whose org has no payment processor (422) — show the contact fallback.
  const [noProcessorPlanId, setNoProcessorPlanId] = React.useState<string | null>(null)
  // Seat count per per-seat plan id, defaulting to the plan minimum
  const [seatCounts, setSeatCounts] = React.useState<Record<string, number>>({})

  // Discount code state
  const [discountCode, setDiscountCode] = React.useState('')
  const [applyingDiscount, setApplyingDiscount] = React.useState(false)
  const [discountResult, setDiscountResult] = React.useState<{ success: boolean; message: string } | null>(null)

  // Cancel confirmation
  const [showCancelConfirm, setShowCancelConfirm] = React.useState(false)
  const [cancelReason, setCancelReason] = React.useState('')
  const [canceling, setCanceling] = React.useState(false)

  // Segment on the CATALOG's own category, never on a heuristic. `personal` is the
  // self-serve ladder; everything else (team, enterprise) is bought differently —
  // seats or a conversation. A category the catalog adds tomorrow lands under
  // Business without an edit here, which is the point of reading it rather than
  // listing the four ids.
  const personalPlans = React.useMemo(
    () => availablePlans.filter((p) => (p.category ?? 'personal') === 'personal'),
    [availablePlans],
  )
  const businessPlans = React.useMemo(
    () => availablePlans.filter((p) => (p.category ?? 'personal') !== 'personal'),
    [availablePlans],
  )
  const shownPlans = audience === 'personal' ? personalPlans : businessPlans

  // Annual is only offered when the catalog actually prices it. A toggle that
  // silently showed the monthly figure under an "Annual" label would be a lie in
  // the one place a customer is deciding what to pay.
  const annualAvailable = React.useMemo(
    () => availablePlans.some((p) => (p.annualPrice ?? 0) > 0),
    [availablePlans],
  )
  // The per-month figure to display for a plan under the chosen interval.
  const shownPrice = React.useCallback(
    (p: SubscriptionPlan) => (interval === 'annual' && p.annualPrice ? p.annualPrice : p.price),
    [interval],
  )

  const currentPlan = React.useMemo(
    () => availablePlans.find((p) => p.id === subscription.planId),
    [availablePlans, subscription.planId],
  )

  const handlePlanChange = React.useCallback(
    async (plan: SubscriptionPlan) => {
      // External / contact-sales plans (marketing CTA — no auth needed).
      if (plan.externalUrl) {
        window.open(plan.externalUrl, '_blank', 'noopener,noreferrer')
        return
      }
      // Logged-out public pricing: viewing is open, subscribing needs sign-in.
      if (onRequireAuth) {
        onRequireAuth()
        return
      }
      if (plan.id === currentPlan?.id) return
      setPlanError(null)

      // Paid tier, self-serve: open the Square card checkout panel (toggle).
      if (plan.price > 0 && !canDirectSubscribe && onSubscribeWithCard) {
        setNoProcessorPlanId(null)
        setActivationPlanId((prev) => (prev === plan.id ? null : plan.id))
        return
      }

      // Free tiers (and platform admins) subscribe directly.
      setBusyPlanId(plan.id)
      try {
        if (!currentPlan || plan.price >= (currentPlan?.price ?? 0)) {
          await onUpgrade?.(plan.id)
        } else {
          await onDowngrade?.(plan.id)
        }
      } catch (err) {
        setPlanError(err instanceof Error ? err.message : 'Plan change failed')
      } finally {
        setBusyPlanId(null)
      }
    },
    [currentPlan, onDowngrade, onUpgrade, canDirectSubscribe, onSubscribeWithCard, onRequireAuth],
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
          : `${money(result.value, 'USD', 0)} off`
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
      <div className="overflow-hidden rounded-2xl border border-border bg-bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Subscription
            </p>
            <h2 className="text-2xl font-semibold text-text">
              {currentPlan?.name ?? 'No active plan'}
            </h2>
            <p className="text-sm text-text-secondary">
              {subscription.id
                ? `Billing period ends on ${formatDate(subscription.currentPeriodEnd)}`
                : 'Select a plan to get started'}
            </p>
            {subscription.discount && (
              <p className="text-sm text-emerald-500">
                Discount: {subscription.discount.name || subscription.discount.code} (
                {subscription.discount.kind === 'percent'
                  ? `${subscription.discount.value}% off`
                  : `${money(subscription.discount.value, 'USD', 0)} off`}
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

        <div className="mt-6 flex flex-wrap gap-2 rounded-xl border border-border bg-bg-elevated p-1">
          <button
            type="button"
            onClick={() => setView('overview')}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              view === 'overview'
                ? 'bg-text text-bg'
                : 'text-text-muted hover:bg-bg-card hover:text-text'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setView('plans')}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              view === 'plans'
                ? 'bg-text text-bg'
                : 'text-text-muted hover:bg-bg-card hover:text-text'
            }`}
          >
            Plans
          </button>
          <button
            type="button"
            onClick={() => setView('history')}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              view === 'history'
                ? 'bg-text text-bg'
                : 'text-text-muted hover:bg-bg-card hover:text-text'
            }`}
          >
            History
          </button>
        </div>
      </div>

      {view === 'overview' && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Current spend</p>
            <p className="mt-2 text-2xl font-semibold text-text">
              <span className="mono">{money(currentPlan?.price ?? 0, 'USD', 0)}</span>
              <span className="text-sm font-normal text-text-muted">/{currentPlan?.billingPeriod ?? 'monthly'}</span>
            </p>
          </div>
          <div className="rounded-xl border border-border bg-bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Next invoice</p>
            <p className="mt-2 text-lg font-semibold text-text">
              {subscription.id ? formatDate(subscription.currentPeriodEnd) : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Status</p>
            <p className="mt-2 text-lg font-semibold text-text">
              {subscription.cancelAtPeriodEnd
                ? 'Cancels at period end'
                : subscription.id
                  ? 'Auto-renewing'
                  : 'No subscription'}
            </p>
          </div>

          {/* Discount code */}
          {onApplyDiscount && subscription.id && (
            <div className="md:col-span-3 rounded-xl border border-border bg-bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-text-muted">Discount code</p>
              <div className="mt-3 flex gap-2">
                <input
                  value={discountCode}
                  onChange={(e) => {
                    setDiscountCode(e.target.value.toUpperCase())
                    setDiscountResult(null)
                  }}
                  placeholder="Enter promo code"
                  className="flex-1 rounded-lg border border-border bg-bg-input px-3 py-2 text-sm mono uppercase text-text transition"
                />
                <button
                  type="button"
                  disabled={!discountCode.trim() || applyingDiscount}
                  onClick={handleApplyDiscount}
                  className="rounded-lg bg-text px-4 py-2 text-sm font-medium text-bg transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {applyingDiscount ? 'Applying…' : 'Apply'}
                </button>
              </div>
              {discountResult && (
                <p className={`mt-2 text-sm ${discountResult.success ? 'text-success' : 'text-danger'}`}>
                  {discountResult.message}
                </p>
              )}
            </div>
          )}

          {usageMetrics.length > 0 && (
            <div className="md:col-span-3 rounded-xl border border-border bg-bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-text-muted">Usage metrics</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {usageMetrics.map((metric) => {
                  const utilization =
                    metric.limit && metric.limit > 0
                      ? Math.min((metric.current / metric.limit) * 100, 100)
                      : 0
                  return (
                    <div key={metric.id} className="rounded-lg border border-border p-3">
                      <p className="text-sm text-text-secondary">{metric.label}</p>
                      <p className="mt-1 text-lg font-semibold text-text">
                        {metric.current.toLocaleString()}
                        {metric.unit ? ` ${metric.unit}` : ''}
                      </p>
                      {metric.limit ? (
                        <>
                          <p className="text-xs text-text-muted">
                            of {metric.limit.toLocaleString()} {metric.unit ?? ''}
                          </p>
                          <div className="mt-2 h-2 rounded-full bg-bg-elevated">
                            <div
                              className="h-2 rounded-full bg-brand transition-all"
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
            <div className="md:col-span-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
              <p className="text-xs uppercase tracking-wide text-warning">Retention offers</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {retentionOffers.map((offer) => (
                  <div key={offer.id} className="rounded-lg border border-warning/30 bg-bg-card p-3">
                    <p className="font-medium text-text">{offer.title}</p>
                    <p className="mt-1 text-sm text-text-secondary">{offer.description}</p>
                    <p className="mt-2 text-sm font-semibold text-warning">
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
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
                  <p className="text-sm font-medium text-rose-400">Cancel subscription</p>
                  <p className="mt-1 text-sm text-text-muted">
                    Your subscription will remain active until {formatDate(subscription.currentPeriodEnd)}.
                  </p>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Why are you canceling? (required)"
                    rows={2}
                    className="mt-3 w-full rounded-lg border border-rose-500/30 bg-bg-input px-3 py-2 text-sm text-text transition"
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
                      className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-bg-elevated"
                    >
                      Keep subscription
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  className="text-sm text-text-muted transition hover:text-rose-500"
                >
                  Cancel subscription
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {view === 'plans' && plansLoading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex animate-pulse flex-col rounded-2xl border border-ink/[0.08] bg-bg-card p-5">
              <div className="h-4 w-20 rounded bg-ink/[0.08]" />
              <div className="mt-5 h-7 w-24 rounded bg-ink/[0.08]" />
              <div className="mt-4 h-3 w-full rounded bg-ink/[0.06]" />
              <div className="mt-2 h-3 w-3/4 rounded bg-ink/[0.06]" />
              <div className="mt-6 flex-1 space-y-2">
                {[0, 1, 2, 3].map((j) => <div key={j} className="h-3 w-5/6 rounded bg-ink/[0.05]" />)}
              </div>
              <div className="mt-5 h-10 w-full rounded-xl bg-ink/[0.06]" />
            </div>
          ))}
        </div>
      )}

      {view === 'plans' && !plansLoading && availablePlans.length === 0 && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-6 text-sm text-red-400">
          Could not load the plan catalog. Retry, or reach us at billing@hanzo.ai.
        </div>
      )}

      {view === 'plans' && !plansLoading && availablePlans.length > 0 && (
        <>
          {planError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {planError}
            </div>
          )}
          {/* Two controls, not twelve cards: WHO the plan is for, and HOW OFTEN it
              bills. Both read the catalog — the audience from `category`, the
              interval from whether `annualPrice` exists at all. */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Plan audience"
              className="inline-flex rounded-xl border border-ink/[0.08] bg-ink/[0.03] p-1"
            >
              {(['personal', 'business'] as const).map((a) => {
                const count = a === 'personal' ? personalPlans.length : businessPlans.length
                return (
                  <button
                    key={a}
                    type="button"
                    role="tab"
                    aria-selected={audience === a}
                    disabled={count === 0}
                    onClick={() => setAudience(a)}
                    className={
                      'rounded-lg px-4 py-1.5 text-[13px] font-medium capitalize transition disabled:opacity-40 ' +
                      (audience === a
                        ? 'bg-bg-card text-text shadow-sm'
                        : 'text-text-muted hover:text-text')
                    }
                  >
                    {a}
                  </button>
                )
              })}
            </div>

            {annualAvailable && (
              <div
                role="tablist"
                aria-label="Billing interval"
                className="inline-flex items-center gap-2"
              >
                <div className="inline-flex rounded-xl border border-ink/[0.08] bg-ink/[0.03] p-1">
                  {(['monthly', 'annual'] as const).map((iv) => (
                    <button
                      key={iv}
                      type="button"
                      role="tab"
                      aria-selected={interval === iv}
                      onClick={() => setInterval(iv)}
                      className={
                        'rounded-lg px-4 py-1.5 text-[13px] font-medium capitalize transition ' +
                        (interval === iv
                          ? 'bg-bg-card text-text shadow-sm'
                          : 'text-text-muted hover:text-text')
                      }
                    >
                      {iv}
                    </button>
                  ))}
                </div>
                {interval === 'annual' && (
                  <span className="text-[12px] font-medium text-emerald-500">2 months free</span>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {shownPlans.map((plan) => {
            const isCurrent = plan.id === subscription.planId
            const isBusy = busyPlanId === plan.id
            const isFree = plan.price === 0
            const hasTrial = (plan.trialDays ?? 0) > 0
            const isExternal = !!plan.externalUrl || plan.contactSales
            const minSeats = plan.minSeats ?? 2
            const seats = plan.perSeat ? Math.max(minSeats, seatCounts[plan.id] ?? minSeats) : 1
            const monthlyTotal = shownPrice(plan) * seats
            // A priceless tier means two different things: a contact-sales tier
            // has no list price, a $0 tier genuinely costs nothing.
            // The DISPLAYED price follows the interval toggle; the annual figure the
            // catalog carries is already per-month-billed-annually, so the suffix
            // stays /mo and only the number moves.
            const shown = shownPrice(plan)
            const priceLabel = isFree
              ? plan.contactSales ? 'Custom' : 'Free'
              : money(shown, plan.currency ?? 'USD', cents(shown))
            const priceSuffix = isFree ? null : isExternal ? '/mo+' : plan.perSeat ? '/user/mo' : '/mo'
            const checkoutOpen = activationPlanId === plan.id && !isCurrent && !isFree && !isExternal && !canDirectSubscribe && !!onSubscribeWithCard
            const showCheckout = checkoutOpen && noProcessorPlanId !== plan.id
            const showNoProcessor = checkoutOpen && noProcessorPlanId === plan.id

            const buttonLabel = isCurrent
              ? 'Current plan'
              : isBusy
                ? 'Applying…'
                : isExternal
                  ? plan.contactSales ? 'Contact Sales →' : 'Get started →'
                  : hasTrial && !subscription.id
                    ? `Start ${plan.trialDays}-day free trial`
                    : currentPlan && plan.price < (currentPlan?.price ?? 0)
                      ? 'Downgrade'
                      : 'Upgrade'

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-5 transition ${
                  plan.highlighted && !isCurrent
                    ? 'border-ink/[0.2] bg-bg-card'
                    : isCurrent
                      ? 'border-ink/[0.25] bg-bg-card'
                      : 'border-ink/[0.08] bg-bg-card'
                }`}
              >
                {plan.highlighted && !isCurrent && (
                  <div
                    className="absolute -top-px left-0 right-0 h-px rounded-t-2xl"
                    style={{
                      backgroundImage:
                        'linear-gradient(to right in oklab, transparent, color-mix(in oklab, #fff 40%, transparent), transparent)',
                    }}
                  />
                )}
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[15px] font-semibold text-text">{plan.name}</p>
                  {plan.badge ? (
                    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold flex-shrink-0 ${
                      isCurrent
                        ? 'bg-ink/10 text-ink/60'
                        : plan.contactSales
                          ? 'bg-amber-500/15 text-amber-400'
                          : hasTrial
                            ? 'bg-sky-500/15 text-sky-400'
                            : 'bg-ink/[0.07] text-ink/40'
                    }`}>
                      {plan.badge}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4">
                  <p className="text-2xl font-bold text-text">
                    <span className="mono">{priceLabel}</span>
                    {priceSuffix && <span className="text-sm font-normal text-ink/40">{priceSuffix}</span>}
                  </p>
                  {plan.annualPrice && !isCurrent ? (
                    <p className="mt-0.5 text-[12px] text-emerald-400">{money(plan.annualPrice, plan.currency ?? 'USD', cents(plan.annualPrice))}{plan.perSeat ? '/user' : ''}/mo billed annually</p>
                  ) : null}
                  {(plan.trialCreditCents ?? 0) > 0 && !isCurrent && (
                    <p className="mt-0.5 text-[12px] text-emerald-400">+${(plan.trialCreditCents! / 100).toFixed(0)} credit included</p>
                  )}
                </div>

                <p className="mt-3 text-[13px] leading-relaxed text-ink/40">{plan.description}</p>

                {plan.perSeat && !isCurrent && (
                  <div className="mt-3 rounded-xl border border-ink/[0.08] bg-ink/[0.03] p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-ink/50">Seats (min {minSeats})</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label="Fewer seats"
                          disabled={seats <= minSeats}
                          onClick={() => setSeatCounts((prev) => ({ ...prev, [plan.id]: Math.max(minSeats, seats - 1) }))}
                          className="h-6 w-6 rounded-md bg-ink/[0.08] text-sm text-ink/70 hover:bg-ink/[0.14] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-[13px] font-semibold text-text">{seats}</span>
                        <button
                          type="button"
                          aria-label="More seats"
                          onClick={() => setSeatCounts((prev) => ({ ...prev, [plan.id]: seats + 1 }))}
                          className="h-6 w-6 rounded-md bg-ink/[0.08] text-sm text-ink/70 hover:bg-ink/[0.14]"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-[12px] text-ink/40">
                      {seats} × ${plan.price}/mo = <span className="font-semibold text-ink/80">${monthlyTotal}/mo</span>
                    </p>
                  </div>
                )}

                <ul className="mt-4 flex-1 space-y-1.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[13px] text-ink/50">
                      <span className="mt-0.5 flex-shrink-0 text-ink/30">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={isCurrent || isBusy}
                  onClick={() => handlePlanChange(plan)}
                  className={`mt-5 w-full rounded-xl px-3 py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
                    isCurrent
                      ? 'cursor-not-allowed bg-ink/[0.06] text-ink/30'
                      : isBusy
                        ? 'cursor-wait bg-ink/[0.06] text-ink/30'
                        : plan.highlighted
                          ? 'bg-brand text-brand-foreground hover:bg-brand-hover'
                          : isExternal
                            ? 'bg-ink/[0.08] text-ink/70 hover:bg-ink/[0.12] hover:text-text'
                            : hasTrial && !subscription.id
                              ? 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30'
                              : 'bg-ink/[0.08] text-ink/70 hover:bg-ink/[0.12] hover:text-text'
                  }`}
                >
                  {buttonLabel}
                </button>

                {showCheckout && (
                  <SubscribeCardForm
                    planId={plan.id}
                    planName={plan.name}
                    quantity={seats}
                    totalLabel={`$${monthlyTotal}/mo`}
                    savedCards={savedCards}
                    onSubscribe={(card, idempotencyKey) => onSubscribeWithCard!(plan.id, card, seats, idempotencyKey)}
                    onSuccess={() => setActivationPlanId(null)}
                    onNoProcessor={() => setNoProcessorPlanId(plan.id)}
                  />
                )}

                {showNoProcessor && (
                  <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3">
                    <p className="text-[12px] font-semibold text-amber-300">Card checkout is not enabled for this org yet</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-ink/50">
                      Your organization has no payment processor configured. Contact
                      our billing team and we will enable {plan.name} on your account.
                    </p>
                    <a
                      href={`mailto:billing@hanzo.ai?subject=${encodeURIComponent(`Activate ${plan.name} plan`)}&body=${encodeURIComponent(`Please enable card checkout and activate the ${plan.name} plan${plan.perSeat ? ` (${seats} seats)` : ''} on my account.`)}`}
                      className="mt-3 block rounded-lg bg-ink/[0.08] px-3 py-2 text-center text-[13px] font-semibold text-ink/70 transition hover:bg-ink/[0.12] hover:text-text"
                    >
                      Contact billing
                    </a>
                  </div>
                )}
              </div>
            )
          })}
          </div>

          {/* COMPARISON MATRIX — built from the catalog, never hand-authored.
              A card can only show a handful of bullets before it stops being
              scannable, so the full feature set goes here as one row per feature
              and one column per plan. The rows are the UNION of every shown plan's
              features, so a feature only one tier has still gets a row and its
              absence elsewhere is visible — which is the comparison a buyer is
              actually making. Hand-maintaining this table is how it drifts from
              what is sold. */}
          {shownPlans.length > 1 && (() => {
            const rows = Array.from(
              new Set(shownPlans.flatMap((p) => p.features ?? [])),
            ).sort((a, b) => a.localeCompare(b))
            if (rows.length === 0) return null
            return (
              <section className="mt-10">
                <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-text-muted">
                  Compare {audience} plans
                </h3>
                {/* Its own scroll container: a wide table must never make the PAGE
                    scroll sideways. */}
                <div className="overflow-x-auto rounded-2xl border border-ink/[0.08]">
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr>
                        <th
                          scope="col"
                          className="sticky left-0 z-10 bg-bg-card px-4 py-3 text-left font-medium text-text-muted"
                        >
                          Feature
                        </th>
                        {shownPlans.map((p) => (
                          <th
                            key={p.id}
                            scope="col"
                            className="whitespace-nowrap px-4 py-3 text-left font-semibold text-text"
                          >
                            {p.name}
                            <span className="ml-2 font-normal text-text-muted mono">
                              {p.contactSales
                                ? 'Custom'
                                : shownPrice(p) === 0
                                  ? 'Free'
                                  : money(shownPrice(p), p.currency ?? 'USD', cents(shownPrice(p)))}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((feature) => (
                        <tr key={feature} className="border-t border-ink/[0.06]">
                          <th
                            scope="row"
                            className="sticky left-0 z-10 bg-bg-card px-4 py-3 text-left font-normal text-text-secondary"
                          >
                            {feature}
                          </th>
                          {shownPlans.map((p) => (
                            <td key={p.id} className="px-4 py-3">
                              {(p.features ?? []).includes(feature) ? (
                                <span aria-label="included" className="text-emerald-500">
                                  ✓
                                </span>
                              ) : (
                                <span aria-label="not included" className="text-ink/25">
                                  —
                                </span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })()}

        </>
      )}

      {view === 'history' && (
        <div className="rounded-xl border border-border bg-bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-text">Subscription timeline</h3>
          </div>
          {subscriptionHistory.length === 0 ? (
            <div className="p-6 text-sm text-text-muted">No history entries yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {subscriptionHistory.map((entry) => (
                <div key={entry.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-text">{entry.action}</p>
                    <p className="text-sm text-text-secondary">{entry.details}</p>
                    {entry.fromPlan || entry.toPlan ? (
                      <p className="text-xs text-text-muted">
                        {entry.fromPlan ?? '—'} → {entry.toPlan ?? '—'}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-xs text-text-muted">{formatDate(entry.date)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
