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
  role?: "client" | "barber" // Make role optional to handle OAuth users without roles
  username?: string
  phone?: string
  location?: string
  description?: string
  bio?: string
  favorites?: string[]
  joinDate?: string
  createdAt?: string
  updatedAt?: string
  barberId?: string
  specialties?: string[]
  priceRange?: string
  nextAvailable?: string
  avatar_url?: string
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
  register: (name: string, email: string, password: string, role: UserRole, businessName?: string) => Promise<boolean>
  logout: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
  addToFavorites: (barberId: string) => Promise<void>
  removeFromFavorites: (barberId: string) => Promise<void>
  
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

type AuthStore = AuthState & AuthActions

const authAdapter = createWebAuthAdapter()
const authController = new AuthController(authAdapter)

function mapProfileToUser(profile: AuthProfile): User {
  return {
    id: profile.id,
    name: profile.name || '',
    email: profile.email || '',
    role: (profile.role as UserRole) || undefined,
    username: profile.username || undefined,
    phone: profile.phone || undefined,
    location: profile.location || undefined,
    description: profile.bio || undefined,
    bio: profile.bio || undefined,
    favorites: profile.favorites || undefined,
    joinDate: profile.join_date || undefined,
    createdAt: profile.created_at || undefined,
    updatedAt: profile.updated_at || undefined,
    avatar_url: profile.avatar_url || undefined,
  }
}

function syncSentryUser(profile: AuthProfile | null) {
  if (typeof window === 'undefined') return

  if (profile?.id) {
    Sentry.setUser({
      id: profile.id,
      email: profile.email || undefined,
    })
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

        authAdapter.onAuthStateChange(async (user) => {
          const next = await authController.handleAuthChange(user)
          applySharedState(set, next)
        })
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
    register: async (name: string, email: string, password: string, role: UserRole, businessName?: string): Promise<boolean> => {
      try {
        const { state, result } = await authController.register({
          name,
          email,
          password,
          role,
          businessName,
        })
        applySharedState(set, state)
        return result.ok || !!result.needsConfirmation
      } catch (error) {
        logger.error('Registration Process Failed', error)
        return false;
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

    // Update profile
    updateProfile: async (data: Partial<User>) => {
      try {
        const profilePatch: Partial<AuthProfile> = {
          name: data.name,
          email: data.email,
          phone: data.phone,
          location: data.location,
          bio: data.bio ?? data.description,
          favorites: data.favorites,
          avatar_url: data.avatar_url,
        }

        const next = await authController.updateProfile(buildSharedState(get), profilePatch)
        applySharedState(set, next)
      } catch (error) {
        logger.error('Profile update error', error)
        throw error;
      }
    },

    // Add to favorites
    addToFavorites: async (barberId: string) => {
      try {
        const next = await authController.addToFavorites(buildSharedState(get), barberId)
        applySharedState(set, next)
      } catch (error) {
        logger.error('Add to favorites error', error)
        throw error;
      }
    },

    // Remove from favorites
    removeFromFavorites: async (barberId: string) => {
      try {
        const next = await authController.removeFromFavorites(buildSharedState(get), barberId)
        applySharedState(set, next)
      } catch (error) {
        logger.error('Remove from favorites error', error)
        throw error;
      }
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