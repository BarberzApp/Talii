import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/shared/lib/logger'

// Simple HTML sanitizer to prevent XSS in email templates
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// In-memory rate limiter for error reports (best-effort for serverless)
const errorReportLimiter = new Map<string, { count: number; resetTime: number }>()
const ERROR_REPORT_LIMIT = 10 // max reports per window
const ERROR_REPORT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function checkErrorReportRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = errorReportLimiter.get(ip)
  if (!entry || now > entry.resetTime) {
    errorReportLimiter.set(ip, { count: 1, resetTime: now + ERROR_REPORT_WINDOW_MS })
    return true
  }
  if (entry.count >= ERROR_REPORT_LIMIT) return false
  entry.count++
  return true
}

// Developer contact info for error reporting
const DEVELOPER_EMAIL = 'bocmtexter@gmail.com'

// Email sending function using the existing utility pattern
async function sendErrorEmail(to: string, subject: string, htmlContent: string, textContent: string) {
  try {
    // Use absolute URL for server-side fetch
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'
    const response = await fetch(`${baseUrl}/api/send-error-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        subject,
        html: htmlContent,
        text: textContent
      })
    })
    
    if (!response.ok) {
      throw new Error(`Email API failed: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    logger.error('Failed to send error email', error)
    throw error
  }
}

interface ErrorReport {
  message: string
  stack?: string
  url?: string
  userAgent?: string
  userId?: string
  timestamp: string
  errorType: 'javascript' | 'react' | 'api' | 'network' | 'unhandled'
  componentStack?: string
  retryCount?: number
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP to prevent email bombing
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkErrorReportRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many error reports. Please try again later.' },
        { status: 429 }
      )
    }

    const errorData: ErrorReport = await request.json()
    
    // Log the error
    logger.error('Error Report Received', undefined, {
      ...errorData,
      ip
    })

    // Only send email for medium+ severity errors to avoid spam
    if (errorData.severity !== 'low') {
      await sendErrorNotification(errorData, request)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Error reported successfully' 
    })
  } catch (error) {
    logger.error('Failed to report error', error)
    return NextResponse.json(
      { error: 'Failed to report error' },
      { status: 500 }
    )
  }
}

async function sendErrorNotification(errorData: ErrorReport, request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const userAgent = errorData.userAgent || 'unknown'
    const url = errorData.url || 'unknown'
    
    // Determine severity emoji and color
    const severityInfo = {
      low: { emoji: '⚠️', color: '#FFA500' },
      medium: { emoji: '🔥', color: '#FF6B35' },
      high: { emoji: '🚨', color: '#FF0000' },
      critical: { emoji: '💥', color: '#8B0000' }
    }[errorData.severity]

    // Sanitize all user-supplied fields to prevent XSS in email
    const safeMessage = escapeHtml(errorData.message || '')
    const safeUrl = escapeHtml(url)
    const safeUserId = escapeHtml(errorData.userId || 'Guest')
    const safeStack = errorData.stack ? escapeHtml(errorData.stack) : ''
    const safeComponentStack = errorData.componentStack ? escapeHtml(errorData.componentStack) : ''
    const safeUserAgent = escapeHtml(userAgent)
    const safeIp = escapeHtml(ip)
    const safeTimestamp = escapeHtml(new Date(errorData.timestamp).toLocaleString())

    // Create detailed HTML email
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #000000, #333333); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; }
        .severity { display: inline-block; padding: 4px 12px; border-radius: 16px; color: white; font-weight: bold; background-color: ${severityInfo.color}; }
        .error-details { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .stack-trace { background-color: #1a1a1a; color: #00ff00; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 12px; overflow-x: auto; }
        .metadata { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 15px 0; }
        .metadata-item { background-color: #f8f9fa; padding: 10px; border-radius: 4px; }
        .metadata-label { font-weight: bold; color: #666; font-size: 12px; }
        .metadata-value { color: #333; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${severityInfo.emoji} BOCM Error Alert</h1>
          <p>An error has occurred in the BOCM application</p>
        </div>
        <div class="content">
          <div style="margin-bottom: 20px;">
            <span class="severity">${escapeHtml(errorData.severity.toUpperCase())}</span>
            <span style="margin-left: 10px; color: #666;">Type: ${escapeHtml(errorData.errorType)}</span>
          </div>
          
          <div class="error-details">
            <h3>Error Message</h3>
            <p><strong>${safeMessage}</strong></p>
          </div>

          <div class="metadata">
            <div class="metadata-item">
              <div class="metadata-label">URL</div>
              <div class="metadata-value">${safeUrl}</div>
            </div>
            <div class="metadata-item">
              <div class="metadata-label">User</div>
              <div class="metadata-value">${safeUserId}</div>
            </div>
            <div class="metadata-item">
              <div class="metadata-label">Timestamp</div>
              <div class="metadata-value">${safeTimestamp}</div>
            </div>
            <div class="metadata-item">
              <div class="metadata-label">IP Address</div>
              <div class="metadata-value">${safeIp}</div>
            </div>
            ${errorData.retryCount ? `
            <div class="metadata-item">
              <div class="metadata-label">Retry Count</div>
              <div class="metadata-value">${Number(errorData.retryCount)}</div>
            </div>
            ` : ''}
          </div>

          ${safeStack ? `
          <h3>Stack Trace</h3>
          <div class="stack-trace">${safeStack}</div>
          ` : ''}

          ${safeComponentStack ? `
          <h3>Component Stack</h3>
          <div class="stack-trace">${safeComponentStack}</div>
          ` : ''}

          <div style="margin-top: 20px; padding: 15px; background-color: #e3f2fd; border-radius: 4px;">
            <h4>User Agent</h4>
            <p style="font-size: 12px; color: #666;">${safeUserAgent}</p>
          </div>
        </div>
      </div>
    </body>
    </html>
    `

    // Create plain text version
    const textContent = `${severityInfo.emoji} BOCM Error Alert

Type: ${escapeHtml(errorData.errorType)}
Severity: ${escapeHtml(errorData.severity.toUpperCase())}
URL: ${safeUrl}
User: ${safeUserId}
Time: ${safeTimestamp}
IP: ${safeIp}
${errorData.retryCount ? `Retries: ${Number(errorData.retryCount)}\n` : ''}

Error Message:
${safeMessage}

${safeStack ? `Stack Trace:\n${safeStack}\n\n` : ''}
${safeComponentStack ? `Component Stack:\n${safeComponentStack}\n\n` : ''}

User Agent: ${safeUserAgent}
`

    const subject = `${severityInfo.emoji} BOCM ${errorData.severity.toUpperCase()} Error - ${errorData.errorType}`
    
    await sendErrorEmail(DEVELOPER_EMAIL, subject, htmlContent, textContent)
    logger.info(`Error email sent successfully to ${DEVELOPER_EMAIL}`)
  } catch (emailError) {
    logger.error('Failed to send error email', emailError)
    // Don't throw - we don't want error reporting to fail the app
  }
}