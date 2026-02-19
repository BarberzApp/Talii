import { format } from 'date-fns'
import { Calendar as CalendarIcon, Clock } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from './enhanced-calendar'

interface EnhancedCalendarEventsPanelProps {
  selectedDate: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  formatTime: (date: Date) => string
}

export function EnhancedCalendarEventsPanel({
  selectedDate,
  events,
  onEventClick,
  formatTime,
}: EnhancedCalendarEventsPanelProps) {
  return (
    <div className="events-panel">
      <h3 className="text-white font-bold text-lg mb-4 flex items-center">
        <CalendarIcon className="w-5 h-5 mr-2 text-secondary" />
        {format(selectedDate, 'EEEE, MMMM d, yyyy')}
      </h3>

      <div className="event-list">
        {events.length > 0 ? (
          events.map((event) => {
            const eventEnd = new Date(event.end)
            const now = new Date()
            const isPast = eventEnd < now
            const isUpcoming = new Date(event.start) > now
            const isMissed = event.extendedProps.status === 'cancelled'

            return (
              <div
                key={event.id}
                className={cn(
                  'event-item p-4 mb-3',
                  isMissed ? 'missed' : isPast ? 'past' : 'upcoming',
                )}
                onClick={() => onEventClick(event)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onEventClick(event)
                  }
                }}
                aria-label={`Event: ${event.title}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="text-white font-semibold text-sm mb-1">
                      {event.extendedProps.serviceName}
                    </h4>
                    <p className="text-white/80 text-xs mb-2">
                      {event.extendedProps.clientName}
                    </p>
                    <div
                      className={cn(
                        'flex items-center text-xs',
                        isMissed
                          ? 'text-red-400'
                          : isPast
                            ? 'text-green-400'
                            : 'text-secondary',
                      )}
                    >
                      <Clock
                        className={cn(
                          'w-3 h-3 mr-1',
                          isMissed
                            ? 'text-red-400'
                            : isPast
                              ? 'text-green-400'
                              : 'text-secondary',
                        )}
                      />
                      <span className="font-medium">
                        {formatTime(new Date(event.start))}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-xs font-semibold',
                        isMissed
                          ? 'bg-red-500/20 text-red-400 border-red-500/30'
                          : isPast
                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                            : 'bg-secondary/20 text-secondary border-secondary/30',
                      )}
                    >
                      ${event.extendedProps.basePrice}
                    </Badge>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center py-8">
            <CalendarIcon className="w-12 h-12 mx-auto text-white/30 mb-3" />
            <p className="text-white/60 text-sm">
              No events scheduled for this date
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

