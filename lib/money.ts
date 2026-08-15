/**
 * Money, formatted ONE way.
 *
 * Fourteen files each carried their own `fmt` / `formatCurrency` / `fmtUSD` /
 * `formatBalance`, differing only in how many fraction digits they asked for —
 * which is not fourteen decisions, it is one parameter. Catalog prices read as
 * whole dollars (`digits: 0`), ledger amounts to the cent.
 *
 * Currency is upper-cased here because commerce returns `usd` while the rest of
 * the app passes `USD`; normalising at the single point of use means no caller
 * has to remember which side it is on.
 */
export function money(value: number, currency = 'USD', digits: 0 | 2 = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

/**
 * How many fraction digits a catalog price needs to stay true.
 *
 * `digits: 0` is right for a catalog of whole dollars and wrong the moment one
 * price carries cents. The annual rates do: Go is 8.25 against 9, Pro 41.5
 * against 49. Rounding those to the dollar put two different annual prices on
 * one card — a $8 headline above its own "$8.25/mo billed annually" — because
 * the headline was rounded and the sub-line was not. Same number, two
 * formatters, and the customer gets to decide which one the charge will be.
 *
 * So the price itself decides, and every catalog figure asks the same question.
 */
export function cents(value: number): 0 | 2 {
  return Number.isInteger(value) ? 0 : 2
}

/** Commerce ledger amounts (balances, transactions, top-ups) are CENTS. */
export function moneyFromCents(cents: number, currency = 'USD', digits: 0 | 2 = 2): string {
  return money(cents / 100, currency, digits)
}

/**
 * What a year on the annual rate saves, or null when there is nothing to save.
 *
 * THE ANNUAL PRICE IS A MONTHLY RATE. The catalog's `priceAnnual` is what a
 * month costs when you commit to a year (Pro: 41.5 against 49), not the yearly
 * total — and reading it as a total produced a sentence that could not be true:
 * "$41.5/yr — save $546.5" beside a $49/mo plan, where the advertised saving
 * was larger than the advertised year. The plan cards had the arithmetic right
 * and the overview banner had it wrong, which is what two copies of one
 * calculation always eventually means.
 */
export function annualSaving(plan: { price?: number; annualPrice?: number }): number | null {
  const monthly = plan.price ?? 0
  const annual = plan.annualPrice ?? 0
  if (monthly <= 0 || annual <= 0) return null
  const saved = (monthly - annual) * 12
  return saved > 0 ? saved : null
}

/** What a plan needs to price it: the catalog columns the charge reads. */
export type Priced = {
  price?: number
  perSeat?: boolean
  minSeats?: number
  promoPercent?: number
}

/**
 * How many seats the charge will actually multiply by.
 *
 * Only a per-seat tier multiplies; a flat plan is always ×1, exactly as commerce
 * does it (`seatMult = quantity` only when `perSeat(planId)`). A quote that
 * multiplied every plan by its seat count would ask a customer for five times the
 * real charge on a flat plan.
 *
 * The floor is the catalog's own `minSeats` — commerce rejects fewer with a 400,
 * so the quote clamps rather than showing a total the server will refuse.
 */
export function billableSeats(plan: Priced, requested?: number): number {
  if (!plan.perSeat) return 1
  const floor = Math.max(1, Math.floor(plan.minSeats ?? 1))
  const seats = Math.floor(requested ?? floor)
  return seats < floor ? floor : seats
}

/**
 * The subtotal before any promotion: the list price times the seats billed.
 *
 * This is the arithmetic a seat line shows — `3 × $25/mo = $75/mo` — and it has to
 * be exactly that, or the numbers on screen do not add up.
 */
export function subtotal(plan: Priced, requested?: number): number {
  return (plan.price ?? 0) * billableSeats(plan, requested)
}

/**
 * What the card will be charged for the first period.
 *
 * SERVER-AUTHORITATIVE PRICING. The customer never names a price: the checkout
 * POST carries `{sourceId, planId, quantity, currency}` and no amount at all, so
 * commerce recomputes the charge from its own catalog and ignores anything a
 * client might have sent (`api/billing/subscribe_card.go`):
 *
 *     charge = plan.price × (perSeat ? seats : 1), less the active promo
 *
 * This exists for ONE reason — to show the customer the number that is about to
 * leave their card — so it must mirror that rule and nothing else. Two ways it
 * used to be wrong, and both put a figure on the button that no card was charged:
 *
 *   - it reached for `annualPrice`. That is real catalog data and worth showing,
 *     but there is no interval on the wire and commerce charges the MONTHLY
 *     column, so the screen said "You are charged $41.50/mo" over a $49.00 charge.
 *   - it ignored `promoPercent`. commerce annotates a plan with it only when a live
 *     promo covers that plan, and then subtracts exactly that much, so a quote
 *     that skips it over-states the charge and the receipt disagrees with the cart.
 *
 * The discount is computed on CENTS with the server's own rounding, because doing
 * it in dollars and rounding afterwards disagrees by a cent on plenty of prices.
 *
 * If this ever disagrees with subscribe_card.go, the quote is a lie. That is the
 * whole class of defect this function exists to prevent.
 */
export function chargeTotal(plan: Priced, requested?: number): number {
  const cents = Math.round(subtotal(plan, requested) * 100)
  return (cents - discountCents(cents, plan.promoPercent ?? 0)) / 100
}

/**
 * The promo's cut of a subtotal, mirroring commerce's engine.DiscountCents:
 * `(subtotal × percent + 50) / 100` in integer cents — round half up, never more
 * than the subtotal.
 */
function discountCents(cents: number, percent: number): number {
  if (cents <= 0 || percent <= 0) return 0
  if (percent >= 100) return cents
  return Math.min(cents, Math.floor((cents * percent + 50) / 100))
}
