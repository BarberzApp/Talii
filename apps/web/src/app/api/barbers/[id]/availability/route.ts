import { z } from 'zod'
import { getSupabaseAdmin } from '@/server/clients'
import { ApiError } from '@/server/errors'
import { defineRoute } from '@/server/route'
import { computeDaySlots, loadBarberForBooking } from '@/server/bookings/availability'
import { optionalCallerId } from '@/server/caller'
import { assertBarberVisibleTo } from '@/server/safety'
import { calendarDate, idParams, uuid } from '@/server/validation'

/**
 * GET /api/barbers/:id/availability?date=YYYY-MM-DD&serviceId=<uuid>   (public; a Bearer token is optional)
 *
 * 404 BARBER_NOT_FOUND when the barber is unlisted or suspended, or (with a token) blocked either
 * way with the caller.
 *
 * Slots for one local date in the barber's time zone. `startsAt` is the value
 * to send to POST /api/bookings.
 * 200 { date, timezone, serviceId, durationMinutes,
 *       slots: [{ startsAt, endsAt, time: "HH:MM" local, available, reason?: "booked" | "past" }] }
 */
export const GET = defineRoute(
  {
    auth: 'public',
    params: idParams,
    query: z.object({ date: calendarDate, serviceId: uuid }),
  },
  async ({ req, params, query }) => {
    const db = getSupabaseAdmin()

    const barber = await loadBarberForBooking(db, params.id)
    if (!barber || !barber.listed) throw new ApiError(404, 'BARBER_NOT_FOUND', 'Barber not found.')
    await assertBarberVisibleTo(db, barber, await optionalCallerId(req))

    const { data: service, error } = await db
      .from('services')
      .select('id, barber_id, duration_minutes, is_active')
      .eq('id', query.serviceId)
      .maybeSingle()
    if (error) throw error
    if (!service || service.barber_id !== barber.id || !service.is_active) {
      throw new ApiError(404, 'SERVICE_NOT_FOUND', 'Service not found.')
    }

    const slots = await computeDaySlots(db, {
      barberId: barber.id,
      timeZone: barber.timezone,
      date: query.date,
      durationMinutes: service.duration_minutes,
      now: new Date(),
    })

    return {
      date: query.date,
      timezone: barber.timezone,
      serviceId: service.id,
      durationMinutes: service.duration_minutes,
      slots,
    }
  }
)
