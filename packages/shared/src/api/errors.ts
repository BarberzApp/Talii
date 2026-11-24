/**
 * An error from the Talii API (or from reaching it).
 *
 * `status` is the HTTP status (0 when the request never got a response) and
 * `code` the stable UPPER_SNAKE code from the `{ error: { code, message } }`
 * body, e.g. SLOT_TAKEN. `message` is written for people and safe to show.
 * `details` holds any other top-level fields of the error body (for example
 * `bookings` and `cancelledBookings` on DELETE /api/me's 409).
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: Record<string, unknown> | undefined

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError || (!!error && typeof error === 'object' && (error as { name?: unknown }).name === 'ApiError' && 'code' in error && 'status' in error)
}

/** True when `error` is an ApiError with one of the given codes. */
export function hasErrorCode(error: unknown, ...codes: string[]): error is ApiError {
  return isApiError(error) && codes.includes(error.code)
}

/** A message safe to show for any thrown value. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isApiError(error)) return error.message || fallback
  return fallback
}
