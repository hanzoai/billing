'use client'

import { useState } from 'react'
import { InvoiceManager } from './invoice-manager'
import { PaymentMethodManager } from './payment-manager'
import { TransactionsPanel } from './transactions-panel'
import type { Invoice, PaymentMethod, TransactionRecord } from './types'

type SubTab = 'invoices' | 'payment-methods' | 'transactions'

export interface InvoicesPaymentsProps {
  invoices: Invoice[]
  onDownloadInvoice?: (invoice: Invoice) => Promise<void>
  paymentMethods: PaymentMethod[]
  onAddPaymentMethod?: (method: PaymentMethod) => Promise<void>
  onRemovePaymentMethod?: (id: string) => Promise<void>
  onSetDefaultPaymentMethod?: (id: string) => Promise<void>
  transactions: TransactionRecord[]
  transactionsLoading: boolean
  defaultSubTab?: SubTab
}

const subTabs: Array<{ id: SubTab; label: string }> = [
  { id: 'invoices', label: 'Invoices' },
  { id: 'payment-methods', label: 'Payment Methods' },
  { id: 'transactions', label: 'Transactions' },
]

export function InvoicesPayments(props: InvoicesPaymentsProps) {
  const [active, setActive] = useState<SubTab>(props.defaultSubTab ?? 'invoices')

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-xl bg-bg-card p-1 border border-border">
        {subTabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active === t.id
                ? 'bg-bg-elevated text-text'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === 'invoices' && (
        <InvoiceManager invoices={props.invoices} onDownload={props.onDownloadInvoice} />
      )}
      {active === 'payment-methods' && (
        <PaymentMethodManager
          paymentMethods={props.paymentMethods}
          onAdd={props.onAddPaymentMethod}
          onRemove={props.onRemovePaymentMethod}
          onSetDefault={props.onSetDefaultPaymentMethod}
        />
      )}
      {active === 'transactions' && (
        <TransactionsPanel transactions={props.transactions} loading={props.transactionsLoading} />
      )}
    </div>
  )
}
