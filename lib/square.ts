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
 *
 * WHICH Square is the org's answer, not the build's: `squareConfig()` reads it
 * from commerce at mount, so one image serves a sandbox org and a live one.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { getCommerce } from '@/lib/commerce'
import { COMMERCE_URL } from '@/lib/config'
import { getAccessToken } from '@/lib/iam-auth'

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

// ── Which Square, for THIS org (client-side, safe to expose) ─────────────────

/**
 * The three facts the SDK needs, which are one answer: the environment picks the
 * CDN, and the application/location live in that environment's Square account.
 */
export interface SquareConfig {
  applicationId: string
  locationId: string
  environment: string // "sandbox" | "production"
}

/**
 * The build's own answer — `output: 'export'` bakes NEXT_PUBLIC_* into the
 * bundle, so this is a property of the IMAGE and one image serves every org.
 * It is the fallback, never the first answer: it forced billing.hanzo.ai onto
 * production Square, and a sandbox (Live=false) org tokenizing against the
 * production application had every nonce rejected as cross-environment by the
 * sandbox charge that followed. Testing sandbox meant a second build.
 */
const BAKED: SquareConfig = {
  applicationId: process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID ?? '',
  locationId: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ?? '',
  environment: process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT ?? 'sandbox',
}

/**
 * Ask commerce which Square THIS org tokenizes against.
 *
 * Commerce resolves it from the org record through the same single authority
 * that picks the access token it will charge with (`organization.TestMode()` →
 * `payment.SquarePublicConfig` → GET /v1/billing/settings), so browser and
 * charge always name the same account and one build serves sandbox and
 * production alike.
 *
 * Answered fresh per card mount rather than cached, so it follows the session:
 * a customer who switches org gets that org's Square, not the first one asked
 * about.
 *
 * A partial answer falls back WHOLE. Filling a missing field from the baked
 * build would pair one environment's application with another's CDN, which is
 * precisely the cross-environment mismatch this exists to end — the three
 * fields come from one source or none.
 */
export async function squareConfig(): Promise<SquareConfig> {
  try {
    const token = getAccessToken() ?? undefined
    const cfg = await getCommerce(COMMERCE_URL, token).getPaymentConfig(token)
    if (!cfg.applicationId || !cfg.locationId || !cfg.environment) return BAKED
    return {
      applicationId: cfg.applicationId,
      locationId: cfg.locationId,
      environment: cfg.environment,
    }
  } catch {
    return BAKED
  }
}

function scriptUrl(environment: string): string {
  return environment === 'production'
    ? 'https://web.squarecdn.com/v1/square.js'
    : 'https://sandbox.web.squarecdn.com/v1/square.js'
}

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

// Keyed by URL, because the sandbox and production SDKs are different scripts
// and the environment is now the org's rather than the build's.
const scriptLoads = new Map<string, Promise<void>>()

export function loadSquareScript(environment: string): Promise<void> {
  const src = scriptUrl(environment)
  const cached = scriptLoads.get(src)
  if (cached) return cached
  const load = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      if (window.Square) { resolve(); return }
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load Square Web Payments SDK')))
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Square Web Payments SDK'))
    document.head.appendChild(script)
  }).catch((e) => {
    // Never cache a rejected load — a transient network blip must not
    // permanently break the card form until a full page reload.
    scriptLoads.delete(src)
    throw e
  })
  scriptLoads.set(src, load)
  return load
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
      // The org's answer first: it names the environment, and the environment
      // names the script. Asked inside the attempt, so a settings request that
      // failed on the first try is re-asked on the retry rather than pinning the
      // whole mount to the baked fallback.
      const cfg = await squareConfig()
      await loadSquareScript(cfg.environment)
      if (!window.Square) throw new Error('Square SDK unavailable')
      if (!cfg.applicationId) throw new Error('Payment form not configured (missing app ID)')
      if (!cfg.locationId) throw new Error('Payment form not configured (missing location ID)')
      const payments = await window.Square.payments(cfg.applicationId, cfg.locationId)
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
        // The SAME Square the card fields tokenize against — the org's answer,
        // not the build's. A wallet nonce minted against the baked application
        // while the charge is sent to the org's is rejected as cross-environment,
        // so both surfaces must resolve the account through one authority.
        const cfg = await squareConfig()
        await loadSquareScript(cfg.environment)
        if (!alive || !window.Square || !cfg.applicationId || !cfg.locationId) return
        const payments = await window.Square.payments(cfg.applicationId, cfg.locationId)
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
