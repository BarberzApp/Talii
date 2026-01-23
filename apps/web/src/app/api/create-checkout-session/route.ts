import { NextResponse } from "next/server"
import Stripe from "stripe"
import { supabase } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'
import { 
  calculateFeeBreakdown,
} from '@/shared/lib/fee-calculator'
import { buildStripeBookingMetadata } from '@/shared/lib/stripe-booking-metadata'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20" as any,
})

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length).trim()
  return token.length > 0 ? token : null
}

export async function POST(request: Request) {
  try {
    logger.debug('Starting checkout session creation...')
    const body = await request.json()
    logger.debug('Request body', { body })
    
    const { 
      barberId, 
      serviceId, 
      date, 
      notes, 
      guestName, 
      guestEmail, 
      guestPhone, 
      clientId, 
      paymentType,
      addonIds = []
    } = body

    // If a Supabase access token is provided (mobile / API callers), use it to derive the clientId.
    // This keeps guests working for web while allowing authenticated mobile callers to be consistent.
    let derivedClientId: string | null | undefined = clientId
    const bearerToken = getBearerToken(request)
    if (bearerToken) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(bearerToken)
      if (!authError && user?.id) {
        derivedClientId = user.id
      }
    }

    // Validate required fields
    if (!barberId || !serviceId || !date) {
      return NextResponse.json(
        { error: 'barberId, serviceId, and date are required' },
        { status: 400 }
      )
    }

    // Get the barber's Stripe account ID and is_developer flag
    const { data: barber, error: barberError } = await supabase
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
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('name, price, duration')
      .eq('id', serviceId)
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
    
    if (addonIds && addonIds.length > 0) {
      // Deduplicate addon IDs to prevent double-counting
      const uniqueAddonIds = [...new Set(addonIds)]
      const { data: addons, error: addonsError } = await supabase
        .from('service_addons')
        .select('id, name, price')
        .in('id', uniqueAddonIds)
        .eq('is_active', true)

      if (addonsError) {
        return NextResponse.json(
          { error: 'Failed to fetch add-ons' },
          { status: 500 }
        )
      }

      addonTotal = addons.reduce((total, addon) => total + addon.price, 0)
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
    let bocmShare = breakdown.bocmGrossShare // $1.80 (Platform net after Stripe will be $1.40)
    let barberShare = breakdown.barberShare // $1.20

    // If barber is a developer, bypass all platform fees
    if (barber.is_developer) {
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
      guestName: guestName || '',
      guestEmail: guestEmail || '',
      guestPhone: guestPhone || '',
      clientId: derivedClientId || 'guest',
      serviceName: service.name,
      servicePriceCents: servicePrice,
      addonTotalCents: Math.round(addonTotal * 100),
      addonIds,
      platformFeeCents: platformFee,
      paymentType: 'fee',
      feeType: 'fee_only',
      bocmShareCents: bocmShare,
      barberShareCents: barberShare,
      isDeveloper: !!barber.is_developer,
      addonsPaidSeparately: addonIds.length > 0,
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
        application_fee_amount: bocmShare, // Platform net after absorbing Stripe fee = $1.42 (or 0 for developer)
        // Critical: webhook creates bookings from PaymentIntent.metadata for mobile parity
        metadata,
      },
      metadata,
    })

    logger.debug('Checkout session created successfully', {
      sessionId: session.id,
      url: session.url,
      amount: session.amount_total
    })

    return NextResponse.json({ 
      url: session.url,
      sessionId: session.id 
    })
  } catch (error) {
    logger.error("Error creating checkout session", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create checkout session" },
      { status: 500 }
    )
  }
}