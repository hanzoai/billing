'use client'

/**
 * The WalletConnect project id, and nothing else.
 *
 * Its own module because two callers need this one fact and only one of them
 * can afford the dependencies. `wallet-config` builds the RainbowKit config, so
 * it pulls in wagmi and RainbowKit — half a megabyte. `providers` only needs to
 * know whether a wallet stack should mount at all, and asking the config would
 * drag that bundle into the first paint of every page.
 *
 * Resolved at CALL time so it picks up the value the serving layer injects from
 * KMS as `window.__HANZO_CONFIG__.walletConnectProjectId`, whenever that lands
 * relative to this module's load. Empty means crypto is off.
 */
export function projectId(): string {
  const runtime =
    typeof window !== 'undefined'
      ? (window as { __HANZO_CONFIG__?: { walletConnectProjectId?: string } })
          .__HANZO_CONFIG__?.walletConnectProjectId
      : undefined
  return runtime || process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''
}
