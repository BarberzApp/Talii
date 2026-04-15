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
  Phone, 
  MapPin, 
  Clock, 
  Zap,
  Info
} from 'lucide-react-native';

interface OnDemandSettingsProps {
  barberId: string;
  onUpdate?: () => void;
}

export function OnDemandSettings({ barberId, onUpdate }: OnDemandSettingsProps) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [isEnabled, setIsEnabled] = useState(false);
  const [radius, setRadius] = useState('5');
  const [minNotice, setMinNotice] = useState('30');
  const [maxNotice, setMaxNotice] = useState('24');
  const [surgeEnabled, setSurgeEnabled] = useState(false);
  const [surgeMultiplier, setSurgeMultiplier] = useState('1.5');

  useEffect(() => {
    if (barberId) {
      loadSettings();
    }
  }, [barberId]);

  const loadSettings = async () => {
    try {
      setInitialLoading(true);
      const { data, error } = await supabase
        .from('ondemand_settings')
        .select('*')
        .eq('barber_id', barberId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setIsEnabled(data.is_enabled);
        setRadius(data.availability_radius_miles.toString());
        setMinNotice(data.min_notice_minutes.toString());
        setMaxNotice(data.max_notice_hours.toString());
        setSurgeEnabled(data.surge_pricing_enabled);
        setSurgeMultiplier(data.surge_multiplier.toString());
      }
    } catch (error) {
      logger.error('Error loading on-demand settings', error);
      Alert.alert('Error', 'Failed to load on-demand settings');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('ondemand_settings')
        .upsert({
          barber_id: barberId,
          is_enabled: isEnabled,
          availability_radius_miles: parseInt(radius) || 5,
          min_notice_minutes: parseInt(minNotice) || 30,
          max_notice_hours: parseInt(maxNotice) || 24,
          surge_pricing_enabled: surgeEnabled,
          surge_multiplier: parseFloat(surgeMultiplier) || 1.5,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      Alert.alert('Success', 'On-demand settings updated successfully!');
      onUpdate?.();
    } catch (error) {
      logger.error('Error updating on-demand settings', error);
      Alert.alert('Error', 'Failed to update on-demand settings');
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
              <Phone size={20} color={colors.primary} />
            </View>
            <View style={tw`flex-1`}>
              <Text style={[tw`text-lg font-semibold`, { color: colors.foreground }]}>
                On-Demand Calling
              </Text>
              <Text style={[tw`text-sm mt-1`, { color: colors.mutedForeground }]}>
                Allow clients to request immediate urgent services.
              </Text>
            </View>
          </View>

          {/* Enable Toggle */}
          <View style={[tw`flex-row items-center justify-between p-4 rounded-xl border mb-6`, { borderColor: colors.border }]}>
            <View style={tw`flex-1 pr-4`}>
              <Text style={[tw`text-base font-medium`, { color: colors.foreground }]}>Enable On-Demand</Text>
              <Text style={[tw`text-xs mt-1`, { color: colors.mutedForeground }]}>You&apos;ll receive notifications for urgent requests.</Text>
            </View>
            <Switch
              value={isEnabled}
              onValueChange={setIsEnabled}
              trackColor={{ false: colors.input, true: colors.primary }}
            />
          </View>

          {isEnabled && (
            <>
              {/* Radius */}
              <View style={tw`mb-6`}>
                <View style={tw`flex-row items-center mb-3`}>
                  <MapPin size={18} color={colors.foreground} style={tw`mr-2`} />
                  <Text style={[tw`text-base font-semibold`, { color: colors.foreground }]}>Service Area</Text>
                </View>
                <Text style={[tw`text-sm mb-2`, { color: colors.mutedForeground }]}>Service Radius (miles)</Text>
                <TextInput
                  style={[tw`p-3 rounded-xl border`, { borderColor: colors.border, color: colors.foreground }]}
                  value={radius}
                  onChangeText={setRadius}
                  keyboardType="numeric"
                />
              </View>

              <View style={[tw`h-px w-full mb-6`, { backgroundColor: colors.border }]} />

              {/* Notice Windows */}
              <View style={tw`mb-6`}>
                <View style={tw`flex-row items-center mb-3`}>
                  <Clock size={18} color={colors.foreground} style={tw`mr-2`} />
                  <Text style={[tw`text-base font-semibold`, { color: colors.foreground }]}>Time Windows</Text>
                </View>
                <View style={tw`flex-row gap-3 mb-2`}>
                  <View style={tw`flex-1`}>
                    <Text style={[tw`text-sm mb-2`, { color: colors.mutedForeground }]}>Min Notice (mins)</Text>
                    <TextInput
                      style={[tw`p-3 rounded-xl border`, { borderColor: colors.border, color: colors.foreground }]}
                      value={minNotice}
                      onChangeText={setMinNotice}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={tw`flex-1`}>
                    <Text style={[tw`text-sm mb-2`, { color: colors.mutedForeground }]}>Max Notice (hrs)</Text>
                    <TextInput
                      style={[tw`p-3 rounded-xl border`, { borderColor: colors.border, color: colors.foreground }]}
                      value={maxNotice}
                      onChangeText={setMaxNotice}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              <View style={[tw`h-px w-full mb-6`, { backgroundColor: colors.border }]} />

              {/* Surge Pricing */}
              <View style={tw`mb-6`}>
                <View style={tw`flex-row items-center mb-3`}>
                  <Zap size={18} color={colors.foreground} style={tw`mr-2`} />
                  <Text style={[tw`text-base font-semibold`, { color: colors.foreground }]}>Surge Pricing</Text>
                </View>
                <View style={[tw`flex-row items-center justify-between p-4 rounded-xl border mb-4`, { borderColor: colors.border }]}>
                  <View style={tw`flex-1 pr-4`}>
                    <Text style={[tw`text-base font-medium`, { color: colors.foreground }]}>Enable Surge Pricing</Text>
                    <Text style={[tw`text-xs mt-1`, { color: colors.mutedForeground }]}>Increase prices during high-demand.</Text>
                  </View>
                  <Switch
                    value={surgeEnabled}
                    onValueChange={setSurgeEnabled}
                    trackColor={{ false: colors.input, true: colors.primary }}
                  />
                </View>
                
                {surgeEnabled && (
                  <>
                    <Text style={[tw`text-sm mb-2`, { color: colors.mutedForeground }]}>Surge Multiplier</Text>
                    <TextInput
                      style={[tw`p-3 rounded-xl border`, { borderColor: colors.border, color: colors.foreground }]}
                      value={surgeMultiplier}
                      onChangeText={setSurgeMultiplier}
                      keyboardType="numeric"
                      placeholder="1.5"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </>
                )}
              </View>
            </>
          )}

          <TouchableOpacity
            style={[tw`py-4 rounded-xl items-center mt-2`, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? <LoadingSpinner color={colors.primaryForeground} /> : <Text style={[tw`font-semibold text-base`, { color: colors.primaryForeground }]}>Save Settings</Text>}
          </TouchableOpacity>
        </CardContent>
      </Card>
      
      <Card style={[{ backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
        <CardContent style={tw`p-4 flex-row items-start`}>
          <Info size={20} color={colors.primary} style={tw`mr-3 mt-1`} />
          <View style={tw`flex-1`}>
            <Text style={[tw`font-semibold mb-1`, { color: colors.foreground }]}>How it works</Text>
            <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>
              Clients can request immediate service. You will be notified based on your service radius and min/max notice time. You can choose to accept or decline.
            </Text>
          </View>
        </CardContent>
      </Card>
    </ScrollView>
  );
}
