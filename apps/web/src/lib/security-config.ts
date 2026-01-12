// Security configuration for the Barber App
export const securityConfig = {
  // Rate limiting
  rateLimits: {
    api: { limit: 100, windowMs: 15 * 60 * 1000 }, // 100 requests per 15 minutes
    auth: { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 auth attempts per 15 minutes
    support: { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 support requests per hour
    upload: { limit: 10, windowMs: 60 * 60 * 1000 }, // 10 uploads per hour
  },

  // Input validation
  validation: {
    maxStringLength: 1000,
    maxEmailLength: 255,
    maxPasswordLength: 128,
    minPasswordLength: 8,
    maxUsernameLength: 30,
    minUsernameLength: 3,
  },

  // Security headers
  headers: {
    csp: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com"],
      'style-src': ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      'font-src': ["'self'", "https://fonts.gstatic.com"],
      'img-src': ["'self'", "data:", "https:", "blob:"],
      'connect-src': ["'self'", "https://*.supabase.co", "https://api.stripe.com"],
      'frame-src': ["'self'", "https://js.stripe.com"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"]
    }
  },

  // Session security
  session: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    refreshThreshold: 10 * 60 * 1000, // Refresh if expires in 10 minutes
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict' as const
  },

  // CSRF protection
  csrf: {
    tokenLength: 32,
    maxAge: 30 * 60 * 1000, // 30 minutes
  },

  // Content Security
  contentModeration: {
    enabled: true,
    maxReviewLength: 500,
    minReviewLength: 10,
    profanityFilter: true,
    spamDetection: true
  },

  // Monitoring
  monitoring: {
    logSecurityEvents: true,
    alertOnCriticalEvents: true,
    maxEventsInMemory: 1000,
    webhookUrl: process.env.SECURITY_WEBHOOK_URL
  }
}

// Environment-specific overrides
if (process.env.NODE_ENV === 'development') {
  securityConfig.rateLimits.api.limit = 1000 // More lenient in development
  securityConfig.monitoring.logSecurityEvents = true
}

if (process.env.NODE_ENV === 'production') {
  securityConfig.session.secure = true
  securityConfig.monitoring.alertOnCriticalEvents = true
}
