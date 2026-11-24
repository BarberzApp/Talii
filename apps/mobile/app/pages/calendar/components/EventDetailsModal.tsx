import React from 'react';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, Clock, X } from 'lucide-react-native';
import tw from 'twrnc';
import { useTheme } from '../../../shared/components/theme';
import { formatCents } from '@barber-app/shared';
import type { CalendarEvent } from '../../../shared/lib/calendar';
import { canCancelBooking, canMarkCompleted } from '../../../shared/lib/calendar/calendarUtils';

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
  /** Format an instant in the given (barber's) time zone. */
  formatDate: (date: Date, timeZone: string) => string;
  formatTime: (date: Date, timeZone: string) => string;
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
                    {formatDate(new Date(selectedEvent.start), selectedEvent.extendedProps.timeZone)}
                  </Text>
                </View>

                <View style={tw`flex-row items-center justify-between`}>
                  <View style={tw`flex-row items-center`}>
                    <Clock size={16} color={colors.mutedForeground} style={tw`mr-2`} />
                    <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>Time</Text>
                  </View>
                  <Text style={[tw`font-semibold`, { color: colors.foreground }]}>
                    {formatTime(new Date(selectedEvent.start), selectedEvent.extendedProps.timeZone)}
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
                    : selectedEvent.extendedProps.status === 'no_show'
                    ? { backgroundColor: '#f59e0b', shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }
                    : { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }
                ]}>
                  <Text style={[tw`text-xs font-semibold capitalize`, { color: 'white' }]}>
                    {selectedEvent.extendedProps.status === 'no_show' ? 'no-show' : selectedEvent.extendedProps.status}
                  </Text>
                </View>
              </View>

              {/* Pricing Section (integer cents stored on the booking) */}
              {(() => {
                const p = selectedEvent.extendedProps;
                const clientView = userRole === 'client' || (userRole === 'barber' && barberViewMode === 'bookings');
                const atAppointment = p.servicePriceCents + p.addonTotalCents;
                const row = (label: string, value: string, strong = false) => (
                  <View key={label} style={tw`flex-row items-center justify-between mb-1`}>
                    <Text style={[strong ? tw`font-bold text-lg` : tw`text-sm`, { color: strong ? colors.foreground : colors.mutedForeground }]}>
                      {label}
                    </Text>
                    <Text style={[strong ? tw`font-bold text-lg` : tw`text-sm`, { color: strong ? colors.primary : colors.foreground }]}>
                      {value}
                    </Text>
                  </View>
                );
                return (
                  <View style={tw`mb-4`}>
                    {row('Service', formatCents(p.servicePriceCents))}
                    {p.addonTotalCents > 0 && row(`Add-ons${p.addonNames.length ? ` (${p.addonNames.join(', ')})` : ''}`, formatCents(p.addonTotalCents))}
                    {p.source === 'app' && row(clientView ? 'Booking fee (paid in app)' : 'Booking fee paid by client', formatCents(p.bookingFeeCents))}
                    {clientView
                      ? row('Total', formatCents(atAppointment + p.bookingFeeCents), true)
                      : row('Due at appointment', formatCents(atAppointment), true)}
                    <Text style={[tw`text-xs mt-1`, { color: colors.mutedForeground }]}>
                      {clientView
                        ? 'The service and add-ons are paid to the barber at the appointment.'
                        : p.source === 'manual'
                          ? 'Walk-in added by you; nothing was charged in the app.'
                          : 'Your share of booking fees is shown under Earnings.'}
                    </Text>
                  </View>
                );
              })()}

              {/* Notes */}
              {selectedEvent.extendedProps.notes ? (
                <View style={tw`mb-4`}>
                  <Text style={[tw`text-sm font-semibold mb-2`, { color: colors.foreground }]}>Notes</Text>
                  <Text style={[tw`text-sm`, { color: colors.foreground }]}>{selectedEvent.extendedProps.notes}</Text>
                </View>
              ) : null}

              {/* Action Buttons */}
              {userRole === 'barber' && barberViewMode === 'appointments' && canMarkCompleted(selectedEvent) && (
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
                      <Text style={tw`font-semibold text-white`}>Mark as No-Show</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Cancel Button - for future appointments/bookings that aren't cancelled */}
              {canCancelBooking(selectedEvent) && (
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
