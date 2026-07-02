import { useState, useCallback } from 'react';
import type { CalendarEvent } from '../../../../shared/lib/calendar';

export interface ManualFormData {
  clientName: string;
  serviceId: string;
  price: string;
  time: string;
  date: Date;
}

export interface ReviewFormData {
  barberId: string;
  bookingId: string;
  isEditing?: boolean;
  reviewId?: string;
  initialRating?: number;
  initialComment?: string;
}

export function useCalendarModals() {
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  
  const [showManualAppointmentForm, setShowManualAppointmentForm] = useState(false);
  const [manualFormData, setManualFormData] = useState<ManualFormData>({
    clientName: '',
    serviceId: '',
    price: '',
    time: '',
    date: new Date()
  });

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewFormData, setReviewFormData] = useState<ReviewFormData | null>(null);

  const selectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowEventDialog(true);
  }, []);

  const clearSelectedEvent = useCallback(() => {
    setSelectedEvent(null);
    setShowEventDialog(false);
  }, []);

  const openManualAppointmentForm = useCallback((date?: Date) => {
    setManualFormData(prev => ({
      ...prev,
      date: date || prev.date || new Date()
    }));
    setShowManualAppointmentForm(true);
  }, []);

  const closeManualAppointmentForm = useCallback(() => {
    setShowManualAppointmentForm(false);
    setManualFormData(prev => ({
      ...prev,
      clientName: '',
      serviceId: '',
      price: '',
      time: ''
    }));
  }, []);

  const updateManualFormData = useCallback((updates: Partial<ManualFormData>) => {
    setManualFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const openReviewForm = useCallback((data: ReviewFormData) => {
    setReviewFormData(data);
    setShowReviewForm(true);
  }, []);

  const closeReviewForm = useCallback(() => {
    setShowReviewForm(false);
    setReviewFormData(null);
  }, []);

  return {
    showEventDialog,
    setShowEventDialog,
    selectedEvent,
    selectEvent,
    clearSelectedEvent,

    showManualAppointmentForm,
    setShowManualAppointmentForm,
    manualFormData,
    setManualFormData,
    updateManualFormData,
    openManualAppointmentForm,
    closeManualAppointmentForm,

    showReviewForm,
    setShowReviewForm,
    reviewFormData,
    setReviewFormData,
    openReviewForm,
    closeReviewForm
  };
}
