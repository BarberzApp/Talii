import { createAuthAdapter } from '@/lib/auth-adapter'
import { ApiError } from '@barber-app/shared'

function fakeSupabase() {
  return {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signInWithPassword: jest.fn(),
      signUp: jest.fn().mockResolvedValue({
        data: { user: { id: 'u1', email: 'a@b.c', identities: [{}] }, session: { access_token: 't' } },
        error: null,
      }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
    from: jest.fn(),
  }
}

const meResponse = {
  user: { id: 'u1', email: 'a@b.c' },
  isAdmin: false,
  profile: {
    id: 'u1',
    role: 'barber',
    name: 'Ann',
    username: 'ann',
    email: 'a@b.c',
    phone: null,
    avatar_url: null,
    cover_photo_url: null,
    is_disabled: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  barber: { id: 'b1', business_name: 'Fade Co', onboarding_complete: false },
  billing: null,
}

describe('mobile auth adapter', () => {
  it('signs up with role, name, username and business name as metadata and never writes tables', async () => {
    const supabase = fakeSupabase()
    const api = { me: { get: jest.fn(), update: jest.fn() } }
    const adapter = createAuthAdapter({ supabase: supabase as any, api: api as any })

    const result = await adapter.signUp({
      name: 'Ann',
      email: 'a@b.c',
      password: 'secret123',
      role: 'barber',
      username: 'ann',
      businessName: 'Fade Co',
    })

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'a@b.c',
      password: 'secret123',
      options: { data: { name: 'Ann', role: 'barber', username: 'ann', business_name: 'Fade Co' } },
    })
    expect(result).toEqual({ user: { id: 'u1', email: 'a@b.c' }, needsConfirmation: false, alreadyExists: false })
    expect(supabase.from).not.toHaveBeenCalled()
    expect(adapter.createProfile).toBeUndefined()
    expect(adapter.createBarberRow).toBeUndefined()
  })

  it('does not send business_name for clients', async () => {
    const supabase = fakeSupabase()
    const adapter = createAuthAdapter({ supabase: supabase as any, api: {} as any })
    await adapter.signUp({ name: 'C', email: 'c@d.e', password: 'secret123', role: 'client', businessName: 'X' })
    expect(supabase.auth.signUp.mock.calls[0][0].options.data).toEqual({ name: 'C', role: 'client' })
  })

  it('loads the profile from GET /api/me', async () => {
    const api = { me: { get: jest.fn().mockResolvedValue(meResponse), update: jest.fn() } }
    const adapter = createAuthAdapter({ supabase: fakeSupabase() as any, api: api as any })

    const { profile } = await adapter.getProfile('u1')

    expect(api.me.get).toHaveBeenCalled()
    expect(profile).toMatchObject({
      id: 'u1',
      role: 'barber',
      username: 'ann',
      barber_id: 'b1',
      business_name: 'Fade Co',
      onboarding_complete: false,
      is_admin: false,
    })
  })

  it('reports the API error code when the profile cannot be loaded', async () => {
    const api = { me: { get: jest.fn().mockRejectedValue(new ApiError(404, 'NO_PROFILE', 'No profile.')) } }
    const adapter = createAuthAdapter({ supabase: fakeSupabase() as any, api: api as any })
    await expect(adapter.getProfile('u1')).resolves.toMatchObject({ profile: null, errorCode: 'NO_PROFILE' })
  })

  it('saves profile changes with PATCH /api/me field names', async () => {
    const api = { me: { get: jest.fn(), update: jest.fn().mockResolvedValue({ ...meResponse, location: null }) } }
    const adapter = createAuthAdapter({ supabase: fakeSupabase() as any, api: api as any })
    await adapter.updateProfile('u1', { name: 'Ann B', avatar_url: 'https://x/y.png', cover_photo_url: null })
    expect(api.me.update).toHaveBeenCalledWith({ name: 'Ann B', avatarUrl: 'https://x/y.png', coverPhotoUrl: null })
  })

  it('ignores token refreshes in onAuthStateChange', () => {
    const supabase = fakeSupabase()
    const adapter = createAuthAdapter({ supabase: supabase as any, api: {} as any })
    const cb = jest.fn()
    adapter.onAuthStateChange(cb)
    const listener = (supabase.auth.onAuthStateChange.mock.calls[0] as any)[0]
    listener('TOKEN_REFRESHED', { user: { id: 'u1' } })
    listener('SIGNED_IN', { user: { id: 'u1', email: 'a@b.c' } })
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith({ id: 'u1', email: 'a@b.c' })
  })
})
