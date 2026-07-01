'use client'

import * as React from 'react'

/**
 * Signals whether the wagmi + RainbowKit providers are actually MOUNTED.
 *
 * This is intentionally a tiny, dependency-free module (no wagmi/RainbowKit
 * imports) so it can be consumed by the crypto UI WITHOUT eagerly pulling the
 * heavy wallet bundle — `wallet-providers.tsx` is React.lazy'd, and importing a
 * named export from it would defeat that. `wallet-providers.tsx` sets this to
 * `true` only inside the mounted `WagmiProvider`/`RainbowKitProvider` subtree.
 *
 * Consumers (e.g. the Crypto payment tab) gate their wagmi hooks / RainbowKit
 * `ConnectButton` on this so they never render before the provider exists — the
 * race that surfaced as `WagmiProviderNotFoundError` / a stray `DialogClose`
 * crash on a refresh of the crypto flow.
 */
const WalletReadyContext = React.createContext(false)

export const WalletReadyProvider = WalletReadyContext.Provider

/** True only when the wagmi + RainbowKit providers are mounted above the caller. */
export function useWalletReady(): boolean {
  return React.useContext(WalletReadyContext)
}
