'use client'

import * as React from 'react'
// @ts-ignore — Square SDK types are incomplete
import { CreditCard, PaymentForm } from 'react-square-web-payments-sdk'
import { ethers } from 'ethers'

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

declare global {
  interface Window { ethereum?: any }
}

// ── Display helpers ──────────────────────────────────────────────────────

const CRYPTO_NETWORK_LABELS: Record<CryptoNetwork, string> = {
  bitcoin: 'Bitcoin (BTC)',
  ethereum: 'Ethereum (ETH)',
  solana: 'Solana (SOL)',
  usdc: 'USDC',
}

function formatCardBrand(brand: string) {
  if (!brand) return 'Card'
  return brand.charAt(0).toUpperCase() + brand.slice(1)
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
    return method.wire?.bankName ?? 'Wire transfer'
  }
  if (method.type === 'bank_account' || method.type === 'sepa_debit') {
    return `${method.bank_account?.bankName || 'Bank account'} •••• ${method.bank_account?.last4 || '••••'}`
  }
  return method.type
}

function methodIcon(type: PaymentMethodType) {
  switch (type) {
    case 'card': return '💳'
    case 'crypto': return '🔗'
    case 'wire': return '🏦'
    case 'bank_account':
    case 'sepa_debit': return '🏛️'
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
  if (method.type === 'crypto') return method.crypto?.label || 'Crypto wallet'
  if (method.type === 'wire') {
    const parts: string[] = []
    if (method.wire?.swift) parts.push(`SWIFT: ${method.wire.swift}`)
    if (method.wire?.country) parts.push(method.wire.country)
    return parts.join(' · ') || 'Wire transfer'
  }
  return null
}

// ── Square card payment API ──────────────────────────────────────────────

async function processSquareCardPayment(sourceId: string, amount: number, verificationToken?: string) {
  const apiUrl = process.env.NEXT_PUBLIC_COMMERCE_URL || 'https://api.commerce.hanzo.ai'
  try {
    const res = await fetch(`${apiUrl}/api/v1/billing/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId, amount, verificationToken }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ── Copy to clipboard helper ─────────────────────────────────────────────

function copyText(text: string, label: string, setMsg: (m: string) => void) {
  navigator.clipboard.writeText(text).then(() => {
    setMsg(`${label} copied`)
    setTimeout(() => setMsg(''), 2000)
  })
}

// ── Add method tab type ──────────────────────────────────────────────────

type AddMethodTab = 'card' | 'crypto' | 'wire'

const TAB_CLASS = 'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition'
const TAB_ACTIVE = 'bg-bg-elevated text-text'
const TAB_INACTIVE = 'text-text-muted hover:text-text-secondary'

// ═══════════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════════

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
    paymentMethods && paymentMethods.length > 0 ? paymentMethods : initialMethods || [],
  )
  const [busyMethodId, setBusyMethodId] = React.useState<string | null>(null)
  const [showForm, setShowForm] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<AddMethodTab>('card')
  const [status, setStatus] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (paymentMethods) setMethods(paymentMethods)
  }, [paymentMethods])

  const addMethod = React.useCallback(async (method: PaymentMethod) => {
    try {
      await onAdd?.(method)
      setMethods(prev => [...prev, method])
      onMethodAdded?.(method)
      setShowForm(false)
      setStatus('Payment method added')
      setTimeout(() => setStatus(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add payment method')
    }
  }, [onAdd, onMethodAdded])

  const handleRemove = React.useCallback(async (id: string) => {
    setBusyMethodId(id)
    try {
      await onRemove?.(id)
      setMethods(prev => prev.filter(m => m.id !== id))
      onMethodRemoved?.(id)
    } finally {
      setBusyMethodId(null)
    }
  }, [onMethodRemoved, onRemove])

  const handleSetDefault = React.useCallback(async (id: string) => {
    setBusyMethodId(id)
    try {
      await onSetDefault?.(id)
      setMethods(prev => prev.map(m => ({ ...m, is_default: m.id === id, isDefault: m.id === id })))
      onDefaultChanged?.(id)
    } finally {
      setBusyMethodId(null)
    }
  }, [onDefaultChanged, onSetDefault])

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border bg-bg-card">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h3 className="text-lg font-semibold text-text">Payment methods</h3>
            <p className="text-sm text-text-muted">Add a card, crypto wallet, or bank wire transfer</p>
          </div>
          <button
            type="button"
            onClick={() => { setShowForm(v => !v); setError(null) }}
            className="rounded-lg bg-text px-3 py-2 text-sm font-medium text-bg transition hover:opacity-80"
          >
            {showForm ? 'Cancel' : 'Add method'}
          </button>
        </div>

        {/* Add method form */}
        {showForm && (
          <div className="border-b border-border p-4">
            {/* Tab bar */}
            <div className="mb-4 flex gap-1 rounded-xl bg-bg p-1">
              {([
                ['card', 'Credit / Debit Card'],
                ['crypto', 'Cryptocurrency'],
                ['wire', 'Bank Wire'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setActiveTab(id); setError(null) }}
                  className={`${TAB_CLASS} ${activeTab === id ? TAB_ACTIVE : TAB_INACTIVE}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeTab === 'card' && (
              <CardForm onAdd={addMethod} setError={setError} />
            )}
            {activeTab === 'crypto' && (
              <CryptoForm onAdd={addMethod} setError={setError} />
            )}
            {activeTab === 'wire' && (
              <WireForm onAdd={addMethod} />
            )}

            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          </div>
        )}

        {/* Status message */}
        {status && (
          <div className="border-b border-border px-4 py-2">
            <p className="text-sm text-success">{status}</p>
          </div>
        )}

        {/* Method list */}
        <div className="divide-y divide-border">
          {methods.length === 0 ? (
            <div className="p-6 text-sm text-text-muted">No payment methods on file.</div>
          ) : (
            methods.map(method => {
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
                        <span>Added {new Date(method.created_at).toLocaleDateString('en-US')}</span>
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
                    {!isDefault && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleSetDefault(method.id)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isBusy ? 'Saving…' : 'Set default'}
                      </button>
                    )}
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

// ═══════════════════════════════════════════════════════════════════════════
// Card form — Square Web Payments SDK
// ═══════════════════════════════════════════════════════════════════════════

function CardForm({ onAdd, setError }: { onAdd: (m: PaymentMethod) => Promise<void>; setError: (e: string) => void }) {
  const [processing, setProcessing] = React.useState(false)
  const appId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID ?? ''
  const locId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ?? ''

  if (!appId || !locId) {
    return (
      <div className="rounded-lg border border-border bg-bg p-6 text-center">
        <p className="text-sm text-text-muted">Card payments are being configured.</p>
        <p className="mt-1 text-xs text-text-dim">Square Application ID and Location ID required.</p>
      </div>
    )
  }

  return (
    <div>
      <p className="mb-3 text-xs text-text-muted">
        Securely add a credit or debit card. Card data is tokenized by Square — we never see your full card number.
      </p>
      <PaymentForm
        applicationId={appId}
        locationId={locId}
        cardTokenizeResponseReceived={async (token: any, verifiedBuyer: any) => {
          if (!token?.token) {
            setError('Card tokenization failed. Please try again.')
            return
          }
          setProcessing(true)
          try {
            // Store tokenized card via commerce API
            const method: PaymentMethod = {
              id: `pm_${Math.random().toString(36).slice(2, 12)}`,
              type: 'card',
              is_default: false,
              isDefault: false,
              created_at: new Date().toISOString(),
              card: {
                brand: token.details?.card?.brand?.toLowerCase() ?? 'card',
                last4: token.details?.card?.last4 ?? '••••',
                exp_month: token.details?.card?.expMonth ?? 0,
                exp_year: token.details?.card?.expYear ?? 0,
                funding: 'credit',
              },
              billing_details: {},
              // Pass the token for the backend to store the card on file
              _sourceToken: token.token,
              _verificationToken: verifiedBuyer?.token,
            }
            await onAdd(method)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save card')
          } finally {
            setProcessing(false)
          }
        }}
        createVerificationDetails={() => ({
          amount: '0.00',
          currencyCode: 'USD',
          intent: 'STORE',
          billingContact: {},
        })}
      >
        <div className="space-y-3">
          <CreditCard
            style={{
              '.input-container': { borderColor: '#333333', borderRadius: '8px' },
              '.input-container.is-focus': { borderColor: '#ffffff' },
              '.input-container.is-error': { borderColor: '#ef4444' },
              input: { backgroundColor: 'transparent', color: '#FFFFFF', fontSize: '14px', fontFamily: 'system-ui, sans-serif' },
              'input::placeholder': { color: '#555555' },
            }}
            render={(Button: any) => (
              <Button
                disabled={processing}
                className="mt-3 w-full rounded-lg bg-text px-4 py-2.5 text-sm font-medium text-bg transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {processing ? 'Saving card…' : 'Add card'}
              </Button>
            )}
          />
          <div className="flex items-center gap-2 text-xs text-text-dim">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Secured by Square. Visa, Mastercard, Amex, Discover accepted.
          </div>
        </div>
      </PaymentForm>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Crypto form — ethers.js wallet connection
// ═══════════════════════════════════════════════════════════════════════════

function CryptoForm({ onAdd, setError }: { onAdd: (m: PaymentMethod) => Promise<void>; setError: (e: string) => void }) {
  const [connecting, setConnecting] = React.useState(false)
  const [walletAddress, setWalletAddress] = React.useState<string | null>(null)
  const [label, setLabel] = React.useState('')

  const hasWallet = typeof window !== 'undefined' && !!window.ethereum

  const connectWallet = React.useCallback(async () => {
    if (!window.ethereum) {
      setError('No Ethereum wallet detected. Install MetaMask or another wallet extension.')
      return
    }
    setConnecting(true)
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      setWalletAddress(address)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet')
    } finally {
      setConnecting(false)
    }
  }, [setError])

  const saveWallet = React.useCallback(async () => {
    if (!walletAddress) return
    const method: PaymentMethod = {
      id: `pm_${Math.random().toString(36).slice(2, 12)}`,
      type: 'crypto',
      is_default: false,
      isDefault: false,
      created_at: new Date().toISOString(),
      crypto: {
        network: 'ethereum',
        walletAddress,
        label: label || undefined,
      },
      billing_details: {},
    }
    await onAdd(method)
  }, [walletAddress, label, onAdd])

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">
        Connect your Ethereum wallet to pay with ETH. Your wallet address is saved for future payments.
      </p>

      {!walletAddress ? (
        <button
          type="button"
          disabled={connecting || !hasWallet}
          onClick={connectWallet}
          className="w-full rounded-lg border border-border bg-bg px-4 py-3 text-sm font-medium text-text transition hover:border-border-strong hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-60"
        >
          {!hasWallet
            ? 'No wallet detected — install MetaMask'
            : connecting
              ? 'Connecting…'
              : 'Connect Ethereum wallet'}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-bg p-3">
            <p className="text-xs text-text-dim">Connected wallet</p>
            <p className="mt-1 font-mono text-sm text-text break-all">{walletAddress}</p>
          </div>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Label (optional, e.g. 'My MetaMask')"
            className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text outline-none transition placeholder:text-text-dim focus:border-brand"
          />
          <button
            type="button"
            onClick={saveWallet}
            className="w-full rounded-lg bg-text px-4 py-2.5 text-sm font-medium text-bg transition hover:opacity-80"
          >
            Save wallet
          </button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Wire form — bank details with copy-to-clipboard
// ═══════════════════════════════════════════════════════════════════════════

const BANK_DETAILS = [
  { label: 'Beneficiary Bank', value: 'Bank of America, NA 222 Broadway, New York, NY 10038' },
  { label: 'Beneficiary', value: 'Hanzo, Inc, 4811 Mastin Street, Merriam, KS 66203' },
  { label: 'Routing — ACH', value: '113000023 / 111000025' },
  { label: 'Routing — Wire', value: '026009593' },
  { label: 'SWIFT', value: 'BOFAUS3N' },
  { label: 'Reference', value: 'Hanzo' },
]

function WireForm({ onAdd }: { onAdd: (m: PaymentMethod) => Promise<void> }) {
  const [copyMsg, setCopyMsg] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  const saveWire = React.useCallback(async () => {
    setSaving(true)
    try {
      const method: PaymentMethod = {
        id: `pm_${Math.random().toString(36).slice(2, 12)}`,
        type: 'wire',
        is_default: false,
        isDefault: false,
        created_at: new Date().toISOString(),
        wire: {
          bankName: 'Bank of America',
          accountHolder: 'Hanzo, Inc',
          routingNumber: '026009593',
          swift: 'BOFAUS3N',
          country: 'US',
        },
        billing_details: {},
      }
      await onAdd(method)
    } finally {
      setSaving(false)
    }
  }, [onAdd])

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">
        Send a wire transfer to the account below. Click any field to copy. After sending, click "Confirm wire sent" to save this method.
      </p>

      <div className="space-y-2">
        {BANK_DETAILS.map(({ label, value }) => (
          <button
            key={label}
            type="button"
            onClick={() => copyText(value, label, setCopyMsg)}
            className="w-full rounded-lg border border-border bg-bg p-3 text-left transition hover:border-border-strong group"
          >
            <p className="text-[11px] uppercase tracking-wide text-text-dim">{label}</p>
            <div className="mt-0.5 flex items-center justify-between">
              <p className="text-sm text-text">{value}</p>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-text-dim group-hover:text-text-muted">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {copyMsg && <p className="text-xs text-success">{copyMsg}</p>}

      <button
        type="button"
        disabled={saving}
        onClick={saveWire}
        className="w-full rounded-lg bg-text px-4 py-2.5 text-sm font-medium text-bg transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Confirm wire sent'}
      </button>
    </div>
  )
}
