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
import { supabase } from '../../lib/supabase';
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

  useEffect(() => {
    if (barberId) {
      loadAvailability();
    }
  }, [barberId]);

  const loadAvailability = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('availability')
        .select('*')
        .eq('barber_id', barberId);

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedSchedule = DAYS_OF_WEEK.map(day => {
          const dayNumber = DAY_TO_NUMBER[day];
          const dayData = data.find(d => d.day_of_week === dayNumber);
          if (dayData) {
            return {
              day,
              enabled: true,
              slots: [{
                start: dayData.start_time.slice(0, 5),
                end: dayData.end_time.slice(0, 5)
              }]
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
      Alert.alert('Error', 'Failed to load availability');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Delete existing availability
      const { error: deleteError } = await supabase
        .from('availability')
        .delete()
        .eq('barber_id', barberId);

      if (deleteError) throw deleteError;

      // Insert new availability
      const availabilityData = schedule
        .filter(day => day.enabled)
        .map(day => ({
          barber_id: barberId,
          day_of_week: DAY_TO_NUMBER[day.day],
          start_time: day.slots[0].start + ':00',
          end_time: day.slots[0].end + ':00'
        }));

      if (availabilityData.length > 0) {
        const { error: insertError } = await supabase
          .from('availability')
          .insert(availabilityData);

        if (insertError) throw insertError;
      }

      Alert.alert('Success', 'Availability updated successfully');
      onUpdate?.();
    } catch (error) {
      logger.error('Error saving availability:', error);
      Alert.alert('Error', 'Failed to save availability');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDay = (dayIndex: number) => {
    const newSchedule = [...schedule];
    newSchedule[dayIndex].enabled = !newSchedule[dayIndex].enabled;
    setSchedule(newSchedule);
  };

  const updateTimeSlot = (dayIndex: number, field: 'start' | 'end', value: string) => {
    const newSchedule = [...schedule];
    newSchedule[dayIndex].slots[0][field] = value;
    setSchedule(newSchedule);
  };

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
                <View style={tw`flex-row items-center gap-3`}>
                  <View style={tw`flex-1`}>
<Text style={[tw`text-sm mb-2`, { color: colors.mutedForeground }]}>
                    Start Time
                    </Text>
                    <View style={[
                      tw`rounded-xl overflow-hidden`,
                      { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder }
                    ]}>
                      <Picker
                        selectedValue={day.slots[0].start}
                        onValueChange={(value) => updateTimeSlot(index, 'start', value)}
                        style={{ color: colors.foreground }}
                        itemStyle={{ color: colors.foreground }}
                      >
                        {TIME_OPTIONS.map((option) => (
                          <Picker.Item 
                            key={option.value} 
                            label={option.label} 
                            value={option.value} 
                            color={colors.foreground}
                          />
                        ))}
                      </Picker>
                    </View>
                  </View>

                  <View style={tw`flex-1`}>
<Text style={[tw`text-sm mb-2`, { color: colors.mutedForeground }]}>
                    End Time
                    </Text>
                    <View style={[
                      tw`rounded-xl overflow-hidden`,
                      { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder }
                    ]}>
                      <Picker
                        selectedValue={day.slots[0].end}
                        onValueChange={(value) => updateTimeSlot(index, 'end', value)}
                        style={{ color: colors.foreground }}
                        itemStyle={{ color: colors.foreground }}
                      >
                        {TIME_OPTIONS.map((option) => (
                          <Picker.Item 
                            key={option.value} 
                            label={option.label} 
                            value={option.value} 
                            color={colors.foreground}
                          />
                        ))}
                      </Picker>
                    </View>
                  </View>
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
        disabled={isSaving}
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