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

// WalletConnect project ID — resolved at CALL time (not module load) so it picks
// up the runtime config the serving layer injects from KMS as
// `window.__HANZO_CONFIG__.walletConnectProjectId`, regardless of whether that
// runs before or after this module first loads. Falls back to the build-time
// env. Empty → crypto disabled (the UI is gated on getWalletConfig()).
function resolveProjectId(): string {
  return (
    (typeof window !== 'undefined' && (window as any).__HANZO_CONFIG__?.walletConnectProjectId) ||
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
    ''
  )
}

// Lazy-init to avoid crashing the entire app when projectId is not yet configured.
// RainbowKit's getDefaultConfig throws if projectId is empty.
let _walletConfig: ReturnType<typeof getDefaultConfig> | null = null

export function getWalletConfig() {
  if (!_walletConfig) {
    const projectId = resolveProjectId()
    if (!projectId) {
      // Don't memoize on miss — a later call (after KMS config lands) can succeed.
      return null
    }
    _walletConfig = getDefaultConfig({
      appName: 'Hanzo Billing',
      projectId,
      chains: [mainnet, polygon, optimism, arbitrum, base, avalanche, bsc],
      transports: TRANSPORTS,
      ssr: false,
    })
  }
  return _walletConfig
}

// Keep backward compat — null by default to avoid CORS errors from RPC
// endpoints (eth.merkle.io) on page load. Only initialized when user
// explicitly accesses crypto wallet features via getWalletConfig().
export const walletConfig: ReturnType<typeof getDefaultConfig> | null = null
/* Previously eagerly initialized:
export const walletConfig = projectId
  ? getDefaultConfig({
      appName: 'Hanzo Billing',
      projectId,
      chains: [mainnet, polygon, optimism, arbitrum, base, avalanche, bsc],
      ssr: false,
    })
  : null
*/
