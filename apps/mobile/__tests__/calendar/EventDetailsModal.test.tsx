import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import EventDetailsModal from '@/pages/calendar/components/EventDetailsModal';
import type { CalendarEvent } from '@/lib/calendar';

jest.mock('twrnc', () => {
  const tw = () => ({});
  tw.style = jest.fn(() => ({}));
  return { __esModule: true, default: tw };
});

jest.mock('lucide-react-native', () => ({
  Calendar: 'Calendar',
  Clock: 'Clock',
  X: 'X',
}));

describe('EventDetailsModal', () => {
  it('renders booking details and handles leave review', () => {
    const onLeaveReview = jest.fn();
    const event: CalendarEvent = {
      id: 'booking-123',
      title: 'Haircut with Barber',
      start: new Date('2024-12-15T10:00:00Z').toISOString(),
      end: new Date('2024-12-15T11:00:00Z').toISOString(),
      backgroundColor: '#000',
      borderColor: '#000',
      textColor: '#FFF',
      extendedProps: {
        status: 'completed',
        serviceName: 'Haircut',
        clientName: 'Client Name',
        barberName: 'Barber Name',
        barberId: 'barber-123',
        price: 45,
        basePrice: 40,
        addonTotal: 5,
        platformFee: 0,
        barberPayout: 45,
        totalCharged: 45,
        addonNames: [],
        isGuest: false,
        guestEmail: '',
        guestPhone: '',
      }
    };

    const { getByText } = render(
      <EventDetailsModal
        visible
        selectedEvent={event}
        userRole="client"
        barberViewMode="bookings"
        onClose={jest.fn()}
        onMarkCompleted={jest.fn()}
        onMarkMissed={jest.fn()}
        onCancelBooking={jest.fn()}
        onLeaveReview={onLeaveReview}
        isMarkingCompleted={false}
        isMarkingMissed={false}
        formatDate={(date) => date.toDateString()}
        formatTime={(date) => date.toTimeString()}
      />
    );

    expect(getByText('Booking Details')).toBeTruthy();
    expect(getByText('Haircut')).toBeTruthy();

    fireEvent.press(getByText('Leave Review'));
    expect(onLeaveReview).toHaveBeenCalledTimes(1);
  });
});
