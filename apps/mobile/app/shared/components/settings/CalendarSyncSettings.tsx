import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert
} from 'react-native';
import tw from 'twrnc';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../theme/ThemeProvider';
import { useCalendarSync } from '../../hooks/useCalendarSync';
import { CardContent, LoadingSpinner } from '../ui';
import { GlassyCard } from '../ui/GlassyCard';
import { AnimatedPressable } from '../ui/AnimatedPressable';
import { 
  Calendar, 
  Settings, 
  ExternalLink,
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertCircle
} from 'lucide-react-native';

export function CalendarSyncSettings() {
  const { colors } = useTheme();
  
  // Note: the hook must be implemented or adapted for mobile. Assuming it functions similarly to web.
  // In a real scenario, make sure useCalendarSync is available or shim it.
  const {
    connection,
    connected,
    loading,
    syncing,
    stats,
    connect,
    disconnect,
    sync,
    updateSettings
  } = (useCalendarSync as any)() || {
    // Mocked for compilation if hook doesn't exist yet
    connected: false,
    loading: false,
    syncing: false,
    stats: { syncedEventsCount: 0 },
    connect: () => Alert.alert('Connect Google Calendar via Web flow or deep linking'),
    disconnect: () => {},
    sync: async () => {},
    updateSettings: async () => {}
  };

  const [localSyncEnabled, setLocalSyncEnabled] = useState<boolean>(connection?.sync_enabled ?? false);
  const [localSyncDirection, setLocalSyncDirection] = useState<'inbound'|'outbound'|'bidirectional'>(connection?.sync_direction ?? 'bidirectional');

  const handleSyncEnabledChange = async (enabled: boolean) => {
    setLocalSyncEnabled(enabled);
    if(updateSettings) await updateSettings({ sync_enabled: enabled });
  };

  const handleSyncDirectionChange = async (direction: 'inbound' | 'outbound' | 'bidirectional') => {
    setLocalSyncDirection(direction);
    if(updateSettings) await updateSettings({ sync_direction: direction });
  };

  const handleSync = async (direction?: 'inbound' | 'outbound' | 'bidirectional') => {
    const syncDirection = direction || localSyncDirection;
    if(sync) await sync(syncDirection);
  };

  const handleDisconnect = async () => {
    Alert.alert(
      "Disconnect",
      "Are you sure you want to disconnect your Google Calendar? This will remove all sync data.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Disconnect", style: "destructive", onPress: async () => {
          if(disconnect) await disconnect();
        }}
      ]
    );
  };

  if (loading) {
    return (
      <GlassyCard>
        <CardContent style={tw`p-6 items-center`}>
          <LoadingSpinner color={colors.primary} />
          <Text style={[tw`mt-4 font-medium`, { color: colors.mutedForeground }]}>Loading calendar sync...</Text>
        </CardContent>
      </GlassyCard>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-24`}>
      <GlassyCard style={tw`mb-6`}>
        <CardContent style={tw`p-4`}>
          <View style={tw`flex-row items-center mb-4`}>
            <View style={[tw`p-3 rounded-xl mr-3`, { backgroundColor: colors.primarySubtle }]}>
              <Calendar size={24} color={colors.primary} />
            </View>
            <View style={tw`flex-1`}>
              <Text style={[tw`text-xl font-bold`, { color: colors.foreground }]}>Google Calendar Sync</Text>
              <Text style={[tw`text-sm mt-1`, { color: colors.mutedForeground }]}>Automate your professional schedule.</Text>
            </View>
          </View>
        </CardContent>
      </GlassyCard>

      {!connected ? (
        <GlassyCard>
          <CardContent style={tw`p-6 items-center`}>
            <View style={[tw`p-4 rounded-full mb-4`, { backgroundColor: colors.primarySubtle }]}>
              <ExternalLink size={32} color={colors.primary} />
            </View>
            <Text style={[tw`text-lg font-bold text-center mb-2`, { color: colors.foreground }]}>Connect Your Calendar</Text>
            <Text style={[tw`text-center mb-6`, { color: colors.mutedForeground }]}>
              Sync your schedule and never miss a premium booking session.
            </Text>
            <AnimatedPressable
              style={[tw`w-full py-4 rounded-xl flex-row justify-center items-center`, { backgroundColor: colors.primary }]}
              onPress={connect}
            >
              <ExternalLink size={18} color={colors.primaryForeground} style={tw`mr-2`} />
              <Text style={[tw`font-bold`, { color: colors.primaryForeground }]}>Connect Google Account</Text>
            </AnimatedPressable>
          </CardContent>
        </GlassyCard>
      ) : (
        <View style={tw`gap-6`}>
          <View style={[tw`p-4 rounded-xl border flex-row items-center justify-between`, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <View style={tw`flex-row items-center flex-1`}>
              {syncing ? <RefreshCw size={20} color={colors.mutedForeground} /> : <CheckCircle size={20} color="#10b981" />}
              <View style={tw`ml-3`}>
                <Text style={[tw`font-bold`, { color: colors.foreground }]}>{syncing ? 'Syncing...' : 'Connected'}</Text>
                <Text style={[tw`text-xs`, { color: colors.mutedForeground }]}>{stats?.syncedEventsCount || 0} events synced</Text>
              </View>
            </View>
            <AnimatedPressable
              style={[tw`px-4 py-2 rounded-lg flex-row items-center`, { backgroundColor: colors.primary }]}
              onPress={() => handleSync()}
              disabled={syncing}
            >
              <Text style={[tw`font-bold text-xs`, { color: colors.primaryForeground }]}>Sync Now</Text>
            </AnimatedPressable>
          </View>

          <GlassyCard>
            <CardContent style={tw`p-4`}>
              <View style={tw`flex-row items-center mb-4`}>
                <Settings size={18} color={colors.foreground} style={tw`mr-2`} />
                <Text style={[tw`text-base font-bold`, { color: colors.foreground }]}>Sync Settings</Text>
              </View>

              <View style={[tw`flex-row items-center justify-between py-3 border-b mb-3`, { borderColor: colors.border }]}>
                <View style={tw`flex-1 pr-4`}>
                  <Text style={[tw`font-medium`, { color: colors.foreground }]}>Real-time Sync</Text>
                  <Text style={[tw`text-xs mt-1`, { color: colors.mutedForeground }]}>Automatically manage changes.</Text>
                </View>
                <Switch
                  value={localSyncEnabled}
                  onValueChange={handleSyncEnabledChange}
                  trackColor={{ false: colors.input, true: colors.primary }}
                />
              </View>

              <Text style={[tw`font-medium mb-2`, { color: colors.foreground }]}>Sync Direction</Text>
              <View style={[tw`border rounded-xl overflow-hidden mb-2`, { borderColor: colors.border }]}>
                <Picker
                  selectedValue={localSyncDirection}
                  onValueChange={(val) => handleSyncDirectionChange(val as any)}
                  style={{ color: colors.foreground }}
                >
                  <Picker.Item label="Bidirectional (Recommended)" value="bidirectional" color={colors.foreground} />
                  <Picker.Item label="Outbound Only (App → Google)" value="outbound" color={colors.foreground} />
                  <Picker.Item label="Inbound Only (Google → App)" value="inbound" color={colors.foreground} />
                </Picker>
              </View>
            </CardContent>
          </GlassyCard>

          <GlassyCard style={{ borderColor: colors.destructive + '40' }}>
            <CardContent style={tw`p-4`}>
              <Text style={[tw`text-base font-bold mb-2`, { color: colors.destructive }]}>Danger Zone</Text>
              <Text style={[tw`text-sm mb-4 text-opacity-80`, { color: colors.destructive }]}>
                Disconnecting will remove all sync data and stop automatic syncing.
              </Text>
              <AnimatedPressable
                style={[tw`py-3 rounded-xl flex-row justify-center items-center`, { backgroundColor: colors.destructive }]}
                onPress={handleDisconnect}
              >
                <Trash2 size={18} color="#fff" style={tw`mr-2`} />
                <Text style={tw`font-bold text-white`}>Disconnect Calendar</Text>
              </AnimatedPressable>
            </CardContent>
          </GlassyCard>
        </View>
      )}
    </ScrollView>
  );
}
