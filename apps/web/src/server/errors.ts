import 'server-only'

/**
 * An error whose code and message are safe to show the client.
 *
 * Throw it from a handler (or anything it calls) to return
 * `{ error: { code, message } }` with `status`. Anything else that escapes a
 * handler becomes a 500 with a generic message and is reported to Sentry.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export interface ErrorBody {
  error: { code: string; message: string }
}

export function errorResponse(status: number, code: string, message: string): Response {
  const body: ErrorBody = { error: { code, message } }
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export const INTERNAL_ERROR_MESSAGE = 'Something went wrong. Please try again.'

/** Postgres error codes we map; see supabase/migrations baseline. */
export const PG = {
  uniqueViolation: '23505',
  exclusionViolation: '23P01',
  invalidParameterValue: '22023',
} as const

export function pgCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}
