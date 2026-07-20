'use client'

import { useEffect, useState } from 'react'
import { SubscriptionPortal } from '@/lib/billing/subscription-portal'
import type { Subscription, SubscriptionPlan } from '@/lib/billing/types'
import { fetchPublicPlans } from '@/lib/plans'

// Logged-out prospect has no subscription — an empty one so the grid renders
// every plan as available.
const NO_SUBSCRIPTION: Subscription = {
  id: '',
  customerId: '',
  planId: '',
  status: 'active',
  currentPeriodStart: new Date(),
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
}

/**
 * Public pricing page — renders logged-out with prices from the public catalog.
 * Auth gates only the subscribe action: any plan CTA starts sign-in.
 */
export function PublicPricing({ onSignIn }: { onSignIn: () => void }) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetchPublicPlans()
      .then((p) => { if (alive) { setPlans(p); setLoading(false) } })
      // A rejected fetch leaves plans empty; the portal shows an honest catalog
      // error rather than a login wall.
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  return (
    <div className="min-h-screen bg-[#09090b]">
      <header className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold tracking-tight text-white">Hanzo</span>
          <span className="text-[13px] text-white/40">Billing</span>
        </div>
        <button
          type="button"
          onClick={onSignIn}
          className="rounded-lg bg-white px-4 py-2 text-[13px] font-semibold text-black transition hover:bg-white/90"
        >
          Sign in
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white">Plans &amp; Pricing</h1>
          <p className="mt-2 text-[14px] text-white/50">
            Pick a plan to get started. Sign in to subscribe.
          </p>
        </div>

        <SubscriptionPortal
          subscription={NO_SUBSCRIPTION}
          availablePlans={plans}
          plansLoading={loading}
          defaultView="plans"
          onRequireAuth={onSignIn}
        />
      </main>
    </div>
  )
}
