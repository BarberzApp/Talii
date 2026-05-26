import { POST } from '../route';
import { calculateFeeBreakdown } from '../../../../shared/lib/fee-calculator';
import Stripe from 'stripe';
import { supabase } from '../../../../shared/lib/supabase';

// Mock dependencies
jest.mock('stripe');
jest.mock('../../../../shared/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'client123' } }, error: null })),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
        in: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
  },
}));

jest.mock('../../../../shared/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('Create Checkout Session - Fee Logic Integration', () => {
  const mockStripeCreate = jest.fn();
  
  beforeAll(() => {
    (Stripe as any).mockImplementation(() => ({
      checkout: {
        sessions: {
          create: mockStripeCreate,
        },
      },
    }));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockStripeCreate.mockResolvedValue({ id: 'sess_123', url: 'https://stripe.com/pay' });
  });

  it('should use the consolidated fee model ($3.40 total, $1.80 application fee)', async () => {
    const breakdown = calculateFeeBreakdown();
    
    // Mock barber data
    const mockBarber = {
      stripe_account_id: 'acct_123',
      stripe_account_status: 'active',
      is_developer: false
    };

    // Mock service data
    const mockService = {
      name: 'Test Service',
      price: 50,
      duration: 30
    };

    // Setup supabase mocks
    const fromMock = supabase.from as any;
    fromMock.mockImplementation((table: string) => {
      if (table === 'barbers') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: mockBarber, error: null })),
            })),
          })),
        };
      }
      if (table === 'services') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: mockService, error: null })),
            })),
          })),
        };
      }
      return {
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      };
    });

    const requestBody = {
      barberId: 'barber123',
      serviceId: 'service123',
      date: new Date().toISOString(),
      clientId: 'client123'
    };

    const request = new Request('http://localhost/api/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    await POST(request);

    // Verify Stripe session creation parameters
    expect(mockStripeCreate).toHaveBeenCalledWith(expect.objectContaining({
      line_items: expect.arrayContaining([
        expect.objectContaining({
          price_data: expect.objectContaining({
            unit_amount: 340, // TOTAL_PRICE_CENTS
          }),
        }),
      ]),
      payment_intent_data: expect.objectContaining({
        application_fee_amount: 180, // BOCM_GROSS_SHARE
      }),
    }));

    // Verify constants match
    expect(breakdown.platformFee).toBe(340);
    expect(breakdown.bocmGrossShare).toBe(180);
    expect(breakdown.barberShare).toBe(120);
  });

  it('should bypass fees for developer barbers', async () => {
    // Mock developer barber data
    const mockBarber = {
      stripe_account_id: 'acct_dev',
      stripe_account_status: 'active',
      is_developer: true
    };

    const mockService = {
      name: 'Test Service',
      price: 50,
      duration: 30
    };

    // Setup supabase mocks
    const fromMock = supabase.from as any;
    fromMock.mockImplementation((table: string) => {
      if (table === 'barbers') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: mockBarber, error: null })),
            })),
          })),
        };
      }
      if (table === 'services') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: mockService, error: null })),
            })),
          })),
        };
      }
      return {
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      };
    });

    const requestBody = {
      barberId: 'dev123',
      serviceId: 'service123',
      date: new Date().toISOString(),
      clientId: 'client123'
    };

    const request = new Request('http://localhost/api/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    await POST(request);

    // Verify Stripe session creation parameters for developer
    expect(mockStripeCreate).toHaveBeenCalledWith(expect.objectContaining({
      payment_intent_data: expect.objectContaining({
        application_fee_amount: 0,
      }),
    }));
  });
});
