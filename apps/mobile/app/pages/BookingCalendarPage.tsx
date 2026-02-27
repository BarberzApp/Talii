// screens/BookingCalendarPage.tsx
import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import tw from 'twrnc';
import { useTheme } from '../shared/components/theme';
const Icon = require('react-native-vector-icons/Feather').default;
import { RootStackParamList } from '../shared/types';
import BookingForm from '../shared/components/BookingForm';

type BookingPageNavigationProp = NativeStackNavigationProp<RootStackParamList, 'BookingCalendar'>;
type BookingPageRouteProp = RouteProp<RootStackParamList, 'BookingCalendar'>;

export default function BookingCalendarPage() {
    const { colors } = useTheme();
    const navigation = useNavigation<BookingPageNavigationProp>();
    const route = useRoute<BookingPageRouteProp>();
    const { barberId, barberName, preSelectedService, guestMode } = route.params;

    const [showBookingForm, setShowBookingForm] = useState(false);

    const handleBookingCreated = (booking: any) => {
        setShowBookingForm(false);
        Alert.alert(
            'Booking Created!',
            'Your appointment has been scheduled successfully.',
            [{ text: 'OK', onPress: () => navigation.navigate('BookingSuccess') }]
        );
    };

    return (
        <SafeAreaView style={[tw`flex-1`, { backgroundColor: colors.background }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={tw`px-5 pt-4 pb-6`}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={tw`mb-4`}>
                        <Icon name="arrow-left" size={24} color={colors.primary} />
                    </TouchableOpacity>
                    <Text style={[tw`text-3xl font-bold mb-2`, { color: colors.foreground }]}>Book Appointment</Text>
                    <Text style={[tw`text-base`, { color: colors.mutedForeground }]}>with {barberName}</Text>
                </View>

                {/* Welcome Section */}
                <View style={tw`px-5 mb-8`}>
                    <View style={tw`items-center`}>
                        <View style={[tw`w-20 h-20 rounded-full items-center justify-center mb-4`, { backgroundColor: colors.primarySubtle }]}>
                            <Icon name="scissors" size={32} color={colors.primary} />
                        </View>
                        <Text style={[tw`text-xl font-bold mb-2 text-center`, { color: colors.foreground }]}>
                            Ready to Book Your Appointment?
                        </Text>
                        <Text style={[tw`text-center`, { color: colors.mutedForeground }]}>
                            Choose your service, pick a time, and we&apos;ll handle the rest
                        </Text>
                    </View>
                </View>

                {/* Quick Info */}
                <View style={tw`px-5 mb-8`}>
                    <View style={tw`space-y-4`}>
                        <View style={tw`flex-row items-center`}>
                            <View style={[tw`w-8 h-8 rounded-full items-center justify-center mr-3`, { backgroundColor: colors.primarySubtle }]}>
                                <Icon name="clock" size={16} color={colors.primary} />
                            </View>
                            <Text style={[tw`flex-1`, { color: colors.foreground }]}>
                                Flexible scheduling with real-time availability
                            </Text>
                        </View>
                        <View style={tw`flex-row items-center`}>
                            <View style={[tw`w-8 h-8 rounded-full items-center justify-center mr-3`, { backgroundColor: colors.primarySubtle }]}>
                                <Icon name="credit-card" size={16} color={colors.primary} />
                            </View>
                            <Text style={[tw`flex-1`, { color: colors.foreground }]}>
                                Secure payment with multiple options
                            </Text>
                        </View>
                        <View style={tw`flex-row items-center`}>
                            <View style={[tw`w-8 h-8 rounded-full items-center justify-center mr-3`, { backgroundColor: colors.primarySubtle }]}>
                                <Icon name="check-circle" size={16} color={colors.primary} />
                            </View>
                            <Text style={[tw`flex-1`, { color: colors.foreground }]}>
                                Instant confirmation and reminders
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Start Booking Button */}
                <View style={tw`px-5 pb-8`}>
                    <TouchableOpacity
                        onPress={() => {
                            setShowBookingForm(true);
                        }}
                    >
                        <View style={[
                            tw`py-4 rounded-full items-center`,
                            { backgroundColor: colors.primary }
                        ]}>
                            <Text style={[tw`text-lg font-semibold`, { color: colors.background }]}>
                                Start Booking
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Booking Form Modal */}
            <BookingForm
                isVisible={showBookingForm}
                onClose={() => setShowBookingForm(false)}
                barberId={barberId}
                barberName={barberName}
                preSelectedService={preSelectedService}
                onBookingCreated={handleBookingCreated}
            />
        </SafeAreaView>
    );
}