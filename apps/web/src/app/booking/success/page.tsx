"use client"

import React, { useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { api, errorMessage } from "@/shared/lib/api"
import { logger } from "@/shared/lib/logger"
import { storeRedirectUrl } from '@/shared/lib/redirect-utils'
import { paymentIntentStatus } from '@/shared/components/payment/booking-payment'
import { formatBookingDate, formatBookingTime, formatCents, type BookingListItem } from '@barber-app/shared'

const POLL_INTERVAL_MS = 2000
const POLL_ATTEMPTS = 15

type View =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'confirmed'; booking: BookingListItem }
  | { kind: 'processing'; booking: BookingListItem | null }
  | { kind: 'still-processing'; booking: BookingListItem | null }
  | { kind: 'failed'; message: string }

/**
 * Landing page after booking. Stripe's Payment Element returns here with
 * ?booking_id=…&payment_intent=…&payment_intent_client_secret=…&redirect_status=…;
 * fee-exempt bookings come here with only booking_id. The client secret is read
 * once and removed from the address bar. The booking is read with
 * GET /api/bookings and polled briefly until the Stripe webhook confirms it.
 */
function BookingSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const bookingId = searchParams.get('booking_id')
  const redirectStatus = searchParams.get('redirect_status')
  // Read the client secret once, then keep it out of the URL (history, logs, referrers).
  const clientSecretRef = useRef<string | null>(searchParams.get('payment_intent_client_secret'))
  const { push: safePush } = useSafeNavigation()
  const { status } = useAuth()
  const [view, setView] = useState<View>({ kind: 'loading' })
  /** Stripe's own word on the payment (null when there was none, or it could not be read). */
  const [intentStatus, setIntentStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!searchParams.get('payment_intent_client_secret') && !searchParams.get('payment_intent')) return
    const params = new URLSearchParams(searchParams.toString())
    params.delete('payment_intent_client_secret')
    params.delete('payment_intent')
    router.replace(`${pathname}?${params.toString()}`)
  }, [searchParams, router, pathname])

  useEffect(() => {
    if (status === 'loading') return
    if (!bookingId) {
      setView({ kind: 'failed', message: 'No booking was given.' })
      return
    }
    if (status === 'unauthenticated') {
      setView({ kind: 'signed-out' })
      return
    }

    let cancelled = false

    const findBooking = async (): Promise<BookingListItem | null> => {
      // The booking starts in the future; a client has at most a handful of upcoming ones.
      const { bookings } = await api.bookings.list({
        as: 'client',
        from: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        order: 'asc',
        limit: 100,
      })
      return bookings.find((b) => b.id === bookingId) ?? null
    }

    const run = async () => {
      const secret = clientSecretRef.current
      const piStatus = secret ? await paymentIntentStatus(secret) : null
      if (cancelled) return
      setIntentStatus(piStatus)

      // Payment failed (and did not succeed after all): release the hold so the slot frees up.
      if (redirectStatus === 'failed' && piStatus !== 'succeeded' && piStatus !== 'processing') {
        try {
          await api.bookings.cancel(bookingId, 'Payment failed')
        } catch (error) {
          logger.warn('Could not release the hold after a failed payment', error)
        }
        if (!cancelled) setView({ kind: 'failed', message: 'Your payment did not go through, so the time was released. Please try booking again.' })
        return
      }

      let last: BookingListItem | null = null
      for (let attempt = 0; attempt < POLL_ATTEMPTS && !cancelled; attempt++) {
        try {
          const booking = await findBooking()
          if (cancelled) return
          last = booking
          if (booking?.status === 'confirmed' || booking?.status === 'completed') {
            setView({ kind: 'confirmed', booking })
            return
          }
          if (booking?.status === 'cancelled') {
            setView({
              kind: 'failed',
              message:
                booking.cancellation_reason === 'hold_expired'
                  ? 'The time you picked was released before payment finished. Any charge will be refunded.'
                  : 'This booking was cancelled.',
            })
            return
          }
          setView({ kind: 'processing', booking })
        } catch (error) {
          logger.error('Error loading booking', error)
          if (!cancelled) setView({ kind: 'failed', message: errorMessage(error, 'Could not load your booking.') })
          return
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      }
      if (!cancelled) setView({ kind: 'still-processing', booking: last })
    }

    run()
    return () => {
      cancelled = true
    }
  }, [bookingId, redirectStatus, status])

  const booking =
    view.kind === 'confirmed' || view.kind === 'processing' || view.kind === 'still-processing' ? view.booking : null
  const timeZone = booking?.barber?.timezone ?? 'America/New_York'
  const paid = intentStatus === 'succeeded'
  const paying = intentStatus === 'processing'

  const signIn = () => {
    storeRedirectUrl(`/booking/success?booking_id=${encodeURIComponent(bookingId ?? '')}`)
    safePush('/login')
  }

  return (
    <div className="container max-w-2xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>
            {view.kind === 'confirmed' && 'Booking confirmed'}
            {view.kind === 'processing' && 'Confirming your booking…'}
            {view.kind === 'still-processing' && 'Still processing'}
            {view.kind === 'loading' && 'Loading your booking…'}
            {view.kind === 'signed-out' && 'Sign in to see your booking'}
            {view.kind === 'failed' && 'Booking not completed'}
          </CardTitle>
          <CardDescription>
            {view.kind === 'confirmed' && 'You are all set. See your bookings on your profile.'}
            {view.kind === 'processing' &&
              (paid
                ? 'Your payment was received. We are waiting for the confirmation, which usually takes a few seconds.'
                : paying
                  ? 'Your payment is processing. This usually takes a few seconds.'
                  : 'We are confirming your booking. This usually takes a few seconds.')}
            {view.kind === 'still-processing' &&
              'This is taking longer than usual. Check your bookings on your profile in a few minutes; if the booking does not go through, any charge is refunded automatically.'}
            {view.kind === 'signed-out' &&
              'Your session ended on this device. Sign in to check the status of your booking.'}
            {view.kind === 'failed' && view.message}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(view.kind === 'loading' || (view.kind === 'processing' && !booking)) && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-8 w-8 animate-spin text-secondary" />
            </div>
          )}

          {booking && (
            <div className="rounded-lg border p-4 space-y-1 text-sm">
              <p className="font-medium">{booking.service?.name}</p>
              <p>
                {booking.barber?.business_name || booking.barber?.profile?.name}
              </p>
              <p>
                {formatBookingDate(booking.starts_at, timeZone)} at {formatBookingTime(booking.starts_at, timeZone)}
              </p>
              <p>
                Service {formatCents(booking.service_price_cents + booking.addon_total_cents)} (paid at the appointment)
                {booking.booking_fee_cents > 0 && ` · booking fee ${formatCents(booking.booking_fee_cents)}`}
              </p>
              {view.kind === 'processing' && (
                <p className="text-muted-foreground flex items-center gap-2 pt-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Waiting for confirmation
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            {view.kind === 'signed-out' ? (
              <Button onClick={signIn} className="flex-1">
                Sign in
              </Button>
            ) : (
              <Button onClick={() => safePush('/profile')} className="flex-1">
                My bookings
              </Button>
            )}
            <Button variant="outline" onClick={() => safePush('/browse')} className="flex-1">
              Browse barbers
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function BookingSuccessPage() {
  return (
    <React.Suspense fallback={null}>
      <BookingSuccessContent />
    </React.Suspense>
  )
}
