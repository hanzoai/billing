/**
 * The quote must equal the charge.
 *
 * This is the money surface's first test, and it exists because the two defects it
 * pins both shipped to production. A charge is the one thing here that cannot be
 * corrected by reloading the page, so the arithmetic that quotes it is worth
 * pinning even though the rule is three lines long.
 *
 * The catalog rows below are the LIVE ones (GET /v1/billing/plans, prices in cents
 * → dollars here), so a change to the real catalog that breaks the quote breaks
 * this too.
 */

import { describe, expect, it } from 'vitest'

import { annualSaving, billableSeats, chargeTotal, cents, money, subtotal } from './money'

// The live catalog, as the portal projects it (mapCommercePlan: cents / 100).
const GO = { price: 8, annualPrice: 7 }
const PRO = { price: 19, annualPrice: 16.5 }
const TEAM = { price: 25, annualPrice: 20, perSeat: true, minSeats: 2 }

describe('chargeTotal mirrors what commerce charges', () => {
  it('quotes the MONTHLY price, never the annual rate', () => {
    // The Annual tab shows a monthly-equivalent rate; the card is charged the
    // MONTHLY price, so the quote must be the monthly one.
    // There is no interval on the wire (subscribeCardRequest carries none) and
    // subscribe_card.go reads the monthly column, so the annual rate is never a
    // total. Passing the whole plan means a future edit cannot reach for it.
    expect(chargeTotal(PRO)).toBe(19)
    expect(chargeTotal(GO)).toBe(8)
    expect(chargeTotal(PRO)).not.toBe(PRO.annualPrice)
  })

  it('multiplies seats only on a per-seat tier', () => {
    expect(chargeTotal(TEAM, 5)).toBe(125)
    // A flat plan is ×1 however many seats are asked for — commerce sets
    // seatMult = quantity only when perSeat(planId).
    expect(chargeTotal(PRO, 5)).toBe(19)
  })

  it('clamps to the catalog floor commerce would reject below', () => {
    expect(billableSeats(TEAM, 1)).toBe(2)
    expect(billableSeats(TEAM, undefined)).toBe(2)
    expect(chargeTotal(TEAM, 1)).toBe(50)
    // A flat plan has no seat axis at all.
    expect(billableSeats(PRO, 9)).toBe(1)
  })

  it('is 0 for a tier with no price, not NaN', () => {
    expect(chargeTotal({})).toBe(0)
    expect(chargeTotal({ contactSales: true } as never)).toBe(0)
  })
})

describe('a live promo is subtracted, exactly as commerce subtracts it', () => {
  // commerce annotates a plan with promoPercent only when a live promo covers it,
  // then subtracts engine.DiscountCents(cents, percent) = (cents*pct + 50)/100 in
  // integer cents. A quote that ignored it over-stated the charge; a quote that
  // rounds in dollars disagrees by a cent on plenty of prices.
  it('mirrors the server rounding on cents, not dollars', () => {
    expect(chargeTotal({ ...PRO, promoPercent: 50 })).toBe(9.5) // 1900 -> 950
    expect(chargeTotal({ ...GO, promoPercent: 10 })).toBe(7.2) //  800 ->  720
    // 1900 * 33% = 627 exactly; the +50 half-up rounding lands on 627, not 626.
    expect(chargeTotal({ price: 19, promoPercent: 33 })).toBe(19 - 6.27)
  })

  it('never discounts below zero or above the subtotal', () => {
    expect(chargeTotal({ ...PRO, promoPercent: 100 })).toBe(0)
    expect(chargeTotal({ ...PRO, promoPercent: 250 })).toBe(0)
    expect(chargeTotal({ ...PRO, promoPercent: 0 })).toBe(19)
    expect(chargeTotal({ ...PRO, promoPercent: -5 })).toBe(19)
  })

  it('discounts the seat-multiplied subtotal, not the unit price', () => {
    // 2500 * 4 seats = 10000, less 25% = 7500.
    expect(chargeTotal({ ...TEAM, promoPercent: 25 }, 4)).toBe(75)
  })

  it('leaves the seat line arithmetic alone — that is a subtotal', () => {
    // The seat line prints `seats × unit = subtotal`, so it must NOT carry the
    // discount or the multiplication on screen stops being true.
    expect(subtotal(TEAM, 4)).toBe(100)
    expect(subtotal({ ...TEAM, promoPercent: 25 }, 4)).toBe(100)
  })
})

describe('every quoted figure is formatted the one way', () => {
  it('never prints a bare truncated float', () => {
    // `$${16.5}` printed "$16.5". Money on a checkout button reads as money — and
    // a whole-dollar price stays whole, which is what `cents` decides.
    expect(money(16.5, 'USD', cents(16.5))).toBe('$16.50')
    expect(money(19, 'USD', cents(19))).toBe('$19')
    expect(money(125, 'usd', cents(125))).toBe('$125')
  })

  it('the seat line adds up: unit × seats equals the total it prints', () => {
    const seats = billableSeats(TEAM, 3)
    const total = chargeTotal(TEAM, seats)
    expect(TEAM.price * seats).toBe(total)
    expect(money(total, 'USD', cents(total))).toBe('$75')
  })
})

describe('annualSaving reports the catalog, it does not invent a discount', () => {
  it('is a year of the difference between the two monthly rates', () => {
    expect(annualSaving(PRO)).toBe((19 - 16.5) * 12)
    expect(annualSaving({ price: 19 })).toBeNull()
    expect(annualSaving({ price: 0, annualPrice: 0 })).toBeNull()
  })
})
