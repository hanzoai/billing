'use client'

import * as React from 'react'
import { useSquareCard } from '@/lib/square'
import { CommerceApiError } from '@/lib/commerce-client'

// One card element at a time in the pricing grid (only one plan's checkout panel
// is ever open), so a single stable container id is safe.
const CONTAINER_ID = 'sq-subscribe-card'

export interface SubscribeCardFormProps {
  planId: string
  planName: string
  /** Seats for per-seat plans (else 1); sent as quantity, priced server-side. */
  quantity: number
  /** Human total shown on the button, e.g. "$40/mo". */
  totalLabel: string
  /** POST subscribe/card. Throws CommerceApiError (with .status) on failure. */
  onSubscribe: (sourceId: string, idempotencyKey: string) => Promise<void>
  /** 201 — subscription active. */
  onSuccess: () => void
  /** 422 — org has no payment processor; parent shows the contact fallback. */
  onNoProcessor: () => void
}

/** Stable idempotency key per checkout attempt (plan × seats), in sessionStorage. */
function idemStorageKey(planId: string, quantity: number): string {
  return `hanzo_sub_idem:${planId}:${quantity}`
}
function getOrCreateIdemKey(planId: string, quantity: number): string {
  const k = idemStorageKey(planId, quantity)
  const existing = sessionStorage.getItem(k)
  if (existing) return existing
  const fresh = crypto.randomUUID()
  sessionStorage.setItem(k, fresh)
  return fresh
}
function clearIdemKey(planId: string, quantity: number): void {
  sessionStorage.removeItem(idemStorageKey(planId, quantity))
}

export function SubscribeCardForm({
  planId,
  planName,
  quantity,
  totalLabel,
  onSubscribe,
  onSuccess,
  onNoProcessor,
}: SubscribeCardFormProps) {
  const { ready, loading, error: cardError, tokenize } = useSquareCard(CONTAINER_ID)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = React.useCallback(async () => {
    if (!ready || submitting) return
    setSubmitting(true)
    setError(null)

    let sourceId: string
    try {
      sourceId = await tokenize()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please check the card details and try again.')
      setSubmitting(false)
      return
    }

    // Reuse the key across a same-attempt retry (network/500 replay-safe); rotate
    // only when a genuine re-attempt is needed (a declined card = new charge).
    const idempotencyKey = getOrCreateIdemKey(planId, quantity)
    try {
      await onSubscribe(sourceId, idempotencyKey)
      clearIdemKey(planId, quantity)
      onSuccess()
    } catch (err) {
      if (err instanceof CommerceApiError) {
        switch (err.status) {
          case 422:
            onNoProcessor()
            return
          case 402:
            clearIdemKey(planId, quantity)
            setError('Card declined. Try another card.')
            return
          case 409:
            setError('A checkout is already in progress — give it a moment, then retry.')
            return
          case 401:
            setError('Your session expired. Please sign in again.')
            return
          case 400:
            setError(err.message || 'We could not start this subscription.')
            return
          case 500:
            setError('Your card was charged but activation did not complete. Contact billing@hanzo.ai — do not retry.')
            return
          default:
            setError(err.message || 'Subscription failed. Please try again.')
            return
        }
      }
      setError(err instanceof Error ? err.message : 'Subscription failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [ready, submitting, tokenize, planId, quantity, onSubscribe, onSuccess, onNoProcessor])

  return (
    <div className="mt-3 rounded-xl border border-ink/[0.12] bg-ink/[0.03] p-3">
      <p className="text-[12px] font-semibold text-ink/80">Subscribe to {planName}</p>
      <p className="mt-1 text-[12px] text-ink/40">
        Enter a card — you are charged <span className="font-semibold text-ink/70">{totalLabel}</span> and the plan
        activates immediately.
      </p>

      <div
        id={CONTAINER_ID}
        className="mt-3"
        style={{
          minHeight: loading ? '96px' : undefined,
          borderRadius: '8px',
          border: '1px solid color-mix(in oklab, var(--color-text) 10%, transparent)',
          background: 'var(--color-bg)',
          padding: '10px 12px',
        }}
      >
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '72px' }}>
            <div style={{ width: '18px', height: '18px', border: '2px solid color-mix(in oklab, var(--color-text) 12%, transparent)', borderTopColor: 'color-mix(in oklab, var(--color-text) 60%, transparent)', borderRadius: '50%', animation: 'sq-sub-spin 0.8s linear infinite' }} />
            <style>{`@keyframes sq-sub-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
      </div>

      {cardError && !loading && (
        <p className="mt-2 text-[12px] text-rose-400">{cardError}</p>
      )}
      {error && (
        <p className="mt-2 text-[12px] text-rose-400">{error}</p>
      )}

      <button
        type="button"
        disabled={!ready || submitting}
        onClick={handleSubmit}
        className="mt-3 w-full rounded-lg bg-brand px-3 py-2 text-center text-[13px] font-semibold text-brand-foreground transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-ink/[0.06] disabled:text-ink/30"
      >
        {submitting ? 'Processing…' : `Pay ${totalLabel} & subscribe`}
      </button>

      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-ink/25">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Secured by Square — PCI DSS compliant tokenization
      </div>
    </div>
  )
}
