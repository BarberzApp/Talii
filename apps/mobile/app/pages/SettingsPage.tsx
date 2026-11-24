import React, { useState, useEffect } from 'react';
import { View, SafeAreaView, ScrollView, Alert, ActivityIndicator, Text, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import tw from 'twrnc';
import { RootStackParamList } from '../shared/types';
import { api } from '../shared/lib/api';
import { fetchConnectStatus, isStripeReady } from '../shared/lib/stripeConnect';
import { useAuth } from '../shared/hooks/useAuth';
import { logger } from '../shared/lib/logger';
import { useTheme, ThemeToggle } from '../shared/components/theme';
import Input from '../shared/components/ui/Input';
import { ProfileSettings } from '../shared/components/settings/ProfileSettings';
import { ServicesSettings } from '../shared/components/settings/ServicesSettings';
import { AddonsSettings } from '../shared/components/settings/AddonsSettings';
import { ShareSettings } from '../shared/components/settings/ShareSettings';
import { AvailabilityManager } from '../shared/components/settings/AvailabilityManager';
import { EarningsDashboard } from '../shared/components/settings/EarningsDashboard';
import { GlassyCard } from '../shared/components/ui/GlassyCard';
import { AnimatedSection } from '../shared/components/ui/AnimatedSection';
import { AnimatedPressable } from '../shared/components/ui/AnimatedPressable';
import { User, Scissors, Package, Calendar, DollarSign, Settings as SettingsIcon, AlertCircle, LogOut, CheckCircle, FileText, Shield } from 'lucide-react-native';
import type { Tab, SettingsData } from '../shared/types/settings.types';
import { useAccountDeletionHelper } from '../shared/helpers/accountDeletionHelper';

type SettingsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

export default function SettingsPage() {
  const { colors, colorScheme } = useTheme();
  const navigation = useNavigation<SettingsNavigationProp>();
  const { user, userProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [settingsData, setSettingsData] = useState<SettingsData>({
    profileComplete: false,
    servicesComplete: false,
    availabilityComplete: false,
    stripeConnected: false
  });
  const [barberId, setBarberId] = useState<string>('');

  const isBarber = userProfile?.role === 'barber';
  const {
    isConfirming,
    isDeleting,
    confirmText,
    setConfirmText,
    requestDelete,
    deleteAccount,
    isConfirmed,
  } = useAccountDeletionHelper();

  useEffect(() => {
    if (user) {
      loadSettingsData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- it reloads only when the listed keys change; the callback reads the current render
  }, [user]);

  const loadSettingsData = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      const me = await api.me.get();
      const profileComplete = !!(me.profile.name && me.profile.email);

      if (isBarber && me.barber) {
        setBarberId(me.barber.id);

        const [servicesRes, weekRes, connect] = await Promise.all([
          api.services.list().catch(() => ({ services: [] })),
          api.schedule.getWeek().catch(() => ({ availability: [] })),
          fetchConnectStatus(),
        ]);

        setSettingsData({
          profileComplete,
          servicesComplete: servicesRes.services.some((s) => s.is_active),
          availabilityComplete: weekRes.availability.length > 0,
          stripeConnected: isStripeReady(connect),
        });
      } else {
        setSettingsData({
          profileComplete,
          servicesComplete: false,
          availabilityComplete: false,
          stripeConnected: false
        });
      }
    } catch (error) {
      logger.error('Error loading settings data:', error);
      Alert.alert('Error', 'Failed to load settings data');
    } finally {
      setIsLoading(false);
    }
  };

  const getTabStatus = (tab: Tab) => {
    switch (tab) {
      case 'profile':
        return settingsData.profileComplete ? 'complete' : 'incomplete';
      case 'services':
        return settingsData.servicesComplete ? 'complete' : 'incomplete';
      case 'availability':
        return settingsData.availabilityComplete ? 'complete' : 'incomplete';
      case 'earnings':
        return settingsData.stripeConnected ? 'complete' : 'incomplete';
      default:
        return 'neutral';
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.navigate('Login');
          },
        },
      ]
    );
  };

  const tabs = [
    { id: 'profile' as Tab, label: 'Profile', icon: User },
    { id: 'services' as Tab, label: 'Services', icon: Scissors },
    { id: 'earnings' as Tab, label: 'Earnings', icon: DollarSign },
    { id: 'addons' as Tab, label: 'Add-ons', icon: Package },
    { id: 'availability' as Tab, label: 'Schedule', icon: Calendar },
  ];

  const visibleTabs = isBarber ? tabs : tabs.filter(tab => tab.id === 'profile');

  if (isLoading) {
    return (
      <SafeAreaView style={[tw`flex-1 justify-center items-center`, { backgroundColor: colors.background }]}>
        <SettingsIcon size={40} color={colors.primary} style={tw`mb-4`} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[tw`mt-4 text-base`, { color: colors.mutedForeground }]}>Loading your settings...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-32`}>
        {/* Header */}
        <AnimatedSection type="fade" style={tw`px-6 pt-6 pb-4`}>
          <View style={tw`items-center mb-6`}>
            <View style={[
              tw`p-4 rounded-full mb-3`,
              {
                backgroundColor: colors.primarySubtle,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 12,
                elevation: 6,
              }
            ]}>
              <SettingsIcon size={32} color={colors.primary} />
            </View>
            <Text style={[tw`text-2xl font-bold`, { color: colors.foreground }]}>Settings</Text>
            <Text style={[tw`text-sm mt-1`, { color: colors.mutedForeground }]}>
              Manage your profile, services, and preferences
            </Text>
          </View>
        </AnimatedSection>

        {/* Theme Toggle */}
        <View style={tw`px-6 mb-6`}>
          <ThemeToggle />
        </View>

        {/* Share Settings Banner for Barbers */}
        {isBarber && (
          <View style={tw`px-6 mb-6`}>
            <ShareSettings barberId={barberId} />
          </View>
        )}

        {/* Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={[tw`mb-6`, { backgroundColor: colors.surface }]}
          contentContainerStyle={tw`px-6`}
        >
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const status = getTabStatus(tab.id);
            
            return (
              <AnimatedPressable
                key={tab.id}
                style={[
                  tw`py-4 px-4 mr-3`,
                  isActive && { borderBottomWidth: 2, borderBottomColor: colors.primary }
                ]}
                onPress={() => setActiveTab(tab.id)}
              >
                <View style={tw`flex-row items-center`}>
                  <Icon 
                    size={18} 
                    color={isActive ? colors.primary : colors.mutedForeground}
                  />
                  <Text style={[
                    tw`ml-2 text-sm font-medium`,
                    { color: isActive ? colors.primary : colors.mutedForeground }
                  ]}>
                    {tab.label}
                  </Text>
                  {status === 'complete' && (
                    <CheckCircle size={14} color={colors.primary} style={tw`ml-2`} />
                  )}
                </View>
              </AnimatedPressable>
            );
          })}
        </ScrollView>

        {/* Tab Content */}
        <View style={tw`px-6`}>
          {activeTab === 'profile' && (
            <ProfileSettings onUpdate={loadSettingsData} />
          )}
          
          {activeTab === 'services' && isBarber && (
            <ServicesSettings onUpdate={loadSettingsData} />
          )}
          
          {activeTab === 'addons' && isBarber && (
            <AddonsSettings onUpdate={loadSettingsData} />
          )}
          
          {activeTab === 'availability' && isBarber && (
            <AvailabilityManager barberId={barberId} onUpdate={loadSettingsData} />
          )}
          
          {activeTab === 'earnings' && isBarber && (
            <EarningsDashboard barberId={barberId} />
          )}
        </View>

        {/* Legal Information */}
        <AnimatedSection type="slideUp" delay={100} style={tw`px-6 mt-8`}>
          <GlassyCard style={tw`p-4 rounded-2xl`}>
            <Text style={[tw`text-base font-semibold mb-4`, { color: colors.foreground }]}>
              Legal Information
            </Text>
            <AnimatedPressable
              style={[tw`flex-row items-center py-3 border-b`, { borderColor: colors.border }]}
              onPress={() => navigation.navigate('Terms' as any)}
            >
              <FileText size={18} color={colors.primary} style={tw`mr-3`} />
              <Text style={[tw`flex-1 text-base`, { color: colors.foreground }]}>
                Terms & Conditions
              </Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={tw`flex-row items-center py-3`}
              onPress={() => navigation.navigate('PrivacyPolicy' as any)}
            >
              <Shield size={18} color={colors.primary} style={tw`mr-3`} />
              <Text style={[tw`flex-1 text-base`, { color: colors.foreground }]}>
                Privacy Policy
              </Text>
            </AnimatedPressable>
          </GlassyCard>
        </AnimatedSection>

        {/* Logout Button */}
        <AnimatedSection type="slideUp" delay={200} style={tw`px-6 mt-6`}>
          <AnimatedPressable
            style={[
              tw`py-3 rounded-xl`,
              {
                backgroundColor: colors.destructive,
                shadowColor: colors.destructive,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              }
            ]}
            onPress={handleLogout}
          >
            <View style={tw`flex-row items-center justify-center`}>
              <LogOut size={20} color={colors.destructiveForeground} style={tw`mr-2`} />
              <Text style={[tw`font-semibold`, { color: colors.destructiveForeground }]}>Log Out</Text>
            </View>
          </AnimatedPressable>
        </AnimatedSection>
      
       
        {/* Account Deletion */}
        <AnimatedSection type="slideUp" delay={300} style={tw`px-6 mt-6 mb-10`}>
          <GlassyCard style={[
            tw`p-4 rounded-2xl`,
            { borderWidth: 1, borderColor: colors.destructive + '40' }
          ]}>
            <View style={tw`flex-row items-center mb-3`}>
              <AlertCircle size={18} color={colors.destructive} style={tw`mr-2`} />
              <Text style={[tw`text-base font-semibold`, { color: colors.destructive }]}>
                Delete Account
              </Text>
            </View>
            <Text style={[tw`text-sm mb-4`, { color: colors.mutedForeground }]}>
              This will permanently remove your account and data. Type YES in all caps to confirm.
            </Text>

            {isConfirming && (
              <View style={tw`mb-3`}>
                <Input
                  containerStyle={tw`mb-0`}
                  placeholder="Type YES to confirm"
                  autoCapitalize="characters"
                  value={confirmText}
                  onChangeText={(text) => setConfirmText(text.toUpperCase())}
                />
                <AnimatedPressable
                  style={[
                    tw`mt-3 py-3 rounded-xl`,
                    {
                      backgroundColor: isConfirmed ? colors.destructive : colors.muted,
                      opacity: isDeleting ? 0.7 : 1,
                    },
                  ]}
                  onPress={deleteAccount}
                  disabled={!isConfirmed || isDeleting}
                >
                  <Text
                    style={[
                      tw`text-center font-semibold`,
                      { color: isConfirmed ? colors.destructiveForeground : colors.mutedForeground },
                    ]}
                  >
                    {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                  </Text>
                </AnimatedPressable>
              </View>
            )}

            {!isConfirming && (
            <AnimatedPressable
              style={[
                tw`py-3 rounded-xl`,
                {
                  backgroundColor: colors.destructive,
                  opacity: isDeleting ? 0.7 : 1,
                },
              ]}
              onPress={requestDelete}
              disabled={isDeleting}
            >
              <Text style={[tw`text-center font-semibold`, { color: colors.destructiveForeground }]}>
                Delete My Account
              </Text>
            </AnimatedPressable>
            )}
          </GlassyCard>
        </AnimatedSection>
      </ScrollView>
    </SafeAreaView>
  );
}