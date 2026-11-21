import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { ApiError } from '@barber-app/shared';
import BookingForm from '@/components/BookingForm';
import { api } from '@/lib/api';

jest.mock('twrnc', () => {
  const tw = (_strings: any) => ({});
  tw.style = jest.fn(() => ({}));
  return { __esModule: true, default: tw };
});

jest.mock('@/hooks/useAuth', () => {
  const value = {
    user: { id: 'test-user', email: 'test@example.com' },
    userProfile: { name: 'Test User' },
  };
  return { useAuth: () => value };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('react-native-vector-icons/Feather', () => 'Icon');
jest.mock('@stripe/stripe-react-native', () => ({
  initPaymentSheet: jest.fn(),
  presentPaymentSheet: jest.fn(),
}));

jest.mock('@/components/ui', () => {
  const { Text, TouchableOpacity, TextInput } = require('react-native');
  return {
    Button: ({ children, onPress, disabled }: any) => (
      <TouchableOpacity onPress={onPress} disabled={disabled} accessibilityRole="button">
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Textarea: (props: any) => <TextInput {...props} />,
  };
});

jest.mock('@/lib/api', () => {
  const shared = jest.requireActual('@barber-app/shared');
  return {
    api: {
      barbers: { get: jest.fn(), availability: jest.fn() },
      bookings: { create: jest.fn(), cancel: jest.fn() },
    },
    isApiError: shared.isApiError,
    bookingErrorMessage: shared.bookingErrorMessage,
  };
});

const mockApi = api as unknown as {
  barbers: { get: jest.Mock; availability: jest.Mock };
  bookings: { create: jest.Mock; cancel: jest.Mock };
};

const slot = {
  startsAt: '2030-01-07T15:00:00.000Z',
  endsAt: '2030-01-07T15:30:00.000Z',
  time: '10:00',
  available: true,
};

const props = {
  isVisible: true,
  onClose: jest.fn(),
  barberId: 'barber-1',
  barberName: 'Test Barber',
  onBookingCreated: jest.fn(),
};

/** Walks through service, time, info and review, then taps Book & Pay. */
async function bookThroughSteps() {
  const screen = render(<BookingForm {...props} />);
  fireEvent.press(await screen.findByText('Haircut'));
  fireEvent.press(screen.getByText('Continue'));
  // Any date chip; availability is mocked.
  fireEvent.press(screen.getAllByText(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/)[1]);
  fireEvent.press(await screen.findByText('10:00 AM'));
  fireEvent.press(screen.getByText('Continue'));
  fireEvent.press(screen.getByText('Continue'));
  fireEvent.press(screen.getByText('Book & Pay'));
  return screen;
}

describe('BookingForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockApi.barbers.get.mockResolvedValue({
      barber: { id: 'barber-1', timezone: 'America/New_York' },
      profile: {},
      services: [{ id: 'service-1', name: 'Haircut', description: null, duration_minutes: 30, price_cents: 3000 }],
      addons: [],
      rating: { review_count: 0, average_rating: null },
    });
    mockApi.barbers.availability.mockResolvedValue({
      date: '2030-01-07',
      timezone: 'America/New_York',
      serviceId: 'service-1',
      durationMinutes: 30,
      slots: [slot, { ...slot, startsAt: '2030-01-07T15:15:00.000Z', time: '10:15', available: false, reason: 'booked' }],
    });
  });

  it('renders nothing when hidden', () => {
    const { queryByText } = render(<BookingForm {...props} isVisible={false} />);
    expect(queryByText('Choose Your Service')).toBeNull();
  });

  it('shows services with prices from cents', async () => {
    const { findByText, getByText } = render(<BookingForm {...props} />);
    expect(await findByText('Haircut')).toBeTruthy();
    expect(getByText('$30.00')).toBeTruthy();
    expect(mockApi.barbers.get).toHaveBeenCalledWith('barber-1');
  });

  it('confirms straight away when the barber waives the fee (clientSecret null)', async () => {
    mockApi.bookings.create.mockResolvedValue({ booking: { id: 'k1' }, clientSecret: null });
    await bookThroughSteps();

    await waitFor(() => expect(mockApi.bookings.create).toHaveBeenCalled());
    expect(mockApi.bookings.create).toHaveBeenCalledWith({
      barberId: 'barber-1',
      serviceId: 'service-1',
      startsAt: slot.startsAt,
      addonIds: [],
      notes: undefined,
    });
    expect(initPaymentSheet).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Booking Confirmed!', expect.any(String), expect.any(Array));
  });

  it('pays the booking fee in the PaymentSheet', async () => {
    mockApi.bookings.create.mockResolvedValue({ booking: { id: 'k1' }, clientSecret: 'pi_secret' });
    (initPaymentSheet as jest.Mock).mockResolvedValue({});
    (presentPaymentSheet as jest.Mock).mockResolvedValue({});
    await bookThroughSteps();

    await waitFor(() => expect(presentPaymentSheet).toHaveBeenCalled());
    expect(initPaymentSheet).toHaveBeenCalledWith(
      expect.objectContaining({ paymentIntentClientSecret: 'pi_secret', merchantDisplayName: 'Talii' })
    );
    expect(mockApi.bookings.cancel).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Payment Successful!', expect.any(String), expect.any(Array));
  });

  it('releases the hold when the PaymentSheet is cancelled', async () => {
    mockApi.bookings.create.mockResolvedValue({ booking: { id: 'k1' }, clientSecret: 'pi_secret' });
    (initPaymentSheet as jest.Mock).mockResolvedValue({});
    (presentPaymentSheet as jest.Mock).mockResolvedValue({ error: { code: 'Canceled', message: 'Canceled' } });
    mockApi.bookings.cancel.mockResolvedValue({ booking: {}, refund: null });
    await bookThroughSteps();

    await waitFor(() => expect(mockApi.bookings.cancel).toHaveBeenCalledWith('k1', 'Payment not completed'));
    expect(Alert.alert).toHaveBeenCalledWith('Payment Cancelled', expect.any(String));
    expect(props.onBookingCreated).not.toHaveBeenCalled();
  });

  it('shows the friendly message for SLOT_TAKEN', async () => {
    mockApi.bookings.create.mockRejectedValue(new ApiError(409, 'SLOT_TAKEN', 'Slot taken.'));
    await bookThroughSteps();

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Booking Failed', 'Someone just booked that time. Please pick another slot.')
    );
  });
});
