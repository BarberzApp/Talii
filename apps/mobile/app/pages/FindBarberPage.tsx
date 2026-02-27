// screens/FindBarberPage.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import tw from 'twrnc';
import { RootStackParamList } from '../shared/types';
import { supabase } from '../shared/lib';
import { useTheme } from '../shared/components/theme';
import { useAuth } from '../shared/hooks';
import { logger } from '../shared/lib/logger';
const Icon = require('react-native-vector-icons/Feather').default;

type FindBarberNavigationProp = NativeStackNavigationProp<RootStackParamList, 'FindBarber'>;

// Types matching the database structure
type BarberFromDB = {
    id: string;
    user_id: string;
    business_name?: string;
    specialties: string[];
    price_range?: string;
    stripe_account_status?: string;
}

type ProfileFromDB = {
    id: string;
    name: string;
    location?: string;
    bio?: string;
    avatar_url?: string;
    is_public?: boolean;
}

// Type for the transformed data used in the UI
type Barber = {
    id: string; // This is barber.id from barbers table
    userId: string; // This is user_id (profile id)
    name: string;
    businessName?: string;
    location?: string;
    specialties: string[];
    bio?: string;
    priceRange?: string;
    avatarUrl?: string;
    isPublic?: boolean;
    isStripeReady?: boolean;
}

export default function FindBarberPage() {
    const { colors } = useTheme();
    const navigation = useNavigation<FindBarberNavigationProp>();
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [filteredBarbers, setFilteredBarbers] = useState<Barber[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchBarbers();
    }, []);

    useEffect(() => {
        // Filter barbers based on search query
        const filtered = barbers.filter(barber => {
            if (!barber.isPublic) return false; // Only show public profiles
            
            const query = searchQuery.toLowerCase();
            return (
                barber.name.toLowerCase().includes(query) ||
                barber.businessName?.toLowerCase().includes(query) ||
                barber.location?.toLowerCase().includes(query) ||
                barber.specialties.some(specialty => 
                    specialty.toLowerCase().includes(query)
                ) ||
                barber.bio?.toLowerCase().includes(query)
            );
        });
        setFilteredBarbers(filtered);
    }, [barbers, searchQuery]);

    const fetchBarbers = async () => {
        try {
            setError(null);

            // Step 1: Fetch all barbers
            const { data: barbersData, error: barbersError } = await supabase
                .from('barbers')
                .select('id, user_id, business_name, specialties, price_range, stripe_account_status');

            if (barbersError) {
                logger.error('Supabase error:', barbersError);
                throw barbersError;
            }

            if (!barbersData || barbersData.length === 0) {
                setBarbers([]);
                return;
            }

            // Step 2: Fetch all profiles for these barbers
            const userIds = barbersData.map((b: BarberFromDB) => b.user_id);
            
            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('id, name, location, bio, avatar_url, is_public')
                .in('id', userIds);

            if (profilesError) {
                logger.error('Supabase error (profiles):', profilesError);
                throw profilesError;
            }

            // Step 3: Merge barbers and profiles
            const profileMap: Record<string, ProfileFromDB> = {};
            for (const profile of profilesData || []) {
                profileMap[profile.id] = profile;
            }

            const formattedBarbers: Barber[] = (barbersData as BarberFromDB[]).map(barber => {
                const profile = profileMap[barber.user_id];
                return {
                    id: barber.id, // Use barber.id instead of profile.id
                    userId: barber.user_id, // Keep user_id for reference
                    name: profile?.name || 'Unknown Barber',
                    businessName: barber.business_name,
                    location: profile?.location,
                    specialties: barber.specialties || [],
                    bio: profile?.bio,
                    priceRange: barber.price_range,
                    avatarUrl: profile?.avatar_url,
                    isPublic: profile?.is_public || false,
                    isStripeReady: barber.stripe_account_status === 'active'
                };
            }).filter(barber => barber.isPublic);

            setBarbers(formattedBarbers);
        } catch (error) {
            logger.error('Error fetching barbers:', error);
            setError('Failed to load barbers. Please try again.');
            Alert.alert('Error', 'Failed to load barbers. Please refresh to try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchBarbers();
    };

    const handleBookAppointment = (barberId: string, barberName: string) => {
        navigation.navigate('BookingCalendar', { barberId, barberName });
    };

    const clearSearch = () => {
        setSearchQuery('');
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    if (loading) {
        return (
            <SafeAreaView style={[tw`flex-1`, { backgroundColor: colors.background }]}>
                <View style={tw`flex-1 items-center justify-center`}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[tw`mt-4`, { color: colors.mutedForeground }]}>Loading barbers...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[tw`flex-1`, { backgroundColor: colors.background }]}>
            <View style={tw`flex-1`}>
                {/* Header */}
                <View style={tw`px-5 pt-4 pb-3`}>
                    <Text style={[tw`text-2xl font-bold`, { color: colors.foreground }]}>
                        Find a Barber
                    </Text>
                    <Text style={[tw`text-sm mt-1`, { color: colors.mutedForeground }]}>
                        Discover skilled barbers in your area
                    </Text>
                </View>

                {/* Search Bar */}
                <View style={tw`px-5 pb-3`}>
                    <View style={[tw`rounded-full flex-row items-center px-4 py-3`, { backgroundColor: colors.input }]}>
                        <Icon name="search" size={18} color={colors.mutedForeground} />
                        <TextInput
                            style={[tw`flex-1 text-base ml-3`, { color: colors.foreground }]}
                            placeholder="Search by name, location, or specialty..."
                            placeholderTextColor={colors.mutedForeground}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={clearSearch}>
                                <Icon name="x" size={20} color={colors.mutedForeground} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Results Summary */}
                <View style={tw`px-5 pb-3`}>
                    <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>
                        {filteredBarbers.length} barber{filteredBarbers.length !== 1 ? 's' : ''} found
                    </Text>
                </View>

                {/* Error Message */}
                {error && (
                    <View style={tw`px-5 mb-3`}>
                        <View style={[tw`border rounded-lg p-3`, { backgroundColor: colors.primarySubtle, borderColor: colors.destructive }]}>
                            <Text style={[tw`text-sm`, { color: colors.destructive }]}>{error}</Text>
                        </View>
                    </View>
                )}

                {/* Barbers List */}
                <ScrollView
                    style={tw`flex-1`}
                    contentContainerStyle={tw`px-5 pb-24`}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={colors.primary}
                        />
                    }
                >
                    {filteredBarbers.length === 0 ? (
                        <View style={tw`items-center justify-center py-20`}>
                            <Text style={[tw`text-base text-center`, { color: colors.mutedForeground }]}>
                                {searchQuery 
                                    ? "No barbers found matching your search.\nTry adjusting your search terms."
                                    : "No barbers are currently available.\nPlease check back later."
                                }
                            </Text>
                            {searchQuery && (
                                <TouchableOpacity
                                    style={[tw`mt-4 px-4 py-2 rounded-lg`, { backgroundColor: colors.input }]}
                                    onPress={clearSearch}
                                >
                                    <Text style={{ color: colors.foreground }}>Clear search</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : (
                        filteredBarbers.map((barber) => (
                            <View
                                key={barber.id}
                                style={[
                                    tw`rounded-2xl p-4 mb-3`,
                                    { backgroundColor: colors.input },
                                    !barber.isStripeReady && tw`opacity-60`
                                ]}
                            >
                                {/* Header section with avatar and name/location */}
                                <View style={tw`flex-row`}>
                                    {/* Avatar */}
                                    <View style={tw`mr-3`}>
                                        <View style={tw`relative`}>
                                            <View style={[tw`w-14 h-14 rounded-full items-center justify-center`, { backgroundColor: colors.primary }]}>
                                                <Text style={[tw`text-lg font-semibold`, { color: colors.primaryForeground }]}>
                                                    {getInitials(barber.name)}
                                                </Text>
                                            </View>
                                            {barber.isStripeReady && (
                                                <View style={tw`absolute -bottom-1 -right-1 bg-green-500 rounded-full w-5 h-5 items-center justify-center`}>
                                                    <Icon name="check" size={12} color={colors.primaryForeground} />
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    
                                    {/* Name and business name */}
                                    <View style={tw`flex-1`}>
                                        <Text style={[tw`text-lg font-semibold`, { color: colors.foreground }]}>
                                            {barber.businessName || barber.name}
                                        </Text>
                                        {barber.businessName && barber.name !== barber.businessName && (
                                            <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>
                                                {barber.name}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                                
                                {/* Bio */}
                                {barber.bio && (
                                    <Text style={[tw`text-sm mt-3 mb-2`, { color: colors.mutedForeground }]} numberOfLines={2}>
                                        {barber.bio}
                                    </Text>
                                )}
                                
                                {/* Location */}
                                {barber.location && (
                                    <View style={tw`flex-row items-center mt-2`}>
                                        <Icon name="map-pin" size={14} color={colors.mutedForeground} />
                                        <Text style={[tw`text-sm ml-1`, { color: colors.mutedForeground }]}>
                                            {barber.location}
                                        </Text>
                                    </View>
                                )}
                                
                                {/* Specialties */}
                                {barber.specialties.length > 0 && (
                                    <View style={tw`flex-row flex-wrap -mr-2 mt-3`}>
                                        {barber.specialties.slice(0, 3).map((specialty, index) => (
                                            <View
                                                key={index}
                                                style={[tw`px-2 py-1 rounded-full mr-2 mb-2`, { backgroundColor: colors.primarySubtle }]}
                                            >
                                                <Text style={[tw`text-xs`, { color: colors.primary }]}>
                                                    {specialty}
                                                </Text>
                                            </View>
                                        ))}
                                        {barber.specialties.length > 3 && (
                                            <Text style={[tw`text-xs self-center mb-2`, { color: colors.mutedForeground }]}>
                                                +{barber.specialties.length - 3} more
                                            </Text>
                                        )}
                                    </View>
                                )}
                                
                                {/* Footer with Price, Status and Button */}
                                <View style={tw`flex-row items-center justify-between mt-3`}>
                                    <View style={tw`flex-row items-center`}>
                                        {/* Price */}
                                        {barber.priceRange && (
                                            <Text style={[tw`font-medium text-sm mr-3`, { color: colors.primary }]}>
                                                {barber.priceRange}
                                            </Text>
                                        )}
                                        {/* Status */}
                                        {barber.isStripeReady ? (
                                            <Text style={[tw`text-sm font-medium`, { color: colors.success }]}>
                                                Available for booking
                                            </Text>
                                        ) : (
                                            <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>
                                                Not available for booking
                                            </Text>
                                        )}
                                    </View>
                                    
                                    {/* Book Now Button */}
                                    {barber.isStripeReady && (
                                        <TouchableOpacity
                                            onPress={() => handleBookAppointment(barber.id, barber.name)}
                                            style={[tw`rounded-full flex-row items-center px-4 py-2`, { backgroundColor: colors.primary }]}
                                            activeOpacity={0.8}
                                        >
                                            <Icon name="calendar" size={16} color={colors.primaryForeground} style={tw`mr-1`} />
                                            <Text style={[tw`text-sm font-semibold`, { color: colors.primaryForeground }]}>Book</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}