import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
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
  Scissors, 
  DollarSign, 
  Clock,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Package
} from 'lucide-react-native';
import type { Service } from '../../types/settings.types';

interface ServicesSettingsProps {
  onUpdate?: () => void;
}

export function ServicesSettings({ onUpdate }: ServicesSettingsProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [formData, setFormData] = useState<Service>({
    name: '',
    price: 0,
    duration: 30,
    description: ''
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
        loadServices(data.id);
      }
    } catch (error) {
      logger.error('Error loading barber ID:', error);
      Alert.alert('Error', 'Failed to load barber information.');
    }
  };

  const loadServices = async (barberId: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('barber_id', barberId)
        .order('name');

      if (error) throw error;
      if (data) setServices(data);
    } catch (error) {
      logger.error('Error loading services:', error);
      Alert.alert('Error', 'Failed to load services.');
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: {[key: string]: string} = {};
    
    if (!formData.name?.trim()) errors.name = 'Service name is required';
    if (!formData.duration || formData.duration < 1) errors.duration = 'Duration must be at least 1 minute';
    if (!formData.price || formData.price < 0) errors.price = 'Price must be at least $0';
    
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
      if (editingService) {
        // Update existing service
        const { error } = await supabase
          .from('services')
          .update({
            name: formData.name,
            price: formData.price,
            duration: formData.duration,
            description: formData.description,
          })
          .eq('id', editingService.id);

        if (error) throw error;
        Alert.alert('Success', 'Service updated successfully');
      } else {
        // Add new service
        const { error } = await supabase
          .from('services')
          .insert({
            barber_id: barberId,
            name: formData.name,
            price: formData.price,
            duration: formData.duration,
            description: formData.description,
          });

        if (error) throw error;
        Alert.alert('Success', 'Service added successfully');
      }
      
      await loadServices(barberId);
      resetForm();
      onUpdate?.();
    } catch (error) {
      logger.error('Error saving service:', error);
      Alert.alert('Error', 'Failed to save service.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (serviceId: string) => {
    Alert.alert(
      'Delete Service',
      'Are you sure you want to delete this service?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              const { error } = await supabase
                .from('services')
                .delete()
                .eq('id', serviceId);

              if (error) throw error;

              Alert.alert('Success', 'Service deleted successfully');
              await loadServices(barberId!);
              onUpdate?.();
            } catch (error) {
              logger.error('Error deleting service:', error);
              Alert.alert('Error', 'Failed to delete service.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      price: service.price,
      duration: service.duration,
      description: service.description || ''
    });
  };

  const resetForm = () => {
    setEditingService(null);
    setFormData({
      name: '',
      price: 0,
      duration: 30,
      description: ''
    });
    setValidationErrors({});
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins > 0 ? `${mins}m` : ''}`.trim();
    }
    return `${mins}m`;
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={tw`flex-1`}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-24`}>
        {/* Add/Edit Service Form */}
        <Card style={[tw`mb-6`, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
          <CardContent style={tw`p-4`}>
            <View style={tw`flex-row items-center mb-4`}>
              <View style={[tw`p-2 rounded-xl mr-3`, { backgroundColor: colors.primarySubtle }]}>
                {editingService ? <Edit size={20} color={colors.primary} /> : <Plus size={20} color={colors.primary} />}
              </View>
              <Text style={[tw`text-lg font-semibold`, { color: colors.foreground }]}>
                {editingService ? 'Edit Service' : 'Add New Service'}
              </Text>
            </View>

            <Input
              icon={Scissors}
              label="Service Name *"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="e.g., Haircut, Beard Trim"
              error={validationErrors.name}
            />

            <View style={tw`flex-row gap-3`}>
              <View style={tw`flex-1`}>
                <Input
                  icon={DollarSign}
                  label="Price ($) *"
                  value={formData.price.toString()}
                  onChangeText={(text) => setFormData({ ...formData, price: parseFloat(text) || 0 })}
                  placeholder="25.00"
                  keyboardType="numeric"
                  error={validationErrors.price}
                />
              </View>
              <View style={tw`flex-1`}>
                <Input
                  icon={Clock}
                  label="Duration (min) *"
                  value={formData.duration.toString()}
                  onChangeText={(text) => setFormData({ ...formData, duration: parseInt(text) || 30 })}
                  placeholder="30"
                  keyboardType="numeric"
                  error={validationErrors.duration}
                />
              </View>
            </View>

            <Input
              icon={Package}
              label="Description"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder="Brief description of the service"
              multiline
              numberOfLines={3}
              inputStyle={{ minHeight: 80, textAlignVertical: 'top' }}
            />

            <View style={tw`flex-row gap-3`}>
              <TouchableOpacity
                style={[tw`flex-1 py-3 rounded-xl flex-row items-center justify-center`, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                disabled={isLoading}
              >
                {isLoading ? (
                  <LoadingSpinner color={colors.primaryForeground} />
                ) : (
                  <>
                    <CheckCircle size={18} color={colors.primaryForeground} style={tw`mr-2`} />
                    <Text style={[tw`font-semibold`, { color: colors.primaryForeground }]}>
                      {editingService ? 'Update Service' : 'Add Service'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {editingService && (
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

        {/* Services List */}
        <View>
          <View style={tw`flex-row items-center justify-between mb-4`}>
            <View style={tw`flex-row items-center`}>
              <Scissors size={18} color={colors.primary} style={tw`mr-2`} />
              <Text style={[tw`text-lg font-semibold`, { color: colors.foreground }]}>
                Your Services
              </Text>
            </View>
            <View style={[tw`px-3 py-1 rounded-full`, { backgroundColor: colors.primarySubtle }]}>
              <Text style={[tw`text-sm font-bold`, { color: colors.primary }]}>
                {services.length} {services.length === 1 ? 'Service' : 'Services'}
              </Text>
            </View>
          </View>

          {services.length === 0 ? (
            <Card style={[{ backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
              <CardContent style={tw`p-8 items-center`}>
                <View style={[tw`p-4 rounded-3xl mb-4`, { backgroundColor: colors.primarySubtle }]}>
                  <Sparkles size={32} color={colors.primary} />
                </View>
                <Text style={[tw`text-xl font-bold mb-2`, { color: colors.foreground }]}>
                  No Services Yet
                </Text>
                <Text style={[tw`text-center mb-6`, { color: colors.mutedForeground }]}>
                  Add your first service to start accepting bookings
                </Text>
                <TouchableOpacity
                  style={[tw`px-6 py-3 rounded-xl flex-row items-center`, { backgroundColor: colors.primary }]}
                  onPress={() => setFormData({ name: '', price: 0, duration: 30, description: '' })}
                >
                  <Plus size={18} color={colors.primaryForeground} style={tw`mr-2`} />
                  <Text style={[tw`font-semibold`, { color: colors.primaryForeground }]}>
                    Add Your First Service
                  </Text>
                </TouchableOpacity>
              </CardContent>
            </Card>
          ) : (
            <View style={tw`gap-3`}>
              {services.map((service) => (
                <Card key={service.id} style={[{ backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
                  <CardContent style={tw`p-4`}>
                    <View style={tw`flex-row justify-between items-start`}>
                      <View style={tw`flex-1`}>
                        <Text style={[tw`text-lg font-semibold mb-1`, { color: colors.foreground }]}>
                          {service.name}
                        </Text>
                        <View style={tw`flex-row items-center gap-4 mb-2`}>
                          <View style={[tw`px-3 py-1 rounded-full flex-row items-center`, { backgroundColor: colors.primarySubtle }]}>
                            <DollarSign size={14} color={colors.primary} />
                            <Text style={[tw`ml-1 font-bold`, { color: colors.primary }]}>
                              {service.price}
                            </Text>
                          </View>
                          <View style={tw`flex-row items-center`}>
                            <Clock size={14} color={colors.mutedForeground} style={tw`mr-1`} />
                            <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>
                              {formatDuration(service.duration)}
                            </Text>
                          </View>
                        </View>
                        {service.description && (
                          <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>
                            {service.description}
                          </Text>
                        )}
                      </View>
                      
                      <View style={tw`flex-row gap-2 ml-4`}>
                        <TouchableOpacity
                          onPress={() => handleEdit(service)}
                          style={[tw`p-2 rounded-xl`, { backgroundColor: colors.glassBorder }]}
                        >
                          <Edit size={18} color={colors.foreground} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDelete(service.id!)}
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

        {/* Tips Section */}
        <Card style={[tw`mt-8`, { backgroundColor: colors.primarySubtle, borderColor: colors.primarySubtle }]}>
          <CardContent style={tw`p-4`}>
            <View style={tw`flex-row items-start`}>
              <View style={[tw`p-2 rounded-xl mr-3`, { backgroundColor: colors.primarySubtle }]}>
                <Sparkles size={20} color={colors.primary} />
              </View>
              <View style={tw`flex-1`}>
                <Text style={[tw`text-base font-semibold mb-3`, { color: colors.foreground }]}>
                  Pro Tips for Success
                </Text>
                <View style={tw`gap-2`}>
                  {[
                    'Set competitive prices based on your location and experience level',
                    'Be accurate with duration estimates to avoid scheduling conflicts',
                    'Add detailed descriptions to help clients understand your services',
                    'Consider offering package deals for multiple services'
                  ].map((tip, index) => (
                    <View key={index} style={tw`flex-row items-start`}>
                      <View style={[tw`w-1.5 h-1.5 rounded-full mt-1.5 mr-2`, { backgroundColor: colors.primary }]} />
                      <Text style={[tw`flex-1 text-sm`, { color: colors.foreground }]}>
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
    </KeyboardAvoidingView>
  );
} 