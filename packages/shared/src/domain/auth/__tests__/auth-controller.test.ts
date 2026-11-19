import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AuthController, fetchProfileWithRetry, profileFromMe } from '../auth-controller'
import type { AuthAdapter, AuthProfile } from '../auth-types'
import type { MeResponse } from '../../../api/types'

function createAdapter(overrides: Partial<AuthAdapter> = {}): AuthAdapter {
  return {
    getSession: async () => ({ user: null }),
    onAuthStateChange: () => ({ unsubscribe: () => undefined }),
    signInWithPassword: async () => ({ user: null }),
    signUp: async () => ({ user: null, needsConfirmation: false, alreadyExists: false }),
    signOut: async () => ({}),
    getProfile: async () => ({ profile: null }),
    updateProfile: async () => ({}),
    ...overrides,
  }
}

test('fetchProfileWithRetry retries NO_PROFILE and succeeds', async () => {
  let calls = 0
  const adapter = createAdapter({
    getProfile: async () => {
      calls += 1
      if (calls < 2) return { profile: null, errorCode: 'NO_PROFILE' }
      return { profile: { id: 'u1', role: 'client', username: 'test' } }
    },
  })

  const { profile } = await fetchProfileWithRetry(adapter, 'u1', { attempts: 2, delayMs: 1 })
  assert.equal(profile?.id, 'u1')
  assert.equal(calls, 2)
})

test('fetchProfileWithRetry stops on a non-retryable error such as ACCOUNT_DISABLED', async () => {
  let calls = 0
  const adapter = createAdapter({
    getProfile: async () => {
      calls += 1
      return { profile: null, errorCode: 'ACCOUNT_DISABLED' }
    },
  })
  const { profile, lastErrorCode } = await fetchProfileWithRetry(adapter, 'u1', { attempts: 3, delayMs: 1 })
  assert.equal(profile, null)
  assert.equal(lastErrorCode, 'ACCOUNT_DISABLED')
  assert.equal(calls, 1)
})

test('login succeeds with a complete profile and never creates rows', async () => {
  let created = false
  const adapter = createAdapter({
    signInWithPassword: async () => ({ user: { id: 'u1', email: 'a@b.com' } }),
    getProfile: async () => ({ profile: { id: 'u1', role: 'barber', username: 'name' } as AuthProfile }),
    getBarberRow: async () => ({ exists: false }),
    createBarberRow: async () => {
      created = true
      return {}
    },
  })
  const controller = new AuthController(adapter, { attempts: 1, delayMs: 1 })
  const { state, result } = await controller.login('a@b.com', 'pw')
  assert.equal(result.ok, true)
  assert.equal(state.status, 'authenticated')
  assert.equal(created, false)
})

test('register passes role, username and business name to signUp and never calls createProfile', async () => {
  let signUpInput: unknown
  let createProfileCalled = false
  const adapter = createAdapter({
    signUp: async (input) => {
      signUpInput = input
      return { user: { id: 'u2' }, needsConfirmation: false, alreadyExists: false }
    },
    getProfile: async () => ({ profile: null, errorCode: 'NO_PROFILE' }),
    createProfile: async () => {
      createProfileCalled = true
      return {}
    },
  })
  const controller = new AuthController(adapter, { attempts: 2, delayMs: 1 })
  const { result } = await controller.register({
    name: 'Ann',
    email: 'ann@example.com',
    password: 'pw',
    role: 'barber',
    username: 'ann_cuts',
    businessName: 'Ann Cuts',
  })
  assert.deepEqual(signUpInput, {
    name: 'Ann',
    email: 'ann@example.com',
    password: 'pw',
    role: 'barber',
    username: 'ann_cuts',
    businessName: 'Ann Cuts',
  })
  assert.equal(createProfileCalled, false)
  assert.deepEqual(result, { ok: false, reason: 'profile-missing' })
})

test('register reports email confirmation and existing accounts', async () => {
  const confirm = new AuthController(
    createAdapter({ signUp: async () => ({ user: { id: 'u' }, needsConfirmation: true, alreadyExists: false }) }),
    { attempts: 1, delayMs: 1 }
  )
  assert.deepEqual((await confirm.register({ name: 'a', email: 'a@b.c', password: 'p', role: 'client' })).result, {
    ok: true,
    needsConfirmation: true,
  })

  const exists = new AuthController(
    createAdapter({ signUp: async () => ({ user: { id: 'u' }, needsConfirmation: true, alreadyExists: true }) }),
    { attempts: 1, delayMs: 1 }
  )
  assert.deepEqual((await exists.register({ name: 'a', email: 'a@b.c', password: 'p', role: 'client' })).result, {
    ok: false,
    alreadyExists: true,
  })
})

test('updateProfile sends only patchable fields and throws on failure', async () => {
  let sent: unknown
  const adapter = createAdapter({
    updateProfile: async (_id, patch) => {
      sent = patch
      return {}
    },
  })
  const controller = new AuthController(adapter)
  const state = {
    status: 'authenticated' as const,
    isLoading: false,
    isInitialized: true,
    user: { id: 'u1' },
    profile: { id: 'u1', role: 'client' as const, username: 'u', name: 'Old' },
  }
  const next = await controller.updateProfile(state, { name: 'New', bio: 'ignored', location: 'x' })
  assert.deepEqual(sent, { name: 'New' })
  assert.equal(next.profile?.name, 'New')

  const failing = new AuthController(createAdapter({ updateProfile: async () => ({ errorMessage: 'That username is taken.' }) }))
  await assert.rejects(failing.updateProfile(state, { username: 'taken' }), /username is taken/)
})

test('profileFromMe maps GET /api/me', () => {
  const me: MeResponse = {
    user: { id: 'u1', email: 'b@example.com' },
    isAdmin: true,
    profile: {
      id: 'u1',
      role: 'barber',
      name: 'Bo',
      username: 'bo',
      email: null,
      phone: null,
      avatar_url: null,
      cover_photo_url: null,
      is_disabled: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    barber: { id: 'bar1', business_name: 'Bo Cuts', onboarding_complete: true } as MeResponse['barber'],
    billing: null,
  }
  const profile = profileFromMe(me)
  assert.equal(profile.is_admin, true)
  assert.equal(profile.role, 'barber')
  assert.equal(profile.email, 'b@example.com')
  assert.equal(profile.barber_id, 'bar1')
  assert.equal(profile.business_name, 'Bo Cuts')
  assert.equal(profile.onboarding_complete, true)
})
