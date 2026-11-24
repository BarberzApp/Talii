import React, { useState, useEffect } from 'react';
import { parseCityState } from '../../lib/geocode';
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
import type { UpdateMeBody } from '@barber-app/shared';
import { api, errorMessage, hasErrorCode } from '../../lib/api';
import { bookingPageUrl } from '../../lib/api-factory';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent, LoadingSpinner, LocationInput, Input, Textarea } from '../ui';
import { User, Mail, Phone, MapPin, Building2, Save, AlertCircle, Instagram, Music, Sparkles } from 'lucide-react-native';
import { ProfileFormData } from '../../types/settings.types';
import { BARBER_SPECIALTIES, extractHandle } from '../../utils/settings.utils';
import { logger } from '../../lib/logger';


interface ProfileSettingsProps {
  onUpdate?: () => void;
}

export function ProfileSettings({ onUpdate }: ProfileSettingsProps) {
  const { colors } = useTheme();
  const { user, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isBarber, setIsBarber] = useState(false);
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
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- it reloads only when the listed keys change; the callback reads the current render
  }, [user]);

  /** GET /api/me: profile plus, for barbers, the listing. */
  const fetchProfile = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const me = await api.me.get();
      const barber = me.profile.role === 'barber' ? me.barber : null;
      setIsBarber(!!barber);
      setFormData({
        name: me.profile.name || '',
        username: me.profile.username || '',
        email: me.profile.email || me.user.email || '',
        phone: me.profile.phone || '',
        bio: barber?.bio || '',
        location: [barber?.city, barber?.state].filter(Boolean).join(', '),
        description: '',
        specialties: barber?.specialties || [],
        businessName: barber?.business_name || '',
        isPublic: barber?.is_public ?? true,
        socialMedia: {
          instagram: barber?.instagram || '',
          twitter: '',
          tiktok: barber?.tiktok || '',
          facebook: ''
        },
      });
    } catch (error) {
      logger.error('Error fetching profile:', error);
      Alert.alert('Error', errorMessage(error, 'Failed to load profile data'));
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

    // PATCH /api/me. Listing fields only for barbers (the server geocodes city/state).
    const handle = (v: string) => (v ? extractHandle(v).replace(/^@/, '') || null : null);
    const body: UpdateMeBody = {
      name: formData.name.trim() || null,
      username: formData.username.trim(),
      phone: formData.phone.trim() || null,
    };
    if (isBarber) {
      const { city, state } = parseCityState(formData.location);
      Object.assign(body, {
        businessName: formData.businessName.trim() || null,
        bio: formData.bio.trim() || null,
        specialties: formData.specialties,
        instagram: handle(formData.socialMedia.instagram),
        tiktok: handle(formData.socialMedia.tiktok),
        city,
        state,
        isPublic: formData.isPublic,
      });
    }

    try {
      setIsLoading(true);
      const res = await api.me.update(body);
      await refreshProfile();
      Alert.alert(
        'Success',
        res.location && !res.location.geocoded
          ? 'Profile updated. We could not find that location on the map, so you may not appear in nearby searches.'
          : 'Profile updated successfully!'
      );
      onUpdate?.();
    } catch (error) {
      logger.error('Error updating profile:', error);
      if (hasErrorCode(error, 'USERNAME_TAKEN')) {
        setValidationErrors({ username: 'That username is taken' });
      }
      Alert.alert('Error', errorMessage(error, 'Failed to update profile'));
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
              description={bookingPageUrl(formData.username || 'your_username') ?? undefined}
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
              label="Email"
              value={formData.email}
              editable={false}
              placeholder="your@email.com"
              keyboardType="email-address"
              icon={Mail}
              description="Your sign-in email"
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

            {isBarber && (
              <>
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
              </>
            )}
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
                label="TikTok"
                value={formData.socialMedia.tiktok}
                onChangeText={(text: string) => setFormData({ 
                  ...formData, 
                  socialMedia: { ...formData.socialMedia, tiktok: text }
                })}
                placeholder="@yourusername"
                icon={Music}
              />
            </CardContent>
          </Card>
        )}

        {isBarber && (
          <>
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

          </>
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
