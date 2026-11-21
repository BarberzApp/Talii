/**
 * Calendar Data Service
 *
 * Data access for the calendar feature, through the Talii API only.
 * Money is integer cents; times are ISO instants shown in the barber's time zone.
 *
 * @module calendarDataService
 */

import {
  isApiError,
  localDayBounds,
  localTimeInTimeZone,
  zonedTimeToUtc,
  type BookingListItem,
  type BookingPaymentStatus,
  type BookingSource,
  type BookingStatus,
  type ListBookingsQuery,
} from '@barber-app/shared';
import { api } from '../api';
import { logger } from '../logger';

/** A booking as the calendar shows it. */
export interface CalendarEvent {
  id: string;
  title: string;
  /** ISO instants. */
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: {
    status: BookingStatus;
    paymentStatus: BookingPaymentStatus;
    source: BookingSource;
    serviceName: string;
    clientName: string;
    barberName: string;
    barberId: string;
    /** The barber's IANA time zone; show times in it. */
    timeZone: string;
    /** Paid to the barber at the appointment. */
    servicePriceCents: number;
    addonTotalCents: number;
    /** Booking fee the client paid in the app (0 for walk-ins and fee-exempt barbers). */
    bookingFeeCents: number;
    addonNames: string[];
    notes: string | null;
  };
}

/** One of the barber's own services, for the walk-in form. */
export interface Service {
  id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
}

/** A start time on the walk-in form. */
export interface TimeSlot {
  /** ISO instant to send as startsAt. */
  startsAt: string;
  /** Local "HH:MM" in the barber's time zone. */
  time: string;
  available: boolean;
}

/** Who the calendar belongs to: role, barber row id and time zone (from GET /api/me). */
export interface CalendarIdentity {
  role: 'client' | 'barber';
  barberId: string | null;
  timeZone: string | null;
  onboardingComplete: boolean;
}

/** Statuses the calendar shows (unpaid holds are left out). */
const CALENDAR_STATUSES: BookingStatus[] = ['confirmed', 'completed', 'cancelled', 'no_show'];
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
/** How far back the calendar loads. */
const HISTORY_DAYS = 180;
/** Grid for walk-in start times, in minutes. */
const WALK_IN_STEP_MINUTES = 15;

export async function fetchCalendarIdentity(): Promise<CalendarIdentity | null> {
  try {
    const me = await api.me.get();
    const role = me.profile.role === 'barber' ? 'barber' : 'client';
    return {
      role,
      barberId: role === 'barber' ? me.barber?.id ?? null : null,
      timeZone: me.barber?.timezone ?? null,
      onboardingComplete: !!me.barber?.onboarding_complete,
    };
  } catch (error) {
    logger.error('Error loading calendar identity', { code: isApiError(error) ? error.code : 'UNKNOWN' });
    return null;
  }
}

/** All pages of GET /api/bookings for a query (up to MAX_PAGES * PAGE_SIZE rows). */
async function listAllBookings(query: ListBookingsQuery): Promise<BookingListItem[]> {
  const all: BookingListItem[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { bookings, pagination } = await api.bookings.list({
      ...query,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
    all.push(...bookings);
    if (all.length >= pagination.total || bookings.length < PAGE_SIZE) break;
  }
  return all;
}

/**
 * Bookings for the calendar.
 * - as 'barber': appointments clients (and walk-ins) booked with the caller;
 * - as 'client': bookings the caller made (a barber can book other barbers too).
 */
export async function fetchCalendarBookings(as: 'client' | 'barber'): Promise<BookingListItem[]> {
  try {
    const from = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    return await listAllBookings({ as, status: CALENDAR_STATUSES, from, order: 'asc' });
  } catch (error) {
    logger.error('Error fetching calendar bookings', { code: isApiError(error) ? error.code : 'UNKNOWN' });
    return [];
  }
}

/** The caller's active services (barber only). */
export async function fetchBarberServices(): Promise<Service[]> {
  try {
    const { services } = await api.services.list();
    return services
      .filter((service) => service.is_active)
      .map(({ id, name, price_cents, duration_minutes }) => ({ id, name, price_cents, duration_minutes }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    logger.error('Error fetching services', { code: isApiError(error) ? error.code : 'UNKNOWN' });
    return [];
  }
}

/**
 * Start times for a walk-in on one local date: a 15-minute grid over the
 * barber's whole day (walk-ins are not limited to weekly hours), minus past
 * times and times that would overlap the barber's own pending or confirmed
 * bookings. The server still enforces overlap (409 SLOT_TAKEN).
 */
export async function fetchWalkInTimeSlots(
  date: string,
  durationMinutes: number,
  timeZone: string,
  now: Date = new Date()
): Promise<TimeSlot[]> {
  const { start, end } = localDayBounds(date, timeZone);
  let busy: Array<{ start: number; end: number }> = [];
  try {
    const bookings = await listAllBookings({
      as: 'barber',
      status: ['pending', 'confirmed'],
      // Include bookings that started before the day but run into it.
      from: new Date(start.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      to: end.toISOString(),
      order: 'asc',
    });
    busy = bookings.map((b) => ({ start: Date.parse(b.starts_at), end: Date.parse(b.ends_at) }));
  } catch (error) {
    logger.error('Error fetching bookings for walk-in times', { code: isApiError(error) ? error.code : 'UNKNOWN' });
    return [];
  }

  const slots: TimeSlot[] = [];
  const seen = new Set<number>();
  for (let minutes = 0; minutes < 24 * 60; minutes += WALK_IN_STEP_MINUTES) {
    const slotStart = zonedTimeToUtc(date, minutes, timeZone);
    const startMs = slotStart.getTime();
    // Daylight-saving gaps map two local times to one instant; keep it once.
    if (startMs < start.getTime() || startMs >= end.getTime() || seen.has(startMs)) continue;
    seen.add(startMs);
    const endMs = startMs + durationMinutes * 60_000;
    const overlaps = busy.some((b) => b.start < endMs && b.end > startMs);
    slots.push({
      startsAt: slotStart.toISOString(),
      time: localTimeInTimeZone(slotStart, timeZone),
      available: !overlaps && startMs > now.getTime(),
    });
  }
  return slots;
}

export type ManualAppointmentResult =
  | { ok: true; booking: { id: string } }
  | { ok: false; code: string; message: string };

/** POST /api/bookings/manual: a confirmed walk-in on the caller's calendar (no payment). */
export async function createManualAppointment(input: {
  serviceId: string;
  startsAt: string;
  customerName: string;
  notes?: string;
}): Promise<ManualAppointmentResult> {
  try {
    const { booking } = await api.bookings.createManual({
      serviceId: input.serviceId,
      startsAt: input.startsAt,
      customerName: input.customerName.trim(),
      notes: input.notes?.trim() || undefined,
    });
    return { ok: true, booking: { id: booking.id } };
  } catch (error) {
    logger.error('Error creating manual appointment', { code: isApiError(error) ? error.code : 'UNKNOWN' });
    return {
      ok: false,
      code: isApiError(error) ? error.code : 'UNKNOWN',
      message: isApiError(error) ? error.message : 'Failed to create appointment.',
    };
  }
}

export type BookingActionResult = { ok: true; refundCents: number | null } | { ok: false; code: string; message: string };

async function runAction(
  bookingId: string,
  action: 'cancel' | 'complete' | 'no_show',
  reason?: string
): Promise<BookingActionResult> {
  try {
    const res =
      action === 'cancel'
        ? await api.bookings.cancel(bookingId, reason)
        : action === 'complete'
          ? await api.bookings.complete(bookingId)
          : await api.bookings.noShow(bookingId);
    return { ok: true, refundCents: res.refund?.amountCents ?? null };
  } catch (error) {
    logger.error(`Error applying booking action ${action}`, { code: isApiError(error) ? error.code : 'UNKNOWN' });
    return {
      ok: false,
      code: isApiError(error) ? error.code : 'UNKNOWN',
      message: isApiError(error) ? error.message : 'Something went wrong. Please try again.',
    };
  }
}

/** Barber, confirmed booking, after its start. */
export const completeBooking = (bookingId: string) => runAction(bookingId, 'complete');
/** Barber, confirmed booking, after its start. */
export const markNoShow = (bookingId: string) => runAction(bookingId, 'no_show');
/** Client or barber, before the start; the server applies the refund policy. */
export const cancelBooking = (bookingId: string, reason?: string) => runAction(bookingId, 'cancel', reason);
