import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { listReports } from '@/server/admin'
import { REPORT_STATUSES } from '@/server/safety'
import { queryInt } from '@/server/validation'

/**
 * GET /api/admin/reports?status=pending|reviewed|resolved|dismissed&limit=&offset=   (admin)
 * 200 { reports: [reports row + reporter_username, reported_username], pagination: { limit, offset, total } }
 */
export const GET = defineRoute(
  {
    auth: 'admin',
    query: z.object({
      status: z.enum(REPORT_STATUSES).optional(),
      limit: queryInt(1, 100, 25),
      offset: queryInt(0, 100_000, 0),
    }),
  },
  async ({ query }) => listReports(query)
)
