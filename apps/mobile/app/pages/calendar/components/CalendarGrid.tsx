import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import tw from 'twrnc';
import { isSameDay, isSameMonth, isToday } from 'date-fns';
import { theme } from '../../../shared/lib/theme';
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
  return (
    <>
      {/* Header with Navigation - Enhanced */}
      <View style={[tw`flex-row items-center justify-between mb-6 p-4 rounded-2xl`, {
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
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
            backgroundColor: `${theme.colors.secondary}15`,
            borderWidth: 1,
            borderColor: `${theme.colors.secondary}30`,
            minWidth: 52,
            minHeight: 52
          }]}
        >
          <ChevronLeft size={24} color={theme.colors.secondary} />
        </TouchableOpacity>
        <Text style={[tw`text-xl font-bold text-center flex-1 mx-6`, {
          color: theme.colors.foreground,
          textShadowColor: 'rgba(0, 0, 0, 0.3)',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 4
        }]}>
          {`${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
        </Text>
        <TouchableOpacity
          testID="next-month-button"
          onPress={onNextMonth}
          style={[tw`p-3 rounded-2xl items-center justify-center`, {
            backgroundColor: `${theme.colors.secondary}15`,
            borderWidth: 1,
            borderColor: `${theme.colors.secondary}30`,
            minWidth: 52,
            minHeight: 52
          }]}
        >
          <ChevronRight size={24} color={theme.colors.secondary} />
        </TouchableOpacity>
      </View>

      {/* Weekdays Header */}
      <View style={[tw`flex-row mb-4 px-4`]}>
        {weekdays.map((day, index) => (
          <View key={index} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 8 }}>
            <Text style={[tw`text-xs font-bold uppercase tracking-wider text-center`, {
              color: theme.colors.secondary,
              fontSize: 12,
              textShadowColor: 'rgba(0, 0, 0, 0.3)',
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
                  ? 'rgba(255,255,255,0.02)'
                  : 'rgba(255,255,255,0.005)',
                borderWidth: isSelected ? 2 : 1,
                borderColor: isSelected
                  ? theme.colors.secondary
                  : 'rgba(255,255,255,0.03)',
                transform: [{ scale: isSelected ? 1.02 : 1 }],
                shadowColor: isSelected ? theme.colors.secondary : 'transparent',
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
                    ? theme.colors.secondary
                    : isCurrentMonth
                      ? theme.colors.foreground
                      : 'rgba(255,255,255,0.15)',
                }
              ]}>
                {date.getDate()}
              </Text>

              {/* Event indicators */}
              {dateEvents.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                  {hasPast && (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' }} />
                  )}
                  {hasUpcoming && (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.secondary }} />
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
          shadowColor: theme.colors.secondary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.2,
          shadowRadius: 15,
          elevation: 5,
        }}
      >
        <TouchableOpacity
          onPress={onGoToToday}
          style={[tw`mt-6 py-4 rounded-2xl items-center`, {
            backgroundColor: theme.colors.secondary,
            shadowColor: theme.colors.secondary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 25,
            elevation: 8
          }]}
        >
          <Text style={[tw`font-bold text-lg`, {
            color: theme.colors.primaryForeground,
            textShadowColor: 'rgba(0, 0, 0, 0.2)',
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
