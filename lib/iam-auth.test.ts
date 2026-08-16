/**
 * Sign-in resumes where it started, and nowhere else.
 *
 * The plan a buyer picked is in the URL when they sign in, so the round trip
 * has to hand it back or they choose again — and the observed second choice is
 * the cheapest tier. What is handed back is only ever a query and a hash: the
 * app is one page, so a suffix is the whole destination, and anything naming a
 * path or a host is refused rather than followed.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { resumed } from './iam-auth'

/** A localStorage the test controls. */
function stored(at: string | null) {
  const store = new Map(at === null ? [] : [['hanzo_billing_resume', at]])
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
  return store
}

afterEach(() => vi.unstubAllGlobals())

describe('resumed', () => {
  it('hands back the plan the buyer signed in with', () => {
    stored('?plan=pro#pricing')
    expect(resumed()).toBe('?plan=pro#pricing')
  })

  it('is consumed by reading, so a later sign-in starts clean', () => {
    const store = stored('?plan=pro#pricing')
    expect(resumed()).toBe('?plan=pro#pricing')
    expect(store.has('hanzo_billing_resume')).toBe(false)
    expect(resumed()).toBe('')
  })

  it('has nothing to say when sign-in started from the plain page', () => {
    stored(null)
    expect(resumed()).toBe('')
  })

  // A suffix cannot name a host, so these are the shapes that would have to be
  // refused if one ever reached the key.
  it.each([
    '//evil.example',
    '/\\evil.example',
    'https://evil.example',
    '/overview',
    'plan=pro',
  ])('refuses %s, which is not a query or a hash', (at) => {
    stored(at)
    expect(resumed()).toBe('')
  })
})
