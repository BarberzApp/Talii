import { supabaseAdmin } from "@/shared/lib/supabase"
import { logger } from '@/shared/lib/logger'
import { sendBookingConfirmationSMS } from '@/shared/utils/sendSMS'

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded'

export interface BookingPaymentPayload {
  stripePaymentIntentId: string;
  amountCents: number;
  currency: string;
  status: string;
  destinationAccountId?: string;
  applicationFeeAmountCents: number;
  barberId: string;
  serviceId: string;
  date: string;
  clientId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  addonIds: string[];
  platformFeeCents: number;
  barberPayoutCents: number;
  priceCents: number;
  notes: string | null;
}

export class BookingPaymentService {
  /**
   * Helper function to update booking status/payment status (DB-aligned)
   */
  static async updateBookingStatus(
    bookingId: string,
    patch: {
      status?: BookingStatus
      payment_status?: PaymentStatus
      payment_intent_id?: string
    }
  ) {
    if (!bookingId || typeof bookingId !== 'string') {
      throw new Error('Invalid booking ID')
    }

    if (!patch || typeof patch !== 'object') {
      throw new Error('Invalid patch')
    }

    const { error } = await supabaseAdmin
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

  /**
   * Processes a successful payment intent, creating the booking and sending SMS if needed.
   */
  static async confirmPayment(payload: BookingPaymentPayload): Promise<void> {
    const { data: existingBooking, error: findError } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('payment_intent_id', payload.stripePaymentIntentId)
      .single()

    let bookingId: string | null = null

    if (!existingBooking) {
      // Get service price to store historically
      const { data: service } = await supabaseAdmin
        .from('services')
        .select('price')
        .eq('id', payload.serviceId)
        .single()

      const servicePrice = service?.price ? Number(service.price) : 0

      // Insert booking
      const { data: newBooking, error: createError } = await supabaseAdmin.from('bookings').insert({
        barber_id: payload.barberId,
        service_id: payload.serviceId,
        date: payload.date,
        status: 'confirmed',
        payment_status: 'succeeded',
        payment_intent_id: payload.stripePaymentIntentId,
        price: payload.priceCents / 100,
        service_price: servicePrice,
        addon_total: 0, // Calculated by DB trigger from booking_addons
        platform_fee: payload.platformFeeCents / 100,
        barber_payout: payload.barberPayoutCents / 100,
        notes: payload.notes,
        guest_name: payload.guestName,
        guest_email: payload.guestEmail,
        guest_phone: payload.guestPhone,
        client_id: payload.clientId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).select('*, barber:barber_id(*), service:service_id(*), client:client_id(*)').single()

      if (createError) {
        logger.error('Error creating booking after payment', createError)
        throw new Error('Error creating booking after payment')
      }

      bookingId = newBooking.id

      // Send SMS
      try {
        await sendBookingConfirmationSMS(newBooking)
      } catch (smsError) {
        logger.error('Failed to send SMS notifications', smsError)
      }

      // Track mobile payment success for analytics
      try {
        await supabaseAdmin
          .from('payment_events')
          .insert({
            payment_intent_id: payload.stripePaymentIntentId,
            event_type: 'mobile_payment_success',
            booking_id: newBooking.id,
            amount: payload.amountCents,
            currency: payload.currency,
            metadata: {
              source: 'mobile_app',
              barberId: payload.barberId,
              serviceId: payload.serviceId,
              clientId: payload.clientId,
              addonIds: payload.addonIds
            },
            created_at: new Date().toISOString()
          })
      } catch (trackingError) {
        logger.error('Error tracking mobile payment event', trackingError)
      }

      // Insert add-ons
      if (payload.addonIds.length > 0) {
        const { data: addons } = await supabaseAdmin
          .from('service_addons')
          .select('id, price')
          .in('id', payload.addonIds)
          .eq('is_active', true)

        if (addons && addons.length > 0) {
          const bookingAddons = addons.map(addon => ({
            booking_id: newBooking.id,
            addon_id: addon.id,
            price: addon.price
          }))

          const { error: addonError } = await supabaseAdmin
            .from('booking_addons')
            .insert(bookingAddons)

          if (addonError) {
            logger.error('Error adding add-ons to booking', addonError)
          }
        }
      }
    } else if (findError && (findError as any).code !== 'PGRST116') {
      logger.error('Error finding booking', findError)
      throw new Error('Failed to find booking')
    } else {
      // Booking already exists, just update status
      bookingId = existingBooking.id
      await this.updateBookingStatus(existingBooking.id, {
        status: 'confirmed',
        payment_status: 'succeeded',
        payment_intent_id: payload.stripePaymentIntentId,
      })
    }

    // Store successful payment
    if (bookingId) {
      const { error: paymentError } = await supabaseAdmin.from('payments').insert({
        payment_intent_id: payload.stripePaymentIntentId,
        amount: payload.amountCents,
        currency: payload.currency,
        status: payload.status,
        barber_stripe_account_id: payload.destinationAccountId,
        platform_fee: payload.applicationFeeAmountCents,
        booking_id: bookingId,
        created_at: new Date().toISOString(),
      })

      if (paymentError) {
        logger.error('Error storing payment in Supabase', paymentError)
        throw new Error('Error storing payment')
      }
    }
  }

  static async markPaymentFailed(paymentIntentId: string): Promise<void> {
    const { data: booking, error: findError } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('payment_intent_id', paymentIntentId)
      .single()

    if (findError || !booking) {
      logger.error('Error finding booking to fail', findError)
      throw new Error('Booking not found')
    }

    await this.updateBookingStatus(booking.id, {
      status: 'cancelled',
      payment_status: 'failed',
      payment_intent_id: paymentIntentId,
    })
  }

  static async handleRefund(paymentIntentId: string, amountRefunded: number, totalAmount: number, currency: string, destinationAccountId?: string): Promise<void> {
    const { data: booking, error: findError } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('payment_intent_id', paymentIntentId)
      .single()

    if (findError || !booking) {
      logger.error('Error finding booking to refund', findError)
      throw new Error('Booking not found')
    }

    const isPartialRefund = amountRefunded < totalAmount
    const refundStatus = isPartialRefund ? 'partially_refunded' : 'refunded'

    await this.updateBookingStatus(booking.id, {
      payment_status: refundStatus,
      payment_intent_id: paymentIntentId,
    })

    const { error: refundError } = await supabaseAdmin.from('payments').insert({
      payment_intent_id: paymentIntentId,
      amount: -amountRefunded,
      currency: currency,
      status: refundStatus,
      barber_stripe_account_id: destinationAccountId,
      platform_fee: 0,
      booking_id: booking.id,
      created_at: new Date().toISOString(),
    })

    if (refundError) {
      logger.error('Error storing refund payment record', refundError)
    }
  }

  static async trackMissingMetadata(paymentIntentId: string, amountCents: number, currency: string, missing: string[], rawMeta: any) {
    try {
      await supabaseAdmin.from('payment_events').insert({
        payment_intent_id: paymentIntentId,
        event_type: 'payment_intent_missing_metadata',
        booking_id: null,
        amount: amountCents,
        currency: currency,
        metadata: { missing, raw: rawMeta },
        created_at: new Date().toISOString(),
      } as any)
    } catch (trackingError) {
      logger.error('Error tracking missing-metadata event', trackingError)
    }
  }
}
