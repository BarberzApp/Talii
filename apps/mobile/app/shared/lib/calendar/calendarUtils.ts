/**
 * Calendar Utilities
 * 
 * Pure utility functions for calendar operations.
 * Follows Single Responsibility Principle - only handles calculations and transformations.
 * All functions are pure (no side effects) for easy testing.
 * 
 * @module calendarUtils
 */

import { theme } from '../theme';
import { formatCents, formatClockTime, localDateInTimeZone, type BookingListItem } from '@barber-app/shared';
import type { CalendarEvent } from './calendarDataService';

/**
 * Get color scheme for booking status
 * 
 * @param status - Booking status
 * @returns Object with backgroundColor, borderColor, and textColor
 */
export function getStatusColors(status: string): {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
} {
  switch (status) {
    case 'confirmed':
      return {
        backgroundColor: theme.colors.success || '#10b981',
        borderColor: theme.colors.success || '#10b981',
        textColor: '#FFFFFF'
      };
    case 'completed':
      return {
        backgroundColor: theme.colors.primary || '#3b82f6',
        borderColor: theme.colors.primary || '#3b82f6',
        textColor: '#FFFFFF'
      };
    case 'cancelled':
      return {
        backgroundColor: theme.colors.warning || '#ef4444',
        borderColor: theme.colors.warning || '#ef4444',
        textColor: '#FFFFFF'
      };
    case 'no_show':
      return {
        backgroundColor: '#6b7280',
        borderColor: '#6b7280',
        textColor: '#FFFFFF'
      };
    default:
      return {
        backgroundColor: theme.colors.primary || '#f59e0b',
        borderColor: theme.colors.primary || '#f59e0b',
        textColor: '#FFFFFF'
      };
  }
}

/**
 * Transform a booking from GET /api/bookings into a calendar event.
 *
 * @param booking - Booking with its service, add-ons, barber and client
 * @param userRole - Current user's role
 * @param barberViewMode - Barber's view mode (appointments or bookings)
 */
export function transformBookingToEvent(
  booking: BookingListItem,
  userRole: 'client' | 'barber',
  barberViewMode?: 'appointments' | 'bookings'
): CalendarEvent {
  const serviceName = booking.service?.name || 'Service';
  const barberName =
    booking.barber?.business_name || booking.barber?.profile?.name || booking.barber?.profile?.username || 'Barber';
  const clientName =
    booking.client?.name || booking.client?.username || booking.customer_name || (booking.source === 'manual' ? 'Walk-in' : 'Client');

  const asBarber = userRole === 'barber' && barberViewMode !== 'bookings';
  const title = asBarber ? `${serviceName} - ${clientName}` : `${serviceName} with ${barberName}`;
  const colors = getStatusColors(booking.status);

  return {
    id: booking.id,
    title,
    start: booking.starts_at,
    end: booking.ends_at,
    ...colors,
    extendedProps: {
      status: booking.status,
      paymentStatus: booking.payment_status,
      source: booking.source,
      serviceName,
      clientName,
      barberName,
      barberId: booking.barber_id,
      timeZone: booking.barber?.timezone || 'America/New_York',
      servicePriceCents: booking.service_price_cents,
      addonTotalCents: booking.addon_total_cents,
      bookingFeeCents: booking.booking_fee_cents,
      addonNames: booking.addons.map((addon) => addon.name),
      notes: booking.notes,
    },
  };
}

/**
 * Filter events by status
 * 
 * @param events - Array of calendar events
 * @param status - Status to filter by ('all' for no filtering)
 * @returns Filtered array of events
 */
export function filterEventsByStatus(events: CalendarEvent[], status: string): CalendarEvent[] {
  if (status === 'all') {
    return events;
  }
  return events.filter(event => event.extendedProps.status === status);
}

/**
 * The calendar day a grid cell stands for ("YYYY-MM-DD" on the device calendar;
 * grid dates are local midnights).
 */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** A device-local Date for a calendar day "YYYY-MM-DD" (for the grid and date pickers). */
export function dateFromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** The day an event falls on in the barber's time zone, matching the times shown. */
export function eventDayKey(event: CalendarEvent): string {
  return localDateInTimeZone(event.start, event.extendedProps.timeZone);
}

/**
 * Get events for a calendar day (grouped in each booking's barber time zone).
 */
export function getEventsForDate(events: CalendarEvent[], date: Date): CalendarEvent[] {
  const key = dayKey(date);
  return events.filter(event => eventDayKey(event) === key);
}

/**
 * Format a local "HH:MM" time for display (e.g. "2:30 PM").
 */
export function formatTimeSlot(time: string): string {
  return formatClockTime(time);
}

/**
 * Service revenue (service + add-ons, paid at the appointment) of completed events, in cents.
 */
export function calculateTotalRevenue(events: CalendarEvent[]): number {
  return events.reduce((total, event) => {
    if (event.extendedProps.status === 'completed') {
      return total + event.extendedProps.servicePriceCents + event.extendedProps.addonTotalCents;
    }
    return total;
  }, 0);
}

/**
 * Get upcoming events (future events only)
 * 
 * @param events - Array of calendar events
 * @returns Array of upcoming events
 */
export function getUpcomingEvents(events: CalendarEvent[]): CalendarEvent[] {
  const now = new Date();
  return events
    .filter(event => new Date(event.start) > now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

/**
 * Get past events
 * 
 * @param events - Array of calendar events
 * @returns Array of past events
 */
export function getPastEvents(events: CalendarEvent[]): CalendarEvent[] {
  const now = new Date();
  return events
    .filter(event => new Date(event.start) <= now)
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
}

/**
 * Group events by their day in the barber's time zone ("YYYY-MM-DD").
 */
export function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const grouped = new Map<string, CalendarEvent[]>();
  events.forEach(event => {
    const key = eventDayKey(event);
    grouped.set(key, [...(grouped.get(key) || []), event]);
  });
  return grouped;
}

/**
 * Get count of events by status
 * 
 * @param events - Array of calendar events
 * @returns Object with count for each status
 */
export function getEventCountsByStatus(events: CalendarEvent[]): Record<string, number> {
  const counts: Record<string, number> = {
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    no_show: 0
  };
  
  events.forEach(event => {
    const status = event.extendedProps.status;
    if (status in counts) {
      counts[status]++;
    }
  });
  
  return counts;
}

/**
 * Validate manual appointment data
 *
 * @param data - Appointment form data (startsAt is the chosen slot)
 * @returns Object with isValid and error message
 */
export function validateManualAppointment(data: {
  clientName: string;
  serviceId: string;
  startsAt: string;
}): { isValid: boolean; error?: string } {
  if (!data.clientName.trim()) {
    return { isValid: false, error: 'Client name is required' };
  }

  if (!data.serviceId) {
    return { isValid: false, error: 'Please select a service' };
  }

  if (!data.startsAt) {
    return { isValid: false, error: 'Please select a time slot' };
  }

  return { isValid: true };
}

/**
 * Format cents for display (e.g. 4500 -> "$45.00")
 */
export function formatCurrency(cents: number): string {
  return formatCents(cents);
}

/**
 * Check if booking can be cancelled: pending or confirmed, before its start
 * (the server refuses later cancellations).
 */
export function canCancelBooking(booking: CalendarEvent, now: Date = new Date()): boolean {
  const status = booking.extendedProps.status;
  return (status === 'pending' || status === 'confirmed') && new Date(booking.start) > now;
}

/**
 * Check if booking can be marked as completed: confirmed and started.
 */
export function canMarkCompleted(booking: CalendarEvent, now: Date = new Date()): boolean {
  return booking.extendedProps.status === 'confirmed' && new Date(booking.start) <= now;
}

/**
 * Check if booking can be marked as a no-show: confirmed and started.
 */
export function canMarkMissed(booking: CalendarEvent, now: Date = new Date()): boolean {
  return booking.extendedProps.status === 'confirmed' && new Date(booking.start) <= now;
}
