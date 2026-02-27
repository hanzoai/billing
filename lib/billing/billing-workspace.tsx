'use client'

import * as React from 'react'

import { InvoiceManager } from './invoice-manager'
import { PaymentMethodManager } from './payment-manager'
import { SubscriptionPortal } from './subscription-portal'
import { BusinessProfilePanel } from './business-profile-panel'
import { TaxCompliancePanel } from './tax-compliance-panel'
import { SpendAlertsPanel } from './spend-alerts'
import { UsagePanel } from './usage-panel'
import { CreditsPanel } from './credits-panel'
import { TransactionsPanel } from './transactions-panel'
import { PromotionsPanel } from './promotions-panel'
import { SupportTiersPanel } from './support-tiers-panel'
import { AccountSwitcher } from './account-switcher'
import { AccountMembers } from './account-members'
import type {
  BillingAccount,
  BillingAccountMember,
  BillingMetric,
  BillingRole,
  BusinessProfile,
  ComplianceItem,
  CreditGrant,
  DiscountCode,
  Invoice,
  PaymentMethod,
  SpendAlert,
  Subscription,
  SubscriptionHistory,
  SubscriptionPlan,
  TaxSettings,
  TransactionRecord,
  RetentionOffer,
  UsageSummary,
} from './types'

type WorkspaceTab =
  | 'overview'
  | 'usage'
  | 'credits'
  | 'payment'
  | 'invoices'
  | 'transactions'
  | 'alerts'
  | 'promotions'
  | 'support'
  | 'business'
  | 'compliance'
  | 'team'

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
  creditGrants?: CreditGrant[]
  creditBalance?: number
  transactions?: TransactionRecord[]
  transactionsLoading?: boolean
  currentSupportTier?: string
  defaultTab?: WorkspaceTab

  // Multi-billing-account props
  billingAccounts?: BillingAccount[]
  activeBillingAccountId?: string | null
  onSwitchAccount?: (accountId: string) => void
  onCreateBillingAccount?: () => void
  userRole?: BillingRole
  accountMembers?: BillingAccountMember[]
  onInviteMember?: (email: string, role: BillingRole) => Promise<void>
  onChangeMemberRole?: (memberId: string, role: BillingRole) => Promise<void>
  onRemoveMember?: (memberId: string) => Promise<void>

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

  onClaimStarterCredit?: () => Promise<void>
  onSubscribeSupport?: (tierId: string) => Promise<void>
}

const tabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'usage', label: 'Usage' },
  { id: 'credits', label: 'Credits' },
  { id: 'payment', label: 'Payment methods' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'alerts', label: 'Spend alerts' },
  { id: 'promotions', label: 'Promotions' },
  { id: 'support', label: 'Support' },
  { id: 'business', label: 'Business info' },
  { id: 'compliance', label: 'Tax & compliance' },
  { id: 'team', label: 'Team' },
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
    creditGrants = [],
    creditBalance = 0,
    transactions = [],
    transactionsLoading = false,
    currentSupportTier,
    defaultTab = 'overview',

    billingAccounts = [],
    activeBillingAccountId = null,
    onSwitchAccount,
    onCreateBillingAccount,
    userRole = 'owner',
    accountMembers = [],
    onInviteMember,
    onChangeMemberRole,
    onRemoveMember,

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

    onClaimStarterCredit,
    onSubscribeSupport,
  } = props

  const [activeTab, setActiveTab] = React.useState<WorkspaceTab>(defaultTab)

  return (
    <div className="space-y-4">
      {billingAccounts.length > 0 && onSwitchAccount && (
        <AccountSwitcher
          accounts={billingAccounts}
          activeAccountId={activeBillingAccountId}
          onSwitch={onSwitchAccount}
          onCreate={onCreateBillingAccount}
        />
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-bg-card">
        <div className="border-b border-border px-4 py-4">
          <h2 className="text-2xl font-semibold text-text">Billing</h2>
          <p className="text-sm text-text-muted">
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
                  ? 'bg-text text-bg'
                  : 'text-text-muted hover:bg-bg-elevated hover:text-text'
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

      {activeTab === 'credits' ? (
        <CreditsPanel
          creditGrants={creditGrants}
          creditBalance={creditBalance}
          onClaimStarterCredit={onClaimStarterCredit}
        />
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

      {activeTab === 'transactions' ? (
        <TransactionsPanel
          transactions={transactions}
          loading={transactionsLoading}
        />
      ) : null}

      {activeTab === 'alerts' ? (
        <SpendAlertsPanel
          alerts={spendAlerts}
          onCreateAlert={onCreateSpendAlert}
          onUpdateAlert={onUpdateSpendAlert}
          onDeleteAlert={onDeleteSpendAlert}
        />
      ) : null}

      {activeTab === 'promotions' ? (
        <PromotionsPanel
          discount={subscription.discount}
          onApplyDiscount={onApplyDiscount}
        />
      ) : null}

      {activeTab === 'support' ? (
        <SupportTiersPanel
          currentTier={currentSupportTier}
          onSubscribe={onSubscribeSupport}
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

      {activeTab === 'team' ? (
        <AccountMembers
          members={accountMembers}
          userRole={userRole}
          onInvite={onInviteMember}
          onChangeRole={onChangeMemberRole}
          onRemove={onRemoveMember}
        />
      ) : null}
    </div>
  )
}
