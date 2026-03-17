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

export const walletConfig = getDefaultConfig({
  appName: 'Hanzo Billing',
  projectId,
  chains: [mainnet, polygon, optimism, arbitrum, base, avalanche, bsc],
  ssr: false,
})
