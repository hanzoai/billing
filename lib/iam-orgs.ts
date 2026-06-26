/**
 * Resolves which org slugs the signed-in user may view billing for.
 *
 * - Non-admins: exactly their own org. The selector then hides itself
 *   (a single option), so the UI never offers cross-org views.
 * - Global admins: every org IAM knows about, fetched live so the list is
 *   never stale, with 'hanzo' floated to the front (the default view).
 *
 * This is UX only. commerce EdgeAuth is the real trust boundary: it ignores
 * ?org for non-admins regardless of what this returns, so a tampered list
 * can never break per-org isolation.
 */

import { type IamUser, isGlobalAdminUser } from './iam-auth'

export async function fetchViewableOrgs(
  iamServerUrl: string,
  token: string,
  user: IamUser,
): Promise<string[]> {
  const own = (user.owner || 'hanzo').toLowerCase()
  if (!isGlobalAdminUser(user)) return [own]

  const base = iamServerUrl.replace(/\/+$/, '')
  try {
    const res = await fetch(`${base}/v1/iam/get-organizations`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    if (res.ok) {
      const body = await res.json()
      const rows: unknown[] = Array.isArray(body)
        ? body
        : Array.isArray((body as { data?: unknown[] })?.data)
          ? (body as { data: unknown[] }).data
          : Array.isArray((body as { organizations?: unknown[] })?.organizations)
            ? (body as { organizations: unknown[] }).organizations
            : []
      const slugs = rows
        .map((r) => (typeof r === 'string' ? r : (r as { name?: string })?.name))
        .filter((s): s is string => typeof s === 'string' && s.length > 0)
        .map((s) => s.toLowerCase())
      if (slugs.length > 0) return floatHanzoFirst(dedupe([...slugs, own]))
    }
  } catch {
    // fall through to the minimal admin set below
  }

  // IAM list unavailable — a global admin still needs at least the home view
  // (hanzo) and their own org. This is not an isolation fallback (commerce
  // enforces that); it just guarantees a non-empty selector.
  return floatHanzoFirst(dedupe(['hanzo', own]))
}

function dedupe(xs: string[]): string[] {
  return Array.from(new Set(xs))
}

function floatHanzoFirst(xs: string[]): string[] {
  return [...xs].sort((a, b) =>
    a === 'hanzo' ? -1 : b === 'hanzo' ? 1 : a.localeCompare(b),
  )
}
