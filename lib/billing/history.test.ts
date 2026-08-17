/**
 * The back button on the path that takes money.
 *
 * This page is a JUNCTION: a reader either presses a plan on its own grid, or
 * arrives at `?plan=pro` from the marketing ladder and is forwarded to the
 * checkout before reading a word. Both leave through the same door, and only
 * one of them is a place the reader went.
 *
 * Pushing both made Back a trap, measured on the live chain: Back returned
 * here, the carry fired again, and the reader was thrown forward to the page
 * they were trying to leave — three presses, no escape. A checkout you cannot
 * back out of is a checkout you cannot compare, which is the whole reason a
 * reader reaches for Back on a pricing ladder.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { go } from './subscription-portal'

const HREF = 'https://pay.hanzo.ai/confirm/card?plan=pro'

/** A stand-in for the browser's one navigation surface, watching both verbs. */
function browser() {
  const replace = vi.fn()
  let assigned: string | null = null
  const location = {
    replace,
    get href() {
      return 'https://billing.hanzo.ai/'
    },
    set href(to: string) {
      assigned = to
    },
  }
  ;(globalThis as { window?: unknown }).window = { location }
  return { replace, assigned: () => assigned }
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window
})

describe('leaving for the checkout', () => {
  it('replaces this page when the plan was carried in', () => {
    const b = browser()
    go(HREF, false)
    expect(b.replace).toHaveBeenCalledWith(HREF)
    // Nothing pushed: a page that forwards on arrival must not cost a Back.
    expect(b.assigned()).toBeNull()
  })

  it('pushes when the reader pressed a plan on this page', () => {
    const b = browser()
    go(HREF, true)
    expect(b.assigned()).toBe(HREF)
    expect(b.replace).not.toHaveBeenCalled()
  })

  it('sends the same address either way — only the history differs', () => {
    const carried = browser()
    go(HREF, false)
    const pressed = browser()
    go(HREF, true)
    expect(carried.replace.mock.calls[0][0]).toBe(pressed.assigned())
  })
})
