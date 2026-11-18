import { defineRoute } from '@/server/route'

/**
 * GET /api/health   (public)   Liveness only (no database call). Kept because the Cypress smoke
 * test (cypress/e2e/booking-flow.cy.ts) calls it.
 * 200 { status: "healthy", timestamp }
 */
export const GET = defineRoute({ auth: 'public' }, async () => ({
  status: 'healthy',
  timestamp: new Date().toISOString(),
}))
