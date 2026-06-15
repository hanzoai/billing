import type { NextConfig } from 'next'

// Static SPA. Two deploy shapes, selected by NEXT_PUBLIC_BASE_PATH at build:
//   • Embedded in the commerce binary (github.com/hanzoai/commerce) at
//     /admin/billing/ — build with NEXT_PUBLIC_BASE_PATH=/admin/billing (default).
//     The commerce billing handler strips /admin/billing before FS lookup.
//   • Standalone on a dedicated host (e.g. billing.hanzo.ai), served at root by
//     the ghcr.io/hanzoai/spa container — build with NEXT_PUBLIC_BASE_PATH="".
//     A basePath here would emit /admin/billing/_next/* URLs that the root-
//     serving container can't resolve (it returns index.html → blank page).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/admin/billing'

const config: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  trailingSlash: true,
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  transpilePackages: ['@hanzo/ui'],
  images: {
    unoptimized: true,
  },
}

export default config
