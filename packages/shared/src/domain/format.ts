// Display helpers shared by web and mobile. Money is integer cents; booking
// times are instants shown in the barber's time zone (barbers.timezone).

/** 2550 -> "$25.50"; whole dollars drop the cents when `compact` is set ("$25"). */
export function formatCents(
  cents: number | null | undefined,
  options: { currency?: string; locale?: string; compact?: boolean } = {}
): string {
  const value = Number.isFinite(cents) ? (cents as number) : 0
  const whole = value % 100 === 0
  return new Intl.NumberFormat(options.locale ?? 'en-US', {
    style: 'currency',
    currency: (options.currency ?? 'USD').toUpperCase(),
    minimumFractionDigits: options.compact && whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value / 100)
}

/** Dollars typed by a person ("25", "25.5", "$25.50") -> cents, or null when not a valid amount. */
export function dollarsToCents(input: string | number): number | null {
  const text = typeof input === 'number' ? String(input) : input.replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d{0,2})?$/.test(text)) return null
  const [whole, frac = ''] = text.split('.')
  return Number(whole) * 100 + Number((frac + '00').slice(0, 2))
}

/** Cents -> "25.50" for an editable dollars field. */
export function centsToDollarInput(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toFixed(2)
}

/** An instant in a time zone, e.g. "Tue, Nov 18, 2026" / "2:30 PM". */
export function formatInTimeZone(
  instant: string | Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-US'
): string {
  const date = typeof instant === 'string' ? new Date(instant) : instant
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(date)
  } catch {
    // Unknown time zone: fall back to the device's.
    return new Intl.DateTimeFormat(locale, options).format(date)
  }
}

export function formatBookingDate(instant: string | Date, timeZone: string, locale?: string): string {
  return formatInTimeZone(instant, timeZone, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }, locale)
}

export function formatBookingTime(instant: string | Date, timeZone: string, locale?: string): string {
  return formatInTimeZone(instant, timeZone, { hour: 'numeric', minute: '2-digit' }, locale)
}

/** "2:30 PM – 3:15 PM" in the barber's time zone. */
export function formatTimeRange(startsAt: string | Date, endsAt: string | Date, timeZone: string, locale?: string): string {
  return `${formatBookingTime(startsAt, timeZone, locale)} – ${formatBookingTime(endsAt, timeZone, locale)}`
}

/** Short zone name for display next to times, e.g. "EST". */
export function timeZoneAbbreviation(timeZone: string, at: string | Date = new Date(), locale = 'en-US'): string {
  try {
    const parts = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'short' }).formatToParts(
      typeof at === 'string' ? new Date(at) : at
    )
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? timeZone
  } catch {
    return timeZone
  }
}

/** "HH:MM:SS" or "HH:MM" wall-clock -> "9:00 AM". */
export function formatClockTime(clock: string | null | undefined): string {
  if (!clock) return ''
  const [h, m] = clock.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return clock
  if (h === 24) return '12:00 AM'
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}
