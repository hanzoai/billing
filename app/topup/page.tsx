'use client'

import { useState, useEffect, useCallback } from 'react'
import { getCommerce } from '@/lib/commerce'
import { BASE_PATH } from '@/lib/config'
import { getAccessToken, getCurrentUser } from '@/lib/iam-auth'
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
import { CommerceApiError, type CommercePaymentMethod } from '@/lib/commerce-client'
import { chargeKey, clearChargeKey } from '@/lib/charge'
import { TOPUP_AMOUNTS, TOPUP_DEFAULT } from '@/lib/topup'

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

// ── Cards on file ────────────────────────────────────────────────────────────

/** A card the customer already saved, offered instead of typing one again. */
interface SavedCard {
  id: string
  /** e.g. "Visa ending in 4242", or a generic that is still honest. */
  label: string
  isDefault: boolean
}

/** The choice that opens the Square form. Never a payment-method id. */
const NEW_CARD = 'new'

/**
 * The saved methods this page can actually charge.
 *
 * Card type AND a providerRef: commerce refuses a method with no vaulted card
 * behind it (422), so listing one would be offering a button that cannot pay.
 * The label is the card facts commerce reports, falling back to a generic
 * rather than inventing a brand.
 */
function chargeableCards(methods: unknown): SavedCard[] {
  if (!Array.isArray(methods)) return []
  const cards: SavedCard[] = []
  for (const m of methods as CommercePaymentMethod[]) {
    if (m?.type !== 'card' || !m.id || !m.providerRef) continue
    cards.push({
      id: m.id,
      label: m.card?.brand && m.card?.last4 ? `${m.card.brand} ending in ${m.card.last4}` : 'Saved card',
      isDefault: m.isDefault ?? false,
    })
  }
  return cards
}

/**
 * What a refused charge means, in words the customer can act on.
 *
 * Statuses commerce raises for a money move; anything else keeps the server's
 * own sentence, which is the useful one for a bad amount ("amountCents must be
 * between …") and for a card that carries no vaulted card.
 */
function chargeMessage(err: unknown): string {
  if (err instanceof CommerceApiError) {
    switch (err.status) {
      case 401:
        return 'Your session expired. Please sign in again.'
      case 402:
        return 'Card declined. Try another card.'
      case 404:
        return 'That saved card is no longer available — use a new card.'
      case 409:
        return 'A top-up is already in progress — give it a moment, then retry.'
      case 500:
        return 'Your card was charged but the credit did not land. Contact billing@hanzo.ai — do not retry.'
      case 503:
        return 'Billing is temporarily unavailable. Please retry in a moment.'
      default:
        return err.message || 'Payment failed.'
    }
  }
  return err instanceof Error ? err.message : 'Payment failed.'
}

/** A charge is keyed by what it buys: this card, this amount. */
function cardChargeScope(card: string, amountCents: number): string {
  return `topup:${card}:${amountCents}`
}

// ── Topup page ───────────────────────────────────────────────────────────────

type PayTab = 'card' | 'crypto' | 'wire' | 'wallet'

type Status =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'success'; balance: number }
  | { type: 'error'; message: string }

/**
 * The top-up page. Same-origin, signed in, not embeddable.
 *
 * URL params:
 *   amount — pre-set amount in USD cents (optional)
 *
 * It used to take `token`, `userId` and `returnUrl` from the query as well, and
 * report completion by posting to `window.parent` — an embedding contract that
 * nothing can use: the deployment serves `frame-ancestors 'none'` and
 * `X-Frame-Options: DENY`, so there is never a parent frame to post to. Taking a
 * bearer token from a URL is also how a token ends up in browser history, in a
 * referrer, and in every access log along the way. Identity comes from the
 * session, on this origin, and nowhere else.
 */
export default function TopupPage() {
  // ── Who is paying, and how much ──────────────────────────────────────────
  //
  // The amount may be suggested by the link that sent us here; the identity
  // never is. `getAccessToken` reads the session localStorage already holds —
  // the same one the rest of the app uses — and the subject is the org slug
  // commerce keys billing on, so the money lands in the account whose balance
  // the overview shows rather than in one named after the token's `sub`.
  const [params, setParams] = useState<{
    amount: number | null
    userId: string | null
    token: string | null
  }>({ amount: null, userId: null, token: null })

  // ── State ────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<PayTab>('card')
  const [customAmountCents, setCustomAmountCents] = useState<number | null>(null)
  const [status, setStatus] = useState<Status>({ type: 'idle' })
  const [copyMsg, setCopyMsg] = useState('')

  // ── Cards on file ────────────────────────────────────────────────────────
  //
  // A returning customer keys their card in again on every top-up, which is the
  // whole cost of not asking. So we ask — and the answer is never allowed to
  // stand between the customer and paying: no cards, an unreadable list, no
  // session, any failure at all leaves `cards` empty and the page is exactly
  // the blank Square form it was.
  const [cards, setCards] = useState<SavedCard[]>([])
  const [cardsLoading, setCardsLoading] = useState(true)
  const [chosen, setChosen] = useState<string>(NEW_CARD)

  const amountCents = customAmountCents ?? params.amount ?? TOPUP_DEFAULT

  // ── Commerce client ──────────────────────────────────────────────────────
  const commerceUrl = process.env.NEXT_PUBLIC_COMMERCE_URL ?? 'https://api.hanzo.ai'

  // ── Who is paying, how much, and with which card ─────────────────────────
  //
  // One pass, on mount: the session is read synchronously and the cards it can
  // charge are fetched with the same identity, so the page never renders the
  // new-card form for a moment and then swaps it out from under a customer who
  // had already started typing.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('amount')
    // A suggested amount arrives from a link, so it is checked like any other
    // outside input: a junk `?amount=` falls back to the page's own default
    // rather than rendering "$NaN" on the Pay button.
    const suggested = raw ? Number.parseInt(raw, 10) : Number.NaN
    const userId = getCurrentUser()?.commerceUserId ?? null
    const token = getAccessToken()
    setParams({
      amount: Number.isFinite(suggested) && suggested > 0 ? suggested : null,
      userId,
      token,
    })

    // No identity means no cards to list — and an unscoped read is not a thing
    // this page asks for.
    if (!token || !userId) {
      setCardsLoading(false)
      return
    }

    let live = true
    getCommerce(commerceUrl, token)
      .getPaymentMethods(userId, token)
      .then((methods) => {
        if (!live) return
        const saved = chargeableCards(methods)
        setCards(saved)
        // The card the customer marked default is the opening choice, else the
        // most recent. Only 'new' when there is genuinely nothing to charge.
        if (saved.length > 0) setChosen((saved.find((c) => c.isDefault) ?? saved[0]).id)
      })
      .catch(() => {
        if (live) setCards([])
      })
      .finally(() => {
        if (live) setCardsLoading(false)
      })
    return () => {
      live = false
    }
  }, [commerceUrl])

  const useNewCard = chosen === NEW_CARD
  const chosenCard = cards.find((c) => c.id === chosen)

  // ── Square card element (shared hook) ─────────────────────────────────────
  //
  // Only for a card being typed: a saved-card top-up never loads the SDK, and
  // neither does the wait while we are still finding out whether there is one.
  const { ready: sqReady, loading: sqLoading, error: sqError, tokenize: sqTokenize } = useSquareCard(
    'sq-card-container',
    tab === 'card' && useNewCard && !cardsLoading,
  )

  // ── Crypto payment state ─────────────────────────────────────────────────
  const [txHash, setTxHash] = useState('')
  const [fromAddr, setFromAddr] = useState('')

  // ── Wallet (HUSD) state — a sent-but-not-yet-credited transfer, so a failed
  //    record can be retried without re-sending HUSD. ─────────────────────────
  const [walletSent, setWalletSent] = useState<Sent | null>(null)

  // ── Crypto receive address (Hanzo's deposit wallet) ──────────────────────
  // Read from config, never a literal. An unset value renders the tab's honest
  // unavailable state rather than a wrong address — the same discipline the
  // HUSD tab already uses (topupConfigured). A hardcoded address here once was
  // a third party's wallet, so a customer following the happy path would have
  // sent USDC to someone else and lost it. The address must be operator-supplied.
  const HANZO_ETH_ADDRESS = (process.env.NEXT_PUBLIC_HANZO_ETH_TREASURY ?? '').trim()

  // ── Success handler ──────────────────────────────────────────────────────
  const handleSuccess = useCallback((newBalance: number) => {
    setStatus({ type: 'success', balance: newBalance })
  }, [])

  // ── Card submit ───────────────────────────────────────────────────────────
  //
  // Two doors, one form. A saved card is charged by its payment-method id and
  // nothing is re-entered; a new card goes through Square's hosted fields for a
  // single-use nonce. Either way the card itself never reaches this code.
  const handleCardSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!params.token) {
        setStatus({ type: 'error', message: 'Authentication required. Please sign in.' })
        return
      }
      if (useNewCard && !sqReady) {
        setStatus({ type: 'error', message: 'Card form not ready. Please wait.' })
        return
      }

      setStatus({ type: 'loading' })
      const commerce = getCommerce(commerceUrl, params.token)

      // A nonce is single-use, so the tokenized path needs no idempotency key —
      // spending one twice is not something Square permits, and re-tokenizing
      // mints a different nonce anyway. Only the reusable saved card needs one.
      if (useNewCard) {
        try {
          const payment = await commerce.topupWithSquareToken({
            sourceId: await sqTokenize(),
            amountCents,
            userId: params.userId || undefined,
            currency: 'usd',
          })
          handleSuccess(payment.balanceCents)
        } catch (err) {
          setStatus({ type: 'error', message: chargeMessage(err) })
        }
        return
      }

      const scope = cardChargeScope(chosen, amountCents)
      try {
        const payment = await commerce.topupWithMethod(
          {
            paymentMethodId: chosen,
            amountCents,
            userId: params.userId || undefined,
            currency: 'usd',
          },
          { idempotencyKey: chargeKey(scope) },
        )
        clearChargeKey(scope)
        handleSuccess(payment.balanceCents)
      } catch (err) {
        // A refusal the customer can act on ends the attempt: the next submit is
        // a NEW charge and must not replay this one's answer. A lost response
        // keeps its key, which is the case the key exists for.
        if (err instanceof CommerceApiError && err.status !== 409 && err.status < 500) {
          clearChargeKey(scope)
        }
        setStatus({ type: 'error', message: chargeMessage(err) })
      }
    },
    [params, useNewCard, chosen, sqReady, sqTokenize, amountCents, commerceUrl, handleSuccess],
  )

  // ── Crypto submit ─────────────────────────────────────────────────────────
  const handleCryptoSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      // No configured deposit address means no crypto flow at all; refuse to
      // record a payment against an address we did not publish.
      if (!HANZO_ETH_ADDRESS) {
        setStatus({ type: 'error', message: 'Crypto deposits are not available yet.' })
        return
      }
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
            <a
              href={`${BASE_PATH}/`}
              style={{ display: 'inline-block', marginTop: '16px', fontSize: '13px', color: 'var(--color-text)', textDecoration: 'underline' }}
            >
              Back to billing
            </a>
          </div>
        </div>
      </div>
    )
  }

  const isLoading = status.type === 'loading'

  // Paying is off while a charge is in flight, while we still do not know which
  // cards exist, and — for a card being typed — until Square's fields are live.
  // A saved card needs none of that: it is chargeable the moment it is chosen.
  const payDisabled = isLoading || cardsLoading || (useNewCard && !sqReady)

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
            {TOPUP_AMOUNTS.map((c) => (
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
            {/* Cards on file — the chooser only appears when there is a choice.
                While the answer is unknown the page says so rather than showing
                a blank form it may be about to replace. */}
            {cardsLoading ? (
              <p style={{ fontSize: '12px', color: 'color-mix(in oklab, var(--color-text) 35%, transparent)', margin: 0 }}>
                Checking for cards on file…
              </p>
            ) : cards.length > 0 ? (
              <div role="radiogroup" aria-label="Pay with" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[...cards, { id: NEW_CARD, label: 'Use a new card', isDefault: false }].map((opt) => (
                  <label key={opt.id} style={choiceStyle(chosen === opt.id)}>
                    <input
                      type="radio"
                      name="topup-card"
                      checked={chosen === opt.id}
                      onChange={() => setChosen(opt.id)}
                      style={{ accentColor: 'currentColor' }}
                    />
                    <span>{opt.label}</span>
                    {opt.isDefault && (
                      <span style={{ marginLeft: 'auto', fontSize: '10px', borderRadius: '999px', padding: '2px 8px', border: '1px solid color-mix(in oklab, var(--color-text) 12%, transparent)', color: 'color-mix(in oklab, var(--color-text) 40%, transparent)' }}>
                        Default
                      </span>
                    )}
                  </label>
                ))}
              </div>
            ) : null}

            {/* Square card container — mounted only for a card being typed */}
            {!cardsLoading && useNewCard && (
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
              style={submitStyle(payDisabled)}
              disabled={payDisabled}
            >
              {isLoading
                ? 'Processing...'
                : chosenCard
                  ? `Pay ${moneyFromCents(amountCents)} with ${chosenCard.label}`
                  : `Pay ${moneyFromCents(amountCents)}`}
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
          {!HANZO_ETH_ADDRESS ? (
            // No operator-supplied deposit address means there is nowhere safe
            // to send funds, so the tab says so instead of showing an address.
            // Never render a fallback address here: a wrong one loses real money.
            <p style={{ fontSize: '12px', color: 'color-mix(in oklab, var(--color-text) 40%, transparent)', margin: 0, lineHeight: 1.5 }}>
              Crypto deposits are coming soon. Fund your balance with a card meanwhile — the
              Card tab is instant.
            </p>
          ) : (
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
          )}
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
                const email = params.userId ?? 'your account'
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
                  Hanzo {params.userId ?? 'your account'}
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

/** One row of the pay-with chooser: a saved card, or the new-card option. */
function choiceStyle(selected: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    borderRadius: '8px',
    padding: '9px 12px',
    fontSize: '13px',
    border: `1px solid ${selected ? 'color-mix(in oklab, var(--color-text) 35%, transparent)' : 'color-mix(in oklab, var(--color-text) 10%, transparent)'}`,
    background: selected ? 'color-mix(in oklab, var(--color-text) 6%, transparent)' : 'transparent',
    color: selected ? 'var(--color-text)' : 'color-mix(in oklab, var(--color-text) 55%, transparent)',
  }
}

function submitStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 600,
    // The brand pair, not a literal. This was `#ffffff` on `var(--color-bg)`,
    // which is white-on-white the moment the ground is light — the primary
    // action on the money page, invisible. `--color-brand` and its foreground
    // invert together with the theme, so the pair always contrasts.
    background: disabled ? 'color-mix(in oklab, var(--color-text) 6%, transparent)' : 'var(--color-brand)',
    color: disabled ? 'color-mix(in oklab, var(--color-text) 30%, transparent)' : 'var(--color-brand-foreground)',
    border: 'none',
    borderRadius: '8px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s',
    marginTop: '4px',
  }
}
