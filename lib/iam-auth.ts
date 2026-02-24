/**
 * Minimal IAM auth module for the billing portal.
 *
 * Handles OIDC/PKCE login via Casdoor (hanzo.id) and token storage.
 * Uses OIDC discovery for endpoint URLs (matching @hanzo/iam pattern).
 * Self-contained — no external auth package dependency.
 */

const KEY_PREFIX = 'hanzo_billing_'
const KEY_ACCESS_TOKEN = `${KEY_PREFIX}access_token`
const KEY_REFRESH_TOKEN = `${KEY_PREFIX}refresh_token`
const KEY_EXPIRES_AT = `${KEY_PREFIX}expires_at`
const KEY_CODE_VERIFIER = `${KEY_PREFIX}code_verifier`
const KEY_STATE = `${KEY_PREFIX}state`

export interface IamUser {
  email: string
  displayName: string | null
  avatar: string | null
  sub: string
}

export interface IamAuthConfig {
  iamServerUrl: string
  clientId: string
  redirectUri: string
  orgName: string
  appName: string
}

interface OidcDiscovery {
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint: string
  end_session_endpoint: string
}

let discoveryCache: OidcDiscovery | null = null

async function getDiscovery(serverUrl: string): Promise<OidcDiscovery> {
  if (discoveryCache) return discoveryCache
  const base = serverUrl.replace(/\/+$/, '')
  const res = await fetch(`${base}/.well-known/openid-configuration`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`)
  discoveryCache = (await res.json()) as OidcDiscovery
  return discoveryCache
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

/** Check if user is logged in (has valid token). */
export function isLoggedIn(): boolean {
  const token = sessionStorage.getItem(KEY_ACCESS_TOKEN)
  const expiresAt = sessionStorage.getItem(KEY_EXPIRES_AT)
  if (!token) return false
  if (expiresAt && Date.now() > Number(expiresAt)) return false
  return true
}

/** Get the current access token. */
export function getAccessToken(): string | null {
  if (!isLoggedIn()) return null
  return sessionStorage.getItem(KEY_ACCESS_TOKEN)
}

/** Parse the JWT payload to extract user info. */
export function getCurrentUser(): IamUser | null {
  const token = getAccessToken()
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return {
      email: payload.email ?? payload.name ?? '',
      displayName: payload.displayName ?? payload.name ?? null,
      avatar: payload.avatar ?? null,
      sub: payload.sub ?? payload.name ?? '',
    }
  } catch {
    return null
  }
}

/** Start OIDC/PKCE login flow — redirects to IAM server. */
export async function startLogin(config: IamAuthConfig): Promise<void> {
  const discovery = await getDiscovery(config.iamServerUrl)
  const state = generateRandom(32)
  const codeVerifier = generateRandom(64)
  const challengeBuffer = await sha256(codeVerifier)
  const codeChallenge = base64UrlEncode(challengeBuffer)

  sessionStorage.setItem(KEY_STATE, state)
  sessionStorage.setItem(KEY_CODE_VERIFIER, codeVerifier)

  const url = new URL(discovery.authorization_endpoint)
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('scope', 'openid profile email')
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')

  window.location.href = url.toString()
}

/** Handle the OAuth callback — exchange code for tokens. */
export async function handleCallback(config: IamAuthConfig): Promise<IamUser | null> {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    const desc = url.searchParams.get('error_description') ?? error
    throw new Error(`OAuth error: ${desc}`)
  }

  if (!code) throw new Error('No authorization code in callback')

  const savedState = sessionStorage.getItem(KEY_STATE)
  if (!savedState || savedState !== state) throw new Error('State mismatch — possible CSRF')

  const codeVerifier = sessionStorage.getItem(KEY_CODE_VERIFIER)
  if (!codeVerifier) throw new Error('Missing code verifier')

  // Clean up state
  sessionStorage.removeItem(KEY_STATE)
  sessionStorage.removeItem(KEY_CODE_VERIFIER)

  // Exchange code for tokens via OIDC token endpoint
  const discovery = await getDiscovery(config.iamServerUrl)
  const tokenRes = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      code,
      redirect_uri: config.redirectUri,
      code_verifier: codeVerifier,
    }),
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    throw new Error(`Token exchange failed: ${text}`)
  }

  const data = await tokenRes.json()
  const accessToken = data.access_token
  const refreshToken = data.refresh_token
  const expiresIn = data.expires_in ?? 3600

  if (!accessToken) throw new Error('No access token received')

  // Store tokens
  sessionStorage.setItem(KEY_ACCESS_TOKEN, accessToken)
  if (refreshToken) sessionStorage.setItem(KEY_REFRESH_TOKEN, refreshToken)
  sessionStorage.setItem(KEY_EXPIRES_AT, String(Date.now() + expiresIn * 1000))

  return getCurrentUser()
}

/** Clear all stored tokens. */
export function logout(): void {
  sessionStorage.removeItem(KEY_ACCESS_TOKEN)
  sessionStorage.removeItem(KEY_REFRESH_TOKEN)
  sessionStorage.removeItem(KEY_EXPIRES_AT)
  sessionStorage.removeItem(KEY_STATE)
  sessionStorage.removeItem(KEY_CODE_VERIFIER)
}
