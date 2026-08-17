/**
 * A discount is computed by the server, and there is nothing to type.
 *
 * Hanzo's one discount mechanism is the platform promo: a SuperAdmin sets
 * `{percentOff, start, end, plans, active}` at PUT /v1/admin/promos, commerce
 * annotates each covered plan with `promoPercent`, and `subscribe_card.go`
 * subtracts it from the charge. It carries no code, nobody redeems it, and
 * `chargeTotal` mirrors its arithmetic so the button quotes what the card is
 * charged. That is the whole surface.
 *
 * Three code-entry paths shipped beside it and none could work, because the
 * fleet routes none of the addresses they call — `/v1/coupon/validate`,
 * `/v1/billing/discount/validate` and `/v1/billing/subscriptions/{id}/promotion`
 * are absent from `GET /v1/openapi.json`, whose `/v1/billing` product publishes
 * 38 concrete paths and no catch-all to hide behind. A visitor typing a code got
 * a red "Unable to validate coupon right now", which reads as a passing outage
 * and was permanent; the marketing-hero field could not have applied a discount
 * even had it validated, since it held the code in local state and handed it to
 * nothing.
 *
 * So the rule is not "no coupons yet", it is that a price the customer can name
 * is a price the customer sets. A code field is honest here only once a server
 * evaluates the code, and on that day this test changes with the route.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { chargeTotal } from '@/lib/money'

const ROOT = join(import.meta.dirname, '..', '..')

/** Every shipped source file. Tests are excluded — this one names the strings. */
function sources(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next' || entry === 'out') continue
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) { walk(path); continue }
      if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue
      out.push(path)
    }
  }
  for (const top of ['app', 'lib']) walk(join(ROOT, top))
  return out
}

describe('the discount surface', () => {
  it('ships no field a customer can type a code into', () => {
    // The two that shipped read `placeholder="Coupon or promo code"` and
    // `placeholder="Enter promo code"`, so the placeholder is what to look for:
    // an input a customer is invited to fill names what it wants in one.
    const offenders: string[] = []
    for (const path of sources()) {
      const src = readFileSync(path, 'utf8')
      for (const [, value] of src.matchAll(/placeholder=["']([^"']+)["']/g)) {
        if (/coupon|promo|discount|voucher/i.test(value)) {
          offenders.push(`${path.slice(ROOT.length + 1)}: ${value}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('addresses no route the fleet does not serve', () => {
    const client = readFileSync(join(ROOT, 'lib', 'commerce-client.ts'), 'utf8')
    for (const route of ['/v1/coupon/', '/v1/billing/discount/', '/promotion']) {
      expect(client).not.toContain(route)
    }
  })

  it('still subtracts the promo the server applies', () => {
    // The surviving path, and the reason the two above are a deletion rather
    // than a regression: a covered plan is discounted with nothing typed.
    expect(chargeTotal({ price: 49, promoPercent: 50 })).toBe(24.5)
    expect(chargeTotal({ price: 49 })).toBe(49)
  })
})
