'use client'

import { useState, useEffect } from 'react'
import { AuthServiceProvider } from '@hanzo/auth'
import { getOrgByHost, type BillingOrgConfig } from '@/lib/config'
import { makeAuthConf } from '@/lib/auth'
import { BillingShell } from '@/lib/components/billing-shell'

export default function BillingPage() {
  const [org, setOrg] = useState<BillingOrgConfig | null>(null)

  useEffect(() => {
    setOrg(getOrgByHost(window.location.host))
  }, [])

  if (!org) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-text-dim border-t-brand" />
      </main>
    )
  }

  const authConf = makeAuthConf(org)

  return (
    <AuthServiceProvider conf={authConf} user={null}>
      <BillingShell org={org} />
    </AuthServiceProvider>
  )
}
