import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'
import { buildAvailabilitySlots } from '@/shared/lib/availability-engine'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const barberId = url.searchParams.get('barberId')
    const dateParam = url.searchParams.get('date') // expected YYYY-MM-DD (or ISO)
    const durationParam = url.searchParams.get('duration') // minutes

    if (!barberId || !dateParam || !durationParam) {
      return NextResponse.json(
        { error: 'barberId, date, and duration are required' },
        { status: 400 }
      )
    }

    const duration = Number(durationParam)
    if (!Number.isFinite(duration) || duration <= 0) {
      return NextResponse.json({ error: 'duration must be a positive number' }, { status: 400 })
    }

    const selectedDate = dateParam.split('T')[0]

    // Day-of-week computed on the calendar date (UTC-safe)
    const dayOfWeek = new Date(`${selectedDate}T00:00:00Z`).getUTCDay()

    // Fetch existing bookings for conflict checks
    const startOfDay = `${selectedDate}T00:00:00`
    const endOfDay = `${selectedDate}T23:59:59`

    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('date,end_time,status')
      .eq('barber_id', barberId)
      .gte('date', startOfDay)
      .lte('date', endOfDay)
      .neq('status', 'cancelled')

    if (bookingsError) {
      logger.error('Failed to load bookings for availability', bookingsError, { barberId, selectedDate })
      return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 })
    }

    // Fetch special hours first
    const { data: specialHours, error: specialHoursError } = await supabaseAdmin
      .from('special_hours')
      .select('*')
      .eq('barber_id', barberId)
      .eq('date', selectedDate)

    if (specialHoursError) {
      logger.error('Failed to load special hours', specialHoursError, { barberId, selectedDate })
      return NextResponse.json({ error: 'Failed to load special hours' }, { status: 500 })
    }

    // Load default availability window (if no special hours override exists)
    let availabilityWindow: { start_time: string; end_time: string } | null = null
    if (!specialHours?.[0]) {
      const { data: availability, error: availabilityError } = await supabaseAdmin
        .from('availability')
        .select('start_time,end_time')
        .eq('barber_id', barberId)
        .eq('day_of_week', dayOfWeek)

      if (availabilityError) {
        logger.error('Failed to load availability', availabilityError, { barberId, dayOfWeek })
        return NextResponse.json({ error: 'Failed to load availability' }, { status: 500 })
      }

      if (availability?.[0]?.start_time && availability?.[0]?.end_time) {
        availabilityWindow = {
          start_time: String(availability[0].start_time),
          end_time: String(availability[0].end_time),
        }
      }
    }

    const coreSlots = buildAvailabilitySlots({
      selectedDate,
      durationMinutes: duration,
      availabilityWindow,
      specialHours: specialHours?.[0] || null,
      bookings: (bookings || []) as any,
    })

    const slots = coreSlots.map((s) => ({
      date: selectedDate,
      time: s.time,
      available: s.available,
    }))

    return NextResponse.json({ slots })
  } catch (err) {
    logger.error('Mobile /availability/slots error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

