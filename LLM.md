# Hanzo Billing

## Overview
Hanzo billing service

## Tech Stack
- TypeScript · React 19 · Next 16 (`output: 'export'`, Turbopack) · TypeScript 7
- `@hanzogui/shell` 8.0.3 for the cross-app chrome (TenantHeader, ORG_DOMAINS)
- **No Tailwind, no Radix, no shadcn, no PostCSS.** See *Styling* below.

## Build & Run
```bash
pnpm install && pnpm build   # static export -> out/
pnpm typecheck               # tsc --noEmit (TypeScript 7, native)
```

## Structure
```
billing/
  Dockerfile
  LLM.md
  app/          routes + global.css (the whole stylesheet)
  k8s/
  lib/
  next-env.d.ts
  next.config.ts
  package.json
  pnpm-lock.yaml
  public/
  tsconfig.json
```

## Key Files
- `package.json` -- Dependencies and scripts
- `Dockerfile` -- Container build
- `app/global.css` -- tokens + the exact utility vocabulary the markup uses
- `lib/money.ts` -- the ONE money formatter
- `lib/config.ts` -- `BASE_PATH`, the app's own root

## Styling (one way)

Plain CSS. `app/global.css` is the entire stylesheet: custom-property tokens on
`:root`, flipped by `html.light`, then ordinary rules for the exact utility
class vocabulary the markup uses. There is no build plugin, no `postcss.config`,
no `tailwind.config` — **do not reintroduce one.**

Four colour facts, each with ONE home. Markup must never spell a colour:

| fact | token | utilities |
| --- | --- | --- |
| ground | `--color-bg` · `--color-bg-card` · `--color-bg-elevated` | `bg-bg` · `bg-bg-card` · `bg-bg-elevated` |
| ink | `--color-text` (+ `-secondary` `-muted` `-dim`) | `text-text*`, and the `*-ink/α` family — `bg-ink/[0.06]`, `border-ink/[0.08]`, `text-ink/40` — which is ink mixed at α, NOT literal white |
| brand | `--color-brand` · `--color-brand-foreground` · `--color-brand-hover` | `bg-brand` · `text-brand-foreground` · `hover:bg-brand-hover` |
| status | `--color-success` `-warning` `-danger` `-info` | `text-success`, `bg-warning/15`, … |

Inline `style={{}}` obeys the same rule — `color: 'var(--color-text)'`,
`background: 'var(--color-bg-card)'`, and `color-mix(in oklab, var(--color-text)
6%, transparent)` for a tint. A literal there is how `/commerce` and `/topup`
stayed dark through a theme flip.

Colours that are deliberately literal, and why:
- the four buttons whose ground is a status colour in both themes (emerald /
  sky / rose / success) — there `text-white` IS the right value;
- status hues themselves (`#f87171`, `#34d399`, `#4ade80`);
- `lib/config.ts` per-org brand palettes (data, not theme);
- `app/layout.tsx` `viewport.themeColor` (a `prefers-color-scheme` meta pair);
- `lib/wallet-providers.tsx` RainbowKit `darkTheme()` and
  `lib/components/animated-card.tsx` (a picture of a plastic card);
- **`lib/square.ts` `SQUARE_CARD_STYLE`** — the ONE surface that still ignores
  the theme. Square paints its fields in a cross-origin iframe and takes literal
  colour strings, so it cannot read a custom property. Fixing it means resolving
  the tokens with `getComputedStyle` at attach time AND re-attaching the card on
  a theme flip; it cannot be verified locally because the Square SDK will not
  load against sandbox credentials over plain http. Left alone deliberately —
  in light mode the card input renders light-on-light.

A class with no rule in `global.css` is silently unstyled: same failure mode as
an unrecognised style prop. After touching markup, check both directions —
every class token used must resolve, and both themes must render. Nothing
enforces this at build time.

Because the SPA mounts at two roots (`/admin/billing` embedded in commerce, `/`
standalone), **every self-navigation goes through `BASE_PATH`** — a bare `'/'`
walks the browser out of the embedded app.

## Payment flows (one way each)

- **Money is formatted in ONE place**: `lib/money.ts` — `money(value, currency,
  digits)` and `moneyFromCents(cents, …)`. `digits` is the only thing call sites
  ever disagreed on (catalog prices are whole dollars, ledger amounts are to the
  cent). Do not add a local `fmt` / `formatCurrency`; there were fourteen.
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
