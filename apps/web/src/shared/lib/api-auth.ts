import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { supabase } from '@/shared/lib/supabase'
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
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!authHeader) return null
  if (!authHeader.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length).trim()
  return token.length > 0 ? token : null
}

/**
 * Validates the caller and returns a Supabase user.
 *
 * - Mobile: expects `Authorization: Bearer <access_token>`
 * - Web: falls back to cookie-based session when no Bearer token is present
 */
export async function validateBearerToken(request: Request): Promise<User> {
  // 1) Prefer explicit Bearer tokens (mobile)
  const token = getBearerToken(request)
  if (token) {
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user) {
      logger.warn('Bearer auth failed', { hasError: !!error })
      throw new ApiAuthError('Unauthorized', 401)
    }
    return data.user
  }

  // 2) Fallback to cookie session (web)
  try {
    const sb = createRouteHandlerClient({ cookies })
    const { data, error } = await sb.auth.getUser()
    if (error || !data?.user) {
      throw new ApiAuthError('Unauthorized', 401)
    }
    return data.user
  } catch (err) {
    if (err instanceof ApiAuthError) throw err
    throw new ApiAuthError('Unauthorized', 401)
  }
}

