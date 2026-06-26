# Hanzo Billing

## Overview
Hanzo billing service

## Tech Stack
- **Language**: TypeScript/JavaScript

## Build & Run
```bash
pnpm install && pnpm build
pnpm test
```

## Structure
```
billing/
  Dockerfile
  Dockerfile.deploy
  LLM.md
  app/
  k8s/
  lib/
  next-env.d.ts
  next.config.ts
  nginx.conf
  out/
  package.json
  pnpm-lock.yaml
  postcss.config.mjs
  public/
  tsconfig.json
```

## Key Files
- `package.json` -- Dependencies and scripts
- `Dockerfile` -- Container build

## Global-admin org-selector (0.1.8+)
A global admin signs in via the `hanzo-billing` IAM app as `owner=admin` and
would otherwise land on the empty `admin` org. For global admins only the UI
shows an org-selector that retargets the billing view:
- `lib/iam-auth.ts` -- `getCurrentUser()` exposes `owner` + `isGlobalAdmin`
  (gate = `owner==='admin' || isGlobalAdmin`, matching commerce EdgeAuth);
  `isGlobalAdminUser()`.
- `lib/iam-orgs.ts` -- `fetchViewableOrgs()`: IAM `/v1/iam/get-organizations`
  for admins (own org only otherwise; `hanzo` floated first as the default).
- `lib/billing/org-selector.tsx` -- the dropdown (renders only when >1 org).
- `lib/commerce.ts` / `lib/commerce-client.ts` -- `setCommerceViewOrg()` makes
  every billing call carry `?org=<slug>`; commerce EdgeAuth honors it ONLY for
  verified global admins (ignored, fail-closed, for everyone else).
- `lib/components/billing-shell.tsx` -- wires the selector, reloads on switch,
  suppresses starter-credit auto-grant during admin inspection.

NOTE: the SANDBOX build sends `X-Hanzo-Test: true` (charges the sandbox Square
processor). That header makes commerce read the empty TEST ledger, so it is
suppressed whenever an admin org-view is active (`commerce-client.ts`) — admin
inspection reads the LIVE ledger. A normal sandbox user still tops up/reads the
test ledger. (Separate pre-existing gap: the Usage panel's `getUsage()` expects
a `{records:[]}` summary but `/v1/billing/usage` returns raw `{usage:[]}` events
— usage renders as transactions, not in the Usage summary widget.)
