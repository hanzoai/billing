FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate
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

# Square Web Payments config is baked at build time (NEXT_PUBLIC_*, static
# export). Defaults come from .env.production (live). For a SANDBOX build
# (investor demo) pass these build-args; when set, they are written to
# .env.production.local which Next.js loads at higher priority than
# .env.production — so the committed live default is never mutated and an
# unset arg leaves the live values intact.
ARG SQUARE_APPLICATION_ID=""
ARG SQUARE_LOCATION_ID=""
ARG SQUARE_ENVIRONMENT=""

COPY . .
RUN if [ -n "$SQUARE_APPLICATION_ID" ]; then \
      printf 'NEXT_PUBLIC_SQUARE_APPLICATION_ID=%s\nNEXT_PUBLIC_SQUARE_LOCATION_ID=%s\nNEXT_PUBLIC_SQUARE_ENVIRONMENT=%s\n' \
        "$SQUARE_APPLICATION_ID" "$SQUARE_LOCATION_ID" "$SQUARE_ENVIRONMENT" > .env.production.local; \
      echo "billing: SANDBOX Square build ($SQUARE_ENVIRONMENT / $SQUARE_APPLICATION_ID)"; \
    fi && \
    pnpm build

FROM ghcr.io/hanzoai/spa
COPY --from=builder /app/out /public
