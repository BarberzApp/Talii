"use client"

import { useState, useEffect } from 'react'
import { logger } from '@/shared/lib/logger'
import { Button } from '@/shared/components/ui/button'
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, startOfWeek, endOfWeek } from 'date-fns'
import { addToGoogleCalendar, addMultipleToGoogleCalendar, downloadICalFile } from '@/shared/lib/google-calendar-utils'
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
  }
}

export interface EnhancedCalendarProps {
  className?: string
  onEventClick?: (event: CalendarEvent) => void
  onDateSelect?: (date: Date) => void
}

export function EnhancedCalendar({ className, onEventClick, onDateSelect }: EnhancedCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [gotoDate, setGotoDate] = useState('')
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [isMarkingMissed, setIsMarkingMissed] = useState(false)
  const [isBarber, setIsBarber] = useState(false)
  const { user } = useAuth()

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
  }, [user])

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

  const fetchBookings = async () => {
    try {
      logger.debug('EnhancedCalendar: Starting fetchBookings for user', { userId: user?.id })
      
      // Check if user is a barber or client
      const { data: barberData, error: barberError } = await supabase
        .from('barbers')
        .select('id')
        .eq('user_id', user?.id)
        .single()

      logger.debug('EnhancedCalendar: Barber data', { barberData, error: barberError })
      
      // Update isBarber state based on barberData
      setIsBarber(!!barberData)
      
      let bookingsQuery;
      
      if (barberData) {
        // User is a barber - fetch their bookings
        logger.debug('EnhancedCalendar: User is a barber, fetching barber bookings')
        bookingsQuery = supabase
          .from('bookings')
          .select(`
            *,
            booking_addons (
              id,
              price,
              service_addons (
                id,
                name,
                price
              )
            )
          `)
          .eq('barber_id', barberData.id)
          .eq('payment_status', 'succeeded') // Only show successful payments
          .order('date', { ascending: true })
      } else {
        // User is a client - fetch their bookings
        logger.debug('EnhancedCalendar: User is a client, fetching client bookings')
        bookingsQuery = supabase
          .from('bookings')
          .select(`
            *,
            barbers:barber_id(
              id,
              user_id,
              profiles:user_id(name, avatar_url)
            ),
            services:service_id(name, duration, price),
            booking_addons (
              id,
              price,
              service_addons (
                id,
                name,
                price
              )
            )
          `)
          .eq('client_id', user?.id)
          .eq('payment_status', 'succeeded') // Only show successful payments
          .order('date', { ascending: true })
      }

      const { data: bookings, error } = await bookingsQuery

      logger.debug('EnhancedCalendar: Bookings data', { bookings, error })
      
      if (error || !bookings) {
        logger.debug('EnhancedCalendar: No bookings found or error', { error })
        return
      }

      const events = await Promise.all(bookings.map(async (booking) => {
        logger.debug('EnhancedCalendar: Processing booking', { bookingId: booking.id })
        
        // For barber view, we need to fetch service and client separately
        // For client view, service and barber info are already included in the query
        let service = booking.services
        let client = null
        let barber = null
        
        if (barberData) {
          // Barber view - fetch service and client info
          if (!service) {
            const { data: serviceData } = await supabase
              .from('services')
              .select('name, duration, price')
              .eq('id', booking.service_id)
              .single()
            service = serviceData
          }
          
          if (booking.client_id) {
            const { data: clientData } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', booking.client_id)
              .single()
            client = clientData
          }
        } else {
          // Client view - barber info is already included
          barber = booking.barbers
        }

        const startDate = new Date(booking.date)
        const endDate = new Date(startDate.getTime() + (service?.duration || 60) * 60000)

        // Calculate values in dollars
        const basePrice = service?.price || 0
        const addonTotal = booking.addon_total || 0
        const platformFee = booking.platform_fee || 0
        const barberPayout = typeof booking.barber_payout === 'number'
          ? booking.barber_payout
          : basePrice + addonTotal + (platformFee * 0.40)
        
        logger.debug('EnhancedCalendar: Price calculation for booking', {
          bookingId: booking.id,
          servicePrice: service?.price,
          bookingPrice: booking.price,
          basePrice,
          addonTotal,
          platformFee,
          barberPayout,
          addonNames: booking.booking_addons?.map((addon: any) => addon.service_addons?.name)
        })

        // Get add-on names for display
        const addonNames = booking.booking_addons?.map((addon: any) => 
          addon.service_addons?.name || 'Unknown Add-on'
        ) || []

        // Create title based on user role
        let title
        if (barberData) {
          // Barber view: "Service - Client Name"
          title = `${service?.name || 'Service'} - ${client?.name || booking.guest_name || 'Guest'}`
        } else {
          // Client view: "Service with Barber Name"
          title = `${service?.name || 'Service'} with ${barber?.profiles?.name || 'Barber'}`
        }

        return {
          id: booking.id,
          title,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          backgroundColor: barberData ? '#ffc107' : '#3b82f6', // Yellow for barber, blue for client
          borderColor: barberData ? '#ff8c00' : '#1d4ed8',
          textColor: '#FFFFFF',
          extendedProps: {
            status: booking.status,
            serviceName: service?.name || '',
            clientName: client?.name || booking.guest_name || 'Guest',
            barberName: barber?.profiles?.name || 'Barber',
            price: barberPayout,
            basePrice: basePrice,
            addonTotal: addonTotal,
            addonNames: addonNames,
            isGuest: !client,
            guestEmail: booking.guest_email,
            guestPhone: booking.guest_phone,
            isBarberView: !!barberData
          }
        }
      }))

        logger.debug('EnhancedCalendar: Final events', { eventCount: events.length })
        logger.debug('EnhancedCalendar: Sample booking with addons', { booking: bookings[0] })
        setEvents(events)
    } catch (error) {
      logger.error('EnhancedCalendar: Error fetching bookings', error)
    }
  }

  const getCalendarDays = () => {
    const start = startOfWeek(startOfMonth(currentDate))
    const end = endOfWeek(endOfMonth(currentDate))
    return eachDayOfInterval({ start, end })
  }

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start)
      return isSameDay(eventDate, date)
    })
  }

  const hasEvents = (date: Date) => {
    return getEventsForDate(date).length > 0
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

  const handleMarkAsMissed = async () => {
    if (!selectedEvent) return
    
    setIsMarkingMissed(true)
    try {
      // Update the booking status in the database
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: 'cancelled', // Using 'cancelled' instead of 'missed' due to DB constraint
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedEvent.id)

      if (error) {
        logger.error('Error marking booking as missed', error)
        throw error
      }

      // Update the local event state
      setSelectedEvent(prev => prev ? {
        ...prev,
        extendedProps: {
          ...prev.extendedProps,
          status: 'cancelled'
        }
      } : null)

      // Refresh the events to update the calendar
      await fetchBookings()

      logger.debug('Booking marked as missed successfully')
    } catch (error) {
      logger.error('Failed to mark booking as missed', error)
    } finally {
      setIsMarkingMissed(false)
    }
  }

  const formatTime = (date: Date) => {
    return format(date, 'h:mm a')
  }

  const formatDate = (date: Date) => {
    return format(date, 'MMM d, yyyy')
  }

  const calendarDays = getCalendarDays()

  return (
    <div className={cn("w-full", className)}>
      {/* Custom Styles */}
      <style dangerouslySetInnerHTML={{ __html: CALENDAR_STYLES }} />

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

      <EnhancedCalendarEventDialog
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
        selectedEvent={selectedEvent}
        onMarkAsMissed={handleMarkAsMissed}
        isMarkingMissed={isMarkingMissed}
        user={user}
      />

    </div>
  )
}