'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import Link from 'next/link'
import './globals.css'

/**
 * Shown when the root layout itself fails to render. It replaces the whole
 * page (including <html> and <body>), so it cannot use the app's providers.
 * Errors inside pages are caught lower down by EnhancedErrorBoundary.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body className="bg-background min-h-screen flex items-center justify-center p-4 font-sans">
        <main className="w-full max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
          <p className="text-muted-foreground">
            Talii could not load this page. Please try again. If it keeps happening, contact support.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-xl bg-secondary px-5 py-2.5 font-semibold text-secondary-foreground hover:bg-secondary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
            >
              Try again
            </button>
            <Link
              href="/"
              className="rounded-xl border border-border px-5 py-2.5 font-semibold text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
            >
              Go home
            </Link>
          </div>
          {error.digest && (
            <p className="text-xs text-muted-foreground">Error reference: {error.digest}</p>
          )}
        </main>
      </body>
    </html>
  )
}
