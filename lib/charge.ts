/**
 * One idempotency key per money-move ATTEMPT.
 *
 * Commerce guards every card charge on `X-Idempotency-Key`, and when no header
 * arrives it falls back to a 15-minute window over the request facts (the card,
 * the amount, the currency). That fallback is right for a lost-response retry
 * and wrong for a customer: a second deliberate $25 top-up inside the window has
 * the same facts, so it replays the FIRST receipt and never charges — the
 * balance moves once while the customer paid twice in their own head.
 *
 * A key that lives across a retry gives both halves. The same attempt reuses it,
 * so a dropped response charges once; a genuinely new attempt mints a fresh one,
 * so the second $25 is a second $25. sessionStorage, because the attempt ends
 * with the tab.
 *
 * `scope` names what is being paid for — the charge is keyed per (what, how
 * much), never per submit and never per session.
 */

const PREFIX = 'hanzo_charge:'

/** The key for this attempt at `scope`, minted on first ask and kept until cleared. */
export function chargeKey(scope: string): string {
  const held = sessionStorage.getItem(PREFIX + scope)
  if (held) return held
  const fresh = crypto.randomUUID()
  sessionStorage.setItem(PREFIX + scope, fresh)
  return fresh
}

/**
 * Retire the key: the attempt reached an answer. Called after a charge settles
 * AND after it is refused for a reason the customer can act on (a decline, a
 * card that is gone) — retrying either is a NEW charge and must not replay.
 * Never called on a lost response, which is the case the key exists for.
 */
export function clearChargeKey(scope: string): void {
  sessionStorage.removeItem(PREFIX + scope)
}
