// Money is integer cents. Env: TEST_ACCESS_TOKEN, TEST_BARBER_ID (fee-exempt preferred, or
// TEST_DEVELOPER_BARBER_ID), TEST_SERVICE_ID, optional TEST_ADDON_IDS (array of add-on ids).

describe('Booking Pricing and Addons Integration', () => {
  const getEnvVars = () => {
    const accessToken = Cypress.env('TEST_ACCESS_TOKEN') as string | undefined
    const barberId = (Cypress.env('TEST_DEVELOPER_BARBER_ID') || Cypress.env('TEST_BARBER_ID')) as string | undefined
    const serviceId = Cypress.env('TEST_SERVICE_ID') as string | undefined
    const addonIds = Cypress.env('TEST_ADDON_IDS') as string[] | undefined
    return { accessToken, barberId, serviceId, addonIds }
  }

  it('snapshots service and add-on prices in cents', () => {
    const { accessToken, barberId, serviceId, addonIds } = getEnvVars()

    if (!accessToken || !barberId || !serviceId) {
      cy.log('Skipping pricing test: missing required Cypress env vars')
      return
    }
    const auth = { Authorization: `Bearer ${accessToken}` }
    const testNotes = 'E2E Testing - Pricing Calculation'
    const date = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)

    cy.request(`/api/barbers/${barberId}`).then((profile) => {
      const service = profile.body.services.find((s: { id: string }) => s.id === serviceId)
      expect(service, 'service is active and listed').to.exist
      const addons = (profile.body.addons as Array<{ id: string; price_cents: number }>).filter((a) =>
        (addonIds || []).includes(a.id)
      )
      const expectedAddonTotal = addons.reduce((sum, a) => sum + a.price_cents, 0)

      cy.request(`/api/barbers/${barberId}/availability?date=${date}&serviceId=${serviceId}`).then((slots) => {
        const slot = slots.body.slots.find((s: { available: boolean }) => s.available)
        if (!slot) {
          cy.log(`No free slot on ${date}; skipping`)
          return
        }

        cy.request({
          method: 'POST',
          url: '/api/bookings',
          headers: auth,
          body: { barberId, serviceId, startsAt: slot.startsAt, notes: testNotes, addonIds: addons.map((a) => a.id) },
        }).then((postResponse) => {
          expect(postResponse.status).to.eq(201)
          const booking = postResponse.body.booking
          expect(booking.service_price_cents).to.eq(service.price_cents)
          expect(booking.addon_total_cents).to.eq(expectedAddonTotal)
          expect(booking.booking_fee_cents).to.be.oneOf([0, 340])

          cy.request({
            method: 'GET',
            url: `/api/bookings?as=client&from=${encodeURIComponent(new Date().toISOString())}&order=asc&limit=100`,
            headers: auth,
          }).then((getResponse) => {
            expect(getResponse.status).to.eq(200)
            const created = getResponse.body.bookings.find((b: { id: string }) => b.id === booking.id)
            expect(created).to.exist
            expect(created.notes).to.eq(testNotes)
            expect(created.addons.map((a: { addon_id: string }) => a.addon_id).sort()).to.deep.eq(
              addons.map((a) => a.id).sort()
            )
          })

          cy.request({
            method: 'PATCH',
            url: `/api/bookings/${booking.id}`,
            headers: auth,
            body: { action: 'cancel' },
          })
        })
      })
    })
  })
})
