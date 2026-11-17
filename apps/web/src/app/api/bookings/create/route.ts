import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/shared/lib/supabase"
import { logger } from "@/shared/lib/logger"
import { ApiAuthError, getCallerBarber, validateBearerToken } from '@/shared/lib/api-auth'

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Manual appointment on the caller's own calendar.
 * Auth: Bearer token; the caller must own `barber_id`.
 * Ignored from the body: client_id, payment_intent_id, platform_fee, barber_payout
 * (manual appointments have no platform client or payment; fee is 0 and payout = price).
 */
export async function POST(request: Request) {
  try {
    const user = await validateBearerToken(request)
    const callerBarber = await getCallerBarber<{ id: string }>(user.id, 'id')

    const body = await request.json()
    const {
      barber_id,
      service_id,
      date,
      end_time,
      price,
      guest_name,
      guest_email,
      guest_phone,
      notes
    } = body

    // Validate required fields
    if (!barber_id || !service_id || !date || price === undefined || price === null || price === '') {
      return NextResponse.json(
        { error: 'Missing required booking fields' },
        { status: 400 }
      )
    }

    if (barber_id !== callerBarber.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const numericPrice = Number(price)
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
    }

    const start = parseIsoDate(date)
    const end = end_time ? parseIsoDate(end_time) : null
    if (!start || (end_time && (!end || end <= start))) {
      return NextResponse.json({ error: 'Invalid date or end_time' }, { status: 400 })
    }
    const startIso = start.toISOString()
    const endIso = end ? end.toISOString() : null

    // Basic conflict prevention: overlap with existing non-cancelled bookings.
    // Built with typed filters (no client input interpolated into a filter string).
    if (endIso) {
      const { data: conflicts, error: conflictError } = await supabaseAdmin
        .from('bookings')
        .select('id')
        .eq('barber_id', callerBarber.id)
        .neq('status', 'cancelled')
        .lt('date', endIso)
        .gt('end_time', startIso)
        .limit(1)

      if (conflictError) {
        return NextResponse.json(
          { error: 'Failed to check availability' },
          { status: 500 }
        )
      }

      if (conflicts && conflicts.length > 0) {
        return NextResponse.json(
          { error: 'Time slot conflicts with an existing booking' },
          { status: 409 }
        )
      }
    }

    // Fetch service price to store historically (required for accurate pricing even if service price changes later)
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('price')
      .eq('id', service_id)
      .eq('barber_id', callerBarber.id)
      .maybeSingle()

    if (serviceError || !service) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 400 }
      )
    }

    const service_price = service.price ? Number(service.price) : null

    // Create the booking using the admin client
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        barber_id: callerBarber.id,
        service_id,
        date: startIso,
        end_time: endIso,
        price: numericPrice,
        service_price, // Store historical service price
        status: "confirmed",
        payment_status: "succeeded",
        payment_intent_id: null,
        platform_fee: 0,
        barber_payout: numericPrice,
        notes: notes || null,
        client_id: null,
        guest_name: guest_name || null,
        guest_email: guest_email || null,
        guest_phone: guest_phone || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select(`
        *,
        barber:barber_id(id, user_id),
        service:service_id(*),
        client:client_id(*)
      `)
      .single()

    if (bookingError) {
      logger.error('Error creating booking', bookingError)
      
      // Handle specific constraint violations with 409 status
      if (bookingError.message.includes('Booking time conflicts with existing booking')) {
        return NextResponse.json(
          { error: 'This time slot is already booked. Please select a different time.' },
          { status: 409 }
        )
      }
      
      if (bookingError.message.includes('Booking time is not within barber availability')) {
        return NextResponse.json(
          { error: 'This time is outside the barber\'s available hours.' },
          { status: 409 }
        )
      }
      
      if (bookingError.message.includes('Daily booking limit exceeded')) {
        return NextResponse.json(
          { error: 'The barber has reached their daily booking limit.' },
          { status: 409 }
        )
      }
      
      if (bookingError.message.includes('Booking too far in advance')) {
        return NextResponse.json(
          { error: 'This booking is too far in advance. Please select a closer date.' },
          { status: 409 }
        )
      }
      
      if (bookingError.message.includes('Same day bookings not allowed')) {
        return NextResponse.json(
          { error: 'Same day bookings are not allowed for this barber.' },
          { status: 409 }
        )
      }
      
      if (bookingError.message.includes('Minimum interval between bookings not met')) {
        return NextResponse.json(
          { error: 'There must be more time between bookings.' },
          { status: 409 }
        )
      }
      
      // Handle PostgreSQL constraint violation codes
      if (bookingError.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { error: 'A booking already exists for this time slot.' },
          { status: 409 }
        )
      }
      
      if (bookingError.code === '23514') { // Check constraint violation
        return NextResponse.json(
          { error: 'Booking violates business rules. Please check the time and date.' },
          { status: 409 }
        )
      }
      
      // Generic database error
      return NextResponse.json(
        { error: 'Failed to create booking' },
        { status: 500 }
      )
    }


    return NextResponse.json({ booking })
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error('Error in booking creation API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 