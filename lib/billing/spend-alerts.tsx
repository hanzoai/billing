'use client'

import * as React from 'react'

import type { SpendAlert } from './types'
import { money } from '@/lib/money'

export interface SpendAlertsPanelProps {
  alerts: SpendAlert[]
  /** Why the alerts could not be read. Distinct from having none configured. */
  error?: string | null
  onRetry?: () => void
  onCreateAlert?: (title: string, threshold: number) => Promise<void>
  onUpdateAlert?: (id: string, title: string, threshold: number) => Promise<void>
  onDeleteAlert?: (id: string) => Promise<void>
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

export function SpendAlertsPanel(props: SpendAlertsPanelProps) {
  const { alerts, error = null, onRetry, onCreateAlert, onUpdateAlert, onDeleteAlert } = props

  const [showForm, setShowForm] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [title, setTitle] = React.useState('')
  const [threshold, setThreshold] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [busyDeleteId, setBusyDeleteId] = React.useState<string | null>(null)
  // Why a SAVE failed. The `error` prop is why the READ failed.
  const [saveError, setSaveError] = React.useState<string | null>(null)

  const canSubmit = title.trim().length > 0 && parseFloat(threshold) > 0

  const resetForm = React.useCallback(() => {
    setTitle('')
    setThreshold('')
    setEditingId(null)
    setShowForm(false)
    setSaveError(null)
  }, [])

  const handleCreate = React.useCallback(async () => {
    if (!canSubmit || !onCreateAlert) return
    setBusy(true)
    setSaveError(null)
    try {
      await onCreateAlert(title.trim(), parseFloat(threshold))
      resetForm()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to create alert')
    } finally {
      setBusy(false)
    }
  }, [canSubmit, onCreateAlert, title, threshold, resetForm])

  const handleUpdate = React.useCallback(async () => {
    if (!canSubmit || !editingId || !onUpdateAlert) return
    setBusy(true)
    setSaveError(null)
    try {
      await onUpdateAlert(editingId, title.trim(), parseFloat(threshold))
      resetForm()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update alert')
    } finally {
      setBusy(false)
    }
  }, [canSubmit, editingId, onUpdateAlert, title, threshold, resetForm])

  const handleDelete = React.useCallback(async (id: string) => {
    if (!onDeleteAlert) return
    setBusyDeleteId(id)
    try {
      await onDeleteAlert(id)
    } finally {
      setBusyDeleteId(null)
    }
  }, [onDeleteAlert])

  const startEdit = React.useCallback((alert: SpendAlert) => {
    setEditingId(alert.id)
    setTitle(alert.title)
    setThreshold(String(alert.threshold))
    setShowForm(true)
    setSaveError(null)
  }, [])

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border bg-bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h3 className="text-lg font-semibold text-text">Spend alerts</h3>
            <p className="text-sm text-text-muted">
              Get notified when your spending crosses a threshold. Alerts check every 90 minutes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (showForm) {
                resetForm()
              } else {
                setShowForm(true)
              }
            }}
            className="rounded-lg bg-text px-3 py-2 text-sm font-medium text-bg transition hover:opacity-80"
          >
            {showForm ? 'Cancel' : 'New alert'}
          </button>
        </div>

        {showForm && (
          <div className="border-b border-border p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Alert name (e.g. Monthly budget)"
                className="rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text transition md:col-span-2"
              />
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-dim">$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    placeholder="Threshold"
                    className="w-full rounded-lg border border-border bg-bg-input py-2 pl-7 pr-3 text-sm text-text transition"
                  />
                </div>
                <button
                  type="button"
                  disabled={!canSubmit || busy}
                  onClick={editingId ? handleUpdate : handleCreate}
                  className="rounded-lg bg-text px-4 py-2 text-sm font-medium text-bg transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? 'Saving…' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
            {saveError && <p className="mt-2 text-sm text-danger">{saveError}</p>}
          </div>
        )}

        <div className="divide-y divide-border">
          {error ? (
            /* An unread list is not an empty one. "No spend alerts configured"
               reads as an all-clear — the customer believes nothing is watching
               their spend, when in fact we could not look. */
            <div className="p-6 text-sm">
              <p className="text-danger">Couldn&apos;t load your spend alerts.</p>
              <p className="mt-1 text-text-muted">{error}</p>
              {onRetry && (
                <button type="button" onClick={onRetry} className="mt-3 rounded-full border border-ink/[0.14] px-4 py-1.5 text-text hover:bg-bg-elevated">
                  Try again
                </button>
              )}
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-6 text-sm text-text-muted">No spend alerts configured.</div>
          ) : (
            alerts.map((alert) => {
              const isDeleting = busyDeleteId === alert.id
              return (
                <div key={alert.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text">{alert.title}</p>
                      {alert.triggeredAt && (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500 ring-1 ring-amber-500/20">
                          Triggered
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                      <span>Threshold: {money(alert.threshold, alert.currency, 0)}</span>
                      <span>Created {formatDate(alert.createdAt)}</span>
                      {alert.triggeredAt && (
                        <span>Triggered {formatDate(alert.triggeredAt)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(alert)}
                      disabled={isDeleting}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(alert.id)}
                      disabled={isDeleting}
                      className="rounded-md border border-rose-500/30 px-3 py-1.5 text-xs font-medium text-rose-500 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDeleting ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
