/**
 * Minimal IAM auth module for the billing portal.
 *
 * Handles OIDC/PKCE login via Hanzo IAM (hanzo.id) and token storage.
 * Uses Hanzo IAM endpoints (proven compatible with hanzo.id).
 * Self-contained — no external auth package dependency.
 */

const KEY_PREFIX = 'hanzo_billing_'
const KEY_ACCESS_TOKEN = `${KEY_PREFIX}access_token`
const KEY_REFRESH_TOKEN = `${KEY_PREFIX}refresh_token`
const KEY_EXPIRES_AT = `${KEY_PREFIX}expires_at`
const KEY_CODE_VERIFIER = `${KEY_PREFIX}code_verifier`
const KEY_STATE = `${KEY_PREFIX}state`
const KEY_RESUME = `${KEY_PREFIX}resume`

/**
 * Where sign-in resumes, read once and consumed.
 *
 * Only a query and hash are ever kept — never a path and never a host. The whole
 * app is one page, so the suffix IS the destination, and a stored value that
 * does not begin with `?` or `#` cannot name somewhere else to land.
 */
export function resumed(): string {
  const at = localStorage.getItem(KEY_RESUME)
  localStorage.removeItem(KEY_RESUME)
  return at && /^[?#]/.test(at) ? at : ''
}

export interface IamUser {
  email: string
  displayName: string | null
  avatar: string | null
  sub: string
  /**
   * Commerce billing subject = the lowercased ORG SLUG (the `owner` claim,
   * e.g. "hanzo"). Commerce keys per-org billing (balance, payment methods,
   * subscriptions, invoices) on this slug — NOT owner/name. See the note in
   * userFromToken().
   */
  commerceUserId: string
  /**
   * The IAM org this identity belongs to — the `owner` claim, verbatim.
   *
   * Kept apart from commerceUserId even though both read that claim today: one is
   * "whose money is this", the other is "which org are you a member of", and the
   * second must have NO fallback. commerceUserId falls back to `sub` so a billing
   * read still has a subject; letting a privilege test do that would make an
   * identity with no owner claim look like a member of whatever org sub happened to
   * spell.
   */
  owner: string
}

export interface IamAuthConfig {
  iamServerUrl: string
  clientId: string
  redirectUri: string
  orgName: string
  appName: string
}

function generateRandom(length: number): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, length)
}

async function sha256(message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  return crypto.subtle.digest('SHA-256', encoder.encode(message))
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Token endpoint response (the subset this client consumes). */
interface TokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
}

/**
 * fetch + parse JSON with a precise failure mode. Verifies the response status
 * and content-type before parsing, so a misrouted endpoint that returns an HTML
 * page (e.g. the IAM SPA catch-all: HTTP 200, text/html) surfaces as a clear
 * error with the upstream status and a body snippet — never the cryptic
 * `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` from JSON.parse.
 */
async function fetchJson<T>(url: string, init: RequestInit, label: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    throw new Error(`${label}: could not reach ${url} (${reason})`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  const raw = await res.text()

  let parsed: unknown
  if (contentType.includes('json')) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = undefined
    }
  }

  if (!res.ok) {
    const err = parsed as { error?: string; error_description?: string } | undefined
    const detail = err?.error_description || err?.error || bodySnippet(raw)
    throw new Error(`${label} failed (HTTP ${res.status}): ${detail}`)
  }
  if (parsed === undefined) {
    throw new Error(
      `${label} returned ${contentType || 'an unknown content-type'} instead of JSON ` +
        `(HTTP ${res.status}): ${bodySnippet(raw)}`,
    )
  }
  return parsed as T
}

/** Single-line, length-capped snippet of an (often HTML) response body. */
function bodySnippet(body: string): string {
  const collapsed = body.replace(/\s+/g, ' ').trim()
  return collapsed.length > 160 ? `${collapsed.slice(0, 160)}…` : collapsed
}

/** Check if user is logged in (has valid token). */
export function isLoggedIn(): boolean {
  const token = localStorage.getItem(KEY_ACCESS_TOKEN)
  const expiresAt = localStorage.getItem(KEY_EXPIRES_AT)
  if (!token) return false
  if (expiresAt && Date.now() > Number(expiresAt)) return false
  return true
}

/** Get the current access token. */
export function getAccessToken(): string | null {
  if (!isLoggedIn()) return null
  return localStorage.getItem(KEY_ACCESS_TOKEN)
}

/** Parse the JWT payload to extract user info. */
export function getCurrentUser(): IamUser | null {
  const token = getAccessToken()
  if (!token) return null
  try {
    // JWT uses base64url encoding — convert to standard base64 for atob()
    let b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    const payload = JSON.parse(atob(b64))
    // Commerce keys per-org billing on the lowercased ORG SLUG (the `owner`
    // claim, e.g. "hanzo") — NOT owner/name. commerce-api's EdgeAuth
    // (COMMERCE_EDGE_AUTH) locks every /billing read's subject param
    // (user/userId/customerId) to the caller's lowercased owner slug, and
    // usage + balances are keyed the same way ("iam-user/<owner>"). Sending
    // owner/name ("hanzo/z") stored payment methods under "hanzo/z" (POST body
    // params are not locked) but read them under "hanzo" (GET query params
    // are) — so the list always came back empty. Mirror EdgeAuth exactly: use
    // the lowercased owner slug as the billing subject everywhere.
    const commerceUserId =
      payload.owner ? String(payload.owner).trim().toLowerCase() : (payload.sub ?? '')
    return {
      email: payload.email ?? payload.name ?? '',
      displayName: payload.displayName ?? payload.name ?? null,
      avatar: payload.avatar ?? null,
      sub: payload.sub ?? payload.name ?? '',
      commerceUserId,
      owner: payload.owner ? String(payload.owner).trim().toLowerCase() : '',
    }
  } catch {
    return null
  }
}

/**
 * Whether this identity is a Hanzo platform SuperAdmin.
 *
 * ONE PREDICATE: membership of the reserved `admin` org, which is the same fact
 * commerce's own gate (middleware.MayMintMoney) decides on. This used to be a
 * hardcoded list of three email addresses compiled into the bundle — a second
 * predicate for platform privilege, keyed on a string, where adding or removing a
 * platform admin meant rebuilding and redeploying a front end.
 *
 * It decides what the UI OFFERS, never what is allowed: the mint-gated doors this
 * unlocks (direct subscribe, grant credit) are enforced server-side regardless, so
 * this being wrong shows the wrong buttons rather than granting anything.
 */
export function isSuperAdmin(user: IamUser): boolean {
  return user.owner === 'admin'
}

/**
 * Start OIDC/PKCE login flow — redirects to Hanzo IAM login page.
 *
 * `resume` is the query and hash to come back to, so a buyer signing in from
 * `/?plan=pro#pricing` still has that plan afterwards. It is remembered here
 * rather than sent to IAM: the authorize URL is a public place, and where
 * someone was standing is nobody else's business. Passing nothing keeps what is
 * already remembered, which is what a retry of an interrupted sign-in wants.
 */
export async function startLogin(config: IamAuthConfig, resume?: string): Promise<void> {
  const state = generateRandom(32)
  const codeVerifier = generateRandom(64)
  const challengeBuffer = await sha256(codeVerifier)
  const codeChallenge = base64UrlEncode(challengeBuffer)

  localStorage.setItem(KEY_STATE, state)
  localStorage.setItem(KEY_CODE_VERIFIER, codeVerifier)
  if (resume) localStorage.setItem(KEY_RESUME, resume)

  const base = config.iamServerUrl.replace(/\/+$/, '')
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    scope: 'openid profile email',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  // Canonical IAM authorize endpoint (HIP-0111). The bare /oauth/* paths hit the
  // IAM SPA catch-all (200 text/html), which breaks the JSON token exchange.
  window.location.href = `${base}/v1/iam/oauth/authorize?${params}`
}

/** Handle the OAuth callback — exchange code for tokens or accept implicit grant. */
export async function handleCallback(config: IamAuthConfig): Promise<IamUser | null> {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  // Also check for implicit grant tokens (access_token in query or hash)
  const implicitToken =
    url.searchParams.get('access_token') ||
    new URLSearchParams(url.hash.replace(/^#/, '')).get('access_token')

  if (error) {
    const desc = url.searchParams.get('error_description') ?? error
    throw new Error(`OAuth error: ${desc}`)
  }

  // Implicit flow: IAM returned access_token directly
  if (implicitToken && !code) {
    const expiresIn = Number(url.searchParams.get('expires_in') ?? '3600')
    localStorage.setItem(KEY_ACCESS_TOKEN, implicitToken)
    localStorage.setItem(KEY_EXPIRES_AT, String(Date.now() + expiresIn * 1000))
    localStorage.removeItem(KEY_STATE)
    localStorage.removeItem(KEY_CODE_VERIFIER)
    return getCurrentUser()
  }

  if (!code) throw new Error('No authorization code in callback')

  // PKCE (code_verifier) is the primary CSRF protection here; the `state` param
  // is only a secondary check. Do NOT hard-fail on a state mismatch — a callback
  // re-run or a repeated login overwrites localStorage and must not lock the
  // user out. Require the verifier (needed for the exchange) and only warn on a
  // state mismatch. State/verifier are cleared after a successful exchange
  // (below), so a benign re-run still works.
  const codeVerifier = localStorage.getItem(KEY_CODE_VERIFIER)
  if (!codeVerifier) throw new Error('Missing code verifier — please start sign in again')

  const savedState = localStorage.getItem(KEY_STATE)
  if (savedState && state && savedState !== state) {
    console.warn('OAuth state mismatch — continuing (PKCE protects the exchange)')
  }

  // Exchange code for tokens via the canonical IAM token endpoint (HIP-0111).
  // fetchJson verifies status + content-type before parsing, so a misrouted
  // endpoint (the SPA catch-all returns HTTP 200 text/html) surfaces as a clear
  // error instead of an "Unexpected token '<'" JSON.parse crash on an HTML page.
  const base = config.iamServerUrl.replace(/\/+$/, '')
  const data = await fetchJson<TokenResponse>(
    `${base}/v1/iam/oauth/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        code,
        redirect_uri: config.redirectUri,
        code_verifier: codeVerifier,
      }),
    },
    'IAM token exchange',
  )

  const accessToken = data.access_token
  const refreshToken = data.refresh_token
  const expiresIn = data.expires_in ?? 3600

  if (!accessToken) throw new Error('No access token received')

  // Store tokens
  localStorage.setItem(KEY_ACCESS_TOKEN, accessToken)
  if (refreshToken) localStorage.setItem(KEY_REFRESH_TOKEN, refreshToken)
  localStorage.setItem(KEY_EXPIRES_AT, String(Date.now() + expiresIn * 1000))

  // Exchange succeeded — now clear the one-time PKCE/state values.
  localStorage.removeItem(KEY_STATE)
  localStorage.removeItem(KEY_CODE_VERIFIER)

  return getCurrentUser()
}

/** Clear all stored tokens. */
/**
 * End the session — in this browser AND at IAM. Returns the URL to navigate to.
 *
 * Clearing this tab's tokens is only half of a sign-out, and the missing half is the
 * half that matters. The IAM session cookie survives it, so the next startLogin()
 * re-authenticates silently through /v1/iam/oauth/authorize and the customer lands
 * straight back in the account they just left — which on a shared machine means
 * whoever sits down next lands there too. It looked like it worked, which is why it
 * lasted.
 *
 * Named signOut rather than logout for the reason the id SDK names: logout only
 * builds the IdP URL, and a function called that invites a caller to think the local
 * keys are gone. This does both, in that order.
 */
export function signOut(iamServerUrl: string, postLogoutRedirectUri: string): string {
  forgetTokens()
  const url = new URL('/v1/iam/oauth/logout', iamServerUrl)
  url.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri)
  return url.toString()
}

/**
 * Drop everything this client stored in THIS browser, and nothing else.
 *
 * A sign-out is this plus ending the IAM session; a failed-callback retry is only
 * this — it clears the spent code verifier so a fresh authorize round-trip starts
 * clean, and it must NOT end the session, because re-authorizing silently is the
 * entire point of the retry. Two different intentions, so two names; the sweep they
 * share is written once, here.
 *
 * The PREFIX is swept rather than five named keys — a list of literals is a second
 * copy of the key set, and the copy is what goes stale when a key is added. Both
 * storages, because the PKCE verifier has to survive a full-page redirect. Collect
 * then delete: removing while iterating by index re-indexes the store and skips
 * every other key.
 */
export function forgetTokens(): void {
  for (const store of [
    typeof sessionStorage !== 'undefined' ? sessionStorage : null,
    typeof localStorage !== 'undefined' ? localStorage : null,
  ]) {
    if (!store) continue
    const doomed: string[] = []
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i)
      if (k && k.startsWith(KEY_PREFIX)) doomed.push(k)
    }
    for (const k of doomed) store.removeItem(k)
  }
}
