'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { encodeQR } from 'qr'
import { getCommerce } from '@/lib/commerce'
import { BASE_PATH, COMMERCE_URL } from '@/lib/config'
import { getAccessToken, getCurrentUser } from '@/lib/iam-auth'
import { useApplePay, useSquareCard } from '@/lib/square'
import { ErrorBoundary } from '@/lib/components/error-boundary'
import {
  sendHusdTopup,
  recordHusdTopup,
  topupConfigured,
  HUSD_TREASURY,
  type Sent,
} from '@/lib/wallet-topup'
import { moneyFromCents } from '@/lib/money'
import {
  CommerceApiError,
  type CommercePaymentMethod,
  type CryptoDeposit,
  type CryptoOptions,
} from '@/lib/commerce-client'
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

/** The wallet choice. Offered only while the device and Square both say yes. */
const APPLE_PAY = 'apple-pay'

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

// ── Crypto deposits ──────────────────────────────────────────────────────────
//
// The rail that can actually credit a coin: commerce mints a custody address
// this payer alone deposits to, and a chain watcher credits the balance on
// confirmations. Nothing on this tab moves money and nothing on it claims a
// credit — the form it replaced took a typed transaction hash and posted it to
// /v1/payments, a generic REST resource with no create hook, then read the
// balance back and announced a successful top-up. It verified nothing, credited
// nothing, and recorded every send as mainnet ethereum whatever chain it was on.

/** An asset the rail can receive AND credit, spelled the way commerce spells it. */
interface Asset {
  label: string
  chain: string
  token: string
}

/**
 * The pairs worth a label. Each names a chain the watcher reads and a token
 * commerce can price: a deposit is valued at a fixed peg, so only stablecoins
 * can be credited and a native coin (ETH, SOL, BTC) is never offered. Which of
 * these a customer SEES is the server's answer, never this list.
 *
 * The label carries the chain because a token alone stops naming a destination
 * the moment two chains carry it — and on a deposit screen that ambiguity is
 * someone sending USDC over a network the address cannot receive.
 */
const ASSETS: Asset[] = [
  { label: 'USDC · Base', chain: 'base', token: 'usdc' },
  { label: 'USDC · Ethereum', chain: 'ethereum', token: 'usdc' },
  { label: 'USDT · Ethereum', chain: 'ethereum', token: 'usdt' },
  { label: 'USDC · Solana', chain: 'solana', token: 'usdc' },
  { label: 'RLUSD · XRPL', chain: 'xrpl', token: 'rlusd' },
  { label: 'USDT · TON', chain: 'ton', token: 'usdt' },
]

/**
 * What the server says it is watching — and NOTHING when it has not said.
 *
 * A failed options call must not fall back to a list: every row in it invites a
 * customer to send real money, and an unanswered question is not permission to
 * take it.
 */
function offered(options: CryptoOptions | null): Asset[] {
  if (!options) return []
  const chains = new Set(options.chains ?? [])
  const tokens = new Set(options.tokens ?? [])
  return ASSETS.filter((a) => chains.has(a.chain) && tokens.has(a.token))
}

/**
 * Choose a network, get the address to send to. No amount is charged and no
 * balance moves here; the address is a standing destination, so changing the
 * amount above afterwards does not invalidate it — the credit is whatever the
 * chain delivers, once it confirms.
 */
function CryptoTab({
  token,
  amountCents,
  copy,
  copyMsg,
  onError,
}: {
  token: string | null
  amountCents: number
  copy: (text: string, label: string) => void
  copyMsg: string
  onError: (message: string | null) => void
}) {
  // null while we are still asking; [] means nothing is on offer, which is the
  // honest state for both "the rail is closed" and "we could not find out".
  const [assets, setAssets] = useState<Asset[] | null>(null)
  const [chosen, setChosen] = useState<Asset | null>(null)
  const [deposit, setDeposit] = useState<CryptoDeposit | null>(null)
  const [minting, setMinting] = useState(false)

  useEffect(() => {
    if (!token) {
      setAssets([])
      return
    }
    let live = true
    getCommerce(COMMERCE_URL, token)
      .getCryptoOptions(token)
      .then((o) => { if (live) setAssets(offered(o)) })
      .catch(() => { if (live) setAssets([]) })
    return () => { live = false }
  }, [token])

  const choose = useCallback(
    async (asset: Asset) => {
      if (!token) return
      // The address on screen and the asset named beside it are set together, so
      // the customer can never be reading one chain's address under another
      // chain's name.
      setChosen(asset)
      setDeposit(null)
      setMinting(true)
      onError(null)
      try {
        setDeposit(
          await getCommerce(COMMERCE_URL, token).createCryptoDeposit(
            { chain: asset.chain, token: asset.token, amountCents },
            token,
          ),
        )
      } catch (err) {
        // Commerce writes these for the customer ("nothing is watching that
        // address…"), so its sentence is the useful one.
        onError(err instanceof Error ? err.message : 'Could not get a deposit address.')
      }
      setMinting(false)
    },
    [token, amountCents, onError],
  )

  // A QR of the address, and ONLY where the address is the whole destination.
  // Where commerce issues a tag the payment needs both halves, and a scannable
  // address on its own is an invitation to send the half that arrives at an
  // account we own and belongs to nobody.
  const qr = useMemo(
    () => (deposit?.depositAddress && !deposit.addressTag ? encodeQR(deposit.depositAddress, 'svg') : null),
    [deposit],
  )

  if (assets === null) {
    return <p style={NOTE}>Checking which networks are accepted…</p>
  }
  if (assets.length === 0) {
    // Two different silences, and saying which one it is costs nothing: an
    // address is minted for a PAYER, so with no session there is nobody to mint
    // one for — which is not the same as the rail being closed.
    return (
      <p style={NOTE}>
        {token
          ? 'Crypto deposits are not available right now. Fund your balance with a card meanwhile — the Card tab is instant.'
          : 'Sign in to get a deposit address.'}
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <p style={NOTE}>
        Choose a network to get your deposit address. Your balance is credited once the network
        confirms the transfer — nothing is charged here.
      </p>

      <div role="radiogroup" aria-label="Deposit asset" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {assets.map((a) => {
          const active = chosen?.chain === a.chain && chosen?.token === a.token
          return (
            <button
              key={`${a.chain}:${a.token}`}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={minting}
              onClick={() => { if (!active) void choose(a) }}
              style={chipStyle(active)}
            >
              {a.label}
            </button>
          )
        })}
      </div>

      {minting && <p style={NOTE}>Getting your {chosen?.label} deposit address…</p>}

      {deposit && chosen && !minting && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          {qr && (
            <div
              role="img"
              aria-label={`${chosen.label} deposit address`}
              style={QR}
              dangerouslySetInnerHTML={{ __html: qr }}
            />
          )}

          <button type="button" onClick={() => copy(deposit.depositAddress, 'Address')} style={COPY_ROW}>
            <div style={FIELD_LABEL}>Deposit address · {chosen.label}</div>
            <div className="mono" style={{ fontSize: '12px', color: 'var(--color-text)', wordBreak: 'break-all' }}>
              {deposit.depositAddress}
            </div>
            <div style={{ fontSize: '10px', color: 'color-mix(in oklab, var(--color-text) 30%, transparent)', marginTop: '4px' }}>
              Click to copy
            </div>
          </button>

          {deposit.addressTag && (
            <button type="button" onClick={() => copy(deposit.addressTag ?? '', 'Destination tag')} style={COPY_ROW}>
              <div style={FIELD_LABEL}>Destination tag (required)</div>
              <div className="mono" style={{ fontSize: '12px', color: 'var(--color-text)' }}>{deposit.addressTag}</div>
              <div style={{ fontSize: '10px', color: '#f87171', marginTop: '4px', lineHeight: 1.5 }}>
                Send this tag with the payment. The address is shared, so a deposit without the tag
                names no account and cannot be credited.
              </div>
            </button>
          )}

          {copyMsg && <p style={{ fontSize: '11px', color: '#34d399', margin: 0 }}>{copyMsg}</p>}

          <p style={{ ...NOTE, textAlign: 'center' }}>
            Send only {chosen.label} to this address. Another asset, or the same one on another
            network, cannot be recovered.
          </p>
        </div>
      )}
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
  // The row the customer clicked — null until they do. What is CHARGED is the
  // derived `chosen` below, so the opening choice never needs an effect.
  const [picked, setPicked] = useState<string | null>(null)

  const amountCents = customAmountCents ?? params.amount ?? TOPUP_DEFAULT

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
    getCommerce(COMMERCE_URL, token)
      .getPaymentMethods(userId, token)
      .then((methods) => {
        if (!live) return
        setCards(chargeableCards(methods))
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
  }, [])

  // ── Apple Pay (shared hook) ───────────────────────────────────────────────
  //
  // When the device can pay this way, the wallet IS the payment action — the
  // generic pay button renders only as its fallback. Availability is a feature
  // test inside the hook; `ready` false costs nothing and shows nothing.
  const { ready: apReady, tokenize: apTokenize } = useApplePay(amountCents, tab === 'card')

  // What is charged on submit: the customer's own click wins, then Apple Pay
  // when the device offers it, then the saved default card, then the blank
  // form. Derived, so the async arrivals (wallet, cards) cannot race a chosen
  // value out from under a customer who never clicked anything.
  const chosen =
    picked ?? (apReady ? APPLE_PAY : cards.length > 0 ? (cards.find((c) => c.isDefault) ?? cards[0]).id : NEW_CARD)

  const useNewCard = chosen === NEW_CARD
  const chosenCard = cards.find((c) => c.id === chosen)

  // ── Square card element (shared hook) ─────────────────────────────────────
  //
  // Only for a card being typed: a saved-card or wallet top-up never loads the
  // card fields, and neither does the wait while we are still finding out
  // whether there is a saved one.
  const { ready: sqReady, loading: sqLoading, error: sqError, tokenize: sqTokenize } = useSquareCard(
    'sq-card-container',
    tab === 'card' && useNewCard && !cardsLoading,
  )

  // ── Wallet (HUSD) state — a sent-but-not-yet-credited transfer, so a failed
  //    record can be retried without re-sending HUSD. ─────────────────────────
  const [walletSent, setWalletSent] = useState<Sent | null>(null)

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
      const commerce = getCommerce(COMMERCE_URL, params.token)

      // A nonce is single-use, so the tokenized paths need no idempotency key —
      // spending one twice is not something Square permits, and re-tokenizing
      // mints a different nonce anyway. Only the reusable saved card needs one.
      // Apple Pay and a typed card are the same money path: a sheet or an
      // iframe mints the nonce, the identical server call charges it.
      if (chosen === APPLE_PAY) {
        try {
          const sourceId = await apTokenize()
          if (!sourceId) {
            // Sheet dismissed — a change of mind, not a failure.
            setStatus({ type: 'idle' })
            return
          }
          const payment = await commerce.topupWithSquareToken({
            sourceId,
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
    [params, useNewCard, chosen, sqReady, sqTokenize, apTokenize, amountCents, handleSuccess],
  )

  // ── Crypto error reporting ────────────────────────────────────────────────
  //
  // The deposit tab owns its own state; the only thing it hands back is a
  // failure, so it reads in the same box every other tab's does.
  const reportCryptoError = useCallback((message: string | null) => {
    setStatus(message ? { type: 'error', message } : { type: 'idle' })
  }, [])

  // ── Wallet (HUSD) submit ───────────────────────────────────────────────────
  const creditWalletTopup = useCallback(
    async (sent: Sent) => {
      const { balanceCents } = await recordHusdTopup({
        commerceUrl: COMMERCE_URL,
        token: params.token ?? undefined,
        userId: params.userId ?? undefined,
        txHash: sent.txHash,
        fromAddress: sent.fromAddress,
      })
      setWalletSent(null)
      handleSuccess(balanceCents)
    },
    [params.token, params.userId, handleSuccess],
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
      const commerce = getCommerce(COMMERCE_URL, params.token)
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
  }, [params, amountCents, handleSuccess])

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
  // Apple Pay needs only itself: the sheet carries its own credentials, so the
  // cards-on-file answer cannot gate it.
  const payDisabled =
    isLoading || (chosen !== APPLE_PAY && (cardsLoading || (useNewCard && !sqReady)))

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
            {/* Ways to pay — the chooser only appears when there is a choice:
                a wallet, a card on file, or both. While the cards answer is
                unknown the page says so rather than showing a blank form it
                may be about to replace. */}
            {cardsLoading && !apReady ? (
              <p style={{ fontSize: '12px', color: 'color-mix(in oklab, var(--color-text) 35%, transparent)', margin: 0 }}>
                Checking for cards on file…
              </p>
            ) : apReady || cards.length > 0 ? (
              <div role="radiogroup" aria-label="Pay with" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  ...(apReady ? [{ id: APPLE_PAY, label: 'Apple Pay', isDefault: false }] : []),
                  ...cards,
                  { id: NEW_CARD, label: 'Use a new card', isDefault: false },
                ].map((opt) => (
                  <label key={opt.id} style={choiceStyle(chosen === opt.id)}>
                    <input
                      type="radio"
                      name="topup-card"
                      checked={chosen === opt.id}
                      onChange={() => setPicked(opt.id)}
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

            {/* ONE payment action. When Apple Pay is on the sheet the wallet
                button IS it — WebKit paints the mark, so the element stays
                empty — and the generic pay button exists only as the fallback
                for everything else. Never both. */}
            {chosen === APPLE_PAY ? (
              <button
                type="submit"
                className="apple-pay-button"
                disabled={payDisabled}
                aria-label={`Pay ${moneyFromCents(amountCents)} with Apple Pay`}
              />
            ) : (
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
            )}

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
            <CryptoTab
              token={params.token}
              amountCents={amountCents}
              copy={copy}
              copyMsg={copyMsg}
              onError={reportCryptoError}
            />
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
                  style={COPY_ROW}
                >
                  <div style={FIELD_LABEL}>HUSD treasury (Hanzo Mainnet)</div>
                  <div className="mono" style={{ fontSize: '12px', color: 'var(--color-text)', wordBreak: 'break-all' }}>
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

/** A quiet line of explanation — what a tab says when it is not asking. */
const NOTE: React.CSSProperties = {
  fontSize: '12px',
  color: 'color-mix(in oklab, var(--color-text) 40%, transparent)',
  margin: 0,
  lineHeight: 1.5,
}

/** The small-caps name above a value the customer has to carry elsewhere. */
const FIELD_LABEL: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  color: 'color-mix(in oklab, var(--color-text) 35%, transparent)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '4px',
}

/** That value, and one tap copies it. */
const COPY_ROW: React.CSSProperties = {
  background: 'color-mix(in oklab, var(--color-text) 4%, transparent)',
  border: '1px solid color-mix(in oklab, var(--color-text) 10%, transparent)',
  borderRadius: '8px',
  padding: '10px 12px',
  textAlign: 'left',
  cursor: 'pointer',
  width: '100%',
}

/**
 * The white ground under a QR is not a theme choice: the code is read by a
 * camera, and dark modules on a light field is what a scanner is built for —
 * inverted, half the phones in a queue simply fail to see it. The encoder draws
 * its own quiet zone, so the box just holds it at a scannable size.
 */
const QR: React.CSSProperties = {
  width: '184px',
  height: '184px',
  boxSizing: 'border-box',
  padding: '8px',
  borderRadius: '8px',
  background: '#ffffff',
}

/** One asset in the deposit chooser, at the 44px touch floor. */
function chipStyle(selected: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '44px',
    padding: '0 14px',
    fontSize: '12px',
    fontWeight: 600,
    borderRadius: '8px',
    border: `1px solid ${selected ? 'color-mix(in oklab, var(--color-text) 35%, transparent)' : 'color-mix(in oklab, var(--color-text) 10%, transparent)'}`,
    background: selected ? 'color-mix(in oklab, var(--color-text) 8%, transparent)' : 'transparent',
    color: selected ? 'var(--color-text)' : 'color-mix(in oklab, var(--color-text) 45%, transparent)',
    cursor: 'pointer',
  }
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
    // One control scale for the pay action in both of its states: 40px is the
    // Apple Pay button's height (global.css), so the generic fallback matches
    // it instead of drifting a few pixels under its own padding.
    minHeight: '40px',
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
