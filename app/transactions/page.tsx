'use client'

import { useEffect } from 'react'

import { BASE_PATH } from '@/lib/config'

/**
 * /transactions — thin redirect to billing shell's transactions section.
 */
export default function TransactionsPage() {
  useEffect(() => {
    window.location.replace(`${BASE_PATH}/#transactions`)
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink/10 border-t-ink/50" />
    </main>
  )
}
