'use client'

import * as React from 'react'

import { AccountSwitcher } from './account-switcher'
import { OverviewDashboard } from './overview-dashboard'
import { InvoicesPayments } from './invoices-payments'
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

  balance?: Balance | null
  isAdmin?: boolean
  userEmail?: string
  starterCredit?: CreditGrant | null
  onAddFunds?: (amount: number) => Promise<void>
  onGrantCredit?: (email: string, amount: number) => Promise<void>

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
  { id: 'invoices', label: 'Invoices' },
]

export function BillingWorkspace(props: BillingWorkspaceProps) {
  const {
    subscription,
    plans,
    paymentMethods = [],
    invoices = [],
    businessProfile,
    spendAlerts = [],
    usage = null,
    usageLoading = false,
    creditGrants = [],
    creditBalance = 0,
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

    onUpgrade,
    onDowngrade,
    onCancel,
    onApplyDiscount,

    onAddPaymentMethod,
    onRemovePaymentMethod,
    onSetDefaultPaymentMethod,

    onDownloadInvoice,
    onSaveBusinessProfile,
  } = props

  const [activeSection, setActiveSection] = React.useState<BillingSection>(defaultTab)
  const tabIndicatorRef = React.useRef<HTMLSpanElement>(null)
  const tabsRef = React.useRef<(HTMLButtonElement | null)[]>([])

  // Animated underline indicator (useLayoutEffect for sync layout read)
  React.useLayoutEffect(() => {
    const activeIdx = sections.findIndex(s => s.id === activeSection)
    const activeTab = tabsRef.current[activeIdx]
    const indicator = tabIndicatorRef.current
    if (activeTab && indicator) {
      indicator.style.width = `${activeTab.offsetWidth}px`
      indicator.style.transform = `translateX(${activeTab.offsetLeft}px)`
    }
  }, [activeSection])

  const navigate = React.useCallback((target: string) => {
    const section = target.split(':')[0] as BillingSection
    setActiveSection(section)
  }, [])

  return (
    <div className="space-y-8">
      {billingAccounts.length > 0 && onSwitchAccount && (
        <AccountSwitcher
          accounts={billingAccounts}
          activeAccountId={activeBillingAccountId}
          onSwitch={onSwitchAccount}
          onCreate={onCreateBillingAccount}
        />
      )}

      {/* ── Underline tab nav ── */}
      <div className="relative border-b border-white/[0.08]">
        <div className="flex gap-8">
          {sections.map((s, i) => (
            <button
              key={s.id}
              ref={el => { tabsRef.current[i] = el }}
              type="button"
              onClick={() => setActiveSection(s.id)}
              className={`relative pb-3 text-sm font-medium transition-colors duration-200 ${
                activeSection === s.id
                  ? 'text-white'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {/* Animated underline */}
        <span
          ref={tabIndicatorRef}
          className="absolute bottom-0 left-0 h-[2px] bg-blue-500 rounded-full transition-all duration-300 ease-out"
        />
      </div>

      {/* ── Tab content ── */}
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
          onClaimStarterCredit={props.onClaimStarterCredit}
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
          businessProfile={businessProfile}
          onSaveBusinessProfile={onSaveBusinessProfile}
          onAddPaymentMethod={onAddPaymentMethod}
          onRemovePaymentMethod={onRemovePaymentMethod}
          onSetDefaultPaymentMethod={onSetDefaultPaymentMethod}
        />
      )}

      {activeSection === 'invoices' && (
        <InvoicesPayments
          invoices={invoices}
          onDownloadInvoice={onDownloadInvoice}
        />
      )}
    </div>
  )
}
