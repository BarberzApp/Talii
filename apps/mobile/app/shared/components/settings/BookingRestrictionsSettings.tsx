import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput
} from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../theme/ThemeProvider';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { logger } from '../../lib/logger';
import { Card, CardContent, LoadingSpinner } from '../ui';
import { 
  Settings,
  Clock,
  Calendar,
  Users,
  Info,
  AlertCircle
} from 'lucide-react-native';

interface BookingRestrictionsProps {
  barberId: string;
  onUpdate?: () => void;
}

export function BookingRestrictionsSettings({ barberId, onUpdate }: BookingRestrictionsProps) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [minInterval, setMinInterval] = useState('5');
  const [maxBookings, setMaxBookings] = useState('10');
  const [advanceDays, setAdvanceDays] = useState('30');
  const [sameDay, setSameDay] = useState(true);

  useEffect(() => {
    if (barberId) {
      loadRestrictions();
    }
  }, [barberId]);

  const loadRestrictions = async () => {
    try {
      setInitialLoading(true);
      const { data, error } = await supabase
        .from('booking_restrictions')
        .select('*')
        .eq('barber_id', barberId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setMinInterval(data.min_interval_minutes.toString());
        setMaxBookings(data.max_bookings_per_day.toString());
        setAdvanceDays(data.advance_booking_days.toString());
        setSameDay(data.same_day_booking_enabled);
      }
    } catch (error) {
      logger.error('Error loading booking restrictions', error);
      Alert.alert('Error', 'Failed to load booking restrictions');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('booking_restrictions')
        .upsert({
          barber_id: barberId,
          min_interval_minutes: parseInt(minInterval) || 0,
          max_bookings_per_day: parseInt(maxBookings) || 1,
          advance_booking_days: parseInt(advanceDays) || 0,
          same_day_booking_enabled: sameDay,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      Alert.alert('Success', 'Booking restrictions updated successfully!');
      onUpdate?.();
    } catch (error) {
      logger.error('Error updating booking restrictions', error);
      Alert.alert('Error', 'Failed to update booking restrictions');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <Card style={[{ backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
        <CardContent style={tw`p-6 items-center`}>
          <LoadingSpinner color={colors.primary} />
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-24`}>
      <Card style={[tw`mb-6`, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
        <CardContent style={tw`p-4`}>
          <View style={tw`flex-row items-center mb-6`}>
            <View style={[tw`p-2 rounded-xl mr-3`, { backgroundColor: colors.primarySubtle }]}>
              <Settings size={20} color={colors.primary} />
            </View>
            <View style={tw`flex-1`}>
              <Text style={[tw`text-lg font-semibold`, { color: colors.foreground }]}>
                Booking Restrictions
              </Text>
              <Text style={[tw`text-sm mt-1`, { color: colors.mutedForeground }]}>
                Configure how clients can book appointments.
              </Text>
            </View>
          </View>

          {/* Time Between Bookings */}
          <View style={tw`mb-6`}>
            <View style={tw`flex-row items-center mb-3`}>
              <Clock size={18} color={colors.foreground} style={tw`mr-2`} />
              <Text style={[tw`text-base font-semibold`, { color: colors.foreground }]}>Time Between Bookings</Text>
            </View>
            <Text style={[tw`text-sm mb-2`, { color: colors.mutedForeground }]}>Minimum Interval (minutes)</Text>
            <TextInput
              style={[tw`p-3 rounded-xl border mb-2`, { borderColor: colors.border, color: colors.foreground, backgroundColor: 'transparent' }]}
              value={minInterval}
              onChangeText={setMinInterval}
              keyboardType="numeric"
            />
            <View style={[tw`flex-row items-center p-3 rounded-xl bg-opacity-20`, { backgroundColor: colors.primarySubtle }]}>
              <Info size={16} color={colors.primary} style={tw`mr-2`} />
              <Text style={[tw`text-xs flex-1`, { color: colors.foreground }]}>Recommended: 5-15 mins for cleanup</Text>
            </View>
          </View>

          <View style={[tw`h-px w-full mb-6`, { backgroundColor: colors.border }]} />

          {/* Daily Limits */}
          <View style={tw`mb-6`}>
            <View style={tw`flex-row items-center mb-3`}>
              <Users size={18} color={colors.foreground} style={tw`mr-2`} />
              <Text style={[tw`text-base font-semibold`, { color: colors.foreground }]}>Daily Limits</Text>
            </View>
            <Text style={[tw`text-sm mb-2`, { color: colors.mutedForeground }]}>Maximum Bookings Per Day</Text>
            <TextInput
              style={[tw`p-3 rounded-xl border`, { borderColor: colors.border, color: colors.foreground, backgroundColor: 'transparent' }]}
              value={maxBookings}
              onChangeText={setMaxBookings}
              keyboardType="numeric"
            />
          </View>

          <View style={[tw`h-px w-full mb-6`, { backgroundColor: colors.border }]} />

          {/* Advance Booking */}
          <View style={tw`mb-6`}>
            <View style={tw`flex-row items-center mb-3`}>
              <Calendar size={18} color={colors.foreground} style={tw`mr-2`} />
              <Text style={[tw`text-base font-semibold`, { color: colors.foreground }]}>Advance Booking Settings</Text>
            </View>
            <Text style={[tw`text-sm mb-2`, { color: colors.mutedForeground }]}>Advance Booking Limit (days)</Text>
            <TextInput
              style={[tw`p-3 rounded-xl border mb-4`, { borderColor: colors.border, color: colors.foreground, backgroundColor: 'transparent' }]}
              value={advanceDays}
              onChangeText={setAdvanceDays}
              keyboardType="numeric"
            />

            <View style={[tw`flex-row items-center justify-between p-4 rounded-xl border`, { borderColor: colors.border }]}>
              <View style={tw`flex-1 pr-4`}>
                <Text style={[tw`text-base font-medium`, { color: colors.foreground }]}>Allow Same-Day Bookings</Text>
                <Text style={[tw`text-xs mt-1`, { color: colors.mutedForeground }]}>Clients can book and get service on the same day.</Text>
              </View>
              <Switch
                value={sameDay}
                onValueChange={setSameDay}
                trackColor={{ false: colors.input, true: colors.primary }}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[tw`py-4 rounded-xl items-center`, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? <LoadingSpinner color={colors.primaryForeground} /> : <Text style={[tw`font-semibold text-base`, { color: colors.primaryForeground }]}>Save Restrictions</Text>}
          </TouchableOpacity>
        </CardContent>
      </Card>
    </ScrollView>
  );
}
