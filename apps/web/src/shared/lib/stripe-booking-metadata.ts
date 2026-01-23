/**
 * Canonical Stripe metadata contract for booking creation.
 *
 * IMPORTANT: Stripe metadata values must be strings.
 * This module is the single source of truth for:
 * - building metadata on payment initiation
 * - parsing/validating metadata inside the webhook
 */
export const STRIPE_BOOKING_METADATA_KEYS = {
  required: ['barberId', 'serviceId', 'date', 'clientId'] as const,
  optional: [
    'notes',
    'guestName',
    'guestEmail',
    'guestPhone',
    'serviceName',
    'servicePrice',
    'addonTotal',
    'addonIds',
    'platformFee',
    'paymentType',
    'feeType',
    'bocmShare',
    'barberShare',
    'isDeveloper',
    'addonsPaidSeparately',
  ] as const,
}

export type StripeBookingMetadata = Record<string, string>

export type ParsedStripeBookingMetadata = {
  barberId: string
  serviceId: string
  date: string
  clientId: string
  notes?: string
  guestName?: string
  guestEmail?: string
  guestPhone?: string
  addonIdsCsv?: string
  addonTotalCents?: string
  addonsPaidSeparately?: string
  platformFeeCents?: string
  paymentType?: string
  feeType?: string
  bocmShareCents?: string
  barberShareCents?: string
  isDeveloper?: string
  serviceName?: string
  servicePriceCents?: string
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

export function normalizeAddonIdsToCsv(addonIds: unknown): string {
  if (Array.isArray(addonIds)) {
    const ids = addonIds
      .filter((x): x is string => typeof x === 'string')
      .map(s => s.trim())
      .filter(Boolean)
    return [...new Set(ids)].join(',')
  }
  const raw = typeof addonIds === 'string' ? addonIds : ''
  const ids = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  return [...new Set(ids)].join(',')
}

export function buildStripeBookingMetadata(input: {
  barberId: string
  serviceId: string
  date: string
  clientId: string // uuid OR 'guest'
  notes?: string
  guestName?: string
  guestEmail?: string
  guestPhone?: string
  serviceName?: string
  servicePriceCents?: number
  addonTotalCents?: number
  addonIds?: string[] | string
  platformFeeCents?: number
  paymentType?: 'fee'
  feeType?: 'fee_only'
  bocmShareCents?: number
  barberShareCents?: number
  isDeveloper?: boolean
  addonsPaidSeparately?: boolean
}): StripeBookingMetadata {
  const addonIdsCsv = normalizeAddonIdsToCsv(input.addonIds)

  // Stripe requires string values; keep empty strings for optional fields (stable keys).
  return {
    barberId: toStr(input.barberId),
    serviceId: toStr(input.serviceId),
    date: toStr(input.date),
    clientId: toStr(input.clientId),

    notes: toStr(input.notes),
    guestName: toStr(input.guestName),
    guestEmail: toStr(input.guestEmail),
    guestPhone: toStr(input.guestPhone),

    serviceName: toStr(input.serviceName),
    servicePrice: input.servicePriceCents === undefined ? '' : String(input.servicePriceCents),
    addonTotal: input.addonTotalCents === undefined ? '' : String(input.addonTotalCents),
    addonIds: addonIdsCsv,

    platformFee: input.platformFeeCents === undefined ? '' : String(input.platformFeeCents),
    paymentType: toStr(input.paymentType ?? 'fee'),
    feeType: toStr(input.feeType ?? 'fee_only'),

    bocmShare: input.bocmShareCents === undefined ? '' : String(input.bocmShareCents),
    barberShare: input.barberShareCents === undefined ? '' : String(input.barberShareCents),
    isDeveloper: input.isDeveloper === undefined ? '' : String(input.isDeveloper),

    addonsPaidSeparately:
      input.addonsPaidSeparately === undefined ? '' : String(input.addonsPaidSeparately),
  }
}

export function parseStripeBookingMetadata(
  meta: Record<string, string> | null | undefined
):
  | { ok: true; value: ParsedStripeBookingMetadata }
  | { ok: false; missing: string[]; raw: Record<string, string> } {
  const raw = meta || {}

  const missing: string[] = []
  for (const k of STRIPE_BOOKING_METADATA_KEYS.required) {
    const v = raw[k]
    if (!v || String(v).trim().length === 0) missing.push(k)
  }

  if (missing.length > 0) {
    return { ok: false, missing, raw }
  }

  return {
    ok: true,
    value: {
      barberId: raw.barberId,
      serviceId: raw.serviceId,
      date: raw.date,
      clientId: raw.clientId,
      notes: raw.notes || undefined,
      guestName: raw.guestName || undefined,
      guestEmail: raw.guestEmail || undefined,
      guestPhone: raw.guestPhone || undefined,
      addonIdsCsv: raw.addonIds || undefined,
      addonTotalCents: raw.addonTotal || undefined,
      addonsPaidSeparately: raw.addonsPaidSeparately || undefined,
      platformFeeCents: raw.platformFee || undefined,
      paymentType: raw.paymentType || undefined,
      feeType: raw.feeType || undefined,
      bocmShareCents: raw.bocmShare || undefined,
      barberShareCents: raw.barberShare || undefined,
      isDeveloper: raw.isDeveloper || undefined,
      serviceName: raw.serviceName || undefined,
      servicePriceCents: raw.servicePrice || undefined,
    },
  }
}

