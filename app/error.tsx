'use client'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-8">
      <div className="max-w-lg rounded-2xl border border-border bg-bg-card p-8 text-center">
        <h1 className="text-lg font-semibold text-text">Something went wrong</h1>
        <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-black/30 p-3 text-left text-xs text-red-400">
          {error.message}
        </pre>
        {error.stack && (
          <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-black/30 p-3 text-left text-[10px] text-white/30">
            {error.stack}
          </pre>
        )}
        <button
          onClick={reset}
          className="mt-6 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition hover:bg-brand-hover"
        >
          Try again
        </button>
      </div>
    </main>
  )
}
