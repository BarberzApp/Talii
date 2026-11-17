import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/shared/lib/logger'

// Waitlist sign-ups are forwarded to the same Slack incoming webhook the
// support route uses. Vercel has no writable filesystem, so the old
// data/waitlist.txt approach never worked in production.
// TODO(phase-3): store sign-ups in the database instead of Slack.

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
}

export async function POST(req: NextRequest) {
  let email: unknown
  try {
    ;({ email } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  if (typeof email !== 'string' || !isValidEmail(email.trim())) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }
  const cleanEmail = email.trim().replace(/[<>]/g, '')

  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!slackWebhookUrl) {
    logger.error('SLACK_WEBHOOK_URL environment variable is not set')
    return NextResponse.json({ error: 'Waitlist not configured' }, { status: 500 })
  }

  try {
    const slackResponse = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `New waitlist sign-up: ${cleanEmail}` }),
    })
    if (!slackResponse.ok) {
      throw new Error(`Slack responded ${slackResponse.status}`)
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('Failed to forward waitlist sign-up', err)
    return NextResponse.json({ error: 'Failed to save email' }, { status: 500 })
  }
}
