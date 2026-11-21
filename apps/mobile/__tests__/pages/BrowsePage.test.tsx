import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import BrowsePage from '@/pages/BrowsePage';

// Mock twrnc - needs to be a function that returns style objects
jest.mock('twrnc', () => {
  const tw = (strings: any) => ({});
  tw.style = jest.fn(() => ({}));
  return { __esModule: true, default: tw };
});

// Mock all dependencies
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    userProfile: null,
    loading: false,
  }),
}));

const mockCard = {
  id: 'barber-1',
  user_id: 'user-1',
  business_name: 'Fade Co',
  bio: 'Clean fades',
  specialties: ['Barber'],
  city: 'Austin',
  state: 'TX',
  name: 'Ann',
  username: 'ann',
  avatar_url: null,
  distance_miles: null,
  rating: { review_count: 2, average_rating: 4.5 },
};

jest.mock('@/lib/api', () => ({
  api: {
    barbers: {
      list: jest.fn(() => Promise.resolve({ barbers: [mockCard], pagination: { limit: 10, offset: 0, hasMore: false } })),
      reviews: jest.fn(),
    },
    bookings: { list: jest.fn() },
    reviews: { listOwn: jest.fn() },
  },
  errorMessage: (_e: unknown, fallback: string) => fallback,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  Accuracy: { High: 4 },
}));

jest.mock('lucide-react-native', () => ({
  Search: 'Search',
  MapPin: 'MapPin',
  Filter: 'Filter',
  X: 'X',
  Scissors: 'Scissors',
  Star: 'Star',
}));

jest.mock('@/components/BookingForm', () => 'BookingForm');
jest.mock('@/pages/ProfilePreview', () => 'ProfilePreview');
jest.mock('@/components/ReviewCard', () => ({ ReviewCard: 'ReviewCard' }));
jest.mock('@/components/ReviewForm', () => ({ ReviewForm: 'ReviewForm' }));
jest.mock('@/components/ui', () => ({ Avatar: 'Avatar' }));

describe('BrowsePage - Basic Tests', () => {
  it('should render browse page', () => {
    const { getByText } = render(<BrowsePage />);
    expect(getByText('Browse')).toBeTruthy();
  });

  it('should render search input', () => {
    const { getByPlaceholderText } = render(<BrowsePage />);
    expect(getByPlaceholderText('Search stylists...')).toBeTruthy();
  });

  it('should handle search text input', () => {
    const { getByPlaceholderText } = render(<BrowsePage />);
    const searchInput = getByPlaceholderText('Search stylists...');
    
    fireEvent.changeText(searchInput, 'test barber');
    expect(searchInput.props.value).toBe('test barber');
  });

  it('should show filters when filter button is pressed', async () => {
    const { getByTestId, getByText } = render(<BrowsePage />);
    const filterButton = getByTestId('filter-button');
    
    fireEvent.press(filterButton);
    
    await waitFor(() => {
      expect(getByText('Specialties')).toBeTruthy();
    });
  });

  it('should show loading state initially', () => {
    const { getByText } = render(<BrowsePage />);
    expect(getByText('Loading stylists...')).toBeTruthy();
  });

  it('has no view toggle (only the stylist list remains)', () => {
    const { queryByText } = render(<BrowsePage />);
    expect(queryByText('Cosmetologists')).toBeNull();
  });

  it('shows an error with Try again when the list fails to load', async () => {
    const { api } = require('@/lib/api');
    api.barbers.list.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    const { findByText, getByText } = render(<BrowsePage />);
    expect(await findByText('Could not load stylists')).toBeTruthy();
    fireEvent.press(getByText('Try again'));
    expect(await findByText('Fade Co')).toBeTruthy();
  });

  it('lists barbers from GET /api/barbers with their rating', async () => {
    const { api } = require('@/lib/api');
    const { findByText } = render(<BrowsePage />);
    expect(await findByText('Austin, TX')).toBeTruthy();
    expect(api.barbers.list).toHaveBeenCalledWith({ q: undefined, limit: 10, offset: 0 });
    expect(await findByText('4.5 (2)')).toBeTruthy();
  });

  it('sends the debounced search text to the server as q and starts from page 0', async () => {
    const { api } = require('@/lib/api');
    const screen = render(<BrowsePage />);
    await screen.findByText('Austin, TX');
    api.barbers.list.mockClear();

    fireEvent.changeText(screen.getByPlaceholderText('Search stylists...'), '  fade ');
    await waitFor(() => expect(api.barbers.list).toHaveBeenCalledWith({ q: 'fade', limit: 10, offset: 0 }), {
      timeout: 2000,
    });
    expect(api.barbers.list).toHaveBeenCalledTimes(1);
  });
});
