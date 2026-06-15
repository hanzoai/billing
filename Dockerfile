FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=""
ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

# Standalone host (billing.hanzo.ai) is served at root by the SPA container,
# so build without a basePath. Override to "/admin/billing" only for the
# commerce-embedded build.
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH

COPY . .
RUN pnpm build

FROM ghcr.io/hanzoai/spa
COPY --from=builder /app/out /public
