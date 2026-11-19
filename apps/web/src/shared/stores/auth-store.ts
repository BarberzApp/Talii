import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { logger } from '@/shared/lib/logger'
import * as Sentry from '@sentry/nextjs'
import {
  AuthController,
  type AuthProfile,
  type AuthState as SharedAuthState,
} from '@barber-app/shared'
import { createWebAuthAdapter } from '@/shared/lib/auth-adapter'

// Types
export type UserRole = "client" | "barber"

export type User = {
  id: string
  name: string
  email: string
  role?: "client" | "barber"
  username?: string
  phone?: string
  createdAt?: string
  updatedAt?: string
  avatar_url?: string
  cover_photo_url?: string
  /** From GET /api/me isAdmin (auth app_metadata). */
  isAdmin: boolean
  /** Barbers only: the barber row. */
  barberId?: string
  businessName?: string
  onboardingComplete?: boolean
  /** @deprecated Kept for older components; profiles have no location. */
  location?: string
  /** @deprecated Kept for older components; the barber bio lives on the barber row. */
  bio?: string
  /** @deprecated Use createdAt. */
  joinDate?: string
}

interface AuthState {
  user: User | null
  profile: AuthProfile | null
  isLoading: boolean
  status: "loading" | "authenticated" | "unauthenticated"
  isInitialized: boolean
  showLoginModal: boolean
}

interface AuthActions {
  // Actions
  login: (email: string, password: string) => Promise<boolean>
  register: (
    name: string,
    email: string,
    password: string,
    role: UserRole,
    businessName?: string,
    username?: string
  ) => Promise<RegisterOutcome>
  logout: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
  
  // Internal state setters
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setStatus: (status: "loading" | "authenticated" | "unauthenticated") => void
  setInitialized: (initialized: boolean) => void
  setShowLoginModal: (show: boolean) => void
  
  // Initialize auth state
  initialize: () => Promise<void>
  fetchUserProfile: (userId: string) => Promise<void>
}

export type RegisterOutcome = {
  ok: boolean
  needsConfirmation?: boolean
  alreadyExists?: boolean
  errorMessage?: string
}

type AuthStore = AuthState & AuthActions

const authAdapter = createWebAuthAdapter()
let authSubscribed = false
const authController = new AuthController(authAdapter)

function mapProfileToUser(profile: AuthProfile): User {
  return {
    id: profile.id,
    name: profile.name || '',
    email: profile.email || '',
    role: (profile.role as UserRole) || undefined,
    username: profile.username || undefined,
    phone: profile.phone || undefined,
    createdAt: profile.created_at || undefined,
    joinDate: profile.created_at || undefined,
    updatedAt: profile.updated_at || undefined,
    avatar_url: profile.avatar_url || undefined,
    cover_photo_url: profile.cover_photo_url || undefined,
    isAdmin: !!profile.is_admin,
    barberId: profile.barber_id || undefined,
    businessName: profile.business_name || undefined,
    onboardingComplete: profile.onboarding_complete ?? undefined,
  }
}

function syncSentryUser(profile: AuthProfile | null) {
  if (typeof window === 'undefined') return

  if (profile?.id) {
    Sentry.setUser({ id: profile.id })
  } else {
    Sentry.setUser(null)
  }
}

function applySharedState(set: (state: Partial<AuthState>) => void, shared: SharedAuthState) {
  set({
    status: shared.status,
    isLoading: shared.isLoading,
    isInitialized: shared.isInitialized,
    profile: shared.profile,
    user: shared.profile ? mapProfileToUser(shared.profile) : null,
  })

  syncSentryUser(shared.profile)
}

function buildSharedState(get: () => AuthStore): SharedAuthState {
  const state = get()
  return {
    status: state.status,
    isLoading: state.isLoading,
    isInitialized: state.isInitialized,
    user: state.user ? { id: state.user.id, email: state.user.email } : null,
    profile: state.profile,
  }
}

export const useAuthStore = create<AuthStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    user: null,
    profile: null,
    isLoading: true,
    status: "loading",
    isInitialized: false,
    showLoginModal: false,

    // State setters
    setUser: (user) => set({ user }),
    setLoading: (loading) => set({ isLoading: loading }),
    setStatus: (status) => set({ status }),
    setInitialized: (initialized) => set({ isInitialized: initialized }),
    setShowLoginModal: (show) => set({ showLoginModal: show }),

    // Initialize auth state
    initialize: async () => {
      try {
        logger.debug('[AUTH] initialize: starting')
        set({ isLoading: true, status: "loading" })

        const state = await authController.initialize()
        applySharedState(set, state)

        if (!authSubscribed) {
          authSubscribed = true
          authAdapter.onAuthStateChange(async (user) => {
            // Same user as before (e.g. USER_UPDATED): keep the loaded profile.
            const current = get().profile
            if (user && current && current.id === user.id && get().status === 'authenticated') return
            const next = await authController.handleAuthChange(user)
            applySharedState(set, next)
          })
        }
      } catch (error) {
        logger.error('[AUTH] initialize: error', error)
        set({ 
          user: null, 
          profile: null,
          isLoading: false, 
          status: "unauthenticated",
          isInitialized: true 
        })
      }
    },

    // Fetch user profile
    fetchUserProfile: async (userId: string) => {
      try {
        const next = await authController.refreshProfile(userId)
        applySharedState(set, next)
      } catch (error) {
        logger.error('Error in fetchUserProfile', error)
        set({ 
          user: null, 
          profile: null,
          isLoading: false, 
          status: "unauthenticated" 
        });
      }
    },

    // Login
    login: async (email: string, password: string): Promise<boolean> => {
      try {
        set({ isLoading: true, status: "loading" })
        const { state, result } = await authController.login(email, password)
        applySharedState(set, state)
        return result.ok
      } catch (error) {
        logger.error('Login process failed', error)
        set({ isLoading: false, status: "unauthenticated" })
        return false;
      }
    },

    // Register
    register: async (name, email, password, role, businessName, username): Promise<RegisterOutcome> => {
      try {
        const { state, result } = await authController.register({
          name,
          email,
          password,
          role,
          businessName,
          username,
        })
        applySharedState(set, state)
        return {
          ok: result.ok,
          needsConfirmation: result.needsConfirmation,
          alreadyExists: result.alreadyExists,
          errorMessage: result.errorMessage,
        }
      } catch (error) {
        logger.error('Registration Process Failed', error)
        return { ok: false }
      }
    },

    // Logout
    logout: async () => {
      try {
        const next = await authController.logout()
        applySharedState(set, next)
      } catch (error) {
        logger.error('Logout error', error)
      }
    },

    // Update profile (PATCH /api/me: name, phone, username, avatar, cover photo)
    updateProfile: async (data: Partial<User>) => {
      const next = await authController.updateProfile(buildSharedState(get), {
        name: data.name,
        phone: data.phone,
        username: data.username,
        avatar_url: data.avatar_url,
        cover_photo_url: data.cover_photo_url,
      })
      applySharedState(set, next)
    },
  }))
)

// Selectors for better performance
export const useUser = () => useAuthStore((state) => state.user)
export const useIsAuthenticated = () => useAuthStore((state) => state.status === "authenticated")
export const useIsLoading = () => useAuthStore((state) => state.isLoading)
export const useAuthStatus = () => useAuthStore((state) => state.status)
export const useIsInitialized = () => useAuthStore((state) => state.isInitialized) 
export const useShowLoginModal = () => useAuthStore((state) => state.showLoginModal)
