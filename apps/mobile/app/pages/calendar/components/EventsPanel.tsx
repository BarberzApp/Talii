import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Calendar as CalendarIcon, Clock } from 'lucide-react-native';
import { format } from 'date-fns';
import tw from 'twrnc';
import { theme } from '../../../shared/lib/theme';
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
  if (!selectedDate) return null;

  return (
    <View style={[tw`mt-6 p-6 rounded-2xl`, {
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 32,
      elevation: 8
    }]}>
      <View style={tw`flex-row items-center mb-4`}>
        <CalendarIcon size={20} color={theme.colors.secondary} style={tw`mr-2`} />
        <Text style={[tw`font-bold text-lg`, { color: theme.colors.foreground }]}>
          {format(selectedDate, 'EEEE, MMMM d, yyyy')}
        </Text>
      </View>

      <ScrollView style={tw`max-h-80`} showsVerticalScrollIndicator={false}>
        {eventsForSelectedDate.length === 0 ? (
          <View style={tw`items-center py-8`}>
            <CalendarIcon size={48} color="rgba(255,255,255,0.3)" style={tw`mb-3`} />
            <Text style={[tw`text-sm`, { color: 'rgba(255,255,255,0.6)' }]}>
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
                      ? 'rgba(239, 68, 68, 0.08)'
                      : isPast
                        ? 'rgba(34, 197, 94, 0.08)'
                        : `${theme.colors.secondary}08`,
                    borderWidth: 1,
                    borderColor: isMissed
                      ? 'rgba(239, 68, 68, 0.2)'
                      : isPast
                        ? 'rgba(34, 197, 94, 0.2)'
                        : `${theme.colors.secondary}20`
                  }]}
                >
                  <View style={tw`flex-row items-center justify-between`}>
                    <View style={tw`flex-1`}>
                      <Text style={[tw`font-semibold text-sm mb-1`, { color: theme.colors.foreground }]}>
                        {event.extendedProps.serviceName}
                      </Text>
                      <Text style={[tw`text-xs mb-2`, { color: 'rgba(255,255,255,0.8)' }]}>
                        {event.extendedProps.clientName}
                      </Text>
                      <View style={tw`flex-row items-center`}>
                        <Clock size={12} color={isMissed ? '#ef4444' : isPast ? '#22c55e' : theme.colors.secondary} style={tw`mr-1`} />
                        <Text style={[tw`text-xs font-medium`, {
                          color: isMissed ? '#ef4444' : isPast ? '#22c55e' : theme.colors.secondary
                        }]}>
                          {formatTime(new Date(event.start))}
                        </Text>
                      </View>
                    </View>
                    <View style={[tw`px-2 py-1 rounded-full`, {
                      backgroundColor: isMissed
                        ? 'rgba(239, 68, 68, 0.2)'
                        : isPast
                          ? 'rgba(34, 197, 94, 0.2)'
                          : `${theme.colors.secondary}20`,
                      borderWidth: 1,
                      borderColor: isMissed
                        ? 'rgba(239, 68, 68, 0.3)'
                        : isPast
                          ? 'rgba(34, 197, 94, 0.3)'
                          : `${theme.colors.secondary}30`
                    }]}>
                      <Text style={[tw`text-xs font-semibold`, {
                        color: isMissed ? '#ef4444' : isPast ? '#22c55e' : theme.colors.secondary
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
