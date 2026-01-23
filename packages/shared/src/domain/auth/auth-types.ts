export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export type AuthUser = {
  id: string
  email?: string | null
}

export type AuthProfileRole = 'client' | 'barber'

export type AuthProfile = {
  id: string
  name?: string | null
  email?: string | null
  role?: AuthProfileRole | null
  phone?: string | null
  location?: string | null
  bio?: string | null
  favorites?: string[] | null
  join_date?: string | null
  created_at?: string | null
  updated_at?: string | null
  username?: string | null
  business_name?: string | null
  avatar_url?: string | null
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
}

export type AuthRegisterResult = {
  ok: boolean
  needsConfirmation?: boolean
  alreadyExists?: boolean
  reason?: 'auth-error' | 'profile-missing' | 'profile-incomplete'
}

export type AuthProfileResult = {
  profile: AuthProfile | null
  errorCode?: string
  errorMessage?: string
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
  signUp: (input: {
    name: string
    email: string
    password: string
    role: AuthProfileRole
    businessName?: string
  }) => Promise<{
    user: AuthUser | null
    needsConfirmation: boolean
    alreadyExists: boolean
    errorMessage?: string
  }>
  signOut: () => Promise<{ errorMessage?: string }>
  getProfile: (userId: string) => Promise<AuthProfileResult>
  createProfile?: (input: {
    id: string
    name: string
    email: string
    role: AuthProfileRole
    username: string
    businessName?: string
  }) => Promise<{ errorMessage?: string }>
  updateProfile: (
    userId: string,
    patch: Partial<AuthProfile>
  ) => Promise<{ errorMessage?: string }>
  getBarberRow: (userId: string) => Promise<{ exists: boolean; errorMessage?: string }>
  createBarberRow: (
    userId: string,
    businessName: string
  ) => Promise<{ errorMessage?: string }>
}

