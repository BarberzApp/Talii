import {
  AuthAdapter,
  AuthLoginResult,
  AuthProfile,
  AuthRegisterResult,
  AuthState,
  AuthUser,
} from './auth-types'

const DEFAULT_RETRY_ATTEMPTS = 3
const DEFAULT_RETRY_DELAY_MS = 1000

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isProfileComplete(profile: AuthProfile) {
  return !!profile.role && !!profile.username
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
    if (result.errorCode && result.errorCode !== 'PGRST116') {
      break
    }

    if (i < attempts - 1) {
      await delay(delayMs)
    }
  }

  return { profile, lastErrorCode }
}

export async function ensureBarberRowIfNeeded(adapter: AuthAdapter, profile: AuthProfile) {
  if (profile.role !== 'barber') return

  const { exists } = await adapter.getBarberRow(profile.id)
  if (exists) return

  await adapter.createBarberRow(profile.id, profile.business_name || '')
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

  async initialize(): Promise<AuthState> {
    const { user } = await this.adapter.getSession()
    if (!user) return unauthenticatedState()

    const { profile } = await fetchProfileWithRetry(this.adapter, user.id, {
      attempts: this.retryAttempts,
      delayMs: this.retryDelayMs,
    })
    if (!profile) return unauthenticatedState()

    await ensureBarberRowIfNeeded(this.adapter, profile)
    return authenticatedState(user, profile)
  }

  async handleAuthChange(user: AuthUser | null): Promise<AuthState> {
    if (!user) return unauthenticatedState()

    const { profile } = await fetchProfileWithRetry(this.adapter, user.id, {
      attempts: this.retryAttempts,
      delayMs: this.retryDelayMs,
    })
    if (!profile) return unauthenticatedState()

    await ensureBarberRowIfNeeded(this.adapter, profile)
    return authenticatedState(user, profile)
  }

  async login(email: string, password: string): Promise<{
    state: AuthState
    result: AuthLoginResult
  }> {
    const { user, errorMessage } = await this.adapter.signInWithPassword(email, password)
    if (!user || errorMessage) {
      return { state: unauthenticatedState(), result: { ok: false, reason: 'auth-error' } }
    }

    const { profile } = await fetchProfileWithRetry(this.adapter, user.id, {
      attempts: this.retryAttempts,
      delayMs: this.retryDelayMs,
    })
    if (!profile) {
      return { state: unauthenticatedState(), result: { ok: false, reason: 'profile-missing' } }
    }

    if (!isProfileComplete(profile)) {
      return { state: unauthenticatedState(), result: { ok: false, reason: 'profile-incomplete' } }
    }

    await ensureBarberRowIfNeeded(this.adapter, profile)
    return { state: authenticatedState(user, profile), result: { ok: true } }
  }

  async register(input: {
    name: string
    email: string
    password: string
    role: 'client' | 'barber'
    businessName?: string
  }): Promise<{ state: AuthState; result: AuthRegisterResult }> {
    const signUp = await this.adapter.signUp(input)
    if (signUp.errorMessage) {
      return { state: unauthenticatedState(), result: { ok: false, reason: 'auth-error' } }
    }

    if (signUp.needsConfirmation) {
      return { state: unauthenticatedState(), result: { ok: true, needsConfirmation: true } }
    }

    if (signUp.alreadyExists) {
      return { state: unauthenticatedState(), result: { ok: false, alreadyExists: true } }
    }

    if (!signUp.user) {
      return { state: unauthenticatedState(), result: { ok: false, reason: 'auth-error' } }
    }

    let { profile } = await fetchProfileWithRetry(this.adapter, signUp.user.id, {
      attempts: this.retryAttempts,
      delayMs: this.retryDelayMs,
    })

    if (!profile && this.adapter.createProfile) {
      const username = input.email.split('@')[0]
      await this.adapter.createProfile({
        id: signUp.user.id,
        name: input.name,
        email: input.email,
        role: input.role,
        username,
        businessName: input.businessName,
      })
      const retry = await fetchProfileWithRetry(this.adapter, signUp.user.id, {
        attempts: this.retryAttempts,
        delayMs: this.retryDelayMs,
      })
      profile = retry.profile
    }

    if (!profile) {
      return { state: unauthenticatedState(), result: { ok: false, reason: 'profile-missing' } }
    }

    if (!isProfileComplete(profile)) {
      return { state: unauthenticatedState(), result: { ok: false, reason: 'profile-incomplete' } }
    }

    await ensureBarberRowIfNeeded(this.adapter, profile)
    return { state: authenticatedState(signUp.user, profile), result: { ok: true } }
  }

  async logout(): Promise<AuthState> {
    await this.adapter.signOut()
    return unauthenticatedState()
  }

  async refreshProfile(userId: string): Promise<AuthState> {
    const { profile } = await fetchProfileWithRetry(this.adapter, userId, {
      attempts: this.retryAttempts,
      delayMs: this.retryDelayMs,
    })
    if (!profile) return unauthenticatedState()

    const user: AuthUser = { id: userId, email: profile.email || undefined }
    await ensureBarberRowIfNeeded(this.adapter, profile)
    return authenticatedState(user, profile)
  }

  async updateProfile(
    state: AuthState,
    patch: Partial<AuthProfile>
  ): Promise<AuthState> {
    if (!state.user || !state.profile) return state

    const updatedAt = new Date().toISOString()
    const update = { ...patch, updated_at: updatedAt }
    await this.adapter.updateProfile(state.user.id, update)

    return {
      ...state,
      profile: {
        ...state.profile,
        ...update,
      },
    }
  }

  async addToFavorites(state: AuthState, barberId: string): Promise<AuthState> {
    if (!state.profile) return state
    const current = state.profile.favorites || []
    if (current.includes(barberId)) return state

    return this.updateProfile(state, { favorites: [...current, barberId] })
  }

  async removeFromFavorites(state: AuthState, barberId: string): Promise<AuthState> {
    if (!state.profile?.favorites) return state
    return this.updateProfile(state, {
      favorites: state.profile.favorites.filter(id => id !== barberId),
    })
  }
}

