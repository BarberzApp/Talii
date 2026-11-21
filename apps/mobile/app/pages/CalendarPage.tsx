import React, { useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator, Dimensions, Animated, Vibration, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import tw from 'twrnc';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import {
  ApiError,
  bookingErrorMessage,
  formatBookingTime,
  formatCents,
  formatInTimeZone,
  localDateInTimeZone,
  addDays as addCalendarDays,
} from '@barber-app/shared';
import { useAuth } from '../shared/hooks/useAuth';
import { useTheme } from '../shared/components/theme';
import Input from '../shared/components/ui/Input';
import { logger } from '../shared/lib/logger';
import { ReviewForm } from '../shared/components/ReviewForm';
import { AnimatedPressable } from '../shared/components/ui/AnimatedPressable';
import { useCalendarData } from '../shared/hooks/useCalendarData';
import { useCalendarState } from '../shared/hooks/useCalendarState';
import {
  dateFromDayKey,
  dayKey,
  formatTimeSlot,
  getEventsForDate as eventsOnDay,
} from '../shared/lib/calendar/calendarUtils';
import type { CalendarEvent } from '../shared/lib/calendar';
import CalendarGrid from './calendar/components/CalendarGrid';
import TodayAgenda from './calendar/components/TodayAgenda';
import EventsPanel from './calendar/components/EventsPanel';
import EventDetailsModal from './calendar/components/EventDetailsModal';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function CalendarPage() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const calendarState = useCalendarState();
  const calendarData = useCalendarData(calendarState, user?.id);

  const {
    currentDate,
    setCurrentDate,
    selectedDate,
    setSelectedDate,
    events,
    filterStatus,
    selectedEvent,
    selectEvent,
    showEventDialog,
    showManualAppointmentForm,
    isMarkingMissed,
    isMarkingCompleted,
    loading,
    refreshing,
    userRole,
    barberViewMode,
    manualFormData,
    services,
    barberId,
    barberTimeZone,
    isSubmitting,
    timeSlots,
    loadingTimeSlots,
    loadError,
    reviewFormData,
    setShowEventDialog,
    setShowManualAppointmentForm,
    setIsMarkingMissed,
    setIsMarkingCompleted,
    setBarberViewMode,
    setManualFormData,
    setIsSubmitting,
    setShowReviewForm,
    setReviewFormData,
  } = calendarState;

  const { loadBookings, refresh, initialize } = calendarData;
  const manualFormScrollRef = useRef<ScrollView>(null);
  // Barbers land on today's agenda; the month grid is one tap away.
  const [showMonth, setShowMonth] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // initialize() changes identity whenever loadBookings does (role, month, zone);
  // run it once per signed-in user, not on every change.
  const initializeRef = useRef(initialize);
  initializeRef.current = initialize;

  useEffect(() => {
    if (!user) return;
    
    initializeRef.current();
    
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: false,
          }),
        ])
      ),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- it reloads only when the listed keys change; the callback reads the current render
  }, [user?.id]);

  // Fetch services when manual appointment modal opens
  useEffect(() => {
    if (showManualAppointmentForm) {
      fetchServices();
      // Default the walk-in to the selected grid day, else today on the barber's calendar.
      setManualFormData(prev => ({ ...prev, date: selectedDate || barberDay(0), startsAt: '' }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- it reloads only when the listed keys change; the callback reads the current render
  }, [showManualAppointmentForm]);

  // Fetch time slots when date or service changes
  useEffect(() => {
    if (showManualAppointmentForm && manualFormData.date && manualFormData.serviceId && barberId) {
      fetchTimeSlots();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- it reloads only when the listed keys change; the callback reads the current render
  }, [showManualAppointmentForm, manualFormData.date, manualFormData.serviceId, barberId]);

  // Auto-scroll to time section when time slots are loaded
  useEffect(() => {
    if (!loadingTimeSlots && timeSlots.length > 0 && manualFormScrollRef.current) {
      // Small delay to ensure layout is complete, then scroll to end to show time slots
      setTimeout(() => {
        manualFormScrollRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }
  }, [loadingTimeSlots, timeSlots.length]);

  // formatTimeSlot now imported from calendarUtils

  const fetchTimeSlots = async () => {
    if (!manualFormData.date || !manualFormData.serviceId || !barberId) {
      return;
    }

    const selectedService = services.find(s => s.id === manualFormData.serviceId);
    if (!selectedService) return;

    // Walk-in times are in the barber's time zone.
    const timeZone = barberTimeZone || 'America/New_York';
    await calendarData.loadTimeSlots(
      dayKey(manualFormData.date),
      selectedService.duration_minutes,
      timeZone
    );
  };

  // Always call the newest loadBookings (it closes over the visible month and time zone).
  const loadRef = useRef(loadBookings);
  loadRef.current = loadBookings;
  const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;

  // Reload when the visible month (or the barber's time zone) changes; the first
  // month is loaded by initialize().
  const firstMonthLoad = useRef(true);
  useEffect(() => {
    if (firstMonthLoad.current) {
      firstMonthLoad.current = false;
      return;
    }
    if (user && userRole) loadRef.current();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- it reloads only when the listed keys change; the callback reads the current render
  }, [monthKey, barberTimeZone]);

  // Refresh calendar data when the page comes back into focus.
  useFocusEffect(
    React.useCallback(() => {
      if (user && userRole) loadRef.current(userRole);
    }, [user, userRole])
  );

  const handleBarberViewToggle = async (mode: 'appointments' | 'bookings') => {
    setBarberViewMode(mode);
    Vibration.vibrate(30); // Light haptic feedback
    await loadBookings(userRole || undefined, mode);
  };

  const onRefresh = async () => {
    Vibration.vibrate(50); // Light haptic feedback
    await refresh();
  };

  const getCalendarDays = () => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  };

  // Events are grouped by their day in the barber's time zone, matching the times shown.
  const getEventsForDate = (date: Date) => {
    const filtered = filterStatus === 'all'
      ? events
      : events.filter(event => event.extendedProps.status === filterStatus);
    return eventsOnDay(filtered, date);
  };

  const hasPastEvents = (date: Date) => {
    const dateEvents = getEventsForDate(date);
    return dateEvents.some(event => {
      const eventDate = new Date(event.start);
      return eventDate < new Date() && event.extendedProps.status !== 'completed';
    });
  };

  const hasUpcomingEvents = (date: Date) => {
    const dateEvents = getEventsForDate(date);
    return dateEvents.some(event => {
      const eventDate = new Date(event.start);
      return eventDate >= new Date();
    });
  };

  const prevMonth = () => {
    Vibration.vibrate(30); // Light haptic feedback
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const nextMonth = () => {
    Vibration.vibrate(30); // Light haptic feedback
    setCurrentDate(prev => addMonths(prev, 1));
  };

  const showTodayAgenda = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
    setShowMonth(false);
  };

  const goToToday = () => {
    Vibration.vibrate(50); // Medium haptic feedback
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const handleDateClick = (date: Date) => {
    Vibration.vibrate(20); // Light haptic feedback
    setSelectedDate(date);
  };

  const handleEventClick = (event: CalendarEvent) => {
    Vibration.vibrate(30); // Light haptic feedback
    selectEvent(event);
  };

  const handleMarkAsMissed = async () => {
    if (!selectedEvent) return;

    setIsMarkingMissed(true);
    try {
      const result = await calendarData.markMissed(selectedEvent.id);
      if (!result.ok) throw new Error(result.message);

      Vibration.vibrate(100); // Success haptic feedback
      const itemTypeCapitalized = userRole === 'barber' && barberViewMode === 'appointments' ? 'Appointment' : 'Booking';
      Alert.alert('Success', `${itemTypeCapitalized} marked as a no-show`);
      setShowEventDialog(false);
    } catch (error) {
      logger.error('Error marking as missed:', error);
      Vibration.vibrate([100, 100]); // Error haptic feedback
      const itemType = userRole === 'barber' && barberViewMode === 'appointments' ? 'appointment' : 'booking';
      Alert.alert('Error', error instanceof Error && error.message ? error.message : `Failed to mark ${itemType} as a no-show`);
    } finally {
      setIsMarkingMissed(false);
    }
  };

  const handleMarkAsCompleted = async () => {
    if (!selectedEvent) return;

    setIsMarkingCompleted(true);
    try {
      const result = await calendarData.markCompleted(selectedEvent.id);
      if (!result.ok) throw new Error(result.message);

      Vibration.vibrate(100); // Success haptic feedback
      const itemTypeCapitalized = userRole === 'barber' && barberViewMode === 'appointments' ? 'Appointment' : 'Booking';
      Alert.alert('Success', `${itemTypeCapitalized} marked as completed`);
      setShowEventDialog(false);
    } catch (error) {
      logger.error('Error marking as completed:', error);
      Vibration.vibrate([100, 100]); // Error haptic feedback
      const itemType = userRole === 'barber' && barberViewMode === 'appointments' ? 'appointment' : 'booking';
      Alert.alert('Error', error instanceof Error && error.message ? error.message : `Failed to mark ${itemType} as completed`);
    } finally {
      setIsMarkingCompleted(false);
    }
  };

  const handleLeaveReview = async () => {
    if (!selectedEvent) return;
    
    // Barbers can only leave reviews in "My Bookings" tab (when they're the client)
    // They cannot leave reviews in "My Appointments" tab (when they're the service provider)
    if (userRole === 'barber' && barberViewMode === 'appointments') {
      Alert.alert('Info', 'You can only leave reviews for bookings where you are the client (My Bookings tab)');
      return;
    }

    setReviewFormData({
      barberId: selectedEvent.extendedProps.barberId,
      bookingId: selectedEvent.id,
      isEditing: false
    });
    setShowReviewForm(true);
    setShowEventDialog(false);
  };

  const handleCancelBooking = async () => {
    if (!selectedEvent) return;

    // Determine if this is an appointment or booking based on view mode
    const isAppointment = userRole === 'barber' && barberViewMode === 'appointments';
    const itemType = isAppointment ? 'appointment' : 'booking';
    const itemTypeCapitalized = isAppointment ? 'Appointment' : 'Booking';

    // Show confirmation dialog
    Alert.alert(
      `Cancel ${itemTypeCapitalized}`,
      isAppointment
        ? `Are you sure you want to cancel this ${itemType}? The client's booking fee is refunded in full.`
        : `Are you sure you want to cancel this ${itemType}? The booking fee is refunded only when you cancel more than 24 hours before the start.`,
      [
        {
          text: `Keep ${itemTypeCapitalized}`,
          style: 'cancel'
        },
        {
          text: `Cancel ${itemTypeCapitalized}`,
          style: 'destructive',
          onPress: async () => {
            const result = await calendarData.cancelBooking(selectedEvent.id);
            if (!result.ok) {
              Vibration.vibrate([100, 100]); // Error haptic feedback
              Alert.alert('Error', bookingErrorMessage(new ApiError(0, result.code, result.message), `Failed to cancel ${itemType}. Please try again.`));
              return;
            }
            Vibration.vibrate(100); // Success haptic feedback
            Alert.alert(
              'Success',
              result.refundCents
                ? `${itemTypeCapitalized} cancelled. ${formatCents(result.refundCents)} will be refunded.`
                : `${itemTypeCapitalized} cancelled successfully`
            );
            setShowEventDialog(false);
          }
        }
      ]
    );
  };

  // Booking times are shown in the barber's time zone.
  const formatTime = (date: Date, timeZone: string) => formatBookingTime(date, timeZone);

  const formatDate = (date: Date, timeZone: string) =>
    formatInTimeZone(date, timeZone, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Fetch services for manual appointment form
  const fetchServices = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    if (!barberId) {
      Alert.alert(
        'Profile Setup Required',
        'You need to complete your barber profile setup first. Please go to Settings to set up your profile.',
        [{ text: 'OK', onPress: () => setShowManualAppointmentForm(false) }]
      );
      return;
    }

    const servicesData = await calendarData.loadServices();
    if (servicesData.length === 0) {
      Alert.alert(
        'No Services Found',
        'You need to add services to your profile before creating manual appointments. Please go to Settings to add your services.',
        [{ text: 'OK', onPress: () => setShowManualAppointmentForm(false) }]
      );
    }
  };

  // Handle manual appointment form submission
  const handleManualAppointmentSubmit = async () => {
    if (!manualFormData.clientName || !manualFormData.serviceId || !manualFormData.startsAt) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await calendarData.createAppointment({
        customerName: manualFormData.clientName,
        serviceId: manualFormData.serviceId,
        startsAt: manualFormData.startsAt,
      });

      if (!result.ok) {
        if (result.code === 'SLOT_TAKEN') {
          Alert.alert('Time Conflict', 'This time overlaps an existing booking.');
          fetchTimeSlots();
        } else {
          Alert.alert('Error', result.message || 'Failed to create appointment');
        }
        return;
      }

      Alert.alert('Success', 'Manual appointment created successfully');
      setShowManualAppointmentForm(false);
      setManualFormData({
        clientName: '',
        serviceId: '',
        price: '',
        startsAt: '',
        date: selectedDate || barberDay(0)
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update form data when service is selected
  const handleServiceSelect = (serviceId: string) => {
    const selectedService = services.find(s => s.id === serviceId);
    setManualFormData(prev => ({
      ...prev,
      serviceId,
      price: selectedService ? formatCents(selectedService.price_cents) : '',
      startsAt: ''
    }));
  };

  /** Today (+ offset days) on the barber's calendar, as a grid/picker date. */
  const barberDay = (offset: number) =>
    dateFromDayKey(addCalendarDays(localDateInTimeZone(new Date(), barberTimeZone || 'America/New_York'), offset));

  const handleDateSelect = (date: Date) => {
    setManualFormData(prev => ({
      ...prev,
      date: date,
      startsAt: '' // Clear time when date changes
    }));
  };

  const showAgenda = userRole === 'barber' && !showMonth;
  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  if (loading) {
    return (
      <SafeAreaView style={[tw`flex-1`, { backgroundColor: colors.background }]}>
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[tw`mt-4 text-lg`, { color: colors.foreground }]}>
            Loading Calendar...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: colors.background }]}>
      <Animated.View 
        style={[
          tw`flex-1`,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }
        ]}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.backdrop}
            />
          }
        >
        {/* Title */}
        <View style={tw`px-4 pt-4 pb-2`}>
          <Text style={[tw`text-2xl font-bold mb-4`, { color: colors.foreground }]}>
            Calendar
          </Text>
          
          {/* Barber View Toggle */}
          {userRole === 'barber' && (
            <View style={[tw`flex-row mb-4 p-1 rounded-xl`, { 
              backgroundColor: colors.glass,
              borderWidth: 1,
              borderColor: colors.glassBorder
            }]}>
              <AnimatedPressable
                onPress={() => handleBarberViewToggle('appointments')}
                style={[
                  tw`flex-1 py-3 px-4 rounded-lg items-center`,
                  barberViewMode === 'appointments' 
                    ? { 
                        backgroundColor: colors.primary,
                        shadowColor: colors.primary,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        elevation: 4
                      }
                    : { backgroundColor: 'transparent' }
                ]}
              >
                <Text style={[
                  tw`font-semibold text-sm`,
                  barberViewMode === 'appointments' 
                    ? { color: colors.primaryForeground }
                    : { color: colors.mutedForeground }
                ]}>
                  My Appointments
                </Text>
                <Text style={[
                  tw`text-xs mt-1`,
                  barberViewMode === 'appointments' 
                    ? { color: colors.primaryForeground }
                    : { color: colors.mutedForeground }
                ]}>
                  Clients Coming In
                </Text>
              </AnimatedPressable>
              
              <AnimatedPressable
                onPress={() => handleBarberViewToggle('bookings')}
                style={[
                  tw`flex-1 py-3 px-4 rounded-lg items-center`,
                  barberViewMode === 'bookings' 
                    ? { 
                        backgroundColor: colors.primary,
                        shadowColor: colors.primary,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        elevation: 4
                      }
                    : { backgroundColor: 'transparent' }
                ]}
              >
                <Text style={[
                  tw`font-semibold text-sm`,
                  barberViewMode === 'bookings' 
                    ? { color: colors.primaryForeground }
                    : { color: colors.mutedForeground }
                ]}>
                  My Bookings
                </Text>
                <Text style={[
                  tw`text-xs mt-1`,
                  barberViewMode === 'bookings' 
                    ? { color: colors.primaryForeground }
                    : { color: colors.mutedForeground }
                ]}>
                  Going Somewhere
                </Text>
              </AnimatedPressable>
            </View>
          )}
        </View>

          {/* Load error: keep what was shown and offer a retry instead of an empty month */}
          {loadError && (
            <View
              testID="calendar-load-error"
              style={[tw`mx-5 mb-4 p-4 rounded-2xl`, { backgroundColor: colors.destructiveSubtle, borderWidth: 1, borderColor: colors.destructive }]}
            >
              <Text style={[tw`text-sm mb-2`, { color: colors.destructive }]}>{loadError}</Text>
              <TouchableOpacity onPress={() => refresh()} accessibilityRole="button">
                <Text style={[tw`font-semibold`, { color: colors.destructive }]}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}

          {showAgenda && (
            <TodayAgenda
              events={getEventsForDate(barberDay(0))}
              timeZone={barberTimeZone || 'America/New_York'}
              onEventClick={handleEventClick}
              onShowMonth={() => setShowMonth(true)}
            />
          )}

          {userRole === 'barber' && showMonth && (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={showTodayAgenda}
              style={[tw`mx-5 mb-4 py-3 rounded-full items-center`, { backgroundColor: `${colors.primary}20`, borderWidth: 1, borderColor: `${colors.primary}30` }]}
            >
              <Text style={[tw`font-semibold`, { color: colors.primary }]}>Back to today</Text>
            </TouchableOpacity>
          )}

          {/* Single Main Calendar Container - Enhanced with glow */}
          {!showAgenda && (
          <Animated.View 
            style={[
              tw`mx-5 mb-6 p-6 rounded-3xl`,
              { 
                backgroundColor: colors.glass,
                borderWidth: 1,
                borderColor: colors.glassBorder,
                              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 15 },
              shadowOpacity: 0.2,
              shadowRadius: 30,
                elevation: 15
              }
            ]}
            >
            <CalendarGrid
              months={months}
              weekdays={weekdays}
              currentDate={currentDate}
              selectedDate={selectedDate}
              onPrevMonth={prevMonth}
              onNextMonth={nextMonth}
              onGoToToday={goToToday}
              onDateSelect={handleDateClick}
              getCalendarDays={getCalendarDays}
              getEventsForDate={getEventsForDate}
              hasPastEvents={hasPastEvents}
              hasUpcomingEvents={hasUpcomingEvents}
              screenWidth={screenWidth}
            />

            {/* Manual Appointment Button - Only for Barbers in Appointments Mode */}
            {/* TODO: Re-enable manual appointment feature later */}
            {/* {userRole === 'barber' && barberViewMode === 'appointments' && (
              <View style={[tw`mt-4 p-4 rounded-2xl`, {
                backgroundColor: `${colors.primary}10`,
                borderWidth: 1,
                borderColor: `${colors.primary}20`
              }]}>
                <View style={tw`items-center mb-3`}>
                  <Text style={[tw`font-semibold text-sm mb-1`, { color: colors.foreground }]}>
                    Quick Add Appointment
                  </Text>
                  <Text style={[tw`text-xs`, { color: colors.mutedForeground }]}>
                    For walk-ins, phone bookings, or admin purposes
                  </Text>
        </View>
                <TouchableOpacity
                  onPress={() => setShowManualAppointmentForm(true)}
                  style={[tw`py-3 rounded-xl items-center flex-row justify-center`, {
                    backgroundColor: colors.primary,
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    elevation: 4
                  }]}
                >
                  <Plus size={16} color={colors.primaryForeground} style={tw`mr-2`} />
                  <Text style={[tw`font-semibold`, { color: colors.primaryForeground }]}>
                    Add Manual Appointment
                  </Text>
                </TouchableOpacity>
              </View>
            )} */}

            {/* Events Panel - Enhanced */}
            <EventsPanel
              selectedDate={selectedDate}
              eventsForSelectedDate={selectedDateEvents}
              userRole={userRole}
              barberViewMode={barberViewMode}
              onEventClick={handleEventClick}
              formatTime={formatTime}
            />
          </Animated.View>
          )}
      </ScrollView>
      </Animated.View>

      <EventDetailsModal
        visible={showEventDialog}
        selectedEvent={selectedEvent}
        userRole={userRole}
        barberViewMode={barberViewMode}
        onClose={() => setShowEventDialog(false)}
        onMarkCompleted={handleMarkAsCompleted}
        onMarkMissed={handleMarkAsMissed}
        onCancelBooking={handleCancelBooking}
        onLeaveReview={handleLeaveReview}
        isMarkingCompleted={isMarkingCompleted}
        isMarkingMissed={isMarkingMissed}
        formatDate={formatDate}
        formatTime={formatTime}
      />

      {/* Manual Appointment Form Modal */}
      {/* TODO: Re-enable manual appointment feature later */}
      {false && (
      <Modal
        visible={showManualAppointmentForm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowManualAppointmentForm(false)}
      >
        <View style={[tw`flex-1 justify-end`, { backgroundColor: colors.backdrop }]}>
          <View style={[tw`rounded-t-3xl`, { 
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderColor: colors.glassBorder,
            maxHeight: screenHeight * 0.9, // Limit modal height to 90% of screen
          }]}>
            {/* Fixed Header */}
            <View style={[tw`flex-row items-center justify-between p-6 pb-4 border-b`, { borderColor: colors.glassBorder }]}>
              <Text style={[tw`text-xl font-bold`, { color: colors.foreground }]}>
                Add Manual Appointment
              </Text>
              <TouchableOpacity onPress={() => setShowManualAppointmentForm(false)}>
                <X size={24} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Scrollable Content */}
            <ScrollView 
              ref={manualFormScrollRef}
              style={tw`flex-1`}
              contentContainerStyle={tw`p-6 pt-4 pb-8`}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              <View style={tw`space-y-4`}>
              <Input
                label="Client Name *"
                placeholder="Enter client name"
                value={manualFormData.clientName}
                onChangeText={(text) => setManualFormData(prev => ({ ...prev, clientName: text }))}
              />

              <View>
                <Text style={[tw`text-sm font-medium mb-2`, { color: colors.foreground }]}>
                  Service *
                </Text>
                {services.length > 0 ? (
                  <ScrollView style={{ maxHeight: 120 }}>
                    {services.map((service) => (
                      <TouchableOpacity
                        key={service.id}
                        onPress={() => handleServiceSelect(service.id)}
                        style={[
                          tw`p-3 rounded-xl border mb-2`,
                          {
                            backgroundColor: manualFormData.serviceId === service.id 
                              ? `${colors.primary}15` 
                              : colors.glass,
                            borderColor: manualFormData.serviceId === service.id 
                              ? colors.primary 
                              : colors.glassBorder,
                            borderWidth: manualFormData.serviceId === service.id ? 2 : 1,
                            shadowColor: manualFormData.serviceId === service.id ? colors.primary : 'transparent',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: manualFormData.serviceId === service.id ? 0.2 : 0,
                            shadowRadius: 4,
                            elevation: manualFormData.serviceId === service.id ? 2 : 0
                          }
                        ]}
                      >
                        <View style={tw`flex-row justify-between items-center`}>
                          <Text style={[tw`font-medium`, { color: colors.foreground }]}>
                            {service.name}
                          </Text>
                          <Text style={[tw`font-semibold`, { color: colors.primary }]}>
                            {formatCents(service.price_cents)}
                          </Text>
                        </View>
                        <Text style={[tw`text-xs`, { color: colors.mutedForeground }]}>
                          {service.duration_minutes} minutes
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={[tw`p-4 rounded-xl border items-center`, {
                    backgroundColor: colors.glass,
                    borderColor: colors.glassBorder,
                  }]}>
                    <Text style={[tw`text-center`, { color: colors.mutedForeground }]}>
                      No services available. Please add services in your profile settings.
                    </Text>
                  </View>
                )}
              </View>

              <Input
                label="Price"
                placeholder="Auto-filled from service"
                value={manualFormData.price}
                editable={false}
              />

              <View>
                <Text style={[tw`text-sm font-medium mb-2`, { color: colors.foreground }]}>
                  Date *
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    logger.log('Date picker button pressed, showing simple alert');
                    Alert.alert(
                      'Select Date',
                      'Choose a date for the appointment',
                      [
                        {
                          text: 'Today',
                          onPress: () => {
                            logger.log('Selected Today');
                            handleDateSelect(barberDay(0));
                          }
                        },
                        {
                          text: 'Tomorrow',
                          onPress: () => {
                            logger.log('Selected Tomorrow');
                            handleDateSelect(barberDay(1));
                          }
                        },
                        {
                          text: 'Next Week',
                          onPress: () => {
                            logger.log('Selected Next Week');
                            handleDateSelect(barberDay(7));
                          }
                        },
                        {
                          text: 'Cancel',
                          style: 'cancel',
                          onPress: () => logger.log('Cancelled date selection')
                        }
                      ]
                    );
                  }}
                  style={[tw`p-3 rounded-xl border`, {
                    backgroundColor: colors.glass,
                    borderColor: colors.glassBorder,
                  }]}
                >
                  <Text style={[tw`text-center`, { color: colors.foreground }]}>
                    {manualFormData.date ? format(manualFormData.date, 'MMM dd, yyyy') : 'Select Date'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View>
                <Text style={[tw`text-sm font-medium mb-2`, { color: colors.foreground }]}>
                  Time *
                </Text>
                {manualFormData.date && (
                  <View>
                    {loadingTimeSlots ? (
                      <View style={tw`items-center py-8`}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[tw`mt-2`, { color: colors.mutedForeground }]}>Loading times...</Text>
                      </View>
                    ) : timeSlots.filter(slot => slot.available).length === 0 ? (
                      <View style={[tw`p-4 rounded-xl border items-center`, {
                        backgroundColor: colors.glass,
                        borderColor: colors.glassBorder,
                      }]}>
                        <Text style={[tw`text-center`, { color: colors.mutedForeground }]}>
                          No available time slots for this date
                        </Text>
                      </View>
                    ) : (
                      <View style={tw`flex-row flex-wrap -mx-1`}>
                        {timeSlots
                          .filter(slot => slot.available)
                          .map((slot) => (
                            <TouchableOpacity
                              key={slot.startsAt}
                              onPress={() => setManualFormData(prev => ({ ...prev, startsAt: slot.startsAt }))}
                              style={tw`w-1/3 px-1 mb-2`}
                              disabled={isSubmitting}
                            >
                              <View style={[
                                tw`rounded-lg py-3 items-center`,
                                manualFormData.startsAt === slot.startsAt
                                  ? { backgroundColor: colors.primary }
                                  : { backgroundColor: colors.glass }
                              ]}>
                                <Text style={[
                                  tw`text-sm font-medium`,
                                  manualFormData.startsAt === slot.startsAt
                                    ? { color: colors.background }
                                    : { color: colors.foreground }
                                ]}>
                                  {formatTimeSlot(slot.time)}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
              </View>
            </ScrollView>

            {/* Fixed Footer with Buttons */}
            <View style={[tw`flex-row gap-3 p-6 pt-4 border-t`, {
              backgroundColor: colors.background,
              borderColor: colors.glassBorder,
            }]}>
            <TouchableOpacity
              onPress={() => setShowManualAppointmentForm(false)}
                style={[tw`flex-1 py-3 rounded-xl items-center`, {
                  backgroundColor: colors.glass,
                  borderWidth: 1,
                  borderColor: colors.glassBorder
                }]}
              >
                <Text style={[tw`font-semibold`, { color: colors.foreground }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleManualAppointmentSubmit}
                disabled={isSubmitting}
                style={[
                  tw`flex-1 py-3 rounded-xl items-center`, 
                  { 
                    backgroundColor: isSubmitting ? colors.glassBorder : colors.primary,
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4,
                    elevation: 4
                  }
                ]}
            >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.primaryForeground} size="small" />
                ) : (
              <Text style={[tw`font-semibold`, { color: colors.primaryForeground }]}>
                    Add Appointment
              </Text>
                )}
            </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      )}



      {/* Review Form Modal */}
      {reviewFormData && (
        <ReviewForm
          barberId={reviewFormData.barberId}
          bookingId={reviewFormData.bookingId}
          onClose={() => {
            setReviewFormData(null);
            setShowReviewForm(false);
          }}
          onSuccess={() => {
            setReviewFormData(null);
            setShowReviewForm(false);
            // Refresh events if needed
            loadBookings();
          }}
          isEditing={reviewFormData.isEditing}
          reviewId={reviewFormData.reviewId}
          initialRating={reviewFormData.initialRating}
          initialComment={reviewFormData.initialComment}
        />
      )}
    </SafeAreaView>
  );
} 