import { useState, useCallback } from 'react';
import { addMonths, subMonths } from 'date-fns';

export function useCalendarSelection() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'month'>('month');

  const nextMonth = useCallback(() => {
    setCurrentDate(prev => addMonths(prev, 1));
  }, []);

  const prevMonth = useCallback(() => {
    setCurrentDate(prev => subMonths(prev, 1));
  }, []);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  return {
    currentDate,
    setCurrentDate,
    selectedDate,
    setSelectedDate,
    viewMode,
    setViewMode,
    nextMonth,
    prevMonth,
    goToToday,
  };
}
