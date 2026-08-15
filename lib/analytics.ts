/**
 * The one telemetry client for billing.
 *
 * Created once at module scope so a plain function and a React component reach
 * the SAME client — the provider mounts this instance rather than building its
 * own, which keeps one session, one anonymous id and one batch for the page.
 *
 * The anonymous id is a first-party cookie on `hanzo.ai`, so a visitor who read
 * pricing on the marketing site and lands here is the same person to the funnel.
 * That join is the whole reason this is `@hanzo/event` and not a bare POST: the
 * door refuses a write it cannot attribute (401 `ingest_key_required`), and a
 * write with no identity cannot be joined to the step before it.
 */

import { createAnalytics } from '@hanzo/event'
import { getAccessToken } from './iam-auth'

/** Publishable ingest key: it authorizes a write into one org and reads nothing,
 *  so it is site identity rather than a secret and is declared here rather than
 *  passed as a build arg — a build arg only reaches the lanes that remember it.
 *  An env var still wins when a lane sets one. */
const INGEST_KEY =
  process.env.NEXT_PUBLIC_PUBLISHABLE_KEY || 'pk-CmfLA2K6kvsPflrS9DSkt06H_kSoQB_21sjedt6VJdc'

const EVENT_HOST = process.env.NEXT_PUBLIC_EVENT_URL || 'https://api.hanzo.ai'

export const analytics = createAnalytics({
  product: 'billing',
  host: EVENT_HOST,
  // Signed in → the visitor's own IAM token, so cloud files the event under
  // their org and user. Signed out → the publishable key, which is admission for
  // anonymous traffic and nothing more. Resolved in this order (never as
  // `ingestKey`) so a signed-in buyer is not flattened into the anonymous org.
  //
  // The token lives in localStorage, which a prerender does not have, so the
  // key answers for every non-browser caller rather than throwing at one.
  getToken: () => (typeof window === 'undefined' ? INGEST_KEY : getAccessToken() ?? INGEST_KEY),
})
