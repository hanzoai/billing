'use client'

import * as React from 'react'
import type { Balance } from '@/lib/commerce-client'
import type { CreditGrant } from '@/lib/billing/types'

export interface BalancePanelProps {
  balance: Balance | null
  currency?: string
  isAdmin?: boolean
  userEmail?: string
  starterCredit?: CreditGrant | null
  onAddFunds?: (amount: number) => Promise<void>
  onGrantCredit?: (email: string, amount: number) => Promise<void>
  presetAmounts?: number[]
}

const DEFAULT_PRESETS = [10, 25, 50, 100, 250, 500]

function formatCurrency(value: number, currency: string = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value)
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

export function BalancePanel({
  balance,
  currency = 'USD',
  isAdmin = false,
  userEmail,
  starterCredit,
  onAddFunds,
  onGrantCredit,
  presetAmounts = DEFAULT_PRESETS,
}: BalancePanelProps) {
  const [showAddFunds, setShowAddFunds] = React.useState(false)
  const [customAmount, setCustomAmount] = React.useState('')
  const [selectedPreset, setSelectedPreset] = React.useState<number | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  // Admin credit grant state
  const [showAdminPanel, setShowAdminPanel] = React.useState(false)
  const [creditEmail, setCreditEmail] = React.useState(userEmail ?? '')
  const [creditAmount, setCreditAmount] = React.useState('5')
  const [granting, setGranting] = React.useState(false)

  const effectiveAmount = selectedPreset ?? (parseFloat(customAmount) || 0)

  const handleAdd = React.useCallback(async () => {
    if (!onAddFunds || effectiveAmount <= 0) return
    setAdding(true)
    setError(null)
    setSuccess(null)
    try {
      await onAddFunds(effectiveAmount)
      setCustomAmount('')
      setSelectedPreset(null)
      setShowAddFunds(false)
      setSuccess(`Added ${formatCurrency(effectiveAmount, currency)}`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add funds')
    } finally {
      setAdding(false)
    }
  }, [effectiveAmount, onAddFunds, currency])

  const handleGrantCredit = React.useCallback(async () => {
    if (!onGrantCredit || !creditEmail || !creditAmount) return
    const amount = parseFloat(creditAmount)
    if (amount <= 0) return
    setGranting(true)
    setError(null)
    setSuccess(null)
    try {
      await onGrantCredit(creditEmail, amount)
      setSuccess(`Granted ${formatCurrency(amount, currency)} credit to ${creditEmail}`)
      setTimeout(() => setSuccess(null), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to grant credit')
    } finally {
      setGranting(false)
    }
  }, [creditEmail, creditAmount, onGrantCredit, currency])

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-bg-card">
      {/* Balance display */}
      <div className="border-b border-border p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Account Balance
            </p>
            <p className="mt-2 text-4xl font-bold text-text">
              {balance ? formatCurrency(balance.available / 100, currency) : '—'}
            </p>
            {balance && balance.holds > 0 && (
              <p className="mt-1 text-sm text-text-muted">
                {formatCurrency(balance.holds / 100, currency)} on hold
              </p>
            )}
            {starterCredit && starterCredit.active && starterCredit.expiresAt && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-brand-muted px-3 py-1">
                <span className="text-xs font-semibold text-brand">
                  ${((starterCredit.remainingCents ?? 0) / 100).toFixed(2)} starter credit
                </span>
                <span className="text-xs text-text-muted">
                  {formatCountdown(starterCredit.expiresAt)}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {balance && (
              <div className="text-right text-sm text-text-muted">
                <p>Total: {formatCurrency(balance.balance / 100, currency)}</p>
                <p>Available: {formatCurrency(balance.available / 100, currency)}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowAddFunds(!showAddFunds)}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition hover:bg-brand-hover active:scale-[0.97]"
            >
              {showAddFunds ? 'Cancel' : 'Add Funds'}
            </button>
          </div>
        </div>
      </div>

      {/* Add funds dialog */}
      {showAddFunds && (
        <div className="border-b border-border p-6">
          <p className="text-sm font-medium text-text-secondary">Select amount</p>

          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {presetAmounts.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => {
                  setSelectedPreset(amount)
                  setCustomAmount('')
                  setError(null)
                }}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-[0.96] ${
                  selectedPreset === amount
                    ? 'bg-brand text-brand-foreground shadow-lg shadow-brand/20'
                    : 'border border-border bg-bg-elevated text-text hover:border-brand/40 hover:bg-bg-elevated'
                }`}
              >
                {formatCurrency(amount, currency)}
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              type="number"
              min="1"
              step="0.01"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value)
                setSelectedPreset(null)
                setError(null)
              }}
              placeholder="Custom amount"
              className="flex-1 rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text outline-none transition placeholder:text-text-dim focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <button
              type="button"
              disabled={effectiveAmount <= 0 || adding || !onAddFunds}
              onClick={handleAdd}
              className="rounded-lg bg-brand px-6 py-2 text-sm font-semibold text-brand-foreground transition hover:bg-brand-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {adding
                ? 'Adding...'
                : effectiveAmount > 0
                  ? `Add ${formatCurrency(effectiveAmount, currency)}`
                  : 'Add funds'}
            </button>
          </div>

          {success && (
            <p className="mt-2 text-sm text-success">{success}</p>
          )}
          {error && (
            <p className="mt-2 text-sm text-danger">{error}</p>
          )}
        </div>
      )}

      {/* Admin: Grant credit to any user */}
      {isAdmin && (
        <div className="border-t border-border p-6">
          <button
            type="button"
            onClick={() => setShowAdminPanel(!showAdminPanel)}
            className="flex items-center gap-2 text-sm font-medium text-text-secondary"
          >
            <span className="rounded bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
              Admin
            </span>
            Grant credit to user
            <span className="text-text-dim">{showAdminPanel ? '▲' : '▼'}</span>
          </button>

          {showAdminPanel && (
            <div className="mt-4 space-y-3 rounded-lg border border-warning/30 bg-warning/5 p-4">
              <div>
                <label htmlFor="credit-email" className="text-xs font-medium text-text-secondary">
                  User email
                </label>
                <input
                  id="credit-email"
                  type="email"
                  value={creditEmail}
                  onChange={(e) => setCreditEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="mt-1 w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text outline-none transition placeholder:text-text-dim focus:border-warning focus:ring-1 focus:ring-warning"
                />
              </div>
              <div>
                <label htmlFor="credit-amount" className="text-xs font-medium text-text-secondary">
                  Amount ($)
                </label>
                <input
                  id="credit-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text outline-none transition placeholder:text-text-dim focus:border-warning focus:ring-1 focus:ring-warning"
                />
              </div>
              <button
                type="button"
                disabled={!creditEmail || !creditAmount || parseFloat(creditAmount) <= 0 || granting}
                onClick={handleGrantCredit}
                className="w-full rounded-lg bg-warning px-4 py-2 text-sm font-medium text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {granting
                  ? 'Granting...'
                  : `Grant ${formatCurrency(parseFloat(creditAmount) || 0, currency)} credit`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
