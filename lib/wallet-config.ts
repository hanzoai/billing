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
