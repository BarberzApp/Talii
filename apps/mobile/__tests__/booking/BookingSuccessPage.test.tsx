import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import BookingSuccessPage from '@/pages/BookingSuccessPage';

jest.mock('twrnc', () => {
  const tw = (_strings: any) => ({});
  tw.style = jest.fn(() => ({}));
  return { __esModule: true, default: tw };
});
jest.mock('react-native-vector-icons/Feather', () => 'Icon');

let mockParams: any;
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
}));

describe('BookingSuccessPage', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockParams = {
      barberName: 'Test Barber',
      serviceName: 'Haircut',
      // 15:00 UTC is 10:00 in New York (EST).
      startsAt: '2030-01-07T15:00:00.000Z',
      endsAt: '2030-01-07T15:30:00.000Z',
      timeZone: 'America/New_York',
      city: 'Brooklyn',
      state: 'NY',
    };
  });

  it('shows the time in the barber zone, the place and the cancellation policy', () => {
    const { getByText } = render(<BookingSuccessPage />);
    expect(getByText(/10:00 AM EST/)).toBeTruthy();
    expect(getByText('Brooklyn, NY')).toBeTruthy();
    expect(getByText(/Free cancellation \(booking fee refunded\) until 24 hours before/)).toBeTruthy();
    expect(getByText(/barber cancels, you are always refunded/)).toBeTruthy();
  });

  it('opens a maps link built from the address text', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { getByText } = render(<BookingSuccessPage />);
    fireEvent.press(getByText('Open in Maps'));
    expect(open).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('Test Barber Brooklyn, NY')));
  });

  it('still renders without booking details (deep link)', () => {
    mockParams = undefined;
    const { getByText, queryByText } = render(<BookingSuccessPage />);
    expect(getByText("You're All Set!")).toBeTruthy();
    expect(queryByText('Open in Maps')).toBeNull();
    expect(getByText(/Free cancellation/)).toBeTruthy();
  });
});
