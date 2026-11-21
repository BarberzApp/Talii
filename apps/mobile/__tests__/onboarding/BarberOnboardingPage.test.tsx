import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import BarberOnboardingPage from '@/pages/BarberOnboardingPage';
import { api } from '@/lib/api';
import { openStripeConnect, fetchConnectStatus } from '@/lib/stripeConnect';

jest.mock('twrnc', () => {
  const tw = () => ({});
  tw.style = jest.fn(() => ({}));
  return { __esModule: true, default: tw };
});

jest.mock('lucide-react-native', () =>
  new Proxy({}, { get: (_target, name) => (name === '__esModule' ? false : String(name)) })
);

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

jest.mock('@/hooks/useAuth', () => {
  const value = {
    user: { id: 'barber-user', email: 'b@example.com' },
    userProfile: { role: 'barber', name: 'Dana', business_name: 'Sharp Lines' },
    refreshProfile: jest.fn(),
  };
  return { useAuth: () => value };
});

jest.mock('@/lib/stripeConnect', () => ({
  fetchConnectStatus: jest.fn(),
  isStripeReady: (s: any) => !!s && (s.feeExempt || (s.hasAccount && s.chargesEnabled && s.detailsSubmitted)),
  openStripeConnect: jest.fn(),
}));

jest.mock('@/lib/api', () => {
  const shared = jest.requireActual('@barber-app/shared');
  return {
    api: {
      me: { get: jest.fn(), update: jest.fn() },
      services: { list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() },
    },
    errorMessage: shared.errorMessage,
    isApiError: shared.isApiError,
  };
});

const mockApi = api as any;

describe('BarberOnboardingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockApi.me.get.mockResolvedValue({
      profile: { name: 'Dana', phone: '(312) 555-0100' },
      barber: {
        business_name: 'Sharp Lines',
        bio: 'Line-ups and beard work.',
        specialties: ['Barber'],
        city: 'Chicago',
        state: 'IL',
        instagram: null,
        tiktok: null,
      },
    });
    mockApi.services.list.mockResolvedValue({
      services: [{ id: 's1', name: 'Cut', price_cents: 5000, duration_minutes: 60, is_active: true }],
    });
    mockApi.services.update.mockResolvedValue({ service: {} });
    mockApi.me.update.mockResolvedValue({});
    (fetchConnectStatus as jest.Mock).mockResolvedValue({ hasAccount: false, chargesEnabled: false, detailsSubmitted: false, feeExempt: false });
    (openStripeConnect as jest.Mock).mockResolvedValue({ status: null, needsNewLink: false, linkType: 'onboarding' });
  });

  it('saves the profile and services before opening Stripe Connect', async () => {
    const screen = render(<BarberOnboardingPage />);
    await waitFor(() => expect(screen.getByDisplayValue('Sharp Lines')).toBeTruthy());

    fireEvent.press(screen.getByText('Next')); // business -> services
    fireEvent.press(await screen.findByText('Next')); // services -> payment
    fireEvent.press(await screen.findByText('Connect Stripe Account'));

    await waitFor(() => expect(openStripeConnect).toHaveBeenCalledWith('onboarding'));
    expect(mockApi.me.update).toHaveBeenCalledWith(
      expect.objectContaining({ businessName: 'Sharp Lines', city: 'Chicago', state: 'IL' })
    );
    expect(mockApi.me.update).not.toHaveBeenCalledWith(expect.objectContaining({ onboardingComplete: true }));
    expect(mockApi.services.update).toHaveBeenCalledWith('s1', expect.objectContaining({ priceCents: 5000 }));
    const savedAt = mockApi.me.update.mock.invocationCallOrder[0];
    const openedAt = (openStripeConnect as jest.Mock).mock.invocationCallOrder[0];
    expect(savedAt).toBeLessThan(openedAt);
  });
});
