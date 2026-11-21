// screens/BookingSuccessPage.tsx
import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import tw from 'twrnc';
import Icon from 'react-native-vector-icons/Feather';
import { useTheme } from '../shared/components/theme';
import { RootStackParamList } from '../shared/types';

type BookingSuccessNavigationProp = NativeStackNavigationProp<RootStackParamList, 'BookingSuccess'>;

export default function BookingSuccessPage() {
  const { colors } = useTheme();
  const navigation = useNavigation<BookingSuccessNavigationProp>();

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
          Your appointment has been booked. You can find it any time in the Calendar tab.
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