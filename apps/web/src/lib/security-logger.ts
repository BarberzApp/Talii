interface SecurityEvent {
  type: 'auth_failure' | 'rate_limit' | 'csrf_violation' | 'suspicious_activity' | 'data_breach_attempt'
  severity: 'low' | 'medium' | 'high' | 'critical'
  userId?: string
  ip: string
  userAgent: string
  details: Record<string, any>
  timestamp: string
}

class SecurityLogger {
  private events: SecurityEvent[] = []
  private maxEvents = 1000 // Keep last 1000 events in memory

  log(event: Omit<SecurityEvent, 'timestamp'>) {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date().toISOString()
    }

    this.events.push(securityEvent)
    
    // Keep only the most recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents)
    }

    // Log to console in development (intentional - security events should always be logged)
    if (process.env.NODE_ENV === 'development') {
      // Using console.warn for security events is intentional - these should always be visible
      console.warn(`🚨 Security Event [${event.severity.toUpperCase()}]:`, securityEvent)
    }

    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoring(securityEvent)
    }
  }

  private async sendToMonitoring(event: SecurityEvent) {
    // Send to your monitoring service (Sentry, DataDog, etc.)
    try {
      // Example: Send to Sentry
      // Sentry.captureMessage(`Security Event: ${event.type}`, {
      //   level: event.severity === 'critical' ? 'error' : 'warning',
      //   tags: { security: true, type: event.type },
      //   extra: event
      // })
      
      // Example: Send to webhook
      if (process.env.SECURITY_WEBHOOK_URL) {
        await fetch(process.env.SECURITY_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event)
        })
      }
    } catch (error) {
      console.error('Failed to send security event to monitoring:', error)
    }
  }

  getRecentEvents(limit: number = 50): SecurityEvent[] {
    return this.events.slice(-limit)
  }

  getEventsByType(type: SecurityEvent['type']): SecurityEvent[] {
    return this.events.filter(event => event.type === type)
  }

  getCriticalEvents(): SecurityEvent[] {
    return this.events.filter(event => event.severity === 'critical')
  }
}

export const securityLogger = new SecurityLogger()

// Helper functions for common security events
export function logAuthFailure(ip: string, userAgent: string, details: any) {
  securityLogger.log({
    type: 'auth_failure',
    severity: 'medium',
    ip,
    userAgent,
    details
  })
}

export function logRateLimit(ip: string, userAgent: string, endpoint: string) {
  securityLogger.log({
    type: 'rate_limit',
    severity: 'low',
    ip,
    userAgent,
    details: { endpoint }
  })
}

export function logCSRFViolation(ip: string, userAgent: string, userId?: string) {
  securityLogger.log({
    type: 'csrf_violation',
    severity: 'high',
    userId,
    ip,
    userAgent,
    details: {}
  })
}

export function logSuspiciousActivity(ip: string, userAgent: string, activity: string, userId?: string) {
  securityLogger.log({
    type: 'suspicious_activity',
    severity: 'medium',
    userId,
    ip,
    userAgent,
    details: { activity }
  })
}

export function logDataBreachAttempt(ip: string, userAgent: string, details: any) {
  securityLogger.log({
    type: 'data_breach_attempt',
    severity: 'critical',
    ip,
    userAgent,
    details
  })
}
