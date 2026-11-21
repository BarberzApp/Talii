// screens/BookingSuccessPage.tsx
import React from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, Linking, Platform, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import tw from 'twrnc';
import Icon from 'react-native-vector-icons/Feather';
import { formatBookingDate, formatBookingTime, timeZoneAbbreviation } from '@barber-app/shared';
import { useTheme } from '../shared/components/theme';
import { RootStackParamList } from '../shared/types';

type BookingSuccessNavigationProp = NativeStackNavigationProp<RootStackParamList, 'BookingSuccess'>;
type BookingSuccessRouteProp = RouteProp<RootStackParamList, 'BookingSuccess'>;

export const CANCELLATION_POLICY =
  'Free cancellation (booking fee refunded) until 24 hours before your appointment. If your barber cancels, you are always refunded.';

/** Maps link for an address text: Apple Maps on iOS, a geo: query elsewhere. */
export function mapsUrl(query: string): string {
  const q = encodeURIComponent(query);
  return Platform.OS === 'ios' ? `https://maps.apple.com/?q=${q}` : `geo:0,0?q=${q}`;
}

export default function BookingSuccessPage() {
  const { colors } = useTheme();
  const navigation = useNavigation<BookingSuccessNavigationProp>();
  const params = useRoute<BookingSuccessRouteProp>().params;

  const place = params ? [params.city, params.state].filter(Boolean).join(', ') : '';
  const hasTime = !!params?.startsAt;

  const openMaps = async () => {
    const query = [params?.barberName, place].filter(Boolean).join(' ');
    try {
      await Linking.openURL(mapsUrl(query));
    } catch {
      Alert.alert('Maps unavailable', 'Could not open a maps app on this device.');
    }
  };

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: colors.background }]}>
      <View style={tw`flex-1 items-center justify-center px-8`}>
        <View style={[tw`w-20 h-20 rounded-full items-center justify-center mb-6`, { backgroundColor: colors.success }]}>
          <Icon name="check" size={45} color={colors.primaryForeground} />
        </View>

        <Text style={[tw`text-2xl font-bold text-center mb-2`, { color: colors.foreground }]}>
          You&apos;re All Set!
        </Text>

        {params && hasTime ? (
          <View style={[tw`w-full p-4 rounded-2xl mb-4`, { backgroundColor: colors.glass }]}>
            <Text style={[tw`text-lg font-semibold text-center`, { color: colors.foreground }]}>
              {formatBookingDate(params.startsAt, params.timeZone)}
            </Text>
            <Text style={[tw`text-center mb-2`, { color: colors.primary }]}>
              {formatBookingTime(params.startsAt, params.timeZone)} {timeZoneAbbreviation(params.timeZone, params.startsAt)}
            </Text>
            <Text style={[tw`text-center`, { color: colors.mutedForeground }]}>
              {params.serviceName ? `${params.serviceName} with ` : ''}
              {params.barberName}
            </Text>
            {place ? (
              <Text style={[tw`text-center mt-1`, { color: colors.mutedForeground }]}>{place}</Text>
            ) : null}
          </View>
        ) : (
          <Text style={[tw`text-center mb-4`, { color: colors.mutedForeground }]}>
            Your appointment has been booked. You can find it any time in the Calendar tab.
          </Text>
        )}

        {params && place ? (
          <TouchableOpacity
            accessibilityRole="button"
            style={[tw`w-full py-3 rounded-full flex-row items-center justify-center mb-4`, { backgroundColor: colors.glass }]}
            onPress={openMaps}
          >
            <Icon name="map-pin" size={16} color={colors.primary} />
            <Text style={[tw`ml-2 font-medium`, { color: colors.primary }]}>Open in Maps</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={[tw`text-center text-sm mb-8`, { color: colors.mutedForeground }]}>{CANCELLATION_POLICY}</Text>

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
