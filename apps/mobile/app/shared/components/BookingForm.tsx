import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import tw from 'twrnc';
import { format, addDays, isToday, isSameDay } from 'date-fns';
import Icon from 'react-native-vector-icons/Feather';
import { RootStackParamList } from '../types';
import { bookingService, Service, TimeSlot } from '../lib/bookingService';
import * as WebBrowser from 'expo-web-browser';
import { confirmPayment, presentPaymentSheet, CardField } from '@stripe/stripe-react-native';
import { Button, Textarea } from './ui';

// Add-on types
interface ServiceAddon {
  id: string;
  barber_id: string;
  name: string;
  description?: string;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../components/theme';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api-client';
import { notificationService, formatAppointmentTime } from '../lib/notifications';
import { logger } from '../lib/logger';

type BookingFormNavigationProp = NativeStackNavigationProp<RootStackParamList, 'BookingCalendar'>;

interface BookingFormProps {
  isVisible: boolean;
  onClose: () => void;
  barberId: string;
  barberName: string;
  preSelectedService?: Service;
  onBookingCreated: (booking: any) => void;
}

interface CalendarDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  monthName: string;
  isToday: boolean;
  dateString: string;
}

export default function BookingForm({ 
  isVisible, 
  onClose, 
  barberId, 
  barberName, 
  preSelectedService,
  onBookingCreated 
}: BookingFormProps) {
  const { colors } = useTheme();
  const navigation = useNavigation<BookingFormNavigationProp>();
  const { user, userProfile } = useAuth();

  const closeAndNavigateToAuth = (screen: 'Login' | 'SignUp') => {
    // Close the booking modal first to avoid leaving it open behind auth screens.
    onClose();
    requestAnimationFrame(() => {
      navigation.navigate(screen as never);
    });
  };

  // State management
  const [currentStep, setCurrentStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [addons, setAddons] = useState<ServiceAddon[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  
  // Form data
  const [guestInfo, setGuestInfo] = useState({
    name: '',
    email: '',
    phone: '',
    notes: ''
  });
  
  const [paymentType, setPaymentType] = useState<'fee'>('fee');
  const [isDeveloperAccount, setIsDeveloperAccount] = useState(false);

  const totalSteps = 5; // Added step 5 for card input

  useEffect(() => {
    if (isVisible) {
      fetchServices();
      fetchBarberStatus();
      setCurrentStep(1);
      
      // Pre-populate user info if logged in
      if (user) {
        setGuestInfo(prev => ({
          ...prev,
          name: userProfile?.name || '',
          email: user.email || ''
        }));
      }
    }
  }, [isVisible, barberId, user]);

  // Auto-select service if provided as prop
  useEffect(() => {
    if (preSelectedService && services.length > 0) {
      const matchingService = services.find(service => service.id === preSelectedService.id);
      if (matchingService) {
        setSelectedService(matchingService);
        // Auto-advance to next step if service is pre-selected
        if (currentStep === 1) {
          setTimeout(() => {
            setCurrentStep(2);
          }, 500);
        }
      }
    }
  }, [preSelectedService, services, currentStep]);

  useEffect(() => {
    if (isVisible && selectedService && selectedDate) {
      fetchTimeSlots();
    }
  }, [isVisible, selectedService, selectedDate]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      const servicesData = await Promise.race([
        bookingService.getBarberServices(barberId),
        timeoutPromise
      ]) as Service[];
      
      if (!servicesData || servicesData.length === 0) {
        logger.warn('No services found for this barber');
        Alert.alert('No Services', 'This barber has no services available for booking.');
        onClose();
        return;
      }
      
      setServices(servicesData);
      
      // Fetch add-ons separately (non-critical) with timeout
      try {
        const addonsData = await Promise.race([
          fetchAddons(),
          timeoutPromise
        ]) as ServiceAddon[];
        setAddons(addonsData);
      } catch (addonError) {
        logger.warn('Add-ons fetch failed, continuing without add-ons:', addonError);
        setAddons([]);
      }
    } catch (error) {
      logger.error('Error fetching services:', error);
      Alert.alert('Error', 'Failed to load services. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAddons = async (): Promise<ServiceAddon[]> => {
    try {
      const addons = await bookingService.getBarberAddons(barberId);
      return (addons || []) as ServiceAddon[];
    } catch (error) {
      logger.error('Error fetching add-ons:', error);
      return [];
    }
  };

  const fetchBarberStatus = async () => {
    if (!barberId) {
      logger.warn('⚠️ No barberId provided to fetchBarberStatus');
      return;
    }

    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );

      const res = await Promise.race([
        apiFetch<{ barber: any }>(`/api/mobile/barbers/${barberId}`, { method: 'GET', auth: false }),
        timeoutPromise
      ]) as { barber: any };

      const isDev = res?.barber?.is_developer === true;
      setIsDeveloperAccount(isDev);
    } catch (error) {
      const isTimeout = error instanceof Error && error.message === 'Request timeout';
      logger.error(`❌ Error fetching barber status${isTimeout ? ' (TIMEOUT)' : ''}:`, error);
      setIsDeveloperAccount(false);
    }
  };

  const fetchTimeSlots = async () => {
    if (!selectedDate || !selectedService) {
      // Cannot fetch time slots - missing date or service
      return;
    }

    try {
      setLoadingSlots(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Add timeout to prevent hanging requests
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      const slots = await Promise.race([
        bookingService.getAvailableSlots(
          barberId,
          dateStr,
          selectedService.duration
        ),
        timeoutPromise
      ]) as TimeSlot[];
      
      setTimeSlots(slots);
    } catch (error) {
      logger.error('Error fetching time slots:', error);
      const errorMessage = error instanceof Error && error.message === 'Request timeout'
        ? 'Request timed out. Please try again.'
        : 'Failed to load available times. Please try again.';
      Alert.alert('Error', errorMessage);
      setTimeSlots([]); // Clear slots on error
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setSelectedTime('');
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime('');
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const validateStep = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!selectedService;
      case 2:
        return !!selectedDate && !!selectedTime;
      case 3:
        // Guests may enter a note here, but must sign in to proceed.
        return true;
      case 4:
        return true;
      case 5:
        return !isDeveloperAccount; // Only validate for regular bookings

      default:
        return false;
    }
  };

  const handleNextStep = () => {
    // Guest preview: allow guests to view services + availability (steps 1-2),
    // and optionally enter a note (step 3), but require sign-in before proceeding.
    if (currentStep === 3 && !user) {
      Alert.alert(
        'Sign in required',
        'You can view availability as a guest, but you need an account to book an appointment.',
        [
          { text: 'Log In', onPress: () => closeAndNavigateToAuth('Login') },
          { text: 'Sign Up', onPress: () => closeAndNavigateToAuth('SignUp') },
          { text: 'Not now', style: 'cancel' },
        ]
      );
      return;
    }

    if (validateStep() && currentStep < totalSteps) {
      // For developer accounts, skip step 5 (payment) and go directly to booking
      if (currentStep === 4 && isDeveloperAccount) {
        handleCreateBooking();
      } else {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreateBooking = async () => {
    if (!selectedService || !selectedDate || !selectedTime) {
      Alert.alert('Error', 'Please complete all required fields.');
      return;
    }

    // No guest booking in production: must be authenticated to create a booking.
    if (!user) {
      Alert.alert('Error', 'Please sign in to book with this barber.');
      return;
    }

    setBookingLoading(true);

    try {
      const bookingDate = new Date(selectedDate);
      const [hours, minutes] = selectedTime.split(':');
      bookingDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const result = await bookingService.createBooking({
        barberId,
        serviceId: selectedService.id,
        date: bookingDate.toISOString(),
        notes: guestInfo.notes,
        addonIds: selectedAddonIds,
      });

      // Developer barber: booking created immediately
      if (result?.booking) {
        Alert.alert('Success!', 'Your booking has been created successfully.', [
          { text: 'OK', onPress: () => onBookingCreated(result.booking) },
        ]);
        onClose();
        return;
      }

      // Regular barber: confirm payment with Stripe, booking created by webhook
      if (result?.clientSecret) {
        const { error: paymentError } = await confirmPayment(result.clientSecret, {
          paymentMethodType: 'Card',
        });

        if (paymentError) {
          logger.error('Payment error:', paymentError);
          Alert.alert('Payment Failed', paymentError.message || 'Payment could not be completed.');
          return;
        }

        Alert.alert('Payment Successful!', 'Your payment has been processed. Your booking will be confirmed shortly.', [
          {
            text: 'OK',
            onPress: () => onBookingCreated(null),
          },
        ]);
        onClose();
        return;
      }

      throw new Error('Unexpected response from booking endpoint');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Error creating booking:', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        barberId,
        serviceId: selectedService?.id,
        selectedDate,
        selectedTime,
      });
      
      // Capture error in Sentry
      const { captureException } = require('../../shared/lib/sentry');
      captureException(error as Error, {
        context: 'BookingForm.handleBooking',
        selectedService: selectedService?.name,
        selectedBarber: barberId,
        selectedDate: selectedDate?.toISOString(),
        selectedTime,
        errorMessage,
      });
      
      // Show user-friendly error with more detail
      Alert.alert(
        'Booking Failed', 
        errorMessage || 'Failed to create booking. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    } finally {
      setBookingLoading(false);
    }
  };

  const generateCalendarDays = (): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const today = new Date();

    for (let i = 0; i < 14; i++) {
      const date = addDays(today, i);
      days.push({
        date,
        dayName: format(date, 'EEE'),
        dayNumber: parseInt(format(date, 'd')),
        monthName: format(date, 'MMM'),
        isToday: isToday(date),
        dateString: format(date, 'yyyy-MM-dd'),
      });
    }
    return days;
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return 'Choose Your Service';
      case 2: return 'Pick Your Time';
      case 3: return 'Your Information';
      case 4: return 'Review & Book';
      case 5: return 'Payment';
      default: return '';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 1: return 'Select the service you\'d like to book';
      case 2: return 'Choose your preferred appointment time';
      case 3: return 'Provide your contact information';
      case 4: return 'Review your booking details and confirm';
      case 5: return 'Enter your payment information';
      default: return '';
    }
  };

  const getSelectedAddons = () => {
    return addons.filter(addon => selectedAddonIds.includes(addon.id));
  };

  const getSelectedAddonsTotal = () => {
    return getSelectedAddons().reduce((total, addon) => total + addon.price, 0);
  };

  const BOOKING_FEE_AMOUNT = isDeveloperAccount ? 0.0 : 3.4;
  const BOOKING_FEE_LABEL = isDeveloperAccount ? '$0.00' : '$3.40';

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[tw`flex-1`, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[tw`px-5 pt-4 pb-6 border-b`, { borderColor: colors.glassBorder }]}>
          <View style={tw`flex-row items-center justify-between mb-4`}>
            <TouchableOpacity testID="close-button" onPress={onClose}>
              <Icon name="x" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={[tw`text-lg font-semibold`, { color: colors.foreground }]}>
              {getStepTitle()}
            </Text>
            <View style={tw`w-6`} />
          </View>

          {/* Progress Bar */}
          <View style={[tw`w-full rounded-full h-2 mb-4`, { backgroundColor: colors.glass }]}>
            <View 
              style={[
                tw`h-2 rounded-full`,
                { 
                  backgroundColor: colors.primary,
                  width: `${(currentStep / totalSteps) * 100}%` 
                }
              ]}
            />
          </View>

          {/* Step Indicators */}
          <View style={tw`flex-row justify-between`}>
            {[1, 2, 3, 4, 5].map((step) => (
              <View key={step} style={tw`items-center`}>
                <View style={[
                  tw`w-8 h-8 rounded-full items-center justify-center`,
                  currentStep >= step 
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.glass }
                ]}>
                  <Text style={[
                    tw`text-sm font-medium`,
                    currentStep >= step 
                      ? { color: colors.background }
                      : { color: colors.mutedForeground }
                  ]}>
                    {step}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <ScrollView style={tw`flex-1`} showsVerticalScrollIndicator={false}>
          <View style={tw`p-5`}>
            {/* Step 1: Service Selection */}
            {currentStep === 1 && (
              <View style={tw`space-y-6`}>
                <View style={tw`items-center mb-6`}>
                  <View style={[tw`w-16 h-16 rounded-full items-center justify-center mb-4`, { backgroundColor: `${colors.primary}20` }]}>
                    <Icon name="scissors" size={24} color={colors.primary} />
                  </View>
                  <Text style={[tw`text-xl font-bold mb-2`, { color: colors.foreground }]}>
                    What service do you need?
                  </Text>
                  <Text style={[tw`text-center`, { color: colors.mutedForeground }]}>
                    Choose from our available services
                  </Text>
                </View>

                {loading ? (
                  <View style={tw`items-center py-8`}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[tw`mt-4`, { color: colors.mutedForeground }]}>Loading services...</Text>
                  </View>
                ) : (
                  <View style={tw`gap-6`}>
                    {services.map((service) => (
                      <TouchableOpacity
                        key={service.id}
                        onPress={() => handleServiceSelect(service)}
                      >
                        <View style={[
                          tw`p-4 rounded-2xl border-2`,
                          selectedService?.id === service.id
                            ? { 
                                borderColor: colors.primary, 
                                backgroundColor: `${colors.primary}10` 
                              }
                            : { 
                                borderColor: colors.glassBorder, 
                                backgroundColor: colors.glass 
                              }
                        ]}>
                          {selectedService?.id === service.id && (
                            <View style={[tw`absolute bottom-4 right-4 w-15 h-6 rounded-full items-center justify-center`, { backgroundColor: colors.primary }]}>
                            </View>
                          )}
                          
                          <View style={tw`flex-row justify-between items-start`}>
                            <View style={tw`flex-1`}>
                              <Text style={[tw`text-lg font-semibold mb-1`, { color: colors.foreground }]}>
                                {service.name}
                              </Text>
                              {service.description && (
                                <Text style={[tw`text-sm mb-2`, { color: colors.mutedForeground }]}>
                                  {service.description}
                                </Text>
                              )}
                              <View style={tw`flex-row items-center`}>
                                <Icon name="clock" size={16} color={colors.mutedForeground} />
                                <Text style={[tw`ml-1 text-sm`, { color: colors.mutedForeground }]}>
                                  {service.duration} min
                                </Text>
                              </View>
                            </View>
                            <Text style={[tw`text-lg font-bold`, { color: colors.primary }]}>
                              ${service.price.toFixed(2)}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Add-ons Section */}
                {addons.length > 0 && (
                  <View style={tw`mt-6`}>
                    <View style={tw`items-center mb-4`}>
                      <Icon name="package" size={20} color={colors.primary} />
                      <Text style={[tw`text-lg font-semibold mt-2`, { color: colors.foreground }]}>
                        Enhance Your Service (Optional)
                      </Text>
                    </View>
                    
                    <View style={tw`space-y-3`}>
                      {addons.map((addon) => (
                        <TouchableOpacity
                          key={addon.id}
                          onPress={() => {
                            const isSelected = selectedAddonIds.includes(addon.id);
                            if (isSelected) {
                              setSelectedAddonIds(selectedAddonIds.filter(id => id !== addon.id));
                            } else {
                              setSelectedAddonIds([...selectedAddonIds, addon.id]);
                            }
                          }}
                        >
                          <View style={[
                            tw`p-4 rounded-xl border-2`,
                            selectedAddonIds.includes(addon.id)
                              ? { 
                                  borderColor: colors.primary, 
                                  backgroundColor: `${colors.primary}10` 
                                }
                              : { 
                                  borderColor: colors.glassBorder, 
                                  backgroundColor: colors.glass 
                                }
                          ]}>
                            <View style={tw`flex-row items-center justify-between`}>
                              <View style={tw`flex-1`}>
                                <Text style={[tw`text-lg font-semibold mb-1`, { color: colors.foreground }]}>
                                  {addon.name}
                                </Text>
                                {addon.description && (
                                  <Text style={[tw`text-sm mb-2`, { color: colors.mutedForeground }]}>
                                    {addon.description}
                                  </Text>
                                )}
                              </View>
                              <View style={tw`items-end`}>
                                <Text style={[tw`text-lg font-bold`, { color: colors.primary }]}>
                                  +${addon.price.toFixed(2)}
                                </Text>
                                <View style={[
                                  tw`w-6 h-6 rounded-full items-center justify-center mt-2`,
                                  selectedAddonIds.includes(addon.id)
                                    ? { backgroundColor: colors.primary }
                                    : { backgroundColor: colors.glass }
                                ]}>
                                  {selectedAddonIds.includes(addon.id) && (
                                    <Icon name="check" size={16} color={colors.background} />
                                  )}
                                </View>
                              </View>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Add-ons Summary */}
                    {selectedAddonIds.length > 0 && (
                      <View style={[tw`mt-4 p-4 rounded-xl`, { backgroundColor: `${colors.primary}10`, borderWidth: 1, borderColor: `${colors.primary}20` }]}>
                        <View style={tw`flex-row items-center justify-between mb-2`}>
                          <Text style={[tw`font-medium`, { color: colors.foreground }]}>
                            Selected Add-ons ({selectedAddonIds.length})
                          </Text>
                          <Text style={[tw`font-semibold text-lg`, { color: colors.primary }]}>
                            +${getSelectedAddonsTotal().toFixed(2)}
                          </Text>
                        </View>
                        <View style={tw`space-y-1`}>
                          {getSelectedAddons().map((addon) => (
                            <View key={addon.id} style={tw`flex-row justify-between`}>
                              <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>
                                {addon.name}
                              </Text>
                              <Text style={[tw`text-sm`, { color: colors.primary }]}>
                                +${addon.price.toFixed(2)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Step 2: Date and Time Selection */}
            {currentStep === 2 && (
              <View style={tw`space-y-6`}>
                <View style={tw`items-center mb-6`}>
                  <View style={[tw`w-16 h-16 rounded-full items-center justify-center mb-4`, { backgroundColor: `${colors.primary}20` }]}>
                    <Icon name="calendar" size={24} color={colors.primary} />
                  </View>
                  <Text style={[tw`text-xl font-bold mb-2`, { color: colors.foreground }]}>
                    Pick Your Time
                  </Text>
                  <Text style={[tw`text-center`, { color: colors.mutedForeground }]}>
                    Choose your preferred appointment time
                  </Text>
                </View>

                {/* Date Selection */}
                <View>
                  <Text style={[tw`text-lg font-semibold mb-4`, { color: colors.foreground }]}>
                    Select Date
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={tw`pb-4`}
                  >
                    {generateCalendarDays().map((day, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => handleDateSelect(day.date)}
                        style={tw`mr-3`}
                      >
                        <View style={[
                          tw`rounded-xl p-4 items-center min-w-[80px]`,
                          selectedDate && isSameDay(selectedDate, day.date)
                            ? { backgroundColor: colors.primary }
                            : { backgroundColor: colors.glass },
                          day.isToday && { borderWidth: 1, borderColor: colors.primary }
                        ]}>
                          <Text style={[
                            tw`text-xs font-medium`,
                            selectedDate && isSameDay(selectedDate, day.date)
                              ? { color: colors.background }
                              : { color: colors.mutedForeground }
                          ]}>
                            {day.dayName}
                          </Text>
                          <Text style={[
                            tw`text-xl font-bold my-1`,
                            selectedDate && isSameDay(selectedDate, day.date)
                              ? { color: colors.background }
                              : { color: colors.foreground }
                          ]}>
                            {day.dayNumber}
                          </Text>
                          <Text style={[
                            tw`text-xs`,
                            selectedDate && isSameDay(selectedDate, day.date)
                              ? { color: colors.background }
                              : { color: colors.mutedForeground }
                          ]}>
                            {day.monthName}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Time Selection */}
                {selectedDate && (
                  <View>
                    <Text style={[tw`text-lg font-semibold mb-4`, { color: colors.foreground }]}>
                      Select Time
                    </Text>
                    {loadingSlots ? (
                      <View style={tw`items-center py-8`}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[tw`mt-2`, { color: colors.mutedForeground }]}>Loading times...</Text>
                      </View>
                    ) : (
                      <View style={tw`flex-row flex-wrap -mx-1`}>
                        {timeSlots
                          .filter(slot => slot.available)
                          .map((slot) => (
                            <TouchableOpacity
                              key={slot.time}
                              onPress={() => handleTimeSelect(slot.time)}
                              style={tw`w-1/3 px-1 mb-2`}
                            >
                              <View style={[
                                tw`rounded-lg py-3 items-center`,
                                selectedTime === slot.time
                                  ? { backgroundColor: colors.primary }
                                  : { backgroundColor: colors.glass }
                              ]}>
                                <Text style={[
                                  tw`text-sm font-medium`,
                                  selectedTime === slot.time
                                    ? { color: colors.background }
                                    : { color: colors.foreground }
                                ]}>
                                  {formatTime(slot.time)}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Step 3: Guest Information */}
            {currentStep === 3 && (
              <View style={tw`space-y-6`}>
                <View style={tw`items-center mb-6`}>
                  <View style={[tw`w-16 h-16 rounded-full items-center justify-center mb-4`, { backgroundColor: `${colors.primary}20` }]}>
                    <Icon name="user" size={24} color={colors.primary} />
                  </View>
                  <Text style={[tw`text-xl font-bold mb-2`, { color: colors.foreground }]}>
                    Tell us about yourself
                  </Text>
                  <Text style={[tw`text-center`, { color: colors.mutedForeground }]}>
                    We&apos;ll use this to confirm your booking
                  </Text>
                </View>

                {!user ? (
                  <View style={[tw`p-6 rounded-2xl`, { backgroundColor: colors.destructiveSubtle, borderWidth: 1, borderColor: colors.destructive }]}>
                    <View style={tw`items-center`}>
                      <View style={[tw`w-12 h-12 rounded-full items-center justify-center mb-4`, { backgroundColor: colors.destructiveSubtle }]}>
                        <Icon name="lock" size={24} color={colors.destructive} />
                      </View>
                      <Text style={[tw`text-lg font-semibold mb-2`, { color: colors.foreground }]}>
                        Sign In Required
                      </Text>
                      <Text style={[tw`text-center mb-4`, { color: colors.mutedForeground }]}>
                        You can add a note below, but you must sign in to complete your booking.
                      </Text>
                      <View style={tw`w-full flex-row gap-3`}>
                        <TouchableOpacity
                          style={[tw`flex-1 py-3 rounded-full items-center`, { backgroundColor: colors.primary }]}
                          onPress={() => closeAndNavigateToAuth('Login')}
                        >
                          <Text style={[tw`font-semibold`, { color: colors.background }]}>Log In</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[tw`flex-1 py-3 rounded-full items-center`, { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder }]}
                          onPress={() => closeAndNavigateToAuth('SignUp')}
                        >
                          <Text style={[tw`font-semibold`, { color: colors.foreground }]}>Sign Up</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={[tw`p-6 rounded-2xl`, { backgroundColor: `${colors.primary}10`, borderWidth: 1, borderColor: `${colors.primary}20` }]}>
                    <View style={tw`items-center`}>
                      <View style={[tw`w-12 h-12 rounded-full items-center justify-center mb-4`, { backgroundColor: `${colors.primary}20` }]}>
                        <Icon name="check" size={24} color={colors.primary} />
                      </View>
                      <Text style={[tw`text-lg font-semibold mb-2`, { color: colors.foreground }]}>
                        Welcome back, {userProfile?.name}!
                      </Text>
                      <Text style={[tw`text-center`, { color: colors.mutedForeground }]}>
                        We&apos;ll use your account information for this booking
                      </Text>
                    </View>
                  </View>
                )}

                {/* Notes */}
                <View style={tw`mt-4`}>
                  <Textarea
                    placeholder="Any special requests or notes... (Optional)"
                    value={guestInfo.notes}
                    onChangeText={(text: string) => setGuestInfo({ ...guestInfo, notes: text })}
                    rows={4}
                  />
                </View>
              </View>
            )}

            {/* Step 4: Review & Payment */}
            {currentStep === 4 && (
              <View style={tw`space-y-6`}>
                <View style={tw`items-center mb-6`}>
                  <View style={[tw`w-16 h-16 rounded-full items-center justify-center mb-4`, { backgroundColor: `${colors.primary}20` }]}>
                    <Icon name="credit-card" size={24} color={colors.primary} />
                  </View>
                  <Text style={[tw`text-xl font-bold mb-2`, { color: colors.foreground }]}>
                    Review Your Booking
                  </Text>
                  <Text style={[tw`text-center`, { color: colors.mutedForeground }]}>
                    Confirm your details and complete payment
                  </Text>
                </View>

                {/* Booking Summary */}
                <View style={[tw`p-4 rounded-xl`, { backgroundColor: colors.glass }]}>
                  <Text style={[tw`font-semibold mb-4`, { color: colors.primary }]}>
                    Booking Summary
                  </Text>
                  <View style={tw`space-y-2`}>
                    <View style={tw`flex-row justify-between`}>
                      <Text style={{ color: colors.mutedForeground }}>Service:</Text>
                      <Text style={{ color: colors.foreground }}>{selectedService?.name}</Text>
                    </View>
                    <View style={tw`flex-row justify-between`}>
                      <Text style={{ color: colors.mutedForeground }}>Date:</Text>
                      <Text style={{ color: colors.foreground }}>
                        {selectedDate && format(selectedDate, 'MMM d, yyyy')}
                      </Text>
                    </View>
                    <View style={tw`flex-row justify-between`}>
                      <Text style={{ color: colors.mutedForeground }}>Time:</Text>
                      <Text style={{ color: colors.foreground }}>
                        {formatTime(selectedTime)}
                      </Text>
                    </View>
                    <View style={tw`flex-row justify-between`}>
                      <Text style={{ color: colors.mutedForeground }}>Duration:</Text>
                      <Text style={{ color: colors.foreground }}>
                        {selectedService?.duration} min
                      </Text>
                    </View>
                    <View style={tw`flex-row justify-between`}>
                      <Text style={{ color: colors.mutedForeground }}>Price:</Text>
                      <Text style={{ color: colors.foreground }}>
                        ${selectedService?.price.toFixed(2)}
                      </Text>
                    </View>
                    
                    {/* Add-ons */}
                    {selectedAddonIds.length > 0 && (
                      <>
                        <View style={[tw`border-t pt-2 mt-2`, { borderColor: colors.glassBorder }]}>
                          <Text style={[tw`font-medium mb-2`, { color: colors.foreground }]}>
                            Add-ons:
                          </Text>
                          {getSelectedAddons().map((addon) => (
                            <View key={addon.id} style={tw`flex-row justify-between`}>
                              <Text style={{ color: colors.mutedForeground }}>
                                {addon.name}
                              </Text>
                              <Text style={{ color: colors.foreground }}>
                                +${addon.price.toFixed(2)}
                              </Text>
                            </View>
                          ))}
                        </View>
                        <View style={[tw`flex-row justify-between pt-2 border-t`, { borderColor: colors.glassBorder }]}>
                          <Text style={[tw`font-semibold`, { color: colors.foreground }]}>
                            Total Service Cost:
                          </Text>
                          <Text style={[tw`font-semibold`, { color: colors.primary }]}>
                            ${((selectedService?.price || 0) + getSelectedAddonsTotal()).toFixed(2)}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>

                {/* Payment Information */}
                <View>
                  <Text style={[tw`text-lg font-semibold mb-4`, { color: colors.foreground }]}>
                    Payment
                  </Text>
                  <View style={[tw`p-4 rounded-xl`, { backgroundColor: colors.glass }]}>
                    <View style={tw`flex-row justify-between items-center`}>
                      <Text style={{ color: colors.foreground }}>
                        Booking Fee
                      </Text>
                      <Text style={[tw`font-semibold`, { color: colors.primary }]}>
                        {BOOKING_FEE_LABEL}
                      </Text>
                    </View>
                    <Text style={[tw`text-sm mt-2`, { color: colors.mutedForeground }]}>
                      {isDeveloperAccount 
                        ? 'Developer account - no platform fees charged. Service cost and any add-ons will be paid directly to the barber at your appointment.'
                        : 'Service cost and any add-ons are paid directly to your barber at your appointment.'
                      }
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Step 5: Card Input (only for regular bookings) */}
            {currentStep === 5 && !isDeveloperAccount && (
              <View style={tw`space-y-6`}>
                {/* Header Section */}
                <View style={tw`items-center mb-8`}>
                  <View style={[
                    tw`w-20 h-20 rounded-full items-center justify-center mb-4`,
                    { 
                      backgroundColor: `${colors.primary}20`,
                      borderWidth: 2,
                      borderColor: `${colors.primary}40`
                    }
                  ]}>
                    <Icon name="credit-card" size={28} color={colors.primary} />
                  </View>
                  <Text style={[tw`text-2xl font-bold mb-3`, { color: colors.foreground }]}>
                    Secure Payment
                  </Text>
                  <Text style={[tw`text-center text-base leading-6`, { color: colors.mutedForeground }]}>
                    Your payment information is encrypted and secure
                  </Text>
                </View>

                {/* Security Badge */}
                <View style={[
                  tw`flex-row items-center justify-center p-3 rounded-full mb-6`,
                  { backgroundColor: `${colors.primary}15` }
                ]}>
                  <Icon name="shield" size={16} color={colors.primary} />
                  <Text style={[tw`ml-2 text-sm font-medium`, { color: colors.primary }]}>
                    Powered by Stripe • PCI Compliant
                  </Text>
                </View>

                {/* Card Input Section */}
                <View style={[
                  tw`p-6 rounded-2xl mb-8`,
                  { 
                    backgroundColor: colors.glass,
                    borderWidth: 1,
                    borderColor: colors.glassBorder
                  }
                ]}>
                  <View style={tw`flex-row items-center mb-4`}>
                    <Icon name="credit-card" size={20} color={colors.primary} />
                    <Text style={[tw`ml-2 text-lg font-semibold`, { color: colors.foreground }]}>
                      Card Information
                    </Text>
                  </View>
                  
                  <CardField
                    postalCodeEnabled={false}
                    placeholders={{
                      number: "4242 4242 4242 4242",
                    }}
                    cardStyle={{
                      backgroundColor: colors.glass,
                      textColor: colors.foreground,
                      fontSize: 16,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.glassBorder,
                    }}
                    style={{
                      width: '100%',
                      height: 56,
                      marginVertical: 20,
                    }}
                  />
                  
                  <View style={tw`flex-row items-center mt-2`}>
                    <Icon name="info" size={14} color={colors.mutedForeground} />
                    <Text style={[tw`ml-2 text-xs`, { color: colors.mutedForeground }]}>
                      All transactions are processed securely by Stripe.
                    </Text>
                  </View>
                </View>

                {/* Payment Summary */}
                <View style={[
                  tw`p-6 rounded-2xl`,
                  { 
                    backgroundColor: colors.glass,
                    borderWidth: 1,
                    borderColor: colors.glassBorder
                  }
                ]}>
                  <View style={tw`flex-row items-center mb-3`}>
                    <Icon name="file-text" size={20} color={colors.primary} />
                    <Text style={[tw`ml-2 text-lg font-semibold`, { color: colors.foreground }]}>
                      Payment Summary
                    </Text>
                  </View>
                  
                  <View style={tw`space-y-3`}>
                    <View style={tw`flex-row justify-between items-center`}>
                      <Text style={[tw`text-base`, { color: colors.mutedForeground }]}>
                        Service
                      </Text>
                      <Text style={[tw`text-base font-medium`, { color: colors.foreground }]}>
                        {selectedService?.name}
                      </Text>
                    </View>
                    
                    <View style={tw`flex-row justify-between items-center`}>
                      <Text style={[tw`text-base`, { color: colors.mutedForeground }]}>
                        Booking Fee
                      </Text>
                      <Text style={[tw`text-base font-medium`, { color: colors.foreground }]}>
                        {BOOKING_FEE_LABEL}
                      </Text>
                    </View>
                    
                    {/* Add-ons if any */}
                    {selectedAddonIds.length > 0 && (
                      <View style={tw`space-y-2`}>
                        {getSelectedAddons().map((addon) => (
                          <View key={addon.id} style={tw`flex-row justify-between items-center`}>
                            <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>
                              + {addon.name}
                            </Text>
                            <Text style={[tw`text-sm font-medium`, { color: colors.foreground }]}>
                              +${addon.price.toFixed(2)}
                            </Text>
                          </View>
                        ))}
                        <Text style={[tw`text-xs mt-2`, { color: colors.mutedForeground }]}>
                          Add-ons are paid at your appointment (not charged now).
                        </Text>
                      </View>
                    )}
                    
                    <View style={[
                      tw`border-t pt-3 mt-3`,
                      { borderTopWidth: 1 },
                      { borderColor: colors.glassBorder },
                    ]}>
                      <View style={tw`flex-row justify-between items-center`}>
                        <Text style={[tw`text-lg font-semibold`, { color: colors.foreground }]}>
                          Total
                        </Text>
                        <Text style={[tw`text-xl font-bold`, { color: colors.primary }]}>
                          {BOOKING_FEE_LABEL}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Trust Indicators */}
                <View style={tw`items-center mt-4`}>
                  <View style={tw`flex-row items-center space-x-4`}>
                    <View style={tw`items-center mr-4`}>
                      <Icon name="lock" size={16} color={colors.mutedForeground} />
                      <Text style={[tw`text-xs mt-1`, { color: colors.mutedForeground }]}>
                        Encrypted
                      </Text>
                    </View>
                    <View style={tw`items-center`}>
                      <Icon name="shield" size={16} color={colors.mutedForeground} />
                      <Text style={[tw`text-xs mt-1`, { color: colors.mutedForeground }]}>
                        Secure
                      </Text>
                    </View>
                    <View style={tw`items-center ml-4`}>
                      <Icon name="check-circle" size={16} color={colors.mutedForeground} />
                      <Text style={[tw`text-xs mt-1`, { color: colors.mutedForeground }]}>
                        Verified
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}


          </View>
        </ScrollView>

        {/* Footer with Navigation */}
        <View style={[tw`p-5 border-t flex-row gap-3`, { borderColor: colors.glassBorder }]}>
          {currentStep > 1 && (
            <View style={tw`flex-1`}>
              <Button
                variant="outline"
                size="hero"
                onPress={handlePrevStep}
              >
                Back
              </Button>
            </View>
          )}

          {currentStep < totalSteps ? (
            <View style={tw`flex-1`}>
              <Button
                size="hero"
                onPress={handleNextStep}
                disabled={!validateStep()}
              >
                Continue
              </Button>
            </View>
          ) : (
            <View style={tw`flex-1`}>
              <Button
                size="hero"
                onPress={handleCreateBooking}
                disabled={bookingLoading}
              >
                {bookingLoading ? 'Processing...' : 'Complete Booking'}
              </Button>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
