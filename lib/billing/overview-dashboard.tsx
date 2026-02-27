'use client'

import { useState } from 'react'
import { StatusBar, type BillingSection } from './status-bar'
import { SubscriptionPortal } from './subscription-portal'
import { BalancePanel } from '../components/balance-panel'
import type {
  Subscription,
  SubscriptionPlan,
  PaymentMethod,
  UsageSummary,
  CreditGrant,
  Invoice,
  SpendAlert,
  DiscountCode,
} from './types'
import type { Balance } from '../commerce-client'

export interface OverviewDashboardProps {
  subscription: Subscription
  plans: SubscriptionPlan[]
  paymentMethods: PaymentMethod[]
  usage: UsageSummary | null
  usageLoading: boolean
  balance: Balance | null
  creditGrants: CreditGrant[]
  creditBalance: number
  starterCredit: CreditGrant | null
  onAddFunds: (amount: number) => Promise<void>
  onClaimStarterCredit?: () => Promise<void>
  isAdmin: boolean
  onGrantCredit?: (email: string, amount: number) => Promise<void>
  userEmail: string
  invoices: Invoice[]
  spendAlerts: SpendAlert[]
  onNavigate: (target: string) => void
  onUpgrade?: (planId: string) => Promise<void>
  onDowngrade?: (planId: string) => Promise<void>
  onCancel?: (reason: string, feedback?: string) => Promise<void>
  onApplyDiscount?: (code: string) => Promise<DiscountCode | null>
}

function fmt(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

const meterMeta: Record<string, { label: string; icon: string; color: string }> = {
  ai:             { label: 'LLM / Chat',    icon: 'M',  color: 'bg-violet-500' },
  api_calls:      { label: 'API Requests',  icon: 'A',  color: 'bg-indigo-500' },
  storage:        { label: 'Storage',        icon: 'S',  color: 'bg-blue-500' },
  gpu:            { label: 'GPU Compute',    icon: 'G',  color: 'bg-amber-500' },
  network:        { label: 'Network',        icon: 'N',  color: 'bg-emerald-500' },
  network_egress: { label: 'Egress',         icon: 'E',  color: 'bg-teal-500' },
}

export function OverviewDashboard(props: OverviewDashboardProps) {
  const [showPlanPicker, setShowPlanPicker] = useState(false)
  const currentPlan = props.plans.find(p => p.id === props.subscription.planId)
  const mtdSpend = props.usage?.totalCost ?? 0
  const currency = props.usage?.currency ?? 'usd'

  // Spend by product cards
  const records = props.usage?.records ?? []

  // Next invoice: first pending or estimate from usage
  const pendingInvoice = props.invoices.find(i => i.status === 'pending' || i.status === 'unpaid')

  // Alerts summary
  const topAlert = props.spendAlerts.length > 0
    ? props.spendAlerts.reduce((a, b) => a.threshold > b.threshold ? a : b)
    : null

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <StatusBar
        subscription={props.subscription}
        currentPlan={currentPlan}
        mtdSpend={mtdSpend}
        currency={currency}
        paymentMethods={props.paymentMethods}
        onNavigate={props.onNavigate}
      />

      {/* Plan management (toggle) */}
      {showPlanPicker ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Manage Plan</h3>
            <button
              type="button"
              onClick={() => setShowPlanPicker(false)}
              className="text-xs text-text-muted hover:text-text"
            >
              Close
            </button>
          </div>
          <SubscriptionPortal
            subscription={props.subscription}
            availablePlans={props.plans}
            onUpgrade={props.onUpgrade}
            onDowngrade={props.onDowngrade}
            onCancel={props.onCancel}
            onApplyDiscount={props.onApplyDiscount}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowPlanPicker(true)}
          className="w-full rounded-xl border border-border bg-bg-card p-4 text-left transition hover:border-border-strong"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text">
                {currentPlan?.name ?? 'No active plan'}
                {currentPlan?.price ? ` — ${fmt(currentPlan.price)}/mo` : ''}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {currentPlan ? 'Click to manage or change your plan' : 'Click to choose a plan'}
              </p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-muted">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </button>
      )}

      {/* Spend by product */}
      {records.length > 0 && (
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-dim mb-3">Spend by Product</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {records.map(rec => {
              const meta = meterMeta[rec.meterId] ?? { label: rec.label, icon: '?', color: 'bg-gray-500' }
              const pct = rec.limit ? Math.min((rec.current / rec.limit) * 100, 100) : 0
              return (
                <button
                  key={rec.meterId}
                  type="button"
                  onClick={() => props.onNavigate('usage')}
                  className="rounded-xl border border-border bg-bg-card p-4 text-left transition hover:border-border-strong"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`h-6 w-6 rounded-md ${meta.color} flex items-center justify-center text-[10px] font-bold text-white`}>
                      {meta.icon}
                    </div>
                    <span className="text-xs text-text-muted">{meta.label}</span>
                  </div>
                  <p className="text-lg font-semibold text-text">{fmt(rec.cost)}</p>
                  <p className="text-xs text-text-muted mt-1">
                    {rec.current.toLocaleString()} {rec.unit}
                    {rec.limit ? ` / ${rec.limit.toLocaleString()}` : ''}
                  </p>
                  {rec.limit ? (
                    <div className="mt-2 h-1 rounded-full bg-bg-elevated overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-danger' : pct >= 70 ? 'bg-warning' : meta.color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Credits + Next Invoice row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Credits */}
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-dim mb-3">Credits</h3>
          <BalancePanel
            balance={props.balance}
            isAdmin={props.isAdmin}
            userEmail={props.userEmail}
            starterCredit={props.starterCredit}
            onAddFunds={props.onAddFunds}
            onGrantCredit={props.isAdmin ? props.onGrantCredit : undefined}
          />
        </div>

        {/* Next invoice preview */}
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-dim mb-3">Next Invoice</h3>
          <div className="rounded-xl border border-border bg-bg-card p-5">
            {pendingInvoice ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-2xl font-bold text-text">{fmt(pendingInvoice.total)}</p>
                  <span className="rounded-md bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                    {pendingInvoice.status}
                  </span>
                </div>
                {pendingInvoice.items && pendingInvoice.items.length > 0 && (
                  <div className="space-y-1.5 border-t border-border pt-3">
                    {pendingInvoice.items.slice(0, 3).map(item => (
                      <div key={item.id} className="flex justify-between text-xs">
                        <span className="text-text-muted">{item.description}</span>
                        <span className="text-text">{fmt(item.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => props.onNavigate('invoices')}
                  className="mt-3 text-xs text-text-muted hover:text-text transition"
                >
                  View all invoices &rarr;
                </button>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-text">{fmt(mtdSpend)}</p>
                <p className="text-xs text-text-muted mt-1">Estimated based on current usage</p>
                <button
                  type="button"
                  onClick={() => props.onNavigate('invoices')}
                  className="mt-3 text-xs text-text-muted hover:text-text transition"
                >
                  View invoices &rarr;
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Alerts summary */}
      {topAlert && (
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-dim mb-3">Budget</h3>
          <div className="rounded-xl border border-border bg-bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-text">
                Spend limit: <span className="font-semibold">{fmt(topAlert.threshold)}/mo</span>
              </p>
              <button
                type="button"
                onClick={() => props.onNavigate('settings')}
                className="text-xs text-text-muted hover:text-text transition"
              >
                Manage &rarr;
              </button>
            </div>
            <div className="h-2 rounded-full bg-bg-elevated overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  mtdSpend / topAlert.threshold >= 0.8 ? 'bg-danger' : 'bg-success'
                }`}
                style={{ width: `${Math.min((mtdSpend / topAlert.threshold) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-text-muted mt-1">
              {fmt(mtdSpend)} of {fmt(topAlert.threshold)} ({Math.round((mtdSpend / topAlert.threshold) * 100)}%)
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
