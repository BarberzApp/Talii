"use client"

import { useState, useEffect } from 'react'
import { logger } from '@/shared/lib/logger'
import { cn } from '@/shared/lib/utils'
import { api, bookingErrorMessage } from '@/shared/lib/api'
import { formatBookingTime, formatCents, formatInTimeZone, localDateInTimeZone, timeZoneAbbreviation, type BookingListItem } from '@barber-app/shared'
import { useToast } from '@/shared/components/ui/use-toast'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns'
import { EnhancedCalendarHeader } from './enhanced-calendar-header'
import { EnhancedCalendarGrid } from './enhanced-calendar-grid'
import { EnhancedCalendarEventsPanel } from './enhanced-calendar-events-panel'
import { EnhancedCalendarEventDialog } from './enhanced-calendar-event-dialog'

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const CALENDAR_STYLES = `
          .calendar-container {
            background: rgba(0, 0, 0, 0.03);
            border-radius: 2.5rem;
            backdrop-filter: blur(40px);
            border: 1px solid rgba(0, 0, 0, 0.05);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            padding: 2.5rem;
            transition: all 0.5s ease;
          }
          
          :global(.dark) .calendar-container {
            background: rgba(255, 255, 255, 0.04);
            border-color: rgba(255, 255, 255, 0.08);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          }
          
          .calendar-day {
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            border-radius: 1.25rem;
            position: relative;
            overflow: hidden;
            min-height: 72px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            user-select: none;
            background: rgba(0, 0, 0, 0.02);
            border: 1px solid rgba(0, 0, 0, 0.03);
            font-weight: 600;
          }
          
          :global(.dark) .calendar-day {
            background: rgba(255, 255, 255, 0.02);
            border-color: rgba(255, 255, 255, 0.04);
          }
          
          .calendar-day:hover {
            transform: translateY(-5px) scale(1.05);
            box-shadow: 0 15px 30px rgba(var(--secondary-rgb), 0.2);
            background: rgba(var(--secondary-rgb), 0.1);
            border-color: rgba(var(--secondary-rgb), 0.2);
          }
          
          .calendar-day:active {
            transform: scale(0.94);
          }
          
          .calendar-day.has-upcoming-events {
            background: linear-gradient(135deg, rgba(var(--secondary-rgb), 0.1) 0%, rgba(var(--secondary-rgb), 0.05) 100%);
            border: 2px solid rgba(var(--secondary-rgb), 0.2);
          }
          
          .calendar-day.has-past-events {
            background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%);
            border: 2px solid rgba(34, 197, 94, 0.2);
          }
          
          .calendar-day.selected {
            background: linear-gradient(135deg, hsl(var(--secondary)) 0%, #ff8c00 100%);
            color: white !important;
            transform: translateY(-8px) scale(1.12);
            box-shadow: 0 20px 40px rgba(var(--secondary-rgb), 0.4);
            border: 2px solid rgba(255, 255, 255, 0.4);
            z-index: 10;
          }
          
          .calendar-day.today {
            background: rgba(var(--secondary-rgb), 0.15);
            border: 2px solid hsl(var(--secondary));
            color: hsl(var(--secondary)) !important;
            box-shadow: 0 0 20px rgba(var(--secondary-rgb), 0.2);
          }
          
          .event-item {
            border-radius: 1.5rem;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            cursor: pointer;
            backdrop-filter: blur(15px);
            padding: 1.25rem;
            border: 1px solid transparent;
          }
          
          .event-item:hover {
            transform: translateY(-4px) scale(1.02);
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
          }
          
          .event-item.upcoming {
            background: linear-gradient(145deg, rgba(var(--secondary-rgb), 0.15), rgba(var(--secondary-rgb), 0.05));
            border-color: rgba(var(--secondary-rgb), 0.2);
          }
          
          .event-item.past {
            background: linear-gradient(145deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05));
            border-color: rgba(34, 197, 94, 0.2);
          }
          
          .event-item.missed {
            background: linear-gradient(145deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05));
            border-color: rgba(239, 68, 68, 0.2);
          }
          
          .calendar-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.5rem;
            background: rgba(0, 0, 0, 0.05);
            border-radius: 1.75rem;
            margin-bottom: 2rem;
            backdrop-filter: blur(25px);
            border: 1px solid rgba(0, 0, 0, 0.05);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
          }
          
          :global(.dark) .calendar-header {
            background: rgba(255, 255, 255, 0.05);
            border-color: rgba(255, 255, 255, 0.1);
          }
          
          .calendar-nav-button {
            background: rgba(var(--secondary-rgb), 0.15);
            border: 1px solid rgba(var(--secondary-rgb), 0.2);
            color: hsl(var(--secondary));
            border-radius: 1.25rem;
            width: 3.5rem;
            height: 3.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          
          .calendar-nav-button:hover {
            background: hsl(var(--secondary));
            color: white;
            transform: scale(1.1);
            box-shadow: 0 10px 25px rgba(var(--secondary-rgb), 0.3);
          }
          
          .calendar-title {
            font-family: var(--font-bebas);
            font-size: 2.5rem;
            font-weight: 400;
            color: var(--foreground);
            text-align: center;
            flex: 1;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            margin: 0;
            line-height: 1;
          }
          
          .weekdays-header {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 1rem;
            margin-bottom: 1rem;
            padding: 0 0.5rem;
          }
          
          .weekday {
            text-align: center;
            font-weight: 700;
            color: hsl(var(--secondary));
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            opacity: 0.8;
          }
          
          .calendar-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 1rem;
            padding: 0 0.5rem;
          }
          
          .calendar-day.other-month {
            opacity: 0.2;
            pointer-events: none;
          }
          
          .today-button {
            background: linear-gradient(135deg, hsl(var(--secondary)) 0%, #ff8c00 100%);
            color: white;
            border: none;
            border-radius: 1.5rem;
            padding: 1.25rem;
            font-family: var(--font-bebas);
            font-size: 1.5rem;
            font-weight: 400;
            letter-spacing: 0.05em;
            cursor: pointer;
            transition: all 0.4s ease;
            margin-top: 2rem;
            width: 100%;
            box-shadow: 0 10px 30px rgba(var(--secondary-rgb), 0.3);
          }
          
          .today-button:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(var(--secondary-rgb), 0.4);
          }
          
          .events-panel {
            background: rgba(0, 0, 0, 0.03);
            border-radius: 2rem;
            padding: 2rem;
            margin-top: 2rem;
            backdrop-filter: blur(30px);
            border: 1px solid rgba(0, 0, 0, 0.05);
            box-shadow: 0 15px 45px rgba(0, 0, 0, 0.1);
          }
          
          :global(.dark) .events-panel {
            background: rgba(255, 255, 255, 0.05);
            border-color: rgba(255, 255, 255, 0.1);
          }
          
          .event-list::-webkit-scrollbar-thumb {
            background: hsl(var(--secondary) / 0.5);
            border-radius: 10px;
          }
          
          @media (max-width: 768px) {
            .calendar-container { padding: 1.5rem; border-radius: 2rem; }
            .calendar-title { font-size: 2rem; }
            .calendar-nav-button { width: 3rem; height: 3rem; }
            .calendar-grid, .weekdays-header { gap: 0.5rem; }
            .calendar-day { min-height: 60px; border-radius: 1rem; }
          }

          /* Phones: keep all seven columns inside the card. */
          @media (max-width: 480px) {
            .calendar-container { padding: 0.75rem !important; border-radius: 1.5rem; }
            .calendar-grid, .weekdays-header { gap: 0.25rem; padding: 0; }
            .calendar-day { min-height: 44px; min-width: 0; border-radius: 0.75rem; }
            .calendar-title { font-size: 1.5rem; }
          }
        `

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  backgroundColor: string
  borderColor: string
  textColor: string
  extendedProps: {
    status: string
    serviceName: string
    clientName: string
    barberName: string
    price: number
    basePrice: number
    addonTotal: number
    addonNames: string[]
    isGuest: boolean
    guestEmail: string
    guestPhone: string
    isBarberView: boolean
    startsAt?: string
    /** IANA zone the appointment is shown in (the barber's). */
    timeZone: string
    /** "YYYY-MM-DD" of the start in that zone, for placing it on the grid. */
    localDate: string
    bookingFeeCents: number
    paymentStatus: string
  }
}

export interface EnhancedCalendarProps {
  className?: string
  onEventClick?: (event: CalendarEvent) => void
  onDateSelect?: (date: Date) => void
  /** Called with the number of bookings in the visible range after each load. */
  onEventsLoaded?: (count: number) => void
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Awaiting payment',
  confirmed: 'Confirmed',
  completed: 'Completed',
  no_show: 'Missed',
  cancelled: 'Cancelled',
}

const PAGE_SIZE = 100
const MAX_PAGES = 10

export function EnhancedCalendar({ className, onEventClick, onDateSelect, onEventsLoaded }: EnhancedCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [isMarkingMissed, setIsMarkingMissed] = useState(false)
  const [actionPending, setActionPending] = useState<null | 'complete' | 'cancel'>(null)
  const [, setIsBarber] = useState(false)
  const { user } = useAuth()
  /** Barbers open on today's agenda; the month grid is one tap away. Clients open on the month. */
  const [mode, setMode] = useState<'today' | 'month'>(user?.role === 'barber' ? 'today' : 'month')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const { toast } = useToast()

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50

  useEffect(() => {
    logger.debug('EnhancedCalendar: User changed', { userId: user?.id })
    if (!user) {
      logger.debug('EnhancedCalendar: No user, skipping fetch')
      return
    }
    logger.debug('EnhancedCalendar: Fetching bookings for user', { userId: user.id })
    fetchBookings()
  }, [user?.id, currentDate.getFullYear(), currentDate.getMonth()])

  // The role may only be known once auth has loaded; pick the default view then (once).
  const [defaultModeSet, setDefaultModeSet] = useState(!!user)
  useEffect(() => {
    if (!user || defaultModeSet) return
    setMode(user.role === 'barber' ? 'today' : 'month')
    setDefaultModeSet(true)
  }, [user, defaultModeSet])

  // Keep "next appointment" and past/upcoming styling current.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Touch gesture handlers for mobile swipe navigation
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) {
      nextMonth()
    }
    if (isRightSwipe) {
      prevMonth()
    }
  }

  /**
   * GET /api/bookings for the visible grid (with a day of margin either side for
   * time zones), every status, paged until complete. Unpaid holds that already
   * expired are left out. Refetched when the month changes.
   */
  const fetchBookings = async () => {
    setLoadError(null)
    try {
      const barberView = user?.role === 'barber'
      setIsBarber(barberView)
      const gridStart = startOfWeek(startOfMonth(currentDate))
      const gridEnd = endOfWeek(endOfMonth(currentDate))
      const from = new Date(gridStart.getTime() - 86_400_000).toISOString()
      const to = new Date(gridEnd.getTime() + 2 * 86_400_000).toISOString()

      const rows: BookingListItem[] = []
      for (let page = 0; page < MAX_PAGES; page++) {
        const { bookings, pagination } = await api.bookings.list({
          as: barberView ? 'barber' : 'client',
          from,
          to,
          order: 'asc',
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        })
        rows.push(...bookings)
        if (rows.length >= pagination.total || bookings.length < PAGE_SIZE) break
      }

      const now = Date.now()
      const visible = rows.filter(
        (b) => !(b.status === 'pending' && b.hold_expires_at && Date.parse(b.hold_expires_at) <= now)
      )
      const mapped = visible.map((booking): CalendarEvent => {
          const serviceName = booking.service?.name || 'Service'
          const clientName = booking.client?.name || booking.customer_name || 'Walk-in'
          const barberName = booking.barber?.profile?.name || booking.barber?.business_name || 'Barber'
          const timeZone = booking.barber?.timezone || 'America/New_York'
          return {
            id: booking.id,
            title: barberView ? `${serviceName} - ${clientName}` : `${serviceName} with ${barberName}`,
            start: booking.starts_at,
            end: booking.ends_at,
            backgroundColor: barberView ? '#ffc107' : '#3b82f6',
            borderColor: barberView ? '#ff8c00' : '#1d4ed8',
            textColor: '#FFFFFF',
            extendedProps: {
              status: booking.status,
              serviceName,
              clientName,
              barberName,
              // Dollars for display; paid in person (the booking fee is separate).
              price: (booking.service_price_cents + booking.addon_total_cents) / 100,
              basePrice: booking.service_price_cents / 100,
              addonTotal: booking.addon_total_cents / 100,
              addonNames: booking.addons.map((a) => a.name),
              isGuest: !booking.client_id,
              guestEmail: '',
              guestPhone: '',
              isBarberView: barberView,
              startsAt: booking.starts_at,
              timeZone,
              localDate: localDateInTimeZone(booking.starts_at, timeZone),
              bookingFeeCents: booking.booking_fee_cents,
              paymentStatus: booking.payment_status,
            },
          }
        })
      setEvents(mapped)
      setLoaded(true)
      onEventsLoaded?.(mapped.length)
    } catch (error) {
      logger.error('EnhancedCalendar: Error fetching bookings', error)
      setLoadError(bookingErrorMessage(error, 'Could not load your bookings.'))
    }
  }

  const getCalendarDays = () => {
    const start = startOfWeek(startOfMonth(currentDate))
    const end = endOfWeek(endOfMonth(currentDate))
    return eachDayOfInterval({ start, end })
  }

  /** Events whose start falls on this calendar day in the barber's time zone. */
  const getEventsForDate = (date: Date) => {
    const day = format(date, 'yyyy-MM-dd')
    return events.filter(event => event.extendedProps.localDate === day)
  }


  const hasPastEvents = (date: Date) => {
    const eventsForDate = getEventsForDate(date)
    const now = new Date()
    return eventsForDate.some(event => {
      const eventEnd = new Date(event.end)
      return eventEnd < now
    })
  }

  const hasUpcomingEvents = (date: Date) => {
    const eventsForDate = getEventsForDate(date)
    const now = new Date()
    return eventsForDate.some(event => {
      const eventStart = new Date(event.start)
      return eventStart > now
    })
  }

  const prevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1))
  }

  const nextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
    setSelectedDate(new Date())
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    onDateSelect?.(date)
  }

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setShowEventDialog(true)
    onEventClick?.(event)
  }

  const replaceSelected = (status: string) => {
    setSelectedEvent(prev => prev ? { ...prev, extendedProps: { ...prev.extendedProps, status } } : null)
  }

  /** PATCH /api/bookings/:id { action: 'no_show' }: confirmed bookings, after the start time. */
  const handleMarkAsMissed = async () => {
    if (!selectedEvent) return

    setIsMarkingMissed(true)
    try {
      await api.bookings.noShow(selectedEvent.id)
      replaceSelected('no_show')
      await fetchBookings()
    } catch (error) {
      logger.error('Failed to mark booking as missed', error)
      toast({ title: 'Could not mark as missed', description: bookingErrorMessage(error), variant: 'destructive' })
    } finally {
      setIsMarkingMissed(false)
    }
  }

  /** PATCH /api/bookings/:id { action: 'complete' }: confirmed bookings, after the start time. */
  const handleMarkCompleted = async () => {
    if (!selectedEvent) return
    setActionPending('complete')
    try {
      await api.bookings.complete(selectedEvent.id)
      replaceSelected('completed')
      toast({ title: 'Marked completed' })
      await fetchBookings()
    } catch (error) {
      logger.error('Failed to mark booking completed', error)
      toast({ title: 'Could not mark completed', description: bookingErrorMessage(error), variant: 'destructive' })
    } finally {
      setActionPending(null)
    }
  }

  /** PATCH /api/bookings/:id { action: 'cancel' }: pending or confirmed, before the start time. */
  const handleCancel = async () => {
    if (!selectedEvent) return
    setActionPending('cancel')
    try {
      const result = await api.bookings.cancel(selectedEvent.id)
      replaceSelected('cancelled')
      toast({
        title: 'Booking cancelled',
        description: result.refund
          ? `${formatCents(result.refund.amountCents)} booking fee refunded to the client.`
          : 'No booking fee needed refunding.',
      })
      await fetchBookings()
    } catch (error) {
      logger.error('Failed to cancel booking', error)
      toast({ title: 'Could not cancel', description: bookingErrorMessage(error), variant: 'destructive' })
    } finally {
      setActionPending(null)
    }
  }

  /** An event's start time in its barber's time zone. */
  const formatTime = (event: CalendarEvent) => formatBookingTime(event.start, event.extendedProps.timeZone)

  const calendarDays = getCalendarDays()

  // Today's agenda, in the barber's time zone (every event of a barber shares it).
  const agendaZone = events[0]?.extendedProps.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const todayLocal = localDateInTimeZone(new Date(now), agendaZone)
  const todayEvents = events
    .filter((e) => e.extendedProps.localDate === todayLocal && e.extendedProps.status !== 'cancelled')
    .sort((a, b) => a.start.localeCompare(b.start))
  const nextEvent = todayEvents.find(
    (e) => Date.parse(e.end) > now && (e.extendedProps.status === 'confirmed' || e.extendedProps.status === 'pending')
  )
  const cancelledToday = events.filter((e) => e.extendedProps.localDate === todayLocal && e.extendedProps.status === 'cancelled').length

  const showToday = () => {
    setMode('today')
    const today = new Date()
    if (today.getMonth() !== currentDate.getMonth() || today.getFullYear() !== currentDate.getFullYear()) setCurrentDate(today)
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Custom Styles */}
      <style dangerouslySetInnerHTML={{ __html: CALENDAR_STYLES }} />

      {/* View switch: Today (agenda) | Month */}
      <div className="flex justify-center px-4 pt-4" role="tablist" aria-label="Calendar view">
        <div className="inline-flex rounded-xl border border-border bg-muted p-1">
          {(['today', 'month'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => (m === 'today' ? showToday() : setMode('month'))}
              className={cn(
                'px-5 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                mode === m ? 'bg-secondary text-secondary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {m === 'today' ? 'Today' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      {loadError && (
        <div role="alert" className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-red-700 dark:text-red-300">{loadError}</p>
          <button type="button" onClick={() => void fetchBookings()} className="text-sm font-semibold text-red-700 dark:text-red-300 underline">
            Try again
          </button>
        </div>
      )}

      {mode === 'today' && (
        <section className="p-4 sm:p-6" aria-labelledby="today-heading">
          <h2 id="today-heading" className="text-foreground font-bebas text-3xl tracking-wide">
            Today · {formatInTimeZone(new Date(now), agendaZone, { weekday: 'long', month: 'short', day: 'numeric' })}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">Times in {timeZoneAbbreviation(agendaZone, new Date(now))}. Tap an appointment to complete, mark missed or cancel.</p>
          {!loaded && !loadError ? (
            <div className="space-y-3" aria-busy="true">
              <div className="h-20 rounded-2xl bg-muted animate-pulse" />
              <div className="h-20 rounded-2xl bg-muted animate-pulse" />
            </div>
          ) : todayEvents.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <p className="font-semibold text-foreground">No appointments today</p>
              <p className="text-sm text-muted-foreground mt-1">
                {cancelledToday > 0 ? `${cancelledToday} cancelled. ` : ''}Switch to Month to see what is coming up.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {todayEvents.map((event) => {
                const isNext = event.id === nextEvent?.id
                const done = event.extendedProps.status === 'completed' || event.extendedProps.status === 'no_show'
                return (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={() => handleEventClick(event)}
                      className={cn(
                        'w-full text-left rounded-2xl border p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isNext ? 'border-secondary bg-secondary/10 shadow-md' : 'border-border bg-card hover:bg-muted',
                        done && 'opacity-70'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {isNext && <span className="inline-block mb-1 text-[11px] font-bold uppercase tracking-wider text-secondary">Next</span>}
                          <p className="font-semibold text-foreground">{formatTime(event)} · {event.extendedProps.clientName}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {[event.extendedProps.serviceName, ...event.extendedProps.addonNames].join(' + ')}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-foreground">{formatCents(Math.round(event.extendedProps.price * 100))}</p>
                          <p className="text-xs text-muted-foreground">{STATUS_LABELS[event.extendedProps.status] ?? event.extendedProps.status}</p>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {mode === 'month' && (
      <div 
        className="calendar-container p-6"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <EnhancedCalendarHeader
          currentDate={currentDate}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
        />

        <EnhancedCalendarGrid
          calendarDays={calendarDays}
          weekdays={WEEKDAYS}
          currentDate={currentDate}
          selectedDate={selectedDate}
          getEventsForDate={getEventsForDate}
          hasPastEvents={hasPastEvents}
          hasUpcomingEvents={hasUpcomingEvents}
          onDateClick={handleDateClick}
        />

        {/* Today Button */}
        <button 
          className="today-button"
          onClick={goToToday}
          aria-label="Go to today"
        >
          Today
        </button>


        {selectedDate && (
          <EnhancedCalendarEventsPanel
            selectedDate={selectedDate}
            events={getEventsForDate(selectedDate)}
            onEventClick={handleEventClick}
            formatTime={formatTime}
          />
        )}
      </div>
      )}

      <EnhancedCalendarEventDialog
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
        selectedEvent={selectedEvent}
        onMarkAsMissed={handleMarkAsMissed}
        isMarkingMissed={isMarkingMissed}
        onMarkCompleted={handleMarkCompleted}
        onCancel={handleCancel}
        actionPending={actionPending}
        user={user}
      />

    </div>
  )
}