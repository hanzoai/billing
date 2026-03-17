#!/bin/sh
# Inject runtime config from environment into the static app
# This supports multi-tenant/white-label deployments where config comes from KMS

CONFIG_FILE=/usr/share/nginx/html/__config.js

cat > "$CONFIG_FILE" <<EOF
window.__HANZO_CONFIG__ = {
  walletConnectProjectId: "${NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:-}",
  iamClientId: "${NEXT_PUBLIC_IAM_CLIENT_ID:-app-billing}",
  authIssuer: "${NEXT_PUBLIC_AUTH_ISSUER:-https://hanzo.id}",
  commerceUrl: "${NEXT_PUBLIC_COMMERCE_URL:-https://commerce-api.hanzo.ai}"
};
EOF

exec nginx -g 'daemon off;'
