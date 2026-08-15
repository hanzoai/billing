/**
 * The top-up page: what it offers, and the one way to link to it.
 *
 * The amounts live here rather than inside the page because the surfaces that
 * send a customer there offer the same choice — the Credit Balance tile and the
 * Credits panel are where "add credit" is actually clicked. Each of those used
 * to link to a bare `/topup/`, so a customer who had already picked $100 landed
 * on the page's own $25 and picked again. The amount the click knew travels
 * with it.
 */

import { BASE_PATH } from './config'

/** Standing top-up amounts, in USD cents. The page also takes a custom amount. */
export const TOPUP_AMOUNTS = [1000, 2500, 5000, 10000]

/** What the page charges when the link named no amount. */
export const TOPUP_DEFAULT = 2500

/**
 * Link to the top-up page, carrying the amount when the click knew one.
 *
 * BASE_PATH is applied here so no caller has to remember that a raw `<a href>`
 * carries it — that is exactly the kind of detail that gets dropped in one
 * surface out of three.
 */
export function topupHref(amountCents?: number): string {
  const path = `${BASE_PATH}/topup/`
  return amountCents && amountCents > 0 ? `${path}?amount=${Math.round(amountCents)}` : path
}
