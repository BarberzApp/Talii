import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { logger } from '@/shared/lib/logger'
import { calculateFeeBreakdown } from '@/shared/lib/fee-calculator'
import { parseStripeBookingMetadata } from '@/shared/lib/stripe-booking-metadata'
import { BarberAccountService } from '@/shared/services/BarberAccountService'
import { BookingPaymentService, BookingPaymentPayload } from '@/shared/services/BookingPaymentService'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY')
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error('Missing STRIPE_WEBHOOK_SECRET')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20" as any,
})

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'No signature found' }, { status: 400 })
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('STRIPE_WEBHOOK_SECRET is not configured')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      logger.error('Webhook signature verification failed', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    if (!event.type || typeof event.type !== 'string') {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 })
    }

    switch (event.type) {
      case 'account.created': {
        const account = event.data.object as Stripe.Account
        const barberId = account.metadata?.barber_id
        if (!barberId) {
          logger.error('No barber ID found in account metadata')
          return NextResponse.json({ error: 'No barber ID found' }, { status: 400 })
        }
        await BarberAccountService.createAccount(account.id, barberId)
        break
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        await BarberAccountService.updateAccountStatus(account.id, account.charges_enabled, account.details_submitted)
        break
      }

      case 'account.application.deauthorized': {
        const application = event.data.object as Stripe.Application
        await BarberAccountService.deauthorizeAccount(application.id)
        break
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (!session.metadata?.bookingId) {
          logger.error('No booking ID found in session metadata')
          return NextResponse.json({ error: 'No booking ID found' }, { status: 400 })
        }
        await BookingPaymentService.updateBookingStatus(session.metadata.bookingId, {
          status: 'confirmed',
          payment_status: 'succeeded',
          payment_intent_id: session.payment_intent as string,
        })
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session
        if (!session.metadata?.bookingId) {
          return NextResponse.json({ error: 'No booking ID found' }, { status: 400 })
        }
        await BookingPaymentService.updateBookingStatus(session.metadata.bookingId, {
          status: 'cancelled',
          payment_status: 'failed',
        })
        break
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const rawMeta = (paymentIntent.metadata || {}) as Record<string, string>
        const parsed = parseStripeBookingMetadata(rawMeta)

        if (!parsed.ok) {
          logger.error('Missing required booking metadata in payment intent', { paymentIntentId: paymentIntent.id, missing: parsed.missing })
          await BookingPaymentService.trackMissingMetadata(paymentIntent.id, paymentIntent.amount, paymentIntent.currency, parsed.missing, parsed.raw)
          break
        }

        const meta = parsed.value

        const normalizedClientId = meta.clientId && meta.clientId.trim().length > 0
          ? meta.clientId
          : (meta.guestName || meta.guestEmail || meta.guestPhone) ? 'guest' : ''

        if (!normalizedClientId) {
          logger.error('Payment intent missing clientId and no guest info provided')
          break
        }

        const breakdown = calculateFeeBreakdown()
        
        let addonIdArray: string[] = []
        if (meta.addonIdsCsv && typeof meta.addonIdsCsv === 'string' && meta.addonIdsCsv.length > 0) {
          addonIdArray = [...new Set(meta.addonIdsCsv.split(',').filter(id => id.trim()))]
        }

        const payload: BookingPaymentPayload = {
          stripePaymentIntentId: paymentIntent.id,
          amountCents: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          destinationAccountId: typeof paymentIntent.transfer_data?.destination === 'string' 
            ? paymentIntent.transfer_data.destination 
            : undefined,
          applicationFeeAmountCents: paymentIntent.application_fee_amount || 0,
          barberId: meta.barberId,
          serviceId: meta.serviceId,
          date: meta.date,
          clientId: normalizedClientId === 'guest' ? null : normalizedClientId,
          guestName: meta.guestName || null,
          guestEmail: meta.guestEmail || null,
          guestPhone: meta.guestPhone || null,
          addonIds: addonIdArray,
          platformFeeCents: breakdown.bocmGrossShare, 
          barberPayoutCents: breakdown.barberShare,
          priceCents: breakdown.netAfterStripe,
          notes: meta.notes || null
        }

        await BookingPaymentService.confirmPayment(payload)
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await BookingPaymentService.markPaymentFailed(paymentIntent.id)
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        if (!charge.payment_intent || typeof charge.payment_intent !== 'string') {
          return NextResponse.json({ error: 'Invalid payment intent reference' }, { status: 400 })
        }
        const destinationAccountId = typeof charge.transfer === 'string' ? charge.transfer : undefined;
        await BookingPaymentService.handleRefund(charge.payment_intent, charge.amount_refunded, charge.amount, charge.currency, destinationAccountId)
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error('Error processing webhook', error)
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 })
  }
}