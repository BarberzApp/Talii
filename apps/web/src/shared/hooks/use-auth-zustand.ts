import { useAuthStore, type RegisterOutcome, useUser, useIsAuthenticated, useIsLoading, useAuthStatus, useIsInitialized } from '@/shared/stores/auth-store'
import { useToast } from '@/shared/components/ui/use-toast'
import { useEffect } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { api } from '@/shared/lib/api'
import { logger } from '@/shared/lib/logger'

/**
 * Where to send a user after sign-in, from GET /api/me: admins to the admin
 * dashboard, barbers to onboarding until it is complete (then their calendar),
 * clients to browse.
 */
export const getRedirectPath = async (_userId?: string): Promise<string> => {
  try {
    const me = await api.me.get()
    if (me.isAdmin) return '/admin'
    if (me.profile.role === 'barber') {
      return me.barber?.onboarding_complete ? '/calendar' : '/barber/onboarding'
    }
    return '/browse'
  } catch (error) {
    logger.error('Error determining redirect path', error)
    return '/'
  }
}

export const useAuth = () => {
  const { toast } = useToast()
  const {
    user,
    isLoading,
    status,
    isInitialized,
    login: loginAction,
    register: registerAction,
    logout: logoutAction,
    updateProfile: updateProfileAction,
    initialize
  } = useAuthStore()

  // Initialize auth on mount
  useEffect(() => {
    if (!isInitialized) {
      initialize()
    }
  }, [isInitialized, initialize])

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      logger.debug('Login hook called', { email })
      const success = await loginAction(email, password)
      
      if (success) {
        logger.debug('Login hook: Success')
        // Don't show toast here, let the page handle it
        return true
      } else {
        logger.debug('Login hook: Failed')
        // Don't show toast here, let the page handle it
        return false
      }
    } catch (error) {
      logger.error('Login hook error', error)
      // Don't show toast here, let the page handle it
      return false
    }
  }

  const loginWithRedirect = async (email: string, password: string): Promise<boolean> => {
    try {
      const success = await loginAction(email, password)
      if (success) {
        // Get the current user from Supabase session
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          // Check for stored redirect URL first
          const redirectUrl = sessionStorage.getItem('redirectAfterLogin')
          if (redirectUrl) {
            sessionStorage.removeItem('redirectAfterLogin')
            window.location.href = redirectUrl
            return true
          }

          // Determine redirect path based on user profile
          const redirectPath = await getRedirectPath(session.user.id)
          window.location.href = redirectPath
          return true
        }
      }
      return success
    } catch (error) {
      logger.error('Login with redirect error', error)
      return false
    }
  }

  const register = async (
    name: string,
    email: string,
    password: string,
    role: "client" | "barber",
    businessName?: string,
    username?: string
  ): Promise<RegisterOutcome> => {
    // The sign-up page shows failures inline.
    return registerAction(name, email, password, role, businessName, username)
  }

  const logout = async () => {
    try {
      await logoutAction()
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      })
    } catch {
      toast({
        title: "Logout failed",
        description: "There was an error logging out. Please try again.",
        variant: "destructive",
      })
    }
  }

  const updateProfile = async (data: Partial<import('@/shared/stores/auth-store').User>) => {
    try {
      await updateProfileAction(data)
      toast({
        title: "Profile updated",
        description: "Your changes have been saved successfully",
      })
    } catch (error) {
      toast({
        title: "Profile update failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  return {
    user,
    isLoading,
    status,
    isInitialized,
    login,
    loginWithRedirect,
    register,
    logout,
    updateProfile,
    getRedirectPath
  }
}

// Export individual selectors for better performance
export { useUser, useIsAuthenticated, useIsLoading, useAuthStatus, useIsInitialized } 