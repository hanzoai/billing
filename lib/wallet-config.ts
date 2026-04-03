'use client'

import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import {
  mainnet,
  polygon,
  optimism,
  arbitrum,
  base,
  avalanche,
  bsc,
} from 'wagmi/chains'

// WalletConnect project ID — loaded from runtime config or env
// In multi-tenant/white-label mode, this comes from the KMS config endpoint
const projectId =
  (typeof window !== 'undefined' && (window as any).__HANZO_CONFIG__?.walletConnectProjectId) ||
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  ''

// Lazy-init to avoid crashing the entire app when projectId is not yet configured.
// RainbowKit's getDefaultConfig throws if projectId is empty.
let _walletConfig: ReturnType<typeof getDefaultConfig> | null = null

export function getWalletConfig() {
  if (!_walletConfig) {
    if (!projectId) {
      console.warn('[wallet-config] WalletConnect projectId not set — crypto payments disabled')
      return null
    }
    _walletConfig = getDefaultConfig({
      appName: 'Hanzo Billing',
      projectId,
      chains: [mainnet, polygon, optimism, arbitrum, base, avalanche, bsc],
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
