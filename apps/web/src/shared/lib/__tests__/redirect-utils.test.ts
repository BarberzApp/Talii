import { PENDING_ROLE_KEY, setPendingSignupRole, takePendingSignupRole } from '../redirect-utils'

describe('pending sign-up role', () => {
  const t0 = Date.parse('2026-11-19T12:00:00Z')
  beforeEach(() => {
    window.localStorage.clear()
    jest.spyOn(Date, 'now').mockReturnValue(t0)
  })
  afterEach(() => jest.restoreAllMocks())

  it('applies to an account created right after the choice, once', () => {
    setPendingSignupRole('barber')
    const created = new Date(t0 + 30_000).toISOString()
    expect(takePendingSignupRole(created, t0 + 60_000)).toBe('barber')
    expect(window.localStorage.getItem(PENDING_ROLE_KEY)).toBeNull()
    expect(takePendingSignupRole(created, t0 + 61_000)).toBeNull()
  })

  it('ignores a stale choice (older than 10 minutes) and clears it', () => {
    setPendingSignupRole('barber')
    const created = new Date(t0 + 11 * 60_000).toISOString()
    expect(takePendingSignupRole(created, t0 + 11 * 60_000)).toBeNull()
    expect(window.localStorage.getItem(PENDING_ROLE_KEY)).toBeNull()
  })

  it('ignores the choice for an account that already existed (a later sign-in)', () => {
    setPendingSignupRole('barber')
    const created = new Date(t0 - 24 * 3_600_000).toISOString()
    expect(takePendingSignupRole(created, t0 + 60_000)).toBeNull()
  })

  it('ignores the old plain-string format', () => {
    window.localStorage.setItem(PENDING_ROLE_KEY, 'barber')
    expect(takePendingSignupRole(new Date(t0).toISOString(), t0)).toBeNull()
  })
})
