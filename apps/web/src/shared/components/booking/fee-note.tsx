import { Info } from 'lucide-react'
import { TOTAL_PRICE_CENTS, formatCents } from '@barber-app/shared'
import { cn } from '@/shared/lib/utils'

/** The booking fee as shown to clients, e.g. "$3.40". */
export const BOOKING_FEE_LABEL = formatCents(TOTAL_PRICE_CENTS)

/**
 * One-line booking fee rule. The public barber profile does not say whether a
 * barber waives the fee, so the wording stays general (the booking form shows
 * the exact amount before paying).
 */
export function FeeNote({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <p className={cn('flex items-start gap-2 text-sm text-muted-foreground', className)}>
      <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-secondary" aria-hidden="true" />
      <span>
        {compact
          ? `Booking fee ${BOOKING_FEE_LABEL} (some barbers waive it). Service paid in person.`
          : `Booking holds your time with a ${BOOKING_FEE_LABEL} booking fee (some barbers waive it). You pay for the service itself in person at your appointment.`}
      </span>
    </p>
  )
}
