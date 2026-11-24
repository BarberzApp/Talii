import 'server-only'
import { z } from 'zod'
import { isValidDateString } from '@barber-app/shared'

/** Reusable zod pieces for route schemas. */

export const uuid = z.string().uuid()

/** An ISO 8601 instant with a zone ("2026-03-08T15:00:00Z" or "...-05:00"). */
export const isoDateTime = z.string().datetime({ offset: true })

/** A calendar date "YYYY-MM-DD". */
export const calendarDate = z.string().refine(isValidDateString, 'must be a date written YYYY-MM-DD')

/** Either an ISO instant or a calendar date (read as 00:00 UTC). Output: Date. */
export const instantOrDate = z.union([isoDateTime, calendarDate]).transform((v) => new Date(v))

/** Trimmed text; empty becomes undefined. */
export const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((v) => v.trim())
    .transform((v) => (v.length > 0 ? v : undefined))
    .optional()

/** Query param "a,b,c" → ["a","b","c"] validated against `item`. */
export const commaList = <T extends z.ZodTypeAny>(item: T) =>
  z
    .string()
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    )
    .pipe(z.array(item))

/** Query param integer with bounds and a default. */
export const queryInt = (min: number, max: number, fallback: number) =>
  z.coerce.number().int().min(min).max(max).default(fallback)

export const idParams = z.object({ id: uuid })

/**
 * For PATCH bodies: omitted → undefined (no change); null or blank → null
 * (clear); otherwise the trimmed text.
 */
export const nullableText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((v) => v.trim())
    .transform((v) => (v.length > 0 ? v : null))
    .nullable()
    .optional()

/** Local wall-clock time "HH:MM" (00:00-23:59), or "24:00" for end of day. */
export const clockTime = z
  .string()
  .regex(/^(?:([01]\d|2[0-3]):[0-5]\d|24:00)$/, 'must be a time written HH:MM')

/** Query param "true" / "false" → boolean. */
export const queryBool = z.enum(['true', 'false']).transform((v) => v === 'true')
