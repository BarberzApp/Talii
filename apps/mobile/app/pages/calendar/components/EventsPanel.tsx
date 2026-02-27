import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Calendar as CalendarIcon, Clock } from 'lucide-react-native';
import { format } from 'date-fns';
import tw from 'twrnc';
import { useTheme } from '../../../shared/components/theme';
import { logger } from '../../../shared/lib/logger';
import type { CalendarEvent } from '../../../shared/lib/calendar';

type Props = {
  selectedDate: Date | null;
  eventsForSelectedDate: CalendarEvent[];
  userRole: 'client' | 'barber' | null;
  barberViewMode: 'appointments' | 'bookings';
  onEventClick: (event: CalendarEvent) => void;
  formatTime: (date: Date) => string;
};

export default function EventsPanel({
  selectedDate,
  eventsForSelectedDate,
  userRole,
  barberViewMode,
  onEventClick,
  formatTime,
}: Props) {
  const { colors } = useTheme();
  if (!selectedDate) return null;

  return (
    <View style={[tw`mt-6 p-6 rounded-2xl`, {
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 32,
      elevation: 8
    }]}>
      <View style={tw`flex-row items-center mb-4`}>
        <CalendarIcon size={20} color={colors.primary} style={tw`mr-2`} />
        <Text style={[tw`font-bold text-lg`, { color: colors.foreground }]}>
          {format(selectedDate, 'EEEE, MMMM d, yyyy')}
        </Text>
      </View>

      <ScrollView style={tw`max-h-80`} showsVerticalScrollIndicator={false}>
        {eventsForSelectedDate.length === 0 ? (
          <View style={tw`items-center py-8`}>
            <CalendarIcon size={48} color={colors.mutedForeground} style={tw`mb-3`} />
            <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>
              No events scheduled for this date
            </Text>
          </View>
        ) : (
          <View style={tw`space-y-3`}>
            {eventsForSelectedDate.map((event) => {
              const eventEnd = new Date(event.end);
              const now = new Date();
              const isPast = eventEnd < now;
              const isMissed = event.extendedProps.status === 'cancelled';

              return (
                <TouchableOpacity
                  key={event.id}
                  onPress={() => onEventClick(event)}
                  style={[tw`p-4 rounded-2xl`, {
                    backgroundColor: isMissed
                      ? colors.destructiveSubtle
                      : isPast
                        ? colors.successSubtle
                        : `${colors.primary}08`,
                    borderWidth: 1,
                    borderColor: isMissed
                      ? colors.destructive
                      : isPast
                        ? colors.success
                        : `${colors.primary}20`
                  }]}
                >
                  <View style={tw`flex-row items-center justify-between`}>
                    <View style={tw`flex-1`}>
                      <Text style={[tw`font-semibold text-sm mb-1`, { color: colors.foreground }]}>
                        {event.extendedProps.serviceName}
                      </Text>
                      <Text style={[tw`text-xs mb-2`, { color: colors.mutedForeground }]}>
                        {event.extendedProps.clientName}
                      </Text>
                      <View style={tw`flex-row items-center`}>
                        <Clock size={12} color={isMissed ? colors.destructive : isPast ? colors.success : colors.primary} style={tw`mr-1`} />
                        <Text style={[tw`text-xs font-medium`, {
                          color: isMissed ? colors.destructive : isPast ? colors.success : colors.primary
                        }]}>
                          {formatTime(new Date(event.start))}
                        </Text>
                      </View>
                    </View>
                    <View style={[tw`px-2 py-1 rounded-full`, {
                      backgroundColor: isMissed
                        ? colors.destructiveSubtle
                        : isPast
                          ? colors.successSubtle
                          : `${colors.primary}20`,
                      borderWidth: 1,
                      borderColor: isMissed
                        ? colors.destructive
                        : isPast
                          ? colors.success
                          : `${colors.primary}30`
                    }]}>
                      <Text style={[tw`text-xs font-semibold`, {
                        color: isMissed ? colors.destructive : isPast ? colors.success : colors.primary
                      }]}>
                        ${(() => {
                          if (userRole === 'client') {
                            let basePrice = event.extendedProps.basePrice || 0;
                            const addons = event.extendedProps.addonTotal || 0;
                            let platformFee = event.extendedProps.platformFee || 0;
                            const storedTotal = event.extendedProps.totalCharged || 0;

                            if (basePrice > 0) {
                              const recalculatedTotal = basePrice + addons + platformFee;
                              return recalculatedTotal.toFixed(2);
                            } else {
                              logger.warn('Calendar event missing basePrice, using stored totalCharged', {
                                eventId: event.id,
                                storedTotal,
                                platformFee,
                                addons
                              });
                              return storedTotal.toFixed(2);
                            }
                          } else {
                            return event.extendedProps.barberPayout.toFixed(2);
                          }
                        })()}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
