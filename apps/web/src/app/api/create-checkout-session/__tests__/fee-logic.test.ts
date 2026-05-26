/** @jest-environment node */
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { calculateFeeBreakdown } from '../../../../shared/lib/fee-calculator';
import Stripe from 'stripe';

// Mock dependencies
const mockStripeCreate = jest.fn();
(global as any)._mockStripeCreate = mockStripeCreate;

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: (args: any) => {
          // Access the mock function via a global-ish way? 
          // Actually, let's just use jest.fn() here and we'll check calls on Stripe.create sessions?
          // No, we need the actual mockStripeCreate.
          return (global as any)._mockStripeCreate(args);
        },
      },
    },
  }));
});

(global as any)._mockStripeCreate = mockStripeCreate;

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
    log: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../../../../shared/lib/api-auth', () => ({
  ApiAuthError: class extends Error { status = 401 },
  validateBearerToken: jest.fn(() => Promise.resolve({ id: 'client123', email: 'test@example.com' })),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
  })),
}));

// Now import the handler after mocks are set up
import { POST } from '../route';

describe('Create Checkout Session - Fee Logic Integration', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockStripeCreate.mockResolvedValue({ id: 'sess_123', url: 'https://stripe.com/pay' });
  });

  it('should use the consolidated fee model ($3.40 total, $1.80 application fee)', async () => {
    // ... rest of the test
    const mockBarber = { stripe_account_id: 'acct_123', stripe_account_status: 'active', is_developer: false };
    const mockService = { name: 'Test Service', price: 50, duration: 30 };

    const { supabase } = require('../../../../shared/lib/supabase');
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'barbers') return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: mockBarber }) }) }) };
      if (table === 'services') return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: mockService }) }) }) };
      return { select: () => ({ in: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) };
    });

    const request = new Request('http://localhost/api/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ barberId: 'barber123', serviceId: 'service123', date: new Date().toISOString() }),
    });

    await POST(request);

    expect(mockStripeCreate).toHaveBeenCalledWith(expect.objectContaining({
      line_items: expect.arrayContaining([expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 340 }) })]),
      payment_intent_data: expect.objectContaining({ application_fee_amount: 220 }),
    }));

    const breakdown = calculateFeeBreakdown();
    expect(breakdown.platformFee).toBe(340);
    expect(breakdown.bocmGrossShare).toBe(180);
    expect(breakdown.barberShare).toBe(120);
    expect(breakdown.applicationFeeAmount).toBe(220);
  });

  it('should bypass fees for developer barbers', async () => {
    const mockBarber = { stripe_account_id: 'acct_dev', stripe_account_status: 'active', is_developer: true };
    const mockService = { name: 'Test Service', price: 50, duration: 30 };

    const { supabase } = require('../../../../shared/lib/supabase');
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'barbers') return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: mockBarber }) }) }) };
      if (table === 'services') return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: mockService }) }) }) };
      return { select: () => ({ in: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) };
    });

    const request = new Request('http://localhost/api/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ barberId: 'dev123', serviceId: 'service123', date: new Date().toISOString() }),
    });

    await POST(request);

    expect(mockStripeCreate).toHaveBeenCalledWith(expect.objectContaining({
      payment_intent_data: expect.objectContaining({ application_fee_amount: 0 }),
    }));
  });
});
