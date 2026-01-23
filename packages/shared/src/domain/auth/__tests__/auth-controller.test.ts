import { AuthController, ensureBarberRowIfNeeded, fetchProfileWithRetry } from '../auth-controller'
import { AuthAdapter, AuthProfile } from '../auth-types'

function createAdapter(overrides: Partial<AuthAdapter> = {}): AuthAdapter {
  return {
    getSession: async () => ({ user: null }),
    onAuthStateChange: () => ({ unsubscribe: () => undefined }),
    signInWithPassword: async () => ({ user: null }),
    signUp: async () => ({
      user: null,
      needsConfirmation: false,
      alreadyExists: false,
    }),
    signOut: async () => ({}),
    getProfile: async () => ({ profile: null }),
    updateProfile: async () => ({}),
    getBarberRow: async () => ({ exists: true }),
    createBarberRow: async () => ({}),
    ...overrides,
  }
}

describe('auth-controller helpers', () => {
  test('fetchProfileWithRetry retries on PGRST116 and succeeds', async () => {
    let calls = 0
    const adapter = createAdapter({
      getProfile: async () => {
        calls += 1
        if (calls < 2) {
          return { profile: null, errorCode: 'PGRST116' }
        }
        return { profile: { id: 'u1', role: 'client', username: 'test' } as AuthProfile }
      },
    })

    const { profile } = await fetchProfileWithRetry(adapter, 'u1', { attempts: 2, delayMs: 1 })
    expect(profile?.id).toBe('u1')
    expect(calls).toBe(2)
  })

  test('ensureBarberRowIfNeeded creates when missing', async () => {
    let created = false
    const adapter = createAdapter({
      getBarberRow: async () => ({ exists: false }),
      createBarberRow: async () => {
        created = true
        return {}
      },
    })

    await ensureBarberRowIfNeeded(adapter, {
      id: 'u1',
      role: 'barber',
      business_name: 'Shop',
    })
    expect(created).toBe(true)
  })
})

describe('AuthController login', () => {
  test('login succeeds with complete profile', async () => {
    const adapter = createAdapter({
      signInWithPassword: async () => ({ user: { id: 'u1', email: 'a@b.com' } }),
      getProfile: async () => ({ profile: { id: 'u1', role: 'client', username: 'name' } as AuthProfile }),
    })
    const controller = new AuthController(adapter, { attempts: 1, delayMs: 1 })
    const { state, result } = await controller.login('a@b.com', 'pw')
    expect(result.ok).toBe(true)
    expect(state.status).toBe('authenticated')
  })
})

