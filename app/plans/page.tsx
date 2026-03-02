'use client'

import { useEffect } from 'react'

/**
 * /plans — thin redirect to billing shell's pricing section.
 */
export default function PlansPage() {
  useEffect(() => {
    window.location.replace('/#pricing')
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b]">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-white/50" />
    </main>
  )
}
