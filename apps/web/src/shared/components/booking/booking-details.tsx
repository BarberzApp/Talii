'use client'

import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { logger } from '@/shared/lib/logger'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog'
import { useToast } from '@/shared/components/ui/use-toast'
import { api, bookingErrorMessage } from '@/shared/lib/api'
import {
  formatBookingDate,
  formatCents,
  formatTimeRange,
  type BookingActionResponse,
  type BookingListItem,
} from '@barber-app/shared'

interface BookingDetailsProps {
  booking: BookingListItem | null
  isOpen: boolean
  onClose: () => void
  onBookingCancelled: (bookingId: string, result: BookingActionResponse) => void
}

/** What the client gets back, per the refund policy (24 hours; barber cancels = full refund). */
function refundSummary(booking: BookingListItem, result: BookingActionResponse): string {
  if (result.refund) {
    const amount = formatCents(result.refund.amountCents)
    return result.refund.status === 'succeeded'
      ? `Your ${amount} booking fee was refunded.`
      : `A refund of ${amount} is on its way (${result.refund.status}).`
  }
  if (booking.booking_fee_cents === 0 || booking.payment_status !== 'succeeded') {
    return 'No payment was taken for this booking.'
  }
  return 'The booking fee is not refunded for cancellations within 24 hours of the appointment.'
}

function isCancellable(booking: BookingListItem): boolean {
  return (booking.status === 'pending' || booking.status === 'confirmed') && new Date(booking.starts_at) > new Date()
}

export function BookingDetails({ booking, isOpen, onClose, onBookingCancelled }: BookingDetailsProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  if (!booking) return null
  const timeZone = booking.barber?.timezone ?? 'America/New_York'
  const hoursUntilStart = (new Date(booking.starts_at).getTime() - Date.now()) / 3_600_000
  const feePaid = booking.booking_fee_cents > 0 && booking.payment_status === 'succeeded'

  const handleCancel = async () => {
    if (!isCancellable(booking)) {
      toast({ title: 'Cannot cancel', description: 'This booking can no longer be cancelled.', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const result = await api.bookings.cancel(booking.id)
      toast({ title: 'Booking cancelled', description: refundSummary(booking, result) })
      setShowCancelConfirm(false)
      onBookingCancelled(booking.id, result)
    } catch (error) {
      logger.error('Error cancelling booking', error)
      toast({ title: 'Could not cancel', description: bookingErrorMessage(error), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Booking Details</DialogTitle>
          <DialogDescription>
            View detailed information about your booking including date, time, service, and status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Date</h4>
              <p>{formatBookingDate(booking.starts_at, timeZone)}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Time</h4>
              <p>{formatTimeRange(booking.starts_at, booking.ends_at, timeZone)}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Service</h4>
              <p className="capitalize">{booking.service?.name ?? 'Service'}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
              <p className="capitalize">{booking.status.replace('_', ' ')}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Barber</h4>
              <p>{booking.barber?.business_name || booking.barber?.profile?.name || 'Barber'}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Price</h4>
              <p>
                {formatCents(booking.service_price_cents + booking.addon_total_cents)}
                {booking.booking_fee_cents > 0 && ` + ${formatCents(booking.booking_fee_cents)} fee`}
              </p>
            </div>
          </div>

          {booking.notes && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Notes</h4>
              <p>{booking.notes}</p>
            </div>
          )}

          {isCancellable(booking) && (
            <DialogFooter>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowCancelConfirm(true)}
                disabled={loading}
              >
                {loading ? "Cancelling..." : "Cancel Booking"}
              </Button>
            </DialogFooter>
          )}
        </div>

        <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Booking</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel this booking? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <p>
              {!feePaid
                ? 'No booking fee was charged, so nothing needs refunding.'
                : hoursUntilStart > 24
                  ? `Your ${formatCents(booking.booking_fee_cents)} booking fee will be refunded in full.`
                  : `This appointment is less than 24 hours away, so the ${formatCents(booking.booking_fee_cents)} booking fee will not be refunded.`}
            </p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCancelConfirm(false)}
              >
                No, keep it
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleCancel}
                disabled={loading}
              >
                Yes, cancel it
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
