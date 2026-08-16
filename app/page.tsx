'use client'

import { useState, useEffect, useCallback } from 'react'
import { getOrgByHost, type BillingOrgConfig } from '@/lib/config'
import { isLoggedIn, startLogin, getCurrentUser, type IamUser } from '@/lib/iam-auth'
import { makeAuthConf } from '@/lib/auth'
import { BillingShell } from '@/lib/components/billing-shell'
import { PublicPricing } from '@/lib/components/public-pricing'

export default function BillingPage() {
  const [org, setOrg] = useState<BillingOrgConfig | null>(null)
  const [user, setUser] = useState<IamUser | null>(null)
  const [checked, setChecked] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  // The plan the buyer already picked, from `/?plan=pro#pricing` — the shape
  // every "Get started" on the marketing site links to. Read from the URL
  // because this is a static export: there is no server to hand it over.
  const [chosen, setChosen] = useState<string | undefined>()

  useEffect(() => {
    const detectedOrg = getOrgByHost(window.location.host)
    setOrg(detectedOrg)
    setChosen(new URLSearchParams(window.location.search).get('plan') ?? undefined)
    // Do NOT auto-redirect to login: logged-out prospects see public pricing
    // (no login wall). Auth gates only the subscribe action.
    if (isLoggedIn()) setUser(getCurrentUser())
    setChecked(true)
  }, [])

  const handleSignIn = useCallback(() => {
    if (!org) return
    // Sign in and come back to the same spot, plan included — the round trip
    // lands on this one page, so the query and hash are the whole destination.
    startLogin(makeAuthConf(org), window.location.search + window.location.hash).catch((err) => {
      setAuthError(err instanceof Error ? err.message : 'Could not start sign in')
    })
  }, [org])

  if (!org || !checked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-text-dim border-t-brand" />
      </main>
    )
  }

  if (authError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-8">
        <div className="max-w-md rounded-2xl border border-border bg-bg-card p-8 text-center">
          <h1 className="text-lg font-semibold text-text">Sign-in unavailable</h1>
          <p className="mt-3 text-sm text-text-muted">{authError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition hover:bg-brand-hover"
          >
            Try again
          </button>
        </div>
      </main>
    )
  }

  if (!user) {
    return <PublicPricing onSignIn={handleSignIn} commerceUrl={org.commerceUrl} checkoutUrl={org.payUrl} chosen={chosen} />
  }

  return <BillingShell org={org} user={user} chosen={chosen} />
}
