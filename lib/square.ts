'use client'

/**
 * Square Web Payments SDK — the ONE place the billing SPA tokenizes a card.
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
interface SquarePayments {
  card(options?: Record<string, unknown>): Promise<SquareCard>
}
interface SquareSDK {
  payments(appId: string, locationId: string): Promise<SquarePayments>
}
declare global {
  interface Window {
    Square?: SquareSDK
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

// Square validates fontFamily against its own allowlist (it must load the font
// into its iframe) and rejects both CSS-wide stacks and arbitrary names like
// 'Inter', throwing "Invalid style value … for property 'fontFamily'" — which
// blocks the card iframe from painting. Omit fontFamily entirely → Square uses
// its built-in default and the fields render cleanly.
export const SQUARE_CARD_STYLE = {
  input: {
    backgroundColor: 'transparent',
    color: '#fafafa',
    fontSize: '14px',
  },
  'input::placeholder': { color: '#52525b' },
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
  const mountedRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    mountedRef.current = true
    setReady(false)
    setError(null)
    setLoading(true)

    async function attemptInit(): Promise<SquareCard> {
      await loadSquareScript()
      if (!window.Square) throw new Error('Square SDK unavailable')
      if (!SQUARE_APP_ID) throw new Error('Payment form not configured (missing app ID)')
      if (!SQUARE_LOCATION_ID) throw new Error('Payment form not configured (missing location ID)')
      const payments = await window.Square.payments(SQUARE_APP_ID, SQUARE_LOCATION_ID)
      const c = await payments.card({ style: SQUARE_CARD_STYLE })
      await c.attach(`#${containerId}`)
      return c
    }

    async function init() {
      // Square's "unable to be initialized in time" is often a transient backend
      // timeout — retry with backoff before surfacing an error.
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
      mountedRef.current = false
      cardRef.current?.destroy().catch(() => undefined)
      cardRef.current = null
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
