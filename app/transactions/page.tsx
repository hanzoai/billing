'use client'

import { useEffect } from 'react'

/**
 * /transactions — thin redirect to billing shell's transactions section.
 */
export default function TransactionsPage() {
  useEffect(() => {
    window.location.replace('/#transactions')
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b]">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-white/50" />
    </main>
  )
}
