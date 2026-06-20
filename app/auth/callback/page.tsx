'use client'

import { useEffect, useRef, useState } from 'react'
import { getOrgByHost } from '@/lib/config'
import { makeAuthConf } from '@/lib/auth'
import { handleCallback } from '@/lib/iam-auth'

export default function CallbackPage() {
  const [error, setError] = useState<string | null>(null)
  // Guard against the effect running more than once (StrictMode double-invoke
  // or a re-render) — handleCallback consumes the one-time auth code, so a
  // second run would otherwise fail.
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const org = getOrgByHost(window.location.host)
    const conf = makeAuthConf(org)

    handleCallback(conf)
      .then(() => {
        window.location.href = '/'
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Authentication failed')
      })
  }, [])

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-8">
        <div className="max-w-md rounded-2xl border border-border bg-bg-card p-8 text-center">
          <h1 className="text-lg font-semibold text-text">Authentication Error</h1>
          <p className="mt-3 text-sm text-text-muted">{error}</p>
          <a
            href="/"
            className="mt-6 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition hover:bg-brand-hover"
          >
            Return to billing
          </a>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg">
      <div className="text-center">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-text-dim border-t-brand" />
        <p className="mt-4 text-sm text-text-muted">Completing sign in...</p>
      </div>
    </main>
  )
}
