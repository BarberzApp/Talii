import { sendBookingReminderSMS } from './sendSMS'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'

export async function checkReminders() {
  const now = new Date()
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000)

  logger.debug('Checking for bookings between', { start: now.toISOString(), end: inOneHour.toISOString() })

  const { data: bookings, error } = await supabaseAdmin
    .from('bookings')
    .select(`
      *,
      barber:barber_id(*),
      service:service_id(*),
      client:client_id(*)
    `)
    .eq('status', 'confirmed')
    .gte('date', now.toISOString())
    .lte('date', inOneHour.toISOString())

  if (error) {
    logger.error('Error fetching bookings for reminders', error)
    throw error
  }

  logger.debug('Found bookings that need reminders', { count: bookings?.length || 0 })

  for (const booking of bookings || []) {
    try {
      logger.debug('Processing reminder for booking', { bookingId: booking.id })
      const smsResults = await sendBookingReminderSMS(booking)
      logger.debug('Reminder SMS results for booking', { bookingId: booking.id, results: smsResults })
    } catch (err) {
      logger.error(`Failed to send reminder for booking ${booking.id}`, err)
    }
  }

  logger.debug('Reminder check completed', { timestamp: now.toISOString() })
}
