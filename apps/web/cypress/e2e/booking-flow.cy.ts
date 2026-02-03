describe('Booking flow', () => {
  it('responds to backend health check', () => {
    cy.request('/api/health').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('status', 'healthy')
    })
  })

  it('creates a booking or payment intent via backend API', () => {
    const accessToken = Cypress.env('TEST_ACCESS_TOKEN') as string | undefined
    const barberId = Cypress.env('TEST_BARBER_ID') as string | undefined
    const serviceId = Cypress.env('TEST_SERVICE_ID') as string | undefined

    if (!accessToken || !barberId || !serviceId) {
      cy.log('Skipping booking flow test: missing Cypress env vars')
      return
    }

    cy.request({
      method: 'POST',
      url: '/api/mobile/bookings',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {
        barberId,
        serviceId,
        date: new Date().toISOString(),
      },
    }).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('success', true)
    })
  })
})
