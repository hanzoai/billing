'use client'

import * as React from 'react'

import { AccountSwitcher } from './account-switcher'
import { OverviewDashboard } from './overview-dashboard'
import { CostExplorer } from './cost-explorer'
import { InvoicesPayments } from './invoices-payments'
import { BillingSettings } from './billing-settings'
import { GuidedSetup } from './guided-setup'
import type { BillingSection } from './status-bar'
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
import type { Balance } from '../commerce-client'

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
  defaultTab?: BillingSection

  // Overview-specific (moved from shell)
  balance?: Balance | null
  isAdmin?: boolean
  userEmail?: string
  starterCredit?: CreditGrant | null
  onAddFunds?: (amount: number) => Promise<void>
  onGrantCredit?: (email: string, amount: number) => Promise<void>

  // Multi-billing-account
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

const sections: Array<{ id: BillingSection; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'usage', label: 'Usage & Costs' },
  { id: 'invoices', label: 'Invoices & Payments' },
  { id: 'settings', label: 'Settings' },
]

export function BillingWorkspace(props: BillingWorkspaceProps) {
  const {
    subscription,
    plans,
    paymentMethods = [],
    invoices = [],
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

    balance = null,
    isAdmin = false,
    userEmail = '',
    starterCredit = null,
    onAddFunds,
    onGrantCredit,

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

  const [activeSection, setActiveSection] = React.useState<BillingSection>(defaultTab)
  const [invoicesSubTab, setInvoicesSubTab] = React.useState<'invoices' | 'payment-methods' | 'transactions'>('invoices')
  const [dismissedSetup, setDismissedSetup] = React.useState(false)

  // Navigate with optional sub-tab hint (e.g. 'invoices:payment-methods')
  const navigate = React.useCallback((target: string) => {
    const [section, subTab] = target.split(':') as [BillingSection, string?]
    setActiveSection(section)
    setDismissedSetup(true)
    if (section === 'invoices' && subTab) {
      setInvoicesSubTab(subTab as 'invoices' | 'payment-methods' | 'transactions')
    }
  }, [])

  // Show guided setup when no plan AND no payment methods (unless dismissed)
  const needsSetup = !subscription.id && paymentMethods.length === 0 && !dismissedSetup

  return (
    <div className="space-y-6">
      {billingAccounts.length > 0 && onSwitchAccount && (
        <AccountSwitcher
          accounts={billingAccounts}
          activeAccountId={activeBillingAccountId}
          onSwitch={onSwitchAccount}
          onCreate={onCreateBillingAccount}
        />
      )}

      {/* Section nav */}
      <div className="flex gap-1 rounded-xl bg-bg-card p-1 border border-border">
        {sections.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => navigate(s.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              activeSection === s.id && !needsSetup
                ? 'bg-bg-elevated text-text'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Guided setup (empty state) */}
      {needsSetup ? (
        <GuidedSetup
          hasPaymentMethod={paymentMethods.length > 0}
          hasSubscription={!!subscription.id}
          hasSpendAlert={spendAlerts.length > 0}
          hasCredits={creditBalance > 0}
          onAddPaymentMethod={() => navigate('invoices:payment-methods')}
          onPickPlan={() => navigate('overview')}
          onSetSpendLimit={() => navigate('settings')}
          onBuyCredits={() => navigate('overview')}
          onDismiss={() => setDismissedSetup(true)}
        />
      ) : (
        <>
          {activeSection === 'overview' && (
            <OverviewDashboard
              subscription={subscription}
              plans={plans}
              paymentMethods={paymentMethods}
              usage={usage}
              usageLoading={usageLoading}
              balance={balance}
              creditGrants={creditGrants}
              creditBalance={creditBalance}
              starterCredit={starterCredit}
              onAddFunds={onAddFunds ?? (async () => {})}
              onClaimStarterCredit={onClaimStarterCredit}
              isAdmin={isAdmin}
              onGrantCredit={onGrantCredit}
              userEmail={userEmail}
              invoices={invoices}
              spendAlerts={spendAlerts}
              onNavigate={navigate}
              onUpgrade={onUpgrade}
              onDowngrade={onDowngrade}
              onCancel={onCancel}
              onApplyDiscount={onApplyDiscount}
            />
          )}

          {activeSection === 'usage' && (
            <CostExplorer usage={usage} usageLoading={usageLoading} />
          )}

          {activeSection === 'invoices' && (
            <InvoicesPayments
              invoices={invoices}
              onDownloadInvoice={onDownloadInvoice}
              paymentMethods={paymentMethods}
              onAddPaymentMethod={onAddPaymentMethod}
              onRemovePaymentMethod={onRemovePaymentMethod}
              onSetDefaultPaymentMethod={onSetDefaultPaymentMethod}
              transactions={transactions}
              transactionsLoading={transactionsLoading}
              defaultSubTab={invoicesSubTab}
            />
          )}

          {activeSection === 'settings' && (
            <BillingSettings
              spendAlerts={spendAlerts}
              onCreateSpendAlert={onCreateSpendAlert}
              onUpdateSpendAlert={onUpdateSpendAlert}
              onDeleteSpendAlert={onDeleteSpendAlert}
              accountMembers={accountMembers}
              userRole={userRole}
              onInviteMember={onInviteMember}
              onChangeMemberRole={onChangeMemberRole}
              onRemoveMember={onRemoveMember}
              businessProfile={businessProfile}
              onSaveBusinessProfile={onSaveBusinessProfile}
              taxSettings={taxSettings}
              complianceItems={complianceItems}
              onToggleAutomaticTax={onToggleAutomaticTax}
              currentSupportTier={currentSupportTier}
              onSubscribeSupport={onSubscribeSupport}
              discount={subscription.discount}
              onApplyDiscount={onApplyDiscount}
            />
          )}
        </>
      )}
    </div>
  )
}
