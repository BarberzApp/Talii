import * as WebBrowser from 'expo-web-browser';
import { isConnectSessionOpen, isStripeReady, openStripeConnect } from '@/lib/stripeConnect';
import { api } from '@/lib/api';

jest.mock('@/lib/logger');
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('@/lib/api', () => ({
  api: { connect: { onboarding: jest.fn(), dashboard: jest.fn(), status: jest.fn() } },
}));

const mockApi = api as any;

describe('openStripeConnect', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockApi.connect.onboarding.mockResolvedValue({ url: 'https://connect.stripe.com/x', type: 'onboarding' });
    mockApi.connect.status.mockResolvedValue({
      hasAccount: true, chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true, feeExempt: false,
    });
  });
  afterEach(() => jest.useRealTimers());

  it('marks the session open while the browser is up, so App.tsx ignores the return link', async () => {
    let openDuringSession: boolean | undefined;
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockImplementation(async () => {
      openDuringSession = isConnectSessionOpen();
      return { type: 'success', url: 'talii://stripe-connect/return?account_id=acct_1' };
    });

    const result = await openStripeConnect('onboarding');

    expect(openDuringSession).toBe(true);
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith('https://connect.stripe.com/x', 'talii://stripe-connect');
    expect(isStripeReady(result.status)).toBe(true);
    expect(result.needsNewLink).toBe(false);
    // Still flagged right after (a late deep link), cleared shortly after.
    expect(isConnectSessionOpen()).toBe(true);
    jest.advanceTimersByTime(1000);
    expect(isConnectSessionOpen()).toBe(false);
  });

  it('reports an expired link (refresh URL)', async () => {
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'success',
      url: 'talii://stripe-connect/refresh?account_id=acct_1',
    });
    const result = await openStripeConnect('onboarding');
    expect(result.needsNewLink).toBe(true);
    jest.advanceTimersByTime(1000);
  });
});
