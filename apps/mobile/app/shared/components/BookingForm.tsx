import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import tw from 'twrnc';
import { captureException } from '../lib/sentry';
import Icon from 'react-native-vector-icons/Feather';
import { initPaymentSheet, presentPaymentSheet, retrievePaymentIntent } from '@stripe/stripe-react-native';
import {
  TOTAL_PRICE_CENTS,
  addDays as addCalendarDays,
  formatBookingDate,
  formatBookingTime,
  formatCents,
  localDateInTimeZone,
  type AvailabilitySlot,
  type BookingRow,
  type PublicAddon,
  type PublicService,
} from '@barber-app/shared';
import { RootStackParamList } from '../types';
import { Button, Textarea } from './ui';
import BookingFeeNote from './BookingFeeNote';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../components/theme';
import { api, bookingErrorMessage, isApiError } from '../lib/api';
import { logger } from '../lib/logger';

type BookingFormNavigationProp = NativeStackNavigationProp<RootStackParamList, 'BookingCalendar'>;

/** Deep link Stripe returns to after a redirect-based payment step (3-D Secure, bank apps). */
const STRIPE_RETURN_URL = 'talii://stripe-redirect';
const DAYS_SHOWN = 14;

interface BookingFormProps {
  isVisible: boolean;
  onClose: () => void;
  barberId: string;
  barberName: string;
  preSelectedService?: Pick<PublicService, 'id'> | null;
  /** Called with the booking once it is confirmed (fee waived) or paid. */
  onBookingCreated: (booking: BookingRow, summary: BookedSummary) => void;
}

/** What the success screen shows; the times are instants, shown in `timeZone`. */
export interface BookedSummary {
  barberName: string;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  city: string | null;
  state: string | null;
}

interface CalendarDay {
  /** Barber-local calendar date "YYYY-MM-DD". */
  date: string;
  dayName: string;
  dayNumber: string;
  monthName: string;
  isToday: boolean;
}

/** Labels for a calendar date (formatted as that date, independent of the device's zone). */
function calendarDay(date: string, today: string): CalendarDay {
  const noonUtc = new Date(`${date}T12:00:00Z`);
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(noonUtc);
  return {
    date,
    dayName: part({ weekday: 'short' }),
    dayNumber: part({ day: 'numeric' }),
    monthName: part({ month: 'short' }),
    isToday: date === today,
  };
}

export default function BookingForm({
  isVisible,
  onClose,
  barberId,
  barberName,
  preSelectedService,
  onBookingCreated,
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

  const [currentStep, setCurrentStep] = useState(1);
  const [services, setServices] = useState<PublicService[]>([]);
  const [addons, setAddons] = useState<PublicAddon[]>([]);
  const [timeZone, setTimeZone] = useState('America/New_York');
  const [place, setPlace] = useState<{ city: string | null; state: string | null }>({ city: null, state: null });
  const [selectedService, setSelectedService] = useState<PublicService | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [timeSlots, setTimeSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  const totalSteps = 3;

  useEffect(() => {
    if (isVisible) {
      setCurrentStep(1);
      setSelectedSlot(null);
      fetchBarber();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- it reloads only when the listed keys change; the callback reads the current render
  }, [isVisible, barberId]);

  // Auto-select a service passed in by the caller.
  useEffect(() => {
    if (preSelectedService && services.length > 0) {
      const match = services.find((service) => service.id === preSelectedService.id);
      if (match) {
        setSelectedService(match);
        if (currentStep === 1) {
          setTimeout(() => setCurrentStep(2), 500);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- it reloads only when the listed keys change; the callback reads the current render
  }, [preSelectedService, services]);

  useEffect(() => {
    if (isVisible && selectedService && selectedDate) {
      fetchTimeSlots(selectedService.id, selectedDate);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- it reloads only when the listed keys change; the callback reads the current render
  }, [isVisible, selectedService, selectedDate]);

  /** Services, add-ons and time zone come from GET /api/barbers/:id. */
  const fetchBarber = async () => {
    try {
      setLoading(true);
      const profile = await api.barbers.get(barberId);
      setTimeZone(profile.barber.timezone);
      setPlace({ city: profile.barber.city ?? null, state: profile.barber.state ?? null });
      setAddons(profile.addons);

      if (profile.services.length === 0) {
        Alert.alert('No Services', 'This barber has no services available for booking.');
        onClose();
        return;
      }
      setServices(profile.services);
    } catch (error) {
      logger.error('Error loading barber for booking:', error);
      Alert.alert('Error', bookingErrorMessage(error, 'Failed to load services. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeSlots = async (serviceId: string, date: string) => {
    try {
      setLoadingSlots(true);
      const res = await api.barbers.availability(barberId, { date, serviceId });
      setTimeZone(res.timezone);
      setTimeSlots(res.slots);
    } catch (error) {
      logger.error('Error fetching time slots:', error);
      Alert.alert('Error', bookingErrorMessage(error, 'Failed to load available times. Please try again.'));
      setTimeSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleServiceSelect = (service: PublicService) => {
    setSelectedService(service);
    setSelectedSlot(null);
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const validateStep = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!selectedService;
      case 2:
        return !!selectedDate && !!selectedSlot;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleNextStep = () => {
    // Guests may look at services and availability, but must sign in to book.
    if (currentStep === 2 && !user) {
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
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  /** An unpaid hold is cancelled without a charge, freeing the slot straight away. */
  const releaseHold = async (bookingId: string) => {
    try {
      await api.bookings.cancel(bookingId, 'Payment not completed');
    } catch (error) {
      // The hold expires on its own after 10 minutes.
      logger.warn('Could not release booking hold', { code: isApiError(error) ? error.code : 'UNKNOWN' });
    }
  };

  /** True when Stripe already has (or is completing) the payment for this intent. */
  const paymentWentThrough = async (clientSecret: string): Promise<boolean> => {
    try {
      const { paymentIntent } = await retrievePaymentIntent(clientSecret);
      const status = paymentIntent?.status as string | undefined;
      return status === 'Succeeded' || status === 'Processing' || status === 'RequiresCapture';
    } catch {
      logger.warn('Could not read the PaymentIntent status.');
      return false;
    }
  };

  const finish = (booking: BookingRow, title: string, message: string) => {
    const summary: BookedSummary = {
      barberName,
      serviceName: selectedService?.name ?? '',
      startsAt: booking.starts_at ?? selectedSlot?.startsAt ?? '',
      endsAt: booking.ends_at ?? selectedSlot?.endsAt ?? '',
      timeZone,
      city: place.city,
      state: place.state,
    };
    Alert.alert(title, message, [{ text: 'OK', onPress: () => onBookingCreated(booking, summary) }]);
    onClose();
  };

  /**
   * POST /api/bookings holds the slot. With a fee-exempt barber the booking is
   * already confirmed (clientSecret null); otherwise the booking fee is paid in
   * Stripe's PaymentSheet and the webhook confirms the booking.
   */
  const handleCreateBooking = async () => {
    if (!selectedService || !selectedSlot) {
      Alert.alert('Error', 'Please choose a service and a time.');
      return;
    }
    if (!user) {
      Alert.alert('Error', 'Please sign in to book with this barber.');
      return;
    }

    setBookingLoading(true);
    try {
      const { booking, clientSecret } = await api.bookings.create({
        barberId,
        serviceId: selectedService.id,
        startsAt: selectedSlot.startsAt,
        addonIds: selectedAddonIds,
        notes: notes.trim() || undefined,
      });

      if (!clientSecret) {
        finish(booking, 'Booking Confirmed!', 'Your appointment is booked.');
        return;
      }

      const init = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Talii',
        returnURL: STRIPE_RETURN_URL,
        // The PaymentIntent allows card and Link only (no delayed methods; the hold lasts
        // 10 minutes). Apple Pay / Google Pay stay off: they need an Apple merchant ID on
        // StripeProvider and the Stripe Expo config plugin, neither of which is configured.
        defaultBillingDetails: { email: user.email ?? undefined, name: userProfile?.name ?? undefined },
      });
      if (init.error) {
        logger.error('PaymentSheet init failed', { code: init.error.code });
        await releaseHold(booking.id);
        Alert.alert('Payment Unavailable', init.error.message || 'Payment could not be started. Please try again.');
        return;
      }

      const { error: paymentError } = await presentPaymentSheet();
      if (paymentError) {
        // The sheet can report an error (or be dismissed) after the charge went through,
        // e.g. on a flaky network. Check the PaymentIntent before releasing the hold, so a
        // paid booking is never cancelled (a client cancel inside 24 hours is not refunded).
        if (await paymentWentThrough(clientSecret)) {
          finish(booking, 'Payment Successful!', 'Your payment went through. Your booking will be confirmed in a moment.');
          return;
        }
        await releaseHold(booking.id);
        if (paymentError.code === 'Canceled') {
          Alert.alert('Payment Cancelled', 'Your booking was not completed and the time slot was released.');
        } else {
          logger.error('PaymentSheet failed', { code: paymentError.code });
          Alert.alert('Payment Failed', paymentError.message || 'Payment could not be completed.');
        }
        // The slot list may have changed while the sheet was open.
        if (selectedDate) fetchTimeSlots(selectedService.id, selectedDate);
        return;
      }

      finish(
        booking,
        'Payment Successful!',
        'Your payment went through. Your booking will be confirmed in a moment.'
      );
    } catch (error) {
      logger.error('Error creating booking', { code: isApiError(error) ? error.code : 'UNKNOWN' });
      if (!isApiError(error)) {
        captureException(error as Error, { context: 'BookingForm.handleCreateBooking', barberId });
      }
      Alert.alert('Booking Failed', bookingErrorMessage(error, 'Failed to create booking. Please try again.'));
      if (isApiError(error) && error.code === 'SLOT_TAKEN' && selectedDate) {
        setSelectedSlot(null);
        setCurrentStep(2);
        fetchTimeSlots(selectedService.id, selectedDate);
      }
    } finally {
      setBookingLoading(false);
    }
  };

  /** The next two weeks as calendar dates in the barber's time zone. */
  const generateCalendarDays = (): CalendarDay[] => {
    const today = localDateInTimeZone(new Date(), timeZone);
    return Array.from({ length: DAYS_SHOWN }, (_, i) => calendarDay(addCalendarDays(today, i), today));
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return 'Choose Your Service';
      case 2: return 'Pick Your Time';
      case 3: return 'Review & Book';
      default: return '';
    }
  };

  const getSelectedAddons = () => addons.filter((addon) => selectedAddonIds.includes(addon.id));
  const getSelectedAddonsTotal = () => getSelectedAddons().reduce((total, addon) => total + addon.price_cents, 0);

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
            {[1, 2, 3].map((step) => (
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
                    Choose from {barberName}&apos;s services
                  </Text>
                </View>

                <BookingFeeNote />

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
                            ? { borderColor: colors.primary, backgroundColor: `${colors.primary}10` }
                            : { borderColor: colors.glassBorder, backgroundColor: colors.glass }
                        ]}>
                          <View style={tw`flex-row justify-between items-start`}>
                            <View style={tw`flex-1`}>
                              <Text style={[tw`text-lg font-semibold mb-1`, { color: colors.foreground }]}>
                                {service.name}
                              </Text>
                              {service.description ? (
                                <Text style={[tw`text-sm mb-2`, { color: colors.mutedForeground }]}>
                                  {service.description}
                                </Text>
                              ) : null}
                              <View style={tw`flex-row items-center`}>
                                <Icon name="clock" size={16} color={colors.mutedForeground} />
                                <Text style={[tw`ml-1 text-sm`, { color: colors.mutedForeground }]}>
                                  {service.duration_minutes} min
                                </Text>
                              </View>
                            </View>
                            <Text style={[tw`text-lg font-bold`, { color: colors.primary }]}>
                              {formatCents(service.price_cents)}
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
                      {addons.map((addon) => {
                        const selected = selectedAddonIds.includes(addon.id);
                        return (
                          <TouchableOpacity
                            key={addon.id}
                            onPress={() =>
                              setSelectedAddonIds(
                                selected
                                  ? selectedAddonIds.filter((id) => id !== addon.id)
                                  : [...selectedAddonIds, addon.id]
                              )
                            }
                          >
                            <View style={[
                              tw`p-4 rounded-xl border-2`,
                              selected
                                ? { borderColor: colors.primary, backgroundColor: `${colors.primary}10` }
                                : { borderColor: colors.glassBorder, backgroundColor: colors.glass }
                            ]}>
                              <View style={tw`flex-row items-center justify-between`}>
                                <View style={tw`flex-1`}>
                                  <Text style={[tw`text-lg font-semibold mb-1`, { color: colors.foreground }]}>
                                    {addon.name}
                                  </Text>
                                  {addon.description ? (
                                    <Text style={[tw`text-sm mb-2`, { color: colors.mutedForeground }]}>
                                      {addon.description}
                                    </Text>
                                  ) : null}
                                </View>
                                <View style={tw`items-end`}>
                                  <Text style={[tw`text-lg font-bold`, { color: colors.primary }]}>
                                    +{formatCents(addon.price_cents)}
                                  </Text>
                                  <View style={[
                                    tw`w-6 h-6 rounded-full items-center justify-center mt-2`,
                                    selected ? { backgroundColor: colors.primary } : { backgroundColor: colors.glass }
                                  ]}>
                                    {selected && <Icon name="check" size={16} color={colors.background} />}
                                  </View>
                                </View>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {selectedAddonIds.length > 0 && (
                      <View style={[tw`mt-4 p-4 rounded-xl`, { backgroundColor: `${colors.primary}10`, borderWidth: 1, borderColor: `${colors.primary}20` }]}>
                        <View style={tw`flex-row items-center justify-between`}>
                          <Text style={[tw`font-medium`, { color: colors.foreground }]}>
                            Selected Add-ons ({selectedAddonIds.length})
                          </Text>
                          <Text style={[tw`font-semibold text-lg`, { color: colors.primary }]}>
                            +{formatCents(getSelectedAddonsTotal())}
                          </Text>
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
                    Times are shown in the barber&apos;s time zone
                  </Text>
                </View>

                <View>
                  <Text style={[tw`text-lg font-semibold mb-4`, { color: colors.foreground }]}>
                    Select Date
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`pb-4`}>
                    {generateCalendarDays().map((day) => {
                      const selected = selectedDate === day.date;
                      return (
                        <TouchableOpacity key={day.date} onPress={() => handleDateSelect(day.date)} style={tw`mr-3`}>
                          <View style={[
                            tw`rounded-xl p-4 items-center min-w-[80px]`,
                            selected ? { backgroundColor: colors.primary } : { backgroundColor: colors.glass },
                            day.isToday && { borderWidth: 1, borderColor: colors.primary }
                          ]}>
                            <Text style={[tw`text-xs font-medium`, { color: selected ? colors.background : colors.mutedForeground }]}>
                              {day.dayName}
                            </Text>
                            <Text style={[tw`text-xl font-bold my-1`, { color: selected ? colors.background : colors.foreground }]}>
                              {day.dayNumber}
                            </Text>
                            <Text style={[tw`text-xs`, { color: selected ? colors.background : colors.mutedForeground }]}>
                              {day.monthName}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

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
                    ) : timeSlots.filter((slot) => slot.available).length === 0 ? (
                      <Text style={[tw`text-center py-6`, { color: colors.mutedForeground }]}>
                        No open times on this day. Please pick another date.
                      </Text>
                    ) : (
                      <View style={tw`flex-row flex-wrap -mx-1`}>
                        {timeSlots
                          .filter((slot) => slot.available)
                          .map((slot) => {
                            const selected = selectedSlot?.startsAt === slot.startsAt;
                            return (
                              <TouchableOpacity
                                key={slot.startsAt}
                                onPress={() => setSelectedSlot(slot)}
                                style={tw`w-1/3 px-1 mb-2`}
                              >
                                <View style={[
                                  tw`rounded-lg py-3 items-center`,
                                  selected ? { backgroundColor: colors.primary } : { backgroundColor: colors.glass }
                                ]}>
                                  <Text style={[tw`text-sm font-medium`, { color: selected ? colors.background : colors.foreground }]}>
                                    {formatBookingTime(slot.startsAt, timeZone)}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Step 3: Review & Book (notes live here) */}
            {currentStep === 3 && (
              <View style={tw`space-y-6`}>
                <View style={tw`items-center mb-6`}>
                  <View style={[tw`w-16 h-16 rounded-full items-center justify-center mb-4`, { backgroundColor: `${colors.primary}20` }]}>
                    <Icon name="credit-card" size={24} color={colors.primary} />
                  </View>
                  <Text style={[tw`text-xl font-bold mb-2`, { color: colors.foreground }]}>
                    Review Your Booking
                  </Text>
                  <Text style={[tw`text-center`, { color: colors.mutedForeground }]}>
                    Confirm your details and pay the booking fee
                  </Text>
                </View>

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
                        {selectedSlot && formatBookingDate(selectedSlot.startsAt, timeZone)}
                      </Text>
                    </View>
                    <View style={tw`flex-row justify-between`}>
                      <Text style={{ color: colors.mutedForeground }}>Time:</Text>
                      <Text style={{ color: colors.foreground }}>
                        {selectedSlot && formatBookingTime(selectedSlot.startsAt, timeZone)}
                      </Text>
                    </View>
                    <View style={tw`flex-row justify-between`}>
                      <Text style={{ color: colors.mutedForeground }}>Duration:</Text>
                      <Text style={{ color: colors.foreground }}>
                        {selectedService?.duration_minutes} min
                      </Text>
                    </View>
                    <View style={tw`flex-row justify-between`}>
                      <Text style={{ color: colors.mutedForeground }}>Price:</Text>
                      <Text style={{ color: colors.foreground }}>
                        {formatCents(selectedService?.price_cents)}
                      </Text>
                    </View>

                    {selectedAddonIds.length > 0 && (
                      <>
                        <View style={[tw`border-t pt-2 mt-2`, { borderColor: colors.glassBorder }]}>
                          <Text style={[tw`font-medium mb-2`, { color: colors.foreground }]}>
                            Add-ons:
                          </Text>
                          {getSelectedAddons().map((addon) => (
                            <View key={addon.id} style={tw`flex-row justify-between`}>
                              <Text style={{ color: colors.mutedForeground }}>{addon.name}</Text>
                              <Text style={{ color: colors.foreground }}>+{formatCents(addon.price_cents)}</Text>
                            </View>
                          ))}
                        </View>
                        <View style={[tw`flex-row justify-between pt-2 border-t`, { borderColor: colors.glassBorder }]}>
                          <Text style={[tw`font-semibold`, { color: colors.foreground }]}>
                            Total Service Cost:
                          </Text>
                          <Text style={[tw`font-semibold`, { color: colors.primary }]}>
                            {formatCents((selectedService?.price_cents ?? 0) + getSelectedAddonsTotal())}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>

                <View>
                  <Text style={[tw`text-lg font-semibold mb-4`, { color: colors.foreground }]}>
                    Payment
                  </Text>
                  <View style={[tw`p-4 rounded-xl`, { backgroundColor: colors.glass }]}>
                    <View style={tw`flex-row justify-between items-center`}>
                      <Text style={{ color: colors.foreground }}>Booking Fee</Text>
                      <Text style={[tw`font-semibold`, { color: colors.primary }]}>
                        {formatCents(TOTAL_PRICE_CENTS)}
                      </Text>
                    </View>
                    <Text style={[tw`text-sm mt-2`, { color: colors.mutedForeground }]}>
                      You pay the booking fee now to hold your slot; the service and any add-ons are paid to
                      your barber at your appointment. If the barber waives the fee, your booking is confirmed
                      straight away.
                    </Text>
                  </View>
                </View>

                <View style={tw`mt-4`}>
                  <Text style={[tw`text-lg font-semibold mb-4`, { color: colors.foreground }]}>
                    Notes for {barberName}
                  </Text>
                  <Textarea
                    placeholder="Any special requests or notes... (Optional)"
                    value={notes}
                    onChangeText={(text: string) => setNotes(text)}
                    rows={4}
                  />
                  <Text style={[tw`text-sm mt-2`, { color: colors.mutedForeground }]}>
                    Booking as {userProfile?.name || user?.email || 'your account'}.
                  </Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Footer with Navigation */}
        <View style={[tw`p-5 border-t flex-row gap-3`, { borderColor: colors.glassBorder }]}>
          {currentStep > 1 && (
            <View style={tw`flex-1`}>
              <Button variant="outline" size="hero" onPress={handlePrevStep} disabled={bookingLoading}>
                Back
              </Button>
            </View>
          )}

          {currentStep < totalSteps ? (
            <View style={tw`flex-1`}>
              <Button size="hero" onPress={handleNextStep} disabled={!validateStep()}>
                Continue
              </Button>
            </View>
          ) : (
            <View style={tw`flex-1`}>
              <Button size="hero" onPress={handleCreateBooking} disabled={bookingLoading}>
                {bookingLoading ? 'Processing...' : 'Book & Pay'}
              </Button>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
