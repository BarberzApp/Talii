import { format, isSameDay, isSameMonth, isToday } from 'date-fns'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from './enhanced-calendar'

interface EnhancedCalendarGridProps {
  calendarDays: Date[]
  weekdays: string[]
  currentDate: Date
  selectedDate: Date | null
  getEventsForDate: (date: Date) => CalendarEvent[]
  hasPastEvents: (date: Date) => boolean
  hasUpcomingEvents: (date: Date) => boolean
  onDateClick: (date: Date) => void
}

export function EnhancedCalendarGrid({
  calendarDays,
  weekdays,
  currentDate,
  selectedDate,
  getEventsForDate,
  hasPastEvents,
  hasUpcomingEvents,
  onDateClick,
}: EnhancedCalendarGridProps) {
  return (
    <div className="w-full">
      <div className="weekdays-header">
        {weekdays.map((day) => (
          <div key={day} className="weekday">
            {day}
          </div>
        ))}
      </div>
      <div className="calendar-grid">
        {calendarDays.map((day, index) => {
          const isCurrentMonth = isSameMonth(day, currentDate)
          const isTodayDate = isToday(day)
          const isSelected = selectedDate && isSameDay(day, selectedDate)
          const dayEvents = getEventsForDate(day)

          return (
            <div
              key={index}
              className={cn(
                'calendar-day',
                !isCurrentMonth && 'other-month',
                isTodayDate && 'today',
                isSelected && 'selected',
                hasPastEvents(day) && 'has-past-events',
                hasUpcomingEvents(day) && 'has-upcoming-events',
              )}
              onClick={() => onDateClick(day)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onDateClick(day)
                }
              }}
              aria-label={`${format(day, 'EEEE, MMMM d, yyyy')}${
                dayEvents.length > 0 ? ` - ${dayEvents.length} events` : ''
              }`}
            >
              {format(day, 'd')}
            </div>
          )
        })}
      </div>
    </div>
  )
}

