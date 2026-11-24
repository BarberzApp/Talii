import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Calendar as CalendarIcon, Clock } from 'lucide-react-native';
import tw from 'twrnc';
import { formatBookingTime, formatInTimeZone } from '@barber-app/shared';
import { useTheme } from '../../../shared/components/theme';
import type { CalendarEvent } from '../../../shared/lib/calendar';

type Props = {
  /** Today's events on the barber's calendar (already filtered to the day). */
  events: CalendarEvent[];
  /** The barber's IANA time zone; times and the date heading use it. */
  timeZone: string;
  onEventClick: (event: CalendarEvent) => void;
  onShowMonth: () => void;
  now?: Date;
};

const isActive = (event: CalendarEvent) =>
  event.extendedProps.status === 'confirmed' || event.extendedProps.status === 'pending';

/** The barber's calendar landing view: today's appointments in time order, next one highlighted. */
export default function TodayAgenda({ events, timeZone, onEventClick, onShowMonth, now = new Date() }: Props) {
  const { colors } = useTheme();
  const sorted = [...events].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const next = sorted.find((event) => isActive(event) && Date.parse(event.end) > now.getTime());

  return (
    <View
      testID="today-agenda"
      style={[tw`mx-5 mb-6 p-5 rounded-3xl`, { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder }]}
    >
      <View style={tw`flex-row items-center justify-between mb-4`}>
        <View style={tw`flex-1 mr-3`}>
          <Text style={[tw`font-bold text-lg`, { color: colors.foreground }]}>Today</Text>
          <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>
            {formatInTimeZone(now, timeZone, { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={onShowMonth}
          style={[tw`flex-row items-center px-4 py-2 rounded-full`, { backgroundColor: `${colors.primary}20`, borderWidth: 1, borderColor: `${colors.primary}30` }]}
        >
          <CalendarIcon size={14} color={colors.primary} style={tw`mr-2`} />
          <Text style={[tw`text-sm font-semibold`, { color: colors.primary }]}>Month</Text>
        </TouchableOpacity>
      </View>

      {sorted.length === 0 ? (
        <View style={tw`items-center py-8`}>
          <CalendarIcon size={40} color={colors.mutedForeground} style={tw`mb-3`} />
          <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>No appointments today</Text>
        </View>
      ) : (
        <View style={tw`gap-3`}>
          {sorted.map((event) => {
            const isNext = event.id === next?.id;
            const isMissed = event.extendedProps.status === 'cancelled' || event.extendedProps.status === 'no_show';
            const isDone = event.extendedProps.status === 'completed';
            const accent = isMissed ? colors.destructive : isDone ? colors.success : colors.primary;
            return (
              <TouchableOpacity
                key={event.id}
                testID={isNext ? 'agenda-next' : undefined}
                onPress={() => onEventClick(event)}
                style={[
                  tw`p-4 rounded-2xl`,
                  {
                    backgroundColor: isMissed ? colors.destructiveSubtle : isDone ? colors.successSubtle : isNext ? `${colors.primary}20` : `${colors.primary}08`,
                    borderWidth: isNext ? 2 : 1,
                    borderColor: isNext ? colors.primary : isMissed ? colors.destructive : isDone ? colors.success : `${colors.primary}20`,
                  },
                ]}
              >
                {isNext && (
                  <Text style={[tw`text-xs font-bold mb-1`, { color: colors.primary }]}>NEXT UP</Text>
                )}
                <View style={tw`flex-row items-center justify-between`}>
                  <View style={tw`flex-1 mr-3`}>
                    <Text style={[tw`font-semibold text-sm mb-1`, { color: colors.foreground }]} numberOfLines={1}>
                      {event.extendedProps.serviceName}
                    </Text>
                    <Text style={[tw`text-xs`, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {event.extendedProps.clientName}
                    </Text>
                  </View>
                  <View style={tw`flex-row items-center`}>
                    <Clock size={12} color={accent} style={tw`mr-1`} />
                    <Text style={[tw`text-sm font-medium`, { color: accent }]}>
                      {formatBookingTime(event.start, event.extendedProps.timeZone)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}
