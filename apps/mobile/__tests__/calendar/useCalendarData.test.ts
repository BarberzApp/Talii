/**
 * Tests for useCalendarData: loads bookings through calendarDataService and
 * turns them into events; actions reload on success.
 */

import { renderHook, act } from '@testing-library/react-native';
import { useCalendarData } from '@/hooks/useCalendarData';
import * as calendarDataService from '@/lib/calendar/calendarDataService';
import { logger } from '@/lib/logger';

jest.mock('@/lib/calendar/calendarDataService');
jest.mock('@/lib/logger');

const svc = calendarDataService as jest.Mocked<typeof calendarDataService>;

const booking = {
  id: 'booking-1',
  barber_id: 'barber-123',
  client_id: 'client-1',
  customer_name: null,
  service_id: 'service-1',
  starts_at: '2026-12-15T15:00:00Z',
  ends_at: '2026-12-15T15:30:00Z',
  hold_expires_at: null,
  service_price_cents: 3000,
  addon_total_cents: 500,
  booking_fee_cents: 340,
  notes: null,
  cancelled_at: null,
  cancellation_reason: null,
  created_at: '2026-12-01T00:00:00Z',
  updated_at: '2026-12-01T00:00:00Z',
  source: 'app' as const,
  status: 'confirmed' as const,
  payment_status: 'succeeded' as const,
  service: { id: 'service-1', name: 'Haircut', duration_minutes: 30 },
  addons: [{ addon_id: 'a1', name: 'Beard', price_cents: 500 }],
  barber: {
    id: 'barber-123',
    business_name: 'Fade Co',
    timezone: 'America/New_York',
    city: null,
    state: null,
    profile: { name: 'Ann', username: 'ann', avatar_url: null },
  },
  client: { name: 'Chris', username: 'chris', avatar_url: null },
};

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    setEvents: jest.fn(),
    setLoading: jest.fn(),
    setRefreshing: jest.fn(),
    userRole: 'barber',
    setUserRole: jest.fn(),
    barberViewMode: 'appointments',
    setBarberId: jest.fn(),
    barberTimeZone: 'America/New_York',
    setBarberTimeZone: jest.fn(),
    currentDate: new Date(2026, 11, 10),
    setLoadError: jest.fn(),
    setServices: jest.fn(),
    setTimeSlots: jest.fn(),
    setLoadingTimeSlots: jest.fn(),
    ...overrides,
  } as any;
}

describe('useCalendarData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    svc.fetchCalendarBookings.mockResolvedValue([booking]);
    // The month-range math is pure; use the real one.
    svc.calendarMonthRange.mockImplementation(
      jest.requireActual('@/lib/calendar/calendarDataService').calendarMonthRange
    );
  });

  describe('initialize', () => {
    it('loads identity then bookings', async () => {
      svc.fetchCalendarIdentity.mockResolvedValue({
        role: 'barber',
        barberId: 'barber-123',
        timeZone: 'America/New_York',
        onboardingComplete: true,
      });
      const state = makeState();
      const { result } = renderHook(() => useCalendarData(state, 'user-123'));

      await act(async () => {
        await result.current.initialize();
      });

      expect(state.setUserRole).toHaveBeenCalledWith('barber');
      expect(state.setBarberId).toHaveBeenCalledWith('barber-123');
      expect(state.setBarberTimeZone).toHaveBeenCalledWith('America/New_York');
      expect(svc.fetchCalendarBookings).toHaveBeenCalledWith('barber', expect.objectContaining({ from: expect.any(String) }));
      expect(state.setLoading).toHaveBeenCalledWith(true);
      expect(state.setLoading).toHaveBeenLastCalledWith(false);
    });

    it('does nothing without a user', async () => {
      const { result } = renderHook(() => useCalendarData(makeState(), undefined));
      await act(async () => {
        await result.current.initialize();
      });
      expect(svc.fetchCalendarIdentity).not.toHaveBeenCalled();
    });

    it('handles errors', async () => {
      svc.fetchCalendarIdentity.mockRejectedValue(new Error('Network error'));
      const state = makeState();
      const { result } = renderHook(() => useCalendarData(state, 'user-123'));
      await act(async () => {
        await result.current.initialize();
      });
      expect(state.setLoading).toHaveBeenLastCalledWith(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('loadBookings', () => {
    it('loads a barber’s appointments as the barber and builds events in cents', async () => {
      const state = makeState();
      const { result } = renderHook(() => useCalendarData(state, 'user-123'));

      await act(async () => {
        await result.current.loadBookings('barber');
      });

      expect(svc.fetchCalendarBookings).toHaveBeenCalledWith('barber', {
        from: '2026-11-24T05:00:00.000Z',
        to: '2027-01-08T05:00:00.000Z',
      });
      expect(state.setLoadError).toHaveBeenCalledWith(null);
      const [events] = state.setEvents.mock.calls[0];
      expect(events[0]).toMatchObject({
        id: 'booking-1',
        title: 'Haircut - Chris',
        start: '2026-12-15T15:00:00Z',
        end: '2026-12-15T15:30:00Z',
        extendedProps: {
          status: 'confirmed',
          servicePriceCents: 3000,
          addonTotalCents: 500,
          bookingFeeCents: 340,
          addonNames: ['Beard'],
          timeZone: 'America/New_York',
        },
      });
    });

    it('loads a barber’s own bookings (as client) in the bookings view', async () => {
      const state = makeState();
      const { result } = renderHook(() => useCalendarData(state, 'user-123'));
      await act(async () => {
        await result.current.loadBookings('barber', 'bookings');
      });
      expect(svc.fetchCalendarBookings).toHaveBeenCalledWith('client', expect.any(Object));
      expect(state.setEvents.mock.calls[0][0][0].title).toBe('Haircut with Fade Co');
    });

    it('loads client bookings', async () => {
      const state = makeState({ userRole: 'client' });
      const { result } = renderHook(() => useCalendarData(state, 'user-123'));
      await act(async () => {
        await result.current.loadBookings();
      });
      expect(svc.fetchCalendarBookings).toHaveBeenCalledWith('client', expect.any(Object));
    });

    it('loads another month when asked', async () => {
      const state = makeState();
      const { result } = renderHook(() => useCalendarData(state, 'user-123'));
      await act(async () => {
        await result.current.loadBookings('barber', 'appointments', { month: new Date(2027, 1, 1) });
      });
      expect(svc.fetchCalendarBookings).toHaveBeenCalledWith('barber', {
        from: '2027-01-25T05:00:00.000Z',
        to: '2027-03-08T05:00:00.000Z',
      });
    });

    it('shows an error and keeps the events when loading fails', async () => {
      svc.fetchCalendarBookings.mockRejectedValue(Object.assign(new Error('Server down'), { name: 'ApiError', code: 'INTERNAL', status: 500 }));
      const state = makeState();
      const { result } = renderHook(() => useCalendarData(state, 'user-123'));
      await act(async () => {
        await result.current.loadBookings('barber');
      });
      expect(state.setEvents).not.toHaveBeenCalled();
      expect(state.setLoadError).toHaveBeenCalledWith('Server down');
    });

    it('does nothing without a role', async () => {
      const state = makeState({ userRole: null });
      const { result } = renderHook(() => useCalendarData(state, 'user-123'));
      await act(async () => {
        await result.current.loadBookings();
      });
      expect(svc.fetchCalendarBookings).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('toggles refreshing around a reload', async () => {
      const state = makeState();
      const { result } = renderHook(() => useCalendarData(state, 'user-123'));
      await act(async () => {
        await result.current.refresh();
      });
      expect(state.setRefreshing).toHaveBeenCalledWith(true);
      expect(state.setRefreshing).toHaveBeenLastCalledWith(false);
      expect(svc.fetchCalendarBookings).toHaveBeenCalled();
    });
  });

  describe('walk-in form', () => {
    it('loads services', async () => {
      const services = [{ id: 's1', name: 'Cut', price_cents: 3000, duration_minutes: 30 }];
      svc.fetchBarberServices.mockResolvedValue(services);
      const state = makeState();
      const { result } = renderHook(() => useCalendarData(state, 'user-123'));
      await act(async () => {
        await result.current.loadServices();
      });
      expect(state.setServices).toHaveBeenCalledWith(services);
    });

    it('loads walk-in times for a local date', async () => {
      const slots = [{ startsAt: '2026-12-15T14:00:00.000Z', time: '09:00', available: true }];
      svc.fetchWalkInTimeSlots.mockResolvedValue(slots);
      const state = makeState();
      const { result } = renderHook(() => useCalendarData(state, 'user-123'));
      await act(async () => {
        await result.current.loadTimeSlots('2026-12-15', 30, 'America/New_York');
      });
      expect(svc.fetchWalkInTimeSlots).toHaveBeenCalledWith('2026-12-15', 30, 'America/New_York');
      expect(state.setTimeSlots).toHaveBeenCalledWith(slots);
      expect(state.setLoadingTimeSlots).toHaveBeenLastCalledWith(false);
    });

    it('creates an appointment and reloads', async () => {
      svc.createManualAppointment.mockResolvedValue({ ok: true, booking: { id: 'm1' } });
      const state = makeState();
      const { result } = renderHook(() => useCalendarData(state, 'user-123'));
      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.createAppointment({
          serviceId: 's1',
          startsAt: '2026-12-15T14:00:00.000Z',
          customerName: 'Walk In',
        });
      });
      expect(outcome).toEqual({ ok: true, booking: { id: 'm1' } });
      expect(svc.fetchCalendarBookings).toHaveBeenCalled();
    });

    it('does not reload when the appointment conflicts', async () => {
      svc.createManualAppointment.mockResolvedValue({ ok: false, code: 'SLOT_TAKEN', message: 'Taken' });
      const { result } = renderHook(() => useCalendarData(makeState(), 'user-123'));
      await act(async () => {
        await result.current.createAppointment({ serviceId: 's1', startsAt: 'x', customerName: 'A' });
      });
      expect(svc.fetchCalendarBookings).not.toHaveBeenCalled();
    });
  });

  describe('booking actions', () => {
    it.each([
      ['markCompleted', 'completeBooking'],
      ['markMissed', 'markNoShow'],
      ['cancelBooking', 'cancelBooking'],
    ] as const)('%s calls %s and reloads on success', async (hookFn, serviceFn) => {
      (svc[serviceFn] as jest.Mock).mockResolvedValue({ ok: true, refundCents: null });
      const { result } = renderHook(() => useCalendarData(makeState(), 'user-123'));
      await act(async () => {
        await result.current[hookFn]('booking-1');
      });
      expect(svc[serviceFn]).toHaveBeenCalledWith('booking-1');
      expect(svc.fetchCalendarBookings).toHaveBeenCalled();
    });

    it('returns the failure without reloading', async () => {
      svc.cancelBooking.mockResolvedValue({ ok: false, code: 'TOO_LATE_TO_CANCEL', message: 'Too late' });
      const { result } = renderHook(() => useCalendarData(makeState(), 'user-123'));
      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.cancelBooking('booking-1');
      });
      expect(outcome).toEqual({ ok: false, code: 'TOO_LATE_TO_CANCEL', message: 'Too late' });
      expect(svc.fetchCalendarBookings).not.toHaveBeenCalled();
    });
  });
});
