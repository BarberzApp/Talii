/**
 * Tests for calendarDataService: every call goes through the Talii API client.
 */

import { ApiError } from '@barber-app/shared';
import {
  fetchCalendarIdentity,
  fetchCalendarBookings,
  fetchBarberServices,
  fetchWalkInTimeSlots,
  createManualAppointment,
  completeBooking,
  markNoShow,
  cancelBooking,
} from '@/lib/calendar/calendarDataService';
import { api } from '@/lib/api';

jest.mock('@/lib/logger');
jest.mock('@/lib/api', () => {
  const shared = jest.requireActual('@barber-app/shared');
  return {
    api: {
      me: { get: jest.fn() },
      bookings: {
        list: jest.fn(),
        createManual: jest.fn(),
        cancel: jest.fn(),
        complete: jest.fn(),
        noShow: jest.fn(),
      },
      services: { list: jest.fn() },
    },
    isApiError: shared.isApiError,
  };
});

const mockApi = api as unknown as {
  me: { get: jest.Mock };
  bookings: { list: jest.Mock; createManual: jest.Mock; cancel: jest.Mock; complete: jest.Mock; noShow: jest.Mock };
  services: { list: jest.Mock };
};

const page = (bookings: unknown[], total = bookings.length) => ({
  bookings,
  pagination: { limit: 100, offset: 0, total },
});

describe('calendarDataService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('fetchCalendarIdentity', () => {
    it('returns role, barber id and time zone from GET /api/me', async () => {
      mockApi.me.get.mockResolvedValue({
        profile: { role: 'barber' },
        barber: { id: 'b1', timezone: 'America/Chicago', onboarding_complete: true },
      });
      await expect(fetchCalendarIdentity()).resolves.toEqual({
        role: 'barber',
        barberId: 'b1',
        timeZone: 'America/Chicago',
        onboardingComplete: true,
      });
    });

    it('returns a client without barber fields', async () => {
      mockApi.me.get.mockResolvedValue({ profile: { role: 'client' }, barber: null });
      await expect(fetchCalendarIdentity()).resolves.toMatchObject({ role: 'client', barberId: null });
    });

    it('returns null when the API fails', async () => {
      mockApi.me.get.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'offline'));
      await expect(fetchCalendarIdentity()).resolves.toBeNull();
    });
  });

  describe('fetchCalendarBookings', () => {
    it('lists bookings for the role, without unpaid holds', async () => {
      mockApi.bookings.list.mockResolvedValue(page([{ id: 'k1' }]));
      const result = await fetchCalendarBookings('barber');
      expect(result).toEqual([{ id: 'k1' }]);
      const query = mockApi.bookings.list.mock.calls[0][0];
      expect(query).toMatchObject({ as: 'barber', order: 'asc', limit: 100, offset: 0 });
      expect(query.status).toEqual(['confirmed', 'completed', 'cancelled', 'no_show']);
      expect(typeof query.from).toBe('string');
    });

    it('follows pages until the total is reached', async () => {
      const first = Array.from({ length: 100 }, (_, i) => ({ id: `a${i}` }));
      mockApi.bookings.list
        .mockResolvedValueOnce(page(first, 101))
        .mockResolvedValueOnce(page([{ id: 'last' }], 101));
      const result = await fetchCalendarBookings('client');
      expect(result).toHaveLength(101);
      expect(mockApi.bookings.list.mock.calls[1][0]).toMatchObject({ as: 'client', offset: 100 });
    });

    it('returns an empty list on error', async () => {
      mockApi.bookings.list.mockRejectedValue(new ApiError(500, 'INTERNAL', 'x'));
      await expect(fetchCalendarBookings('client')).resolves.toEqual([]);
    });
  });

  describe('fetchBarberServices', () => {
    it('returns active services in cents, sorted by name', async () => {
      mockApi.services.list.mockResolvedValue({
        services: [
          { id: 's2', name: 'Shave', price_cents: 1500, duration_minutes: 20, is_active: true },
          { id: 's1', name: 'Cut', price_cents: 3000, duration_minutes: 30, is_active: true },
          { id: 's3', name: 'Old', price_cents: 100, duration_minutes: 10, is_active: false },
        ],
      });
      await expect(fetchBarberServices()).resolves.toEqual([
        { id: 's1', name: 'Cut', price_cents: 3000, duration_minutes: 30 },
        { id: 's2', name: 'Shave', price_cents: 1500, duration_minutes: 20 },
      ]);
    });
  });

  describe('fetchWalkInTimeSlots', () => {
    const now = new Date('2026-11-18T12:00:00Z'); // 07:00 in New York

    it('builds a 15-minute grid in the barber time zone, marking past and busy times', async () => {
      mockApi.bookings.list.mockResolvedValue(
        page([{ starts_at: '2026-11-18T15:00:00Z', ends_at: '2026-11-18T15:30:00Z' }]) // 10:00-10:30 local
      );
      const slots = await fetchWalkInTimeSlots('2026-11-18', 30, 'America/New_York', now);

      expect(slots).toHaveLength(96);
      expect(slots[0]).toMatchObject({ time: '00:00', startsAt: '2026-11-18T05:00:00.000Z', available: false });
      const at = (time: string) => slots.find((s) => s.time === time)!;
      expect(at('09:00').available).toBe(true);
      expect(at('09:45').available).toBe(false); // would run into the 10:00 booking
      expect(at('10:15').available).toBe(false);
      expect(at('10:30').available).toBe(true); // back-to-back is fine
      expect(mockApi.bookings.list.mock.calls[0][0]).toMatchObject({ as: 'barber', status: ['pending', 'confirmed'] });
    });

    it('returns no slots when bookings cannot be loaded', async () => {
      mockApi.bookings.list.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'offline'));
      await expect(fetchWalkInTimeSlots('2026-11-18', 30, 'America/New_York', now)).resolves.toEqual([]);
    });
  });

  describe('createManualAppointment', () => {
    it('posts to /api/bookings/manual', async () => {
      mockApi.bookings.createManual.mockResolvedValue({ booking: { id: 'm1' } });
      const result = await createManualAppointment({
        serviceId: 's1',
        startsAt: '2026-11-18T15:00:00.000Z',
        customerName: '  Walk In ',
      });
      expect(result).toEqual({ ok: true, booking: { id: 'm1' } });
      expect(mockApi.bookings.createManual).toHaveBeenCalledWith({
        serviceId: 's1',
        startsAt: '2026-11-18T15:00:00.000Z',
        customerName: 'Walk In',
        notes: undefined,
      });
    });

    it('returns the error code (e.g. SLOT_TAKEN)', async () => {
      mockApi.bookings.createManual.mockRejectedValue(new ApiError(409, 'SLOT_TAKEN', 'Taken'));
      await expect(
        createManualAppointment({ serviceId: 's1', startsAt: 'x', customerName: 'A' })
      ).resolves.toEqual({ ok: false, code: 'SLOT_TAKEN', message: 'Taken' });
    });
  });

  describe('booking actions', () => {
    it('cancels through PATCH /api/bookings/:id and reports the refund', async () => {
      mockApi.bookings.cancel.mockResolvedValue({ booking: {}, refund: { id: 're_1', amountCents: 340, status: 'pending' } });
      await expect(cancelBooking('k1', 'Changed plans')).resolves.toEqual({ ok: true, refundCents: 340 });
      expect(mockApi.bookings.cancel).toHaveBeenCalledWith('k1', 'Changed plans');
    });

    it('completes and marks no-shows', async () => {
      mockApi.bookings.complete.mockResolvedValue({ booking: {}, refund: null });
      mockApi.bookings.noShow.mockResolvedValue({ booking: {}, refund: null });
      await expect(completeBooking('k1')).resolves.toEqual({ ok: true, refundCents: null });
      await expect(markNoShow('k2')).resolves.toEqual({ ok: true, refundCents: null });
      expect(mockApi.bookings.complete).toHaveBeenCalledWith('k1');
      expect(mockApi.bookings.noShow).toHaveBeenCalledWith('k2');
    });

    it('returns the server error instead of throwing', async () => {
      mockApi.bookings.cancel.mockRejectedValue(new ApiError(409, 'TOO_LATE_TO_CANCEL', 'Too late'));
      await expect(cancelBooking('k1')).resolves.toEqual({ ok: false, code: 'TOO_LATE_TO_CANCEL', message: 'Too late' });
    });
  });
});
