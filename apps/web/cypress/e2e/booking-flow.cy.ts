// Smoke test of the booking API used by web and mobile.
// Env (cypress.env.json or CYPRESS_* vars): TEST_ACCESS_TOKEN (a client's Supabase access token),
// TEST_BARBER_ID and TEST_SERVICE_ID (a fee-exempt barber and one of its services, e.g. the
// seed's "Sharp Lines"). Without them only the health check runs.

function nextDates(days: number): string[] {
  const out: string[] = []
  for (let i = 1; i <= days; i++) {
    const d = new Date(Date.now() + i * 86_400_000)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

describe('Booking flow', () => {
  it('responds to backend health check', () => {
    cy.request('/api/health').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('status', 'healthy')
    })
  })

  it('finds a slot, books it and cancels it through the API', () => {
    const accessToken = Cypress.env('TEST_ACCESS_TOKEN') as string | undefined
    const barberId = Cypress.env('TEST_BARBER_ID') as string | undefined
    const serviceId = Cypress.env('TEST_SERVICE_ID') as string | undefined

    if (!accessToken || !barberId || !serviceId) {
      cy.log('Skipping booking flow test: missing Cypress env vars')
      return
    }
    const auth = { Authorization: `Bearer ${accessToken}` }

    const findSlot = (dates: string[]): Cypress.Chainable<string> => {
      const [date, ...rest] = dates
      return cy
        .request(`/api/barbers/${barberId}/availability?date=${date}&serviceId=${serviceId}`)
        .then((res) => {
          const slot = (res.body.slots as Array<{ startsAt: string; available: boolean }>).find((s) => s.available)
          if (slot) return cy.wrap(slot.startsAt)
          if (rest.length === 0) throw new Error('No free slot in the next 14 days')
          return findSlot(rest)
        })
    }

    findSlot(nextDates(14)).then((startsAt) => {
      cy.request({
        method: 'POST',
        url: '/api/bookings',
        headers: auth,
        body: { barberId, serviceId, startsAt },
      }).then((response) => {
        expect(response.status).to.eq(201)
        expect(response.body.booking.starts_at).to.be.a('string')
        // Fee-exempt barber: confirmed at once, no PaymentIntent.
        if (response.body.clientSecret === null) {
          expect(response.body.booking.status).to.eq('confirmed')
        } else {
          expect(response.body.clientSecret).to.be.a('string')
        }

        cy.request({
          method: 'PATCH',
          url: `/api/bookings/${response.body.booking.id}`,
          headers: auth,
          body: { action: 'cancel', reason: 'e2e cleanup' },
        }).then((cancel) => {
          expect(cancel.status).to.eq(200)
          expect(cancel.body.booking.status).to.eq('cancelled')
        })
      })
    })
  })
})
