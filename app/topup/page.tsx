'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getCommerce } from '@/lib/commerce'

// ── Wire transfer bank details ──────────────────────────────────────────────

const WIRE_DETAILS = [
  { label: 'Beneficiary Bank', value: 'Bank of America, NA' },
  { label: 'Beneficiary', value: 'Hanzo, Inc' },
  { label: 'ACH Routing', value: '113000023 / 111000025' },
  { label: 'Wire Routing', value: '026009593' },
  { label: 'SWIFT', value: 'BOFAUS3N' },
]

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtUSD(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function detectBrand(digits: string): string {
  if (digits.startsWith('4')) return 'visa'
  if (/^5[1-5]|^2[2-7]/.test(digits)) return 'mastercard'
  if (/^3[47]/.test(digits)) return 'amex'
  return ''
}

function brandLabel(brand: string) {
  const m: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex' }
  return m[brand] ?? 'Card'
}

// ── Topup page ───────────────────────────────────────────────────────────────

type PayTab = 'card' | 'crypto' | 'wire'

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

  // ── Card form state ──────────────────────────────────────────────────────
  const [cardNumber, setCardNumberRaw] = useState('')
  const [cardName, setCardName] = useState('')
  const [cardExpiry, setCardExpiryRaw] = useState('')
  const [cardCvc, setCardCvc] = useState('')
  const rawCardNumber = cardNumber.replace(/\D/g, '')
  const brand = detectBrand(rawCardNumber)
  const cvcLen = brand === 'amex' ? 4 : 3

  // ── Crypto payment state ─────────────────────────────────────────────────
  const [txHash, setTxHash] = useState('')
  const [fromAddr, setFromAddr] = useState('')

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

  // ── Card submit ──────────────────────────────────────────────────────────
  const handleCardSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!params.token) {
        setStatus({ type: 'error', message: 'Authentication required. Please sign in.' })
        return
      }

      if (rawCardNumber.length < 13) {
        setStatus({ type: 'error', message: 'Invalid card number.' })
        return
      }
      if (!cardExpiry.includes('/')) {
        setStatus({ type: 'error', message: 'Invalid expiry.' })
        return
      }
      const [mm, yy] = cardExpiry.split('/')
      if (!mm || !yy || mm.length !== 2 || yy.length !== 2) {
        setStatus({ type: 'error', message: 'Invalid expiry format. Use MM/YY.' })
        return
      }
      if (cardCvc.length < 3) {
        setStatus({ type: 'error', message: 'Invalid CVC.' })
        return
      }

      setStatus({ type: 'loading' })
      try {
        const commerce = getCommerce(commerceUrl, params.token)
        const userId = params.userId ?? ''

        const payment = await commerce.processCardPayment({
          card: {
            number: rawCardNumber,
            expMonth: parseInt(mm, 10),
            expYear: parseInt(`20${yy}`, 10),
            cvc: cardCvc,
          },
          amount: amountCents,
          userId: userId || undefined,
          currency: 'usd',
        })

        if (payment.status === 'paid' || payment.status === 'credit') {
          const bal = await commerce.getBalance(userId || params.token!)
          handleSuccess(bal.balance)
        } else {
          setStatus({ type: 'error', message: `Payment ${payment.status ?? 'failed'}.` })
        }
      } catch (err) {
        setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Payment failed.' })
      }
    },
    [params, rawCardNumber, cardExpiry, cardCvc, amountCents, commerceUrl, handleSuccess],
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

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '3px', marginBottom: '16px' }}>
          {(['card', 'crypto', 'wire'] as PayTab[]).map((t) => (
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
                background: tab === t ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: tab === t ? '#fafafa' : 'rgba(255,255,255,0.35)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {t === 'card' ? 'Card' : t === 'crypto' ? 'Crypto' : 'Wire'}
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
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="Card number"
                value={cardNumber}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, '').slice(0, 16)
                  setCardNumberRaw(d.replace(/(.{4})/g, '$1 ').trim())
                }}
                style={INPUT}
                disabled={isLoading}
                maxLength={19}
              />
              {brand && (
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em' }}>
                  {brandLabel(brand).toUpperCase()}
                </span>
              )}
            </div>
            <input
              type="text"
              autoComplete="cc-name"
              placeholder="Cardholder name"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              style={INPUT}
              disabled={isLoading}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/YY"
                value={cardExpiry}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, '').slice(0, 4)
                  setCardExpiryRaw(d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d)
                }}
                style={INPUT}
                disabled={isLoading}
                maxLength={5}
              />
              <input
                type="password"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="CVC"
                value={cardCvc}
                onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, cvcLen))}
                style={INPUT}
                disabled={isLoading}
                maxLength={cvcLen}
              />
            </div>
            <button type="submit" style={submitStyle(isLoading)} disabled={isLoading}>
              {isLoading ? 'Processing...' : `Pay ${fmtUSD(amountCents)}`}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              PCI DSS compliant · Secured by Hanzo Commerce
            </div>
          </form>
        )}

        {/* ── Crypto tab ────────────────────────────────────────────────── */}
        {tab === 'crypto' && (
          <form onSubmit={handleCryptoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.5 }}>
              Send USDC or ETH to the address below, then paste your transaction hash to confirm.
            </p>

            {/* Deposit address */}
            <button
              type="button"
              onClick={() => copy(HANZO_ETH_ADDRESS, 'Address')}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '10px 12px',
                textAlign: 'left',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                Deposit address (Ethereum / EVM)
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#fafafa', wordBreak: 'break-all' }}>
                {HANZO_ETH_ADDRESS}
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
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
              {isLoading ? 'Verifying...' : `Confirm ${fmtUSD(amountCents)} crypto payment`}
            </button>
          </form>
        )}

        {/* ── Wire tab ──────────────────────────────────────────────────── */}
        {tab === 'wire' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.5 }}>
              Wire the amount below to Hanzo, then click confirm. Credits appear within 1-2 business days after verification.
            </p>

            {WIRE_DETAILS.map(({ label, value }) => (
              <button
                key={label}
                type="button"
                onClick={() => copy(value, label)}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
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
                  <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '13px', color: '#fafafa', marginTop: '2px' }}>{value}</div>
                </div>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2">
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
                <div style={{ fontSize: '13px', color: '#fafafa', marginTop: '2px' }}>
                  Hanzo {params.userId ?? 'your-email@example.com'}
                </div>
              </div>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2">
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
              {isLoading ? 'Recording...' : `I've sent ${fmtUSD(amountCents)} via wire`}
            </button>

            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', margin: 0 }}>
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
