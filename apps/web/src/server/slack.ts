import 'server-only'
import { getServerEnv } from './env'
import { ApiError } from './errors'

/** Escapes text for Slack mrkdwn (&, <, >) so user input cannot form links or mentions. */
export function slackEscape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Posts a message to the support Slack webhook. 503 when not configured, 502 when Slack fails. */
export async function postToSlack(message: { text: string; blocks?: unknown[] }): Promise<void> {
  const url = getServerEnv().SLACK_WEBHOOK_URL
  if (!url) throw new ApiError(503, 'SUPPORT_UNAVAILABLE', 'Support messages are not available right now.')
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    throw new ApiError(502, 'SUPPORT_SEND_FAILED', 'Your message could not be sent. Please try again.')
  }
  if (!res.ok) throw new ApiError(502, 'SUPPORT_SEND_FAILED', 'Your message could not be sent. Please try again.')
}
