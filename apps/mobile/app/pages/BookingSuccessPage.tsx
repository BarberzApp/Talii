// screens/BookingSuccessPage.tsx
import React, { useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import tw from 'twrnc';
const Icon = require('react-native-vector-icons/Feather').default;
import { useTheme } from '../shared/components/theme';
import { RootStackParamList } from '../shared/types';

type BookingSuccessNavigationProp = NativeStackNavigationProp<RootStackParamList, 'BookingSuccess'>;

export default function BookingSuccessPage() {
  const { colors } = useTheme();
  const navigation = useNavigation<BookingSuccessNavigationProp>();

  useEffect(() => {
    // Handle deep link from Stripe success redirect
    const handleDeepLink = (url: string) => {
      if (url.includes('booking-success')) {
        // Do something later
      }
    };

    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: colors.background }]}>
      <View style={tw`flex-1 items-center justify-center px-8`}>
        <View style={[tw`w-20 h-20 rounded-full items-center justify-center mb-6`, { backgroundColor: colors.success }]}>
          <Icon name="check" size={45} color={colors.primaryForeground} />
        </View>
        
        <Text style={[tw`text-2xl font-bold text-center mb-2`, { color: colors.foreground }]}>
          You&apos;re All Set!
        </Text>
        
        <Text style={[tw`text-center mb-8`, { color: colors.mutedForeground }]}>
          Your appointment has been successfully booked. You&apos;ll receive a confirmation email shortly.
        </Text>

        <TouchableOpacity
          style={[tw`w-full py-4 rounded-full`, { backgroundColor: colors.glass }]}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Browse' })}
        >
          <Text style={[tw`text-center font-medium`, { color: colors.primary }]}>
            Back to Browse
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}