/**
 * iCal (.ics) export helpers for calendar appointments.
 */

import { logger } from './logger'

type IcalEvent = {
  title: string
  start: string
  end: string
  extendedProps: {
    serviceName: string
    clientName: string
    price: number
    isGuest: boolean
    guestEmail?: string
    guestPhone?: string
  }
}

function buildEventText(
  event: IcalEvent,
  userRole: 'barber' | 'client',
  userInfo: { name: string; email: string; location?: string }
): { summary: string; description: string; location?: string } {
  let description = ''
  let summary = ''

  if (userRole === 'barber') {
    summary = `Appointment: ${event.extendedProps.serviceName} - ${event.extendedProps.clientName}`
    description = `Service: ${event.extendedProps.serviceName}
Client: ${event.extendedProps.clientName}
Price: $${event.extendedProps.price}
${event.extendedProps.isGuest ? `Guest Email: ${event.extendedProps.guestEmail || 'N/A'}
Guest Phone: ${event.extendedProps.guestPhone || 'N/A'}` : ''}

Booked through BOCM`
  } else {
    summary = `Appointment: ${event.extendedProps.serviceName}`
    description = `Service: ${event.extendedProps.serviceName}
Price: $${event.extendedProps.price}

Booked through BOCM`
  }

  return { summary, description, location: userInfo.location }
}

/**
 * Generate iCal file content for downloading
 */
export function generateICalContent(
  events: Array<{
    title: string
    start: string
    end: string
    extendedProps: {
      serviceName: string
      clientName: string
      price: number
      isGuest: boolean
      guestEmail?: string
      guestPhone?: string
    }
  }>,
  userRole: 'barber' | 'client',
  userInfo: {
    name: string
    email: string
    location?: string
  }
): string {
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  }

  let icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BOCM//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ]

  events.forEach((event, index) => {
    const startDate = new Date(event.start)
    const endDate = new Date(event.end)
    const calendarEvent = buildEventText(event, userRole, userInfo)
    
    icalContent.push(
      'BEGIN:VEVENT',
      `UID:${event.title.replace(/\s+/g, '-')}-${index}-${Date.now()}@bocm.com`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(startDate)}`,
      `DTEND:${formatDate(endDate)}`,
      `SUMMARY:${calendarEvent.summary}`,
      `DESCRIPTION:${calendarEvent.description.replace(/\n/g, '\\n')}`,
      calendarEvent.location ? `LOCATION:${calendarEvent.location}` : '',
      'END:VEVENT'
    )
  })

  icalContent.push('END:VCALENDAR')
  
  return icalContent.filter(line => line !== '').join('\r\n')
}

/**
 * Download events as iCal file
 */
export function downloadICalFile(
  events: Array<{
    title: string
    start: string
    end: string
    extendedProps: {
      serviceName: string
      clientName: string
      price: number
      isGuest: boolean
      guestEmail?: string
      guestPhone?: string
    }
  }>,
  userRole: 'barber' | 'client',
  userInfo: {
    name: string
    email: string
    location?: string
  },
  filename: string = 'bocm-appointments.ics'
): void {
  try {
    const icalContent = generateICalContent(events, userRole, userInfo)
    const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    logger.error('Error downloading iCal file', error)
    throw new Error('Failed to download calendar file')
  }
} 