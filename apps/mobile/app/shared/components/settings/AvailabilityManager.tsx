import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import tw from 'twrnc';
import { useTheme } from '../theme/ThemeProvider';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { logger } from '../../lib/logger';
import { Card, CardContent, LoadingSpinner } from '../ui';
import { 
  Calendar,
  Clock,
  Save,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw
} from 'lucide-react-native';

interface TimeSlot {
  start: string;
  end: string;
}

interface DaySchedule {
  day: string;
  enabled: boolean;
  slots: TimeSlot[];
}

interface AvailabilityManagerProps {
  barberId: string;
  onUpdate?: () => void;
}

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

// Map day names to JavaScript day numbers (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
const DAY_TO_NUMBER: Record<string, number> = {
  'Sunday': 0,
  'Monday': 1,
  'Tuesday': 2,
  'Wednesday': 3,
  'Thursday': 4,
  'Friday': 5,
  'Saturday': 6
};

// Map JavaScript day numbers to day names
const NUMBER_TO_DAY: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday'
};

const generateTimeOptions = () => {
  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const m = minute.toString().padStart(2, '0');
      const ampm = hour < 12 ? 'AM' : 'PM';
      const value = `${hour.toString().padStart(2, '0')}:${m}`;
      const label = `${h}:${m} ${ampm}`;
      options.push({ value, label });
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

/**
 * The first problem with a week of windows, or null: end after start, and no
 * overlapping windows on a day (touching is fine). The server enforces the same.
 */
export function findScheduleProblem(
  windows: Array<{ dayOfWeek: number; startTime: string; endTime: string }>
): string | null {
  for (const w of windows) {
    if (w.startTime >= w.endTime) {
      return `${NUMBER_TO_DAY[w.dayOfWeek]}: the end time must be after the start time.`;
    }
  }
  for (let day = 0; day < 7; day += 1) {
    const sorted = windows.filter(w => w.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].startTime < sorted[i - 1].endTime) {
        return `${NUMBER_TO_DAY[day]}: ${sorted[i - 1].startTime}-${sorted[i - 1].endTime} and ${sorted[i].startTime}-${sorted[i].endTime} overlap.`;
      }
    }
  }
  return null;
}

export function AvailabilityManager({ barberId, onUpdate }: AvailabilityManagerProps) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [schedule, setSchedule] = useState<DaySchedule[]>(
    DAYS_OF_WEEK.map(day => ({
      day,
      enabled: false,
      slots: [{ start: '09:00', end: '17:00' }]
    }))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  /** Set when the saved week could not be loaded: saving then would replace it with an empty week. */
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadAvailability();
    }
  }, [user]);

  /** GET /api/me/availability: weekly windows, local times in the barber's time zone. */
  const loadAvailability = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const { availability } = await api.schedule.getWeek();

      if (availability.length > 0) {
        const loadedSchedule = DAYS_OF_WEEK.map(day => {
          const windows = availability
            .filter(w => w.day_of_week === DAY_TO_NUMBER[day])
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
          if (windows.length > 0) {
            // Every window of the day is shown and editable (e.g. a split shift).
            return {
              day,
              enabled: true,
              slots: windows.map(w => ({ start: w.start_time.slice(0, 5), end: w.end_time.slice(0, 5) })),
            };
          }
          return {
            day,
            enabled: false,
            slots: [{ start: '09:00', end: '17:00' }]
          };
        });
        setSchedule(loadedSchedule);
      }
    } catch (error) {
      logger.error('Error loading availability:', error);
      setLoadError(errorMessage(error, 'Failed to load availability'));
    } finally {
      setIsLoading(false);
    }
  };

  /** PUT /api/me/availability replaces the whole week in one transaction. */
  const handleSave = async () => {
    if (loadError) return; // never replace a week we could not read
    const windows = schedule
      .filter(day => day.enabled)
      .flatMap(day =>
        day.slots.map(slot => ({ dayOfWeek: DAY_TO_NUMBER[day.day], startTime: slot.start, endTime: slot.end }))
      );

    const problem = findScheduleProblem(windows);
    if (problem) {
      Alert.alert('Invalid hours', problem);
      return;
    }

    try {
      setIsSaving(true);
      await api.schedule.replaceWeek(windows);
      Alert.alert('Success', 'Availability updated successfully');
      onUpdate?.();
    } catch (error) {
      logger.error('Error saving availability:', error);
      Alert.alert('Error', errorMessage(error, 'Failed to save availability'));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDay = (dayIndex: number) => {
    const newSchedule = [...schedule];
    newSchedule[dayIndex].enabled = !newSchedule[dayIndex].enabled;
    setSchedule(newSchedule);
  };

  const updateTimeSlot = (dayIndex: number, slotIndex: number, field: 'start' | 'end', value: string) => {
    setSchedule(prev =>
      prev.map((day, i) =>
        i !== dayIndex
          ? day
          : { ...day, slots: day.slots.map((slot, j) => (j === slotIndex ? { ...slot, [field]: value } : slot)) }
      )
    );
  };

  /** Adds a window after the day's last one (e.g. the afternoon of a split shift). */
  const addTimeSlot = (dayIndex: number) => {
    setSchedule(prev =>
      prev.map((day, i) => {
        if (i !== dayIndex) return day;
        const lastEnd = day.slots[day.slots.length - 1]?.end ?? '09:00';
        const start = lastEnd < '22:00' ? lastEnd : '09:00';
        const [h, m] = start.split(':').map(Number);
        const endMinutes = Math.min(h * 60 + m + 120, 23 * 60 + 30); // two hours, at most 11:30 PM
        const end = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
        return { ...day, slots: [...day.slots, { start, end }] };
      })
    );
  };

  const removeTimeSlot = (dayIndex: number, slotIndex: number) => {
    setSchedule(prev =>
      prev.map((day, i) =>
        i !== dayIndex || day.slots.length <= 1 ? day : { ...day, slots: day.slots.filter((_, j) => j !== slotIndex) }
      )
    );
  };

  const renderTimePicker = (dayIndex: number, slotIndex: number, field: 'start' | 'end', value: string) => (
    <View style={tw`flex-1`}>
      <Text style={[tw`text-sm mb-2`, { color: colors.mutedForeground }]}>
        {field === 'start' ? 'Start Time' : 'End Time'}
      </Text>
      <View style={[tw`rounded-xl overflow-hidden`, { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder }]}>
        <Picker
          testID={`${field}-${dayIndex}-${slotIndex}`}
          selectedValue={value}
          onValueChange={(v) => updateTimeSlot(dayIndex, slotIndex, field, v)}
          style={{ color: colors.foreground }}
          itemStyle={{ color: colors.foreground }}
        >
          {TIME_OPTIONS.map((option) => (
            <Picker.Item key={option.value} label={option.label} value={option.value} color={colors.foreground} />
          ))}
        </Picker>
      </View>
    </View>
  );

  const getAvailableDaysCount = () => {
    return schedule.filter(day => day.enabled).length;
  };

  if (isLoading) {
    return (
      <Card style={[{ backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
        <CardContent style={tw`p-6 items-center`}>
          <Loader2 size={32} color={colors.primary} style={tw`mb-3`} />
          <Text style={[tw`text-base`, { color: colors.mutedForeground }]}>
            Loading availability...
          </Text>
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card style={[{ backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
        <CardContent style={tw`p-6 items-center`}>
          <AlertCircle size={28} color={colors.destructive} style={tw`mb-3`} />
          <Text testID="availability-load-error" style={[tw`text-base text-center mb-4`, { color: colors.foreground }]}>
            {loadError}. Your saved hours were not changed.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={loadAvailability}
            style={[tw`px-5 py-3 rounded-xl flex-row items-center`, { backgroundColor: colors.primary }]}
          >
            <RefreshCw size={16} color={colors.primaryForeground} style={tw`mr-2`} />
            <Text style={[tw`font-semibold`, { color: colors.primaryForeground }]}>Retry</Text>
          </TouchableOpacity>
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-24`}>
      {/* Header */}
      <Card style={[tw`mb-6`, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
        <CardContent style={tw`p-4`}>
          <View style={tw`flex-row items-center justify-between`}>
            <View style={tw`flex-row items-center`}>
              <View style={[tw`p-2 rounded-xl mr-3`, { backgroundColor: colors.primarySubtle }]}>
                <Calendar size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[tw`text-lg font-semibold`, { color: colors.foreground }]}>
                  Weekly Schedule
                </Text>
                <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>
                  Set your working hours
                </Text>
              </View>
            </View>
            <View style={[tw`px-3 py-1 rounded-full`, { backgroundColor: colors.primarySubtle }]}>
              <Text style={[tw`text-sm font-bold`, { color: colors.primary }]}>
                {getAvailableDaysCount()} days
              </Text>
            </View>
          </View>
        </CardContent>
      </Card>

      {/* Days Schedule */}
      <View style={tw`gap-3`}>
        {schedule.map((day, index) => (
          <Card key={day.day} style={[{ backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
            <CardContent style={tw`p-4`}>
              <View style={tw`flex-row items-center justify-between mb-3`}>
                <Text style={[tw`text-base font-semibold`, { color: colors.foreground }]}>
                  {day.day}
                </Text>
                <Switch
                  value={day.enabled}
                  onValueChange={() => toggleDay(index)}
                  trackColor={{ false: colors.input, true: colors.primary }}
                  thumbColor={colors.foreground}
                />
              </View>

              {day.enabled && (
                <View style={tw`gap-3`}>
                  {day.slots.map((slot, slotIndex) => (
                    <View key={slotIndex} style={tw`flex-row items-end gap-3`}>
                      {renderTimePicker(index, slotIndex, 'start', slot.start)}
                      {renderTimePicker(index, slotIndex, 'end', slot.end)}
                      {day.slots.length > 1 && (
                        <TouchableOpacity
                          accessibilityLabel={`Remove ${day.day} hours ${slotIndex + 1}`}
                          onPress={() => removeTimeSlot(index, slotIndex)}
                          style={tw`pb-3`}
                        >
                          <Text style={[tw`text-sm`, { color: colors.destructive }]}>Remove</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  <TouchableOpacity onPress={() => addTimeSlot(index)} accessibilityRole="button">
                    <Text style={[tw`text-sm font-medium`, { color: colors.primary }]}>+ Add hours</Text>
                  </TouchableOpacity>
                </View>
              )}
            </CardContent>
          </Card>
        ))}
      </View>

      {/* Status Alert */}
      {getAvailableDaysCount() === 0 && (
        <View style={[tw`mt-6 p-4 rounded-xl flex-row items-start`, { backgroundColor: colors.primarySubtle, borderWidth: 1, borderColor: colors.primarySubtle }]}>
          <AlertCircle size={16} color={colors.accent} style={tw`mr-2 mt-0.5`} />
          <View style={tw`flex-1`}>
            <Text style={[tw`text-sm`, { color: colors.accent }]}>
              You haven&apos;t set any available days. Clients won&apos;t be able to book appointments until you set your schedule.
            </Text>
          </View>
        </View>
      )}

      {/* Save Button */}
      <TouchableOpacity
        style={[tw`mt-6 py-4 rounded-xl flex-row items-center justify-center`, { backgroundColor: colors.primary }]}
        onPress={handleSave}
        disabled={isSaving || !!loadError}
      >
        {isSaving ? (
          <LoadingSpinner color={colors.primaryForeground} />
        ) : (
          <>
            <Save size={20} color={colors.primaryForeground} style={tw`mr-2`} />
            <Text style={[tw`font-semibold text-base`, { color: colors.primaryForeground }]}>
              Save Schedule
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Tips */}
      <Card style={[tw`mt-6`, { backgroundColor: colors.primarySubtle, borderColor: colors.primarySubtle }]}>
        <CardContent style={tw`p-4`}>
          <View style={tw`flex-row items-start`}>
            <CheckCircle size={16} color={colors.primary} style={tw`mr-2 mt-0.5`} />
            <View style={tw`flex-1`}>
              <Text style={[tw`text-sm font-semibold mb-2`, { color: colors.foreground }]}>
                Quick Tips
              </Text>
              <View style={tw`gap-1`}>
                {[
                  'Set realistic hours to avoid overbooking',
                  'Update your schedule regularly',
                  'Consider breaks between appointments',
                  'Disable days when you\'re not available'
                ].map((tip, index) => (
                  <View key={index} style={tw`flex-row items-start`}>
                    <Text style={[tw`text-xs mr-1`, { color: colors.primary }]}>•</Text>
                    <Text style={[tw`text-xs flex-1`, { color: colors.foreground, opacity: 0.8 }]}>
                      {tip}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </CardContent>
      </Card>
    </ScrollView>
  );
} 