'use client'

import * as React from 'react'
import type { Balance } from '@/lib/commerce-client'

export interface BalancePanelProps {
  balance: Balance | null
  currency?: string
  isAdmin?: boolean
  userEmail?: string
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

export function BalancePanel({
  balance,
  currency = 'USD',
  isAdmin = false,
  userEmail,
  onAddFunds,
  onGrantCredit,
  presetAmounts = DEFAULT_PRESETS,
}: BalancePanelProps) {
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
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white">
      {/* Balance display */}
      <div className="border-b border-zinc-200 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Account Balance
            </p>
            <p className="mt-2 text-4xl font-bold text-zinc-900">
              {balance ? formatCurrency(balance.available / 100, currency) : '—'}
            </p>
            {balance && balance.holds > 0 && (
              <p className="mt-1 text-sm text-zinc-500">
                {formatCurrency(balance.holds / 100, currency)} on hold
              </p>
            )}
          </div>
          {balance && (
            <div className="text-right text-sm text-zinc-500">
              <p>Total: {formatCurrency(balance.balance / 100, currency)}</p>
              <p>Available: {formatCurrency(balance.available / 100, currency)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Add funds */}
      <div className="p-6">
        <p className="text-sm font-medium text-zinc-700">Add funds</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {presetAmounts.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => {
                setSelectedPreset(amount)
                setCustomAmount('')
                setError(null)
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                selectedPreset === amount
                  ? 'bg-zinc-900 text-white'
                  : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-100'
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
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
          <button
            type="button"
            disabled={effectiveAmount <= 0 || adding || !onAddFunds}
            onClick={handleAdd}
            className="rounded-lg bg-zinc-900 px-6 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {adding
              ? 'Adding...'
              : effectiveAmount > 0
                ? `Add ${formatCurrency(effectiveAmount, currency)}`
                : 'Add funds'}
          </button>
        </div>

        {success && (
          <p className="mt-2 text-sm text-green-600">{success}</p>
        )}
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* Admin: Grant credit to any user */}
      {isAdmin && (
        <div className="border-t border-zinc-200 p-6">
          <button
            type="button"
            onClick={() => setShowAdminPanel(!showAdminPanel)}
            className="flex items-center gap-2 text-sm font-medium text-zinc-700"
          >
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              Admin
            </span>
            Grant credit to user
            <span className="text-zinc-400">{showAdminPanel ? '▲' : '▼'}</span>
          </button>

          {showAdminPanel && (
            <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <div>
                <label htmlFor="credit-email" className="text-xs font-medium text-zinc-600">
                  User email
                </label>
                <input
                  id="credit-email"
                  type="email"
                  value={creditEmail}
                  onChange={(e) => setCreditEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label htmlFor="credit-amount" className="text-xs font-medium text-zinc-600">
                  Amount ($)
                </label>
                <input
                  id="credit-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <button
                type="button"
                disabled={!creditEmail || !creditAmount || parseFloat(creditAmount) <= 0 || granting}
                onClick={handleGrantCredit}
                className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
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
