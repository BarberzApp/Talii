import React, { useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Modal, 
  Alert,
  ActivityIndicator,
  Dimensions,
  Animated,
  Vibration,
  TextInput,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  User, 
  DollarSign,
  X,
  Plus,
  RefreshCw,
  Filter,
  Search
} from 'lucide-react-native';
import tw from 'twrnc';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { supabase } from '../shared/lib/supabase';
import { useAuth } from '../shared/hooks/useAuth';
import { useTheme } from '../shared/components/theme';
import Input from '../shared/components/ui/Input';
import { logger } from '../shared/lib/logger';
import { ReviewForm } from '../shared/components/ReviewForm';
import { useCalendarData } from '../shared/hooks/useCalendarData';
import { useCalendarState } from '../shared/hooks/useCalendarState';
import { formatTimeSlot } from '../shared/lib/calendar/calendarUtils';
import type { CalendarEvent } from '../shared/lib/calendar';
import CalendarGrid from './calendar/components/CalendarGrid';
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
    isSubmitting,
    timeSlots,
    loadingTimeSlots,
    reviewFormData,
    setShowEventDialog,
    setShowManualAppointmentForm,
    setIsMarkingMissed,
    setIsMarkingCompleted,
    setBarberViewMode,
    setManualFormData,
    setServices,
    setBarberId,
    setIsSubmitting,
    setTimeSlots,
    setShowReviewForm,
    setReviewFormData,
  } = calendarState;

  const { loadBookings, refresh, initialize } = calendarData;
  const manualFormScrollRef = useRef<ScrollView>(null);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  useEffect(() => {
    if (!user) return;
    
    initialize();
    
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
  }, [user?.id, initialize]);

  // Fetch services when manual appointment modal opens
  useEffect(() => {
    if (showManualAppointmentForm) {
      fetchServices();
    }
  }, [showManualAppointmentForm]);

  // Fetch time slots when date or service changes
  useEffect(() => {
    if (showManualAppointmentForm && manualFormData.date && manualFormData.serviceId && barberId) {
      fetchTimeSlots();
    }
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

    try {
      const selectedService = services.find(s => s.id === manualFormData.serviceId);
      if (!selectedService) return;

      await calendarData.loadTimeSlots(barberId, manualFormData.date, selectedService.duration);
    } catch (error) {
      logger.error('Error fetching time slots:', error);
      setTimeSlots([]);
    }
  };

  // Refresh calendar data when page comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user && userRole) {
        logger.log('🔄 [CALENDAR] Page focused - refreshing data...');
        loadBookings(userRole);
      }
    }, [user, userRole, loadBookings])
  );


  const handleBarberViewToggle = async (mode: 'appointments' | 'bookings') => {
    setBarberViewMode(mode);
    Vibration.vibrate(30); // Light haptic feedback
    await loadBookings(userRole || undefined);
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

  const getEventsForDate = (date: Date) => {
    let filteredEvents = events;
    
    // Apply status filter
    if (filterStatus !== 'all') {
      filteredEvents = events.filter(event => event.extendedProps.status === filterStatus);
    }
    
    return filteredEvents.filter(event => {
      const eventDate = new Date(event.start);
      return isSameDay(eventDate, date);
    });
  };

  const hasEvents = (date: Date) => {
    return getEventsForDate(date).length > 0;
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
      const success = await calendarData.markMissed(selectedEvent.id);
      if (!success) throw new Error('Failed to mark as missed');

      Vibration.vibrate(100); // Success haptic feedback
      const itemType = userRole === 'barber' && barberViewMode === 'appointments' ? 'appointment' : 'booking';
      const itemTypeCapitalized = userRole === 'barber' && barberViewMode === 'appointments' ? 'Appointment' : 'Booking';
      Alert.alert('Success', `${itemTypeCapitalized} marked as missed`);
      setShowEventDialog(false);
    } catch (error) {
      logger.error('Error marking as missed:', error);
      Vibration.vibrate([100, 100]); // Error haptic feedback
      const itemType = userRole === 'barber' && barberViewMode === 'appointments' ? 'appointment' : 'booking';
      const itemTypeCapitalized = userRole === 'barber' && barberViewMode === 'appointments' ? 'Appointment' : 'Booking';
      Alert.alert('Error', `Failed to mark ${itemType} as missed`);
    } finally {
      setIsMarkingMissed(false);
    }
  };

  const handleMarkAsCompleted = async () => {
    if (!selectedEvent) return;

    setIsMarkingCompleted(true);
    try {
      const success = await calendarData.markCompleted(selectedEvent.id);
      if (!success) throw new Error('Failed to mark as completed');

      Vibration.vibrate(100); // Success haptic feedback
      const itemType = userRole === 'barber' && barberViewMode === 'appointments' ? 'appointment' : 'booking';
      const itemTypeCapitalized = userRole === 'barber' && barberViewMode === 'appointments' ? 'Appointment' : 'Booking';
      Alert.alert('Success', `${itemTypeCapitalized} marked as completed`);
      setShowEventDialog(false);
    } catch (error) {
      logger.error('Error marking as completed:', error);
      Vibration.vibrate([100, 100]); // Error haptic feedback
      const itemType = userRole === 'barber' && barberViewMode === 'appointments' ? 'appointment' : 'booking';
      const itemTypeCapitalized = userRole === 'barber' && barberViewMode === 'appointments' ? 'Appointment' : 'Booking';
      Alert.alert('Error', `Failed to mark ${itemType} as completed`);
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
      `Are you sure you want to cancel this ${itemType}? This action cannot be undone.`,
      [
        {
          text: `Keep ${itemTypeCapitalized}`,
          style: 'cancel'
        },
        {
          text: `Cancel ${itemTypeCapitalized}`,
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await calendarData.cancelBooking(selectedEvent.id);
              if (!success) {
                throw new Error('Failed to cancel booking');
              }
              Vibration.vibrate(100); // Success haptic feedback
              Alert.alert('Success', `${itemTypeCapitalized} cancelled successfully`);
              setShowEventDialog(false);
            } catch (error) {
              logger.error(`Error cancelling ${itemType}:`, error);
              Vibration.vibrate([100, 100]); // Error haptic feedback
              Alert.alert('Error', `Failed to cancel ${itemType}. Please try again.`);
            }
          }
        }
      ]
    );
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getGlowOpacity = () => {
    return glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0.8],
    });
  };

  // Fetch services for manual appointment form
  const fetchServices = async () => {
    try {
      // First check if user exists
      if (!user?.id) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      // Check if barber profile exists
      const { data: barberData, error: barberError } = await supabase
        .from('barbers')
        .select('id, onboarding_complete')
        .eq('user_id', user?.id)
        .single();

      if (barberError) {
        logger.error('Barber not found:', barberError);
        Alert.alert(
          'Profile Setup Required', 
          'You need to complete your barber profile setup first. Please go to Settings to set up your profile.',
          [{ text: 'OK', onPress: () => setShowManualAppointmentForm(false) }]
        );
        return;
      }

      // Check if onboarding is complete
      if (!barberData.onboarding_complete) {
        Alert.alert(
          'Profile Setup Incomplete', 
          'Please complete your profile setup before creating appointments.',
          [{ text: 'OK', onPress: () => setShowManualAppointmentForm(false) }]
        );
        return;
      }

      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('id, name, price, duration')
        .eq('barber_id', barberData.id)
        .order('name');

      if (servicesError) {
        logger.error('Error fetching services:', servicesError);
        setServices([]);
        return;
      }

      setServices(servicesData || []);
      setBarberId(barberData.id);
      
      if (!servicesData || servicesData.length === 0) {
        Alert.alert(
          'No Services Found', 
          'You need to add services to your profile before creating manual appointments. Please go to Settings to add your services.',
          [
            { text: 'OK', onPress: () => setShowManualAppointmentForm(false) }
          ]
        );
      }
    } catch (error) {
      logger.error('Error fetching services:', error);
      setServices([]);
    }
  };

  // Handle manual appointment form submission
  const handleManualAppointmentSubmit = async () => {
    if (!manualFormData.clientName || !manualFormData.serviceId || !manualFormData.time) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!barberId) {
        throw new Error('Barber ID not found');
      }

      const selectedService = services.find(s => s.id === manualFormData.serviceId);
      if (!selectedService) throw new Error('Service not found');

      const result = await calendarData.createAppointment(barberId, {
        clientName: manualFormData.clientName,
        serviceId: manualFormData.serviceId,
        date: manualFormData.date,
        time: manualFormData.time,
        price: selectedService.price,
      });

      if (!result.success) {
        if (result.conflict) {
          Alert.alert('Time Conflict', 'This time overlaps an existing booking.');
        } else {
          Alert.alert('Error', 'Failed to create appointment');
        }
        return;
      }

      Alert.alert('Success', 'Manual appointment created successfully');
      setShowManualAppointmentForm(false);
      setManualFormData({
        clientName: '',
        serviceId: '',
        price: '',
        time: '',
        date: selectedDate || new Date()
      });
    } catch (error) {
      logger.error('Error creating manual appointment:', error);
      Alert.alert('Error', 'Failed to create appointment');
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
      price: selectedService ? selectedService.price.toString() : ''
    }));
  };

  const handleDateSelect = (date: Date) => {
    setManualFormData(prev => ({
      ...prev,
      date: date,
      time: '' // Clear time when date changes
    }));
  };

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
              <TouchableOpacity
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
              </TouchableOpacity>
              
              <TouchableOpacity
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
              </TouchableOpacity>
            </View>
          )}
        </View>

          {/* Single Main Calendar Container - Enhanced with glow */}
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
                            ${service.price}
                          </Text>
                        </View>
                        <Text style={[tw`text-xs`, { color: colors.mutedForeground }]}>
                          {service.duration} minutes
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
                            handleDateSelect(new Date());
                          }
                        },
                        {
                          text: 'Tomorrow',
                          onPress: () => {
                            logger.log('Selected Tomorrow');
                            handleDateSelect(new Date(Date.now() + 24 * 60 * 60 * 1000));
                          }
                        },
                        {
                          text: 'Next Week',
                          onPress: () => {
                            logger.log('Selected Next Week');
                            handleDateSelect(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
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
                              key={slot.time}
                              onPress={() => setManualFormData(prev => ({ ...prev, time: slot.time }))}
                              style={tw`w-1/3 px-1 mb-2`}
                              disabled={isSubmitting}
                            >
                              <View style={[
                                tw`rounded-lg py-3 items-center`,
                                manualFormData.time === slot.time
                                  ? { backgroundColor: colors.primary }
                                  : { backgroundColor: colors.glass }
                              ]}>
                                <Text style={[
                                  tw`text-sm font-medium`,
                                  manualFormData.time === slot.time
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