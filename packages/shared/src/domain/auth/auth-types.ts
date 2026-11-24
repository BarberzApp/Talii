export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export type AuthUser = {
  id: string
  email?: string | null
}

export type AuthProfileRole = 'client' | 'barber'

/**
 * The signed-in user's profile, built from GET /api/me (profile + barber row).
 * Profiles and barber rows are created by the database trigger handle_new_user
 * at sign-up; clients never insert them.
 */
export type AuthProfile = {
  id: string
  name?: string | null
  email?: string | null
  role?: AuthProfileRole | null
  phone?: string | null
  username?: string | null
  avatar_url?: string | null
  cover_photo_url?: string | null
  created_at?: string | null
  updated_at?: string | null
  /** From GET /api/me `isAdmin` (auth app_metadata; server-controlled). */
  is_admin?: boolean
  /** The barber row's id, business name and onboarding flag (barbers only). */
  barber_id?: string | null
  business_name?: string | null
  onboarding_complete?: boolean | null
  /** @deprecated Not in the schema; never populated. Barbers use city/state on their barber row. */
  location?: string | null
  /** @deprecated Not on profiles; a barber's bio lives on the barber row. */
  bio?: string | null
  /** @deprecated Favorites were removed; never populated. */
  favorites?: string[] | null
  /** @deprecated Use created_at. */
  join_date?: string | null
}

export type AuthState = {
  status: AuthStatus
  isLoading: boolean
  isInitialized: boolean
  user: AuthUser | null
  profile: AuthProfile | null
  error?: string
}

export type AuthLoginResult = {
  ok: boolean
  reason?: 'auth-error' | 'profile-missing' | 'profile-incomplete'
  /** The sign-in error message, when reason is 'auth-error'. */
  errorMessage?: string
}

export type AuthRegisterResult = {
  ok: boolean
  needsConfirmation?: boolean
  alreadyExists?: boolean
  reason?: 'auth-error' | 'profile-missing' | 'profile-incomplete'
  errorMessage?: string
}

export type AuthProfileResult = {
  profile: AuthProfile | null
  /** API error code (e.g. NO_PROFILE, ACCOUNT_DISABLED, UNAUTHORIZED) when there is no profile. */
  errorCode?: string
  errorMessage?: string
}

/** Fields the signed-in user can change on their own profile (PATCH /api/me). */
export type AuthProfilePatch = Partial<Pick<AuthProfile, 'name' | 'phone' | 'username' | 'avatar_url' | 'cover_photo_url'>>

export type AuthSignUpInput = {
  name: string
  email: string
  password: string
  role: AuthProfileRole
  /** Optional; the trigger derives one from the email when missing or taken. */
  username?: string
  businessName?: string
}

export type AuthAdapter = {
  getSession: () => Promise<{ user: AuthUser | null; errorMessage?: string }>
  onAuthStateChange: (
    cb: (user: AuthUser | null) => void
  ) => { unsubscribe: () => void }
  signInWithPassword: (
    email: string,
    password: string
  ) => Promise<{ user: AuthUser | null; errorMessage?: string }>
  /**
   * Must pass role, name, username and business_name in signUp options.data:
   * the handle_new_user trigger creates the profile (and barber rows) from them.
   */
  signUp: (input: AuthSignUpInput) => Promise<{
    user: AuthUser | null
    needsConfirmation: boolean
    alreadyExists: boolean
    errorMessage?: string
  }>
  signOut: () => Promise<{ errorMessage?: string }>
  /** The caller's profile from GET /api/me. */
  getProfile: (userId: string) => Promise<AuthProfileResult>
  /** PATCH /api/me; may return the updated profile. */
  updateProfile: (
    userId: string,
    patch: AuthProfilePatch
  ) => Promise<{ errorMessage?: string; profile?: AuthProfile | null }>
  /** @deprecated Ignored: the database trigger creates profiles. */
  createProfile?: (input: {
    id: string
    name: string
    email: string
    role: AuthProfileRole
    username: string
    businessName?: string
  }) => Promise<{ errorMessage?: string }>
  /** @deprecated Ignored: the database trigger creates barber rows (or POST /api/me/barber). */
  getBarberRow?: (userId: string) => Promise<{ exists: boolean; errorMessage?: string }>
  /** @deprecated Ignored: the database trigger creates barber rows (or POST /api/me/barber). */
  createBarberRow?: (
    userId: string,
    businessName: string
  ) => Promise<{ errorMessage?: string }>
}
