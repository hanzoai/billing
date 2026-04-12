FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=""
ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

COPY . .
RUN pnpm build

FROM ghcr.io/hanzoai/spa
COPY --from=builder /app/out /public
