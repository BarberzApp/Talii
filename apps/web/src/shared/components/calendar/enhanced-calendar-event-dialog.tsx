import { formatBookingDate, formatCents, formatTimeRange, timeZoneAbbreviation } from '@barber-app/shared'
import {
  Clock,
  DollarSign,
  Loader2, Scissors,
  User, DownloadIcon
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { downloadIcs } from '@/shared/lib/ical-export'
import { logger } from '@/shared/lib/logger'
import type { CalendarEvent } from './enhanced-calendar'

interface CalendarUser {
  email?: string | null
  user_metadata?: {
    full_name?: string
  }
}

interface EnhancedCalendarEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedEvent: CalendarEvent | null
  onMarkAsMissed: () => Promise<void> | void
  isMarkingMissed: boolean
  onMarkCompleted: () => Promise<void> | void
  onCancel: () => Promise<void> | void
  actionPending: null | 'complete' | 'cancel'
  user: CalendarUser | null
}

/** What cancelling does to the booking fee, per the API's refund policy. */
function refundPreview(event: CalendarEvent): string {
  const p = event.extendedProps
  const paid = p.bookingFeeCents > 0 && (p.paymentStatus === 'succeeded' || p.paymentStatus === 'partially_refunded')
  if (!paid) return 'No booking fee was charged, so nothing is refunded.'
  if (p.isBarberView) return `The client's ${formatCents(p.bookingFeeCents)} booking fee will be refunded in full.`
  const hours = (Date.parse(event.start) - Date.now()) / 3_600_000
  return hours > 24
    ? `Your ${formatCents(p.bookingFeeCents)} booking fee will be refunded in full.`
    : `This is less than 24 hours away, so the ${formatCents(p.bookingFeeCents)} booking fee is not refunded.`
}

export function EnhancedCalendarEventDialog({
  open,
  onOpenChange,
  selectedEvent,
  onMarkAsMissed,
  isMarkingMissed,
  onMarkCompleted,
  onCancel,
  actionPending,
}: EnhancedCalendarEventDialogProps) {
  const [confirmCancel, setConfirmCancel] = useState(false)
  useEffect(() => setConfirmCancel(false), [selectedEvent?.id, open])
  const started = !!selectedEvent && Date.parse(selectedEvent.start) <= Date.now()
  const status = selectedEvent?.extendedProps.status
  const canComplete = !!selectedEvent?.extendedProps.isBarberView && status === 'confirmed' && started
  const canCancel = !!selectedEvent && (status === 'pending' || status === 'confirmed') && !started
  const tz = selectedEvent?.extendedProps.timeZone ?? 'America/New_York'

  const handleDownloadICal = () => {
    if (!selectedEvent) return
    try {
      const p = selectedEvent.extendedProps
      downloadIcs(
        [{
          id: selectedEvent.id,
          start: selectedEvent.start,
          end: selectedEvent.end,
          summary: p.isBarberView ? `${p.serviceName} with ${p.clientName}` : `${p.serviceName} with ${p.barberName}`,
          description: [p.serviceName, ...p.addonNames].join(', '),
        }],
        `appointment-${selectedEvent.id}.ics`,
      )
    } catch (error) {
      logger.error('Error downloading iCal file', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full max-h-[90vh] bg-background border border-border rounded-[2rem] shadow-2xl p-6 sm:p-8 overflow-hidden">
        <DialogHeader className="pb-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'p-3 rounded-xl border transition-all duration-500',
                  selectedEvent?.extendedProps.isBarberView
                    ? 'bg-secondary/15 border-secondary/20 shadow-lg shadow-secondary/5'
                    : 'bg-secondary/20 border-secondary/30 shadow-lg shadow-secondary/10',
                )}
              >
                {selectedEvent?.extendedProps.isBarberView ? (
                  <User className="w-6 h-6 text-secondary" />
                ) : (
                  <Scissors className="w-6 h-6 text-secondary" />
                )}
              </div>
              <div>
                <DialogTitle className="text-foreground text-4xl font-bebas tracking-wider leading-none">
                  {selectedEvent?.extendedProps.isBarberView
                    ? 'Client Booking'
                    : 'My Appointment'}
                </DialogTitle>
                <DialogDescription className="text-foreground/50 text-base font-medium italic mt-1">
                  {selectedEvent && formatBookingDate(selectedEvent.start, tz)}
                </DialogDescription>
              </div>
            </div>
            <Badge
              variant="secondary"
              className={cn(
                'text-[10px] font-black uppercase tracking-widest px-3 py-1 border rounded-full',
                selectedEvent?.extendedProps.status === 'cancelled'
                  ? 'bg-red-500/10 text-red-500 border-red-500/20'
                  : 'bg-green-500/10 text-green-500 border-green-500/20',
              )}
            >
              {selectedEvent?.extendedProps.status}
            </Badge>
          </div>
        </DialogHeader>

        {selectedEvent && (
          <div className="space-y-6 overflow-y-auto flex-1 max-h-[65vh] pr-2 custom-scrollbar">
            {/* Main Info Card */}
            <div className="rounded-[2rem] p-6 bg-foreground/[0.03] border border-foreground/5 backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-secondary/10 transition-colors duration-700" />
              
              <div className="flex items-center justify-between mb-8 relative z-10">
                <div>
                  <h3 className="text-foreground font-bebas text-4xl mb-1 tracking-wide leading-none">
                    {selectedEvent.extendedProps.serviceName}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-secondary tracking-tighter drop-shadow-sm">
                    ${selectedEvent.extendedProps.price.toFixed(2)}
                  </div>
                  <div className="text-foreground/40 text-[9px] font-bold uppercase tracking-widest leading-none">Paid in person</div>
                </div>
              </div>

              <div className="space-y-3">
                {selectedEvent.extendedProps.isBarberView ? (
                  <div className="flex items-center gap-4 p-4 bg-foreground/[0.02] rounded-2xl border border-foreground/5 group/info hover:bg-foreground/[0.04] transition-all">
                    <div className="p-3 bg-secondary/15 rounded-xl border border-secondary/20 group-hover/info:scale-110 transition-transform">
                      <User className="w-5 h-5 text-secondary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-foreground/30 text-[9px] uppercase font-black tracking-widest mb-0.5">Customer</p>
                      <p className="text-foreground font-bold text-lg tracking-tight leading-tight">
                        {selectedEvent.extendedProps.clientName}
                      </p>
                      {selectedEvent.extendedProps.isGuest && (
                        <Badge variant="outline" className="mt-1 bg-secondary/5 text-secondary border-secondary/20 text-[9px] font-black uppercase tracking-tighter">Walk-in</Badge>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 p-4 bg-foreground/[0.02] rounded-2xl border border-foreground/5 group/info hover:bg-foreground/[0.04] transition-all">
                    <div className="p-3 bg-secondary/15 rounded-xl border border-secondary/20 group-hover/info:scale-110 transition-transform">
                      <Scissors className="w-5 h-5 text-secondary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-foreground/30 text-[9px] uppercase font-black tracking-widest mb-0.5">Barber</p>
                      <p className="text-foreground font-bold text-lg tracking-tight leading-tight">
                        {selectedEvent.extendedProps.barberName}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 p-4 bg-foreground/[0.02] rounded-2xl border border-foreground/5 group/info hover:bg-foreground/[0.04] transition-all">
                  <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20 group-hover/info:scale-110 transition-transform">
                    <Clock className="w-5 h-5 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-foreground/30 text-[9px] uppercase font-black tracking-widest mb-0.5">Time Slot</p>
                    <p className="text-foreground font-bold text-lg tracking-tight leading-tight">
                      {formatTimeRange(selectedEvent.start, selectedEvent.end, tz)} {timeZoneAbbreviation(tz, selectedEvent.start)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Price Breakdown */}
            {selectedEvent.extendedProps.addonTotal > 0 && (
              <div className="rounded-[2rem] p-6 bg-foreground/[0.02] border border-foreground/5">
                <h4 className="text-foreground font-bebas text-2xl mb-5 flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-secondary" />
                  Breakdown
                </h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-foreground/40 font-medium italic">Base Service</span>
                    <span className="text-foreground font-bold">${selectedEvent.extendedProps.basePrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-foreground/40 font-medium italic">Add-ons</span>
                    <span className="text-foreground font-bold">${selectedEvent.extendedProps.addonTotal.toFixed(2)}</span>
                  </div>
                  <div className="pt-4 border-t border-foreground/5 flex justify-between items-center">
                    <span className="text-foreground font-bebas text-3xl tracking-wide uppercase opacity-70">Total</span>
                    <span className="text-secondary font-bold text-4xl tracking-tighter">${selectedEvent.extendedProps.price.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="mt-6 flex flex-wrap gap-2">
                  {selectedEvent.extendedProps.addonNames.map((addon, i) => (
                    <Badge key={i} variant="outline" className="bg-foreground/5 text-foreground/60 border-foreground/10 text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded-lg">
                      {addon}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-4">
              {canComplete && (
                <Button
                  onClick={onMarkCompleted}
                  disabled={actionPending !== null}
                  className="w-full bg-green-500/10 hover:bg-green-600 text-green-600 hover:text-white font-bold py-7 rounded-2xl border border-green-500/20 transition-all active:scale-[0.98]"
                >
                  {actionPending === 'complete' ? <Loader2 className="animate-spin" /> : 'Mark Completed'}
                </Button>
              )}

              {canCancel && !confirmCancel && (
                <Button
                  onClick={() => setConfirmCancel(true)}
                  variant="outline"
                  className="w-full border-red-500/30 text-red-500 hover:bg-red-500/10 font-bold py-6 rounded-2xl"
                >
                  Cancel Booking
                </Button>
              )}

              {canCancel && confirmCancel && selectedEvent && (
                <div className="rounded-2xl border border-red-500/20 p-4 space-y-3">
                  <p className="text-sm text-foreground/80">{refundPreview(selectedEvent)}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setConfirmCancel(false)} disabled={actionPending !== null}>
                      Keep it
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      disabled={actionPending !== null}
                      onClick={async () => {
                        await onCancel()
                        setConfirmCancel(false)
                      }}
                    >
                      {actionPending === 'cancel' ? <Loader2 className="animate-spin" /> : 'Yes, cancel'}
                    </Button>
                  </div>
                </div>
              )}

              {canComplete && (
                <Button
                  onClick={onMarkAsMissed}
                  disabled={isMarkingMissed || actionPending !== null}
                  variant="destructive"
                  className="w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white font-bold py-7 rounded-2xl border border-red-500/20 transition-all active:scale-[0.98]"
                >
                  {isMarkingMissed ? <Loader2 className="animate-spin" /> : 'Mark as Missed'}
                </Button>
              )}

              <div className="grid grid-cols-1 gap-3">
                <Button
                  onClick={handleDownloadICal}
                  variant="outline"
                  className="bg-foreground/[0.02] border-foreground/5 text-foreground/70 hover:bg-foreground/5 font-bold py-6 rounded-2xl transition-all"
                >
                  <DownloadIcon className="w-4 h-4 mr-2 opacity-40" />
                  Add to calendar
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="pt-6 flex-shrink-0">
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full bg-secondary text-primary-foreground hover:bg-secondary/90 font-bold py-7 rounded-2xl text-lg shadow-xl shadow-secondary/20 transition-all active:scale-95"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
