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

// One booking on the 15th of the current month at 19:30 in Los Angeles, which is
// already the 16th in UTC: it must show on the 15th (the barber's day).
const now = new Date();
const y = now.getFullYear();
const m = String(now.getMonth() + 1).padStart(2, '0');
const mockBooking = {
  id: 'booking-la',
  barber_id: 'barber-1',
  client_id: 'test-user',
  customer_name: null,
  service_id: 'service-1',
  starts_at: `${y}-${m}-16T03:30:00.000Z`,
  ends_at: `${y}-${m}-16T04:00:00.000Z`,
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
  status: 'confirmed',
  payment_status: 'succeeded',
  service: { id: 'service-1', name: 'Evening Fade', duration_minutes: 30 },
  addons: [],
  barber: { id: 'barber-1', business_name: 'LA Cuts', timezone: 'America/Los_Angeles', city: null, state: null, profile: null },
  client: null,
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
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
  // Like the real hook for a screen that stays focused: runs when the callback changes.
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

jest.mock('@/components/ReviewForm', () => ({
  ReviewForm: 'ReviewForm',
}));

// Increase timeout for this test suite due to animations
jest.setTimeout(10000);

const { api } = require('@/lib/api');

describe('CalendarPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.me.get.mockResolvedValue({ profile: { role: 'client' }, barber: null });
    api.bookings.list.mockResolvedValue({ bookings: [mockBooking], pagination: { limit: 100, offset: 0, total: 1 } });
  });

  it('renders the loading state first', () => {
    const { getByText } = render(<CalendarPage />);
    expect(getByText('Loading Calendar...')).toBeTruthy();
  });

  it('loads the visible month through the API', async () => {
    render(<CalendarPage />);
    await waitFor(() => expect(api.me.get).toHaveBeenCalled());
    await waitFor(() => expect(api.bookings.list).toHaveBeenCalled());
    const query = api.bookings.list.mock.calls[0][0];
    expect(query).toMatchObject({ as: 'client', order: 'asc' });
    // The range covers this month (padded by a week on each side).
    expect(Date.parse(query.from)).toBeLessThan(new Date(y, now.getMonth(), 1).getTime());
    expect(Date.parse(query.to)).toBeGreaterThan(new Date(y, now.getMonth() + 1, 0).getTime());
  });

  it('groups a booking on its day in the barber time zone', async () => {
    const screen = render(<CalendarPage />);
    await waitFor(() => expect(screen.queryByText('Loading Calendar...')).toBeNull());

    fireEvent.press(screen.getAllByText('15')[0]);
    expect(await screen.findByText('Evening Fade')).toBeTruthy();

    fireEvent.press(screen.getAllByText('16')[0]);
    await waitFor(() => expect(screen.queryByText('Evening Fade')).toBeNull());
  });

  it('shows an error with a retry instead of an empty month', async () => {
    api.bookings.list.mockRejectedValue(Object.assign(new Error('Server unavailable'), { name: 'ApiError', code: 'INTERNAL', status: 500 }));
    const screen = render(<CalendarPage />);
    expect(await screen.findByTestId('calendar-load-error')).toBeTruthy();
    expect(screen.getByText('Server unavailable')).toBeTruthy();

    api.bookings.list.mockResolvedValue({ bookings: [mockBooking], pagination: { limit: 100, offset: 0, total: 1 } });
    const before = api.bookings.list.mock.calls.length;
    fireEvent.press(screen.getByText('Try again'));
    await new Promise((r) => setTimeout(r, 50));
    (globalThis as any).__dbg = [before, api.bookings.list.mock.calls.length];
    process.stdout.write(`DBG ${JSON.stringify((globalThis as any).__dbg)}\n`);
    await waitFor(() => expect(screen.queryByTestId('calendar-load-error')).toBeNull());
  });
});
