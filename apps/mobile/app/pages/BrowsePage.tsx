import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Alert, Image } from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import tw from 'twrnc';
import { useTheme } from '../shared/components/theme';
import type { BarberCard, PublicReview, RatingStats } from '@barber-app/shared';
import { api, errorMessage } from '../shared/lib/api';
import { useAuth } from '../shared/hooks/useAuth';
import { logger } from '../shared/lib/logger';
import {
  ChevronLeft,
  Search,
  MapPin,
  Filter,
  X,
  Scissors,
  Star,
} from 'lucide-react-native';
import { GlassyCard } from '../shared/components/ui/GlassyCard';
import { AnimatedPressable } from '../shared/components/ui/AnimatedPressable';
import { RootStackParamList } from '../shared/types';
import BookingForm from '../shared/components/BookingForm';
import { useLocationManager } from '../shared/hooks/useLocationManager';
import { ReviewCard } from '../shared/components/ReviewCard';
import { ReviewForm } from '../shared/components/ReviewForm';
import { formatDistance } from '../shared/lib/locationUtils';


type BrowseNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// A barber card as the Browse list shows it (from GET /api/barbers).
type Barber = {
  /** barbers.id */
  id: string;
  /** profiles.id */
  userId: string;
  name: string;
  username: string;
  businessName?: string;
  /** "City, State" */
  location?: string;
  specialties: string[];
  bio?: string;
  avatarUrl?: string;
  /** Cover photos are not part of the list response. */
  coverPhotoUrl?: string;
  priceRange?: string;
  city?: string;
  state?: string;
  /** Miles, when the list was loaded near a location. */
  distance?: number;
  rating: RatingStats;
}

function toBarber(card: BarberCard): Barber {
  const location = [card.city, card.state].filter(Boolean).join(', ');
  return {
    id: card.id,
    userId: card.user_id,
    name: card.name || card.username,
    username: card.username,
    businessName: card.business_name || card.name || undefined,
    location: location || undefined,
    specialties: card.specialties || [],
    bio: card.bio || undefined,
    avatarUrl: card.avatar_url || undefined,
    city: card.city || undefined,
    state: card.state || undefined,
    distance: card.distance_miles ?? undefined,
    rating: card.rating,
  };
}

// Star Rating Component (stats come with the barber card)
function BarberRating({ rating }: { rating: RatingStats }) {
  const { colors } = useTheme();
  if (rating.review_count === 0 || rating.average_rating === null) {
    return (
      <View style={tw`flex-row items-center justify-between`}>
        <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>No reviews yet</Text>
      </View>
    );
  }
  const stats = { average_rating: rating.average_rating, total_reviews: rating.review_count };

  return (
    <View style={tw`flex-row items-center justify-between`}>
      <View style={tw`flex-row items-center`}>
        {Array.from({ length: 5 }, (_, index) => (
          <Star
            key={index}
            size={12}
            fill={index < Math.round(stats.average_rating) ? colors.premium : 'transparent'}
            color={index < Math.round(stats.average_rating) ? colors.premium : colors.mutedForeground}
            style={tw`mr-0.5`}
          />
        ))}
        <Text style={[tw`text-sm ml-1`, { color: colors.mutedForeground }]}>
          {stats.average_rating.toFixed(1)} ({stats.total_reviews})
        </Text>
      </View>
    </View>
  );
}

// ReviewsList Component
function ReviewsList({ 
  barberId, 
  onAddReview 
}: { 
  barberId: string;
  onAddReview: () => void;
}) {
  const { colors } = useTheme();
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  // ReviewsList component - removed debug logging
  
  // Only fetch reviews when component mounts (when modal opens)
  useEffect(() => {
    if (barberId && !hasLoaded) {
      fetchReviews();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- it reloads only when the listed keys change; the callback reads the current render
  }, [barberId, hasLoaded]);

  const fetchReviews = async () => {
    if (!barberId) return;
    setLoading(true);
    try {
      const res = await api.barbers.reviews(barberId, { limit: 50 });
      setReviews(res.reviews);
      setHasLoaded(true);
    } catch (error) {
      logger.error('Error fetching reviews:', error);
      Alert.alert('Error', errorMessage(error, 'Failed to load reviews.'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={tw`flex-1 justify-center items-center py-12`}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[tw`mt-4 text-base`, { color: colors.mutedForeground }]}>
          Loading reviews...
        </Text>
      </View>
    );
  }

  if (reviews.length === 0) {
    return (
      <View style={tw`flex-1 justify-center items-center py-12 px-6`}>
        <View style={[tw`w-16 h-16 rounded-full items-center justify-center mb-4`, { backgroundColor: colors.primarySubtle }]}>
          <Star size={28} color={colors.primary} />
        </View>
        <Text style={[tw`text-lg font-bold text-center mb-2`, { color: colors.foreground }]}>
          No reviews yet
        </Text>
        <Text style={[tw`text-sm text-center mb-6`, { color: colors.mutedForeground }]}>
          Be the first to review this stylist!
        </Text>
        <AnimatedPressable
          style={[
            tw`px-8 py-3 rounded-xl`,
            {
              backgroundColor: colors.primary,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 4,
            }
          ]}
          onPress={onAddReview}
        >
          <Text style={[tw`font-bold`, { color: colors.primaryForeground }]}>
            Write a Review
          </Text>
        </AnimatedPressable>
      </View>
    );
  }

  return (
    <View style={tw`flex-1`}>
      {/* Add Review Button */}
      <View style={[tw`px-4 py-3`, { borderBottomWidth: 1, borderColor: colors.border }]}>
        <AnimatedPressable
          style={[
            tw`py-3 rounded-xl items-center flex-row justify-center`,
            {
              backgroundColor: colors.primary,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 6,
              elevation: 3,
            }
          ]}
          onPress={onAddReview}
        >
          <Star size={16} color={colors.primaryForeground} style={tw`mr-2`} />
          <Text style={[tw`font-bold`, { color: colors.primaryForeground }]}>
            Write a Review
          </Text>
        </AnimatedPressable>
      </View>
      
      {/* Reviews List */}
      <ScrollView style={tw`flex-1 px-4 pt-3`}>
        {reviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            showActions={false}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default function BrowsePage({ isGuest }: { isGuest?: boolean } = {}) {
  const { colors } = useTheme();
  const navigation = useNavigation<BrowseNavigationProp>();
  const { user } = useAuth();
  const guestMode = Boolean(isGuest || !user);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Barber list state
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barbersLoading, setBarbersLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [filteredBarbers, setFilteredBarbers] = useState<Barber[]>([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [allSpecialties, setAllSpecialties] = useState<string[]>([]);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState<any>(null);
  
  // Batch loading state
  const [barbersPage, setBarbersPage] = useState(0);
  const [hasMoreBarbers, setHasMoreBarbers] = useState(true);
  const [barbersLoadingMore, setBarbersLoadingMore] = useState(false);
  const BATCH_SIZE = 10;
  
  // Location management using custom hook
  const {
    userLocation,
    locationLoading,
    useLocation,
    toggleLocation: toggleLocationHook,
    loadLocationPreferences,
  } = useLocationManager();
  
  // Review system state
  const [selectedBarberForReviews, setSelectedBarberForReviews] = useState<string | null>(null);
  const [, setShowReviewForm] = useState(false);
  const [showReviews, setShowReviews] = useState(false);
  const [reviewFormData, setReviewFormData] = useState<{
    barberId: string;
    bookingId: string | null;
    isEditing?: boolean;
    reviewId?: string;
    initialRating?: number;
    initialComment?: string;
  } | null>(null);
  
  // Location accuracy state
  const [locationAccuracy, setLocationAccuracy] = useState<'high' | 'medium' | 'low' | 'error' | null>(null);

  /** The newest completed booking with this barber that has no review yet. */
  const findReviewableBooking = async (barberId: string): Promise<string | null> => {
    try {
      const [{ bookings }, { reviews: own }] = await Promise.all([
        api.bookings.list({ as: 'client', status: ['completed'], order: 'desc', limit: 100 }),
        api.reviews.listOwn(),
      ]);
      const reviewed = new Set(own.map(r => r.booking_id));
      return bookings.find(b => b.barber_id === barberId && !reviewed.has(b.id))?.id ?? null;
    } catch (error) {
      logger.error('Error finding a booking to review:', error);
      return null;
    }
  };

  const promptAuth = useCallback((context: string = 'continue') => {
    Alert.alert(
      'Sign in required',
      `Please log in or create an account to ${context}.`,
      [
        { text: 'Log In', onPress: () => navigation.navigate('Login') },
        { text: 'Sign Up', onPress: () => navigation.navigate('SignUp') },
        { text: 'Not now', style: 'cancel' },
      ]
    );
  }, [navigation]);

  useEffect(() => {
    // The first page is loaded by the search effect below (empty query).
    loadLocationPreferences();
  }, [loadLocationPreferences]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Check location accuracy when userLocation changes
  useEffect(() => {
    const checkLocationAccuracy = async () => {
      if (!useLocation || !userLocation?.coords) {
        setLocationAccuracy(null);
        return;
      }

      try {
        // Use the accuracy from the current userLocation if available
        // Otherwise, get a fresh location check
        const accuracy = userLocation.coords.accuracy;
        
        if (accuracy !== undefined && accuracy !== null) {
          // Categorize accuracy: high (< 10m), medium (10-50m), low (> 50m)
          if (accuracy < 10) {
            setLocationAccuracy('high');
          } else if (accuracy <= 50) {
            setLocationAccuracy('medium');
          } else {
            setLocationAccuracy('low');
          }
        } else {
          // If accuracy not available, try to get fresh location
          try {
            const position = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });
            const freshAccuracy = position.coords.accuracy || 0;
            
            if (freshAccuracy < 10) {
              setLocationAccuracy('high');
            } else if (freshAccuracy <= 50) {
              setLocationAccuracy('medium');
            } else {
              setLocationAccuracy('low');
            }
          } catch (err) {
            logger.error('Error getting fresh location for accuracy:', err);
            setLocationAccuracy('error');
          }
        }
      } catch (error) {
        logger.error('Error checking location accuracy:', error);
        setLocationAccuracy('error');
      }
    };

    // Debounce accuracy check to avoid too frequent updates
    const timer = setTimeout(() => {
      checkLocationAccuracy();
    }, 500);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- it reloads only when the listed keys change; the callback reads the current render
  }, [useLocation, userLocation?.coords?.accuracy]);

  // The list reloads by itself when location turns on or off (see the effect below).
  const toggleLocation = async () => {
    await toggleLocationHook();
  };

  // Only the newest list request may update the list (typing fires several).
  const listSeq = useRef(0);

  /**
   * GET /api/barbers, one page at a time. The search text goes to the server as
   * `q`; with location on, lat/lng make it the nearby list (nearest first, with
   * distance_miles, within 25 miles). Page 0 replaces the list.
   */
  const fetchBarbers = async (
    page = 0,
    append = false,
    skipNearbyFetch = false,
    query: string = debouncedSearchQuery
  ) => {
    const coords = useLocation && !skipNearbyFetch ? userLocation?.coords : undefined;
    const seq = ++listSeq.current;
    try {
      if (page === 0) setBarbersLoading(true);
      else setBarbersLoadingMore(true);
      setListError(null);

      const { barbers: cards, pagination } = await api.barbers.list({
        q: query.trim() || undefined,
        limit: BATCH_SIZE,
        offset: page * BATCH_SIZE,
        ...(coords ? { lat: coords.latitude, lng: coords.longitude } : {}),
      });
      if (seq !== listSeq.current) return;
      const transformed = cards.map(toBarber);
      setHasMoreBarbers(pagination.hasMore);

      if (page === 0 || !append) {
        setBarbers(transformed);
        setBarbersPage(page);
      } else {
        setBarbers(prev => [...prev, ...transformed.filter(b => !prev.some(p => p.id === b.id))]);
        setBarbersPage(page);
      }
    } catch (error) {
      if (seq !== listSeq.current) return;
      logger.error('Error fetching barbers:', error);
      if (coords) {
        // Nearby search failed: fall back to the plain list.
        await fetchBarbers(page, append, true, query);
        return;
      }
      const message = errorMessage(error, 'Could not load stylists. Check your connection and try again.');
      if (page === 0) setListError(message);
      else Alert.alert('Error', message);
    } finally {
      if (seq === listSeq.current) {
        if (page === 0) setBarbersLoading(false);
        else setBarbersLoadingMore(false);
      }
    }
  };

  // Check if location is available and working
  const isLocationAvailable = useLocation && userLocation && userLocation.coords;

  const loadMoreBarbers = async () => {
    if (!hasMoreBarbers || barbersLoadingMore) return;
    await fetchBarbers(barbersPage + 1, true);
  };

  // A new search, or location turning on/off (or moving), starts again from the first page.
  const coordsKey =
    useLocation && userLocation?.coords
      ? `${userLocation.coords.latitude.toFixed(3)},${userLocation.coords.longitude.toFixed(3)}`
      : 'off';
  useEffect(() => {
    setBarbersPage(0);
    setHasMoreBarbers(true);
    fetchBarbers(0, false, false, debouncedSearchQuery);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- it reloads only when the listed keys change; the callback reads the current render
  }, [debouncedSearchQuery, coordsKey]);

  // Filter barbers based on search query and selected specialties
  useEffect(() => {
    let filtered = barbers;

    // The search text is applied by the server (q); specialties are filtered here.
    // Filter by selected specialties
    if (selectedSpecialties.length > 0) {
      filtered = filtered.filter(barber =>
        barber.specialties?.some(specialty => 
          selectedSpecialties.includes(specialty)
        )
      );
    }

    setFilteredBarbers(filtered);
  }, [barbers, selectedSpecialties]);

  // Update specialties when barbers are loaded
  useEffect(() => {
    const allSpecialtiesSet = new Set([
      'Barber',
      'Braider',
      'Stylist',
      'Nails',
      'Lash',
      'Brow',
      'Tattoo',
      'Piercings',
      'Dyeing'
    ]);
    
    // Add specialties from barbers
    barbers.forEach(barber => {
      barber.specialties?.forEach(specialty => allSpecialtiesSet.add(specialty));
    });
    
    setAllSpecialties(Array.from(allSpecialtiesSet).sort());
  }, [barbers]);

  const toggleSpecialty = (specialty: string) => {
    setSelectedSpecialties(prev => 
      prev.includes(specialty) 
        ? prev.filter(s => s !== specialty)
        : [...prev, specialty]
    );
  };

  const clearFilters = () => {
    setSelectedSpecialties([]);
    setSearchQuery('');
    setFilteredBarbers(barbers);
  };

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={tw`px-4 pt-4 pb-2`}>
        <View style={tw`flex-row items-center justify-between mb-4`}>
          <View style={tw`flex-row items-center`}>
            {guestMode && (
              <TouchableOpacity
                onPress={() => navigation.navigate('Home')}
                style={[tw`flex-row items-center mr-3 rounded-full px-3 py-1`, {
                  backgroundColor: colors.glass,
                  borderWidth: 1,
                  borderColor: colors.glassBorder,
                }]}
              >
                <ChevronLeft size={16} color={colors.foreground} />
                <Text style={[tw`ml-1 text-sm font-medium`, { color: colors.foreground }]}>
                  Home
                </Text>
              </TouchableOpacity>
            )}
            <Text style={[tw`text-2xl font-bold`, { color: colors.foreground }]}>
              Browse
            </Text>
          </View>
        </View>
        
        {/* Search Bar */}
        <View style={tw`flex-row items-center mb-4`}>
          <View style={[tw`flex-1 flex-row items-center rounded-xl px-3 py-2`, { backgroundColor: colors.glass }]}>
            <Search size={20} color={colors.mutedForeground} style={tw`mr-2`} />
            <TextInput
              style={[tw`flex-1 text-base`, { color: colors.foreground }]}
              placeholder="Search stylists..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Location Button */}
          <TouchableOpacity
            style={[
              tw`ml-2 p-3 rounded-xl flex-row items-center`,
              { 
                backgroundColor: useLocation 
                  ? colors.infoSubtle 
                  : colors.glass,
                borderWidth: useLocation ? 1 : 0,
                borderColor: useLocation ? colors.infoBorder : 'transparent'
              }
            ]}
            onPress={toggleLocation}
            disabled={locationLoading}
          >
            {locationLoading ? (
              <ActivityIndicator size={16} color={colors.primary} />
            ) : (
              <MapPin 
                size={16} 
                color={useLocation ? colors.primary : colors.foreground} 
              />
            )}
            {useLocation && !locationLoading && (
              <Text style={[tw`ml-1 text-xs font-medium`, { color: colors.primary }]}>
                ON
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            testID="filter-button"
            style={[tw`ml-2 p-2 rounded-xl`, { backgroundColor: colors.glass }]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Filter size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Location Status Indicator */}
        {isLocationAvailable && (
          <View style={[
            tw`mb-3 p-3 rounded-xl flex-row items-center justify-center`,
            { backgroundColor: colors.primarySubtle, borderWidth: 1, borderColor: colors.primaryTint }
          ]}>
            <MapPin size={16} color={colors.primary} />
            <View style={tw`flex-1 ml-2`}>
              <Text style={[tw`text-sm font-medium text-center`, { color: colors.foreground }]}>
                Showing barbers sorted by distance from your location
              </Text>
              <Text style={[tw`text-xs text-center mt-1`, { color: colors.mutedForeground }]}>
                Location accuracy: {locationAccuracy ? (
                  <Text style={[
                    tw`font-semibold`,
                    locationAccuracy === 'high' ? { color: colors.success } :
                    locationAccuracy === 'medium' ? { color: colors.warning } :
                    locationAccuracy === 'low' ? { color: colors.destructive } :
                    { color: colors.destructive }
                  ]}>
                    {locationAccuracy}
                  </Text>
                ) : (
                  <Text style={[tw`font-semibold`, { color: colors.mutedForeground }]}>
                    checking...
                  </Text>
                )}
                {' • '}
                <Text style={[tw`italic`, { color: colors.mutedForeground }]}>
                  Location optimization is currently being tested
                </Text>
              </Text>
            </View>
          </View>
        )}

        {/* Filters */}
        {showFilters && (
          <GlassyCard style={tw`mb-4 p-4 rounded-xl`}>
            {/* Specialty Filter */}
            <View style={tw`mb-4`}>
              <Text style={[tw`text-sm font-medium mb-2`, { color: colors.foreground }]}>
                Specialties
              </Text>
              <View style={tw`flex-row flex-wrap gap-2`}>
                {allSpecialties.map(specialty => (
                  <AnimatedPressable
                    key={specialty}
                    style={[
                      tw`px-3 py-1 rounded-full`,
                      selectedSpecialties.includes(specialty)
                        ? { backgroundColor: colors.primary }
                        : { backgroundColor: colors.glass }
                    ]}
                    onPress={() => toggleSpecialty(specialty)}
                  >
                    <Text style={[
                      tw`text-xs`,
                      selectedSpecialties.includes(specialty)
                        ? { color: colors.primaryForeground }
                        : { color: colors.foreground }
                    ]}>
                      {specialty}
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>
            </View>



            {/* Clear Filters */}
            <AnimatedPressable
              style={[tw`mt-2 p-2 rounded-lg items-center`, { backgroundColor: colors.glass }]}
              onPress={clearFilters}
            >
              <Text style={[tw`text-sm font-medium`, { color: colors.foreground }]}>
                Clear All Filters
              </Text>
            </AnimatedPressable>
          </GlassyCard>
        )}

      </View>

      {/* Main Content Area */}
      <View style={tw`flex-1`}>
          <>
            {barbersLoading ? (
              <View style={tw`flex-1 justify-center items-center`}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[tw`mt-4 text-lg`, { color: colors.foreground }]}>
                  Loading stylists...
                </Text>
              </View>
            ) : listError ? (
              <View style={tw`flex-1 justify-center items-center py-8 px-6`}>
                <Text style={[tw`text-lg font-bold text-center mb-2`, { color: colors.foreground }]}>
                  Could not load stylists
                </Text>
                <Text style={[tw`text-sm text-center mb-4`, { color: colors.mutedForeground }]}>
                  {listError}
                </Text>
                <AnimatedPressable
                  style={[tw`px-5 py-2 rounded-lg`, { backgroundColor: colors.glass }]}
                  onPress={() => fetchBarbers(0)}
                >
                  <Text style={[tw`text-sm font-medium`, { color: colors.foreground }]}>Try again</Text>
                </AnimatedPressable>
              </View>
            ) : filteredBarbers.length === 0 ? (
              <View style={tw`flex-1 justify-center items-center py-8`}>
                <Text style={[tw`text-lg font-bold text-center mb-2`, { color: colors.foreground }]}>
                  No stylists found
                </Text>
                <Text style={[tw`text-sm text-center`, { color: colors.mutedForeground }]}>
                  Try adjusting your search or filters
                </Text>
              </View>
            ) : (
              <ScrollView 
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={barbersLoading}
                    onRefresh={() => fetchBarbers(0)}
                    tintColor={colors.primary}
                    colors={[colors.primary]}
                  />
                }
              >
                {filteredBarbers.map((barber) => (
                  <View key={barber.id} style={tw`mb-6 mx-4`}>
                    {/* Barber Card - Web App Style */}
                    <GlassyCard style={tw`rounded-xl overflow-hidden`}>
                      {/* Cover Photo Section */}
                      <View style={tw`relative h-56`}>
                        {barber.coverPhotoUrl ? (
                          <Image
                            source={{ uri: barber.coverPhotoUrl }}
                            style={tw`w-full h-full`}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[
                            tw`w-full h-full`,
                            { backgroundColor: colors.primarySubtle }
                          ]}>
                            <View style={[tw`absolute top-4 left-4 w-20 h-20 border rounded-full`, { borderColor: colors.primaryTint, opacity: 0.4 }]} />
                            <View style={[tw`absolute bottom-4 right-4 w-16 h-16 border rounded-full`, { borderColor: colors.primaryTint, opacity: 0.3 }]} />
                            <View style={[tw`absolute top-1/2 left-1/2`, { width: 128, height: 128, borderRadius: 64, marginLeft: -64, marginTop: -64, borderWidth: 1, borderColor: colors.primaryTint, opacity: 0.25 }]} />
                          </View>
                        )}
                      </View>

                      {/* Avatar Section - Centered and Overlapping */}
                      <View style={tw`relative -mt-16 px-6`}>
                        <View style={tw`items-center`}>
                          <View style={[
                            tw`h-32 w-32 rounded-full border-4 shadow-xl overflow-hidden`,
                            { 
                              borderColor: colors.surfaceElevated,
                              shadowColor: colors.primary,
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: 0.2,
                              shadowRadius: 12,
                              elevation: 6
                            }
                          ]}>
                            {barber.avatarUrl ? (
                              <Image
                                source={{ uri: barber.avatarUrl }}
                                style={tw`w-full h-full`}
                                resizeMode="cover"
                                onError={(error) => {
                                  logger.error('Profile image error:', error.nativeEvent.error);
                                }}
                              />
                            ) : (
                              <View style={[tw`w-full h-full items-center justify-center`, { backgroundColor: colors.primarySubtle }]}>
                                <Text style={[tw`text-3xl font-bold`, { color: colors.primary }]}>
                                  {barber.name?.charAt(0)?.toUpperCase() || 'U'}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>

                      {/* Content Section */}
                      <View style={tw`px-6 pb-6`}>
                        {/* Header - Centered */}
                        <View style={tw`items-center mb-4`}>
                          <Text style={[tw`text-2xl font-bold text-center`, { color: colors.foreground }]}>
                            {barber.name}
                          </Text>
                          {barber.businessName && (
                            <Text style={[tw`text-base font-medium text-center mb-1`, { color: colors.mutedForeground }]}>
                              {barber.businessName}
                            </Text>
                          )}
                          <Text style={[tw`text-lg font-semibold`, { color: colors.primary }]}>
                            @{barber.username}
                          </Text>
                        </View>

                        {/* Location - Centered */}
                        {barber.location && (
                          <View style={tw`flex-row items-center justify-center mb-3`}>
                            <MapPin size={16} color={colors.primary} />
                            <Text style={[tw`text-sm ml-2 flex-shrink`, { color: colors.mutedForeground }]} numberOfLines={2}>
                              {barber.location}
                              {useLocation && barber.distance !== undefined && (
                                <Text style={[tw`ml-2 font-semibold`, { color: colors.primary }]}>
                                  • {formatDistance(barber.distance)}
                                </Text>
                              )}
                            </Text>
                          </View>
                        )}

                        {/* Star Rating - Centered */}
                        <View style={tw`items-center mb-3`}>
                          <BarberRating rating={barber.rating} />
                        </View>

                        {/* Price Range */}
                        {barber.priceRange && (
                          <View style={tw`items-center mb-3`}>
                            <View style={[
                              tw`px-3 py-1 rounded-full border`,
                              { 
                                backgroundColor: colors.primarySubtle,
                                borderColor: colors.primaryTint
                              }
                            ]}>
                              <Text style={[tw`text-xs font-medium`, { color: colors.primary }]}>
                                {barber.priceRange} Pricing
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Bio */}
                        {barber.bio && (
                          <Text style={[tw`text-sm text-center mb-4 leading-relaxed`, { color: colors.mutedForeground }]} numberOfLines={4}>
                            {barber.bio}
                          </Text>
                        )}

                        {/* Specialties */}
                        {barber.specialties && barber.specialties.length > 0 && (
                          <View style={tw`mb-4`}>
                            <View style={tw`flex-row items-center justify-center mb-2`}>
                              <Scissors size={16} color={colors.primary} />
                              <Text style={[tw`text-xs font-semibold ml-2 uppercase tracking-wide`, { color: colors.mutedForeground }]}>
                                Specialties
                              </Text>
                            </View>
                            <View style={tw`flex-row flex-wrap justify-center`}>
                              {barber.specialties.slice(0, 3).map((specialty, index) => (
                                <View
                                  key={index}
                                  style={[
                                    tw`px-2 py-1 rounded-full mx-1 mb-1 border`,
                                    { 
                                      backgroundColor: colors.glass,
                                      borderColor: colors.glassBorder
                                    }
                                  ]}
                                >
                                  <Text style={[tw`text-xs`, { color: colors.mutedForeground }]}>
                                    {specialty}
                                  </Text>
                                </View>
                              ))}
                              {barber.specialties.length > 3 && (
                                <View style={[
                                  tw`px-2 py-1 rounded-full mx-1 mb-1 border`,
                                  { 
                                    backgroundColor: 'transparent',
                                    borderColor: colors.glassBorder
                                  }
                                ]}>
                                  <Text style={[tw`text-xs`, { color: colors.mutedForeground }]}>
                                    +{barber.specialties.length - 3} more
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                        )}

                        {/* Action Buttons */}
                        <View style={tw`flex-row gap-3`}>
                          <AnimatedPressable
                            style={[
                              tw`flex-1 py-3 rounded-xl items-center border-2`,
                              { 
                                backgroundColor: 'transparent',
                                borderColor: colors.primary
                              }
                            ]}
                            onPress={() => {
                              setSelectedBarberForReviews(barber.id);
                              setShowReviews(true);
                            }}
                          >
                            <Text style={[tw`font-semibold text-sm`, { color: colors.primary }]}>
                              Reviews
                            </Text>
                          </AnimatedPressable>
                          
                          <AnimatedPressable
                            style={[
                              tw`flex-1 py-3 rounded-xl items-center`,
                              { 
                                backgroundColor: colors.primary,
                                shadowColor: colors.primary,
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.25,
                                shadowRadius: 8,
                                elevation: 4
                              }
                            ]}
                            onPress={() => {
                              setSelectedBarber({
                                barberId: barber.id,
                                barberName: barber.name,
                                name: barber.name
                              });
                              navigation.navigate('ProfilePreview', { barberId: barber.id});
                            }}
                          >
                            <Text style={[tw`font-semibold text-sm`, { color: colors.primaryForeground }]}>
                              Book Now
                            </Text>
                          </AnimatedPressable>
                        </View>
                      </View>
                    </GlassyCard>
                  </View>
                ))}
                
                {/* Load More Section */}
                {hasMoreBarbers && (
                  <View style={tw`py-6 px-4`}>
                    <AnimatedPressable
                      style={[
                        tw`py-4 px-6 rounded-xl items-center border-2 border-dashed`,
                        { 
                          borderColor: colors.glassBorder,
                          backgroundColor: colors.glass
                        }
                      ]}
                      onPress={loadMoreBarbers}
                      disabled={barbersLoadingMore}
                    >
                      {barbersLoadingMore ? (
                        <View style={tw`flex-row items-center`}>
                          <ActivityIndicator size="small" color={colors.primary} />
                          <Text style={[tw`ml-2 font-medium`, { color: colors.primary }]}>
                            Loading more barbers...
                          </Text>
                        </View>
                      ) : (
                        <View style={tw`items-center`}>
                          <Text style={[tw`text-lg font-semibold mb-1`, { color: colors.foreground }]}>
                            Load More Barbers
                          </Text>
                          <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>
                            Tap to load the next 10 barbers
                          </Text>
                        </View>
                      )}
                    </AnimatedPressable>
                  </View>
                )}
                
                {/* End of barbers message */}
                {!hasMoreBarbers && barbers.length > 0 && (
                  <View style={tw`py-6 px-4 items-center`}>
                    <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>
                      You&apos;ve seen all available barbers!
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </>
      </View>



      {/* Reviews Modal */}
      {selectedBarberForReviews && showReviews && (
        <View style={[tw`absolute inset-0`, { backgroundColor: colors.backdrop }]}>
          <View style={tw`flex-1 pt-12`}>
            <View style={tw`flex-row items-center justify-between px-4 mb-4`}>
              <Text style={[tw`text-xl font-bold`, { color: colors.foreground }]}>
                Reviews
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowReviews(false);
                  setSelectedBarberForReviews(null);
                }}
                style={tw`p-2`}
              >
                <X size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={tw`flex-1 px-4`}>
              <ReviewsList 
                barberId={selectedBarberForReviews} 
                onAddReview={async () => {
                  if (guestMode) {
                    promptAuth('write a review');
                    return;
                  }
                  // A review needs one of your completed bookings with this barber.
                  const bookingId = await findReviewableBooking(selectedBarberForReviews);
                  if (!bookingId) {
                    Alert.alert(
                      'Review not available',
                      'You can review a barber after a completed appointment with them (one review per appointment).'
                    );
                    return;
                  }
                  setReviewFormData({
                    barberId: selectedBarberForReviews,
                    bookingId,
                    isEditing: false,
                  });
                  setShowReviews(false);
                  setShowReviewForm(true);
                }}
              />
            </ScrollView>
          </View>
        </View>
      )}

      {/* Review Form Modal */}
      {reviewFormData && (
        <View style={tw`absolute inset-0`}>
          <ReviewForm
            barberId={reviewFormData.barberId}
            bookingId={reviewFormData.bookingId}
            onClose={() => setReviewFormData(null)}
            onSuccess={() => {
              setReviewFormData(null);
            }}
            isEditing={reviewFormData.isEditing}
            reviewId={reviewFormData.reviewId}
            initialRating={reviewFormData.initialRating}
            initialComment={reviewFormData.initialComment}
          />
        </View>
      )}

      {/* Booking Form Modal */}
      {!guestMode && selectedBarber && (
        <BookingForm
          isVisible={showBookingForm}
          onClose={() => {
            setShowBookingForm(false);
            setSelectedBarber(null);
          }}
          barberId={selectedBarber.barberId}
          barberName={selectedBarber.barberName || selectedBarber.name}
          onBookingCreated={() => {
            // BookingForm has already told the client the outcome.
            setShowBookingForm(false);
            setSelectedBarber(null);
          }}
        />
      )}
    </SafeAreaView>
  );
} 