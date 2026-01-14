import { supabase } from './supabase'
import { logger } from './logger'

const DEFAULT_BASE_URL = 'https://www.bocmstyle.com'

function getBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL || DEFAULT_BASE_URL
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
}

async function getAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    logger.warn('Failed to get Supabase session for API token:', error)
    return null
  }
  return data.session?.access_token || null
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

