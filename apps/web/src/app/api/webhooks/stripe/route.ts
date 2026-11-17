import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from "@/shared/lib/supabase"
import { headers } from "next/headers"
import { logger } from '@/shared/lib/logger'
import { calculateFeeBreakdown } from '@/shared/lib/fee-calculator'
import { parseStripeBookingMetadata } from '@/shared/lib/stripe-booking-metadata'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY')
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error('Missing STRIPE_WEBHOOK_SECRET')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20" as any,
})

const supabase = supabaseAdmin

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'
type PaymentStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'

// Helper function to update booking status/payment status (DB-aligned)
async function updateBooking(
  bookingId: string,
  patch: {
    status?: BookingStatus
    payment_status?: PaymentStatus
    payment_intent_id?: string
  }
) {
  // Validate inputs
  if (!bookingId || typeof bookingId !== 'string') {
    throw new Error('Invalid booking ID')
  }

  if (!patch || typeof patch !== 'object') {
    throw new Error('Invalid patch')
  }

  const { error } = await supabase
    .from('bookings')
    .update({
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.payment_status ? { payment_status: patch.payment_status } : {}),
      ...(patch.payment_intent_id ? { payment_intent_id: patch.payment_intent_id } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)

  if (error) {
    logger.error('Error updating booking', error)
    throw error
  }
}

// Look up the bookings tied to a PaymentIntent. Returns an explicit error when more
// than one booking references the same intent (should be impossible once Phase 2 adds
// a unique constraint, but the current schema does not enforce it).
async function findBookingByPaymentIntent(paymentIntentId: string): Promise<
  | { ok: true; booking: { id: string; status: string | null } | null }
  | { ok: false; reason: 'query_failed' | 'multiple'; error?: unknown }
> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, status')
    .eq('payment_intent_id', paymentIntentId)
    .limit(2)

  if (error) return { ok: false, reason: 'query_failed', error }
  if (data && data.length > 1) return { ok: false, reason: 'multiple' }
  return { ok: true, booking: data && data.length === 1 ? data[0] : null }
}

// Confirm a booking after payment unless it was already cancelled. A cancelled booking
// must not come back to life on a redelivered or late event.
// TODO(phase-3): a paid-but-cancelled booking should be refunded automatically.
async function confirmBookingIfNotCancelled(bookingId: string, paymentIntentId?: string) {
  const { data: current, error } = await supabase
    .from('bookings')
    .select('id, status')
    .eq('id', bookingId)
    .maybeSingle()

  if (error) throw error
  if (!current) {
    logger.warn('Booking referenced by Stripe event not found', { bookingId })
    return
  }
  if (current.status === 'cancelled') {
    logger.warn('Not re-confirming cancelled booking after payment event', { bookingId, paymentIntentId })
    return
  }

  await updateBooking(bookingId, {
    status: current.status === 'completed' ? undefined : 'confirmed',
    payment_status: 'succeeded',
    ...(paymentIntentId ? { payment_intent_id: paymentIntentId } : {}),
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature found' },
        { status: 400 }
      )
    }

    // Validate webhook secret is configured
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('STRIPE_WEBHOOK_SECRET is not configured')
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      )
    }

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      logger.error('Webhook signature verification failed', err)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    // Validate event type
    if (!event.type || typeof event.type !== 'string') {
      return NextResponse.json(
        { error: 'Invalid event type' },
        { status: 400 }
      )
    }

    // Handle specific events
    switch (event.type as string) {
      case 'account.created': {
        const account = event.data.object as Stripe.Account
        logger.debug('Processing account.created event', { accountId: account.id })

        // Validate account object
        if (!account.id || typeof account.id !== 'string') {
          return NextResponse.json(
            { error: 'Invalid account ID' },
            { status: 400 }
          )
        }

        // Get barber ID from metadata
        const barberId = account.metadata?.barber_id
        if (!barberId) {
          // Not an account we created through onboarding; nothing to do.
          logger.warn('account.created without barber_id metadata; ignoring', { accountId: account.id })
          break
        }

        // Update barber's Stripe account ID
        const { error: updateError } = await supabase
          .from('barbers')
          .update({
            stripe_account_id: account.id,
            stripe_account_status: 'pending',
            stripe_account_ready: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', barberId)

        if (updateError) {
          logger.error('Error updating barber', updateError)
          return NextResponse.json(
            { error: 'Failed to update barber' },
            { status: 500 }
          )
        }

        logger.debug('Successfully saved Stripe account ID for barber', { barberId })
        break
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        logger.debug('Processing account.updated event', { accountId: account.id })

        // Validate account object
        if (!account.id || typeof account.id !== 'string') {
          return NextResponse.json(
            { error: 'Invalid account ID' },
            { status: 400 }
          )
        }

        // Find barber with this Stripe account ID
        const { data: barber, error: findError } = await supabase
          .from('barbers')
          .select('id')
          .eq('stripe_account_id', account.id)
          .maybeSingle()

        if (findError) {
          logger.error('Error finding barber', findError)
          return NextResponse.json(
            { error: 'Failed to find barber' },
            { status: 500 }
          )
        }

        if (!barber) {
          // Unknown account (not ours, or onboarding never saved it). Nothing to update.
          logger.warn('account.updated for unknown Stripe account; ignoring', { accountId: account.id })
          break
        }

        // Update barber's Stripe account status
        const { error: updateError } = await supabase
          .from('barbers')
          .update({
            stripe_account_status: account.charges_enabled ? 'active' : 'pending',
            stripe_account_ready: Boolean(account.charges_enabled && account.details_submitted),
            updated_at: new Date().toISOString(),
          })
          .eq('id', barber.id)

        if (updateError) {
          logger.error('Error updating barber', updateError)
          return NextResponse.json(
            { error: 'Failed to update barber' },
            { status: 500 }
          )
        }

        break
      }

      case 'account.application.deauthorized': {
        // The event's data.object is the Application (our platform), not the
        // connected account. The connected account id is on event.account.
        const connectedAccountId = event.account
        logger.debug('Processing account.application.deauthorized event', { accountId: connectedAccountId })

        if (!connectedAccountId) {
          logger.warn('account.application.deauthorized without event.account; ignoring')
          break
        }

        // Find and update barber's status
        const { error: updateError } = await supabase
          .from('barbers')
          .update({
            stripe_account_status: 'deauthorized',
            stripe_account_ready: false,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_account_id', connectedAccountId)

        if (updateError) {
          logger.error('Error updating barber', updateError)
          return NextResponse.json(
            { error: 'Failed to update barber' },
            { status: 500 }
          )
        }

        break
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        logger.debug('Processing checkout.session.completed event', { sessionId: session.id })

        // Validate session object
        if (!session.id || typeof session.id !== 'string') {
          return NextResponse.json(
            { error: 'Invalid session ID' },
            { status: 400 }
          )
        }

        if (!session.metadata?.bookingId) {
          // Not a booking checkout we created (or booking is created from the
          // payment_intent.succeeded event instead). Nothing to act on.
          logger.debug('Checkout session without bookingId metadata; ignoring', { sessionId: session.id })
          break
        }

        await confirmBookingIfNotCancelled(
          session.metadata.bookingId,
          typeof session.payment_intent === 'string' ? session.payment_intent : undefined
        )

        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session
        logger.debug('Processing checkout.session.expired event', { sessionId: session.id })

        // Validate session object
        if (!session.id || typeof session.id !== 'string') {
          return NextResponse.json(
            { error: 'Invalid session ID' },
            { status: 400 }
          )
        }

        if (!session.metadata?.bookingId) {
          // Not a booking checkout we created (or booking is created from the
          // payment_intent.succeeded event instead). Nothing to act on.
          logger.debug('Checkout session without bookingId metadata; ignoring', { sessionId: session.id })
          break
        }

        // DB constraint: bookings.status cannot be "expired" (use payment_status failed + cancel booking)
        await updateBooking(session.metadata.bookingId, {
          status: 'cancelled',
          payment_status: 'failed',
        })
        break
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        logger.debug('Processing payment_intent.succeeded event', { paymentIntentId: paymentIntent.id })

        // Validate payment intent object
        if (!paymentIntent.id || typeof paymentIntent.id !== 'string') {
          return NextResponse.json(
            { error: 'Invalid payment intent ID' },
            { status: 400 }
          )
        }

        // Check if a booking already exists for this payment intent
        const lookup = await findBookingByPaymentIntent(paymentIntent.id)
        if (!lookup.ok) {
          if (lookup.reason === 'multiple') {
            // Data problem that retries cannot fix: log loudly and acknowledge.
            logger.error('More than one booking references this payment intent; not touching any of them', {
              paymentIntentId: paymentIntent.id,
            })
            break
          }
          logger.error('Error finding booking', lookup.error)
          return NextResponse.json(
            { error: 'Failed to find booking' },
            { status: 500 }
          )
        }
        const existingBooking = lookup.booking

        let bookingId: string | null = null

        if (!existingBooking) {
          // Create the booking using metadata
          const rawMeta = (paymentIntent.metadata || {}) as Record<string, string>
          const parsed = parseStripeBookingMetadata(rawMeta)

          if (!parsed.ok) {
            logger.error('Missing required booking metadata in payment intent', {
              paymentIntentId: paymentIntent.id,
              missing: parsed.missing,
              meta: parsed.raw,
            })


            // Returning 200 prevents Stripe retry storms; booking creation is impossible without metadata.
            break
          }

          const {
            barberId,
            serviceId,
            date,
            notes,
            guestName,
            guestEmail,
            guestPhone,
            clientId,
            addonIdsCsv,
            addonTotalCents,
            addonsPaidSeparately,
            platformFeeCents,
            bocmShareCents,
            barberShareCents,
            isDeveloper,
          } = parsed.value
          
          // Debug logging
          logger.debug('Payment intent metadata (parsed)', {
            paymentIntentId: paymentIntent.id,
            barberId,
            serviceId,
            date,
            clientId,
            hasGuestInfo: !!(guestName || guestEmail || guestPhone),
            addonIdsCsv,
            addonTotalCents,
            addonsPaidSeparately,
          })
          
          // Defensive: if clientId is missing or empty, treat as guest if guest info exists; else bail.
          const normalizedClientId =
            clientId && clientId.trim().length > 0
              ? clientId
              : (guestName || guestEmail || guestPhone) ? 'guest' : ''

          if (!normalizedClientId) {
            logger.error('Payment intent missing clientId and no guest info provided; cannot create booking', {
              paymentIntentId: paymentIntent.id,
              meta: rawMeta,
            })
            break
          }

          // Fee contract verification (log-only; do not block booking creation)
          try {
            const fee = calculateFeeBreakdown()
            const expectedPlatformFee = String(fee.platformFee)
            const expectedBocmShare = String(fee.bocmGrossShare)
            const expectedBarberShare = String(fee.barberShare)

            const mismatches: Record<string, { expected: string; got?: string }> = {}
            if (platformFeeCents && platformFeeCents !== expectedPlatformFee) {
              mismatches.platformFee = { expected: expectedPlatformFee, got: platformFeeCents }
            }
            if (bocmShareCents && bocmShareCents !== expectedBocmShare) {
              mismatches.bocmShare = { expected: expectedBocmShare, got: bocmShareCents }
            }
            if (barberShareCents && barberShareCents !== expectedBarberShare) {
              mismatches.barberShare = { expected: expectedBarberShare, got: barberShareCents }
            }
            if (isDeveloper && isDeveloper !== 'false' && isDeveloper !== 'true') {
              mismatches.isDeveloper = { expected: 'true|false', got: isDeveloper }
            }

            if (Object.keys(mismatches).length > 0) {
              logger.warn('Payment intent fee metadata mismatch (log-only)', {
                paymentIntentId: paymentIntent.id,
                mismatches,
              })
            }
          } catch (feeErr) {
            logger.error('Failed fee metadata verification', feeErr)
          }

          // Convert Stripe cents to dollars for bookings table (which stores NUMERIC dollars)
          // We use the shared fee breakdown to ensure consistency
          const breakdown = calculateFeeBreakdown()
          
          // application_fee_amount is the gross platform share (e.g. $1.80)
          // For the DB, we store the shares of the net amount ($3.00)
          const platform_fee = breakdown.bocmGrossShare / 100 // $1.80
          const barber_payout = breakdown.barberShare / 100 // $1.20
          
          // Price in DB reflects the net amount split between platform and barber
          const price = breakdown.netAfterStripe / 100 // $3.00
          
          // Get service price to store historically (so it doesn't change if service price is updated later)
          const { data: service } = await supabase
            .from('services')
            .select('price')
            .eq('id', serviceId)
            .single()

          const servicePrice = service?.price ? Number(service.price) : 0

          // Calculate add-on total from add-ons table using addonIds (deduplicate first)
          let addon_total = 0
          let addonIdArray: string[] = []
          if (addonIdsCsv && typeof addonIdsCsv === 'string' && addonIdsCsv.length > 0) {
            // Deduplicate addon IDs to prevent double-counting
            addonIdArray = [...new Set(addonIdsCsv.split(',').filter(id => id.trim()))]
            if (addonIdArray.length > 0) {
              const { data: addons } = await supabase
                .from('service_addons')
                .select('price')
                .in('id', addonIdArray)
                .eq('barber_id', barberId)
                .eq('is_active', true)
              if (addons && addons.length > 0) {
                addon_total = addons.reduce((sum, addon) => sum + Number(addon.price), 0)
              }
            }
          }

          const { data: newBooking, error: createError } = await supabase.from('bookings').insert({
            barber_id: barberId,
            service_id: serviceId,
            date,
            status: 'confirmed',
            payment_status: 'succeeded',
            payment_intent_id: paymentIntent.id,
            price,        // total amount charged (platform_fee + barber_payout) to satisfy constraint
            service_price: servicePrice, // Store historical service price
            addon_total: 0,  // Let the trigger calculate this from booking_addons
            platform_fee, // dollars - platform's share
            barber_payout, // dollars - barber's share from platform fee
            notes: notes || null,
            guest_name: guestName || null,
            guest_email: guestEmail || null,
            guest_phone: guestPhone || null,
            client_id: normalizedClientId === 'guest' ? null : normalizedClientId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).select('id, status').single()

          // Debug logging for the insert operation
          logger.debug('Inserting booking with client_id', {
            clientId: normalizedClientId === 'guest' ? null : normalizedClientId,
            isGuest: normalizedClientId === 'guest',
          })

          if (createError) {
            logger.error('Error creating booking after payment', createError)
            return NextResponse.json(
              { error: 'Error creating booking after payment' },
              { status: 500 }
            )
          }

          bookingId = newBooking.id
          logger.debug('Booking created after payment for payment_intent', { paymentIntentId: paymentIntent.id })


          // Log successful booking creation for mobile payments
          logger.debug('Mobile payment booking created successfully', {
            bookingId: newBooking.id,
            paymentIntentId: paymentIntent.id,
            barberId,
            clientId: normalizedClientId,
            amount: paymentIntent.amount,
            status: newBooking.status
          })


          // Add add-ons to the booking if any were selected (deduplicate first)
          if (addonIdsCsv && addonIdsCsv.length > 0) {
            const addonIdArray = [...new Set(addonIdsCsv.split(',').filter(id => id.trim()))]
            if (addonIdArray.length > 0) {
              const { data: addons } = await supabase
                .from('service_addons')
                .select('id, price')
                .in('id', addonIdArray)
                .eq('barber_id', barberId)
                .eq('is_active', true)

              if (addons && addons.length > 0) {
                const bookingAddons = addons.map(addon => ({
                  booking_id: newBooking.id,
                  addon_id: addon.id,
                  price: addon.price
                }))

                const { error: addonError } = await supabase
                  .from('booking_addons')
                  .insert(bookingAddons)

                if (addonError) {
                  logger.error('Error adding add-ons to booking', addonError)
                } else {
                  logger.debug(`Added ${addons.length} add-ons to booking`)
                }
              }
            }
          }
        } else {
          // Booking already exists (redelivery, or created before payment). Confirm it
          // unless it was cancelled in the meantime.
          bookingId = existingBooking.id
          await confirmBookingIfNotCancelled(existingBooking.id, paymentIntent.id)
        }

        // Store the successful payment once per payment intent (Stripe redelivers events).
        if (bookingId) {
          const { data: existingPayments, error: existingPaymentError } = await supabase
            .from('payments')
            .select('id')
            .eq('payment_intent_id', paymentIntent.id)
            .gt('amount', 0)
            .limit(1)

          if (existingPaymentError) {
            logger.error('Error checking for existing payment record', existingPaymentError)
            return NextResponse.json(
              { error: 'Error storing payment' },
              { status: 500 }
            )
          }
          if (existingPayments && existingPayments.length > 0) {
            logger.debug('Payment already recorded for payment intent; skipping insert', { paymentIntentId: paymentIntent.id })
            break
          }

          const { error: paymentError } = await supabase.from('payments').insert({
            payment_intent_id: paymentIntent.id,
            amount: paymentIntent.amount, // Already in cents from Stripe
            currency: paymentIntent.currency,
            status: paymentIntent.status,
            barber_stripe_account_id: paymentIntent.transfer_data?.destination,
            platform_fee: paymentIntent.application_fee_amount || 0,
            booking_id: bookingId, // ✅ Now properly set
            created_at: new Date().toISOString(),
          })

          if (paymentError) {
            logger.error('Error storing payment in Supabase', paymentError)
            return NextResponse.json(
              { error: 'Error storing payment' },
              { status: 500 }
            )
          }
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        logger.debug('Processing payment_intent.payment_failed event', { paymentIntentId: paymentIntent.id })

        // Validate payment intent object
        if (!paymentIntent.id || typeof paymentIntent.id !== 'string') {
          return NextResponse.json(
            { error: 'Invalid payment intent ID' },
            { status: 400 }
          )
        }

        // Find booking with this payment intent ID
        const lookup = await findBookingByPaymentIntent(paymentIntent.id)
        if (!lookup.ok) {
          if (lookup.reason === 'multiple') {
            logger.error('More than one booking references this payment intent; not touching any of them', {
              paymentIntentId: paymentIntent.id,
            })
            break
          }
          logger.error('Error finding booking', lookup.error)
          return NextResponse.json(
            { error: 'Failed to find booking' },
            { status: 500 }
          )
        }

        const booking = lookup.booking
        if (!booking) {
          // No booking for this intent (not ours, or created before metadata existed).
          logger.debug('payment_intent.payment_failed with no matching booking; ignoring', { paymentIntentId: paymentIntent.id })
          break
        }

        // DB constraint: bookings.status cannot be "failed" (use payment_status failed + cancel booking)
        await updateBooking(booking.id, {
          status: 'cancelled',
          payment_status: 'failed',
          payment_intent_id: paymentIntent.id,
        })

        // Handle retry logic if needed
        if (paymentIntent.next_action) {
          logger.debug('Payment requires additional action', { nextAction: paymentIntent.next_action })
          // You might want to notify the user or handle the next action
        }

        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        logger.debug('Processing charge.refunded event', { chargeId: charge.id })

        // Validate charge object
        if (!charge.id || typeof charge.id !== 'string') {
          return NextResponse.json(
            { error: 'Invalid charge ID' },
            { status: 400 }
          )
        }

        if (!charge.payment_intent || typeof charge.payment_intent !== 'string') {
          logger.debug('charge.refunded without a payment intent; ignoring', { chargeId: charge.id })
          break
        }

        // Find booking with this payment intent ID
        const lookup = await findBookingByPaymentIntent(charge.payment_intent)
        if (!lookup.ok) {
          if (lookup.reason === 'multiple') {
            logger.error('More than one booking references this payment intent; not touching any of them', {
              paymentIntentId: charge.payment_intent,
            })
            break
          }
          logger.error('Error finding booking', lookup.error)
          return NextResponse.json(
            { error: 'Failed to find booking' },
            { status: 500 }
          )
        }

        const booking = lookup.booking
        if (!booking) {
          // No booking for this intent (not ours, or created before metadata existed).
          logger.debug('charge.refunded with no matching booking; ignoring', { paymentIntentId: charge.payment_intent })
          break
        }

        const isPartialRefund = charge.amount_refunded < charge.amount
        const refundStatus = isPartialRefund ? 'partially_refunded' : 'refunded'
        
        // DB constraint: bookings.status cannot be "refunded" (keep status; update payment_status only)
        await updateBooking(booking.id, {
          payment_status: refundStatus,
          payment_intent_id: charge.payment_intent as string,
        })

        // Create a refund payment record
        const { error: refundError } = await supabase.from('payments').insert({
          payment_intent_id: charge.payment_intent,
          amount: -charge.amount_refunded, // Negative amount for refunds
          currency: charge.currency,
          status: refundStatus,
          barber_stripe_account_id: typeof charge.transfer === 'string' ? charge.transfer : charge.transfer?.destination,
          platform_fee: 0, // No platform fee on refunds
          booking_id: booking.id,
          created_at: new Date().toISOString(),
        })

        if (refundError) {
          logger.error('Error storing refund payment record', refundError)
          // Don't fail the webhook for this, just log the error
        }

        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error('Error processing webhook', error)
    // 500 so Stripe retries genuine processing failures.
    return NextResponse.json(
      { error: 'Webhook error' },
      { status: 500 }
    )
  }
}