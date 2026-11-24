/**
 * Tests for calendarUtils (pure functions).
 */

import type { BookingListItem } from '@barber-app/shared';
import {
  getStatusColors,
  transformBookingToEvent,
  filterEventsByStatus,
  getEventsForDate,
  groupEventsByDate,
  dayKey,
  dateFromDayKey,
  formatTimeSlot,
  calculateTotalRevenue,
  getUpcomingEvents,
  getEventCountsByStatus,
  validateManualAppointment,
  formatCurrency,
  canCancelBooking,
  canMarkCompleted,
  canMarkMissed,
} from '@/lib/calendar/calendarUtils';
import type { CalendarEvent } from '@/lib/calendar/calendarDataService';

function makeEvent(overrides: Partial<CalendarEvent> & { props?: Partial<CalendarEvent['extendedProps']> } = {}): CalendarEvent {
  const { props, ...rest } = overrides;
  return {
    id: '1',
    title: 'Event',
    start: '2024-12-15T10:00:00Z',
    end: '2024-12-15T11:00:00Z',
    backgroundColor: '#000',
    borderColor: '#000',
    textColor: '#FFF',
    ...rest,
    extendedProps: {
      status: 'confirmed',
      paymentStatus: 'succeeded',
      source: 'app',
      serviceName: 'Haircut',
      clientName: 'Client',
      barberName: 'Barber',
      barberId: 'barber-1',
      timeZone: 'America/New_York',
      servicePriceCents: 5000,
      addonTotalCents: 0,
      bookingFeeCents: 340,
      addonNames: [],
      notes: null,
      ...props,
    },
  };
}

const baseBooking: BookingListItem = {
  id: 'booking-1',
  barber_id: 'barber-1',
  client_id: 'client-1',
  customer_name: null,
  service_id: 'service-1',
  starts_at: '2024-12-15T15:00:00Z',
  ends_at: '2024-12-15T15:45:00Z',
  hold_expires_at: null,
  service_price_cents: 4500,
  addon_total_cents: 1000,
  booking_fee_cents: 340,
  notes: 'Fade please',
  cancelled_at: null,
  cancellation_reason: null,
  created_at: '2024-12-01T00:00:00Z',
  updated_at: '2024-12-01T00:00:00Z',
  source: 'app',
  status: 'confirmed',
  payment_status: 'succeeded',
  service: { id: 'service-1', name: 'Haircut', duration_minutes: 45 },
  addons: [{ addon_id: 'a1', name: 'Beard Trim', price_cents: 1000 }],
  barber: {
    id: 'barber-1',
    business_name: 'Fade Co',
    timezone: 'America/Chicago',
    city: 'Austin',
    state: 'TX',
    profile: { name: 'Barb', username: 'barb', avatar_url: null },
  },
  client: { name: 'Client Name', username: 'client', avatar_url: null },
};

describe('calendarUtils', () => {
  describe('getStatusColors', () => {
    it('returns colors for each status', () => {
      for (const status of ['confirmed', 'completed', 'cancelled', 'no_show', 'pending']) {
        const colors = getStatusColors(status);
        expect(colors.textColor).toBe('#FFFFFF');
        expect(colors.backgroundColor).toBeTruthy();
      }
      expect(getStatusColors('no_show').backgroundColor).toBe('#6b7280');
    });
  });

  describe('transformBookingToEvent', () => {
    it('uses the stored times and cents for the client view', () => {
      const event = transformBookingToEvent(baseBooking, 'client');
      expect(event).toMatchObject({
        id: 'booking-1',
        title: 'Haircut with Fade Co',
        start: '2024-12-15T15:00:00Z',
        end: '2024-12-15T15:45:00Z',
      });
      expect(event.extendedProps).toEqual({
        status: 'confirmed',
        paymentStatus: 'succeeded',
        source: 'app',
        serviceName: 'Haircut',
        clientName: 'Client Name',
        barberName: 'Fade Co',
        barberId: 'barber-1',
        timeZone: 'America/Chicago',
        servicePriceCents: 4500,
        addonTotalCents: 1000,
        bookingFeeCents: 340,
        addonNames: ['Beard Trim'],
        notes: 'Fade please',
      });
    });

    it('titles barber appointments with the client', () => {
      expect(transformBookingToEvent(baseBooking, 'barber', 'appointments').title).toBe('Haircut - Client Name');
      expect(transformBookingToEvent(baseBooking, 'barber', 'bookings').title).toBe('Haircut with Fade Co');
    });

    it('uses the customer name for walk-ins', () => {
      const walkIn = { ...baseBooking, source: 'manual' as const, client_id: null, client: null, customer_name: 'John Doe' };
      expect(transformBookingToEvent(walkIn, 'barber', 'appointments').extendedProps.clientName).toBe('John Doe');
    });
  });

  describe('filterEventsByStatus', () => {
    const events = [makeEvent({ id: '1' }), makeEvent({ id: '2', props: { status: 'completed' } })];

    it('returns all events for "all"', () => {
      expect(filterEventsByStatus(events, 'all')).toHaveLength(2);
    });

    it('filters by status', () => {
      expect(filterEventsByStatus(events, 'completed').map((e) => e.id)).toEqual(['2']);
      expect(filterEventsByStatus(events, 'no_show')).toEqual([]);
    });
  });

  describe('getEventsForDate / groupEventsByDate (barber time zone)', () => {
    // 03:30 UTC on Dec 16 is still Dec 15 (19:30) in Los Angeles.
    const lateEvening = makeEvent({ id: 'la', start: '2024-12-16T03:30:00Z', props: { timeZone: 'America/Los_Angeles' } });
    const morning = makeEvent({ id: 'ny', start: '2024-12-16T15:00:00Z', props: { timeZone: 'America/New_York' } });

    it('puts an event on its day in the barber zone, whatever the device zone', () => {
      expect(getEventsForDate([lateEvening, morning], new Date(2024, 11, 15)).map((e) => e.id)).toEqual(['la']);
      expect(getEventsForDate([lateEvening, morning], new Date(2024, 11, 16)).map((e) => e.id)).toEqual(['ny']);
      expect(getEventsForDate([lateEvening, morning], new Date(2024, 11, 17))).toEqual([]);
    });

    it('groups by barber-local day', () => {
      const grouped = groupEventsByDate([lateEvening, morning]);
      expect([...grouped.keys()]).toEqual(['2024-12-15', '2024-12-16']);
    });

    it('converts between grid dates and day keys', () => {
      expect(dayKey(new Date(2024, 0, 5))).toBe('2024-01-05');
      expect(dayKey(dateFromDayKey('2024-03-10'))).toBe('2024-03-10');
    });
  });

  describe('formatTimeSlot', () => {
    it('formats local clock times', () => {
      expect(formatTimeSlot('09:00')).toBe('9:00 AM');
      expect(formatTimeSlot('14:30')).toBe('2:30 PM');
      expect(formatTimeSlot('12:00')).toBe('12:00 PM');
      expect(formatTimeSlot('00:00')).toBe('12:00 AM');
    });
  });

  describe('calculateTotalRevenue', () => {
    it('sums service and add-ons of completed events, in cents', () => {
      const events = [
        makeEvent({ props: { status: 'completed', servicePriceCents: 5000, addonTotalCents: 500 } }),
        makeEvent({ props: { status: 'completed', servicePriceCents: 3000 } }),
        makeEvent({ props: { status: 'cancelled', servicePriceCents: 9999 } }),
        makeEvent({ props: { status: 'confirmed', servicePriceCents: 9999 } }),
      ];
      expect(calculateTotalRevenue(events)).toBe(8500);
      expect(calculateTotalRevenue([])).toBe(0);
    });
  });

  describe('getUpcomingEvents', () => {
    it('returns future events sorted by start', () => {
      const soon = new Date(Date.now() + 3600_000).toISOString();
      const later = new Date(Date.now() + 7200_000).toISOString();
      const past = new Date(Date.now() - 3600_000).toISOString();
      const result = getUpcomingEvents([
        makeEvent({ id: 'later', start: later }),
        makeEvent({ id: 'past', start: past }),
        makeEvent({ id: 'soon', start: soon }),
      ]);
      expect(result.map((e) => e.id)).toEqual(['soon', 'later']);
    });
  });

  describe('validateManualAppointment', () => {
    const valid = { clientName: 'John', serviceId: 's1', startsAt: '2026-01-01T15:00:00.000Z' };

    it('accepts complete data', () => {
      expect(validateManualAppointment(valid)).toEqual({ isValid: true });
    });

    it('rejects missing fields', () => {
      expect(validateManualAppointment({ ...valid, clientName: ' ' }).error).toBe('Client name is required');
      expect(validateManualAppointment({ ...valid, serviceId: '' }).error).toBe('Please select a service');
      expect(validateManualAppointment({ ...valid, startsAt: '' }).error).toBe('Please select a time slot');
    });
  });

  describe('formatCurrency', () => {
    it('formats cents', () => {
      expect(formatCurrency(4500)).toBe('$45.00');
      expect(formatCurrency(4550)).toBe('$45.50');
      expect(formatCurrency(0)).toBe('$0.00');
    });
  });

  describe('booking action rules (match the API)', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 3_600_000).toISOString();

    it('allows cancelling pending or confirmed bookings before the start', () => {
      expect(canCancelBooking(makeEvent({ start: future }))).toBe(true);
      expect(canCancelBooking(makeEvent({ start: future, props: { status: 'pending' } }))).toBe(true);
      expect(canCancelBooking(makeEvent({ start: past }))).toBe(false);
      expect(canCancelBooking(makeEvent({ start: future, props: { status: 'cancelled' } }))).toBe(false);
      expect(canCancelBooking(makeEvent({ start: future, props: { status: 'completed' } }))).toBe(false);
    });

    it('allows completing or no-show only for confirmed bookings that started', () => {
      expect(canMarkCompleted(makeEvent({ start: past }))).toBe(true);
      expect(canMarkCompleted(makeEvent({ start: future }))).toBe(false);
      expect(canMarkCompleted(makeEvent({ start: past, props: { status: 'completed' } }))).toBe(false);
      expect(canMarkMissed(makeEvent({ start: past }))).toBe(true);
      expect(canMarkMissed(makeEvent({ start: future }))).toBe(false);
      expect(canMarkMissed(makeEvent({ start: past, props: { status: 'no_show' } }))).toBe(false);
    });
  });

  describe('getEventCountsByStatus', () => {
    it('counts events by status', () => {
      const counts = getEventCountsByStatus([
        makeEvent(),
        makeEvent(),
        makeEvent({ props: { status: 'completed' } }),
        makeEvent({ props: { status: 'no_show' } }),
      ]);
      expect(counts).toEqual({ confirmed: 2, completed: 1, cancelled: 0, no_show: 1 });
    });
  });
});
