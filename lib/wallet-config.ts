'use client'

import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http } from 'viem'
import {
  mainnet,
  polygon,
  optimism,
  arbitrum,
  base,
  avalanche,
  bsc,
} from 'wagmi/chains'

import { projectId } from './wallet'

// CORS-enabled public RPCs. wagmi/viem's DEFAULT mainnet transport is
// eth.merkle.io, which does NOT send Access-Control-Allow-Origin, so every
// chain read from the browser fails CORS and wagmi retries in a tight loop
// (the postMessage storm). publicnode.com endpoints are public, free, and
// CORS-enabled, so the reads succeed and the loop stops.
const TRANSPORTS = {
  [mainnet.id]: http('https://ethereum-rpc.publicnode.com'),
  [polygon.id]: http('https://polygon-bor-rpc.publicnode.com'),
  [optimism.id]: http('https://optimism-rpc.publicnode.com'),
  [arbitrum.id]: http('https://arbitrum-one-rpc.publicnode.com'),
  [base.id]: http('https://base-rpc.publicnode.com'),
  [avalanche.id]: http('https://avalanche-c-chain-rpc.publicnode.com'),
  [bsc.id]: http('https://bsc-rpc.publicnode.com'),
}

// Lazy-init to avoid crashing the entire app when projectId is not yet configured.
// RainbowKit's getDefaultConfig throws if projectId is empty.
let _walletConfig: ReturnType<typeof getDefaultConfig> | null = null

export function getWalletConfig() {
  if (!_walletConfig) {
    const id = projectId()
    if (!id) {
      // Don't memoize on miss — a later call (after KMS config lands) can succeed.
      return null
    }
    _walletConfig = getDefaultConfig({
      appName: 'Hanzo Billing',
      projectId: id,
      chains: [mainnet, polygon, optimism, arbitrum, base, avalanche, bsc],
      transports: TRANSPORTS,
      ssr: false,
    })
  }
  return _walletConfig
}
