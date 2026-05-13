FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=""
ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

COPY . .
RUN pnpm build

FROM ghcr.io/hanzoai/spa
COPY --from=builder /app/out /public
