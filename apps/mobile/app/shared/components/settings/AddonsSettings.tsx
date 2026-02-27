import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../theme/ThemeProvider';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { logger } from '../../lib/logger';
import { Button, Card, CardContent, LoadingSpinner } from '../ui';
import Input from '../ui/Input';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Package, 
  DollarSign,
  AlertCircle,
  CheckCircle,
  Sparkles
} from 'lucide-react-native';
import type { ServiceAddon } from '../../types/settings.types';

interface AddonsSettingsProps {
  onUpdate?: () => void;
}

export function AddonsSettings({ onUpdate }: AddonsSettingsProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [addons, setAddons] = useState<ServiceAddon[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingAddon, setEditingAddon] = useState<ServiceAddon | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [formData, setFormData] = useState<ServiceAddon>({
    name: '',
    description: '',
    price: 0,
    is_active: true
  });

  useEffect(() => {
    if (user) {
      loadBarberId();
    }
  }, [user]);

  const loadBarberId = async () => {
    try {
      const { data, error } = await supabase
        .from('barbers')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      if (data) {
        setBarberId(data.id);
        loadAddons(data.id);
      }
    } catch (error) {
      logger.error('Error loading barber ID:', error);
      Alert.alert('Error', 'Failed to load barber information.');
    }
  };

  const loadAddons = async (barberId: string) => {
    try {
      const { data, error } = await supabase
        .from('service_addons')
        .select('*')
        .eq('barber_id', barberId)
        .order('name');

      if (error) throw error;
      setAddons(data || []);
    } catch (error) {
      logger.error('Error loading add-ons:', error);
      Alert.alert('Error', 'Failed to load add-ons.');
    }
  };

  const validateForm = (): boolean => {
    const errors: {[key: string]: string} = {};
    
    if (!formData.name?.trim()) errors.name = 'Add-on name is required';
    if (formData.price < 0) errors.price = 'Price must be at least $0';
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!barberId) {
      Alert.alert('Error', 'Barber information not found.');
      return;
    }

    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors before saving.');
      return;
    }

    try {
      setIsLoading(true);
      if (editingAddon) {
        // Update existing add-on
        const { error } = await supabase
          .from('service_addons')
          .update({
            name: formData.name,
            description: formData.description,
            price: formData.price,
            is_active: formData.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingAddon.id);

        if (error) throw error;
        Alert.alert('Success', 'Add-on updated successfully');
      } else {
        // Add new add-on
        const { error } = await supabase
          .from('service_addons')
          .insert({
            barber_id: barberId,
            name: formData.name,
            description: formData.description,
            price: formData.price,
            is_active: formData.is_active,
          });

        if (error) throw error;
        Alert.alert('Success', 'Add-on added successfully');
      }
      
      await loadAddons(barberId);
      resetForm();
      onUpdate?.();
    } catch (error) {
      logger.error('Error saving add-on:', error);
      Alert.alert('Error', 'Failed to save add-on.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (addonId: string) => {
    Alert.alert(
      'Delete Add-on',
      'Are you sure you want to delete this add-on?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('service_addons')
                .delete()
                .eq('id', addonId);

              if (error) throw error;

              Alert.alert('Success', 'Add-on deleted successfully');
              await loadAddons(barberId!);
              onUpdate?.();
            } catch (error) {
              logger.error('Error deleting add-on:', error);
              Alert.alert('Error', 'Failed to delete add-on.');
            }
          },
        },
      ]
    );
  };

  const handleEdit = (addon: ServiceAddon) => {
    setEditingAddon(addon);
    setFormData({
      name: addon.name,
      description: addon.description || '',
      price: addon.price,
      is_active: addon.is_active
    });
  };

  const resetForm = () => {
    setEditingAddon(null);
    setFormData({
      name: '',
      description: '',
      price: 0,
      is_active: true
    });
    setValidationErrors({});
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={tw`flex-1`}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-24`}>
        {/* Header */}
        <Card style={[tw`mb-6`, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
          <CardContent style={tw`p-4`}>
            <View style={tw`flex-row items-center mb-4`}>
              <View style={[tw`p-2 rounded-xl mr-3`, { backgroundColor: colors.primarySubtle }]}>
                <Package size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[tw`text-lg font-semibold`, { color: colors.foreground }]}>
                  Service Add-ons
                </Text>
                <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>
                  Manage additional services and items
                </Text>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* Add/Edit Form */}
        <Card style={[tw`mb-6`, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
          <CardContent style={tw`p-4`}>
            <Text style={[tw`text-base font-semibold mb-4`, { color: colors.foreground }]}>
              {editingAddon ? 'Edit Add-on' : 'Add New Add-on'}
            </Text>

            <Input
              label="Add-on Name *"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="e.g., Fresh Towel, Premium Shampoo"
              error={validationErrors.name}
            />

            <Input
              label="Price ($) *"
              value={formData.price.toString()}
              onChangeText={(text) => setFormData({ ...formData, price: parseFloat(text) || 0 })}
              placeholder="5.00"
              keyboardType="numeric"
              error={validationErrors.price}
            />

            <Input
              label="Description (Optional)"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder="Brief description of what this add-on includes..."
              multiline
              numberOfLines={3}
              inputStyle={{ minHeight: 80, textAlignVertical: 'top' }}
            />

            <View style={tw`flex-row items-center justify-between mb-4`}>
              <Text style={[tw`font-medium`, { color: colors.foreground }]}>
                Active (available for booking)
              </Text>
              <Switch
                value={formData.is_active}
                onValueChange={(value) => setFormData({ ...formData, is_active: value })}
                trackColor={{ false: colors.input, true: colors.primary }}
                thumbColor={colors.foreground}
              />
            </View>

            <View style={tw`flex-row gap-3`}>
              <TouchableOpacity
                style={[tw`flex-1 py-3 rounded-xl flex-row items-center justify-center`, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                disabled={isLoading}
              >
                {isLoading ? (
                  <LoadingSpinner color={colors.primaryForeground} />
                ) : (
                  <Text style={[tw`font-semibold`, { color: colors.primaryForeground }]}>
                    {editingAddon ? 'Update Add-on' : 'Add Add-on'}
                  </Text>
                )}
              </TouchableOpacity>

              {editingAddon && (
                <TouchableOpacity
                  style={[tw`px-4 py-3 rounded-xl`, { borderWidth: 1, borderColor: colors.mutedForeground }]}
                  onPress={resetForm}
                >
                  <Text style={{ color: colors.foreground }}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          </CardContent>
        </Card>

        {/* Add-ons List */}
        <View>
          <View style={tw`flex-row items-center mb-4`}>
            <Package size={18} color={colors.primary} style={tw`mr-2`} />
            <Text style={[tw`text-base font-semibold`, { color: colors.foreground }]}>
              Your Add-ons ({addons.length})
            </Text>
          </View>

          {addons.length === 0 ? (
            <Card style={[{ backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
              <CardContent style={tw`p-6 items-center`}>
                <Package size={32} color={colors.mutedForeground} style={tw`mb-3`} />
                <Text style={[tw`text-center`, { color: colors.mutedForeground }]}>
                  No add-ons created yet. Add your first add-on above to get started.
                </Text>
              </CardContent>
            </Card>
          ) : (
            <View style={tw`gap-3`}>
              {addons.map((addon) => (
                <Card key={addon.id} style={[{ backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
                  <CardContent style={tw`p-4`}>
                    <View style={tw`flex-row justify-between items-start`}>
                      <View style={tw`flex-1 pr-2`}>
                        <View style={tw`flex-row items-center flex-wrap mb-1`}>
                          <Text style={[tw`font-semibold text-base mr-2`, { color: colors.foreground }]} numberOfLines={1}>
                            {addon.name}
                          </Text>
                          <View style={[
                            tw`px-2 py-0.5 rounded-full`,
                            { backgroundColor: colors.primarySubtle }
                          ]}>
                            <Text style={[
                              tw`text-xs`,
                              { color: addon.is_active ? colors.primary : colors.mutedForeground }
                            ]}>
                              {addon.is_active ? 'Active' : 'Inactive'}
                            </Text>
                          </View>
                        </View>
                        {addon.description && (
                          <Text style={[tw`text-sm mb-2`, { color: colors.mutedForeground }]} numberOfLines={2}>
                            {addon.description}
                          </Text>
                        )}
                        <View style={tw`flex-row items-center`}>
                          <DollarSign size={16} color={colors.primary} />
                          <Text style={[tw`font-semibold`, { color: colors.primary }]}>
                            {addon.price.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={tw`flex-row gap-2`}>
                        <TouchableOpacity
                          onPress={() => handleEdit(addon)}
                          style={[tw`p-2 rounded-xl`, { backgroundColor: colors.glassBorder }]}
                        >
                          <Edit size={18} color={colors.foreground} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDelete(addon.id!)}
                          style={[tw`p-2 rounded-xl`, { backgroundColor: colors.primarySubtle }]}
                        >
                          <Trash2 size={18} color={colors.destructive} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </CardContent>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
} 