# @hanzo/billing

Open-source Billing, Subscriptions, Credits, and Usage Portal for the Hanzo AI Ecosystem.

## Getting Started

```bash
git clone https://github.com/hanzoai/billing.git
cd billing
pnpm install
pnpm build
```

## Running Verification & Smoke Tests

Deterministic test suite covering subscription plan display, credit balance currency precision, invoice breakdown history, spend alerts, insufficient balance banner detection, and usage meter tracking:

```bash
node --test test/billing_mock_smoke.test.mjs
```

## Architecture

- `lib/money.ts` — Unified money & currency formatting, seat multiplier calculations, and annual savings arithmetic.
- `lib/plans.ts` — Catalog plan mapping and projection from raw commerce cents into user-facing plan cards.
- `lib/billing/` — Interactive dashboard panels for Overview, Invoices, Usage Tracking, Spend Alerts, Payment Methods, and Credit Top-ups.
