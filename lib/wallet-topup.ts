/**
 * HUSD wallet top-up — the canonical "send → verify → record → credit" recipe.
 *
 * billing.hanzo.ai is a Next static export, so this is a CLIENT module (no server
 * route): the user sends HUSD from their own wallet, we verify the transfer
 * on-chain (viem, billing's web3 lib), then record it to commerce as a `husd`
 * crypto payment via the existing commerce client — the commerce backend is the
 * authoritative recorder (we never edit it). The amount credited is read FROM the
 * on-chain transfer, never a client-supplied number. The same verify-and-record
 * logic runs server-side in console2's `/billing/topup/wallet` route for the
 * console flow; this is its static-export counterpart.
 *
 * HUSD on Hanzo Mainnet is greenfield (no contract deployed yet). Addresses are
 * PUBLIC on-chain data, supplied via `NEXT_PUBLIC_HANZO_HUSD_*`; when unset, the
 * helpers throw an honest "not available yet" error so the UI shows a truthful
 * "coming" state and never fabricates a credit.
 */
'use client'

import {
  createPublicClient,
  createWalletClient,
  custom,
  decodeEventLog,
  defineChain,
  formatUnits,
  getAddress,
  http,
  parseAbiItem,
  parseUnits,
  type Hex,
} from 'viem'

import { getCommerce } from './commerce'

// ── Config (public) ──────────────────────────────────────────────────────────

const RPC_URL = (process.env.NEXT_PUBLIC_HANZO_RPC_URL ?? 'https://rpc.hanzo.ai').replace(/\/+$/, '')
export const HUSD_ADDRESS = (process.env.NEXT_PUBLIC_HANZO_HUSD_ADDRESS ?? '').trim()
export const HUSD_TREASURY = (process.env.NEXT_PUBLIC_HANZO_HUSD_TREASURY ?? '').trim()
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/

/** Hanzo Mainnet — canonical chain (id 36963, the AI EVM); RPC is env-overridable. */
export const hanzoMainnet = defineChain({
  id: 36963,
  name: 'Hanzo Mainnet',
  nativeCurrency: { name: 'AI Token', symbol: 'AI', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: 'Hanzo Explorer', url: 'https://explorer.hanzo.ai' } },
})

/** HUSD ERC-20: 18-decimal, USD-pegged (1 HUSD = $1 = 100 cents). */
const HUSD_DECIMALS = 18
const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
const ERC20_TRANSFER_ABI = [
  parseAbiItem('function transfer(address to, uint256 value) returns (bool)'),
] as const

/** True when HUSD is deployed (an address is configured). */
export const husdConfigured = (): boolean => ADDR_RE.test(HUSD_ADDRESS)
/** True when HUSD + a treasury are set, so top-ups can be sent and recorded. */
export const topupConfigured = (): boolean => husdConfigured() && ADDR_RE.test(HUSD_TREASURY)

// ── Send (the user's wallet signs) ───────────────────────────────────────────

function injected(): { request: (a: unknown) => Promise<unknown> } | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { ethereum?: { request: (a: unknown) => Promise<unknown> } }).ethereum ?? null
}

export type Sent = { txHash: string; fromAddress: string }

/**
 * Send an HUSD top-up from the connected wallet to the treasury. Selects Hanzo
 * Mainnet (adds it if unknown) and returns the tx hash + sender. Throws clearly
 * when HUSD is unconfigured or no wallet is present.
 */
export async function sendHusdTopup(amount: string): Promise<Sent> {
  if (!topupConfigured()) throw new Error('HUSD top-up is not available yet on Hanzo Mainnet.')
  const eth = injected()
  if (!eth) throw new Error('No browser wallet detected. Install MetaMask or a compatible wallet.')

  const wallet = createWalletClient({ chain: hanzoMainnet, transport: custom(eth) })
  const [account] = await wallet.requestAddresses()
  if (!account) throw new Error('No account authorized.')
  try {
    await wallet.switchChain({ id: hanzoMainnet.id })
  } catch {
    await wallet.addChain({ chain: hanzoMainnet })
  }

  const txHash = await wallet.writeContract({
    account,
    chain: hanzoMainnet,
    address: getAddress(HUSD_ADDRESS),
    abi: ERC20_TRANSFER_ABI,
    functionName: 'transfer',
    args: [getAddress(HUSD_TREASURY), parseUnits(amount.trim(), HUSD_DECIMALS)],
  })
  return { txHash, fromAddress: getAddress(account) }
}

// ── Verify on-chain ──────────────────────────────────────────────────────────

/**
 * Verify an HUSD transfer to the treasury and return the USD cents it represents.
 * Throws when HUSD is unconfigured, the tx is missing/failed, or no matching
 * HUSD-to-treasury transfer is present.
 */
export async function verifyHusdTransfer(txHash: string, fromAddress?: string): Promise<number> {
  if (!topupConfigured()) throw new Error('HUSD top-up is not available yet on Hanzo Mainnet.')
  const client = createPublicClient({ chain: hanzoMainnet, transport: http(RPC_URL) })
  const receipt = await client.getTransactionReceipt({ hash: txHash as Hex })
  if (receipt.status !== 'success') throw new Error('Transaction failed on-chain.')

  const husd = getAddress(HUSD_ADDRESS)
  const treasury = getAddress(HUSD_TREASURY)
  let value: bigint | null = null
  let from: string | null = null
  for (const log of receipt.logs) {
    if (getAddress(log.address) !== husd) continue
    try {
      const ev = decodeEventLog({ abi: [TRANSFER_EVENT], data: log.data, topics: log.topics })
      if (ev.eventName === 'Transfer' && getAddress(ev.args.to) === treasury) {
        value = ev.args.value
        from = getAddress(ev.args.from)
        break
      }
    } catch {
      /* not a Transfer log */
    }
  }
  if (value === null) throw new Error('No HUSD transfer to the treasury was found in this transaction.')
  if (fromAddress && ADDR_RE.test(fromAddress) && getAddress(fromAddress) !== from) {
    throw new Error('Transfer sender does not match the connected wallet.')
  }
  // HUSD is 18-decimal, USD-pegged → value / 1e16 = cents (floored).
  const cents = Math.floor(Number(formatUnits(value, 16)))
  if (cents <= 0) throw new Error('Transferred amount is below the minimum (1 cent).')
  return cents
}

// ── Record + credit (commerce is the authoritative recorder) ──────────────────

export type RecordParams = {
  commerceUrl: string
  token?: string
  userId?: string
  txHash: string
  fromAddress: string
}

/**
 * Verify the HUSD transfer, record it to commerce as a `husd` crypto payment, and
 * return the new balance in cents. The credited amount is the verified on-chain
 * value.
 */
export async function recordHusdTopup(params: RecordParams): Promise<{ creditedCents: number; balanceCents: number }> {
  const creditedCents = await verifyHusdTransfer(params.txHash, params.fromAddress)
  const commerce = getCommerce(params.commerceUrl, params.token)
  const payment = await commerce.recordCryptoPayment(
    {
      txHash: params.txHash,
      network: 'hanzo',
      chainId: hanzoMainnet.id,
      amount: creditedCents,
      currency: 'husd',
      userId: params.userId || undefined,
      fromAddress: params.fromAddress,
      toAddress: getAddress(HUSD_TREASURY),
    },
    params.token,
  )
  if (payment.status === 'failed' || payment.status === 'cancelled') {
    throw new Error('Commerce did not accept the payment. Check the transaction and retry.')
  }
  const bal = await commerce.getBalance(params.userId || params.fromAddress, 'usd', params.token)
  return { creditedCents, balanceCents: bal.balance }
}
