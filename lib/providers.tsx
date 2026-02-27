'use client'

import * as React from 'react'

// Lazy-load wallet providers to avoid SSR issues (indexedDB/localStorage not available during static export)
const WalletProviders = React.lazy(() => import('./wallet-providers'))

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <>{children}</>
  }

  return (
    <React.Suspense fallback={<>{children}</>}>
      <WalletProviders>{children}</WalletProviders>
    </React.Suspense>
  )
}
