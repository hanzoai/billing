# @hanzo/billing

Static Next.js billing dashboard (`output: 'export'`, Turbopack) for Hanzo plans, credit balances, top-ups, payment methods, invoices, and organization subscriptions.

## Prerequisites & Setup

- **Node.js** `>=20.9` (`nodejs:v24.18.0` in `Dockerfile`)
- **pnpm** `10.33.4` (`corepack enable && corepack prepare pnpm@10.33.4 --activate`)
- Note: `package.json` compiles with TypeScript `7.0.2` (`tsgo`), which omits the legacy `typescript/lib/typescript.js` compiler API module; Next.js `>=16.4.6` (`experimental.useTypeScriptCli: true` by default) invokes `lib/tsc.js` cleanly during `next build`, and `app/global.css` retains `.mono` alongside `@hanzo/ui >=8.2` (`gui-css-check`).

```bash
pnpm install --frozen-lockfile
```

## Scripts

```bash
pnpm run test        # Vitest unit & component tests (mocked /v1/billing responses)
pnpm run typecheck   # tsc --noEmit --incremental false
pnpm run build       # Static export to out/ + postbuild gui-css-check
pnpm run lint        # SAQ-A PCI scope check across source (lib/, app/) and .next/ chunks
pnpm run dev         # Local dev server on port 3005
```

`pnpm run lint` (`scripts/pci-scope.mjs`) inspects both source files and built `.next/` JavaScript chunks, so run `pnpm run build` before `pnpm run lint`.

## Deployment Modes

- **Standalone (`billing.hanzo.ai`)**: `NEXT_PUBLIC_BASE_PATH=""` (default)
- **Commerce-embedded (`/admin/billing`)**: `NEXT_PUBLIC_BASE_PATH=/admin/billing pnpm run build`
- **API Endpoint**: Configured via `NEXT_PUBLIC_COMMERCE_URL` (defaults to `https://api.hanzo.ai` in `lib/config.ts`).
