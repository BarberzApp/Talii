import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import CalendarPage from '@/pages/CalendarPage';
import { Animated } from 'react-native';

// Mock Animated to avoid timer issues
;(Animated as any).timing = () => ({
  start: jest.fn(),
  stop: jest.fn(),
  reset: jest.fn(),
});

;(Animated as any).spring = () => ({
  start: jest.fn(),
  stop: jest.fn(),
  reset: jest.fn(),
});

// Mock twrnc
jest.mock('twrnc', () => {
  const tw = (strings: any) => ({});
  tw.style = jest.fn(() => ({}));
  return { __esModule: true, default: tw };
});

// Mock Vibration
jest.mock('react-native/Libraries/Vibration/Vibration', () => ({
  __esModule: true,
  default: { vibrate: jest.fn(), cancel: jest.fn() },
}));

// Mock all dependencies
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    userProfile: null,
    loading: false,
  }),
}));

const base = {
  barber_id: 'barber-1',
  client_id: 'c1',
  customer_name: null,
  hold_expires_at: null,
  service_price_cents: 3000,
  addon_total_cents: 0,
  booking_fee_cents: 340,
  notes: null,
  cancelled_at: null,
  cancellation_reason: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  source: 'app',
  payment_status: 'succeeded',
  addons: [],
  barber: { id: 'barber-1', business_name: 'Cuts', timezone: 'UTC', city: null, state: null, profile: null },
  client: { name: 'Sam Client', username: 'sam' },
};
const now = Date.now();
const todayBooking = {
  ...base,
  id: 'b-today',
  service_id: 's1',
  status: 'confirmed',
  starts_at: new Date(now - 60_000).toISOString(),
  ends_at: new Date(now + 60_000).toISOString(),
  service: { id: 's1', name: 'Today Fade', duration_minutes: 30 },
};
const yesterdayBooking = {
  ...base,
  id: 'b-yesterday',
  service_id: 's2',
  status: 'confirmed',
  starts_at: new Date(now - 24 * 3600_000).toISOString(),
  ends_at: new Date(now - 24 * 3600_000 + 1800_000).toISOString(),
  service: { id: 's2', name: 'Yesterday Trim', duration_minutes: 30 },
};

jest.mock('@/lib/api', () => ({
  api: {
    me: { get: jest.fn() },
    bookings: { list: jest.fn() },
    services: { list: jest.fn().mockResolvedValue({ services: [] }) },
  },
  isApiError: (e: any) => !!e && e.name === 'ApiError',
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));

jest.mock('lucide-react-native', () => ({
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight',
  Calendar: 'Calendar',
  Clock: 'Clock',
  User: 'User',
  DollarSign: 'DollarSign',
  X: 'X',
  Plus: 'Plus',
  RefreshCw: 'RefreshCw',
  Filter: 'Filter',
  Search: 'Search',
}));

jest.mock('@/components/ReviewForm', () => ({ ReviewForm: 'ReviewForm' }));

jest.setTimeout(10000);

const { api } = require('@/lib/api');

describe('CalendarPage as a barber', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.me.get.mockResolvedValue({
      profile: { role: 'barber' },
      barber: { id: 'barber-1', timezone: 'UTC', onboarding_complete: true },
    });
    api.bookings.list.mockResolvedValue({
      bookings: [yesterdayBooking, todayBooking],
      pagination: { limit: 100, offset: 0, total: 2 },
    });
  });

  it('opens on today\'s agenda with the next appointment highlighted', async () => {
    const screen = render(<CalendarPage />);
    expect(await screen.findByTestId('today-agenda')).toBeTruthy();
    expect(screen.getByText('Today Fade')).toBeTruthy();
    expect(screen.getByTestId('agenda-next')).toBeTruthy();
    expect(screen.queryByText('Yesterday Trim')).toBeNull();
    // The month grid is hidden until asked for.
    expect(screen.queryByText('Sun')).toBeNull();
  });

  it('shows the month grid one tap away and returns to today', async () => {
    const screen = render(<CalendarPage />);
    fireEvent.press(await screen.findByText('Month'));
    expect(screen.queryByTestId('today-agenda')).toBeNull();
    expect(screen.getByText('Sun')).toBeTruthy();

    fireEvent.press(screen.getByText('Back to today'));
    expect(await screen.findByTestId('today-agenda')).toBeTruthy();
  });

  it('opens the appointment details (complete, no-show, cancel) from the agenda', async () => {
    const screen = render(<CalendarPage />);
    fireEvent.press(await screen.findByText('Today Fade'));
    expect(await screen.findByText(/Mark as Completed|Complete/i)).toBeTruthy();
  });
});
