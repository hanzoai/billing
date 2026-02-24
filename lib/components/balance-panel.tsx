'use client'

import * as React from 'react'
import type { Balance } from '@hanzo/commerce'

export interface BalancePanelProps {
  balance: Balance | null
  currency?: string
  onAddFunds?: (amount: number) => Promise<void>
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
  onAddFunds,
  presetAmounts = DEFAULT_PRESETS,
}: BalancePanelProps) {
  const [customAmount, setCustomAmount] = React.useState('')
  const [selectedPreset, setSelectedPreset] = React.useState<number | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const effectiveAmount = selectedPreset ?? (parseFloat(customAmount) || 0)

  const handleAdd = React.useCallback(async () => {
    if (!onAddFunds || effectiveAmount <= 0) return
    setAdding(true)
    setError(null)
    try {
      await onAddFunds(effectiveAmount)
      setCustomAmount('')
      setSelectedPreset(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add funds')
    } finally {
      setAdding(false)
    }
  }, [effectiveAmount, onAddFunds])

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
              {balance ? formatCurrency(balance.available, currency) : '—'}
            </p>
            {balance && balance.holds > 0 && (
              <p className="mt-1 text-sm text-zinc-500">
                {formatCurrency(balance.holds, currency)} on hold
              </p>
            )}
          </div>
          {balance && (
            <div className="text-right text-sm text-zinc-500">
              <p>Total: {formatCurrency(balance.balance, currency)}</p>
              <p>Available: {formatCurrency(balance.available, currency)}</p>
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

        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>
    </div>
  )
}
