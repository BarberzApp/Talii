import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../shared/hooks/useAuth';
import { useTheme } from '../shared/components/theme';
import tw from 'twrnc';
import {
  Button,
  Card,
  CardContent,
  Badge,
  Avatar,
  Dialog,
} from '../shared/components/ui';
import {
  Heart,
  Users,
  History,
  Camera,
  Loader2,
  Calendar,
  Clock,
} from 'lucide-react-native';
import { api, isApiError } from '../shared/lib/api';
import {
  formatBookingTime,
  formatCents,
  formatInTimeZone,
  type BookingStatus,
  type ServiceRow,
  type UpdateMeBody,
} from '@barber-app/shared';
import { logger } from '../shared/lib/logger';
import { ImageUpload } from '../shared/components/ui/ImageUpload';
import {
  getAvatarFallbackProps,
} from '../shared/helpers/fallbackImageHelper';

const { width, height } = Dimensions.get('window');

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  username: string;
  avatar_url: string | null;
  cover_photo_url: string | null;
  /** "City, State" from the barber listing (barbers only). */
  location: string | null;
}

interface BarberProfile {
  id: string;
  bio: string | null;
  business_name: string | null;
  specialties: string[];
  portfolio: string[];
  services: Array<Pick<ServiceRow, 'id' | 'name' | 'description' | 'price_cents' | 'duration_minutes'>>;
}

interface Booking {
  id: string;
  startsAt: string;
  /** The barber's time zone; booking times are shown in it. */
  timeZone: string;
  service: string;
  barber: {
    id: string;
    name: string;
    image?: string;
  };
  status: BookingStatus;
}

export default function ProfilePortfolio() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { user, userProfile, logout, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [barberProfile, setBarberProfile] = useState<BarberProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState(userProfile?.role === 'barber' ? 'portfolio' : 'stylists');
  const [selectedPortfolioImage, setSelectedPortfolioImage] = useState<string | null>(null);
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);
  const [showCoverUpload, setShowCoverUpload] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [coverError, setCoverError] = useState(false);

  // Profile from GET /api/me; services (barbers) or bookings (clients) from the API.
  const fetchProfileData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setAvatarError(false);
      setCoverError(false);

      const me = await api.me.get();
      const listing = me.barber;
      setProfile({
        id: me.profile.id,
        name: me.profile.name,
        email: me.profile.email,
        username: me.profile.username,
        avatar_url: me.profile.avatar_url,
        cover_photo_url: me.profile.cover_photo_url,
        location: [listing?.city, listing?.state].filter(Boolean).join(', ') || null,
      });

      if (me.profile.role === 'barber' && listing) {
        let services: BarberProfile['services'] = [];
        try {
          services = (await api.services.list()).services.filter((s) => s.is_active);
        } catch (error) {
          logger.error('Error fetching services:', error);
        }
        setBarberProfile({
          id: listing.id,
          bio: listing.bio,
          business_name: listing.business_name,
          specialties: listing.specialties ?? [],
          portfolio: listing.portfolio ?? [],
          services,
        });
      } else {
        const { bookings: rows } = await api.bookings.list({ as: 'client', order: 'desc', limit: 50 });
        setBookings(
          rows
            .filter((b) => b.status !== 'pending')
            .map((b) => ({
              id: b.id,
              startsAt: b.starts_at,
              timeZone: b.barber?.timezone || 'America/New_York',
              service: b.service?.name || 'Service',
              barber: {
                id: b.barber_id,
                name: b.barber?.business_name || b.barber?.profile?.name || 'Barber',
                image: b.barber?.profile?.avatar_url ?? undefined,
              },
              status: b.status,
            }))
        );
      }
    } catch (error) {
      logger.error('Error fetching profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfileData();
    setRefreshing(false);
  };

  /** PATCH /api/me with new image fields; returns false (after alerting) on failure. */
  const saveImages = async (body: UpdateMeBody, failure: string): Promise<boolean> => {
    try {
      await api.me.update(body);
      return true;
    } catch (error) {
      logger.error('Error saving images:', error);
      Alert.alert('Error', isApiError(error) ? error.message : failure);
      return false;
    }
  };

  const handleAvatarUpload = async (imageUrl: string) => {
    if (!(await saveImages({ avatarUrl: imageUrl }, 'Failed to update avatar. Please try again.'))) return;
    setAvatarError(false);
    setProfile(prev => prev ? { ...prev, avatar_url: imageUrl } : null);
    Alert.alert('Success', 'Avatar updated successfully!');
    await Promise.all([fetchProfileData(), refreshProfile()]);
  };

  const handleCoverUpload = async (imageUrl: string) => {
    if (!(await saveImages({ coverPhotoUrl: imageUrl }, 'Failed to update cover photo. Please try again.'))) return;
    setCoverError(false);
    setProfile(prev => prev ? { ...prev, cover_photo_url: imageUrl } : null);
    Alert.alert('Success', 'Cover photo updated successfully!');
    await Promise.all([fetchProfileData(), refreshProfile()]);
  };

  const savePortfolio = async (portfolio: string[], failure: string) => {
    if (!(await saveImages({ portfolio }, failure))) return false;
    setBarberProfile(prev => prev ? { ...prev, portfolio } : null);
    return true;
  };

  // Booking times are shown in the barber's time zone.
  const formatDate = (startsAt: string, timeZone: string) =>
    formatInTimeZone(startsAt, timeZone, { month: 'short', day: 'numeric', year: 'numeric' });

  const formatTime = (startsAt: string, timeZone: string) => formatBookingTime(startsAt, timeZone);

  // Set initial tab based on user role
  useEffect(() => {
    if (userProfile) {
      if (userProfile.role === 'barber') {
        setActiveTab('portfolio');
      } else {
        setActiveTab('stylists');
      }
    }
  }, [userProfile]);

  if (loading) {
    return (
      <SafeAreaView style={[tw`flex-1 justify-center items-center`, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[tw`mt-4 text-lg`, { color: colors.foreground }]}>
          Loading your profile...
        </Text>
      </SafeAreaView>
    );
  }

  if (!user || !profile) {
    return (
      <SafeAreaView style={[tw`flex-1 justify-center items-center`, { backgroundColor: colors.background }]}>
        <Text style={[tw`text-lg`, { color: colors.foreground }]}>
          Profile not found
        </Text>
        <Button onPress={() => navigation.goBack()} style={tw`mt-4`}>
          Go Back
        </Button>
      </SafeAreaView>
    );
  }

  const isBarber = userProfile?.role === 'barber';
  const pastBarbers = [...new Set(bookings.map(b => b.barber.id))].map(barberId => {
    const booking = bookings.find(b => b.barber.id === barberId);
    return booking?.barber;
  }).filter(Boolean);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'portfolio':
        return (
          <View style={tw`flex-1 px-4`}>
            {isBarber ? (
              // Barber Portfolio - Show portfolio images
              <View style={tw`space-y-4 py-4`}>
                {/* Portfolio Image Upload */}
                <ImageUpload
                  bucket="media"
                  onUploadComplete={async (imageUrl) => {
                    const updated = [...(barberProfile?.portfolio || []), imageUrl];
                    if (await savePortfolio(updated, 'Failed to save portfolio image')) {
                      Alert.alert('Success', 'Portfolio image added successfully!');
                    }
                  }}
                  onUploadError={(error) => {
                    Alert.alert('Upload Error', error);
                  }}
                  maxImages={10}
                  aspectRatio={1}
                  title="Add Portfolio Image"
                  description="Showcase your best work"
                  existingImages={barberProfile?.portfolio || []}
                  onImagePress={(imageUrl) => {
                    setSelectedPortfolioImage(imageUrl);
                  }}
                  onRemoveImage={async (index) => {
                    const updated = (barberProfile?.portfolio || []).filter((_, i) => i !== index);
                    await savePortfolio(updated, 'Failed to remove portfolio image');
                  }}
                />


              </View>
            ) : (
              // Client Portfolio - Empty state (portfolio tab hidden for clients)
                  <View style={tw`flex-1 justify-center items-center py-8`}>
                    <Text style={[tw`text-sm text-center`, { color: colors.mutedForeground }]}>
                  Portfolio view not available for clients
                    </Text>
              </View>
            )}
          </View>
        );

      case 'stylists':
        return (
          <View style={tw`flex-1 px-4`}>
            <View style={tw`flex-1 justify-center items-center py-8`}>
              <Users size={48} style={[tw`mb-4`, { color: colors.mutedForeground }]} />
              <Text style={[tw`font-bold text-xl mb-2 text-center`, { color: colors.foreground }]}>
                No past stylists
              </Text>
              <Text style={[tw`text-sm text-center`, { color: colors.mutedForeground }]}>
                Book appointments to see your stylists here
              </Text>
            </View>
          </View>
        );

      case 'services':
        return (
          <View style={tw`flex-1 px-4`}>
            {isBarber ? (
              <View style={tw`space-y-4 py-4`}>
                {/* Services Overview Header */}
                <View style={[
                  tw`flex-row items-center justify-center p-6 rounded-2xl`,
                  { backgroundColor: colors.glass }
                ]}>
                  <View style={tw`items-center`}>
                    <View style={[
                      tw`w-12 h-12 rounded-full items-center justify-center mb-3`,
                      { backgroundColor: colors.glass }
                    ]}>
                      <History size={24} color={colors.primary} />
                    </View>
                    <Text style={[tw`font-semibold text-base`, { color: colors.foreground }]}>
                      My Services
                    </Text>
                    <Text style={[tw`text-sm mt-1`, { color: colors.mutedForeground }]}>
                      View your current offerings
                    </Text>
                  </View>
                </View>

                {/* Services Overview */}
                <View style={tw`space-y-3`}>
                  <Text style={[tw`text-lg font-semibold`, { color: colors.foreground }]}>
                    My Services
                  </Text>
                  
                  {barberProfile?.services && barberProfile.services.length > 0 ? (
                    <View style={tw`space-y-3`}>
                      {barberProfile.services.map((service) => (
                        <View key={service.id} style={[
                          tw`p-4 rounded-xl`,
                          { backgroundColor: colors.glass }
                        ]}>
                          <View style={tw`flex-row items-center justify-between`}>
                            <View style={tw`flex-1`}>
                              <Text style={[tw`font-semibold text-base`, { color: colors.foreground }]}>
                                {service.name}
                              </Text>
                              {service.description && (
                                <Text style={[tw`text-sm mt-1`, { color: colors.mutedForeground }]}>
                                  {service.description}
                                </Text>
                              )}
                              <View style={tw`flex-row items-center mt-2`}>
                                <View style={[
                                  tw`px-2 py-1 rounded-full`,
                                  { backgroundColor: colors.glass }
                                ]}>
                                  <Text style={[tw`text-xs font-medium`, { color: colors.primary }]}>
                                    {service.duration_minutes} min
                                  </Text>
                                </View>
                              </View>
                            </View>
                            <View style={tw`items-end`}>
                              <Text style={[tw`font-bold text-xl`, { color: colors.primary }]}>
                                {formatCents(service.price_cents)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={tw`flex-1 justify-center items-center py-8`}>
                      <History size={48} style={[tw`mb-4`, { color: colors.mutedForeground }]} />
                      <Text style={[tw`font-bold text-xl mb-2 text-center`, { color: colors.foreground }]}>
                        No services set up yet
                      </Text>
                      <Text style={[tw`text-sm text-center`, { color: colors.mutedForeground }]}>
                        Set up your services and pricing to start accepting bookings
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <View style={tw`space-y-4`}>
                {bookings.length === 0 ? (
                  <View style={tw`flex-1 justify-center items-center py-8`}>
                    <Calendar size={48} style={[tw`mb-4`, { color: colors.mutedForeground }]} />
                    <Text style={[tw`font-bold text-xl mb-2 text-center`, { color: colors.foreground }]}>
                      No bookings yet
                    </Text>
                    <Text style={[tw`text-sm text-center`, { color: colors.mutedForeground }]}>
                      Start booking appointments with stylists
                    </Text>
                  </View>
                ) : (
                  bookings.map((booking) => (
                    <Card key={booking.id} style={[tw`border`, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
                      <CardContent style={tw`p-4`}>
                        <View style={tw`flex-row items-center gap-3`}>
                          <Avatar size="md" src={booking.barber.image} fallback={booking.barber.name?.charAt(0)} />
                          <View style={tw`flex-1`}>
                            <Text style={[tw`font-semibold`, { color: colors.foreground }]}>
                              {booking.barber.name}
                            </Text>
                            <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>
                              {booking.service}
                            </Text>
                            <View style={tw`flex-row items-center gap-4 mt-1`}>
                              <View style={tw`flex-row items-center gap-1`}>
                                <Calendar size={12} color={colors.mutedForeground} />
                                <Text style={[tw`text-xs`, { color: colors.mutedForeground }]}>
                                  {formatDate(booking.startsAt, booking.timeZone)}
                                </Text>
                              </View>
                              <View style={tw`flex-row items-center gap-1`}>
                                <Clock size={12} color={colors.mutedForeground} />
                                <Text style={[tw`text-xs`, { color: colors.mutedForeground }]}>
                                  {formatTime(booking.startsAt, booking.timeZone)}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <Badge 
                            style={[
                              booking.status === 'completed' 
                                ? { backgroundColor: colors.successSubtle, borderColor: colors.success }
                                : { backgroundColor: colors.muted, borderColor: colors.border }
                            ]}
                          >
                            <Text style={[
                              booking.status === 'completed' 
                                ? { color: colors.success }
                                : { color: colors.mutedForeground }
                            ]}>
                              {booking.status}
                            </Text>
                          </Badge>
                        </View>
                      </CardContent>
                    </Card>
                  ))
                )}
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: colors.background }]}>
      {/* Header Section */}
      <View style={tw`relative w-full overflow-hidden`}>
        {/* Cover Photo */}
        <View style={[tw`h-40 w-full relative`, { backgroundColor: colors.primarySubtle }]}>
          {profile.cover_photo_url && !coverError ? (
            <Image
              source={{ uri: profile.cover_photo_url }}
              style={tw`absolute inset-0 w-full h-full`}
              resizeMode="cover"
              onError={() => {
                setCoverError(true);
              }}
            />
          ) : (
            <View style={[tw`absolute inset-0 w-full h-full`, { backgroundColor: colors.primarySubtle }]}>
              <View style={[tw`absolute top-4 left-4 w-20 h-20 border rounded-full`, { borderColor: colors.primaryTint, opacity: 0.4 }]} />
              <View style={[tw`absolute bottom-4 right-4 w-16 h-16 border rounded-full`, { borderColor: colors.primaryTint, opacity: 0.3 }]} />
              <View style={[tw`absolute`, { top: '40%', left: '45%', width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: colors.primaryTint, opacity: 0.25 }]} />
            </View>
          )}
          {/* Camera button for cover photo */}
          <TouchableOpacity
            style={[tw`absolute top-3 right-3 z-20 h-9 w-9 rounded-full items-center justify-center`, { backgroundColor: 'rgba(0,0,0,0.3)' }]}
            onPress={() => setShowCoverUpload(true)}
          >
            <Camera size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Avatar - Positioned exactly where cover photo ends */}
        <View style={[
          tw`absolute top-28 z-20`,
          { 
            left: width / 2,
            transform: [{ translateX: -48 }] // w-24 = 96px, so half is 48px
          }
        ]}>
          <View style={[tw`w-24 h-24 rounded-full overflow-hidden border-4`, { borderColor: colors.surfaceElevated, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 6 }]}>
            {profile.avatar_url && !avatarError ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={tw`w-full h-full`}
                resizeMode="cover"
                onError={() => {
                  setAvatarError(true);
                }}
              />
            ) : (
              <View style={[tw`w-full h-full items-center justify-center`, { backgroundColor: colors.primarySubtle }]}>
                <Text style={[tw`text-3xl font-bold`, { color: colors.primary }]}>
                  {getAvatarFallbackProps(profile.name || profile.username).initials}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[tw`absolute bottom-0 right-0 h-8 w-8 rounded-full items-center justify-center`, { backgroundColor: colors.primary }]}
            onPress={() => setShowAvatarUpload(true)}
          >
            <Camera size={14} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>
        
        {/* Profile Info */}
        <View style={tw`px-4 pt-16 pb-4 items-center`}>
          <Text style={[tw`text-xl font-bold mb-1 text-center`, { color: colors.foreground }]}>
            {isBarber && barberProfile?.business_name ? barberProfile.business_name : profile.name}
          </Text>
          {profile.username && (
            <Text style={[tw`text-sm mb-1 text-center`, { color: colors.primary }]}>
              @{profile.username}
            </Text>
          )}
          {isBarber && barberProfile?.bio && (
            <Text style={[tw`text-sm mb-2 text-center`, { color: colors.mutedForeground }]}>
              {barberProfile.bio}
            </Text>
          )}
          {profile.location && (
            <Text style={[tw`text-sm text-center`, { color: colors.foreground }]}>
              {profile.location}
            </Text>
          )}
          {isBarber && barberProfile?.specialties && barberProfile.specialties.length > 0 && (
            <View style={tw`flex-row flex-wrap justify-center mt-2 gap-1`}>
              {barberProfile.specialties.slice(0, 3).map((specialty, index) => (
                <Badge key={index} style={[{ backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
                  <Text style={[tw`text-xs`, { color: colors.foreground }]}>
                    {specialty}
                  </Text>
                </Badge>
              ))}
              {barberProfile.specialties.length > 3 && (
                <Badge style={[{ backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
                  <Text style={[tw`text-xs`, { color: colors.foreground }]}>
                    +{barberProfile.specialties.length - 3} more
                  </Text>
                </Badge>
              )}
            </View>
          )}
        </View>

        {/* Tabs Under Avatar */}
        <View style={[tw`flex-row border-b`, { borderColor: colors.glassBorder, backgroundColor: colors.background }]}>
          {isBarber && (
          <TouchableOpacity
            style={tw`flex-1 py-3 items-center`}
            onPress={() => setActiveTab('portfolio')}
          >
            <Heart 
              size={20} 
              color={activeTab === 'portfolio' ? colors.primary : colors.mutedForeground} 
            />
            <Text style={[
              tw`text-xs mt-1`, 
              { color: activeTab === 'portfolio' ? colors.primary : colors.mutedForeground }
            ]}>
                Portfolio
            </Text>
          </TouchableOpacity>
          )}
          
          {!isBarber && (
          <TouchableOpacity
            style={tw`flex-1 py-3 items-center`}
            onPress={() => setActiveTab('stylists')}
          >
            <Users 
              size={20} 
              color={activeTab === 'stylists' ? colors.primary : colors.mutedForeground} 
            />
            <Text style={[
              tw`text-xs mt-1`, 
              { color: activeTab === 'stylists' ? colors.primary : colors.mutedForeground }
            ]}>
              Stylists
            </Text>
          </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={tw`flex-1 py-3 items-center`}
            onPress={() => setActiveTab('services')}
          >
            <History 
              size={20} 
              color={activeTab === 'services' ? colors.primary : colors.mutedForeground} 
            />
            <Text style={[
              tw`text-xs mt-1`, 
              { color: activeTab === 'services' ? colors.primary : colors.mutedForeground }
            ]}>
              {isBarber ? 'Services' : 'Bookings'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Content */}
      <ScrollView
        style={tw`flex-1`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderTabContent()}
      </ScrollView>

      {/* Portfolio Image Preview Dialog */}
      <Dialog visible={selectedPortfolioImage !== null} onClose={() => setSelectedPortfolioImage(null)}>
        {selectedPortfolioImage && (
          <View style={tw`items-center justify-center`}>
            <Image
              source={{ uri: selectedPortfolioImage }}
              style={[tw`rounded-xl`, { 
                width: Math.min(width - 80, 400),
                height: Math.min(width - 80, 400),
              }]}
              resizeMode="contain"
            />
          </View>
        )}
      </Dialog>

      {/* Avatar Upload Modal */}
      <Dialog visible={showAvatarUpload} onClose={() => setShowAvatarUpload(false)}>
        <View style={tw`p-4`}>
          <Text style={[tw`text-lg font-semibold mb-4`, { color: colors.foreground }]}>
            Update Profile Picture
          </Text>
          <ImageUpload
            onUploadComplete={async (imageUrl) => {
              await handleAvatarUpload(imageUrl);
              setShowAvatarUpload(false);
            }}
            onUploadError={(error) => {
              Alert.alert('Upload Error', error);
            }}
            maxImages={1}
            aspectRatio={1}
            title="Upload Avatar"
            description="Select a square image for your profile picture"
            existingImages={profile?.avatar_url ? [profile.avatar_url] : []}
            bucket="avatars"
            replace
            onRemoveImage={async () => {
              if (await saveImages({ avatarUrl: null }, 'Failed to remove avatar')) {
                setProfile(prev => prev ? { ...prev, avatar_url: null } : null);
                await Promise.all([fetchProfileData(), refreshProfile()]);
              }
            }}
          />
        </View>
      </Dialog>

      {/* Cover Photo Upload Modal */}
      <Dialog visible={showCoverUpload} onClose={() => setShowCoverUpload(false)}>
        <View style={tw`p-4`}>
          <Text style={[tw`text-lg font-semibold mb-4`, { color: colors.foreground }]}>
            Update Cover Photo
          </Text>
          <ImageUpload
            onUploadComplete={async (imageUrl) => {
              await handleCoverUpload(imageUrl);
              setShowCoverUpload(false);
            }}
            onUploadError={(error) => {
              Alert.alert('Upload Error', error);
            }}
            maxImages={1}
            aspectRatio={16/9}
            title="Upload Cover Photo"
            description="Select a wide image for your cover photo"
            existingImages={profile?.cover_photo_url ? [profile.cover_photo_url] : []}
            bucket="avatars"
            replace
            onRemoveImage={async () => {
              if (await saveImages({ coverPhotoUrl: null }, 'Failed to remove cover photo')) {
                setProfile(prev => prev ? { ...prev, cover_photo_url: null } : null);
                await fetchProfileData();
              }
            }}
          />
        </View>
      </Dialog>
    </SafeAreaView>
  );
} 