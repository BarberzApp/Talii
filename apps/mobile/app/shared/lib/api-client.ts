import { supabase } from './supabase'
import { logger } from './logger'

const DEFAULT_BASE_URL = 'https://www.bocmstyle.com'
let hasWarnedBaseUrl = false

function getBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL || DEFAULT_BASE_URL
  if (__DEV__ && !process.env.EXPO_PUBLIC_API_URL && !hasWarnedBaseUrl) {
    logger.warn('EXPO_PUBLIC_API_URL is not set; using production API URL')
    hasWarnedBaseUrl = true
  }
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
}

async function getAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    logger.warn('Failed to get Supabase session for API token:', error)
    return null
  }
  const session = data.session
  if (!session) return null

  const expiresAt = session.expires_at
  if (expiresAt) {
    const now = Math.floor(Date.now() / 1000)
    const bufferSeconds = 120
    if (expiresAt - now <= bufferSeconds) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) {
        logger.warn('Failed to refresh Supabase session:', refreshError)
        return session.access_token || null
      }
      return refreshed.session?.access_token || session.access_token || null
    }
  }

  return session.access_token || null
}

export class ApiError extends Error {
  status?: number
  details?: unknown

  constructor(message: string, status?: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const baseUrl = getBaseUrl()
  const url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`

  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')

  const needsAuth = options.auth !== false
  if (needsAuth) {
    const token = await getAccessToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
      if (__DEV__) {
        logger.log(`🔑 Token Info: Length=${token.length}, Prefix=${token.substring(0, 10)}...`)
      }
    } else if (__DEV__) {
      logger.warn(`⚠️ Auth required for ${path} but no access token found`)
    }
  }

  const res = await fetch(url, {
    ...options,
    headers,
  })

  const text = await res.text()
  let payload: any = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }

  if (!res.ok) {
    const message = payload?.error || payload?.message || `Request failed (${res.status})`
    throw new ApiError(message, res.status, payload)
  }

  return payload as T
}

