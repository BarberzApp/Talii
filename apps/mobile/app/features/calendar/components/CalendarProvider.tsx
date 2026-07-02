import React, { ReactNode } from 'react';
import { CalendarContext } from '../context/CalendarContext';
import { useCalendarSelection } from '../hooks/useCalendarSelection';
import { useCalendarModals } from '../hooks/useCalendarModals';

export function CalendarProvider({ children }: { children: ReactNode }) {
  const selection = useCalendarSelection();
  const modals = useCalendarModals();

  const value = {
    ...selection,
    ...modals,
  };

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}
