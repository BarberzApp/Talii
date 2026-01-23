import { BookingService } from '../booking-service'
import { supabase } from '../supabase'
import type { CreateBookingInput } from '../booking-service'

jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: { id: '123' }, error: null })),
        })),
      })),
    })),
  },
}))

jest.mock('../notification-service', () => ({
  NotificationService: {
    createNotification: jest.fn(),
  },
}))

describe('BookingService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create a booking with fee and cut', async () => {
    const booking = await BookingService.createBooking({
      barber_id: 'barber123',
      service_id: 'service123',
      date: new Date().toISOString(),
      price: 100,
      client_id: 'client123',
      payment_intent_id: 'pi_123',
      platform_fee: 1.80, // $1.80 (60% of $3.00 net)
      barber_payout: 1.20, // $1.20 (40% of $3.00 net)
      status: 'pending',
      payment_status: 'pending',
    })
    expect(booking.id).toBe('123')
  })

  it('should create a booking with fee only', async () => {
    const booking = await BookingService.createBooking({
      barber_id: 'barber123',
      service_id: 'service123',
      date: new Date().toISOString(),
      price: 3.00,
      client_id: 'client123',
      payment_intent_id: 'pi_123',
      platform_fee: 1.80, // $1.80 (60% of $3.00 net)
      barber_payout: 1.20, // $1.20 (40% of $3.00 net)
      status: 'pending',
      payment_status: 'pending',
    })
    expect(booking.id).toBe('123')
  })

  it('should create a booking with guest information', async () => {
    const booking = await BookingService.createBooking({
      barber_id: 'barber123',
      service_id: 'service123',
      date: new Date().toISOString(),
      price: 100,
      payment_intent_id: 'pi_123',
      guest_name: 'John Doe',
      guest_email: 'john@example.com',
      guest_phone: '1234567890',
      platform_fee: 1.80,
      barber_payout: 1.20,
      status: 'pending',
      payment_status: 'pending',
    })
    expect(booking.id).toBe('123')
  })

  it('should throw error when payment_intent_id is missing', async () => {
    await expect(BookingService.createBooking({
      barber_id: 'barber123',
      service_id: 'service123',
      date: new Date().toISOString(),
      price: 100,
      client_id: 'client123',
      status: 'pending',
      payment_status: 'pending',
    } as CreateBookingInput)).rejects.toThrow('Payment intent ID is required')
  })

  it('should throw error when guest information is incomplete', async () => {
    await expect(BookingService.createBooking({
      barber_id: 'barber123',
      service_id: 'service123',
      date: new Date().toISOString(),
      price: 100,
      payment_intent_id: 'pi_123',
      guest_name: 'John Doe',
      // Missing guest_email and guest_phone
      status: 'pending',
      payment_status: 'pending',
    })).rejects.toThrow('Either client_id or guest information must be provided')
  })
}) 