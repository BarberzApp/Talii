import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'

export class ApiAuthError extends Error {
  status: number

  constructor(message: string, status = 401) {
    super(message)
    this.name = 'ApiAuthError'
    this.status = status
  }
}

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  if (!authHeader.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length).trim()
  return token.length > 0 ? token : null
}

/**
 * Validates `Authorization: Bearer <supabase access token>` and returns the user.
 * Both web and mobile must send the header; there is no cookie fallback.
 */
export async function validateBearerToken(request: Request): Promise<User> {
  const token = getBearerToken(request)
  if (!token) {
    throw new ApiAuthError('Unauthorized', 401)
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) {
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Auth failed: token invalid or Supabase project mismatch', {
        error: error?.message,
      })
    }
    throw new ApiAuthError('Unauthorized', 401)
  }
  return data.user
}

/**
 * True when the user is an admin: `app_metadata.role === 'admin'`. Only when
 * app_metadata carries no role at all do we fall back to the SUPER_ADMIN_EMAIL
 * env var (comma-separated list allowed).
 */
export function isAdminUser(user: User): boolean {
  const role = (user.app_metadata as Record<string, unknown> | undefined)?.role
  if (typeof role === 'string' && role.length > 0) {
    return role === 'admin'
  }

  const allowed = (process.env.SUPER_ADMIN_EMAIL || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const email = user.email?.toLowerCase()
  // Only a confirmed address counts; otherwise anyone could sign up with it.
  return !!email && !!user.email_confirmed_at && allowed.includes(email)
}

/** Validates the Bearer token and requires an admin. Throws ApiAuthError (401/403). */
export async function requireAdmin(request: Request): Promise<User> {
  const user = await validateBearerToken(request)
  if (!isAdminUser(user)) {
    throw new ApiAuthError('Forbidden', 403)
  }
  return user
}

/**
 * Loads the caller's own barber row (by authenticated user id) with the service-role
 * client. Throws ApiAuthError 403 when the caller has no barber row.
 */
export async function getCallerBarber<T = Record<string, any>>(
  userId: string,
  columns = '*'
): Promise<T> {
  const { data, error } = await supabaseAdmin
    .from('barbers')
    .select(columns)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }
  if (!data) {
    throw new ApiAuthError('Barber account not found for this user', 403)
  }
  return data as T
}

/** Turns an ApiAuthError into a JSON response; returns null for anything else. */
export function authErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return null
}
