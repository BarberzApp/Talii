import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MONTHS } from './enhanced-calendar'

interface EnhancedCalendarHeaderProps {
  currentDate: Date
  onPrevMonth: () => void
  onNextMonth: () => void
}

export function EnhancedCalendarHeader({
  currentDate,
  onPrevMonth,
  onNextMonth,
}: EnhancedCalendarHeaderProps) {
  return (
    <div className="calendar-header">
      <button
        className="calendar-nav-button"
        onClick={onPrevMonth}
        aria-label="Previous month"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <h2 className="calendar-title">
        {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
      </h2>

      <button
        className="calendar-nav-button"
        onClick={onNextMonth}
        aria-label="Next month"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </div>
  )
}

