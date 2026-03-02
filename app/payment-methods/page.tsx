'use client'

import { useEffect } from 'react'

/**
 * /payment-methods — thin redirect to the billing shell's payment section.
 *
 * The app uses a static export with hash-based routing inside BillingShell.
 * This page simply redirects to /#payment so deep-links work correctly.
 */
export default function PaymentMethodsPage() {
  useEffect(() => {
    window.location.replace('/#payment')
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b]">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-white/50" />
    </main>
  )
}
