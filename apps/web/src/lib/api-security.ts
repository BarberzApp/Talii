import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, sanitizeString, createValidationError } from './validation'
import { logAuthFailure, logRateLimit, logSuspiciousActivity } from './security-logger'
import { logger } from '@/shared/lib/logger'

interface SecurityOptions {
  requireAuth?: boolean
  rateLimit?: { limit: number; windowMs: number }
  validateInput?: boolean
  allowedMethods?: string[]
}

export function withSecurity(options: SecurityOptions = {}) {
  return function(handler: (req: NextRequest) => Promise<NextResponse>) {
    return async function(req: NextRequest): Promise<NextResponse> {
      try {
        // Check allowed methods
        if (options.allowedMethods && !options.allowedMethods.includes(req.method)) {
          return NextResponse.json(
            { error: 'Method not allowed' },
            { status: 405 }
          )
        }

        // Get client IP
        const ip = req.headers.get('x-forwarded-for') || 
                  req.headers.get('x-real-ip') || 
                  req.headers.get('cf-connecting-ip') || // Cloudflare
                  req.headers.get('x-client-ip') || 
                  'unknown'
        
        const userAgent = req.headers.get('user-agent') || 'unknown'

        // Rate limiting
        if (options.rateLimit) {
          const { limit, windowMs } = options.rateLimit
          if (!rateLimit(ip, limit, windowMs)) {
            logRateLimit(ip, userAgent, req.nextUrl.pathname)
            return NextResponse.json(
              { error: 'Too many requests' },
              { status: 429 }
            )
          }
        }

        // Authentication check
        if (options.requireAuth) {
          const authHeader = req.headers.get('authorization')
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logAuthFailure(ip, userAgent, { reason: 'Missing or invalid auth header' })
            return NextResponse.json(
              { error: 'Authentication required' },
              { status: 401 }
            )
          }
        }

        // Input validation
        if (options.validateInput && req.method !== 'GET') {
          try {
            const body = await req.json()
            // Basic validation - sanitize string inputs
            for (const [key, value] of Object.entries(body)) {
              if (typeof value === 'string') {
                body[key] = sanitizeString(value)
              }
            }
            
            // Create a new request with sanitized body
            const sanitizedReq = new NextRequest(req.url, {
              method: req.method,
              headers: req.headers,
              body: JSON.stringify(body)
            })
            
            return await handler(sanitizedReq)
          } catch (error) {
            logSuspiciousActivity(ip, userAgent, 'Invalid JSON in request body')
            return NextResponse.json(
              createValidationError('Invalid request body'),
              { status: 400 }
            )
          }
        }

        return await handler(req)
      } catch (error) {
        logger.error('Security middleware error', error)
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        )
      }
    }
  }
}

// Common security configurations
export const authRequired = withSecurity({ requireAuth: true })
export const rateLimited = withSecurity({ rateLimit: { limit: 10, windowMs: 60000 } })
export const secureAPI = withSecurity({ 
  requireAuth: true, 
  rateLimit: { limit: 20, windowMs: 60000 },
  validateInput: true,
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE']
})
