'use client'

import * as React from 'react'

import type { PaymentMethod, PaymentMethodType, CryptoNetwork } from './types'

export interface PaymentMethodManagerProps {
  paymentMethods?: PaymentMethod[]
  initialMethods?: PaymentMethod[]
  onAdd?: (method: PaymentMethod) => Promise<void>
  onRemove?: (id: string) => Promise<void>
  onSetDefault?: (id: string) => Promise<void>
  onMethodAdded?: (method: PaymentMethod) => void
  onMethodRemoved?: (id: string) => void
  onDefaultChanged?: (id: string) => void
}

interface DraftMethod {
  holderName: string
  type: PaymentMethodType
  cardBrand: string
  last4: string
  expMonth: string
  expYear: string
  cryptoNetwork: CryptoNetwork
  walletAddress: string
  walletLabel: string
  wireBankName: string
  wireAccountHolder: string
  wireRoutingNumber: string
  wireAccountLast4: string
  wireSwift: string
  wireIban: string
  wireCountry: string
  paypalEmail: string
}

const defaultDraft: DraftMethod = {
  holderName: '',
  type: 'card',
  cardBrand: 'visa',
  last4: '',
  expMonth: '',
  expYear: '',
  cryptoNetwork: 'ethereum',
  walletAddress: '',
  walletLabel: '',
  wireBankName: '',
  wireAccountHolder: '',
  wireRoutingNumber: '',
  wireAccountLast4: '',
  wireSwift: '',
  wireIban: '',
  wireCountry: 'US',
  paypalEmail: '',
}

function formatCardBrand(brand: string) {
  if (!brand) return 'Card'
  return brand.charAt(0).toUpperCase() + brand.slice(1)
}

const CRYPTO_NETWORK_LABELS: Record<CryptoNetwork, string> = {
  bitcoin: 'Bitcoin (BTC)',
  ethereum: 'Ethereum (ETH)',
  solana: 'Solana (SOL)',
  usdc: 'USDC',
}

function buildPaymentMethodFromDraft(draft: DraftMethod): PaymentMethod {
  const now = new Date().toISOString()
  const id = `pm_${Math.random().toString(36).slice(2, 12)}`

  const base: PaymentMethod = {
    id,
    type: draft.type,
    is_default: false,
    created_at: now,
    isDefault: false,
    billing_details: { name: draft.holderName },
  }

  if (draft.type === 'card') {
    return {
      ...base,
      card: {
        brand: draft.cardBrand,
        last4: draft.last4,
        exp_month: Number(draft.expMonth),
        exp_year: Number(draft.expYear),
        funding: 'credit',
      },
    }
  }

  if (draft.type === 'crypto') {
    return {
      ...base,
      crypto: {
        network: draft.cryptoNetwork,
        walletAddress: draft.walletAddress,
        label: draft.walletLabel || undefined,
      },
    }
  }

  if (draft.type === 'wire') {
    return {
      ...base,
      wire: {
        bankName: draft.wireBankName,
        accountHolder: draft.wireAccountHolder,
        routingNumber: draft.wireRoutingNumber || undefined,
        accountLast4: draft.wireAccountLast4 || undefined,
        swift: draft.wireSwift || undefined,
        iban: draft.wireIban || undefined,
        country: draft.wireCountry || undefined,
      },
    }
  }

  if (draft.type === 'paypal') {
    return {
      ...base,
      paypal: { email: draft.paypalEmail },
    }
  }

  return base
}

function methodDisplay(method: PaymentMethod) {
  if (method.type === 'card') {
    return `${formatCardBrand(method.card?.brand || '')} •••• ${method.card?.last4 || '••••'}`
  }
  if (method.type === 'crypto') {
    const network = method.crypto?.network ?? 'ethereum'
    const label = CRYPTO_NETWORK_LABELS[network as CryptoNetwork] ?? network
    const addr = method.crypto?.walletAddress ?? ''
    const shortAddr = addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr
    return `${label} ${shortAddr}`
  }
  if (method.type === 'wire') {
    const bank = method.wire?.bankName ?? 'Wire'
    const last4 = method.wire?.accountLast4 ? ` •••• ${method.wire.accountLast4}` : ''
    return `${bank}${last4}`
  }
  if (method.type === 'paypal') {
    return `PayPal ${method.paypal?.email ? `(${method.paypal.email})` : ''}`
  }
  if (method.type === 'bank_account' || method.type === 'sepa_debit') {
    return `${method.bank_account?.bankName || 'Bank account'} •••• ${method.bank_account?.last4 || '••••'}`
  }
  if (method.type === 'apple_pay') return 'Apple Pay'
  return 'Google Pay'
}

function methodIcon(type: PaymentMethodType) {
  switch (type) {
    case 'card': return '💳'
    case 'crypto': return '🔗'
    case 'wire': return '🏦'
    case 'paypal': return '🅿️'
    case 'bank_account':
    case 'sepa_debit': return '🏛️'
    case 'apple_pay': return '🍎'
    case 'google_pay': return '🔵'
    default: return '💰'
  }
}

function methodExpiration(method: PaymentMethod) {
  if (method.type !== 'card') return null
  const month = method.card?.exp_month
  const year = method.card?.exp_year
  if (!month || !year) return null
  return `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`
}

function methodSubtext(method: PaymentMethod) {
  if (method.type === 'crypto') {
    return method.crypto?.label || 'Crypto wallet'
  }
  if (method.type === 'wire') {
    const parts: string[] = []
    if (method.wire?.swift) parts.push(`SWIFT: ${method.wire.swift}`)
    if (method.wire?.country) parts.push(method.wire.country)
    return parts.join(' · ') || 'Wire transfer'
  }
  return null
}

const INPUT_CLASS = 'rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text outline-none transition focus:border-brand'

export function PaymentMethodManager(props: PaymentMethodManagerProps) {
  const {
    paymentMethods,
    initialMethods,
    onAdd,
    onRemove,
    onSetDefault,
    onMethodAdded,
    onMethodRemoved,
    onDefaultChanged,
  } = props

  const [methods, setMethods] = React.useState<PaymentMethod[]>(
    paymentMethods && paymentMethods.length > 0
      ? paymentMethods
      : initialMethods || [],
  )
  const [draft, setDraft] = React.useState<DraftMethod>(defaultDraft)
  const [isAdding, setIsAdding] = React.useState(false)
  const [busyMethodId, setBusyMethodId] = React.useState<string | null>(null)
  const [showForm, setShowForm] = React.useState(false)

  React.useEffect(() => {
    if (paymentMethods) {
      setMethods(paymentMethods)
    }
  }, [paymentMethods])

  const canCreate = React.useMemo(() => {
    if (draft.type === 'card') {
      return draft.holderName.trim().length > 1 && draft.last4.length === 4 && draft.expMonth && draft.expYear
    }
    if (draft.type === 'crypto') {
      return draft.walletAddress.trim().length >= 10
    }
    if (draft.type === 'wire') {
      return draft.wireBankName.trim().length > 1 && draft.wireAccountHolder.trim().length > 1
    }
    if (draft.type === 'paypal') {
      return draft.paypalEmail.includes('@')
    }
    return draft.holderName.trim().length > 1
  }, [draft])

  const handleCreate = React.useCallback(async () => {
    if (!canCreate) return
    setIsAdding(true)

    const method = buildPaymentMethodFromDraft(draft)
    try {
      await onAdd?.(method)
      setMethods((prev) => [...prev, method])
      onMethodAdded?.(method)
      setDraft(defaultDraft)
      setShowForm(false)
    } finally {
      setIsAdding(false)
    }
  }, [canCreate, draft, onAdd, onMethodAdded])

  const handleRemove = React.useCallback(
    async (id: string) => {
      setBusyMethodId(id)
      try {
        await onRemove?.(id)
        setMethods((prev) => prev.filter((m) => m.id !== id))
        onMethodRemoved?.(id)
      } finally {
        setBusyMethodId(null)
      }
    },
    [onMethodRemoved, onRemove],
  )

  const handleSetDefault = React.useCallback(
    async (id: string) => {
      setBusyMethodId(id)
      try {
        await onSetDefault?.(id)
        setMethods((prev) =>
          prev.map((method) => ({
            ...method,
            is_default: method.id === id,
            isDefault: method.id === id,
          })),
        )
        onDefaultChanged?.(id)
      } finally {
        setBusyMethodId(null)
      }
    },
    [onDefaultChanged, onSetDefault],
  )

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border bg-bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h3 className="text-lg font-semibold text-text">Payment methods</h3>
            <p className="text-sm text-text-muted">Manage cards, crypto wallets, bank transfers, and digital wallets</p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-text px-3 py-2 text-sm font-medium text-bg transition hover:opacity-80"
          >
            {showForm ? 'Cancel' : 'Add method'}
          </button>
        </div>

        {showForm ? (
          <div className="border-b border-border p-4">
            {/* Method type selector */}
            <div className="mb-4 flex flex-wrap gap-2">
              {([
                ['card', 'Card'],
                ['crypto', 'Crypto wallet'],
                ['wire', 'Wire transfer'],
                ['paypal', 'PayPal'],
                ['bank_account', 'Bank account'],
                ['apple_pay', 'Apple Pay'],
                ['google_pay', 'Google Pay'],
              ] as const).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, type }))}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    draft.type === type
                      ? 'bg-text text-bg'
                      : 'border border-border text-text-secondary hover:bg-bg-elevated'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Card fields */}
            {draft.type === 'card' && (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <input
                  value={draft.holderName}
                  onChange={(e) => setDraft((prev) => ({ ...prev, holderName: e.target.value }))}
                  placeholder="Cardholder name"
                  className={INPUT_CLASS}
                />
                <select
                  value={draft.cardBrand}
                  onChange={(e) => setDraft((prev) => ({ ...prev, cardBrand: e.target.value }))}
                  className={INPUT_CLASS}
                >
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="amex">Amex</option>
                  <option value="discover">Discover</option>
                </select>
                <input
                  value={draft.last4}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      last4: e.target.value.replace(/\D/g, '').slice(0, 4),
                    }))
                  }
                  placeholder="Last 4 digits"
                  className={INPUT_CLASS}
                />
                <input
                  value={draft.expMonth}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      expMonth: e.target.value.replace(/\D/g, '').slice(0, 2),
                    }))
                  }
                  placeholder="MM"
                  className={INPUT_CLASS}
                />
                <input
                  value={draft.expYear}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      expYear: e.target.value.replace(/\D/g, '').slice(0, 4),
                    }))
                  }
                  placeholder="YYYY"
                  className={INPUT_CLASS}
                />
              </div>
            )}

            {/* Crypto fields */}
            {draft.type === 'crypto' && (
              <div className="grid gap-3 md:grid-cols-2">
                <select
                  value={draft.cryptoNetwork}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      cryptoNetwork: e.target.value as CryptoNetwork,
                    }))
                  }
                  className={INPUT_CLASS}
                >
                  <option value="bitcoin">Bitcoin (BTC)</option>
                  <option value="ethereum">Ethereum (ETH)</option>
                  <option value="solana">Solana (SOL)</option>
                  <option value="usdc">USDC</option>
                </select>
                <input
                  value={draft.walletAddress}
                  onChange={(e) => setDraft((prev) => ({ ...prev, walletAddress: e.target.value }))}
                  placeholder="Wallet address"
                  className={`${INPUT_CLASS} font-mono`}
                />
                <input
                  value={draft.walletLabel}
                  onChange={(e) => setDraft((prev) => ({ ...prev, walletLabel: e.target.value }))}
                  placeholder="Label (optional)"
                  className={`${INPUT_CLASS} md:col-span-2`}
                />
              </div>
            )}

            {/* Wire fields */}
            {draft.type === 'wire' && (
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={draft.wireBankName}
                  onChange={(e) => setDraft((prev) => ({ ...prev, wireBankName: e.target.value }))}
                  placeholder="Bank name"
                  className={INPUT_CLASS}
                />
                <input
                  value={draft.wireAccountHolder}
                  onChange={(e) => setDraft((prev) => ({ ...prev, wireAccountHolder: e.target.value }))}
                  placeholder="Account holder name"
                  className={INPUT_CLASS}
                />
                <input
                  value={draft.wireRoutingNumber}
                  onChange={(e) => setDraft((prev) => ({ ...prev, wireRoutingNumber: e.target.value }))}
                  placeholder="Routing number (domestic)"
                  className={INPUT_CLASS}
                />
                <input
                  value={draft.wireSwift}
                  onChange={(e) => setDraft((prev) => ({ ...prev, wireSwift: e.target.value }))}
                  placeholder="SWIFT/BIC (international)"
                  className={INPUT_CLASS}
                />
                <input
                  value={draft.wireIban}
                  onChange={(e) => setDraft((prev) => ({ ...prev, wireIban: e.target.value }))}
                  placeholder="IBAN (international)"
                  className={INPUT_CLASS}
                />
                <input
                  value={draft.wireCountry}
                  onChange={(e) => setDraft((prev) => ({ ...prev, wireCountry: e.target.value }))}
                  placeholder="Country"
                  className={INPUT_CLASS}
                />
              </div>
            )}

            {/* PayPal fields */}
            {draft.type === 'paypal' && (
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={draft.paypalEmail}
                  onChange={(e) => setDraft((prev) => ({ ...prev, paypalEmail: e.target.value }))}
                  placeholder="PayPal email"
                  type="email"
                  className={`${INPUT_CLASS} md:col-span-2`}
                />
              </div>
            )}

            {/* Bank account / Apple Pay / Google Pay */}
            {(draft.type === 'bank_account' || draft.type === 'apple_pay' || draft.type === 'google_pay') && (
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={draft.holderName}
                  onChange={(e) => setDraft((prev) => ({ ...prev, holderName: e.target.value }))}
                  placeholder="Account holder name"
                  className={`${INPUT_CLASS} md:col-span-2`}
                />
              </div>
            )}

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={!canCreate || isAdding}
                onClick={handleCreate}
                className="rounded-lg bg-text px-4 py-2 text-sm font-medium text-bg transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAdding ? 'Saving…' : 'Add payment method'}
              </button>
            </div>
          </div>
        ) : null}

        <div className="divide-y divide-border">
          {methods.length === 0 ? (
            <div className="p-6 text-sm text-text-muted">No payment methods on file.</div>
          ) : (
            methods.map((method) => {
              const isDefault = method.is_default || method.isDefault
              const isBusy = busyMethodId === method.id
              const sub = methodSubtext(method)

              return (
                <div key={method.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-lg">{methodIcon(method.type)}</span>
                    <div>
                      <p className="text-sm font-medium text-text">{methodDisplay(method)}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                        <span>
                          Added {new Date(method.created_at).toLocaleDateString('en-US')}
                        </span>
                        {methodExpiration(method) ? <span>Expires {methodExpiration(method)}</span> : null}
                        {sub ? <span>{sub}</span> : null}
                        {isDefault ? (
                          <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-foreground">
                            Default
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isDefault ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleSetDefault(method.id)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isBusy ? 'Saving…' : 'Set default'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleRemove(method.id)}
                      className="rounded-md border border-rose-500/30 px-3 py-1.5 text-xs font-medium text-rose-500 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isBusy ? 'Removing…' : 'Remove'}
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
