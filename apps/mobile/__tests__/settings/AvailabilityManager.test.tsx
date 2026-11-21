import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AvailabilityManager, findScheduleProblem } from '@/components/settings/AvailabilityManager';
import { api } from '@/lib/api';

jest.mock('twrnc', () => {
  const tw = () => ({});
  tw.style = jest.fn(() => ({}));
  return { __esModule: true, default: tw };
});

jest.mock('@/hooks/useAuth', () => {
  const value = { user: { id: 'barber-user' } };
  return { useAuth: () => value };
});

jest.mock('@react-native-picker/picker', () => {
  const { View } = require('react-native');
  const Picker = ({ children, testID, selectedValue }: any) => (
    <View testID={testID} accessibilityValue={{ text: selectedValue }}>{children}</View>
  );
  Picker.Item = () => null;
  return { Picker };
});

jest.mock('lucide-react-native', () => ({
  Calendar: 'Calendar',
  Clock: 'Clock',
  Save: 'Save',
  AlertCircle: 'AlertCircle',
  CheckCircle: 'CheckCircle',
  Loader2: 'Loader2',
  RefreshCw: 'RefreshCw',
}));

jest.mock('@/lib/api', () => {
  const shared = jest.requireActual('@barber-app/shared');
  return {
    api: { schedule: { getWeek: jest.fn(), replaceWeek: jest.fn() } },
    errorMessage: shared.errorMessage,
  };
});

const mockApi = api as unknown as { schedule: { getWeek: jest.Mock; replaceWeek: jest.Mock } };

describe('AvailabilityManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('offers Retry and never saves when the week could not be loaded', async () => {
    const { ApiError } = jest.requireActual('@barber-app/shared');
    mockApi.schedule.getWeek.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server'));
    const screen = render(<AvailabilityManager barberId="b1" />);

    expect(await screen.findByTestId('availability-load-error')).toBeTruthy();
    expect(screen.queryByText('Save Schedule')).toBeNull();
    expect(mockApi.schedule.replaceWeek).not.toHaveBeenCalled();

    mockApi.schedule.getWeek.mockResolvedValueOnce({ availability: [] });
    fireEvent.press(screen.getByText('Retry'));
    expect(await screen.findByText('Save Schedule')).toBeTruthy();
    expect(mockApi.schedule.getWeek).toHaveBeenCalledTimes(2);
  });

  it('shows every window of a day and saves them all', async () => {
    mockApi.schedule.getWeek.mockResolvedValue({
      availability: [
        { id: 'w2', day_of_week: 1, start_time: '13:00:00', end_time: '17:00:00' },
        { id: 'w1', day_of_week: 1, start_time: '09:00:00', end_time: '12:00:00' },
      ],
    });
    mockApi.schedule.replaceWeek.mockResolvedValue({ availability: [] });
    const screen = render(<AvailabilityManager barberId="b1" />);

    // Monday is the first card: both windows have their own pickers.
    expect(await screen.findByTestId('start-0-0')).toBeTruthy();
    expect(screen.getByTestId('start-0-1')).toBeTruthy();

    fireEvent.press(screen.getByText('Save Schedule'));
    await waitFor(() =>
      expect(mockApi.schedule.replaceWeek).toHaveBeenCalledWith([
        { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
        { dayOfWeek: 1, startTime: '13:00', endTime: '17:00' },
      ])
    );
  });

  it('removes a window', async () => {
    mockApi.schedule.getWeek.mockResolvedValue({
      availability: [
        { id: 'w1', day_of_week: 1, start_time: '09:00:00', end_time: '12:00:00' },
        { id: 'w2', day_of_week: 1, start_time: '13:00:00', end_time: '17:00:00' },
      ],
    });
    mockApi.schedule.replaceWeek.mockResolvedValue({ availability: [] });
    const screen = render(<AvailabilityManager barberId="b1" />);
    fireEvent.press(await screen.findByLabelText('Remove Monday hours 1'));
    fireEvent.press(screen.getByText('Save Schedule'));
    await waitFor(() =>
      expect(mockApi.schedule.replaceWeek).toHaveBeenCalledWith([{ dayOfWeek: 1, startTime: '13:00', endTime: '17:00' }])
    );
  });
});

describe('findScheduleProblem', () => {
  it('accepts touching windows and rejects overlaps and reversed times', () => {
    expect(findScheduleProblem([
      { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
      { dayOfWeek: 1, startTime: '12:00', endTime: '17:00' },
    ])).toBeNull();
    expect(findScheduleProblem([
      { dayOfWeek: 2, startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 2, startTime: '12:00', endTime: '17:00' },
    ])).toBe('Tuesday: 09:00-13:00 and 12:00-17:00 overlap.');
    expect(findScheduleProblem([{ dayOfWeek: 0, startTime: '17:00', endTime: '09:00' }])).toBe(
      'Sunday: the end time must be after the start time.'
    );
  });
});
