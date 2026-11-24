import type { MeResponse } from '../../api/types'
import {
  AuthAdapter,
  AuthLoginResult,
  AuthProfile,
  AuthProfilePatch,
  AuthRegisterResult,
  AuthSignUpInput,
  AuthState,
  AuthUser,
} from './auth-types'

const DEFAULT_RETRY_ATTEMPTS = 3
const DEFAULT_RETRY_DELAY_MS = 1000

/**
 * Error codes worth retrying while loading the profile: the signup trigger has
 * not committed yet (NO_PROFILE), or the API/auth service was briefly unreachable.
 * PGRST116 is kept for adapters that still read the table directly.
 */
const RETRYABLE_PROFILE_ERRORS = new Set(['NO_PROFILE', 'PGRST116', 'AUTH_UNAVAILABLE', 'NETWORK_ERROR', 'TIMEOUT'])

const PATCHABLE_KEYS = ['name', 'phone', 'username', 'avatar_url', 'cover_photo_url'] as const

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isProfileComplete(profile: AuthProfile) {
  return !!profile.role && !!profile.username
}

/** Maps GET /api/me to the AuthProfile both apps keep in their auth state. */
export function profileFromMe(me: MeResponse): AuthProfile {
  const role = me.profile.role === 'barber' ? 'barber' : 'client'
  return {
    id: me.profile.id,
    name: me.profile.name,
    email: me.profile.email ?? me.user.email,
    role,
    phone: me.profile.phone,
    username: me.profile.username,
    avatar_url: me.profile.avatar_url,
    cover_photo_url: me.profile.cover_photo_url,
    created_at: me.profile.created_at,
    updated_at: me.profile.updated_at,
    is_admin: me.isAdmin,
    barber_id: role === 'barber' ? me.barber?.id ?? null : null,
    business_name: role === 'barber' ? me.barber?.business_name ?? null : null,
    onboarding_complete: role === 'barber' ? me.barber?.onboarding_complete ?? false : null,
  }
}

function authenticatedState(user: AuthUser, profile: AuthProfile): AuthState {
  return {
    status: 'authenticated',
    isLoading: false,
    isInitialized: true,
    user,
    profile,
  }
}

function unauthenticatedState(): AuthState {
  return {
    status: 'unauthenticated',
    isLoading: false,
    isInitialized: true,
    user: null,
    profile: null,
  }
}

export async function fetchProfileWithRetry(
  adapter: AuthAdapter,
  userId: string,
  options?: { attempts?: number; delayMs?: number }
) {
  const attempts = options?.attempts ?? DEFAULT_RETRY_ATTEMPTS
  const delayMs = options?.delayMs ?? DEFAULT_RETRY_DELAY_MS

  let profile: AuthProfile | null = null
  let lastErrorCode: string | undefined

  for (let i = 0; i < attempts; i += 1) {
    const result = await adapter.getProfile(userId)
    if (result.profile) {
      profile = result.profile
      break
    }

    lastErrorCode = result.errorCode
    if (result.errorCode && !RETRYABLE_PROFILE_ERRORS.has(result.errorCode)) {
      break
    }

    if (i < attempts - 1) {
      await delay(delayMs)
    }
  }

  return { profile, lastErrorCode }
}

export class AuthController {
  private adapter: AuthAdapter
  private retryAttempts: number
  private retryDelayMs: number

  constructor(adapter: AuthAdapter, options?: { attempts?: number; delayMs?: number }) {
    this.adapter = adapter
    this.retryAttempts = options?.attempts ?? DEFAULT_RETRY_ATTEMPTS
    this.retryDelayMs = options?.delayMs ?? DEFAULT_RETRY_DELAY_MS
  }

  private loadProfile(userId: string) {
    return fetchProfileWithRetry(this.adapter, userId, {
      attempts: this.retryAttempts,
      delayMs: this.retryDelayMs,
    })
  }

  async initialize(): Promise<AuthState> {
    const { user } = await this.adapter.getSession()
    return this.handleAuthChange(user)
  }

  async handleAuthChange(user: AuthUser | null): Promise<AuthState> {
    if (!user) return unauthenticatedState()

    const { profile } = await this.loadProfile(user.id)
    if (!profile) return unauthenticatedState()

    return authenticatedState(user, profile)
  }

  async login(email: string, password: string): Promise<{
    state: AuthState
    result: AuthLoginResult
  }> {
    const { user, errorMessage } = await this.adapter.signInWithPassword(email, password)
    if (!user || errorMessage) {
      return { state: unauthenticatedState(), result: { ok: false, reason: 'auth-error', errorMessage } }
    }

    const { profile } = await this.loadProfile(user.id)
    if (!profile) {
      return { state: unauthenticatedState(), result: { ok: false, reason: 'profile-missing' } }
    }

    if (!isProfileComplete(profile)) {
      return { state: unauthenticatedState(), result: { ok: false, reason: 'profile-incomplete' } }
    }

    return { state: authenticatedState(user, profile), result: { ok: true } }
  }

  /**
   * Signs up with role, name, username and business name in the auth metadata;
   * the database creates the profile (and the barber rows for barbers).
   */
  async register(input: AuthSignUpInput): Promise<{ state: AuthState; result: AuthRegisterResult }> {
    const signUp = await this.adapter.signUp(input)
    if (signUp.errorMessage) {
      return {
        state: unauthenticatedState(),
        result: { ok: false, reason: 'auth-error', alreadyExists: signUp.alreadyExists, errorMessage: signUp.errorMessage },
      }
    }

    if (signUp.alreadyExists) {
      return { state: unauthenticatedState(), result: { ok: false, alreadyExists: true } }
    }

    if (signUp.needsConfirmation) {
      return { state: unauthenticatedState(), result: { ok: true, needsConfirmation: true } }
    }

    if (!signUp.user) {
      return { state: unauthenticatedState(), result: { ok: false, reason: 'auth-error' } }
    }

    const { profile } = await this.loadProfile(signUp.user.id)
    if (!profile) {
      return { state: unauthenticatedState(), result: { ok: false, reason: 'profile-missing' } }
    }

    if (!isProfileComplete(profile)) {
      return { state: unauthenticatedState(), result: { ok: false, reason: 'profile-incomplete' } }
    }

    return { state: authenticatedState(signUp.user, profile), result: { ok: true } }
  }

  async logout(): Promise<AuthState> {
    await this.adapter.signOut()
    return unauthenticatedState()
  }

  async refreshProfile(userId: string): Promise<AuthState> {
    const { profile } = await this.loadProfile(userId)
    if (!profile) return unauthenticatedState()

    const user: AuthUser = { id: userId, email: profile.email || undefined }
    return authenticatedState(user, profile)
  }

  /**
   * PATCH /api/me through the adapter. Only name, phone, username, avatar_url and
   * cover_photo_url are sent; other keys are ignored. Throws with the server's
   * message when it fails.
   */
  async updateProfile(state: AuthState, input: Partial<AuthProfile>): Promise<AuthState> {
    if (!state.user || !state.profile) return state

    const patch: AuthProfilePatch = {}
    for (const key of PATCHABLE_KEYS) {
      if (input[key] !== undefined) (patch as Record<string, unknown>)[key] = input[key]
    }
    if (Object.keys(patch).length === 0) return state

    const result = await this.adapter.updateProfile(state.user.id, patch)
    if (result.errorMessage) throw new Error(result.errorMessage)

    return {
      ...state,
      profile: result.profile ?? { ...state.profile, ...patch },
    }
  }

  /** @deprecated Favorites were removed from the schema; returns the state unchanged. */
  async addToFavorites(state: AuthState, _barberId: string): Promise<AuthState> {
    return state
  }

  /** @deprecated Favorites were removed from the schema; returns the state unchanged. */
  async removeFromFavorites(state: AuthState, _barberId: string): Promise<AuthState> {
    return state
  }
}
