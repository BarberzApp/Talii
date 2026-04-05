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
import { Picker } from '@react-native-picker/picker';
import tw from 'twrnc';
import { useTheme } from '../theme/ThemeProvider';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { logger } from '../../lib/logger';
import { CardContent, LoadingSpinner } from '../ui';
import { GlassyCard } from '../ui/GlassyCard';
import { AnimatedSection } from '../ui/AnimatedSection';
import { AnimatedPressable } from '../ui/AnimatedPressable';
import { 
  Settings,
  Plus,
  Trash2,
  Info,
  Clock,
  Calendar,
  Save,
  AlertCircle
} from 'lucide-react-native';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface SchedulingSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  buffer_minutes_before: number;
  buffer_minutes_after: number;
  max_bookings_per_slot: number;
  is_active: boolean;
}

interface AdvancedSchedulingSlotsProps {
  barberId: string;
  onUpdate?: () => void;
}

export function AdvancedSchedulingSlots({ barberId, onUpdate }: AdvancedSchedulingSlotsProps) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [schedulingSlots, setSchedulingSlots] = useState<SchedulingSlot[]>([]);
  const [editingSlot, setEditingSlot] = useState<Partial<SchedulingSlot> | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (barberId) {
      loadSchedulingSlots();
    }
  }, [barberId]);

  const loadSchedulingSlots = async () => {
    try {
      setInitialLoading(true);
      const { data, error } = await supabase
        .from('scheduling_slots')
        .select('*')
        .eq('barber_id', barberId)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      setSchedulingSlots(data || []);
    } catch (error) {
      logger.error('Error loading scheduling slots', error);
      Alert.alert('Error', 'Failed to load scheduling slots');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingSlot) return;

    try {
      setLoading(true);
      
      const slotData = {
        barber_id: barberId,
        day_of_week: editingSlot.day_of_week ?? 0,
        start_time: editingSlot.start_time ?? '09:00:00',
        end_time: editingSlot.end_time ?? '17:00:00',
        slot_duration_minutes: editingSlot.slot_duration_minutes || 30,
        buffer_minutes_before: editingSlot.buffer_minutes_before || 0,
        buffer_minutes_after: editingSlot.buffer_minutes_after || 0,
        max_bookings_per_slot: editingSlot.max_bookings_per_slot || 1,
        is_active: editingSlot.is_active ?? true,
        updated_at: new Date().toISOString(),
      };

      if (editingSlot.id) {
        const { error } = await supabase
          .from('scheduling_slots')
          .update(slotData)
          .eq('id', editingSlot.id);
        if (error) throw error;
        Alert.alert('Success', 'Scheduling slot updated successfully!');
      } else {
        const { error } = await supabase
          .from('scheduling_slots')
          .insert(slotData);
        if (error) throw error;
        Alert.alert('Success', 'Scheduling slot created successfully!');
      }

      setEditingSlot(null);
      setShowAddForm(false);
      await loadSchedulingSlots();
      onUpdate?.();
    } catch (error) {
      logger.error('Error saving scheduling slot', error);
      Alert.alert('Error', 'Failed to save scheduling slot');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (slot: SchedulingSlot) => {
    setEditingSlot(slot);
    setShowAddForm(true);
  };

  const handleDelete = async (slotId: string) => {
    Alert.alert(
      "Delete Slot",
      "Are you sure you want to delete this scheduling slot?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('scheduling_slots')
                .delete()
                .eq('id', slotId);

              if (error) throw error;
              Alert.alert('Success', 'Scheduling slot deleted successfully!');
              await loadSchedulingSlots();
              onUpdate?.();
            } catch (error) {
              logger.error('Error deleting scheduling slot', error);
              Alert.alert('Error', 'Failed to delete scheduling slot');
            }
          }
        }
      ]
    );
  };

  if (initialLoading) {
    return (
      <GlassyCard>
        <CardContent style={tw`p-6 items-center`}>
          <LoadingSpinner color={colors.primary} />
        </CardContent>
      </GlassyCard>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-24`}>
      {/* Header */}
      <GlassyCard style={tw`mb-6`}>
        <CardContent style={tw`p-4`}>
          <View style={tw`flex-row items-center`}>
            <View style={[tw`p-2 rounded-xl mr-3`, { backgroundColor: colors.primarySubtle }]}>
              <Settings size={20} color={colors.primary} />
            </View>
            <View style={tw`flex-1`}>
              <Text style={[tw`text-lg font-semibold`, { color: colors.foreground }]}>
                Advanced Scheduling Slots
              </Text>
              <Text style={[tw`text-sm mt-1`, { color: colors.mutedForeground }]}>
                Create custom slots with varying durations, buffers, and booking limits.
              </Text>
            </View>
          </View>
        </CardContent>
      </GlassyCard>

      {/* Form */}
      {showAddForm && editingSlot && (
        <AnimatedSection type="slideUp" spring style={tw`mb-6`}>
        <GlassyCard>
          <CardContent style={tw`p-4`}>
            <Text style={[tw`text-lg font-semibold mb-4`, { color: colors.foreground }]}>
              {editingSlot.id ? 'Edit Slot' : 'Add New Slot'}
            </Text>

            <View style={tw`mb-4`}>
              <Text style={[tw`text-sm font-medium mb-1.5`, { color: colors.foreground }]}>Day of Week</Text>
              <View style={[tw`rounded-xl overflow-hidden border`, { borderColor: colors.border, backgroundColor: 'transparent' }]}>
                <Picker
                  selectedValue={editingSlot.day_of_week ?? 0}
                  onValueChange={(val) => setEditingSlot({ ...editingSlot, day_of_week: val })}
                  style={{ color: colors.foreground }}
                >
                  {DAYS.map((day, i) => (
                    <Picker.Item key={i} label={day} value={i} color={colors.foreground} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={tw`flex-row gap-3 mb-4`}>
              <View style={tw`flex-1`}>
                <Text style={[tw`text-sm font-medium mb-1.5`, { color: colors.foreground }]}>Start Time (HH:MM)</Text>
                <TextInput
                  style={[tw`p-3 rounded-xl border`, { borderColor: colors.border, color: colors.foreground }]}
                  value={editingSlot.start_time?.slice(0, 5) || ''}
                  onChangeText={(val) => setEditingSlot({ ...editingSlot, start_time: val })}
                  placeholder="09:00"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
              <View style={tw`flex-1`}>
                <Text style={[tw`text-sm font-medium mb-1.5`, { color: colors.foreground }]}>End Time (HH:MM)</Text>
                <TextInput
                  style={[tw`p-3 rounded-xl border`, { borderColor: colors.border, color: colors.foreground }]}
                  value={editingSlot.end_time?.slice(0, 5) || ''}
                  onChangeText={(val) => setEditingSlot({ ...editingSlot, end_time: val })}
                  placeholder="17:00"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            </View>

            <View style={tw`mb-4`}>
              <Text style={[tw`text-sm font-medium mb-1.5`, { color: colors.foreground }]}>Slot Duration (mins)</Text>
              <TextInput
                style={[tw`p-3 rounded-xl border`, { borderColor: colors.border, color: colors.foreground }]}
                value={editingSlot.slot_duration_minutes?.toString() || ''}
                onChangeText={(val) => setEditingSlot({ ...editingSlot, slot_duration_minutes: parseInt(val) || 0 })}
                keyboardType="numeric"
                placeholder="30"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={tw`flex-row items-center justify-between py-3 mb-4`}>
              <View>
                <Text style={[tw`text-base font-medium`, { color: colors.foreground }]}>Active</Text>
                <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>Enable this slot</Text>
              </View>
              <Switch
                value={editingSlot.is_active ?? true}
                onValueChange={(val) => setEditingSlot({ ...editingSlot, is_active: val })}
                trackColor={{ false: colors.input, true: colors.primary }}
              />
            </View>

            <View style={tw`flex-row gap-3 mt-4`}>
              <TouchableOpacity
                style={[tw`flex-1 py-3 rounded-xl items-center`, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? <LoadingSpinner color={colors.primaryForeground} /> : <Text style={[tw`font-semibold`, { color: colors.primaryForeground }]}>Save Slot</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[tw`flex-1 py-3 rounded-xl items-center border`, { borderColor: colors.border }]}
                onPress={() => { setEditingSlot(null); setShowAddForm(false); }}
                disabled={loading}
              >
                <Text style={[tw`font-semibold`, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </CardContent>
        </GlassyCard>
        </AnimatedSection>
      )}

      {/* List */}
      {!showAddForm && (
        <>
          <AnimatedPressable
            style={[tw`flex-row items-center justify-center py-3 rounded-xl mb-6 border`, { borderColor: colors.border }]}
            onPress={() => {
              setEditingSlot({
                day_of_week: 0,
                start_time: '09:00',
                end_time: '17:00',
                slot_duration_minutes: 30,
                is_active: true
              });
              setShowAddForm(true);
            }}
          >
            <Plus size={18} color={colors.foreground} style={tw`mr-2`} />
            <Text style={[tw`font-semibold`, { color: colors.foreground }]}>Add Scheduling Slot</Text>
          </AnimatedPressable>

          {schedulingSlots.length === 0 ? (
            <GlassyCard>
              <CardContent style={tw`p-6 items-center flex-row`}>
                <Info size={20} color={colors.foreground} style={tw`mr-3`} />
                <Text style={[tw`flex-1 text-sm`, { color: colors.mutedForeground }]}>
                  No scheduling slots configured. Add your first slot.
                </Text>
              </CardContent>
            </GlassyCard>
          ) : (
            <View style={tw`gap-3`}>
              {schedulingSlots.map(slot => (
                <GlassyCard key={slot.id}>
                  <CardContent style={tw`p-4 flex-row items-center justify-between`}>
                    <View style={tw`flex-1`}>
                      <View style={tw`flex-row items-center gap-2 mb-1`}>
                        <Text style={[tw`font-medium text-base`, { color: colors.foreground }]}>{DAYS[slot.day_of_week]}</Text>
                        <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>{slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}</Text>
                        {!slot.is_active && (
                          <View style={[tw`px-2 py-0.5 rounded`, { backgroundColor: colors.muted }]}>
                            <Text style={[tw`text-xs`, { color: colors.mutedForeground }]}>Inactive</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>
                        {slot.slot_duration_minutes}min slots
                      </Text>
                    </View>
                    <View style={tw`flex-row gap-2`}>
                      <AnimatedPressable style={[tw`p-2 rounded-lg border`, { borderColor: colors.border }]} onPress={() => handleEdit(slot)}>
                        <Text style={[tw`text-sm font-medium`, { color: colors.foreground }]}>Edit</Text>
                      </AnimatedPressable>
                      <AnimatedPressable style={[tw`p-2 rounded-lg border`, { borderColor: colors.destructive }]} onPress={() => handleDelete(slot.id)}>
                        <Trash2 size={16} color={colors.destructive} />
                      </AnimatedPressable>
                    </View>
                  </CardContent>
                </GlassyCard>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
