import { NextRequest, NextResponse } from 'next/server'

// CSRF token store (in production, use Redis or database)
const csrfTokens = new Map<string, { token: string; expires: number }>()

// Generate CSRF token
export function generateCSRFToken(sessionId: string): string {
  // Use Web Crypto so this works in both Node and Edge runtimes
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  const expires = Date.now() + (30 * 60 * 1000) // 30 minutes
  
  csrfTokens.set(sessionId, { token, expires })
  
  // Clean up expired tokens
  cleanupExpiredTokens()
  
  return token
}

// Verify CSRF token
export function verifyCSRFToken(sessionId: string, token: string): boolean {
  const stored = csrfTokens.get(sessionId)
  
  if (!stored || Date.now() > stored.expires) {
    return false
  }
  
  return stored.token === token
}

// Clean up expired tokens
function cleanupExpiredTokens() {
  const now = Date.now()
  for (const [key, value] of csrfTokens.entries()) {
    if (now > value.expires) {
      csrfTokens.delete(key)
    }
  }
}

// CSRF middleware
export function csrfProtection(request: NextRequest) {
  // Skip CSRF for GET requests and API routes that don't need it
  if (request.method === 'GET') {
    return NextResponse.next()
  }
  
  // Skip for certain API routes
  const skipPaths = ['/api/auth/', '/api/webhooks/']
  if (skipPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next()
  }
  
  const sessionId = request.headers.get('x-session-id')
  const csrfToken = request.headers.get('x-csrf-token') || 
                   request.headers.get('csrf-token')
  
  if (!sessionId || !csrfToken) {
    return NextResponse.json(
      { error: 'CSRF token required' },
      { status: 403 }
    )
  }
  
  if (!verifyCSRFToken(sessionId, csrfToken)) {
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    )
  }
  
  return NextResponse.next()
}

// Generate CSRF token for client
export function getCSRFToken(sessionId: string): string {
  return generateCSRFToken(sessionId)
}
