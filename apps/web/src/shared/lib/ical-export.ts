/**
 * Calendar (.ics) files for appointments. Times are written in UTC, so any
 * calendar app shows them in the viewer's own zone at the right moment.
 */

export type IcsEvent = {
  /** Stable id (e.g. the booking id), so re-importing updates instead of duplicating. */
  id: string
  /** ISO instants. */
  start: string
  end: string
  summary: string
  description?: string
  location?: string
  url?: string
}

function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** RFC 5545 text escaping: backslash, semicolon, comma and newlines. */
export function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

export function buildIcs(events: IcsEvent[], now: Date = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Talii//Bookings//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@talii`,
      `DTSTAMP:${icsDate(now.toISOString())}`,
      `DTSTART:${icsDate(event.start)}`,
      `DTEND:${icsDate(event.end)}`,
      `SUMMARY:${escapeIcsText(event.summary)}`
    )
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`)
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`)
    if (event.url) lines.push(`URL:${event.url}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

/** Starts a download of the events as an .ics file (browser only). */
export function downloadIcs(events: IcsEvent[], filename: string): void {
  const blob = new Blob([buildIcs(events)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
