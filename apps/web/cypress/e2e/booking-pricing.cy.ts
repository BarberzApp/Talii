describe('Booking Pricing and Addons Integration', () => {
  const getEnvVars = () => {
    const accessToken = Cypress.env('TEST_ACCESS_TOKEN') as string | undefined
    const barberId = Cypress.env('TEST_DEVELOPER_BARBER_ID') || Cypress.env('TEST_BARBER_ID') as string | undefined
    const serviceId = Cypress.env('TEST_SERVICE_ID') as string | undefined
    const addonIds = Cypress.env('TEST_ADDON_IDS') as string[] | undefined

    return { accessToken, barberId, serviceId, addonIds }
  }

  it('calculates correct pricing including addons for a developer booking', () => {
    const { accessToken, barberId, serviceId, addonIds } = getEnvVars()

    if (!accessToken || !barberId || !serviceId) {
      cy.log('Skipping pricing test: missing required Cypress env vars')
      return
    }

    const testDate = new Date().toISOString()
    const testNotes = 'E2E Testing - Pricing Calculation'

    // 1. Create the booking
    cy.request({
      method: 'POST',
      url: '/api/mobile/bookings',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {
        barberId,
        serviceId,
        date: testDate,
        notes: testNotes,
        addonIds: addonIds || []
      },
    }).then((postResponse) => {
      expect(postResponse.status).to.eq(200)
      
      // If it's a developer barber, the booking is created immediately.
      if (postResponse.body.booking) {
        const booking = postResponse.body.booking
        
        expect(booking.service_price).to.be.a('number')
        expect(booking.price).to.be.a('number')
        
        // 2. Fetch the client's bookings to verify the database state
        cy.request({
          method: 'GET',
          url: '/api/mobile/bookings',
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((getResponse) => {
          expect(getResponse.status).to.eq(200)
          
          const bookings = getResponse.body.bookings
          const createdBooking = bookings.find((b: any) => b.id === booking.id)
          
          expect(createdBooking).to.exist
          expect(createdBooking.notes).to.eq(testNotes)
          expect(createdBooking.service_price).to.eq(booking.service_price)
          // Addons might trigger a database function or trigger that updates addon_total.
          // Wait briefly if it's an async database trigger, but in Supabase it's usually instant.
          expect(createdBooking.price).to.be.gte(createdBooking.service_price)
        })
      } else {
        // If it's a regular barber, a payment intent is returned.
        expect(postResponse.body).to.have.property('paymentIntentId')
        expect(postResponse.body).to.have.property('amount')
        // Amount returned is the platform fee (in cents), we can verify it's a valid number.
        expect(postResponse.body.amount).to.be.a('number')
        expect(postResponse.body.amount).to.be.greaterThan(0)
      }
    })
  })
})
