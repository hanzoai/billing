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

- **Saved cards** are the PORTAL pair — list `GET /v1/billing/portal/methods`,
  remove `DELETE /v1/billing/portal/methods/:id` — because that pair is what the
  fleet serves a browser, measured on api.hanzo.ai and commerce-api.hanzo.ai
  (cloud v1.801.422/424): 200 and commerce's own `payment method not found` for
  an unknown id, with a preflight that allows GET/DELETE + Authorization from
  `https://billing.hanzo.ai`. `/v1/billing/methods` is claimed by cloud's billing
  app (manifest row `billing`) and answers **all three verbs** `501 {"error":
  "billing is not configured"}`: its `commerceProxy.configured()` needs
  `CLOUD_COMMERCE_HTTP_URL` **and** `COMMERCE_SERVICE_TOKEN`, and the deployed
  `hanzo/cloud` has only the token (co-resident, `CLOUD_COMMERCE_NATS_URL`) — so
  the proxy is dark and its handlers, unlike `balance`, have no co-resident path.
  That 501 was the broken card list, and `getPaymentMethods` swallowing it into
  `[]` is why it read as an honest "No payment methods on file". **Saving a card
  is still blocked there**: `POST /v1/billing/methods` is the address both server
  repos register and it 501s too, at the edge and at the pod. Fix belongs in
  cloud (`apps/billing/billing.go`), not here.
- **There is no `/v1/billing/payment`.** No app in either server repo has ever
  registered it (404 today, verified from the browser origin). It was the last
  step of the top-up page's Crypto, HUSD and Wire tabs, so all three took a
  customer's real money and credited nothing — those tabs are deleted, not
  disabled, exactly as cloud deleted its twin (`apps/account/account.go`). Card
  (`POST /v1/billing/topup/token`) is the ONE money-in door the browser has.
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
