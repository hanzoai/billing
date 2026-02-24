'use client'

import * as React from 'react'

import type { UsageSummary, UsageRecord } from './types'

export interface UsagePanelProps {
  usage: UsageSummary | null
  loading?: boolean
}

function formatCurrency(value: number, currency: string = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return value.toLocaleString()
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateStr))
}

const METER_ICONS: Record<string, string> = {
  ai: '🤖',
  storage: '💾',
  network: '🌐',
  network_egress: '📤',
  gpu: '⚡',
  api_calls: '📡',
}

const METER_COLORS: Record<string, string> = {
  ai: 'bg-violet-600',
  storage: 'bg-blue-600',
  network: 'bg-emerald-600',
  network_egress: 'bg-teal-600',
  gpu: 'bg-amber-600',
  api_calls: 'bg-indigo-600',
}

function UsageMeter({ record }: { record: UsageRecord }) {
  const utilization = record.limit && record.limit > 0
    ? Math.min((record.current / record.limit) * 100, 100)
    : null

  const icon = METER_ICONS[record.meterId] ?? '📊'
  const barColor = METER_COLORS[record.meterId] ?? 'bg-zinc-600'

  const isOverage = utilization !== null && utilization >= 100
  const isWarning = utilization !== null && utilization >= 80 && utilization < 100

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <p className="text-sm font-medium text-zinc-900">{record.label}</p>
        </div>
        {record.cost > 0 && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
            {formatCurrency(record.cost)}
          </span>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-end justify-between">
          <p className="text-2xl font-semibold text-zinc-900">
            {formatNumber(record.current)}
            <span className="ml-1 text-sm font-normal text-zinc-500">{record.unit}</span>
          </p>
          {record.limit && record.limit > 0 && (
            <p className="text-xs text-zinc-500">
              of {formatNumber(record.limit)} {record.unit}
            </p>
          )}
        </div>

        {utilization !== null && (
          <div className="mt-2">
            <div className="h-2 rounded-full bg-zinc-100">
              <div
                className={`h-2 rounded-full transition-all ${
                  isOverage ? 'bg-red-500' : isWarning ? 'bg-amber-500' : barColor
                }`}
                style={{ width: `${Math.min(utilization, 100)}%` }}
              />
            </div>
            <p className={`mt-1 text-xs ${
              isOverage ? 'text-red-600 font-medium' : isWarning ? 'text-amber-600' : 'text-zinc-500'
            }`}>
              {isOverage
                ? `${(utilization - 100).toFixed(0)}% over limit`
                : `${utilization.toFixed(0)}% used`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export function UsagePanel(props: UsagePanelProps) {
  const { usage, loading = false } = props

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-8 text-center">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
        <p className="mt-3 text-sm text-zinc-500">Loading usage data...</p>
      </div>
    )
  }

  if (!usage || usage.records.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 p-4">
          <h3 className="text-lg font-semibold text-zinc-900">Usage</h3>
          <p className="text-sm text-zinc-500">Current billing period resource consumption</p>
        </div>
        <div className="p-6 text-sm text-zinc-500">No usage data available for this period.</div>
      </div>
    )
  }

  const periodLabel = usage.period.start && usage.period.end
    ? `${formatDate(usage.period.start)} – ${formatDate(usage.period.end)}`
    : 'Current period'

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 p-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">Usage</h3>
            <p className="text-sm text-zinc-500">{periodLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Total cost</p>
            <p className="mt-1 text-xl font-semibold text-zinc-900">
              {formatCurrency(usage.totalCost, usage.currency)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {usage.records.map((record) => (
            <UsageMeter key={record.meterId} record={record} />
          ))}
        </div>
      </div>
    </div>
  )
}
