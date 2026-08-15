'use client'

import * as React from 'react'
import { useSquareCard } from '@/lib/square'

// ── Props ─────────────────────────────────────────────────────────────────

export interface SquareCardFormProps {
  /** Called with the Square sourceId token when tokenization succeeds */
  onToken: (sourceId: string) => Promise<void>
  disabled?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────

// Its own id. This said `sq-card-container`, the same id the top-up page gives
// its container, and Square attaches by selector — so whichever mounted second
// aimed at the first one's box.
const CONTAINER_ID = 'sq-add-card'

export function SquareCardForm({ onToken, disabled }: SquareCardFormProps) {
  // The SDK lifecycle lives in `useSquareCard` and nowhere else. This file used
  // to carry its own copy of the load/attach/retry/destroy dance — the same
  // logic, drifting separately, and carrying the same liveness bug the hook has
  // since had fixed.
  const { ready, loading, error: cardError, tokenize } = useSquareCard(CONTAINER_ID)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = React.useCallback(async () => {
    if (!ready || submitting || disabled) return
    setSubmitting(true)
    setError(null)
    try {
      await onToken(await tokenize())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment processing error')
    } finally {
      setSubmitting(false)
    }
  }, [onToken, ready, submitting, disabled, tokenize])

  const shown = error ?? cardError

  return (
    <div className="space-y-3">
      {/* Square card container */}
      <div
        id={CONTAINER_ID}
        style={{
          minHeight: loading ? '120px' : undefined,
          borderRadius: '8px',
          border: '1px solid color-mix(in oklab, var(--color-text) 10%, transparent)',
          backgroundColor: 'color-mix(in oklab, var(--color-text) 4%, transparent)',
          padding: '12px',
          transition: 'border-color 0.2s',
        }}
      >
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '96px' }}>
            <div style={{ width: '20px', height: '20px', border: '2px solid color-mix(in oklab, var(--color-text) 15%, transparent)', borderTopColor: 'color-mix(in oklab, var(--color-text) 70%, transparent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
      </div>

      {shown && (
        <p className="text-sm" style={{ color: '#f87171' }}>{shown}</p>
      )}

      <button
        type="button"
        disabled={!ready || submitting || !!disabled}
        onClick={handleSubmit}
        style={{
          width: '100%',
          borderRadius: '8px',
          backgroundColor: ready && !submitting && !disabled ? 'var(--color-brand)' : 'color-mix(in oklab, var(--color-brand) 30%, transparent)',
          color: ready && !submitting && !disabled ? 'var(--color-brand-foreground)' : 'color-mix(in oklab, var(--color-brand-foreground) 50%, transparent)',
          padding: '10px 16px',
          fontSize: '14px',
          fontWeight: '500',
          cursor: ready && !submitting && !disabled ? 'pointer' : 'not-allowed',
          border: 'none',
          transition: 'opacity 0.15s',
        }}
      >
        {submitting ? 'Processing…' : 'Add card'}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'color-mix(in oklab, var(--color-text) 35%, transparent)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Secured by Square — PCI DSS compliant tokenization
      </div>
    </div>
  )
}
