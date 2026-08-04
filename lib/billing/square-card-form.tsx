'use client'

import * as React from 'react'
import {
  loadSquareScript,
  SQUARE_APP_ID,
  SQUARE_LOCATION_ID,
  SQUARE_CARD_STYLE,
  type SquareCard,
} from '@/lib/square'

// ── Props ─────────────────────────────────────────────────────────────────

export interface SquareCardFormProps {
  /** Called with the Square sourceId token when tokenization succeeds */
  onToken: (sourceId: string) => Promise<void>
  disabled?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────

const CONTAINER_ID = 'sq-card-container'

export function SquareCardForm({ onToken, disabled }: SquareCardFormProps) {
  const cardRef = React.useRef<SquareCard | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [ready, setReady] = React.useState(false)
  const mountedRef = React.useRef(true)

  React.useEffect(() => {
    mountedRef.current = true

    async function attemptInit(): Promise<SquareCard> {
      await loadSquareScript()
      if (!window.Square) throw new Error('Square SDK not available')
      if (!SQUARE_APP_ID) throw new Error('NEXT_PUBLIC_SQUARE_APPLICATION_ID is not set')
      if (!SQUARE_LOCATION_ID) throw new Error('NEXT_PUBLIC_SQUARE_LOCATION_ID is not set')
      const payments = await window.Square.payments(SQUARE_APP_ID, SQUARE_LOCATION_ID)
      const c = await payments.card({ style: SQUARE_CARD_STYLE })
      await c.attach(`#${CONTAINER_ID}`)
      return c
    }

    async function init() {
      // Square's "Web Payments SDK was unable to be initialized in time" is
      // frequently a transient backend timeout. Retry a few times with backoff
      // before surfacing an error so a single hiccup doesn't strand the form.
      let lastErr: unknown = null
      for (let attempt = 1; attempt <= 3 && mountedRef.current; attempt++) {
        try {
          const c = await attemptInit()
          if (!mountedRef.current) { await c.destroy().catch(() => undefined); return }
          cardRef.current = c
          setReady(true)
          setError(null)
          setLoading(false)
          return
        } catch (err) {
          lastErr = err
          if (attempt < 3 && mountedRef.current) {
            await new Promise((r) => setTimeout(r, 1200 * attempt))
          }
        }
      }
      if (mountedRef.current) {
        const raw = lastErr instanceof Error ? lastErr.message : ''
        const friendly = /initialized in time|timeout|timed out|network/i.test(raw)
          ? 'The card form timed out loading from Square. Reload to retry — or use Crypto or Bank Wire instead. If it keeps failing, a browser ad/privacy blocker may be blocking Square.'
          : raw || 'Failed to initialize payment form'
        setError(friendly)
        setLoading(false)
      }
    }

    void init()

    return () => {
      mountedRef.current = false
      cardRef.current?.destroy().catch(() => undefined)
      cardRef.current = null
    }
  }, [])

  const handleSubmit = React.useCallback(async () => {
    if (!cardRef.current || !ready || submitting || disabled) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await cardRef.current.tokenize()
      if (result.status === 'OK' && result.token) {
        await onToken(result.token)
      } else {
        const msg = result.errors?.map(e => e.message).join('; ') ?? 'Tokenization failed'
        setError(msg)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment processing error')
    } finally {
      if (mountedRef.current) setSubmitting(false)
    }
  }, [onToken, ready, submitting, disabled])

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

      {error && (
        <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>
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
