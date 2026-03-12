import type { NextConfig } from 'next'

const isGitHubPages = process.env.GITHUB_PAGES === 'true'

const config: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  transpilePackages: ['@hanzo/ui'],
  images: {
    unoptimized: true,
  },
  ...(isGitHubPages ? { basePath: '/billing', assetPrefix: '/billing/' } : {}),
}

export default config
