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
- `lib/topup.ts` -- the standing top-up amounts and `topupHref()`, the ONE way
  to link to `/topup` (it carries `?amount=` so a click never drops what it knew)
- `lib/charge.ts` -- the ONE idempotency key per money-move attempt, shared by
  the top-up and subscribe card paths

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
- **`lib/square.ts` `CARD_STYLE`** — the card fields keep SQUARE's colours, not
  ours, and that is the fix rather than a gap. Square paints them in a
  cross-origin iframe on a white surface it will not let us repaint:
  `.input-container` backgroundColor is rejected outright ("Invalid style
  property", which fails the whole attach), and setting it on `input` does
  nothing. So an ink chosen from our theme is invisible in whichever theme is
  light-on-light — this shipped as a hard-coded `#fafafa`, which was ghost text
  on white in the DEFAULT dark theme, not just in light. Square's own defaults
  are dark-on-white and internally consistent, so they read identically under
  both themes. We set the font size and the validation-message colour, nothing
  else, and the hook therefore has no theme dependency — one that re-attached on
  a flip would discard whatever the customer had already typed.

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

## Free credit is retired — do not restore it

There is no starter credit: no auto-grant on first visit, no claim button, no
`grantStarterCredit` on the commerce client. Onboarding at hanzo.id requires a
payment method AND a plan, so nothing here may advertise credit or call paying
optional. The guided setup card has no "Skip setup" — for an UNFUNDED account
the overview IS that card until both required steps are done (`setupIncomplete`
in `billing-shell.tsx`), and every other section stays reachable from the
sidebar. A FUNDED account (positive available balance or credit) always sees
the dashboard: it has already established a way to pay, its money is the honest
thing to show, and walling it behind "choose a plan" once trapped a six-figure
prepaid account in onboarding and swallowed its Add-credit click. The card only
stops CLAIMING setup is optional; enforcement is server-side in commerce, not
here.

Accounts that already hold a starter credit keep it. It is a real Deposit
transaction tagged `starter-credit`, and `loadBillingData` still synthesizes a
grant row from it so the money stays visible — showing a past grant is not
advertising a current offer.

## Payment flows (one way each)

- **Money is formatted in ONE place**: `lib/money.ts` — `money(value, currency,
  digits)` and `moneyFromCents(cents, …)`. `digits` is the only thing call sites
  ever disagreed on (catalog prices are whole dollars, ledger amounts are to the
  cent). Do not add a local `fmt` / `formatCurrency`; there were fourteen.
- **Square tokenization** lives in ONE place: `lib/square.ts` (`useSquareCard`
  hook + `loadSquareScript` + config + `CARD_STYLE`). All money-in flows
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

## Testing money flows in sandbox

Money-in can be exercised end to end with FAKE money. Nothing below changes a
production CR, and none of it needs a deploy.

**The authority is the ORG, not the deployment.** commerce resolves sandbox vs
production from the org record alone — `organization.TestMode()` is `!o.Live`
(`models/organization/testmode.go`), and that ONE fact picks both the credential
set (`payment/orgsetup.go` → `SQUARE_SANDBOX_ACCESS_TOKEN` /
`SQUARE_SANDBOX_LOCATION_ID`) and the ledger bucket (`trans.Test` in
`api/billing/payment_core.go`). So a `Live=false` org transacts in Square sandbox
and credits the TEST balance, on the same replica that serves live merchants. A
sandbox charge can never mint spendable credit, and production needs no change to
serve one.

**But the SPA does not follow the org.** `lib/square.ts` reads the app id and
location id from `NEXT_PUBLIC_*`, which Next.js bakes in at BUILD time
(`output: 'export'`). commerce already computes the per-org answer and serves it
(`payment.SquarePublicConfig` → `GET /v1/billing/settings`), but nothing here
fetches it. Consequence: **billing.hanzo.ai cannot be used to test sandbox** — the
browser would tokenize against the production application while commerce charged
with the sandbox token, and Square rejects the cross-environment nonce. Testing
sandbox therefore means a LOCAL build with sandbox values, pointed at a
`Live=false` org. (Making the SPA read `/v1/billing/settings` would remove this
split and let one build serve both; until then, keep the two in step by hand.)

### Credentials

Sandbox app id and location id are PUBLIC — Square hands them to the browser, so
they belong in a build arg, not a vault:

```
NEXT_PUBLIC_SQUARE_ENVIRONMENT=sandbox
NEXT_PUBLIC_SQUARE_APPLICATION_ID=sandbox-sq0idb--kZP78n8_TjQOu8qApr5iQ
NEXT_PUBLIC_SQUARE_LOCATION_ID=LD8DWE4KKB0WB
```

The server-side access token is the only secret. It lives in Hanzo KMS, project
`hanzo-commerce`, env `prod`, path `/`, key **`SQUARE_SANDBOX_ACCESS_TOKEN`**,
synced by `universe/infra/k8s/commerce/kms-secrets.yaml` into the `commerce-secrets`
Secret in namespace `hanzo`. Never paste the value into a file, a build arg, or a
commit — read it at point of use:

```bash
kubectl get secret commerce-secrets -n hanzo \
  -o jsonpath='{.data.SQUARE_SANDBOX_ACCESS_TOKEN}' | base64 -d
```

### Test card

`4111 1111 1111 1111` · any future expiry · any CVV · ZIP `94103`.
Square's sandbox also accepts the pre-made nonce `cnon:card-nonce-ok` as a
`sourceId`, which is how the charge leg is proven without a browser.

### Run the card flow

Square's Web Payments SDK refuses to load over plain `http` on a non-localhost
origin, and the sandbox CDN (`sandbox.web.squarecdn.com`) is selected whenever
`NEXT_PUBLIC_SQUARE_ENVIRONMENT` is not `production`. `http://localhost:3005` is
exempt, so `pnpm dev` needs no certificate; anything else does (`mkcert`).

```bash
cd ~/work/hanzo/hanzoai/billing
cat > .env.local <<'EOF'
NEXT_PUBLIC_SQUARE_ENVIRONMENT=sandbox
NEXT_PUBLIC_SQUARE_APPLICATION_ID=sandbox-sq0idb--kZP78n8_TjQOu8qApr5iQ
NEXT_PUBLIC_SQUARE_LOCATION_ID=LD8DWE4KKB0WB
NEXT_PUBLIC_BASE_PATH=
EOF
pnpm dev            # http://localhost:3005/topup
```

`.env.local` outranks `.env.production` and is git-ignored, so the committed live
defaults are never mutated. Sign in, open `/topup`, enter the test card, submit:
the SPA tokenizes and calls `POST /v1/billing/topup/token` with the nonce. Read
the balance either side with `GET /v1/billing/balance`. The credited subject is
the org slug, resolved server-side — a body value cannot steer it.

The same values exist as Docker build args (`SQUARE_APPLICATION_ID`,
`SQUARE_LOCATION_ID`, `SQUARE_ENVIRONMENT`) for a throwaway sandbox image; they
write `.env.production.local` at build. Do not point a shared host at that image.

### Verify the charge leg alone

Proves the KMS token and location take money, no browser involved:

```bash
TOK=$(kubectl get secret commerce-secrets -n hanzo \
  -o jsonpath='{.data.SQUARE_SANDBOX_ACCESS_TOKEN}' | base64 -d)
curl -s https://connect.squareupsandbox.com/v2/payments \
  -H "Square-Version: 2025-01-23" -H "Authorization: Bearer $TOK" \
  -H 'Content-Type: application/json' \
  -d '{"source_id":"cnon:card-nonce-ok","idempotency_key":"probe-'"$(date +%s)"'",
       "amount_money":{"amount":2500,"currency":"USD"},"location_id":"LD8DWE4KKB0WB"}' \
  | jq '{status:.payment.status, id:.payment.id}'
```

### Verify the ledger leg alone

The Square call is provider-owned; the ledger invariants are pinned
deterministically in `hanzoai/commerce`. Build the way the product ships —
`CGO_ENABLED=0` — because `hanzoai/base` deliberately fails a cgo build that
lacks `sqlite_math_functions`:

```bash
cd ~/work/hanzo/hanzoai/commerce
CGO_ENABLED=0 go test ./api/billing/ -run TestTopup -v
```

`TestTopup_SandboxChargeCreditsTestBucket` drives the real handler for a
`Live=false` org and asserts the test bucket rises while the live bucket stays
empty.

### Crypto is NOT testable this way — the tab's door is not the credited rail

`app/topup/page.tsx` gates its crypto tab on `NEXT_PUBLIC_HANZO_ETH_TREASURY`,
and setting it does render the address and form. Do not read that as a working
test surface. That tab posts a user-typed tx hash to `POST /v1/payments`, which
is a GENERIC REST resource (`rest.New(payment.Payment{})` in `commerce/api/api.go`)
with no create hook: nothing verifies the hash on-chain and nothing credits a
balance. It also hardcodes `network: 'ethereum'`, so a Sepolia send would be
recorded as mainnet.

The real rail is MPC custody — `POST /v1/billing/crypto/deposit` for a per-payer
address, `GET /v1/billing/crypto/options` for the live chain/token set, and a
chain watcher that credits only on confirmations (`api/billing/crypto_deposit.go`:
"nothing here mints, so a claimed deposit is worth nothing until the chain says
otherwise"). Point the tab at that rail before enabling it. Publishing a treasury
address behind a door that cannot credit is how a customer sends real USDC and
gets nothing — the same failure the hardcoded third-party address already caused
once.

## License

Dual-licensed **MIT OR Apache-2.0** (`LICENSE-MIT`, `LICENSE-APACHE`), replacing the
previous BSD-3-Clause declaration. Original Hanzo work standardises on this pair per
HIP-0137 "One License" (`hanzoai/hips`, `HIPs/hip-0137-one-license.md`); forks keep
their upstream licence unchanged.
