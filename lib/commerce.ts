import { Commerce } from './commerce-client'

// A sandbox-built billing UI (NEXT_PUBLIC_SQUARE_ENVIRONMENT !== 'production')
// produces Square Sandbox Web Payments nonces, so every commerce call must
// run in test mode (X-Hanzo-Test: true) to charge the matching sandbox
// processor. One signal — the build's Square environment — drives both the
// SDK (sandbox.web.squarecdn.com) and the backend processor selection.
const TEST_MODE =
  (process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT ?? 'sandbox') !== 'production'

let instance: Commerce | null = null

export function getCommerce(commerceUrl: string, token?: string): Commerce {
  if (!instance) {
    instance = new Commerce({ commerceUrl, token, testMode: TEST_MODE })
  }
  if (token) {
    instance.setToken(token)
  }
  return instance
}
