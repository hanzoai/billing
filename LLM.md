# LLM.md - Hanzo Billing

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
