import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
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
  vibrate: jest.fn(),
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  format: jest.fn((date) => '2024-01-01'),
  addMonths: jest.fn((date) => new Date()),
  subMonths: jest.fn((date) => new Date()),
  startOfMonth: jest.fn((date) => new Date()),
  endOfMonth: jest.fn((date) => new Date()),
  eachDayOfInterval: jest.fn(() => [new Date()]),
  isSameMonth: jest.fn(() => true),
  isSameDay: jest.fn(() => false),
  isToday: jest.fn(() => false),
  startOfWeek: jest.fn((date) => new Date()),
  endOfWeek: jest.fn((date) => new Date()),
  isSameWeek: jest.fn(() => false),
}));

// Mock all dependencies
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    userProfile: null,
    loading: false,
  }),
}));

jest.mock('@/lib/api', () => ({
  api: {
    me: { get: jest.fn().mockResolvedValue({ profile: { role: 'client' }, barber: null }) },
    bookings: { list: jest.fn().mockResolvedValue({ bookings: [], pagination: { limit: 100, offset: 0, total: 0 } }) },
    services: { list: jest.fn().mockResolvedValue({ services: [] }) },
  },
  isApiError: () => false,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
  useFocusEffect: jest.fn((callback) => {
    // Call immediately
    callback();
    // Return cleanup function
    return () => {};
  }),
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

describe('CalendarPage - Basic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially', () => {
    const { getByText } = render(<CalendarPage />);
    expect(getByText('Loading Calendar...')).toBeTruthy();
  });

  it('should render calendar component', () => {
    const { root } = render(<CalendarPage />);
    // Just check that something renders
    expect(root).toBeTruthy();
  });

  it('loads the calendar through the API', async () => {
    const { api } = require('@/lib/api');
    render(<CalendarPage />);
    await waitFor(() => expect(api.me.get).toHaveBeenCalled());
    await waitFor(() =>
      expect(api.bookings.list).toHaveBeenCalledWith(expect.objectContaining({ as: 'client' }))
    );
  });
});

