import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'
import { ApiAuthError, validateBearerToken } from '@/shared/lib/api-auth'
import { calculateFeeBreakdown } from '@/shared/lib/fee-calculator'
import { buildStripeBookingMetadata } from '@/shared/lib/stripe-booking-metadata'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
})

export async function GET(request: Request) {
  try {
    const user = await validateBearerToken(request)

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const from = url.searchParams.get('from') // ISO date-time
    const to = url.searchParams.get('to') // ISO date-time

    let query = supabaseAdmin
      .from('bookings')
      .select(
        `
        *,
        barber:barbers!inner(
          id,
          business_name,
          user:profiles!barbers_user_id_fkey(
            name,
            avatar_url
          )
        ),
        service:services(
          name,
          duration
        )
      `
      )
      .eq('client_id', user.id)
      .order('date', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }
    if (from) {
      query = query.gte('date', from)
    }
    if (to) {
      query = query.lte('date', to)
    }

    const { data, error } = await query

    if (error) {
      logger.error('Failed to load bookings', error, { userId: user.id })
      return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 })
    }

    return NextResponse.json({ bookings: data || [] })
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    logger.error('Mobile /bookings GET error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await validateBearerToken(request)
    const body = await request.json()

    const { barberId, serviceId, date, notes, addonIds = [] } = body as {
      barberId?: string
      serviceId?: string
      date?: string
      notes?: string
      addonIds?: string[]
    }

    if (!barberId || !serviceId || !date) {
      return NextResponse.json(
        { error: 'barberId, serviceId, and date are required' },
        { status: 400 }
      )
    }

    const { data: barber, error: barberError } = await supabaseAdmin
      .from('barbers')
      .select('id,stripe_account_id,stripe_account_status,is_developer')
      .eq('id', barberId)
      .single()

    if (barberError || !barber) {
      return NextResponse.json({ error: 'Barber not found' }, { status: 400 })
    }

    // Service is needed both for developer bookings (price) and PI metadata
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('id,name,price,duration')
      .eq('id', serviceId)
      .single()

    if (serviceError || !service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 400 })
    }

    const uniqueAddonIds: string[] = Array.isArray(addonIds)
      ? [...new Set(addonIds.filter((id: unknown) => typeof id === 'string' && id.trim().length > 0))]
      : []

    let addonTotalDollars = 0
    if (uniqueAddonIds.length > 0) {
      const { data: addons, error: addonsError } = await supabaseAdmin
        .from('service_addons')
        .select('id,price')
        .in('id', uniqueAddonIds)
        .eq('is_active', true)

      if (addonsError) {
        return NextResponse.json({ error: 'Failed to fetch add-ons' }, { status: 500 })
      }

      addonTotalDollars = (addons || []).reduce((sum, a) => sum + Number(a.price || 0), 0)
    }

    // Developer barber: create booking immediately (no payment)
    if (barber.is_developer) {
      const servicePriceDollars = Number(service.price || 0)

      const bookingInsert = {
        barber_id: barberId,
        service_id: serviceId,
        date,
        notes: notes || null,
        client_id: user.id,
        status: 'confirmed',
        payment_status: 'succeeded',
        // For developer bookings, store total price as service + addons (historical reference)
        price: servicePriceDollars + addonTotalDollars,
        service_price: servicePriceDollars,
        addon_total: 0, // Let trigger calculate from booking_addons
        platform_fee: 0,
        barber_payout: servicePriceDollars + addonTotalDollars,
        payment_intent_id: `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .insert(bookingInsert)
        .select('*, barber:barber_id(*), service:service_id(*), client:client_id(*)')
        .single()

      if (bookingError) {
        logger.error('Developer booking insert failed', bookingError, { barberId, userId: user.id })
        return NextResponse.json({ error: `Failed to create booking: ${bookingError.message}` }, { status: 500 })
      }

      // Add add-ons if present (best effort; booking success should not be blocked)
      if (uniqueAddonIds.length > 0) {
        const { data: addons } = await supabaseAdmin
          .from('service_addons')
          .select('id,price')
          .in('id', uniqueAddonIds)
          .eq('is_active', true)

        if (addons && addons.length > 0) {
          const bookingAddons = addons.map(a => ({
            booking_id: booking.id,
            addon_id: a.id,
            price: a.price,
          }))
          const { error: addonInsertError } = await supabaseAdmin.from('booking_addons').insert(bookingAddons)
          if (addonInsertError) {
            logger.error('Failed to attach booking add-ons', addonInsertError, { bookingId: booking.id })
          }
        }
      }

      return NextResponse.json({ success: true, booking })
    }

    // Regular barber: create PaymentIntent (booking created by webhook)
    if (!barber.stripe_account_id || barber.stripe_account_status !== 'active') {
      return NextResponse.json(
        { error: 'Barber account is not ready to accept payments' },
        { status: 400 }
      )
    }

    // Unified fee model ($3.40 total charged to customer; Stripe fee absorbed by platform)
    // NOTE: application_fee_amount must be the platform's GROSS share of the net amount
    // so that the barber receives exactly their 40% share via transfer_data.
    const fee = calculateFeeBreakdown()
    const platformFee = fee.platformFee // 340
    const bocmShare = fee.bocmGrossShare // 180
    const barberShare = fee.barberShare // 120

    const servicePriceCents = Math.round(Number(service.price || 0) * 100)
    const addonTotalCents = Math.round(addonTotalDollars * 100)

    const metadata = buildStripeBookingMetadata({
      barberId,
      serviceId,
      date,
      notes: notes || '',
      clientId: user.id,
      serviceName: String(service.name || ''),
      servicePriceCents,
      addonTotalCents,
      addonIds: uniqueAddonIds,
      platformFeeCents: platformFee,
      paymentType: 'fee',
      feeType: 'fee_only',
      bocmShareCents: bocmShare,
      barberShareCents: barberShare,
      isDeveloper: false,
      addonsPaidSeparately: uniqueAddonIds.length > 0,
    })

    const paymentIntent = await stripe.paymentIntents.create({
      amount: platformFee,
      currency: 'usd',
      application_fee_amount: bocmShare,
      transfer_data: { destination: barber.stripe_account_id },
      metadata,
      automatic_payment_methods: { enabled: true },
    })

    if (!paymentIntent.id || !paymentIntent.client_secret) {
      return NextResponse.json({ error: 'Failed to create payment intent' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
    })
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    logger.error('Mobile /bookings POST error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

