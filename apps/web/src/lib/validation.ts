import { z } from 'zod'

// Common validation schemas
export const emailSchema = z.string().email('Invalid email address').max(255)
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(128)
export const phoneSchema = z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number').max(20)
export const nameSchema = z.string().min(1, 'Name is required').max(100).regex(/^[a-zA-Z\s\-'\.]+$/, 'Invalid characters in name')
export const usernameSchema = z.string().min(3, 'Username must be at least 3 characters').max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')

// Sanitization functions
export function sanitizeString(input: string, maxLength: number = 1000): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/data:/gi, '') // Remove data: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .trim()
    .substring(0, maxLength)
}

export function sanitizeHtml(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '') // Remove object tags
    .replace(/<embed\b[^<]*>/gi, '') // Remove embed tags
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
}

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export function rateLimit(identifier: string, limit: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now()
  const key = identifier
  const current = rateLimitStore.get(key)
  
  if (!current || now > current.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (current.count >= limit) {
    return false
  }
  
  current.count++
  return true
}

// Clean up expired entries
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Clean up every minute

// Validation error handler
export function createValidationError(message: string, field?: string) {
  return {
    error: 'Validation Error',
    message,
    field,
    timestamp: new Date().toISOString()
  }
}

// SQL injection prevention
export function sanitizeSql(input: string): string {
  return input
    .replace(/[';\\]/g, '') // Remove single quotes, semicolons, and backslashes
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove SQL block comments start
    .replace(/\*\//g, '') // Remove SQL block comments end
    .replace(/\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b/gi, '') // Remove SQL keywords
}
