'use client'

import { useEffect, useState } from 'react'
import { SubscriptionPortal } from '@/lib/billing/subscription-portal'
import type { Subscription, SubscriptionPlan } from '@/lib/billing/types'
import { fetchPlans } from '@/lib/plans'

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
 * Public pricing page — renders logged-out from the SAME catalog the signed-in
 * grid reads. GET /v1/billing/plans is public (200 unauthenticated, and it returns
 * this origin in access-control-allow-origin), so there is no second catalog and no
 * second set of units. Auth gates only the subscribe action: any plan CTA starts
 * sign-in.
 */
export function PublicPricing({ onSignIn, commerceUrl }: { onSignIn: () => void; commerceUrl: string }) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetchPlans(commerceUrl)
      .then((p) => { if (alive) { setPlans(p); setLoading(false) } })
      // A rejected fetch leaves plans empty; the portal shows an honest catalog
      // error rather than a login wall.
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [commerceUrl])

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-ink/[0.07] px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold tracking-tight text-text">Hanzo</span>
          <span className="text-[13px] text-ink/40">Billing</span>
        </div>
        <button
          type="button"
          onClick={onSignIn}
          className="rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-brand-foreground transition hover:bg-brand-hover"
        >
          Sign in
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-text">Plans &amp; Pricing</h1>
          <p className="mt-2 text-[14px] text-ink/50">
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
