import { supabase } from '@/shared/lib/supabase'
import { api } from '@/shared/lib/api'
import { isApiError, profileFromMe } from '@barber-app/shared'
import type { AuthAdapter, AuthUser, UpdateMeBody } from '@barber-app/shared'

function toAuthUser(user: { id: string; email?: string | null } | null): AuthUser | null {
  if (!user) return null
  return { id: user.id, email: user.email }
}

/**
 * Supabase Auth for the session; GET/PATCH /api/me for the profile. Profiles and
 * barber rows are created by the handle_new_user trigger from the sign-up
 * metadata (role, name, username, business_name), never by the client.
 */
export function createWebAuthAdapter(): AuthAdapter {
  return {
    getSession: async () => {
      const { data, error } = await supabase.auth.getSession()
      return { user: toAuthUser(data.session?.user ?? null), errorMessage: error?.message }
    },
    onAuthStateChange: (cb) => {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        // Token refreshes do not change who is signed in; skip the profile reload.
        if (event === 'TOKEN_REFRESHED') return
        cb(toAuthUser(session?.user ?? null))
      })
      return { unsubscribe: () => data.subscription.unsubscribe() }
    },
    signInWithPassword: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      return { user: toAuthUser(data.user ?? null), errorMessage: error?.message }
    },
    signUp: async ({ name, email, password, role, username, businessName }) => {
      const metadata: Record<string, string> = { name, role }
      if (username) metadata.username = username
      if (role === 'barber' && businessName) metadata.business_name = businessName

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
        },
      })

      if (error) {
        const alreadyExists = /already registered|already exists/i.test(error.message ?? '')
        return { user: null, needsConfirmation: false, alreadyExists, errorMessage: error.message }
      }

      // With email confirmation on, an existing address comes back as a user with no identities.
      const alreadyExists = !!data.user && (data.user.identities?.length ?? 0) === 0
      return {
        user: toAuthUser(data.user ?? null),
        needsConfirmation: !data.session,
        alreadyExists,
      }
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut()
      return { errorMessage: error?.message }
    },
    getProfile: async () => {
      try {
        return { profile: profileFromMe(await api.me.get()) }
      } catch (error) {
        return {
          profile: null,
          errorCode: isApiError(error) ? error.code : 'UNKNOWN',
          errorMessage: error instanceof Error ? error.message : undefined,
        }
      }
    },
    updateProfile: async (_userId, patch) => {
      const body: UpdateMeBody = {}
      if (patch.name !== undefined) body.name = patch.name
      if (patch.phone !== undefined) body.phone = patch.phone
      if (patch.username !== undefined && patch.username !== null) body.username = patch.username
      if (patch.avatar_url !== undefined) body.avatarUrl = patch.avatar_url
      if (patch.cover_photo_url !== undefined) body.coverPhotoUrl = patch.cover_photo_url
      try {
        return { profile: profileFromMe(await api.me.update(body)) }
      } catch (error) {
        return { errorMessage: error instanceof Error ? error.message : 'Could not save your profile.' }
      }
    },
  }
}
