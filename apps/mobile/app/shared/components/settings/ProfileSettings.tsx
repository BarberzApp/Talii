import React, { useState, useEffect } from 'react';
import { geocodeAddress } from '../../lib/geocode';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../theme/ThemeProvider';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Button, Card, CardContent, LoadingSpinner, LocationInput, Input, Textarea } from '../ui';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  Save, 
  AlertCircle,
  Instagram,
  Twitter,
  Facebook,
  Music,
  Sparkles,
  Check,
  Info,
  Camera
} from 'lucide-react-native';
import { ProfileFormData } from '../../types/settings.types';
import { 
  CARRIER_OPTIONS, 
  PRICE_RANGES, 
  BARBER_SPECIALTIES, 
  extractHandle 
} from '../../utils/settings.utils';
import { notificationService } from '../../lib/notifications';
import { logger } from '../../lib/logger';


interface ProfileSettingsProps {
  onUpdate?: () => void;
}

export function ProfileSettings({ onUpdate }: ProfileSettingsProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isBarber, setIsBarber] = useState(false);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    username: '',
    email: '',
    phone: '',
    bio: '',
    location: '',
    description: '',
    specialties: [],
    businessName: '',
    isPublic: true,
    socialMedia: {
      instagram: '',
      twitter: '',
      tiktok: '',
      facebook: ''
    },
    sms_notifications: false,
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile?.role === 'barber') {
        setIsBarber(true);
        const { data: barber } = await supabase
          .from('barbers')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (barber) {
          setBarberId(barber.id);
          setFormData({
            name: profile.name || '',
            username: profile.username || '',
            email: profile.email || '',
            phone: profile.phone || '',
            bio: barber.bio || profile.bio || '',
            location: profile.location || '',
            description: profile.description || '',
            specialties: barber.specialties || [],
            businessName: barber.business_name || '',
            isPublic: profile.is_public ?? true,
            socialMedia: {
              instagram: barber.instagram || '',
              twitter: barber.twitter || '',
              tiktok: barber.tiktok || '',
              facebook: barber.facebook || ''
            },
            sms_notifications: profile.sms_notifications || false,
          });
        }
      } else {
        setFormData({
          name: profile.name || '',
          username: profile.username || '',
          email: profile.email || '',
          phone: profile.phone || '',
          bio: profile.bio || '',
          location: profile.location || '',
          description: profile.description || '',
          specialties: [],
          businessName: '',
          isPublic: profile.is_public || false,
          socialMedia: {
            instagram: '',
            twitter: '',
            tiktok: '',
            facebook: ''
          },
          sms_notifications: profile.sms_notifications || false,
        });
      }
    } catch (error) {
      logger.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: {[key: string]: string} = {};
    
    if (!formData.name?.trim()) errors.name = 'Full name is required';
    if (!formData.username?.trim()) errors.username = 'Username is required';
    if (formData.username && !/^[a-zA-Z0-9_]{3,30}$/.test(formData.username)) {
      errors.username = 'Username must be 3-30 characters, letters, numbers, and underscores only';
    }
    if (!formData.email?.trim()) errors.email = 'Email is required';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (isBarber && !formData.businessName?.trim()) {
      errors.businessName = 'Business name is required for barbers';
    }
    if (isBarber && !formData.bio?.trim()) {
      errors.bio = 'Bio is required for barbers';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors before saving.');
      return;
    }

    try {
      setIsLoading(true);
      
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          username: formData.username,
          email: formData.email,
          phone: formData.phone,
          bio: formData.bio,
          location: formData.location,
          description: formData.description,
          is_public: formData.isPublic,
          sms_notifications: formData.sms_notifications,
        })
        .eq('id', user?.id);

      if (profileError) throw profileError;

      // If user is a barber and location changed, geocode and save coordinates
      if (isBarber && formData.location) {
        try {
          const coords = await geocodeAddress(formData.location);
          if (coords) {
            const { error: barberError } = await supabase
              .from('barbers')
              .update({
                latitude: coords.lat,
                longitude: coords.lon,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', user?.id);
            if (barberError) {
              logger.error('Error updating barber coordinates:', barberError);
            } else {
              logger.log('✅ Barber coordinates updated:', coords);
            }
          }
        } catch (geocodeError) {
          logger.error('Geocoding error:', geocodeError);
          // Don't fail the save if geocoding fails
        }
      }

      // Update barber data if applicable
      if (isBarber && barberId) {
        const { error: barberError } = await supabase
          .from('barbers')
          .update({
            business_name: formData.businessName,
            bio: formData.bio,
            specialties: formData.specialties,
            instagram: extractHandle(formData.socialMedia.instagram),
            twitter: extractHandle(formData.socialMedia.twitter),
            tiktok: extractHandle(formData.socialMedia.tiktok),
            facebook: extractHandle(formData.socialMedia.facebook),
          })
          .eq('id', barberId);

        if (barberError) throw barberError;
      }

      Alert.alert('Success', 'Profile updated successfully!');
      onUpdate?.();
    } catch (error) {
      logger.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSpecialty = (specialty: string) => {
    const currentSpecialties = formData.specialties;
    const newSpecialties = currentSpecialties.includes(specialty)
      ? currentSpecialties.filter(s => s !== specialty)
      : [...currentSpecialties, specialty];
    setFormData({ ...formData, specialties: newSpecialties });
  };

  const handlePushNotificationToggle = async () => {
    try {
      if (!formData.sms_notifications) {
        // Enable push notifications
        logger.log('🔔 Requesting push notification permissions...');
        
        // Initialize notifications and request permissions
        await notificationService.initialize();
        
        // Update local state
        setFormData({ ...formData, sms_notifications: true });
        
        Alert.alert(
          'Push Notifications Enabled',
          'You will now receive notifications for bookings, payments, and other important updates.',
          [{ text: 'OK' }]
        );
      } else {
        // Disable push notifications
        logger.log('🔕 Disabling push notifications...');
        
        // Update local state
        setFormData({ ...formData, sms_notifications: false });
        
        Alert.alert(
          'Push Notifications Disabled',
          'You will no longer receive push notifications. You can re-enable them anytime.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      logger.error('Error toggling push notifications:', error);
      Alert.alert(
        'Error',
        'Failed to update push notification settings. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={tw`flex-1`}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-24`}>
        {/* Basic Information */}
        <Card style={[tw`mb-6`, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
          <CardContent style={tw`p-4`}>
            <View style={tw`flex-row items-center mb-4`}>
              <User size={20} color={colors.primary} style={tw`mr-2`} />
              <Text style={[tw`text-lg font-semibold`, { color: colors.foreground }]}>
                Basic Information
              </Text>
            </View>

            <Input
              label="Full Name *"
              value={formData.name}
              onChangeText={(text: string) => setFormData({ ...formData, name: text })}
              placeholder="Your full name"
              icon={User}
              error={validationErrors.name}
            />

            <Input
              label="Username *"
              value={formData.username}
              onChangeText={(text: string) => setFormData({ ...formData, username: text })}
              placeholder="your_username"
              icon={User}
              error={validationErrors.username}
              description={`bocmstyle.com/book/${formData.username || 'your_username'}`}
            />

            {isBarber && (
              <Input
                label="Business Name *"
                value={formData.businessName}
                onChangeText={(text: string) => setFormData({ ...formData, businessName: text })}
                placeholder="Your business name"
                icon={Building2}
                error={validationErrors.businessName}
              />
            )}

            <Input
              label="Email *"
              value={formData.email}
              onChangeText={(text: string) => setFormData({ ...formData, email: text })}
              placeholder="your@email.com"
              keyboardType="email-address"
              icon={Mail}
              error={validationErrors.email}
            />

            <Input
              label="Phone"
              value={formData.phone}
              onChangeText={(text: string) => setFormData({ ...formData, phone: text })}
              placeholder="(555) 123-4567"
              keyboardType="phone-pad"
              icon={Phone}
              error={validationErrors.phone}
            />

            <View style={tw`mb-4`}>
              <View style={tw`flex-row items-center mb-2`}>
                <MapPin size={16} color={colors.primary} style={tw`mr-2`} />
                <Text style={[tw`text-sm font-medium`, { color: colors.foreground }]}>
                  Location
                </Text>
              </View>
              <LocationInput
                value={formData.location}
                onChange={(value: string) => setFormData({ ...formData, location: value })}
                placeholder="Enter your location..."
                error={validationErrors.location}
              />
            </View>

            <Textarea
              label="Bio"
              value={formData.bio}
              onChangeText={(text: string) => setFormData({ ...formData, bio: text })}
              placeholder="Tell clients about yourself..."
              error={validationErrors.bio}
              description={`${formData.bio.length}/500 characters`}
            />
          </CardContent>
        </Card>

        {/* Professional Information (Barbers only) */}
        {isBarber && (
          <Card style={[tw`mb-6`, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
            <CardContent style={tw`p-4`}>
              <View style={tw`flex-row items-center mb-4`}>
                <Sparkles size={20} color={colors.primary} style={tw`mr-2`} />
                <Text style={[tw`text-lg font-semibold`, { color: colors.foreground }]}>
                  Professional Information
                </Text>
              </View>

              <View style={tw`mb-4`}>
                <Text style={[tw`text-sm font-medium mb-2`, { color: colors.foreground }]}>
                  Specialties *
                </Text>
                <View style={tw`flex-row flex-wrap`}>
                  {BARBER_SPECIALTIES.map((specialty) => (
                    <TouchableOpacity
                      key={specialty}
                      onPress={() => toggleSpecialty(specialty)}
                      style={[
                        tw`mr-2 mb-2 px-3 py-1.5 rounded-full`,
                        formData.specialties.includes(specialty)
                          ? { backgroundColor: colors.primary }
                          : { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder }
                      ]}
                    >
                      <Text style={[
                        tw`text-sm`,
                        { color: formData.specialties.includes(specialty) ? colors.primaryForeground : colors.foreground }
                      ]}>
                        {specialty}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {validationErrors.specialties && (
                  <Text style={[tw`text-xs mt-1`, { color: colors.destructive }]}>{validationErrors.specialties}</Text>
                )}
              </View>
            </CardContent>
          </Card>
        )}

        {/* Social Media */}
        {isBarber && (
          <Card style={[tw`mb-6`, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
            <CardContent style={tw`p-4`}>
              <View style={tw`flex-row items-center mb-4`}>
                <Sparkles size={20} color={colors.primary} style={tw`mr-2`} />
                <Text style={[tw`text-lg font-semibold`, { color: colors.foreground }]}>
                  Social Media
                </Text>
              </View>

              <Input
                label="Instagram"
                value={formData.socialMedia.instagram}
                onChangeText={(text: string) => setFormData({ 
                  ...formData, 
                  socialMedia: { ...formData.socialMedia, instagram: text }
                })}
                placeholder="@yourusername"
                icon={Instagram}
              />

              <Input
                label="Twitter/X"
                value={formData.socialMedia.twitter}
                onChangeText={(text: string) => setFormData({ 
                  ...formData, 
                  socialMedia: { ...formData.socialMedia, twitter: text }
                })}
                placeholder="@yourusername"
                icon={Twitter}
              />

              <Input
                label="TikTok"
                value={formData.socialMedia.tiktok}
                onChangeText={(text: string) => setFormData({ 
                  ...formData, 
                  socialMedia: { ...formData.socialMedia, tiktok: text }
                })}
                placeholder="@yourusername"
                icon={Music}
              />

              <Input
                label="Facebook"
                value={formData.socialMedia.facebook}
                onChangeText={(text: string) => setFormData({ 
                  ...formData, 
                  socialMedia: { ...formData.socialMedia, facebook: text }
                })}
                placeholder="yourpagename"
                icon={Facebook}
              />
            </CardContent>
          </Card>
        )}

        {/* Notifications */}
        <Card style={[tw`mb-6`, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
          <CardContent style={tw`p-4`}>
            <View style={tw`flex-row items-center mb-4`}>
              <AlertCircle size={20} color={colors.primary} style={tw`mr-2`} />
              <Text style={[tw`text-lg font-semibold`, { color: colors.foreground }]}>
                Push Notifications
              </Text>
            </View>

            <TouchableOpacity
              onPress={handlePushNotificationToggle}
              style={[
                tw`px-4 py-2 rounded-xl flex-row items-center justify-center`,
                { backgroundColor: formData.sms_notifications ? colors.primary : colors.input }
              ]}
            >
              {formData.sms_notifications ? (
                <>
                  <Check size={16} color={colors.primaryForeground} style={tw`mr-2`} />
                  <Text style={[tw`font-medium`, { color: colors.primaryForeground }]}>Push Notifications Enabled</Text>
                </>
              ) : (
                <Text style={[tw`font-medium`, { color: colors.foreground }]}>Enable Push Notifications</Text>
              )}
            </TouchableOpacity>
          </CardContent>
        </Card>

        {/* Visibility Settings */}
        <Card style={[tw`mb-6`, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
          <CardContent style={tw`p-4`}>
            <View style={tw`flex-row items-center justify-between`}>
              <View style={tw`flex-1 mr-4`}>
                <Text style={[tw`font-medium mb-1`, { color: colors.foreground }]}>
                  Public Profile
                </Text>
                <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>
                  When enabled, your profile appears in search results
                </Text>
              </View>
              <Switch
                value={formData.isPublic}
                onValueChange={(value) => setFormData({ ...formData, isPublic: value })}
                trackColor={{ false: colors.input, true: colors.primary }}
                thumbColor={colors.foreground}
              />
            </View>
          </CardContent>
        </Card>

        {!formData.isPublic && (
          <View style={[tw`mb-6 p-4 rounded-xl flex-row items-start`, { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder }]}>
            <AlertCircle size={16} color={colors.destructive} style={tw`mr-2 mt-0.5`} />
            <View style={tw`flex-1`}>
              <Text style={[tw`text-sm`, { color: colors.destructive }]}>
                Your profile is currently private and won&apos;t appear in search results. Enable public profile to start receiving bookings from new clients.
              </Text>
            </View>
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[tw`py-4 rounded-xl flex-row items-center justify-center`, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <LoadingSpinner color={colors.primaryForeground} />
          ) : (
            <>
              <Save size={20} color={colors.primaryForeground} style={tw`mr-2`} />
              <Text style={[tw`font-semibold text-base`, { color: colors.primaryForeground }]}>
                Save Changes
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
