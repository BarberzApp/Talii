// Sign-up goes straight to Supabase Auth (no app route): role, name and username travel in the
// sign-up metadata and the database creates the profile and barber rows. Env: SUPABASE_URL and
// SUPABASE_ANON_KEY (local stack), optional TEST_ONBOARDING_EMAIL / TEST_ONBOARDING_PASSWORD.
// Needs email confirmation off (the local stack's default).

describe('User and Barber Onboarding Flow', () => {
  const getEnvVars = () => ({
    supabaseUrl: Cypress.env('SUPABASE_URL') as string | undefined,
    anonKey: Cypress.env('SUPABASE_ANON_KEY') as string | undefined,
    testEmail: Cypress.env('TEST_ONBOARDING_EMAIL') || `test_onboarding_${Date.now()}@example.com`,
    testPassword: Cypress.env('TEST_ONBOARDING_PASSWORD') || 'TestPass123!',
  })

  it('signs a barber up, loads /api/me and gets an upload ticket', () => {
    const { supabaseUrl, anonKey, testEmail, testPassword } = getEnvVars()

    cy.visit('/register')

    if (!supabaseUrl || !anonKey) {
      cy.log('Skipping API part: SUPABASE_URL / SUPABASE_ANON_KEY not set')
      return
    }

    cy.request({
      method: 'POST',
      url: `${supabaseUrl}/auth/v1/signup`,
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: {
        email: testEmail,
        password: testPassword,
        data: { name: 'Test Barber User', role: 'barber', username: `e2e_${Date.now()}`, business_name: 'E2E Cuts' },
      },
    }).then((signUp) => {
      expect(signUp.status).to.eq(200)
      const token = signUp.body.access_token as string | undefined
      if (!token) {
        cy.log('Email confirmation is on; stopping after sign-up')
        return
      }
      const auth = { Authorization: `Bearer ${token}` }

      cy.request({ url: '/api/me', headers: auth }).then((me) => {
        expect(me.status).to.eq(200)
        expect(me.body.profile.role).to.eq('barber')
        expect(me.body.barber).to.not.eq(null)
        expect(me.body.barber.business_name).to.eq('E2E Cuts')
        expect(me.body.isAdmin).to.eq(false)
      })

      cy.request({
        method: 'POST',
        url: '/api/uploads',
        headers: auth,
        body: { bucket: 'media', contentType: 'image/jpeg', fileName: 'photo.jpg', sizeBytes: 1024 },
      }).then((ticket) => {
        expect(ticket.status).to.eq(200)
        expect(ticket.body.path).to.match(/^[0-9a-f-]+\/[0-9a-f-]+\.jpg$/)
        expect(ticket.body.publicUrl).to.contain('/media/')
      })
    })
  })
})
