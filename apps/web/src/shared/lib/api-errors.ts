import { NextResponse } from 'next/server'
import { logger } from '@/shared/lib/logger'

const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'api_key',
  'apikey',
  'authorization',
  'cookie',
  'session',
]

function isSensitiveKey(key: string): boolean {
  const lowered = key.toLowerCase()
  return SENSITIVE_KEYS.some((sensitive) => lowered.includes(sensitive))
}

export function redactContext(context: Record<string, unknown> = {}): Record<string, unknown> {
  const redacted: Record<string, unknown> = {}

  Object.entries(context).forEach(([key, value]) => {
    if (isSensitiveKey(key)) {
      redacted[key] = '[REDACTED]'
      return
    }

    if (value && typeof value === 'object') {
      redacted[key] = '[REDACTED]'
      return
    }

    redacted[key] = value
  })

  return redacted
}

function getStatus(error: unknown): number {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status
    if (typeof status === 'number') {
      return status
    }
  }
  return 500
}

function getMessage(error: unknown, fallbackMessage?: string): string {
  if (fallbackMessage) {
    return fallbackMessage
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim().length > 0) {
      return message
    }
  }

  return 'Internal server error'
}

export function handleApiError(
  error: unknown,
  request?: Request,
  context?: Record<string, unknown>,
  options?: { status?: number; fallbackMessage?: string }
) {
  const status = options?.status ?? getStatus(error)
  const message = getMessage(error, options?.fallbackMessage)

  const requestInfo = request
    ? {
        method: request.method,
        path: new URL(request.url).pathname,
      }
    : {}

  logger.error('API error', error, redactContext({ ...requestInfo, ...context, status }))

  return NextResponse.json({ error: message }, { status })
}
