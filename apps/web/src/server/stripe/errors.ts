import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { ApiError } from '../errors'

export interface StripeErrorLike {
  type: string
  code?: string
  statusCode?: number
  message: string
}

/** True for errors thrown by the stripe library (StripeInvalidRequestError, ...). */
export function isStripeError(error: unknown): error is StripeErrorLike {
  if (!error || typeof error !== 'object') return false
  const type = (error as { type?: unknown }).type
  return typeof type === 'string' && type.startsWith('Stripe')
}

/**
 * Runs a Stripe call. A Stripe error is reported to Sentry and becomes
 * 502 STRIPE_ERROR with a generic message; anything else is rethrown.
 */
export async function callStripe<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (isStripeError(error)) {
      Sentry.captureException(error, { tags: { stripe_operation: operation } })
      throw new ApiError(502, 'STRIPE_ERROR', 'The payment provider is unavailable right now. Please try again.')
    }
    throw error
  }
}
