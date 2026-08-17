'use client'

import type { CreditGrant } from './types'
import { cents, moneyFromCents } from '@/lib/money'
import { TOPUP_AMOUNTS, topupHref } from '@/lib/topup'

export interface CreditsPanelProps {
  /** Why the grants could not be read. Distinct from holding none. */
  error?: string | null
  /** Why the credit balance could not be read. Distinct from a zero balance. */
  balanceError?: string | null
  onRetry?: () => void
  creditGrants: CreditGrant[]
  creditBalance?: number
}

function formatCountdown(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  if (days > 0) return `${days}d ${hours}h remaining`
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return `${hours}h ${mins}m remaining`
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateStr))
}

export function CreditsPanel({ creditGrants, creditBalance = 0, error = null, balanceError = null, onRetry }: CreditsPanelProps) {
  const activeGrants = creditGrants.filter((g) => g.active && !g.voided)
  const expiredGrants = creditGrants.filter((g) => !g.active || g.voided)

  return (
    <div className="space-y-4">
      {/* Credit balance summary */}
      <div className="overflow-hidden rounded-xl border border-border bg-bg-card">
        <div className="border-b border-border p-4">
          <h3 className="text-lg font-semibold text-text">Credits</h3>
          <p className="text-sm text-text-muted">View your credit grants and promotional balances</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Total credit balance
            </p>
            {/* A balance we could not read is our unknown, not the customer's
                zero — and a zero printed here is a figure they will act on. */}
            <p className="mono mt-1 text-3xl font-bold text-text">
              {balanceError ? '—' : moneyFromCents(creditBalance)}
            </p>
            {balanceError && <p className="mt-1 text-sm text-danger">{balanceError}</p>}
          </div>
          {/* The standing money-in. This section only DISPLAYS grants; without
              this door the whole product had no reachable way to add funds.

              The amount rides along: the link used to name none, so a customer
              who had already decided on $100 arrived at the page's default and
              decided again. The top-up page still takes a custom amount. */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Add credit
            </p>
            <div className="flex flex-wrap gap-2">
              {TOPUP_AMOUNTS.map((c) => (
                <a
                  key={c}
                  href={topupHref(c)}
                  className="mono rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-foreground transition hover:bg-brand-hover active:scale-[0.97]"
                >
                  {moneyFromCents(c, 'USD', cents(c / 100))}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Active grants */}
      {activeGrants.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-bg-card">
          <div className="border-b border-border px-4 py-3">
            <h4 className="text-sm font-semibold text-text">Active credits</h4>
          </div>
          <div className="divide-y divide-border">
            {activeGrants.map((grant) => {
              const pct = grant.amountCents > 0
                ? Math.round((grant.remainingCents / grant.amountCents) * 100)
                : 0

              return (
                <div key={grant.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-text">{grant.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                        <span>
                          {moneyFromCents(grant.remainingCents, grant.currency)} of {moneyFromCents(grant.amountCents, grant.currency)} remaining
                        </span>
                        {grant.createdAt && (
                          <span>Granted {formatDate(grant.createdAt)}</span>
                        )}
                      </div>
                    </div>
                    {grant.expiresAt && (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        new Date(grant.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
                          ? 'bg-warning/10 text-warning'
                          : 'bg-bg-elevated text-text-muted'
                      }`}>
                        {formatCountdown(grant.expiresAt)}
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="h-2 rounded-full bg-bg-elevated">
                      <div
                        className="h-2 rounded-full bg-brand transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-text-dim">{pct}% remaining</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Expired / used grants */}
      {expiredGrants.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-bg-card">
          <div className="border-b border-border px-4 py-3">
            <h4 className="text-sm font-semibold text-text-muted">Expired / used credits</h4>
          </div>
          <div className="divide-y divide-border">
            {expiredGrants.map((grant) => (
              <div key={grant.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 opacity-60">
                <div>
                  <p className="text-sm font-medium text-text-muted">{grant.name}</p>
                  <p className="text-xs text-text-dim">
                    {moneyFromCents(grant.amountCents, grant.currency)} · {grant.voided ? 'Voided' : 'Expired'}
                  </p>
                </div>
                {grant.expiresAt && (
                  <p className="text-xs text-text-dim">
                    Expired {formatDate(grant.expiresAt)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-danger">Couldn&apos;t load your credit grants.</p>
          <p className="mt-1 text-sm text-text-muted">{error}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="mt-3 rounded-full border border-ink/[0.14] px-4 py-1.5 text-sm text-text hover:bg-bg-elevated">
              Try again
            </button>
          )}
        </div>
      ) : creditGrants.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-text-muted">No credit grants yet.</p>
        </div>
      )}
    </div>
  )
}
