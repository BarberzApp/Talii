import { createApiClient } from '@barber-app/shared'
import { supabase } from './supabase'

/**
 * The web app's API client. Same-origin calls to /api/*, authenticated with the
 * access token of the Supabase browser session (refreshed by supabase-js).
 * Use from client components only.
 */
export const api = createApiClient({
  baseUrl: '',
  getAccessToken: async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  },
})

export { ApiError, isApiError, hasErrorCode, errorMessage, bookingErrorMessage } from '@barber-app/shared'
