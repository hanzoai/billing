import { Commerce } from './commerce-client'

// A sandbox-built billing UI (NEXT_PUBLIC_SQUARE_ENVIRONMENT !== 'production')
// produces Square Sandbox Web Payments nonces, so every commerce call must
// run in test mode (X-Hanzo-Test: true) to charge the matching sandbox
// processor. One signal — the build's Square environment — drives both the
// SDK (sandbox.web.squarecdn.com) and the backend processor selection.
const TEST_MODE =
  (process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT ?? 'sandbox') !== 'production'

let instance: Commerce | null = null
let viewOrg: string | undefined

/**
 * Set the admin billing-view org. When set, the commerce client sends
 * `?org=<slug>` on every billing call so a GLOBAL admin can inspect another
 * org's billing (EdgeAuth ignores it for non-admins). Pass undefined to clear
 * it (normal users). Threaded once here so all getCommerce() call sites stay
 * unchanged — one way to set the view org.
 */
export function setCommerceViewOrg(org: string | undefined) {
  viewOrg = org
  instance?.setOrg(org)
}

export function getCommerce(commerceUrl: string, token?: string): Commerce {
  if (!instance) {
    instance = new Commerce({ commerceUrl, token, testMode: TEST_MODE, org: viewOrg })
  }
  if (token) {
    instance.setToken(token)
  }
  instance.setOrg(viewOrg)
  return instance
}
