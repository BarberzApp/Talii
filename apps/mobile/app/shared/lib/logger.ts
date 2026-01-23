/**
 * Simple logger utility
 * Disabled in production, enabled in development
 */
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production'

type SentryModule = {
  captureException: (error: Error, context?: Record<string, any>) => void
  captureMessage: (message: string, level?: string, context?: Record<string, any>) => void
}

let sentryModule: SentryModule | null = null

function getSentryModule(): SentryModule | null {
  if (sentryModule) return sentryModule
  try {
    // Lazy require to avoid circular import with sentry.ts
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sentryModule = require('./sentry') as SentryModule
    return sentryModule
  } catch {
    return null
  }
}

function extractError(args: unknown[]): Error | null {
  for (const arg of args) {
    if (arg instanceof Error) return arg
  }
  return null
}

function serializeArgs(args: unknown[]): string[] {
  return args.map((arg) => {
    if (arg instanceof Error) return arg.message
    if (typeof arg === 'string') return arg
    if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg)
    if (arg === null || arg === undefined) return String(arg)
    try {
      return JSON.stringify(arg)
    } catch {
      return '[Unserializable]'
    }
  })
}

type LogLevel = 'log' | 'error' | 'warn' | 'info' | 'debug'

class Logger {
  private shouldLog(level: LogLevel): boolean {
    // Always log errors
    if (level === 'error') return true
    // In development, log everything
    return isDev
  }

  log(...args: unknown[]): void {
    if (this.shouldLog('log')) {
      console.log(...args)
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(...args)
    }

    if (!isDev) {
      const sentry = getSentryModule()
      if (!sentry) return

      const error = extractError(args)
      const serializedArgs = serializeArgs(args)
      const message = serializedArgs[0] || 'Unknown error'

      if (error) {
        sentry.captureException(error, { message, args: serializedArgs })
      } else {
        sentry.captureMessage(message, 'error', { args: serializedArgs })
      }
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(...args)
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(...args)
    }
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(...args)
    }
  }
}

export const logger = new Logger()

