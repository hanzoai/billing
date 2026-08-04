'use client'

import { useEffect } from 'react'

import { BASE_PATH } from '@/lib/config'

/**
 * /payment-methods — thin redirect to the billing shell's payment section.
 *
 * The app uses a static export with hash-based routing inside BillingShell.
 * This page simply redirects to /#payment so deep-links work correctly.
 */
export default function PaymentMethodsPage() {
  useEffect(() => {
    window.location.replace(`${BASE_PATH}/#payment`)
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink/10 border-t-ink/50" />
    </main>
  )
}
