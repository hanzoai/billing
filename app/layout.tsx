import './global.css'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { ThemeProvider } from '@/lib/theme/theme-provider'
import { Providers } from '@/lib/providers'

export const metadata: Metadata = {
  title: 'Hanzo Billing',
  description: 'Manage your billing, payment methods, subscriptions, and invoices.',
  metadataBase: new URL('https://billing.hanzo.ai'),
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#050505' },
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ThemeProvider>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
