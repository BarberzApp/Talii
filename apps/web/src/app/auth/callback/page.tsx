'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/shared/lib/supabase'
import { useToast } from '@/shared/components/ui/use-toast'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'
import { logger } from '@/shared/lib/logger'
import { api, hasErrorCode } from '@/shared/lib/api'
import { browserTimeZone, takePendingSignupRole } from '@/shared/lib/redirect-utils'
import { useAuthStore } from '@/shared/stores/auth-store'

export default function AuthCallbackPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'verifying' | 'completing' | 'redirecting' | 'error'>('verifying')
  const [error, setError] = useState<string | null>(null)
  const { replace: safeReplace } = useSafeNavigation();
  const started = useRef(false)

  useEffect(() => {
    // The code can be exchanged only once (React strict mode runs effects twice).
    if (started.current) return
    started.current = true
    const handleAuthCallback = async () => {
      try {
        setStatus('verifying')
        logger.debug('Starting OAuth / email-link callback')

        const params = new URLSearchParams(window.location.search)
        const oauthError = params.get('error_description') || params.get('error')
        if (oauthError) throw new Error(oauthError)

        // Step 1: PKCE exchange in the browser (the code verifier lives in this
        // browser's storage). supabase-js usually exchanges ?code= itself while
        // initialising (detectSessionInUrl); getSession() waits for that.
        let { data: { session }, error: sessionError } = await supabase.auth.getSession()
        const code = params.get('code')
        if (!session && code) {
          const exchanged = await supabase.auth.exchangeCodeForSession(code)
          session = exchanged.data.session
          sessionError = exchanged.error
        }
        if (sessionError || !session?.user) {
          throw sessionError || new Error('No session found')
        }

        const userId = session.user.id
        logger.debug('Session validated', { userId })

        // Step 2: the profile (created by the database at sign-up) via GET /api/me.
        setStatus('completing')
        let me = null
        for (let attempt = 1; attempt <= 3 && !me; attempt++) {
          try {
            me = await api.me.get()
          } catch (error) {
            if (!hasErrorCode(error, 'NO_PROFILE', 'AUTH_UNAVAILABLE', 'NETWORK_ERROR') || attempt === 3) throw error
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
        if (!me) throw new Error('Failed to load your profile')

        // Step 3: a barber sign-up through Google: the trigger made a client
        // profile (OAuth carries no role), so turn it into a barber now.
        // Honoured only for a brand-new account created within minutes of choosing
        // the role; read and cleared either way.
        const pendingRole = takePendingSignupRole(me.profile.created_at)
        if (pendingRole === 'barber' && me.profile.role !== 'barber') {
          await api.me.becomeBarber({ timezone: browserTimeZone() })
        }

        // Make the auth store pick up the (possibly new) role.
        await useAuthStore.getState().fetchUserProfile(userId)

        // Step 5: Determine redirect path using identical logic to standard login
        setStatus('redirecting')
        const { getRedirectPath } = await import('@/shared/hooks/use-auth-zustand')
        const redirectPath = await getRedirectPath(userId)

        logger.debug('Redirecting', { redirectPath })
        
        // Step 6: Show success message and redirect
        toast({
          title: "Welcome back!",
          description: "Successfully signed in with Google.",
        })

        // Small delay to show success state
        setTimeout(() => {
          safeReplace(redirectPath)
        }, 1000)

      } catch (error) {
        logger.error('Auth callback error', error)
        setStatus('error')
        setError(error instanceof Error ? error.message : 'Unknown error occurred')
        
        toast({
          title: 'Authentication failed',
          description: 'There was an error completing your sign-in. Please try again.',
          variant: 'destructive',
        })

        // Redirect to login after error
        setTimeout(() => {
        safeReplace('/login')
        }, 3000)
      } finally {
        setLoading(false)
    }
    }

    handleAuthCallback()
  }, [router, toast, safeReplace])

  const getStatusMessage = () => {
    switch (status) {
      case 'verifying':
        return 'Verifying your session...'
      case 'completing':
        return 'Completing your profile...'
      case 'redirecting':
        return 'Redirecting you to the app...'
      case 'error':
        return 'Something went wrong...'
      default:
        return 'Processing...'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'verifying':
      case 'completing':
        return <Loader2 className="h-8 w-8 animate-spin text-saffron" />
      case 'redirecting':
        return <CheckCircle className="h-8 w-8 text-green-500" />
      case 'error':
        return <AlertCircle className="h-8 w-8 text-red-500" />
      default:
        return <Loader2 className="h-8 w-8 animate-spin text-saffron" />
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center space-y-6 p-8">
        {getStatusIcon()}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-white">
            {status === 'error' ? 'Authentication Failed' : 'Completing Sign-In'}
          </h1>
          <p className="text-white/60 max-w-md">
            {getStatusMessage()}
          </p>
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>
        {status === 'error' && (
          <div className="text-sm text-white/40">
            Redirecting to login in 3 seconds...
          </div>
        )}
      </div>
    </div>
  )
} 