import './global.css'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { ThemeProvider } from '@/lib/theme/theme-provider'
import { Providers } from '@/lib/providers'

// Geist and Geist Mono are self-hosted by @hanzo/design and declared in
// app/global.css (@hanzo/design/tokens/fonts.css), which is also where
// --font-sans and --font-mono get their values. next/font/google used to load
// them here, and that was the silent bug: it mints a scoped family name like
// `__Geist_Mono_abc123` and binds it to --font-mono, so @hanzo/ui's `.mono`
// — which asks for the literal family 'Zen Mono' — never matched and every
// money figure fell through to ui-monospace. One owner of the faces, and it is
// the package that ships the woff2.

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
