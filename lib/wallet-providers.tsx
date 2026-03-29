'use client'

import * as React from 'react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'

import { walletConfig } from './wallet-config'

const queryClient = new QueryClient()

export default function WalletProviders({ children }: { children: React.ReactNode }) {
  // If walletConfig is null (no WalletConnect projectId), skip wallet providers
  // and render children directly. Crypto payment features will be unavailable.
  if (!walletConfig) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }

  return (
    <WagmiProvider config={walletConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#ffffff',
            accentColorForeground: '#0a0a0f',
            borderRadius: 'medium',
            overlayBlur: 'small',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
