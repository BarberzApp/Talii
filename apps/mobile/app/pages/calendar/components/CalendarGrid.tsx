import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import tw from 'twrnc';
import { isSameDay, isSameMonth, isToday } from 'date-fns';
import { useTheme } from '../../../shared/components/theme';
import type { CalendarEvent } from '../../../shared/lib/calendar';

type Props = {
  months: string[];
  weekdays: string[];
  currentDate: Date;
  selectedDate: Date | null;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onGoToToday: () => void;
  onDateSelect: (date: Date) => void;
  getCalendarDays: () => Date[];
  getEventsForDate: (date: Date) => CalendarEvent[];
  hasPastEvents: (date: Date) => boolean;
  hasUpcomingEvents: (date: Date) => boolean;
  screenWidth: number;
};

export default function CalendarGrid({
  months,
  weekdays,
  currentDate,
  selectedDate,
  onPrevMonth,
  onNextMonth,
  onGoToToday,
  onDateSelect,
  getCalendarDays,
  getEventsForDate,
  hasPastEvents,
  hasUpcomingEvents,
  screenWidth,
}: Props) {
  const { colors } = useTheme();
  return (
    <>
      {/* Header with Navigation - Enhanced */}
      <View style={[tw`flex-row items-center justify-between mb-6 p-4 rounded-2xl`, {
        backgroundColor: colors.glass,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 32,
        elevation: 8
      }]}>
        <TouchableOpacity
          testID="prev-month-button"
          onPress={onPrevMonth}
          style={[tw`p-3 rounded-2xl items-center justify-center`, {
            backgroundColor: `${colors.primary}15`,
            borderWidth: 1,
            borderColor: `${colors.primary}30`,
            minWidth: 52,
            minHeight: 52
          }]}
        >
          <ChevronLeft size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[tw`text-xl font-bold text-center flex-1 mx-6`, {
          color: colors.foreground,
          textShadowColor: colors.backdrop,
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 4
        }]}>
          {`${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
        </Text>
        <TouchableOpacity
          testID="next-month-button"
          onPress={onNextMonth}
          style={[tw`p-3 rounded-2xl items-center justify-center`, {
            backgroundColor: `${colors.primary}15`,
            borderWidth: 1,
            borderColor: `${colors.primary}30`,
            minWidth: 52,
            minHeight: 52
          }]}
        >
          <ChevronRight size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Weekdays Header */}
      <View style={[tw`flex-row mb-4 px-4`]}>
        {weekdays.map((day, index) => (
          <View key={index} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 8 }}>
            <Text style={[tw`text-xs font-bold uppercase tracking-wider text-center`, {
              color: colors.primary,
              fontSize: 12,
              textShadowColor: colors.backdrop,
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 2
            }]}>
              {day}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={[tw`flex-row flex-wrap px-4`]}>
        {getCalendarDays().map((date, index) => {
          const isCurrentMonth = isSameMonth(date, currentDate);
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          const isTodayDate = isToday(date);
          const dateEvents = getEventsForDate(date);
          const hasPast = hasPastEvents(date);
          const hasUpcoming = hasUpcomingEvents(date);

          return (
            <TouchableOpacity
              key={index}
              onPress={() => onDateSelect(date)}
              style={{
                width: `${100 / 7}%`,
                height: 45,
                alignItems: 'center',
                justifyContent: 'center',
                marginVertical: 4,
                borderRadius: 14,
                backgroundColor: isCurrentMonth
                  ? colors.glass
                  : 'transparent',
                borderWidth: isSelected ? 2 : 1,
                borderColor: isSelected
                  ? colors.primary
                  : colors.glassBorder,
                transform: [{ scale: isSelected ? 1.02 : 1 }],
                shadowColor: isSelected ? colors.primary : 'transparent',
                shadowOffset: { width: 0, height: isSelected ? 1 : 0 },
                shadowOpacity: isSelected ? 0.08 : 0,
                shadowRadius: isSelected ? 6 : 0,
                elevation: isSelected ? 1 : 0,
              }}
            >
              <Text style={[
                tw`font-semibold`,
                {
                  fontSize: screenWidth < 400 ? 14 : 16,
                  lineHeight: screenWidth < 400 ? 18 : 20,
                  textAlign: 'center',
                  color: isSelected || isTodayDate
                    ? colors.primary
                    : isCurrentMonth
                      ? colors.foreground
                      : colors.mutedForeground,
                }
              ]}>
                {date.getDate()}
              </Text>

              {/* Event indicators */}
              {dateEvents.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                  {hasPast && (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success }} />
                  )}
                  {hasUpcoming && (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Today Button - Enhanced with glow */}
      <View
        style={{
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.2,
          shadowRadius: 15,
          elevation: 5,
        }}
      >
        <TouchableOpacity
          onPress={onGoToToday}
          style={[tw`mt-6 py-4 rounded-2xl items-center`, {
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 25,
            elevation: 8
          }]}
        >
          <Text style={[tw`font-bold text-lg`, {
            color: colors.primaryForeground,
            textShadowColor: colors.backdrop,
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 2
          }]}>
            Today
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
