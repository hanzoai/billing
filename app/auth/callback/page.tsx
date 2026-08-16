'use client'

import { useEffect, useRef, useState } from 'react'
import { BASE_PATH, getOrgByHost } from '@/lib/config'
import { makeAuthConf } from '@/lib/auth'
import { handleCallback, startLogin, forgetTokens, resumed } from '@/lib/iam-auth'

// One-shot retry flag — survives the authorize round-trip via sessionStorage so
// a transient first-attempt failure self-heals silently but can never loop.
const RETRY_KEY = 'iam-callback-retry'

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
        sessionStorage.removeItem(RETRY_KEY)
        // Back to the spot sign-in started from — a plan picked before signing
        // in is still the plan afterwards.
        window.location.href = `${BASE_PATH}/${resumed()}`
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Authentication failed'
        // A consumed/stale authorization code or a lost PKCE verifier is a
        // transient first-attempt failure that a fresh authorize round-trip
        // resolves. Recover automatically ONCE (guarded so it cannot loop) by
        // clearing the stale PKCE/token state and restarting sign-in, so the
        // user sees a brief spinner instead of a spurious "Authentication Error".
        const transient = /invalid_grant|authorization code|code[_ ]?verifier|expired/i.test(msg)
        if (transient && !sessionStorage.getItem(RETRY_KEY)) {
          sessionStorage.setItem(RETRY_KEY, '1')
          forgetTokens() // stale token + spent PKCE/state, so the retry starts clean
          startLogin(conf).catch(() => setError(msg))
          return
        }
        sessionStorage.removeItem(RETRY_KEY)
        setError(msg)
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
