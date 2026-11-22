"use client"

import React, { useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CalendarPlus, Clock, Loader2, MapPin } from "lucide-react"
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { api, errorMessage } from "@/shared/lib/api"
import { logger } from "@/shared/lib/logger"
import { storeRedirectUrl } from '@/shared/lib/redirect-utils'
import { paymentIntentStatus } from '@/shared/components/payment/booking-payment'
import { formatBookingDate, formatBookingTime, formatCents, timeZoneAbbreviation, type BookingListItem } from '@barber-app/shared'
import { downloadIcs } from '@/shared/lib/ical-export'

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

  const barberName = booking?.barber?.business_name || booking?.barber?.profile?.name || 'your barber'
  const place = [booking?.barber?.city, booking?.barber?.state].filter(Boolean).join(', ')
  const mapsUrl = place ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}` : null
  const canAddToCalendar = !!booking && (booking.status === 'confirmed' || booking.status === 'pending')

  const addToCalendar = () => {
    if (!booking) return
    downloadIcs(
      [{
        id: booking.id,
        start: booking.starts_at,
        end: booking.ends_at,
        summary: `${booking.service?.name ?? 'Appointment'} with ${barberName}`,
        description: [
          booking.service?.name,
          ...booking.addons.map((a) => a.name),
          `Pay ${formatCents(booking.service_price_cents + booking.addon_total_cents)} at the appointment.`,
          booking.barber?.profile?.username ? `${window.location.origin}/book/${booking.barber.profile.username}` : '',
        ].filter(Boolean).join('\n'),
        location: place || undefined,
      }],
      `talii-booking-${booking.id}.ics`,
    )
  }

  const signIn = () => {
    storeRedirectUrl(`/booking/success?booking_id=${encodeURIComponent(bookingId ?? '')}`)
    safePush('/login')
  }

  return (
    <div className="container max-w-2xl px-4 py-10 pb-36 md:pb-10">
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
            <div className="rounded-lg border p-4 space-y-2 text-sm">
              <p className="font-medium text-base">{booking.service?.name}{booking.addons.length > 0 && ` + ${booking.addons.map((a) => a.name).join(', ')}`}</p>
              <p>{barberName}</p>
              <p className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 flex-shrink-0 text-secondary" aria-hidden="true" />
                <span>
                  {formatBookingDate(booking.starts_at, timeZone)} at {formatBookingTime(booking.starts_at, timeZone)}{' '}
                  {timeZoneAbbreviation(timeZone, booking.starts_at)}
                  <span className="block text-xs text-muted-foreground">Barber&apos;s local time</span>
                </span>
              </p>
              {place && (
                <p className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-secondary" aria-hidden="true" />
                  <span>
                    {place}
                    {mapsUrl && (
                      <>
                        {' · '}
                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
                          Open in Maps
                        </a>
                      </>
                    )}
                  </span>
                </p>
              )}
              <p>
                Service {formatCents(booking.service_price_cents + booking.addon_total_cents)} (paid at the appointment)
                {booking.booking_fee_cents > 0 && ` · booking fee ${formatCents(booking.booking_fee_cents)}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {booking.booking_fee_cents > 0
                  ? 'Cancel more than 24 hours before your appointment and the booking fee is refunded in full. If the barber cancels, it is always refunded.'
                  : 'You can cancel from My bookings any time before the appointment starts.'}
              </p>
              {canAddToCalendar && (
                <Button variant="outline" size="sm" onClick={addToCalendar} className="mt-1">
                  <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                  Add to calendar
                </Button>
              )}
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
