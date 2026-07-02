import { createContext, useContext } from 'react';
import type { CalendarEvent } from '../../../../shared/lib/calendar';

export interface CalendarContextValue {
  // Selection State
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  selectedDate: Date | null;
  setSelectedDate: (date: Date | null) => void;
  viewMode: 'month';
  setViewMode: (mode: 'month') => void;
  nextMonth: () => void;
  prevMonth: () => void;
  goToToday: () => void;

  // Modal State
  showEventDialog: boolean;
  setShowEventDialog: (show: boolean) => void;
  selectedEvent: CalendarEvent | null;
  selectEvent: (event: CalendarEvent) => void;
  clearSelectedEvent: () => void;
  
  showManualAppointmentForm: boolean;
  setShowManualAppointmentForm: (show: boolean) => void;
  manualFormData: any;
  setManualFormData: (data: any) => void;
  openManualAppointmentForm: (date?: Date) => void;
  closeManualAppointmentForm: () => void;
  updateManualFormData: (updates: any) => void;

  showReviewForm: boolean;
  setShowReviewForm: (show: boolean) => void;
  reviewFormData: any;
  setReviewFormData: (data: any) => void;
  openReviewForm: (data: any) => void;
  closeReviewForm: () => void;
}

export const CalendarContext = createContext<CalendarContextValue | null>(null);

export function useCalendarContext() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendarContext must be used within a CalendarProvider');
  }
  return context;
}
