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

export const walletConfig = getDefaultConfig({
  appName: 'Hanzo Billing',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'hanzo-billing',
  chains: [mainnet, polygon, optimism, arbitrum, base, avalanche, bsc],
  ssr: false,
})
