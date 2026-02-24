'use client'

import * as React from 'react'

import { InvoiceManager } from './invoice-manager'
import { PaymentMethodManager } from './payment-manager'
import { SubscriptionPortal } from './subscription-portal'
import { BusinessProfilePanel } from './business-profile-panel'
import { TaxCompliancePanel } from './tax-compliance-panel'
import { SpendAlertsPanel } from './spend-alerts'
import { UsagePanel } from './usage-panel'
import type {
  BillingMetric,
  BusinessProfile,
  ComplianceItem,
  DiscountCode,
  Invoice,
  PaymentMethod,
  SpendAlert,
  Subscription,
  SubscriptionHistory,
  SubscriptionPlan,
  TaxSettings,
  RetentionOffer,
  UsageSummary,
} from './types'

type WorkspaceTab =
  | 'overview'
  | 'payment'
  | 'invoices'
  | 'usage'
  | 'alerts'
  | 'business'
  | 'compliance'

export interface BillingWorkspaceProps {
  subscription: Subscription
  plans: SubscriptionPlan[]
  usageMetrics?: BillingMetric[]
  retentionOffers?: RetentionOffer[]
  subscriptionHistory?: SubscriptionHistory[]
  paymentMethods?: PaymentMethod[]
  invoices?: Invoice[]
  businessProfile: BusinessProfile
  taxSettings: TaxSettings
  complianceItems: ComplianceItem[]
  spendAlerts?: SpendAlert[]
  usage?: UsageSummary | null
  usageLoading?: boolean
  defaultTab?: WorkspaceTab

  onUpgrade?: (planId: string) => Promise<void>
  onDowngrade?: (planId: string) => Promise<void>
  onCancel?: (reason: string, feedback?: string) => Promise<void>
  onAcceptOffer?: (offerId: string) => Promise<void>
  onApplyDiscount?: (code: string) => Promise<DiscountCode | null>

  onAddPaymentMethod?: (method: PaymentMethod) => Promise<void>
  onRemovePaymentMethod?: (id: string) => Promise<void>
  onSetDefaultPaymentMethod?: (id: string) => Promise<void>

  onDownloadInvoice?: (invoice: Invoice) => Promise<void>
  onSaveBusinessProfile?: (profile: BusinessProfile) => Promise<void>
  onToggleAutomaticTax?: (enabled: boolean) => Promise<void>

  onCreateSpendAlert?: (title: string, threshold: number) => Promise<void>
  onUpdateSpendAlert?: (id: string, title: string, threshold: number) => Promise<void>
  onDeleteSpendAlert?: (id: string) => Promise<void>
}

const tabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'usage', label: 'Usage' },
  { id: 'payment', label: 'Payment methods' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'alerts', label: 'Spend alerts' },
  { id: 'business', label: 'Business info' },
  { id: 'compliance', label: 'Tax & compliance' },
]

export function BillingWorkspace(props: BillingWorkspaceProps) {
  const {
    subscription,
    plans,
    usageMetrics,
    retentionOffers,
    subscriptionHistory,
    paymentMethods,
    invoices,
    businessProfile,
    taxSettings,
    complianceItems,
    spendAlerts = [],
    usage = null,
    usageLoading = false,
    defaultTab = 'overview',

    onUpgrade,
    onDowngrade,
    onCancel,
    onAcceptOffer,
    onApplyDiscount,

    onAddPaymentMethod,
    onRemovePaymentMethod,
    onSetDefaultPaymentMethod,

    onDownloadInvoice,
    onSaveBusinessProfile,
    onToggleAutomaticTax,

    onCreateSpendAlert,
    onUpdateSpendAlert,
    onDeleteSpendAlert,
  } = props

  const [activeTab, setActiveTab] = React.useState<WorkspaceTab>(defaultTab)

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white">
        <div className="border-b border-zinc-200 px-4 py-4">
          <h2 className="text-2xl font-semibold text-zinc-900">Billing</h2>
          <p className="text-sm text-zinc-500">
            Manage your subscription, payments, usage, invoices, and compliance from one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 p-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                activeTab === tab.id
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' ? (
        <SubscriptionPortal
          subscription={subscription}
          availablePlans={plans}
          usageMetrics={usageMetrics}
          retentionOffers={retentionOffers}
          subscriptionHistory={subscriptionHistory}
          onUpgrade={onUpgrade}
          onDowngrade={onDowngrade}
          onCancel={onCancel}
          onAcceptOffer={onAcceptOffer}
          onApplyDiscount={onApplyDiscount}
        />
      ) : null}

      {activeTab === 'usage' ? (
        <UsagePanel usage={usage} loading={usageLoading} />
      ) : null}

      {activeTab === 'payment' ? (
        <PaymentMethodManager
          paymentMethods={paymentMethods}
          onAdd={onAddPaymentMethod}
          onRemove={onRemovePaymentMethod}
          onSetDefault={onSetDefaultPaymentMethod}
        />
      ) : null}

      {activeTab === 'invoices' ? (
        <InvoiceManager invoices={invoices} onDownload={onDownloadInvoice} />
      ) : null}

      {activeTab === 'alerts' ? (
        <SpendAlertsPanel
          alerts={spendAlerts}
          onCreateAlert={onCreateSpendAlert}
          onUpdateAlert={onUpdateSpendAlert}
          onDeleteAlert={onDeleteSpendAlert}
        />
      ) : null}

      {activeTab === 'business' ? (
        <BusinessProfilePanel profile={businessProfile} onSave={onSaveBusinessProfile} />
      ) : null}

      {activeTab === 'compliance' ? (
        <TaxCompliancePanel
          taxSettings={taxSettings}
          complianceItems={complianceItems}
          onToggleAutomaticTax={onToggleAutomaticTax}
        />
      ) : null}
    </div>
  )
}
