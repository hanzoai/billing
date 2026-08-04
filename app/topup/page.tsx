'use client'

import { useState, useEffect, useCallback } from 'react'
import { getCommerce } from '@/lib/commerce'
import { useSquareCard } from '@/lib/square'

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtUSD(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

// ── Topup page ───────────────────────────────────────────────────────────────
//
// The card is the ONE money-in door here, and the only one there ever was: the
// Crypto, HUSD and Wire tabs all ended in `POST /v1/billing/payment`, an address
// no app in either server repo has ever registered (404 today). They took a
// transaction hash or a "I've sent the wire" confirmation, failed, and credited
// nothing — worse than absent, because the customer had already moved real
// money. Card charges `POST /v1/billing/topup/token`, which the fleet serves and
// which is server-authoritative. See lib/commerce-client.ts for why the phantom
// is deleted rather than pointed somewhere.

type Status =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'success'; balance: number }
  | { type: 'error'; message: string }

/**
 * Standalone iframe-embeddable topup page.
 *
 * URL params:
 *   amount     — pre-set amount in USD cents (optional)
 *   userId     — user to credit (optional, fallback to token sub)
 *   token      — bearer token (optional, also checks cookie hanzo-auth-token)
 *   returnUrl  — redirect target on success (optional; postMessage used if absent)
 *
 * On success posts:
 *   window.parent.postMessage({ type: 'topup-complete', balance: <cents> }, '*')
 */
export default function TopupPage() {
  // ── Parse URL params ─────────────────────────────────────────────────────
  const [params, setParams] = useState<{
    amount: number | null
    userId: string | null
    token: string | null
    returnUrl: string | null
  }>({ amount: null, userId: null, token: null, returnUrl: null })

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const raw = sp.get('amount')
    const cookieToken = document.cookie
      .split(';')
      .find((c) => c.trim().startsWith('hanzo-auth-token='))
      ?.split('=')[1]

    setParams({
      amount: raw ? parseInt(raw, 10) : null,
      userId: sp.get('userId'),
      token: sp.get('token') ?? cookieToken ?? null,
      returnUrl: sp.get('returnUrl'),
    })
  }, [])

  // ── State ────────────────────────────────────────────────────────────────
  const [customAmountCents, setCustomAmountCents] = useState<number | null>(null)
  const [status, setStatus] = useState<Status>({ type: 'idle' })

  const amountCents = customAmountCents ?? params.amount ?? 2500 // default $25

  const QUICK_AMOUNTS = [1000, 2500, 5000, 10000] // cents

  // ── Commerce client ──────────────────────────────────────────────────────
  const commerceUrl = process.env.NEXT_PUBLIC_COMMERCE_URL ?? 'https://api.hanzo.ai'

  // ── Square card element (shared hook) ────────────────────────────────────
  const { ready: sqReady, loading: sqLoading, error: sqError, tokenize: sqTokenize } = useSquareCard(
    'sq-card-container',
    true,
  )

  // ── Success handler ──────────────────────────────────────────────────────
  const handleSuccess = useCallback(
    (newBalance: number) => {
      setStatus({ type: 'success', balance: newBalance })
      window.parent?.postMessage({ type: 'topup-complete', balance: newBalance }, '*')
      if (params.returnUrl) {
        setTimeout(() => {
          window.location.href = `${params.returnUrl}?balance=${newBalance}`
        }, 1500)
      }
    },
    [params.returnUrl],
  )

  // ── Card submit (Square tokenize → charge) ───────────────────────────────
  const handleCardSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!params.token) {
        setStatus({ type: 'error', message: 'Authentication required. Please sign in.' })
        return
      }
      if (!sqReady) {
        setStatus({ type: 'error', message: 'Card form not ready. Please wait.' })
        return
      }

      setStatus({ type: 'loading' })
      try {
        const sourceId = await sqTokenize()

        const commerce = getCommerce(commerceUrl, params.token)
        const userId = params.userId ?? ''

        const payment = await commerce.topupWithSquareToken({
          sourceId,
          amountCents,
          userId: userId || undefined,
          currency: 'usd',
        })

        handleSuccess(payment.balanceCents)
      } catch (err) {
        setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Payment failed.' })
      }
    },
    [params, sqReady, sqTokenize, amountCents, commerceUrl, handleSuccess],
  )

  // ── Render: success ────────────────────────────────────────────────────────
  if (status.type === 'success') {
    return (
      <div style={ROOT}>
        <div style={CARD}>
          <div style={{ textAlign: 'center', padding: '32px 0 16px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✓</div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fafafa', margin: '0 0 8px' }}>
              Top-up successful
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
              New balance: {fmtUSD(status.balance)}
            </p>
            {params.returnUrl && (
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', marginTop: '12px' }}>
                Redirecting...
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  const isLoading = status.type === 'loading'

  // ── Render: main form ──────────────────────────────────────────────────────
  return (
    <div style={ROOT}>
      <div style={CARD}>
        {/* Amount selector */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
            Amount
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px' }}>
            {QUICK_AMOUNTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCustomAmountCents(c)}
                style={{
                  padding: '8px 4px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: `1px solid ${amountCents === c ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  background: amountCents === c ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: amountCents === c ? '#fafafa' : 'rgba(255,255,255,0.45)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {fmtUSD(c)}
              </button>
            ))}
          </div>
          <input
            type="number"
            min="1"
            step="0.01"
            placeholder="Custom amount (USD)"
            style={INPUT}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v) && v > 0) setCustomAmountCents(Math.round(v * 100))
            }}
          />
        </div>

        {/* Error */}
        {status.type === 'error' && (
          <div style={{ marginBottom: '12px', padding: '10px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', fontSize: '13px', color: '#f87171' }}>
            {status.message}
          </div>
        )}

        <form onSubmit={handleCardSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Square card container */}
          <div
            id="sq-card-container"
            style={{
              minHeight: '96px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: '#0a0a0f',
              padding: '10px 12px',
              position: 'relative',
            }}
          >
            {sqLoading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '72px' }}>
                <div style={{
                  width: '18px', height: '18px',
                  border: '2px solid rgba(255,255,255,0.12)',
                  borderTopColor: 'rgba(255,255,255,0.6)',
                  borderRadius: '50%',
                  animation: 'sq-spin 0.8s linear infinite',
                }} />
                <style>{`@keyframes sq-spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}
            {sqError && !sqLoading && (
              <div style={{ fontSize: '12px', color: '#f87171', padding: '8px 0' }}>
                {sqError}
              </div>
            )}
          </div>

          <button
            type="submit"
            style={submitStyle(isLoading || !sqReady)}
            disabled={isLoading || !sqReady}
          >
            {isLoading ? 'Processing...' : `Pay ${fmtUSD(amountCents)}`}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Secured by Square — PCI DSS compliant tokenization
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Inline styles (no Tailwind — keeps iframe safe from host CSS bleed) ──────

const ROOT: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0a0a0f',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '24px 16px',
  fontFamily: 'var(--font-sans, ui-sans-serif, system-ui, sans-serif)',
}

const CARD: React.CSSProperties = {
  width: '100%',
  maxWidth: '400px',
  background: '#141419',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '16px',
  padding: '20px',
}

const INPUT: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#0a0a0f',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  padding: '9px 12px',
  fontSize: '13px',
  color: '#fafafa',
  outline: 'none',
  fontFamily: 'inherit',
}

function submitStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 600,
    background: disabled ? 'rgba(255,255,255,0.06)' : '#ffffff',
    color: disabled ? 'rgba(255,255,255,0.3)' : '#09090b',
    border: 'none',
    borderRadius: '8px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s',
    marginTop: '4px',
  }
}
