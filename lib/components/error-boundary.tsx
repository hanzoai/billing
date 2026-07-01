'use client'

import * as React from 'react'

type Fallback = React.ReactNode | ((error: Error, reset: () => void) => React.ReactNode)

interface Props {
  children: React.ReactNode
  /** Rendered instead of the crashed subtree. A function gets the error + a reset(). */
  fallback?: Fallback
  /** Notified on catch (e.g. to log). */
  onError?: (error: Error) => void
}

interface State {
  error: Error | null
}

/**
 * Client error boundary — contains a render-time crash to its own subtree so a
 * single misbehaving widget (e.g. a wallet-connect modal that throws
 * `DialogClose must be used within Dialog` on a bad refresh) degrades to an
 * honest inline message instead of taking down the whole page.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error): void {
    this.props.onError?.(error)
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render(): React.ReactNode {
    const { error } = this.state
    if (error) {
      const { fallback } = this.props
      if (typeof fallback === 'function') return fallback(error, this.reset)
      if (fallback !== undefined) return fallback
      return null
    }
    return this.props.children
  }
}
