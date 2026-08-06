'use client'

import { useState, useEffect, useCallback } from 'react'
import { getCommerce } from '@/lib/commerce'
import { useSquareCard } from '@/lib/square'
import { ErrorBoundary } from '@/lib/components/error-boundary'
import {
  sendHusdTopup,
  recordHusdTopup,
  topupConfigured,
  HUSD_TREASURY,
  type Sent,
} from '@/lib/wallet-topup'
import { moneyFromCents } from '@/lib/money'

// ── Wire transfer bank details ──────────────────────────────────────────────

const WIRE_DETAILS = [
  { label: 'Beneficiary Bank', value: 'Bank of America, NA' },
  { label: 'Beneficiary', value: 'Hanzo, Inc' },
  { label: 'ACH Routing', value: '113000023 / 111000025' },
  { label: 'Wire Routing', value: '026009593' },
  { label: 'SWIFT', value: 'BOFAUS3N' },
]

// ── Helpers ─────────────────────────────────────────────────────────────────

// Inline fallback for a crashed crypto/wallet tab — keeps the top-up page (and
// its other tabs) alive instead of surfacing a whole-page "Something went wrong".
function walletTabFallback(_error: Error, reset: () => void) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <p style={{ fontSize: '13px', color: '#f87171', margin: 0, lineHeight: 1.5 }}>
        This payment option is temporarily unavailable. Try another method above, or retry.
      </p>
      <button type="button" onClick={reset} style={submitStyle(false)}>
        Try again
      </button>
    </div>
  )
}

// ── Topup page ───────────────────────────────────────────────────────────────

type PayTab = 'card' | 'crypto' | 'wire' | 'wallet'

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
  const [tab, setTab] = useState<PayTab>('card')
  const [customAmountCents, setCustomAmountCents] = useState<number | null>(null)
  const [status, setStatus] = useState<Status>({ type: 'idle' })
  const [copyMsg, setCopyMsg] = useState('')

  const amountCents = customAmountCents ?? params.amount ?? 2500 // default $25

  const QUICK_AMOUNTS = [1000, 2500, 5000, 10000] // cents

  // ── Commerce client ──────────────────────────────────────────────────────
  const commerceUrl = process.env.NEXT_PUBLIC_COMMERCE_URL ?? 'https://api.hanzo.ai'

  // ── Cards already on file — offered before the blank Square form ─────────
  const [saved, setSaved] = useState<{ id: string; label: string; isDefault?: boolean }[]>([])
  const [payWith, setPayWith] = useState<string>('new')
  useEffect(() => {
    if (!params.token) return
    const commerce = getCommerce(commerceUrl, params.token)
    commerce.getPaymentMethods(params.userId ?? '').then((rows) => {
      const cards = rows
        .filter((r) => (r.type ?? 'card') === 'card')
        .map((r) => ({
          id: r.id ?? '',
          label: r.card?.brand && r.card?.last4 ? `${r.card.brand} ending in ${r.card.last4}` : 'Saved card',
          isDefault: r.isDefault ?? false,
        }))
        .filter((c) => c.id !== '')
      setSaved(cards)
      if (cards.length > 0) setPayWith((cards.find((c) => c.isDefault) ?? cards[0]).id)
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token])

  // ── Square card element (shared hook) — only init on the Card tab, and only
  //    once "Use a new card" is the choice (a saved-card charge never loads it).
  const { ready: sqReady, loading: sqLoading, error: sqError, tokenize: sqTokenize } = useSquareCard(
    'sq-card-container',
    tab === 'card' && payWith === 'new',
  )

  // ── Crypto payment state ─────────────────────────────────────────────────
  const [txHash, setTxHash] = useState('')
  const [fromAddr, setFromAddr] = useState('')

  // ── Wallet (HUSD) state — a sent-but-not-yet-credited transfer, so a failed
  //    record can be retried without re-sending HUSD. ─────────────────────────
  const [walletSent, setWalletSent] = useState<Sent | null>(null)

  // ── Crypto receive address (Hanzo's deposit wallet) ──────────────────────
  const HANZO_ETH_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'

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

  // ── Card submit: charge the chosen saved card, or tokenize a new one ─────
  const handleCardSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!params.token) {
        setStatus({ type: 'error', message: 'Authentication required. Please sign in.' })
        return
      }
      const useNew = payWith === 'new'
      if (useNew && !sqReady) {
        setStatus({ type: 'error', message: 'Card form not ready. Please wait.' })
        return
      }

      setStatus({ type: 'loading' })
      try {
        const commerce = getCommerce(commerceUrl, params.token)
        const userId = params.userId ?? ''

        const payment = useNew
          ? await commerce.topupWithSquareToken({
              sourceId: await sqTokenize(),
              amountCents,
              userId: userId || undefined,
              currency: 'usd',
            })
          : await commerce.topupWithMethod({
              paymentMethodId: payWith,
              amountCents,
              currency: 'usd',
            })

        handleSuccess(payment.balanceCents)
      } catch (err) {
        setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Payment failed.' })
      }
    },
    [params, payWith, sqReady, sqTokenize, amountCents, commerceUrl, handleSuccess],
  )

  // ── Crypto submit ─────────────────────────────────────────────────────────
  const handleCryptoSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!params.token) {
        setStatus({ type: 'error', message: 'Authentication required.' })
        return
      }
      if (!txHash.trim()) {
        setStatus({ type: 'error', message: 'Transaction hash required.' })
        return
      }

      setStatus({ type: 'loading' })
      try {
        const commerce = getCommerce(commerceUrl, params.token)
        const userId = params.userId ?? params.token!

        const payment = await commerce.recordCryptoPayment({
          txHash: txHash.trim(),
          network: 'ethereum',
          amount: amountCents,
          currency: 'usdc',
          userId: userId || undefined,
          fromAddress: fromAddr.trim() || txHash.trim(),
          toAddress: HANZO_ETH_ADDRESS,
        })

        if (payment.status !== 'failed' && payment.status !== 'cancelled') {
          const bal = await commerce.getBalance(userId)
          handleSuccess(bal.balance)
        } else {
          setStatus({ type: 'error', message: 'Transaction not confirmed. Check the hash and retry.' })
        }
      } catch (err) {
        setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to record payment.' })
      }
    },
    [params, txHash, fromAddr, amountCents, commerceUrl, handleSuccess],
  )

  // ── Wallet (HUSD) submit ───────────────────────────────────────────────────
  const creditWalletTopup = useCallback(
    async (sent: Sent) => {
      const { balanceCents } = await recordHusdTopup({
        commerceUrl,
        token: params.token ?? undefined,
        userId: params.userId ?? undefined,
        txHash: sent.txHash,
        fromAddress: sent.fromAddress,
      })
      setWalletSent(null)
      handleSuccess(balanceCents)
    },
    [commerceUrl, params.token, params.userId, handleSuccess],
  )

  const handleWalletPay = useCallback(async () => {
    if (!params.token) {
      setStatus({ type: 'error', message: 'Authentication required. Please sign in.' })
      return
    }
    setStatus({ type: 'loading' })
    try {
      // Send HUSD from the user's wallet, then credit from the verified on-chain
      // amount. If the send lands but crediting fails, `walletSent` lets the user
      // retry crediting without re-sending.
      const sent = await sendHusdTopup((amountCents / 100).toFixed(2))
      setWalletSent(sent)
      await creditWalletTopup(sent)
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'HUSD top-up failed.' })
    }
  }, [params.token, amountCents, creditWalletTopup])

  const handleWalletRetry = useCallback(async () => {
    if (!walletSent) return
    setStatus({ type: 'loading' })
    try {
      await creditWalletTopup(walletSent)
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Crediting failed. Please retry.' })
    }
  }, [walletSent, creditWalletTopup])

  // ── Wire confirm ──────────────────────────────────────────────────────────
  const handleWireConfirm = useCallback(async () => {
    if (!params.token) {
      setStatus({ type: 'error', message: 'Authentication required.' })
      return
    }

    setStatus({ type: 'loading' })
    try {
      const commerce = getCommerce(commerceUrl, params.token)
      const userId = params.userId ?? params.token!

      await commerce.recordWirePayment({
        userId: userId || undefined,
        amount: amountCents,
        currency: 'usd',
        reference: `Hanzo topup ${new Date().toISOString()}`,
      })

      // Wire is pending — optimistically notify with current balance
      const bal = await commerce.getBalance(userId)
      handleSuccess(bal.balance)
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to record wire.' })
    }
  }, [params, amountCents, commerceUrl, handleSuccess])

  const copy = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyMsg(`${label} copied`)
      setTimeout(() => setCopyMsg(''), 2000)
    })
  }, [])

  // ── Render: success ────────────────────────────────────────────────────────
  if (status.type === 'success') {
    return (
      <div style={ROOT}>
        <div style={CARD}>
          <div style={{ textAlign: 'center', padding: '32px 0 16px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✓</div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>
              Top-up successful
            </h2>
            <p style={{ fontSize: '14px', color: 'color-mix(in oklab, var(--color-text) 40%, transparent)', margin: 0 }}>
              New balance: {moneyFromCents(status.balance)}
            </p>
            {params.returnUrl && (
              <p style={{ fontSize: '12px', color: 'color-mix(in oklab, var(--color-text) 25%, transparent)', marginTop: '12px' }}>
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
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'color-mix(in oklab, var(--color-text) 35%, transparent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
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
                  border: `1px solid ${amountCents === c ? 'color-mix(in oklab, var(--color-text) 40%, transparent)' : 'color-mix(in oklab, var(--color-text) 10%, transparent)'}`,
                  background: amountCents === c ? 'color-mix(in oklab, var(--color-text) 8%, transparent)' : 'transparent',
                  color: amountCents === c ? 'var(--color-text)' : 'color-mix(in oklab, var(--color-text) 45%, transparent)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                className="mono"
              >
                {moneyFromCents(c)}
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

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '4px', background: 'color-mix(in oklab, var(--color-text) 4%, transparent)', borderRadius: '10px', padding: '3px', marginBottom: '16px' }}>
          {(['card', 'crypto', 'wallet', 'wire'] as PayTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setStatus({ type: 'idle' }) }}
              style={{
                flex: 1,
                padding: '7px 8px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '8px',
                border: 'none',
                background: tab === t ? 'color-mix(in oklab, var(--color-text) 10%, transparent)' : 'transparent',
                color: tab === t ? 'var(--color-text)' : 'color-mix(in oklab, var(--color-text) 35%, transparent)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {t === 'card' ? 'Card' : t === 'crypto' ? 'Crypto' : t === 'wallet' ? 'HUSD' : 'Wire'}
            </button>
          ))}
        </div>

        {/* Error */}
        {status.type === 'error' && (
          <div style={{ marginBottom: '12px', padding: '10px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', fontSize: '13px', color: '#f87171' }}>
            {status.message}
          </div>
        )}

        {/* ── Card tab ─────────────────────────────────────────────────── */}
        {tab === 'card' && (
          <form onSubmit={handleCardSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Saved cards first — the blank form only for "Use a new card". */}
            {saved.length > 0 && (
              <div role="radiogroup" aria-label="Pay with" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[...saved.map((c) => ({ key: c.id, label: c.label, isDefault: c.isDefault })), { key: 'new', label: 'Use a new card', isDefault: false }].map((opt) => (
                  <label
                    key={opt.key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                      borderRadius: '8px', padding: '9px 12px', fontSize: '13px',
                      border: `1px solid ${payWith === opt.key ? 'color-mix(in oklab, var(--color-text) 35%, transparent)' : 'color-mix(in oklab, var(--color-text) 10%, transparent)'}`,
                      background: payWith === opt.key ? 'color-mix(in oklab, var(--color-text) 6%, transparent)' : 'transparent',
                      color: payWith === opt.key ? 'var(--color-text)' : 'color-mix(in oklab, var(--color-text) 55%, transparent)',
                    }}
                  >
                    <input
                      type="radio"
                      name="topup-pay-with"
                      checked={payWith === opt.key}
                      onChange={() => setPayWith(opt.key)}
                      style={{ accentColor: 'currentColor' }}
                    />
                    <span>{opt.label}</span>
                    {opt.isDefault && (
                      <span style={{ marginLeft: 'auto', fontSize: '10px', borderRadius: '999px', padding: '2px 8px', border: '1px solid color-mix(in oklab, var(--color-text) 12%, transparent)', color: 'color-mix(in oklab, var(--color-text) 40%, transparent)' }}>Default</span>
                    )}
                  </label>
                ))}
              </div>
            )}

            {/* Square card container */}
            {payWith === 'new' && (
              <div
                id="sq-card-container"
                style={{
                  minHeight: '96px',
                  borderRadius: '8px',
                  border: '1px solid color-mix(in oklab, var(--color-text) 10%, transparent)',
                  background: 'var(--color-bg)',
                  padding: '10px 12px',
                  position: 'relative',
                }}
              >
                {sqLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '72px' }}>
                    <div style={{
                      width: '18px', height: '18px',
                      border: '2px solid color-mix(in oklab, var(--color-text) 12%, transparent)',
                      borderTopColor: 'color-mix(in oklab, var(--color-text) 60%, transparent)',
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
            )}

            <button
              type="submit"
              style={submitStyle(isLoading || (payWith === 'new' && !sqReady))}
              disabled={isLoading || (payWith === 'new' && !sqReady)}
            >
              {isLoading
                ? 'Processing...'
                : payWith === 'new'
                  ? `Pay ${moneyFromCents(amountCents)}`
                  : `Pay ${moneyFromCents(amountCents)} with ${saved.find((c) => c.id === payWith)?.label ?? 'saved card'}`}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'color-mix(in oklab, var(--color-text) 25%, transparent)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Secured by Square — PCI DSS compliant tokenization
            </div>
          </form>
        )}

        {/* ── Crypto tab ────────────────────────────────────────────────── */}
        {tab === 'crypto' && (
          <ErrorBoundary fallback={walletTabFallback}>
          <form onSubmit={handleCryptoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ fontSize: '12px', color: 'color-mix(in oklab, var(--color-text) 40%, transparent)', margin: 0, lineHeight: 1.5 }}>
              Send USDC or ETH to the address below, then paste your transaction hash to confirm.
            </p>

            {/* Deposit address */}
            <button
              type="button"
              onClick={() => copy(HANZO_ETH_ADDRESS, 'Address')}
              style={{
                background: 'color-mix(in oklab, var(--color-text) 4%, transparent)',
                border: '1px solid color-mix(in oklab, var(--color-text) 10%, transparent)',
                borderRadius: '8px',
                padding: '10px 12px',
                textAlign: 'left',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'color-mix(in oklab, var(--color-text) 35%, transparent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                Deposit address (Ethereum / EVM)
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-text)', wordBreak: 'break-all' }}>
                {HANZO_ETH_ADDRESS}
              </div>
              <div style={{ fontSize: '10px', color: 'color-mix(in oklab, var(--color-text) 30%, transparent)', marginTop: '4px' }}>
                Click to copy
              </div>
            </button>

            {copyMsg && (
              <p style={{ fontSize: '11px', color: '#34d399', margin: 0 }}>{copyMsg}</p>
            )}

            <input
              type="text"
              placeholder="Your wallet address (from)"
              value={fromAddr}
              onChange={(e) => setFromAddr(e.target.value)}
              style={INPUT}
              disabled={isLoading}
            />
            <input
              type="text"
              placeholder="Transaction hash (0x...)"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              style={INPUT}
              disabled={isLoading}
            />
            <button
              type="submit"
              style={submitStyle(isLoading || !txHash.trim())}
              disabled={isLoading || !txHash.trim()}
            >
              {isLoading ? 'Verifying...' : `Confirm ${moneyFromCents(amountCents)} crypto payment`}
            </button>
          </form>
          </ErrorBoundary>
        )}

        {/* ── Wallet (HUSD) tab ─────────────────────────────────────────── */}
        {tab === 'wallet' && (
          <ErrorBoundary fallback={walletTabFallback}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {!topupConfigured() ? (
              <p style={{ fontSize: '12px', color: 'color-mix(in oklab, var(--color-text) 40%, transparent)', margin: 0, lineHeight: 1.5 }}>
                HUSD is coming to Hanzo Mainnet. Once the HUSD stablecoin is live you can top up your
                balance directly from your wallet here — 1 HUSD = $1.00 credit.
              </p>
            ) : (
              <>
                <p style={{ fontSize: '12px', color: 'color-mix(in oklab, var(--color-text) 40%, transparent)', margin: 0, lineHeight: 1.5 }}>
                  Pay with HUSD on Hanzo Mainnet (chain 36963). Your wallet sends HUSD to the
                  treasury; we verify it on-chain and credit your balance. 1 HUSD = $1.00.
                </p>

                <button
                  type="button"
                  onClick={() => copy(HUSD_TREASURY, 'Treasury')}
                  style={{
                    background: 'color-mix(in oklab, var(--color-text) 4%, transparent)',
                    border: '1px solid color-mix(in oklab, var(--color-text) 10%, transparent)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  <div style={{ fontSize: '10px', fontWeight: 600, color: 'color-mix(in oklab, var(--color-text) 35%, transparent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                    HUSD treasury (Hanzo Mainnet)
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-text)', wordBreak: 'break-all' }}>
                    {HUSD_TREASURY}
                  </div>
                  <div style={{ fontSize: '10px', color: 'color-mix(in oklab, var(--color-text) 30%, transparent)', marginTop: '4px' }}>Click to copy</div>
                </button>

                {copyMsg && <p style={{ fontSize: '11px', color: '#34d399', margin: 0 }}>{copyMsg}</p>}

                {walletSent ? (
                  <>
                    <button
                      type="button"
                      onClick={handleWalletRetry}
                      style={submitStyle(isLoading)}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Crediting...' : `Credit ${moneyFromCents(amountCents)} (retry)`}
                    </button>
                    <p style={{ fontSize: '11px', color: 'color-mix(in oklab, var(--color-text) 40%, transparent)', margin: 0 }}>
                      HUSD sent (tx {walletSent.txHash.slice(0, 10)}…). If crediting failed, retry above —
                      no need to send again.
                    </p>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleWalletPay}
                    style={submitStyle(isLoading)}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Confirm in wallet...' : `Pay ${moneyFromCents(amountCents)} with HUSD`}
                  </button>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'color-mix(in oklab, var(--color-text) 25%, transparent)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Non-custodial — you sign in your own wallet, verified on-chain.
                </div>
              </>
            )}
          </div>
          </ErrorBoundary>
        )}

        {/* ── Wire tab ──────────────────────────────────────────────────── */}
        {tab === 'wire' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ fontSize: '12px', color: 'color-mix(in oklab, var(--color-text) 40%, transparent)', margin: 0, lineHeight: 1.5 }}>
              Wire the amount below to Hanzo, then click confirm. Credits appear within 1-2 business days after verification.
            </p>

            {WIRE_DETAILS.map(({ label, value }) => (
              <button
                key={label}
                type="button"
                onClick={() => copy(value, label)}
                style={{
                  background: 'color-mix(in oklab, var(--color-text) 3%, transparent)',
                  border: '1px solid color-mix(in oklab, var(--color-text) 8%, transparent)',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: 'color-mix(in oklab, var(--color-text) 30%, transparent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text)', marginTop: '2px' }}>{value}</div>
                </div>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="color-mix(in oklab, var(--color-text) 30%, transparent)" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            ))}

            {/* Reference line */}
            <button
              type="button"
              onClick={() => {
                const email = params.userId ?? 'your email'
                copy(`Hanzo ${email}`, 'Reference')
              }}
              style={{
                background: 'rgba(255,68,68,0.06)',
                border: '1px solid rgba(253,68,68,0.15)',
                borderRadius: '8px',
                padding: '9px 12px',
                textAlign: 'left',
                cursor: 'pointer',
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(253,68,68,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Reference (required)
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text)', marginTop: '2px' }}>
                  Hanzo {params.userId ?? 'your-email@example.com'}
                </div>
              </div>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="color-mix(in oklab, var(--color-text) 30%, transparent)" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>

            {copyMsg && (
              <p style={{ fontSize: '11px', color: '#34d399', margin: 0 }}>{copyMsg}</p>
            )}

            <button
              type="button"
              onClick={handleWireConfirm}
              style={submitStyle(isLoading)}
              disabled={isLoading}
            >
              {isLoading ? 'Recording...' : `I've sent ${moneyFromCents(amountCents)} via wire`}
            </button>

            <p style={{ fontSize: '11px', color: 'color-mix(in oklab, var(--color-text) 25%, transparent)', margin: 0 }}>
              Wire transfers are verified manually within 1-2 business days.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Inline styles (no Tailwind — keeps iframe safe from host CSS bleed) ──────

const ROOT: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--color-bg)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '24px 16px',
  fontFamily: 'var(--font-sans, ui-sans-serif, system-ui, sans-serif)',
}

const CARD: React.CSSProperties = {
  width: '100%',
  maxWidth: '400px',
  background: 'var(--color-bg-card)',
  border: '1px solid color-mix(in oklab, var(--color-text) 8%, transparent)',
  borderRadius: '16px',
  padding: '20px',
}

const INPUT: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--color-bg)',
  border: '1px solid color-mix(in oklab, var(--color-text) 10%, transparent)',
  borderRadius: '8px',
  padding: '9px 12px',
  fontSize: '13px',
  color: 'var(--color-text)',
  outline: 'none',
  fontFamily: 'inherit',
}

function submitStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 600,
    background: disabled ? 'color-mix(in oklab, var(--color-text) 6%, transparent)' : '#ffffff',
    color: disabled ? 'color-mix(in oklab, var(--color-text) 30%, transparent)' : 'var(--color-bg)',
    border: 'none',
    borderRadius: '8px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s',
    marginTop: '4px',
  }
}
