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
