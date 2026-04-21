import type { NextConfig } from 'next'

// Static SPA — go:embed'd into the commerce binary by github.com/hanzoai/commerce,
// served at /admin/billing/. basePath/assetPrefix align emitted <script>/<link>
// URLs with the commerce mount path so asset requests route through the
// commerce billing handler (which strips /admin/billing before FS lookup).
//
// For standalone deploys via ghcr.io/hanzoai/spa, the same basePath is fine:
// the SPA base container serves /admin/billing/* from the static bundle root.
const config: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  trailingSlash: true,
  basePath: '/admin/billing',
  assetPrefix: '/admin/billing',
  transpilePackages: ['@hanzo/ui'],
  images: {
    unoptimized: true,
  },
}

export default config
