/**
 * Funnel telemetry — the single seam the pricing funnel emits through.
 *
 * One best-effort POST to the native event door (`POST /v1/event`, the Hanzo
 * Cloud event stream that `@hanzo/event` targets), with the canonical `upgrade`
 * funnel names so the existing funnel lights up: `plan_clicked` when a plan is
 * chosen, `checkout_started` when the buyer reaches payment. Pricing views and
 * the settled-payment `order_completed` are emitted elsewhere (the app page-view
 * seam and commerce server-side) — never from here, or they double-count.
 *
 * It never throws and never blocks a click. A money path must not wait on, nor
 * fail for, telemetry — so the call is fire-and-forget, sent with sendBeacon so
 * it survives the navigation to the Pay checkout, and every error is swallowed.
 * The body goes as text/plain to stay a CORS-simple request (no preflight); the
 * collector decodes the JSON regardless of content-type.
 */

const EVENT_URL =
  (process.env.NEXT_PUBLIC_EVENT_URL ?? 'https://api.hanzo.ai').replace(/\/+$/, '') + '/v1/event'

/** The two funnel steps the pricing grid owns, from the canonical taxonomy. */
export type FunnelEvent = 'plan_clicked' | 'checkout_started'

/** Emit one funnel event to the native bus. Fire-and-forget; failures are swallowed. */
export function track(event: FunnelEvent, properties: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return
  try {
    const body = JSON.stringify({ event, type: 'event', properties, time: new Date().toISOString() })
    const blob = new Blob([body], { type: 'text/plain' })
    if (navigator.sendBeacon?.(EVENT_URL, blob)) return
    void fetch(EVENT_URL, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body,
      keepalive: true,
      credentials: 'omit',
    }).catch(() => {})
  } catch {
    // Telemetry is never allowed to interrupt the funnel.
  }
}
