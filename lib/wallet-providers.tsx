'use client'

import * as React from 'react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'

import { getWalletConfig } from './wallet-config'
import { WalletReadyProvider } from './wallet-ready'

const queryClient = new QueryClient()

export default function WalletProviders({ children }: { children: React.ReactNode }) {
  // Resolve the wallet config lazily. The exported `walletConfig` constant is
  // permanently null (eager init was disabled to avoid RPC CORS on load), so
  // using it here meant WagmiProvider never mounted even when a WalletConnect
  // projectId WAS configured — and any wagmi hook (CryptoForm) then threw
  // `WagmiProviderNotFoundError`. getWalletConfig() builds the config when a
  // projectId is present and returns null otherwise.
  const walletConfig = getWalletConfig()

  // No projectId → skip wallet providers and render children directly. The
  // crypto payment UI is gated on the same check, so nothing calls wagmi hooks.
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
          {/* Signal to the crypto UI that wagmi hooks / ConnectButton are safe to
              render — they mount ONLY inside this provider subtree. */}
          <WalletReadyProvider value={true}>{children}</WalletReadyProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
