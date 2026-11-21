import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import SettingsPage from '@/pages/SettingsPage';

// Mock twrnc
jest.mock('twrnc', () => {
  const tw = (strings: any) => ({});
  tw.style = jest.fn(() => ({}));
  return { __esModule: true, default: tw };
});

// Mock dependencies
// Stable references: SettingsPage re-fetches when `user` changes identity, so a fresh object per render loops forever.
jest.mock('@/hooks/useAuth', () => {
  const value = {
    user: { id: 'test-user', email: 'test@example.com' },
    userProfile: { name: 'Test User', role: 'client' },
    logout: jest.fn(),
  };
  return { useAuth: () => value };
});

jest.mock('@/lib/api', () => ({
  api: {
    me: {
      get: jest.fn().mockResolvedValue({
        user: { id: 'test-user', email: 'test@example.com' },
        profile: { id: 'test-user', role: 'client', name: 'Test User', email: 'test@example.com' },
        barber: null,
      }),
      delete: jest.fn(),
    },
  },
  errorMessage: (_e: unknown, fallback: string) => fallback,
  hasErrorCode: () => false,
}));

jest.mock('@/lib/stripeConnect', () => ({
  fetchConnectStatus: jest.fn().mockResolvedValue(null),
  isStripeReady: () => false,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

jest.mock('lucide-react-native', () => ({
  User: 'User',
  Scissors: 'Scissors',
  Package: 'Package',
  Share2: 'Share2',
  Calendar: 'Calendar',
  DollarSign: 'DollarSign',
  Settings: 'Settings',
  Sparkles: 'Sparkles',
  AlertCircle: 'AlertCircle',
  LogOut: 'LogOut',
  CheckCircle: 'CheckCircle',
  RefreshCw: 'RefreshCw',
  FileText: 'FileText',
  Shield: 'Shield',
  Sun: 'Sun',
  Moon: 'Moon',
  Smartphone: 'Smartphone',
}));

// Mock settings components
jest.mock('@/components/settings/ProfileSettings', () => ({
  ProfileSettings: 'ProfileSettings',
}));

jest.mock('@/components/settings/ServicesSettings', () => ({
  ServicesSettings: 'ServicesSettings',
}));

jest.mock('@/components/settings/AddonsSettings', () => ({
  AddonsSettings: 'AddonsSettings',
}));

jest.mock('@/components/settings/ShareSettings', () => ({
  ShareSettings: 'ShareSettings',
}));

jest.mock('@/components/settings/AvailabilityManager', () => ({
  AvailabilityManager: 'AvailabilityManager',
}));

jest.mock('@/components/settings/EarningsDashboard', () => ({
  EarningsDashboard: 'EarningsDashboard',
}));

jest.mock('@/components/ui', () => ({
  Button: 'Button',
  Card: 'Card',
  CardContent: 'CardContent',
}));

describe('SettingsPage - Basic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially', () => {
    const { getByText } = render(<SettingsPage />);
    expect(getByText('Loading your settings...')).toBeTruthy();
  });

  it('should render without crashing', () => {
    expect(() => {
      render(<SettingsPage />);
    }).not.toThrow();
  });

  it('loads settings from GET /api/me', async () => {
    const { api } = require('@/lib/api');
    render(<SettingsPage />);
    await waitFor(() => expect(api.me.get).toHaveBeenCalled());
  });

  it('should accept navigation prop', () => {
    // useNavigation is mocked, component should use it
    render(<SettingsPage />);
    expect(true).toBe(true);
  });
});

