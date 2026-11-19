"use client"

import React, { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { api, errorMessage } from "@/shared/lib/api"
import { logger } from "@/shared/lib/logger"
import { formatBookingDate, formatBookingTime, formatCents, type BookingListItem } from '@barber-app/shared'

const POLL_INTERVAL_MS = 2000
const POLL_ATTEMPTS = 15

type View =
  | { kind: 'loading' }
  | { kind: 'confirmed'; booking: BookingListItem }
  | { kind: 'processing'; booking: BookingListItem | null }
  | { kind: 'failed'; message: string }

/**
 * Landing page after booking. Stripe's Payment Element returns here with
 * ?booking_id=…&payment_intent=…&redirect_status=…; fee-exempt bookings come
 * here directly. The booking is read with GET /api/bookings and polled briefly
 * until the Stripe webhook has confirmed it.
 */
function BookingSuccessContent() {
  const searchParams = useSearchParams()
  const bookingId = searchParams.get('booking_id')
  const redirectStatus = searchParams.get('redirect_status')
  const { push: safePush } = useSafeNavigation()
  const { status } = useAuth()
  const [view, setView] = useState<View>({ kind: 'loading' })

  useEffect(() => {
    if (status === 'loading') return
    if (!bookingId) {
      setView({ kind: 'failed', message: 'No booking was given.' })
      return
    }
    if (redirectStatus === 'failed') {
      setView({ kind: 'failed', message: 'Your payment did not go through. Please try booking again.' })
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

    const poll = async () => {
      for (let attempt = 0; attempt < POLL_ATTEMPTS && !cancelled; attempt++) {
        try {
          const booking = await findBooking()
          if (cancelled) return
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
    }

    poll()
    return () => {
      cancelled = true
    }
  }, [bookingId, redirectStatus, status])

  const booking = view.kind === 'confirmed' || view.kind === 'processing' ? view.booking : null
  const timeZone = booking?.barber?.timezone ?? 'America/New_York'

  return (
    <div className="container max-w-2xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>
            {view.kind === 'confirmed' && 'Booking confirmed'}
            {view.kind === 'processing' && 'Confirming your booking…'}
            {view.kind === 'loading' && 'Loading your booking…'}
            {view.kind === 'failed' && 'Booking not completed'}
          </CardTitle>
          <CardDescription>
            {view.kind === 'confirmed' && 'You are all set. See your bookings on your profile.'}
            {view.kind === 'processing' &&
              'Your payment was received. We are waiting for the confirmation, which usually takes a few seconds.'}
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
                  <Loader2 className="h-4 w-4 animate-spin" /> Waiting for payment confirmation
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={() => safePush('/profile')} className="flex-1">
              My bookings
            </Button>
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
