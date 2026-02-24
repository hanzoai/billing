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

  useEffect(() => {
    const detectedOrg = getOrgByHost(window.location.host)
    setOrg(detectedOrg)

    if (isLoggedIn()) {
      setUser(getCurrentUser())
      setChecked(true)
    } else {
      setChecked(true)
      startLogin(makeAuthConf(detectedOrg))
    }
  }, [])

  if (!org || !checked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-text-dim border-t-brand" />
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
