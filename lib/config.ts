// Same deploy-shape selection as next.config.ts: embedded build serves under
// /admin/billing, standalone (billing.hanzo.ai) builds with NEXT_PUBLIC_BASE_PATH="".
// Raw <a href> / window.location targets must carry it themselves.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/admin/billing'

/**
 * Where commerce answers — ONE spelling, because the money-in surfaces must all
 * ask the same deployment. It matters most for the card form: `lib/square.ts`
 * reads the org's Square application from here and the charge is sent here, so
 * two addresses would be two Square accounts and a nonce minted for the wrong one.
 */
export const COMMERCE_URL = process.env.NEXT_PUBLIC_COMMERCE_URL ?? 'https://api.hanzo.ai'

/**
 * Where a tier that is sold by a person sends the buyer — OUR calendar.
 *
 * ONE address, because it was written in two files and a third surface linked
 * somewhere else entirely, so "talk to sales" meant three destinations.
 *
 * It pointed at cal.com, a hosted product we do not run, while cal.hanzo.ai is
 * live and books end to end: an Intro event with real slots, a name/email form,
 * and POST /v1/calendar/bookings behind it.
 *
 * The ROOT, deliberately. cal.hanzo.ai routes only `/`, `/booking/:uid` and
 * `/:owner/:slug` with no catch-all, so the two URLs anyone would guess —
 * /hanzo and /sales — render a blank page. `/` and `/hanzo/intro` are the two
 * that work, and the root is the one that survives the event being renamed.
 */
export const SALES_URL = 'https://cal.hanzo.ai/'

export interface BillingOrgConfig {
  id: string
  displayName: string
  iamServerUrl: string
  iamClientId: string
  commerceUrl: string
  /**
   * The branded Pay checkout (pay.<brand>) — the ONE place a card is entered.
   * Picking a plan with no card on file deep-links here:
   * `<payUrl>/confirm/card?plan=<slug>`, which carries IAM sign-in through to the
   * card form and starts the subscription. Same host the IAM `payUrl` names.
   */
  payUrl: string
  logo: string
  theme: {
    brand: string
    brandHover: string
  }
}

const hanzo: BillingOrgConfig = {
  id: 'hanzo',
  displayName: 'Hanzo',
  iamServerUrl: 'https://hanzo.id',
  iamClientId: 'hanzo-billing',
  commerceUrl: 'https://api.hanzo.ai',
  payUrl: 'https://pay.hanzo.ai',
  logo: '/logos/hanzo.svg',
  theme: {
    brand: '#ffffff',
    brandHover: '#d4d4d4',
  },
}

const lux: BillingOrgConfig = {
  id: 'lux',
  displayName: 'Lux',
  iamServerUrl: 'https://lux.id',
  iamClientId: 'lux-billing',
  commerceUrl: 'https://api.hanzo.ai',
  payUrl: 'https://pay.lux.cloud',
  logo: '/logos/lux.svg',
  theme: {
    brand: '#6366f1',
    brandHover: '#4f46e5',
  },
}

const zoo: BillingOrgConfig = {
  id: 'zoo',
  displayName: 'Zoo',
  iamServerUrl: 'https://zoolabs.id',
  iamClientId: 'zoo-billing',
  commerceUrl: 'https://api.hanzo.ai',
  payUrl: 'https://pay.zoo.cloud',
  logo: '/logos/zoo.svg',
  theme: {
    brand: '#22c55e',
    brandHover: '#16a34a',
  },
}

const pars: BillingOrgConfig = {
  id: 'pars',
  displayName: 'Pars',
  iamServerUrl: 'https://pars.id',
  iamClientId: 'pars-billing',
  commerceUrl: 'https://api.hanzo.ai',
  // Pars has no branded Pay host yet; the shared checkout serves it until it does.
  payUrl: 'https://pay.hanzo.ai',
  logo: '/logos/pars.svg',
  theme: {
    brand: '#f59e0b',
    brandHover: '#d97706',
  },
}

const organizations: Record<string, BillingOrgConfig> = { hanzo, lux, zoo, pars }

export function getOrgByHost(host: string): BillingOrgConfig {
  if (host.includes('lux')) return lux
  if (host.includes('zoo')) return zoo
  if (host.includes('pars')) return pars
  return hanzo
}

/**
 * Plan copy lives in ONE place: the commerce catalog (GET /v1/billing/plans,
 * projected from @hanzo/plans/subscription.json). The SPA fetches it at
 * runtime and renders a skeleton until it arrives — no local plan table.
 */
