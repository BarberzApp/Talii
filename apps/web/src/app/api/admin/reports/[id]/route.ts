import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { updateReport } from '@/server/admin'
import { REPORT_STATUSES } from '@/server/safety'
import { idParams } from '@/server/validation'

/**
 * PATCH /api/admin/reports/:id   (admin)
 * Body: { status: pending|reviewed|resolved|dismissed }
 * 200 { report }   404 REPORT_NOT_FOUND
 */
export const PATCH = defineRoute(
  { auth: 'admin', params: idParams, body: z.object({ status: z.enum(REPORT_STATUSES) }).strict() },
  async ({ params, body }) => updateReport(params.id, body.status)
)
