'use client'

import { useState, type FormEvent } from 'react'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { Loader2, CreditCard } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { formatCents } from '@barber-app/shared'

let stripePromise: Promise<Stripe | null> | null = null
export function getStripe() {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    stripePromise = key ? loadStripe(key) : Promise.resolve(null)
  }
  return stripePromise
}

/** Where Stripe sends the browser after confirming (and where we read the booking back). */
export function bookingReturnUrl(bookingId: string): string {
  return `${window.location.origin}/booking/success?booking_id=${encodeURIComponent(bookingId)}`
}

interface BookingPaymentProps {
  bookingId: string
  /** PaymentIntent client secret from POST /api/bookings. */
  clientSecret: string
  amountCents: number
  onCancel: () => void
  /** True while confirmPayment is in flight; the parent must not release the hold meanwhile. */
  onSubmittingChange?: (submitting: boolean) => void
}

/**
 * The PaymentIntent's status as Stripe reports it to the browser, or null when it
 * cannot be read. Used before releasing a hold: a succeeded or processing intent
 * means the client paid (or is paying), so the booking must not be cancelled.
 */
export async function paymentIntentStatus(clientSecret: string): Promise<string | null> {
  try {
    const stripe = await getStripe()
    if (!stripe) return null
    const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret)
    return paymentIntent?.status ?? null
  } catch {
    return null
  }
}

/**
 * Stripe Payment Element for the booking fee. The PaymentIntent was created by
 * POST /api/bookings; confirming sends the browser to /booking/success, which
 * waits for the webhook to confirm the booking.
 */
export function BookingPayment({ bookingId, clientSecret, amountCents, onCancel, onSubmittingChange }: BookingPaymentProps) {
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return (
      <p className="text-sm text-red-500">
        Payments are not configured (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing).
      </p>
    )
  }
  return (
    <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
      <PaymentForm
        bookingId={bookingId}
        amountCents={amountCents}
        onCancel={onCancel}
        onSubmittingChange={onSubmittingChange}
      />
    </Elements>
  )
}

function PaymentForm({
  bookingId,
  amountCents,
  onCancel,
  onSubmittingChange,
}: {
  bookingId: string
  amountCents: number
  onCancel: () => void
  onSubmittingChange?: (submitting: boolean) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmittingState] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setSubmitting = (value: boolean) => {
    setSubmittingState(value)
    onSubmittingChange?.(value)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setError(null)
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: bookingReturnUrl(bookingId) },
    })
    // Only reached when confirmation failed (success redirects to return_url).
    setError(confirmError?.message || 'Payment failed. Please try again.')
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || !elements || submitting}
          className="flex-1 bg-secondary text-primary-foreground font-semibold rounded-xl hover:bg-secondary/90"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Pay {formatCents(amountCents)}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
