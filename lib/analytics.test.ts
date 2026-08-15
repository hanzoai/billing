/**
 * A funnel event must arrive attributable.
 *
 * The door refuses a write it cannot file under a project — 401
 * `ingest_key_required` — so an event sent with no credential is not a weak
 * event, it is no event at all. This pins the two properties that decide
 * whether the money funnel exists: every write carries a credential, and a
 * signed-in buyer's own token is preferred to the anonymous key, so their
 * checkout lands in their org rather than in the anonymous one.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { analytics } from './analytics'

/** A localStorage the test controls. `window` is what tells the client and the
 *  token reader that they are in a browser. */
function browser(stored: Record<string, string>) {
  const store = new Map(Object.entries(stored))
  const local = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  }
  vi.stubGlobal('localStorage', local)
  vi.stubGlobal('window', { localStorage: local, location: { href: 'https://billing.hanzo.ai/' } })
}

/** The Authorization header of the batch the client sent, and the names in it. */
function sent() {
  const [, init] = vi.mocked(globalThis.fetch).mock.calls[0] ?? []
  const auth = new Headers(init?.headers as HeadersInit).get('authorization')
  const body = JSON.parse(String(init?.body ?? '{"batch":[]}'))
  return { auth, names: (body.batch as { event?: string }[]).map((e) => e.event) }
}

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the billing client is attributable at the door', () => {
  it('carries the publishable key when nobody is signed in', () => {
    browser({})

    analytics.capture('plan_clicked', { plan: 'pro' })
    analytics.flush()

    const { auth, names } = sent()
    expect(auth).toMatch(/^Bearer pk-/)
    expect(names).toContain('plan_clicked')
  })

  it('carries the signed-in token instead, so the org is the buyer’s', () => {
    browser({
      hanzo_billing_access_token: 'a-real-iam-token',
      hanzo_billing_expires_at: String(Date.now() + 60_000),
    })

    analytics.capture('checkout_started', { plan: 'pro' })
    analytics.flush()

    expect(sent().auth).toBe('Bearer a-real-iam-token')
  })
})
