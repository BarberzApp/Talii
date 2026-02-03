import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import CalendarGrid from '@/pages/calendar/components/CalendarGrid';

jest.mock('twrnc', () => {
  const tw = () => ({});
  tw.style = jest.fn(() => ({}));
  return { __esModule: true, default: tw };
});

jest.mock('lucide-react-native', () => ({
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight',
}));

describe('CalendarGrid', () => {
  it('renders month header and handles navigation', () => {
    const onPrevMonth = jest.fn();
    const onNextMonth = jest.fn();
    const onGoToToday = jest.fn();
    const onDateSelect = jest.fn();
    const date = new Date('2024-01-15T12:00:00Z');

    const { getByText, getByTestId } = render(
      <CalendarGrid
        months={[
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ]}
        weekdays={['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']}
        currentDate={date}
        selectedDate={date}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
        onGoToToday={onGoToToday}
        onDateSelect={onDateSelect}
        getCalendarDays={() => [date]}
        getEventsForDate={() => []}
        hasPastEvents={() => false}
        hasUpcomingEvents={() => false}
        screenWidth={400}
      />
    );

    expect(getByText('January 2024')).toBeTruthy();

    fireEvent.press(getByTestId('prev-month-button'));
    fireEvent.press(getByTestId('next-month-button'));

    expect(onPrevMonth).toHaveBeenCalledTimes(1);
    expect(onNextMonth).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText('Today'));
    expect(onGoToToday).toHaveBeenCalledTimes(1);
  });
});
