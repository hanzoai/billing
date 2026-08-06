'use client'

import * as React from 'react'

import { projectId } from './wallet'

// wagmi + RainbowKit are half a megabyte and only the crypto payment UI needs
// them, so they load lazily and only where a WalletConnect id is configured.
const WalletProviders = React.lazy(() => import('./wallet-providers'))

export function Providers({ children }: { children: React.ReactNode }) {
  // Decided ONCE, on first render, and never revisited — because `children`
  // must keep the same position in the tree for their whole life.
  //
  // This used to render them in three places in turn: bare while a `mounted`
  // flag was false, then as a Suspense fallback while the wallet chunk loaded,
  // then inside the provider. React remounts a subtree whose parent changes, so
  // every page mounted three times. Two symptoms, one cause: every billing
  // fetch ran twice, and the in-flight Square card attach was torn down and
  // never retried, which left the top-up form permanently empty and the Pay
  // button permanently disabled — self-service money-in could not complete.
  const [wallet] = React.useState(() => projectId() !== '')

  if (!wallet) return <>{children}</>

  return (
    <React.Suspense fallback={null}>
      <WalletProviders>{children}</WalletProviders>
    </React.Suspense>
  )
}
