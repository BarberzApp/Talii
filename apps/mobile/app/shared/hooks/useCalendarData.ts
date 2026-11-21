/**
 * useCalendarData Hook
 *
 * Data operations for the calendar: loads bookings from the API and turns them
 * into calendar events; booking actions go through PATCH /api/bookings/:id.
 *
 * @module useCalendarData
 */

import { useCallback, useRef } from 'react';
import { errorMessage, isApiError } from '@barber-app/shared';
import {
  fetchCalendarIdentity,
  fetchCalendarBookings,
  fetchBarberServices,
  fetchWalkInTimeSlots,
  createManualAppointment,
  completeBooking,
  markNoShow,
  cancelBooking as cancelBookingService,
  calendarMonthRange,
  type BookingActionResult,
  type ManualAppointmentResult,
} from '../lib/calendar/calendarDataService';
import { transformBookingToEvent } from '../lib/calendar/calendarUtils';
import { logger } from '../lib/logger';
import type { CalendarState } from './useCalendarState';

function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
  } catch {
    return 'America/New_York';
  }
}

/**
 * Hook for calendar data operations
 *
 * @param state - Calendar state from useCalendarState hook
 * @param userId - Current user ID (loading waits until signed in)
 */
export function useCalendarData(state: CalendarState, userId: string | undefined) {
  const {
    setEvents,
    setLoading,
    setRefreshing,
    userRole,
    setUserRole,
    barberViewMode,
    setBarberId,
    barberTimeZone,
    setBarberTimeZone,
    currentDate,
    setLoadError,
    setServices,
    setTimeSlots,
    setLoadingTimeSlots,
  } = state;

  // Only the newest load may write events (month switches can overlap).
  const loadSeq = useRef(0);

  /**
   * Load the visible month's bookings for the role and view: a barber's
   * "appointments" are bookings with them; "bookings" (and a client's calendar)
   * are bookings they made. The month is bounded in the barber's time zone
   * (the device's for clients). On failure the error is shown; events are kept.
   */
  const loadBookings = useCallback(
    async (
      role?: 'client' | 'barber',
      explicitViewMode?: 'appointments' | 'bookings',
      options: { month?: Date; timeZone?: string | null } = {}
    ) => {
      if (!userId) return;
      const roleToUse = role || userRole;
      if (!roleToUse) return;

      // Use the explicitly passed view mode (avoids a stale closure after setBarberViewMode).
      const viewMode = explicitViewMode || barberViewMode;
      const as = roleToUse === 'barber' && viewMode === 'appointments' ? 'barber' : 'client';
      const timeZone = options.timeZone || barberTimeZone || deviceTimeZone();
      const range = calendarMonthRange(options.month ?? currentDate, timeZone);
      const seq = ++loadSeq.current;

      try {
        const bookings = await fetchCalendarBookings(as, range);
        if (seq !== loadSeq.current) return;
        setEvents(bookings.map((booking) => transformBookingToEvent(booking, roleToUse, viewMode)));
        setLoadError(null);
      } catch (error) {
        if (seq !== loadSeq.current) return;
        logger.error('Error loading bookings', { code: isApiError(error) ? error.code : 'UNKNOWN' });
        setLoadError(errorMessage(error, 'Could not load your calendar. Check your connection and try again.'));
      }
    },
    [userId, userRole, barberViewMode, barberTimeZone, currentDate, setEvents, setLoadError]
  );

  /**
   * Load the caller's role, barber id and time zone, then the bookings.
   */
  const initialize = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const identity = await fetchCalendarIdentity();
      if (identity) {
        setUserRole(identity.role);
        setBarberId(identity.barberId);
        setBarberTimeZone(identity.timeZone);
        await loadBookings(identity.role, undefined, { timeZone: identity.timeZone });
      } else {
        setLoadError('Could not load your calendar. Check your connection and try again.');
      }
    } catch (error) {
      logger.error('Error initializing calendar:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, setLoading, setUserRole, setBarberId, setBarberTimeZone, setLoadError, loadBookings]);

  const refresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadBookings();
    } catch (error) {
      logger.error('Error refreshing calendar:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadBookings, setRefreshing]);

  /** The barber's active services (for the walk-in form). */
  const loadServices = useCallback(async () => {
    const services = await fetchBarberServices();
    setServices(services);
    return services;
  }, [setServices]);

  /** Walk-in start times on a barber-local date ("YYYY-MM-DD"). */
  const loadTimeSlots = useCallback(
    async (date: string, durationMinutes: number, timeZone: string) => {
      try {
        setLoadingTimeSlots(true);
        setTimeSlots(await fetchWalkInTimeSlots(date, durationMinutes, timeZone));
      } catch (error) {
        logger.error('Error loading time slots:', error);
        setTimeSlots([]);
      } finally {
        setLoadingTimeSlots(false);
      }
    },
    [setTimeSlots, setLoadingTimeSlots]
  );

  /** POST /api/bookings/manual, then reload. */
  const createAppointment = useCallback(
    async (input: { serviceId: string; startsAt: string; customerName: string; notes?: string }): Promise<ManualAppointmentResult> => {
      const result = await createManualAppointment(input);
      if (result.ok) await loadBookings();
      return result;
    },
    [loadBookings]
  );

  const withReload = useCallback(
    (action: (bookingId: string) => Promise<BookingActionResult>) =>
      async (bookingId: string): Promise<BookingActionResult> => {
        const result = await action(bookingId);
        if (result.ok) await loadBookings();
        return result;
      },
    [loadBookings]
  );

  return {
    initialize,
    loadBookings,
    refresh,
    loadServices,
    loadTimeSlots,
    createAppointment,
    markCompleted: withReload(completeBooking),
    markMissed: withReload(markNoShow),
    cancelBooking: withReload((id) => cancelBookingService(id)),
  };
}

export type CalendarDataOperations = ReturnType<typeof useCalendarData>;
