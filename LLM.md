# Hanzo Billing

## Overview
Hanzo billing service

## Tech Stack
- TypeScript 5.9.3 · React 19 · Next 16.2 (`output: 'export'`, **Turbopack**)
- `@hanzo/ui` 8.0.47 — the shared handle vocabulary (`mono`, `tnum`, `paper`,
  `row`, `elevation-1..4`). `.btn` and `.badge` do NOT exist in it; anything
  that looks like one is defined locally in `app/global.css`.
- `@hanzo/design` 0.4.6 — the colour ladder AND the two self-hosted faces.
- `@hanzo/gui` 8.0.2 — ships `gui-css-check`, which `postbuild` runs.
- `@hanzogui/shell` 8.0.6 for the cross-app chrome (TenantHeader, ORG_DOMAINS).
  **Never 8.0.3** — that release published 966 lines of Tailwind classes with no
  Tailwind in its dependencies and rendered completely unstyled. 8.0.6 ships zero
  CSS and zero className literals; it styles itself with inline style objects and
  one scoped `[data-hanzo-shell]` sheet.
- **No Tailwind, no Radix, no shadcn, no tailwind-merge, no PostCSS config.**
  See *Styling* below.

## Build & Run
```bash
pnpm install && pnpm build   # static export -> out/, then gui-css-check
pnpm lint                    # scripts/pci-scope.mjs — the SAQ-A boundary
pnpm typecheck               # tsc --noEmit
```
`pnpm lint` scans BOTH the source and the built bundle, so it needs `pnpm build`
to have run — it refuses to pass on a scan that examined nothing.

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

Plain CSS. `app/global.css` is the entire stylesheet: two `@import`s, then
app-local aliases on `:root`, then ordinary rules for the exact utility class
vocabulary the markup uses. There is no build plugin, no `postcss.config`, no
`tailwind.config` — **do not reintroduce one.**

```css
@import '@hanzo/ui/styles.css';            /* tokens AND handles — one home  */
@import '@hanzo/design/tokens/fonts.css';  /* the two @font-face + --font-*  */
```

1. `@hanzo/ui/styles.css` carries design's ladder inlined verbatim (88 tokens,
   byte-identical) plus the handles. It is the only colour import.
2. Fonts must be imported or nothing fails LOUDLY. `@hanzo/ui` 8.0.47 removed its
   own `@font-face` (it duplicated design's and pointed at assets ui never
   shipped), so ui only NAMES the faces — `.mono` asks for the literal family
   `'Geist Mono'`. Without design's `fonts.css` the build is green, gui-css-check
   is green, and every money figure silently falls back to `ui-monospace`: still
   monospace, still tabular, wrong face, invisible in a screenshot.
   **Do not use `next/font` here** — it mints a scoped family name
   (`__Geist_Mono_abc123`) that `.mono` can never match. That was the bug.

### `--page`: the one token taken back from gui

The page ground reads **`--page`**, never `--background`. This is deliberate and
temporary, and it is the same answer `hanzo.industries` reached:

```css
:root  { --page: var(--neutral-950); }   /* #0A0A0A — design's dark ground  */
.light { --page: var(--pure-white); }    /* #FFFFFF — design's light ground */
```

`@hanzo/ui/styles.css` inlines design's ladder, then ~160KB later the @hanzogui
theme runtime redeclares `--background` for its own themes — `:root.t_dark` →
`var(--t8)`, `:root.t_light` → `var(--t189)` = `hsla(0,0%,97%)` — each with a
**bare `:root` fallback** beside it, light block last. So with no gui class the
ground is near-white in both themes and dark measures **1.03:1**.

Re-importing design's `colors.css` last reclaims it (1.0.9 shipped that) but
**only while no gui theme class exists on `<html>`**. `:root.t_light` is (0,2,0),
design's `.light` is (0,1,0) — the moment GuiProvider writes its class, gui wins
on specificity and import order stops mattering. Measured on 1.0.9 with the class
forced on: dark+`t_light` **1.03:1**, light+`t_dark` **1.07:1**, and even the
agreeing pairs drift (`t_dark` grounds at `#141414`). A fix that holds only while
a different bug stays unfixed is not a fix.

`--page` is a name gui never writes at any specificity, resolving to design base
rungs (`--neutral-950`, `--pure-white`) that are each declared exactly **once** in
the whole delivered sheet. Verified in all four combinations of {dark, light} ×
{gui class, none} — plus the two mismatched crosses — at a constant **18.97:1**
dark and **19.80:1** light.

**Only `--background` needs this.** `--foreground`, `--card`, `--accent`,
`--border*`, `--primary*`, `--text-*` and `--state-*` were all measured unchanged
with the gui classes forced on, so they read ui's inlined ladder directly and are
not restated here. Do not "defensively" wrap the others; that would be a second
mechanism for a problem they do not have.

**Removable once `@hanzo/ui` 8.0.48 lands** — it stops ui/gui shadowing design's
`--background` / `--black` / `--white`. At that point `--page` can become
`var(--background)` and then disappear entirely.

Money must be tabular. Numeric cells carry `mono` (Geist Mono +
`font-variant-numeric: tabular-nums`); `tnum` is the same tabular figures
without changing the face. Both come from `@hanzo/ui` — do not re-declare a
local `.font-mono` or `.tabular-nums`, which is what they replaced.

Four colour facts, each with ONE home. Markup must never spell a colour:

| fact | token | utilities |
| --- | --- | --- |
| ground | `--color-bg` (and `--color-bg-input`) read **`--page`**, see above · `--color-bg-card` → `--card` · `--color-bg-elevated` → `--accent` | `bg-bg` · `bg-bg-card` · `bg-bg-elevated` |
| ink | `--color-text` (+ `-secondary` `-muted` `-dim`) | `text-text*`, and the `*-ink/α` family — `bg-ink/[0.06]`, `border-ink/[0.08]`, `text-ink/40` — which is ink mixed at α, NOT literal white |
| brand | `--color-brand` · `--color-brand-foreground` · `--color-brand-hover` — all three alias design's **`--primary`** family, NOT its `--brand` family. `--primary` is the ink of the current theme and inverts; `--brand` is a fixed accent that does not restate under `.light`, so aliasing to it gave a light-grey button on a white page whose hover was one shade off itself. | `bg-brand` · `text-brand-foreground` · `hover:bg-brand-hover` |
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
- `lib/wallet-providers.tsx` RainbowKit `darkTheme()`;
- **`lib/square.ts` `SQUARE_CARD_STYLE`** — the ONE surface that still ignores
  the theme. Square paints its fields in a cross-origin iframe and takes literal
  colour strings, so it cannot read a custom property. Fixing it means resolving
  the tokens with `getComputedStyle` at attach time AND re-attaching the card on
  a theme flip; it cannot be verified locally because the Square SDK will not
  load against sandbox credentials over plain http. Left alone deliberately —
  in light mode the card input renders light-on-light.

A class with no rule in any delivered sheet is silently unstyled: same failure
mode as an unrecognised style prop. `postbuild` runs **`gui-css-check`** so that
cannot ship green again — it compares every class in the rendered markup against
the selectors in every sheet the page delivers, linked `.css` and inline
`<style>` alike, and exits non-zero on a miss.

One caveat worth knowing: this app is a client-rendered static export, so the
HTML on disk is a near-empty shell and the postbuild run only sees the ~24
classes in it. The authoritative run renders the app in a browser first. To
reproduce it: serve `out/`, seed a token in `localStorage`, walk the ten section
hashes at 390 and 1280 in both themes, write each `document.documentElement
.outerHTML` to a directory, copy `out/_next/static/chunks/*.css` alongside, and
point `gui-css-check` at that directory. The convergence run was 40 pages,
**218/218 classes covered**.

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

## License

Dual-licensed **MIT OR Apache-2.0** (`LICENSE-MIT`, `LICENSE-APACHE`), replacing the
previous BSD-3-Clause declaration. Original Hanzo work standardises on this pair per
HIP-0137 "One License" (`hanzoai/hips`, `HIPs/hip-0137-one-license.md`); forks keep
their upstream licence unchanged.
