'use client'

import { useState, useEffect } from 'react'
import { getOrgByHost, type BillingOrgConfig } from '@/lib/config'
import { isLoggedIn, startLogin, getCurrentUser, type IamUser } from '@/lib/iam-auth'
import { makeAuthConf } from '@/lib/auth'
import { BillingShell } from '@/lib/components/billing-shell'

export default function BillingPage() {
  const [org, setOrg] = useState<BillingOrgConfig | null>(null)
  const [user, setUser] = useState<IamUser | null>(null)
  const [checked, setChecked] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    const detectedOrg = getOrgByHost(window.location.host)
    setOrg(detectedOrg)

    if (isLoggedIn()) {
      setUser(getCurrentUser())
      setChecked(true)
    } else {
      setChecked(true)
      // Surface a sign-in failure instead of hanging on the spinner forever.
      startLogin(makeAuthConf(detectedOrg)).catch((err) => {
        setAuthError(err instanceof Error ? err.message : 'Could not start sign in')
      })
    }
  }, [])

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
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <div className="text-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-text-dim border-t-brand" />
          <p className="mt-4 text-sm text-text-muted">Redirecting to sign in...</p>
        </div>
      </main>
    )
  }

  return <BillingShell org={org} user={user} />
}
