'use client'

/**
 * Square Web Payments SDK — the ONE place the billing SPA tokenizes. The card
 * fields and the Apple Pay sheet both live here; every payment leaves as the
 * same single-use `sourceId` nonce.
 *
 * Both money-in flows (the top-up page and paid-plan self-serve checkout) mount
 * a Square card element and turn the entered card into a single-use `sourceId`
 * nonce, which the server charges. Card data never touches our code — Square's
 * iframe holds the PAN and returns only the nonce (PCI DSS compliant).
 *
 * Consumers render their own container div with `id={containerId}` plus a
 * submit button, drive state off `{ ready, loading, error }`, and call
 * `tokenize()` on submit to get the nonce (it throws with a human message on a
 * validation/SDK failure).
 */

import { useCallback, useEffect, useRef, useState } from 'react'

// ── SDK surface (minimal) ────────────────────────────────────────────────────

export interface SquareCard {
  attach(selector: string): Promise<void>
  tokenize(): Promise<{ status: string; token?: string; errors?: Array<{ message: string }> }>
  destroy(): Promise<void>
}
interface SquarePaymentRequest {
  /** Reflect a changed total into the (not yet open) sheet; true when applied. */
  update(options: { total: { amount: string; label: string } }): boolean
}
interface SquareApplePay {
  tokenize(): Promise<{ status: string; token?: string; errors?: Array<{ message: string }> }>
}
interface SquarePayments {
  card(options?: Record<string, unknown>): Promise<SquareCard>
  paymentRequest(options: Record<string, unknown>): SquarePaymentRequest
  applePay(request: SquarePaymentRequest): Promise<SquareApplePay>
}
interface SquareSDK {
  payments(appId: string, locationId: string): Promise<SquarePayments>
}
declare global {
  interface Window {
    Square?: SquareSDK
    /** WebKit only — the capability probe Apple Pay availability gates on. */
    ApplePaySession?: { canMakePayments(): boolean }
  }
}

// ── Environment config (client-side, safe to expose) ─────────────────────────

export const SQUARE_APP_ID = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID ?? ''
export const SQUARE_LOCATION_ID = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ?? ''
const SQUARE_ENV = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT ?? 'sandbox'
const SQUARE_SCRIPT_URL =
  SQUARE_ENV === 'production'
    ? 'https://web.squarecdn.com/v1/square.js'
    : 'https://sandbox.web.squarecdn.com/v1/square.js'

// ── Card colours ─────────────────────────────────────────────────────────────

/**
 * Square paints its fields in a cross-origin iframe on a white surface of its
 * own, and it does NOT accept a background from us — `.input-container`
 * backgroundColor is rejected outright ("Invalid style property"), and setting
 * it on `input` changes nothing. So the surface is white whatever the page is.
 *
 * Which is why we no longer choose the ink. This used to hard-code `#fafafa`,
 * a near-white, and that is invisible on white — not only in the light theme,
 * as was long assumed, but in the DEFAULT dark one too: the typed card number
 * rendered as ghost text against Square's own white card. Deriving the colour
 * from the live theme instead just moves which theme is unreadable.
 *
 * Square's defaults are dark-on-white and internally consistent, so they are
 * legible under both our themes, identically. We set the size, and the colour
 * of the validation message. Nothing here depends on the theme, so the card
 * never has to re-attach on a flip — which would have discarded whatever the
 * customer had already typed.
 */
const CARD_STYLE = {
  input: { fontSize: '14px' },
  '.message-text': { color: '#f87171' },
  '.message-icon': { color: '#f87171' },
}

// ── Script loader ─────────────────────────────────────────────────────────────

let scriptLoadPromise: Promise<void> | null = null

export function loadSquareScript(): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise
  if (typeof window !== 'undefined' && window.Square) {
    return (scriptLoadPromise = Promise.resolve())
  }
  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SQUARE_SCRIPT_URL}"]`)
    if (existing) {
      if (window.Square) { resolve(); return }
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load Square Web Payments SDK')))
      return
    }
    const script = document.createElement('script')
    script.src = SQUARE_SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Square Web Payments SDK'))
    document.head.appendChild(script)
  }).catch((e) => {
    // Never cache a rejected load — a transient network blip must not
    // permanently break the card form until a full page reload.
    scriptLoadPromise = null
    throw e
  })
  return scriptLoadPromise
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseSquareCard {
  /** Card element attached and accepting input. */
  ready: boolean
  /** Initialising the SDK / card element. */
  loading: boolean
  /** Initialisation failed (SDK blocked, misconfig, timeout). */
  error: string | null
  /** Tokenize the entered card → single-use nonce; throws with a human message. */
  tokenize: () => Promise<string>
}

/**
 * Mount a Square card element into `#${containerId}` and expose `tokenize()`.
 * `enabled` lets a caller defer init until its container is in the DOM (e.g. the
 * top-up page only renders the card container on its Card tab).
 */
export function useSquareCard(containerId: string, enabled = true): UseSquareCard {
  const cardRef = useRef<SquareCard | null>(null)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return

    // Liveness belongs to THIS run of the effect, not to the component. It was a
    // ref shared across runs, so a cleanup could flip it false and the attach
    // still in flight from the current run would then read "unmounted" and
    // destroy the card it had just successfully attached — leaving an empty box
    // and a permanently disabled Pay button, with no error to explain either.
    let alive = true
    let card: SquareCard | null = null

    setReady(false)
    setError(null)
    setLoading(true)

    async function attemptInit(): Promise<SquareCard> {
      await loadSquareScript()
      if (!window.Square) throw new Error('Square SDK unavailable')
      if (!SQUARE_APP_ID) throw new Error('Payment form not configured (missing app ID)')
      if (!SQUARE_LOCATION_ID) throw new Error('Payment form not configured (missing location ID)')
      const payments = await window.Square.payments(SQUARE_APP_ID, SQUARE_LOCATION_ID)
      const c = await payments.card({ style: CARD_STYLE })
      await c.attach(`#${containerId}`)
      return c
    }

    async function init() {
      // Square's "unable to be initialized in time" is often a transient backend
      // timeout — retry with backoff before surfacing an error.
      let lastErr: unknown = null
      for (let attempt = 1; attempt <= 3 && alive; attempt++) {
        try {
          const c = await attemptInit()
          if (!alive) { await c.destroy().catch(() => undefined); return }
          card = c
          cardRef.current = c
          setReady(true)
          setError(null)
          setLoading(false)
          return
        } catch (err) {
          lastErr = err
          if (attempt < 3 && alive) {
            await new Promise((r) => setTimeout(r, 1200 * attempt))
          }
        }
      }
      if (alive) {
        const raw = lastErr instanceof Error ? lastErr.message : ''
        setError(
          /initialized in time|timeout|timed out|network/i.test(raw)
            ? 'The card form timed out loading from Square. Reload to retry, or use another method. An ad/privacy blocker can also block Square.'
            : raw || 'Failed to initialize the card form',
        )
        setLoading(false)
      }
    }

    void init()

    return () => {
      alive = false
      card?.destroy().catch(() => undefined)
      if (cardRef.current === card) cardRef.current = null
      setReady(false)
    }
  }, [containerId, enabled])

  const tokenize = useCallback(async (): Promise<string> => {
    const card = cardRef.current
    if (!card) throw new Error('Card form is not ready yet. Please wait a moment.')
    const result = await card.tokenize()
    if (result.status !== 'OK' || !result.token) {
      throw new Error(result.errors?.map((e) => e.message).join('; ') ?? 'Card tokenization failed')
    }
    return result.token
  }, [])

  return { ready, loading, error, tokenize }
}

// ── Apple Pay ─────────────────────────────────────────────────────────────────

/** The sheet's total row: our name, the amount being charged. */
function sheetTotal(amountCents: number): { amount: string; label: string } {
  return { amount: (amountCents / 100).toFixed(2), label: 'Hanzo' }
}

export interface UseApplePay {
  /** The device offers Apple Pay AND Square accepted this origin for it. */
  ready: boolean
  /**
   * Open the Apple Pay sheet → single-use nonce. Resolves null when the
   * customer dismisses the sheet — a change of mind, not an error to show.
   * Throws with a human message on a real failure.
   */
  tokenize: () => Promise<string | null>
}

/**
 * Apple Pay on the same Square payments plane as the card form: the sheet
 * returns the same single-use `sourceId` nonce, charged by the same server
 * calls. No card data, no separate money path.
 *
 * Availability is a feature test, never a setting. The device must offer
 * Apple Pay at all (ApplePaySession.canMakePayments) and Square must accept
 * this origin (payments.applePay resolves only on a domain registered for
 * Apple Pay). Either test failing leaves `ready` false and the caller keeps
 * its generic pay button — silently, because an unavailable wallet is a fact
 * about the browser, not something the customer can act on.
 *
 * Built once; the sheet's total tracks `amountCents` via paymentRequest
 * .update(), so an amount click never rebuilds the wallet session.
 */
export function useApplePay(amountCents: number, enabled = true): UseApplePay {
  const applePayRef = useRef<SquareApplePay | null>(null)
  const requestRef = useRef<SquarePaymentRequest | null>(null)
  const [ready, setReady] = useState(false)

  // Init reads the amount from a ref: the one-time build must see the amount
  // current at build time without re-running on every amount click.
  const amountRef = useRef(amountCents)
  amountRef.current = amountCents

  useEffect(() => {
    if (!enabled || applePayRef.current) return
    if (typeof window === 'undefined' || !window.ApplePaySession?.canMakePayments()) return

    let alive = true
    ;(async () => {
      try {
        await loadSquareScript()
        if (!alive || !window.Square || !SQUARE_APP_ID || !SQUARE_LOCATION_ID) return
        const payments = await window.Square.payments(SQUARE_APP_ID, SQUARE_LOCATION_ID)
        const request = payments.paymentRequest({
          countryCode: 'US',
          currencyCode: 'USD',
          total: sheetTotal(amountRef.current),
        })
        const applePay = await payments.applePay(request)
        if (!alive) return
        requestRef.current = request
        applePayRef.current = applePay
        setReady(true)
      } catch {
        // Origin not registered with Square for Apple Pay, or the SDK refused —
        // the card form stands and nothing here needs saying.
      }
    })()
    return () => {
      alive = false
    }
  }, [enabled])

  useEffect(() => {
    requestRef.current?.update({ total: sheetTotal(amountCents) })
  }, [amountCents])

  const tokenize = useCallback(async (): Promise<string | null> => {
    const applePay = applePayRef.current
    if (!applePay) throw new Error('Apple Pay is not ready yet. Please wait a moment.')
    const result = await applePay.tokenize()
    if (result.status === 'Cancel') return null
    if (result.status !== 'OK' || !result.token) {
      throw new Error(result.errors?.map((e) => e.message).join('; ') ?? 'Apple Pay could not authorize the payment')
    }
    return result.token
  }, [])

  return { ready, tokenize }
}
