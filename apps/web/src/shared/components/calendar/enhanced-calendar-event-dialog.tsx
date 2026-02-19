import { format } from 'date-fns'
import {
  Calendar as CalendarIcon,
  Clock,
  DollarSign,
  ExternalLink,
  Loader2,
  Mail,
  Phone,
  Scissors,
  User,
  X,
  DownloadIcon,
} from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/lib/utils'
import { addToGoogleCalendar, downloadICalFile } from '@/shared/lib/google-calendar-utils'
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
  user: CalendarUser | null
}

const formatTime = (date: Date) => format(date, 'h:mm a')
const formatDate = (date: Date) => format(date, 'MMM d, yyyy')

export function EnhancedCalendarEventDialog({
  open,
  onOpenChange,
  selectedEvent,
  onMarkAsMissed,
  isMarkingMissed,
  user,
}: EnhancedCalendarEventDialogProps) {
  const handleAddToGoogleCalendar = () => {
    if (!selectedEvent) return
    try {
      addToGoogleCalendar(
        selectedEvent,
        selectedEvent.extendedProps.isBarberView ? 'barber' : 'client',
        {
          name:
            user?.user_metadata?.full_name ||
            (selectedEvent.extendedProps.isBarberView ? 'Barber' : 'Client'),
          email: user?.email || '',
          location: '',
        },
      )
    } catch (error) {
      logger.error('Error adding to Google Calendar', error)
    }
  }

  const handleDownloadICal = () => {
    if (!selectedEvent) return
    try {
      downloadICalFile(
        [selectedEvent],
        selectedEvent.extendedProps.isBarberView ? 'barber' : 'client',
        {
          name:
            user?.user_metadata?.full_name ||
            (selectedEvent.extendedProps.isBarberView ? 'Barber' : 'Client'),
          email: user?.email || '',
          location: '',
        },
        `appointment-${selectedEvent.id}.ics`,
      )
    } catch (error) {
      logger.error('Error downloading iCal file', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black/95 backdrop-blur-3xl border border-white/20 max-w-lg mx-4 max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden">
        <DialogHeader className="pb-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'p-3 rounded-xl',
                  selectedEvent?.extendedProps.isBarberView
                    ? 'bg-blue-500/20'
                    : 'bg-secondary/20',
                )}
              >
                {selectedEvent?.extendedProps.isBarberView ? (
                  <User className="w-6 h-6 text-blue-400" />
                ) : (
                  <Scissors className="w-6 h-6 text-secondary" />
                )}
              </div>
              <div>
                <DialogTitle className="text-white text-2xl font-bold">
                  {selectedEvent?.extendedProps.isBarberView
                    ? 'Client Booking'
                    : 'My Appointment'}
                </DialogTitle>
                <DialogDescription className="text-white/70 text-sm">
                  {selectedEvent && formatDate(new Date(selectedEvent.start))}
                </DialogDescription>
              </div>
            </div>
            <Badge
              variant={
                selectedEvent?.extendedProps.status === 'confirmed'
                  ? 'default'
                  : 'secondary'
              }
              className={cn(
                'text-xs font-semibold px-3 py-1',
                selectedEvent?.extendedProps.status === 'cancelled' &&
                  'bg-red-500/20 text-red-400 border-red-500/30',
              )}
            >
              {selectedEvent?.extendedProps.status}
            </Badge>
          </div>
        </DialogHeader>

        {selectedEvent && (
          <div className="space-y-6 overflow-y-auto flex-1 max-h-[65vh] pr-2">
            <div
              className={cn(
                'rounded-2xl p-6 transition-all duration-300 border',
                selectedEvent.extendedProps.status === 'cancelled'
                  ? 'bg-red-500/10 border-red-500/30 shadow-lg shadow-red-500/20'
                  : selectedEvent.extendedProps.isBarberView
                    ? 'bg-blue-500/10 border-blue-500/30 shadow-lg shadow-blue-500/20'
                    : 'bg-secondary/10 border-secondary/30 shadow-lg shadow-secondary/20',
              )}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-white font-bold text-xl mb-1">
                    {selectedEvent.extendedProps.serviceName}
                  </h3>
                  <p className="text-white/60 text-sm">
                    {selectedEvent.extendedProps.isBarberView
                      ? 'Client Request'
                      : 'Your Service'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">
                    ${selectedEvent.extendedProps.price}
                  </div>
                  <div className="text-white/60 text-xs">Total Amount</div>
                </div>
              </div>

              <div className="space-y-4">
                {selectedEvent.extendedProps.isBarberView ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <User className="w-5 h-5 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white/60 text-xs uppercase tracking-wide mb-1">
                          Client
                        </p>
                        <p className="text-white font-semibold text-lg">
                          {selectedEvent.extendedProps.clientName}
                        </p>
                        {selectedEvent.extendedProps.isGuest && (
                          <p className="text-blue-400 text-xs mt-1">
                            Guest Booking
                          </p>
                        )}
                      </div>
                    </div>

                    {selectedEvent.extendedProps.isGuest && (
                      <div className="space-y-3 p-4 bg-blue-500/5 rounded-xl border border-blue-500/20">
                        <h4 className="text-blue-400 font-semibold text-sm mb-3">
                          Contact Information
                        </h4>
                        <div className="flex items-center gap-3">
                          <Mail className="w-4 h-4 text-blue-400" />
                          <span className="text-white/80 text-sm">
                            {selectedEvent.extendedProps.guestEmail}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Phone className="w-4 h-4 text-blue-400" />
                          <span className="text-white/80 text-sm">
                            {selectedEvent.extendedProps.guestPhone}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="p-2 bg-secondary/20 rounded-lg">
                      <Scissors className="w-5 h-5 text-secondary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white/60 text-xs uppercase tracking-wide mb-1">
                        Barber
                      </p>
                      <p className="text-white font-semibold text-lg">
                        {selectedEvent.extendedProps.barberName}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Clock className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white/60 text-xs uppercase tracking-wide mb-1">
                      Appointment Time
                    </p>
                    <p className="text-white font-semibold text-lg">
                      {formatTime(new Date(selectedEvent.start))} -{' '}
                      {formatTime(new Date(selectedEvent.end))}
                    </p>
                    <p className="text-white/60 text-sm mt-1">
                      {formatDate(new Date(selectedEvent.start))}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {selectedEvent.extendedProps.addonTotal > 0 && (
              <div className="rounded-2xl p-6 bg-white/5 border border-white/10">
                <h4 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-secondary" />
                  Price Breakdown
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/80">Base Service</span>
                    <span className="text-white font-semibold">
                      ${selectedEvent.extendedProps.basePrice}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/80">Add-ons</span>
                    <span className="text-white font-semibold">
                      ${selectedEvent.extendedProps.addonTotal}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 pt-3">
                    <span className="text-white font-bold text-lg">Total</span>
                    <span className="text-secondary font-bold text-xl">
                      ${selectedEvent.extendedProps.price}
                    </span>
                  </div>
                </div>

                {selectedEvent.extendedProps.addonNames.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <h5 className="text-white/60 text-sm mb-3">
                      Selected Add-ons:
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {selectedEvent.extendedProps.addonNames.map(
                        (addonName, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="text-xs bg-secondary/20 text-secondary border-secondary/30"
                          >
                            {addonName}
                          </Badge>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              {selectedEvent.extendedProps.isBarberView &&
                selectedEvent.extendedProps.status !== 'cancelled' && (
                  <div className="flex gap-3">
                    <Button
                      onClick={onMarkAsMissed}
                      disabled={isMarkingMissed}
                      variant="destructive"
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                    >
                      {isMarkingMissed ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Marking as Missed...
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4 mr-2" />
                          Mark as Missed
                        </>
                      )}
                    </Button>
                  </div>
                )}

              <div className="rounded-2xl p-4 bg-white/5 border border-white/10">
                <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-secondary" />
                  Add to Calendar
                </h4>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddToGoogleCalendar}
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-white/5 border-white/20 text-white hover:bg-white/10"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Google Calendar
                  </Button>

                  <Button
                    onClick={handleDownloadICal}
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-white/5 border-white/20 text-white hover:bg-white/10"
                  >
                    <DownloadIcon className="w-4 h-4 mr-2" />
                    Download iCal
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="pt-6 flex-shrink-0">
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full bg-secondary text-primary hover:bg-secondary/90 font-semibold py-3"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

