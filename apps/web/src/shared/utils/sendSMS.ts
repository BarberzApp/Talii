import nodemailer from 'nodemailer'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'

export const CARRIER_GATEWAYS: Record<string, string> = {
  verizon: 'vtext.com',
  att: 'txt.att.net',
  tmobile: 'tmomail.net',
  sprint: 'messaging.sprintpcs.com',
  boost: 'sms.myboostmobile.com',
  uscellular: 'email.uscc.net',
  cricket: 'sms.cricketwireless.net',
  metro: 'mymetropcs.com',
  googlefi: 'msg.fi.google.com',
}

export function getSmsAddress(phone: string, carrier: string): string {
  const domain = CARRIER_GATEWAYS[carrier.toLowerCase()]
  if (!domain) throw new Error('Unsupported carrier')
  return `${phone.replace(/\D/g, '')}@${domain}`
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
})

export async function sendSMS({ phoneNumber, carrier, message }: { phoneNumber: string; carrier: string; message: string }) {
  const to = getSmsAddress(phoneNumber, carrier)
  const mailOptions = { from: process.env.GMAIL_USER, to, subject: '', text: message }
  logger.debug('Attempting to send SMS', { to, from: process.env.GMAIL_USER })
  await transporter.sendMail(mailOptions)
  logger.debug('SMS sent successfully', { phoneNumber, carrier })
  return { success: true, message: 'SMS sent successfully' }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendBookingConfirmationSMS(bookingData: any) {
  const { booking, barber, service, client } = bookingData

  logger.debug('Starting SMS confirmation for booking', { bookingId: booking.id })

  let barberSmsData = null
  let barberName: string | null = null

  if (barber?.user_id) {
    try {
      const { data: barberProfile, error } = await supabaseAdmin
        .from('profiles')
        .select('phone, carrier, sms_notifications, first_name, last_name')
        .eq('id', barber.user_id)
        .single()
      if (!error && barberProfile) {
        barberSmsData = {
          phone: barberProfile.phone,
          carrier: barberProfile.carrier,
          sms_notifications: barberProfile.sms_notifications,
        }
        barberName = `${barberProfile.first_name} ${barberProfile.last_name}`.trim()
      }
    } catch (err) {
      logger.error('Error fetching barber profile data', err)
    }
  }

  const bookingDate = new Date(booking.date)
  const formattedDate = bookingDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const formattedTime = bookingDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const results = []

  if (client?.phone && client?.carrier && client?.sms_notifications) {
    const barberDisplayName = barberName || 'Your Barber'
    const clientMessage = `🎉 Booking Confirmed!\n\nService: ${service.name}\nDate: ${formattedDate}\nTime: ${formattedTime}\nBarber: ${barberDisplayName}\n\nSee you there!`
    try {
      await sendSMS({ phoneNumber: client.phone, carrier: client.carrier, message: clientMessage })
      results.push({ recipient: 'client', success: true })
    } catch (err: unknown) {
      logger.error('Failed to send client SMS', err)
      results.push({ recipient: 'client', success: false, error: (err as Error).message })
    }
  }

  const barberPhone = barberSmsData?.phone || barber?.phone
  const barberCarrier = barberSmsData?.carrier || barber?.carrier
  const barberSmsEnabled = barberSmsData?.sms_notifications || barber?.sms_notifications

  if (barberPhone && barberCarrier && barberSmsEnabled) {
    const clientName = client ? (client.name || `${client.first_name} ${client.last_name}`) : (booking.guest_name || 'Guest')
    const barberMessage = `📅 New Booking!\n\nClient: ${clientName}\nService: ${service.name}\nDate: ${formattedDate}\nTime: ${formattedTime}\n\nBooking ID: ${booking.id}`
    try {
      await sendSMS({ phoneNumber: barberPhone, carrier: barberCarrier, message: barberMessage })
      results.push({ recipient: 'barber', success: true })
    } catch (err: unknown) {
      logger.error('Failed to send barber SMS', err)
      results.push({ recipient: 'barber', success: false, error: (err as Error).message })
    }
  }

  logger.debug('SMS confirmation completed', { results })
  return results
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendBookingReminderSMS(bookingData: any) {
  const { booking, barber, service, client } = bookingData

  let barberName: string | null = null
  if (barber?.user_id) {
    try {
      const { data: barberProfile, error } = await supabaseAdmin
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', barber.user_id)
        .single()
      if (!error && barberProfile) {
        barberName = `${barberProfile.first_name} ${barberProfile.last_name}`.trim()
      }
    } catch (err) {
      logger.error('Error fetching barber name for reminder', err)
    }
  }

  const bookingDate = new Date(booking.date)
  const formattedTime = bookingDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const results = []

  if (client?.phone && client?.carrier && client?.sms_notifications) {
    const barberDisplayName = barberName || 'Your Barber'
    const clientMessage = `⏰ Appointment Reminder!\n\nYour appointment is in 1 hour:\nService: ${service.name}\nTime: ${formattedTime}\nBarber: ${barberDisplayName}\n\nSee you soon!`
    try {
      await sendSMS({ phoneNumber: client.phone, carrier: client.carrier, message: clientMessage })
      results.push({ recipient: 'client', success: true })
    } catch (err: unknown) {
      logger.error('Failed to send client reminder SMS', err)
      results.push({ recipient: 'client', success: false, error: (err as Error).message })
    }
  }

  if (barber?.phone && barber?.carrier && barber?.sms_notifications) {
    const clientName = client ? (client.name || `${client.first_name} ${client.last_name}`) : (booking.guest_name || 'Guest')
    const barberMessage = `⏰ Appointment Reminder!\n\nYou have an appointment in 1 hour:\nClient: ${clientName}\nService: ${service.name}\nTime: ${formattedTime}`
    try {
      await sendSMS({ phoneNumber: barber.phone, carrier: barber.carrier, message: barberMessage })
      results.push({ recipient: 'barber', success: true })
    } catch (err: unknown) {
      logger.error('Failed to send barber reminder SMS', err)
      results.push({ recipient: 'barber', success: false, error: (err as Error).message })
    }
  }

  return results
}
