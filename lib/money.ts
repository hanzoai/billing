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

/** Commerce ledger amounts (balances, transactions, top-ups) are CENTS. */
export function moneyFromCents(cents: number, currency = 'USD', digits: 0 | 2 = 2): string {
  return money(cents / 100, currency, digits)
}
