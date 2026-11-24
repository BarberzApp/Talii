import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { updateUser } from '@/server/admin'
import { idParams } from '@/server/validation'

/**
 * PATCH /api/admin/users/:id   (admin)
 * Body: any of { isDisabled, role: "client" | "barber", listingSuspended, feeExempt }
 *   isDisabled true also bans the auth user and releases the user's unpaid holds; false lifts the ban.
 *   role "barber" creates or restores the barber (and lifts the suspension unless listingSuspended
 *   is sent); "client" removes barber access and suspends the listing (the row is kept).
 *   listingSuspended is admin-only and independent of the barber's own is_public.
 *   listingSuspended / feeExempt need a barber row.
 * 200 { user (as in GET /api/admin/users), releasedHolds, signInBlocked: boolean | null }
 *     signInBlocked is false when disabling worked but the auth ban call failed.
 * Errors: 404 USER_NOT_FOUND, 400 CANNOT_DISABLE_SELF, 409 NOT_A_BARBER | ACCOUNT_DELETED,
 *         502 AUTH_UPDATE_FAILED (re-enable only)
 */
export const PATCH = defineRoute(
  {
    auth: 'admin',
    params: idParams,
    body: z
      .object({
        isDisabled: z.boolean().optional(),
        role: z.enum(['client', 'barber']).optional(),
        listingSuspended: z.boolean().optional(),
        feeExempt: z.boolean().optional(),
      })
      .strict()
      .refine((b) => Object.values(b).some((v) => v !== undefined), 'send at least one field')
      .refine((b) => !(b.role === 'client' && b.listingSuspended === false), 'a client cannot have an active listing'),
  },
  async ({ user, params, body }) => updateUser(user.id, params.id, body)
)
