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

## Payment flows (one way each)

- **Square tokenization** lives in ONE place: `lib/square.ts` (`useSquareCard`
  hook + `loadSquareScript` + config + `SQUARE_CARD_STYLE`). Both money-in flows
  reuse it — the top-up page (`app/topup/page.tsx`) and paid-plan checkout
  (`lib/billing/subscribe-card-form.tsx`). Card data never touches our code;
  Square returns a single-use `sourceId` nonce the server charges.
- **Paid-plan self-serve checkout**: SubscriptionPortal → SubscribeCardForm →
  `commerce.subscribeWithCard({ sourceId, planId, quantity, currency }, { idempotencyKey })`
  → `POST /v1/billing/subscribe/card` (commerce ≥ v1.49.5). Server-authoritative
  price × max(1, quantity); NO client amount. Idempotency key is per attempt in
  sessionStorage (`hanzo_sub_idem:<plan>:<qty>`); kept on transient errors,
  rotated on decline, cleared on success. Error UI branches on status:
  402 declined · 409 in-progress · 422 no processor (→ contact fallback) ·
  500 charged-but-activation-failed. Free tiers still use
  `POST /v1/billing/subscriptions`; platform admins keep the mint path
  (`canDirectSubscribe`).
- **Public pricing (logged-out, no login wall)**: `app/page.tsx` renders
  `PublicPricing` when unauthenticated — auth gates only the subscribe action
  (`onRequireAuth` → start sign-in). Plans come from `lib/plans.ts`
  `PUBLIC_PLANS_URL = https://api.hanzo.ai/v1/plans/subscriptions` (the GATEWAY,
  not api.cloud.hanzo.ai — cloud is public but emits no CORS header; the gateway
  proxies the same catalog AND returns `access-control-allow-origin:
  https://billing.hanzo.ai`). Public catalog prices are DOLLARS; commerce's are
  cents.
