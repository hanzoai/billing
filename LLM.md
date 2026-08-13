# Hanzo Billing

## Overview
Hanzo billing service

## Tech Stack
- TypeScript 5.9.3 · React 19 · Next 16.2 (`output: 'export'`, **Turbopack**)
- `@hanzo/ui` 8.0.72 — the shared handle vocabulary (`mono`, `tnum`, `paper`,
  `row`, `elevation-1..4`). `.btn` and `.badge` do NOT exist in it; anything
  that looks like one is defined locally in `app/global.css`.
  **Never below 8.0.69** — see *The focus ring* below.
- `@hanzo/design` 0.5.1 — the colour ladder AND the two self-hosted faces.
  **Never below 0.4.9** — same reason.
- `@hanzo/gui` 8.1.1 — ships `gui-css-check`, which `postbuild` runs.
- `@hanzogui/shell` 8.1.5 for the cross-app chrome (TenantHeader, ORG_DOMAINS).
  **Never 8.0.3** — that release published 966 lines of Tailwind classes with no
  Tailwind in its dependencies and rendered completely unstyled. 8.0.6 ships zero
  CSS and zero className literals; it styles itself with inline style objects and
  one scoped `[data-hanzo-shell]` sheet.
- `qr` 0.5.5 — 0-dep QR encoder, one use: the crypto deposit address on
  `/topup`, drawn as an inline `<svg>` string. No CSS, no image request.
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
- `lib/config.ts` -- `BASE_PATH` (the app's own root) and `COMMERCE_URL`, the ONE
  commerce address every money-in surface asks — the card form reads its Square
  application from it and the charge is sent to it, so two spellings would be two
  Square accounts
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

**Still needed at `@hanzo/ui` 8.0.72.** The removal condition was "once ui stops
shadowing design's `--background` / `--black` / `--white`", and it has not:
8.0.72's sheet still carries the gui theme runtime and declares `--background`
246 times. Re-measure before deleting `--page`; do not delete it on the version
number alone.

### The focus ring — ONE, and it is not ours

A focused field draws exactly one indicator and billing does not own it:
`@hanzo/design`'s base layer states `:focus-visible { outline: 2px solid
var(--ring); outline-offset: 2px }` for every focusable thing, field included.
It is `--ring` at .40 (3.77:1 on the darkest canvas, the one contrast pair the
design package gates), it is `:focus-visible` so a mouse click does not ring it,
and an `outline` is the only affordance an app's own border styling cannot
silently override.

**Never put `outline-none`, `focus:border-*` or `focus:ring-*` on a field here.**
All sixteen inputs did, and it cost twice over: `outline-none` deleted the shared
ring, and what replaced it was either a second ring stacked on the first
(`focus:border-brand focus:ring-1 focus:ring-brand`) or — on the three fields
carrying an inline `outline: 'none'` — no focus indicator at all. Deleting the
overrides is the whole fix; there is nothing to add.

The reason a stale lockfile shows a DOUBLE rather than a single ring:
`@hanzo/ui/styles.css` inlines design's base layer verbatim at ui build time, so
the version of that layer an app renders is decided by its `@hanzo/ui` pin, NOT
its `@hanzo/design` pin. Before design 0.4.9 the layer held two rules — a field
rule (`outline:none` + brightened edge + halo) and the generic ring — that both
computed to (0,1,0), so the cascade fell through to source order, the generic
rule was written later, and it beat the `outline:none` the field rule stated to
prevent exactly that. Both rules then painted. design 0.4.9 deleted the field
rule; `@hanzo/ui` 8.0.69 was the first release to re-inline the fixed layer.

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
  and `useApplePay` hooks + `squareConfig` + `loadSquareScript` + `CARD_STYLE`).
  All money-in flows reuse it — the top-up page (`app/topup/page.tsx`) and
  paid-plan checkout (`lib/billing/subscribe-card-form.tsx`). Card data never
  touches our code; the card fields and the Apple Pay sheet both return a
  single-use `sourceId` nonce the server charges by the identical call.
  **Which Square is the ORG's answer, not the build's**: `squareConfig()` reads
  `GET /v1/billing/settings` per card mount and uses application + location +
  environment from it, so a sandbox org and a live org are served by one image.
  The baked `NEXT_PUBLIC_SQUARE_*` are the fallback for when that read fails, and
  a partial answer falls back WHOLE — pairing one environment's application with
  another's CDN is exactly the cross-environment mismatch Square rejects.
  **Every surface that tokenizes asks `squareConfig()`** — the wallet included.
  `useApplePay` resolves the account through it and passes that answer to both
  `loadSquareScript(environment)` and `payments()`, so the sheet and the card
  fields can never name different Square accounts. Wiring the wallet to the baked
  constants instead would mint a nonce against one environment for a charge sent
  to another, which is the rejection `squareConfig()` exists to prevent.
- **Crypto top-up** is the MPC custody rail and nothing else: the `/topup` crypto
  tab lists what commerce is watching (`GET /v1/billing/crypto/options`), asks for
  this payer's address on the chosen pair (`POST /v1/billing/crypto/deposit`), and
  shows it with a QR. Nothing in the tab can credit a balance — a chain watcher
  does that on confirmations — so nothing in it says a deposit has landed. Where
  commerce issues a destination tag (XRPL) the QR is withheld: an address alone
  is half that destination, and the half that arrives belongs to nobody.
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

**And the SPA follows the org.** `lib/square.ts` asks
`GET /v1/billing/settings` (commerce's `payment.SquarePublicConfig`) on each card
mount and tokenizes with the application, location and environment it answers, so
**billing.hanzo.ai serves sandbox and production from ONE image**: flip an org's
`Live` flag and the next card form loads the other Square. The baked
`NEXT_PUBLIC_SQUARE_*` apply only when that read fails, and then all three
together — filling one field from the build and the rest from the org is how a
nonce ends up minted against the wrong environment, which Square rejects.

This works on the deployed cloud because the pod carries the sandbox PUBLIC pair
(`SQUARE_SANDBOX_APPLICATION_ID`, `SQUARE_SANDBOX_LOCATION_ID`) beside the
production one; without them a test org would be answered `environment: sandbox`
with the production application id — the same mismatch, now server-side.

### Credentials

Sandbox app id and location id are PUBLIC — Square hands them to the browser.
Commerce serves them per org, so nothing here needs them; they are only worth
setting for a build that must work with no commerce to ask:

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

Sign in as a member of a `Live=false` org, open `/topup`, enter the test card,
submit: the SPA tokenizes with that org's sandbox application and calls
`POST /v1/billing/topup/token` with the nonce. Read the balance either side with
`GET /v1/billing/balance`. The credited subject is the org slug, resolved
server-side — a body value cannot steer it. billing.hanzo.ai does this as well as
a local run does; the org is the whole switch.

Locally, Square's Web Payments SDK refuses to load over plain `http` on a
non-localhost origin. `http://localhost:3005` is exempt, so `pnpm dev` needs no
certificate; anything else does (`mkcert`).

```bash
cd ~/work/hanzo/hanzoai/billing
echo 'NEXT_PUBLIC_BASE_PATH=' > .env.local
pnpm dev            # http://localhost:3005/topup
```

`.env.local` outranks `.env.production` and is git-ignored, so the committed live
defaults are never mutated. The Docker build args (`SQUARE_APPLICATION_ID`,
`SQUARE_LOCATION_ID`, `SQUARE_ENVIRONMENT`) still write `.env.production.local`,
which now only decides what the card form does when it cannot reach commerce.

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

### Crypto rides the MPC custody rail

The crypto tab is `GET /v1/billing/crypto/options` for what commerce is watching,
`POST /v1/billing/crypto/deposit` for this payer's address on the pair chosen,
and a chain watcher that credits only on confirmations
(`commerce/api/billing/crypto_deposit.go`). The SPA cannot credit anything, and
says nothing that implies it has.

Two properties hold it together, both server-side:

- **Offered ⟺ creditable.** The picker renders only what `options` answers, and
  that set is projected from the watcher's configured assets — an asset appears
  because something is reading the chain for it, and stops the moment that stops
  being true. A failed options call therefore renders NOTHING; a fallback list
  would be an invitation to send money at an address nobody watches.
- **One payer, one address per asset.** A re-POST returns the open intent rather
  than minting again, so re-opening the tab strands nothing.

Arming an asset is one act on the serving deployment: `CRYPTO_DEPOSIT_RPC_<CHAIN>`
plus `CRYPTO_DEPOSIT_TOKEN_<CHAIN>_<TOKEN>` (and `CRYPTO_DEPOSIT_ADDRESS_<CHAIN>`
where deposits are pooled). Nothing is watched by default, so the rail is closed
until it is named. `app/topup/page.tsx` holds the labels for the pairs worth
naming — a row there is copy, never permission; visibility is the server's answer.

Where commerce issues a destination tag (a pooled chain such as XRPL) the tab
shows the tag and withholds the QR: the address alone is half the destination,
and the half that arrives names nobody.

What this replaced, so it is not rebuilt: a form that took a user-typed tx hash
and posted it to `POST /v1/payments` — a GENERIC REST resource
(`rest.New(payment.Payment{})` in `commerce/api/api.go`) with no create hook. It
verified no hash, credited no balance, hardcoded `network: 'ethereum'` whatever
chain the customer used, then read the balance back and announced a successful
top-up. The treasury address it published came from `NEXT_PUBLIC_HANZO_ETH_TREASURY`
(no longer read anywhere).

## License

Dual-licensed **MIT OR Apache-2.0** (`LICENSE-MIT`, `LICENSE-APACHE`), replacing the
previous BSD-3-Clause declaration. Original Hanzo work standardises on this pair per
HIP-0137 "One License" (`hanzoai/hips`, `HIPs/hip-0137-one-license.md`); forks keep
their upstream licence unchanged.
