import React from 'react';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, Clock, X } from 'lucide-react-native';
import tw from 'twrnc';
import { useTheme } from '../../../shared/components/theme';
import type { CalendarEvent } from '../../../shared/lib/calendar';

type Props = {
  visible: boolean;
  selectedEvent: CalendarEvent | null;
  userRole: 'client' | 'barber' | null;
  barberViewMode: 'appointments' | 'bookings';
  onClose: () => void;
  onMarkCompleted: () => void;
  onMarkMissed: () => void;
  onCancelBooking: () => void;
  onLeaveReview: () => void;
  isMarkingCompleted: boolean;
  isMarkingMissed: boolean;
  formatDate: (date: Date) => string;
  formatTime: (date: Date) => string;
};

export default function EventDetailsModal({
  visible,
  selectedEvent,
  userRole,
  barberViewMode,
  onClose,
  onMarkCompleted,
  onMarkMissed,
  onCancelBooking,
  onLeaveReview,
  isMarkingCompleted,
  isMarkingMissed,
  formatDate,
  formatTime,
}: Props) {
  const { colors } = useTheme();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={tw`flex-1 bg-black/50 justify-end`}>
        <View style={[tw`rounded-t-3xl p-6`, {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderColor: colors.border
        }]}>
          <View style={tw`flex-row items-center justify-between mb-6`}>
            <Text style={[tw`text-xl font-bold`, { color: colors.foreground }]}>
              {userRole === 'barber' && barberViewMode === 'appointments'
                ? 'Appointment Details'
                : 'Booking Details'
              }
            </Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {selectedEvent && (
            <View style={tw`space-y-4`}>
              {/* Header Section */}
              <View style={tw`items-center mb-4`}>
                <Text style={[tw`text-xl font-bold mb-1`, { color: colors.foreground }]}>
                  {userRole === 'barber' && barberViewMode === 'appointments'
                    ? 'Appointment Details'
                    : 'Booking Details'
                  }
                </Text>
                <Text style={[tw`text-lg font-semibold mb-1`, { color: colors.foreground }]}>
                  {userRole === 'client'
                    ? selectedEvent.extendedProps.barberName
                    : userRole === 'barber' && barberViewMode === 'appointments'
                    ? selectedEvent.extendedProps.clientName
                    : selectedEvent.extendedProps.barberName
                  }
                </Text>
                <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>
                  {userRole === 'barber' && barberViewMode === 'appointments'
                    ? `Appointment #${selectedEvent.id.slice(0, 8).toUpperCase()}`
                    : `Booking #${selectedEvent.id.slice(0, 8).toUpperCase()}`
                  }
                </Text>
              </View>

              {/* Service Section */}
              <View style={tw`mb-4`}>
                <Text style={[tw`text-sm font-semibold mb-2`, { color: colors.foreground }]}>
                  Service
                </Text>
                <Text style={[tw`text-base`, { color: colors.foreground }]}>
                  {selectedEvent.extendedProps.serviceName}
                </Text>
              </View>

              {/* Date & Time Section */}
              <View style={tw`mb-4`}>
                <View style={tw`flex-row items-center justify-between mb-2`}>
                  <View style={tw`flex-row items-center`}>
                    <Calendar size={16} color={colors.mutedForeground} style={tw`mr-2`} />
                    <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>Date</Text>
                  </View>
                  <Text style={[tw`font-semibold`, { color: colors.foreground }]}>
                    {formatDate(new Date(selectedEvent.start))}
                  </Text>
                </View>

                <View style={tw`flex-row items-center justify-between`}>
                  <View style={tw`flex-row items-center`}>
                    <Clock size={16} color={colors.mutedForeground} style={tw`mr-2`} />
                    <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>Time</Text>
                  </View>
                  <Text style={[tw`font-semibold`, { color: colors.foreground }]}>
                    {formatTime(new Date(selectedEvent.start))}
                  </Text>
                </View>
              </View>

              {/* Status Section */}
              <View style={tw`mb-4`}>
                <Text style={[tw`text-sm font-semibold mb-2`, { color: colors.foreground }]}>
                  Status
                </Text>
                <View style={[
                  tw`self-end px-3 py-1 rounded-full`,
                  selectedEvent.extendedProps.status === 'completed'
                    ? { backgroundColor: '#10b981', shadowColor: '#10b981', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }
                    : selectedEvent.extendedProps.status === 'cancelled'
                    ? { backgroundColor: '#ef4444', shadowColor: '#ef4444', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }
                    : selectedEvent.extendedProps.status === 'missed'
                    ? { backgroundColor: '#f59e0b', shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }
                    : { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }
                ]}>
                  <Text style={[tw`text-xs font-semibold capitalize`, { color: 'white' }]}>
                    {selectedEvent.extendedProps.status}
                  </Text>
                </View>
              </View>

              {/* Pricing Section */}
              {(() => {
                const breakdown = userRole === 'client'
                  ? {
                      servicePrice: selectedEvent.extendedProps.basePrice,
                      addons: selectedEvent.extendedProps.addonTotal,
                      platformFee: selectedEvent.extendedProps.platformFee,
                      total: selectedEvent.extendedProps.totalCharged,
                    }
                  : {
                      servicePrice: selectedEvent.extendedProps.basePrice,
                      addons: selectedEvent.extendedProps.addonTotal,
                      platformFee: selectedEvent.extendedProps.platformFee,
                      total: selectedEvent.extendedProps.totalCharged,
                      barberPayout: selectedEvent.extendedProps.barberPayout,
                    };

                return (
                  <>
                    {/* Total Section */}
                    <View style={tw`mb-4`}>
                      {userRole === 'client' || (userRole === 'barber' && barberViewMode === 'bookings') ? (
                        <>
                          <View style={tw`flex-row items-center justify-between`}>
                            <Text style={[tw`font-bold text-lg`, { color: colors.foreground }]}>
                              Total Charged
                            </Text>
                            <Text style={[tw`font-bold text-lg`, { color: colors.primary }]}>
                              ${breakdown.total.toFixed(2)}
                            </Text>
                          </View>
                          <Text style={[tw`text-xs mt-1`, { color: colors.mutedForeground }]}>
                            Total amount charged to you
                          </Text>
                        </>
                      ) : (
                        <>
                          <View style={tw`flex-row items-center justify-between`}>
                            <Text style={[tw`font-bold text-lg`, { color: colors.foreground }]}>
                              Your Payout
                            </Text>
                            <Text style={[tw`font-bold text-lg`, { color: colors.primary }]}>
                              ${breakdown.barberPayout?.toFixed(2) || '0.00'}
                            </Text>
                          </View>
                          <Text style={[tw`text-xs mt-1`, { color: colors.mutedForeground }]}>
                            Amount you&apos;ll receive for this appointment
                          </Text>
                        </>
                      )}
                    </View>
                  </>
                );
              })()}

              {/* Guest Information (if applicable) */}
              {selectedEvent.extendedProps.isGuest && (
                <View style={tw`mb-4`}>
                  <Text style={[tw`text-sm font-semibold mb-2`, { color: colors.foreground }]}>
                    Guest Information
                  </Text>
                  <View style={tw`space-y-1`}>
                    <Text style={[tw`text-sm`, { color: colors.foreground }]}>
                      Email: {selectedEvent.extendedProps.guestEmail}
                    </Text>
                    <Text style={[tw`text-sm`, { color: colors.foreground }]}>
                      Phone: {selectedEvent.extendedProps.guestPhone}
                    </Text>
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              {selectedEvent.extendedProps.status === 'pending' && (
                <View style={tw`flex-row gap-3 mt-6`}>
                  <TouchableOpacity
                    onPress={onMarkCompleted}
                    disabled={isMarkingCompleted}
                    style={[tw`flex-1 py-3 rounded-xl items-center`, {
                      backgroundColor: '#10b981',
                      shadowColor: '#10b981',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.3,
                      shadowRadius: 4,
                      elevation: 4
                    }]}
                  >
                    {isMarkingCompleted ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text style={tw`font-semibold text-white`}>Mark as Completed</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onMarkMissed}
                    disabled={isMarkingMissed}
                    style={[tw`flex-1 py-3 rounded-xl items-center`, {
                      backgroundColor: colors.primary,
                      shadowColor: colors.primary,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.3,
                      shadowRadius: 4,
                      elevation: 4
                    }]}
                  >
                    {isMarkingMissed ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text style={tw`font-semibold text-white`}>Mark as Missed</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Cancel Button - for future appointments/bookings that aren't cancelled */}
              {selectedEvent.extendedProps.status !== 'cancelled' &&
               selectedEvent.extendedProps.status !== 'completed' &&
               selectedEvent.extendedProps.status !== 'missed' &&
               new Date(selectedEvent.start) > new Date() && (
                <View style={tw`mt-6`}>
                  <TouchableOpacity
                    onPress={onCancelBooking}
                    style={[tw`py-3 rounded-xl items-center`, {
                      backgroundColor: '#ef4444',
                      shadowColor: '#ef4444',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.3,
                      shadowRadius: 4,
                      elevation: 4
                    }]}
                  >
                    <Text style={tw`font-semibold text-white`}>
                      {userRole === 'barber' && barberViewMode === 'appointments'
                        ? 'Cancel Appointment'
                        : 'Cancel Booking'
                      }
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Leave Review Button for Completed Bookings/Appointments */}
              {selectedEvent.extendedProps.status === 'completed' && userRole === 'client' && (
                <View style={tw`mt-6`}>
                  <TouchableOpacity
                    onPress={onLeaveReview}
                    style={[tw`py-3 rounded-xl items-center`, {
                      backgroundColor: '#3b82f6',
                      shadowColor: '#3b82f6',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.3,
                      shadowRadius: 4,
                      elevation: 4
                    }]}
                  >
                    <Text style={tw`font-semibold text-white`}>Leave Review</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
