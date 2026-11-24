// Utility functions for handling redirect URLs during login
import { logger } from './logger'

/**
 * Store a URL to redirect to after successful login
 * @param url The URL to redirect to after login
 */
export const storeRedirectUrl = (url: string) => {
  try {
    sessionStorage.setItem('redirectAfterLogin', url)
  } catch (error) {
    logger.error('Failed to store redirect URL', error)
  }
}

/**
 * Get and remove the stored redirect URL
 * @returns The stored redirect URL or null if none exists
 */
export const getAndClearRedirectUrl = (): string | null => {
  try {
    const url = sessionStorage.getItem('redirectAfterLogin')
    if (url) {
      sessionStorage.removeItem('redirectAfterLogin')
    }
    return url
  } catch (error) {
    logger.error('Failed to get redirect URL', error)
    return null
  }
}

/**
 * Check if there's a stored redirect URL
 * @returns True if a redirect URL is stored
 */
export const hasStoredRedirectUrl = (): boolean => {
  try {
    return !!sessionStorage.getItem('redirectAfterLogin')
  } catch (error) {
    logger.error('Failed to check redirect URL', error)
    return false
  }
}

/**
 * Clear any stored redirect URL
 */
export const clearRedirectUrl = () => {
  try {
    sessionStorage.removeItem('redirectAfterLogin')
  } catch (error) {
    logger.error('Failed to clear redirect URL', error)
  }
}

/**
 * Store the current page URL as the redirect target
 * This is useful for protecting routes that require authentication
 */
export const storeCurrentPageAsRedirect = () => {
  try {
    const currentUrl = window.location.pathname + window.location.search
    // Don't store login or register pages as redirect targets
    if (!currentUrl.includes('/login') && !currentUrl.includes('/register')) {
      storeRedirectUrl(currentUrl)
    }
  } catch (error) {
    logger.error('Failed to store current page as redirect', error)
  }
} 
/** Role picked on the sign-up page before a Google OAuth redirect (read once by /auth/callback). */
export const PENDING_ROLE_KEY = 'talii:pending-signup-role'

/** A pending role is honoured only this soon after it was chosen. */
export const PENDING_ROLE_MAX_AGE_MS = 10 * 60 * 1000

type PendingRole = { role: 'barber' | 'client'; at: number }

export function setPendingSignupRole(role: 'barber' | 'client'): void {
  try {
    window.localStorage.setItem(PENDING_ROLE_KEY, JSON.stringify({ role, at: Date.now() } satisfies PendingRole))
  } catch {
    // storage unavailable: the account stays a client and can switch in onboarding
  }
}

export function clearPendingSignupRole(): void {
  try {
    window.localStorage.removeItem(PENDING_ROLE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Reads and always clears the pending role. Returns it only when it was chosen
 * within PENDING_ROLE_MAX_AGE_MS and the account was created after it was
 * chosen (a brand-new sign-up), so a stale choice never promotes a later sign-in.
 */
export function takePendingSignupRole(profileCreatedAt: string, now: number = Date.now()): 'barber' | 'client' | null {
  let pending: PendingRole | null = null
  try {
    const raw = window.localStorage.getItem(PENDING_ROLE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<PendingRole>) : null
    if (parsed && (parsed.role === 'barber' || parsed.role === 'client') && typeof parsed.at === 'number') {
      pending = { role: parsed.role, at: parsed.at }
    }
  } catch {
    pending = null
  }
  clearPendingSignupRole()
  if (!pending) return null

  const created = Date.parse(profileCreatedAt)
  const fresh = now - pending.at >= 0 && now - pending.at <= PENDING_ROLE_MAX_AGE_MS
  // Clock skew allowance of a minute between the browser and the database.
  const justCreated = Number.isFinite(created) && created >= pending.at - 60_000 && now - created <= PENDING_ROLE_MAX_AGE_MS
  return fresh && justCreated ? pending.role : null
}

/** The browser's IANA time zone, if it reports one. */
export function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}
