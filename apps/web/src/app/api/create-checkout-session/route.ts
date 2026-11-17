import { NextResponse } from "next/server"
import Stripe from "stripe"
import { supabaseAdmin } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'
import { 
  calculateFeeBreakdown,
} from '@/shared/lib/fee-calculator'
import { buildStripeBookingMetadata } from '@/shared/lib/stripe-booking-metadata'
import { ApiAuthError, validateBearerToken } from '@/shared/lib/api-auth'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20" as any,
})

/**
 * Creates a Stripe Checkout session for the booking fee.
 * Auth: Bearer token required (guest checkout is cut). The booking's client is the
 * token's user; `clientId` and guest fields in the body are ignored.
 */
export async function POST(request: Request) {
  try {
    const user = await validateBearerToken(request)

    const body = await request.json()
    const {
      barberId,
      serviceId,
      date,
      notes,
    } = body
    const addonIds: string[] = Array.isArray(body.addonIds)
      ? body.addonIds.filter((id: unknown): id is string => typeof id === 'string')
      : []

    // Validate required fields
    if (!barberId || !serviceId || !date) {
      return NextResponse.json(
        { error: 'barberId, serviceId, and date are required' },
        { status: 400 }
      )
    }

    // Get the barber's Stripe account ID and is_developer flag
    const { data: barber, error: barberError } = await supabaseAdmin
      .from('barbers')
      .select('stripe_account_id, stripe_account_status, is_developer')
      .eq('id', barberId)
      .single()

    if (barberError || !barber?.stripe_account_id) {
      return NextResponse.json(
        { error: 'Barber Stripe account not found or not ready' },
        { status: 400 }
      )
    }

    // Verify the barber's Stripe account is active
    if (barber.stripe_account_status !== 'active') {
      return NextResponse.json(
        { error: 'Barber account is not ready to accept payments' },
        { status: 400 }
      )
    }

    // Get service details
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('name, price, duration')
      .eq('id', serviceId)
      .eq('barber_id', barberId)
      .single()

    if (serviceError || !service?.price) {
      return NextResponse.json(
        { error: 'Service not found or missing price' },
        { status: 400 }
      )
    }

    const servicePrice = Math.round(Number(service.price) * 100) // Convert to cents
    
    // Get add-ons if any are selected (deduplicate first)
    let addonTotal = 0
    let addonItems: any[] = []
    let validAddonIds: string[] = []
    
    if (addonIds && addonIds.length > 0) {
      // Deduplicate addon IDs to prevent double-counting
      const uniqueAddonIds = [...new Set(addonIds)]
      const { data: addons, error: addonsError } = await supabaseAdmin
        .from('service_addons')
        .select('id, name, price')
        .in('id', uniqueAddonIds)
        .eq('barber_id', barberId)
        .eq('is_active', true)

      if (addonsError) {
        return NextResponse.json(
          { error: 'Failed to fetch add-ons' },
          { status: 500 }
        )
      }

      addonTotal = addons.reduce((total, addon) => total + addon.price, 0)
      validAddonIds = addons.map(addon => addon.id)
      addonItems = addons.map(addon => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: addon.name,
            description: "Additional service"
          },
          unit_amount: Math.round(addon.price * 100),
        },
        quantity: 1,
      }))
    }
    
    // Platform fee calculation (unified $3.40 model)
    const breakdown = calculateFeeBreakdown()
    const platformFee = breakdown.platformFee
    let applicationFeeAmount = breakdown.applicationFeeAmount // $2.20 (Withheld by platform so barber receives exactly $1.20)
    let bocmShare = breakdown.bocmGrossShare // $1.80 (Platform net after Stripe will be $1.40)
    let barberShare = breakdown.barberShare // $1.20

    // If barber is a developer, bypass all platform fees
    if (barber.is_developer) {
      applicationFeeAmount = 0
      bocmShare = 0
      barberShare = 0
    }

    // Customer only pays the platform fee (fee-only payment model)
    // Service price and addons are paid directly to barber at appointment
    const totalAmount = platformFee
    
    const lineItems = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Processing Fee",
            description: "Payment processing fee"
          },
          unit_amount: platformFee,
        },
        quantity: 1,
      }
    ]

    // Create success and cancel URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bocmstyle.com'
    const successUrl = `${baseUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${baseUrl}/booking/cancel`

    // Create Stripe Checkout session
    const metadata = buildStripeBookingMetadata({
      barberId,
      serviceId,
      date,
      notes: notes || '',
      guestName: '',
      guestEmail: '',
      guestPhone: '',
      clientId: user.id,
      serviceName: service.name,
      servicePriceCents: servicePrice,
      addonTotalCents: Math.round(addonTotal * 100),
      addonIds: validAddonIds,
      platformFeeCents: platformFee,
      paymentType: 'fee',
      feeType: 'fee_only',
      bocmShareCents: bocmShare,
      barberShareCents: barberShare,
      isDeveloper: !!barber.is_developer,
      addonsPaidSeparately: validAddonIds.length > 0,
    }) satisfies Stripe.MetadataParam

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      payment_intent_data: {
        transfer_data: {
          destination: barber.stripe_account_id,
        },
        application_fee_amount: applicationFeeAmount, // Withheld by platform to ensure Barber receives exactly $1.20 (or 0 for developer)
        // Critical: webhook creates bookings from PaymentIntent.metadata for mobile parity
        metadata,
      },
      metadata,
    })

    logger.debug('Checkout session created successfully', {
      sessionId: session.id,
      amount: session.amount_total
    })

    return NextResponse.json({ 
      url: session.url,
      sessionId: session.id 
    })
  } catch (error: any) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error("Error creating checkout session", error)
    
    // Handle specific Stripe account errors
    if (error.type === 'StripeInvalidRequestError' && 
       (error.message?.includes('No such destination') || 
        error.message?.includes('does not have access to account') ||
        error.param === 'payment_intent_data[transfer_data][destination]')) {
      
      return NextResponse.json(
        { 
          error: "This barber's payment account is not correctly configured or has been disconnected. Please notify them.",
          code: 'STRIPE_ACCOUNT_INVALID'
        },
        { status: 400 } // Bad request because the destination is invalid
      )
    }

    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    )
  }
}