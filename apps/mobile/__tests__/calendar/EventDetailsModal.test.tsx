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
        paymentStatus: 'succeeded',
        source: 'app',
        serviceName: 'Haircut',
        clientName: 'Client Name',
        barberName: 'Barber Name',
        barberId: 'barber-123',
        timeZone: 'America/New_York',
        servicePriceCents: 4000,
        addonTotalCents: 500,
        bookingFeeCents: 340,
        addonNames: ['Beard'],
        notes: null,
      }
    };

    const { getByText, getAllByText } = render(
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
        formatDate={(date, tz) => `${date.toISOString()} ${tz}`}
        formatTime={(date, tz) => `${date.toISOString()} ${tz}`}
      />
    );

    expect(getAllByText('Booking Details').length).toBeGreaterThan(0);
    expect(getByText('Haircut')).toBeTruthy();
    // Money comes from the stored cents: service + add-ons + booking fee.
    expect(getByText('$48.40')).toBeTruthy();
    expect(getByText('$3.40')).toBeTruthy();

    fireEvent.press(getByText('Leave Review'));
    expect(onLeaveReview).toHaveBeenCalledTimes(1);
  });

  it('shows no-show and completion actions to the barber after the start, and cancel before it', () => {
    const base: CalendarEvent = {
      id: 'b1',
      title: 't',
      start: new Date(Date.now() - 3600_000).toISOString(),
      end: new Date().toISOString(),
      backgroundColor: '#000',
      borderColor: '#000',
      textColor: '#FFF',
      extendedProps: {
        status: 'confirmed',
        paymentStatus: 'succeeded',
        source: 'manual',
        serviceName: 'Cut',
        clientName: 'Walk-in',
        barberName: 'B',
        barberId: 'barber-1',
        timeZone: 'America/New_York',
        servicePriceCents: 3000,
        addonTotalCents: 0,
        bookingFeeCents: 0,
        addonNames: [],
        notes: null,
      },
    };
    const props = {
      visible: true,
      userRole: 'barber' as const,
      barberViewMode: 'appointments' as const,
      onClose: jest.fn(),
      onMarkCompleted: jest.fn(),
      onMarkMissed: jest.fn(),
      onCancelBooking: jest.fn(),
      onLeaveReview: jest.fn(),
      isMarkingCompleted: false,
      isMarkingMissed: false,
      formatDate: () => 'date',
      formatTime: () => 'time',
    };

    const started = render(<EventDetailsModal {...props} selectedEvent={base} />);
    fireEvent.press(started.getByText('Mark as No-Show'));
    expect(props.onMarkMissed).toHaveBeenCalled();
    expect(started.queryByText('Cancel Appointment')).toBeNull();
    started.unmount();

    const upcoming = render(
      <EventDetailsModal {...props} selectedEvent={{ ...base, start: new Date(Date.now() + 86_400_000).toISOString() }} />
    );
    expect(upcoming.queryByText('Mark as Completed')).toBeNull();
    fireEvent.press(upcoming.getByText('Cancel Appointment'));
    expect(props.onCancelBooking).toHaveBeenCalled();
  });
});
