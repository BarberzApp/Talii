import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { enforceRateLimit, limiters } from '@/server/rate-limit'
import { postToSlack, slackEscape } from '@/server/slack'

/**
 * POST /api/support   (public)   Sends a support request to the team's Slack channel.
 * 5 per 15 minutes per IP.
 * Body: { name (max 100), email, category: booking|payment|account|technical|general|feedback,
 *         subject (max 150), message (max 2000) }
 * 200 { sent: true }
 * Errors: 400 VALIDATION_ERROR, 429 RATE_LIMITED, 502 SUPPORT_SEND_FAILED, 503 SUPPORT_UNAVAILABLE
 */
export const POST = defineRoute(
  {
    auth: 'public',
    body: z
      .object({
        name: z.string().trim().min(1).max(100),
        email: z.string().trim().email().max(254),
        category: z.enum(['booking', 'payment', 'account', 'technical', 'general', 'feedback']),
        subject: z.string().trim().min(1).max(150),
        message: z.string().trim().min(1).max(2000),
      })
      .strict(),
  },
  async ({ req, body }) => {
    enforceRateLimit(limiters.support, req)
    const name = slackEscape(body.name)
    const email = slackEscape(body.email)
    const title = `New support request - ${body.category.toUpperCase()}`
    await postToSlack({
      text: title,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: title } },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Name:*\n${name}` },
            { type: 'mrkdwn', text: `*Email:*\n${email}` },
            { type: 'mrkdwn', text: `*Category:*\n${body.category}` },
            { type: 'mrkdwn', text: `*Subject:*\n${slackEscape(body.subject)}` },
          ],
        },
        { type: 'section', text: { type: 'mrkdwn', text: `*Message:*\n${slackEscape(body.message)}` } },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `Received ${new Date().toISOString()} | Reply to: ${email}` }],
        },
      ],
    })
    return { sent: true }
  }
)
