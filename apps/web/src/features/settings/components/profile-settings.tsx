'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { supabase } from '@/shared/lib/supabase'
import { api, errorMessage } from '@/shared/lib/api'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { useToast } from '@/shared/components/ui/use-toast'
import { Loader2, AlertCircle, User, Mail, Phone, MapPin, Save } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'
import { logger } from '@/shared/lib/logger'
import { bookingLinkLabel } from '@/shared/lib/app-url'
import { cityStateOf, getAddressSuggestionsDetailed, type GeocodeResult } from '@/shared/lib/geocode'

interface ProfileFormData {
  name: string
  username: string
  email: string
  phone: string
  bio: string
  location: string
  description: string
  specialties: string[]
  businessName: string
  isPublic: boolean
  socialMedia: {
    instagram: string
    tiktok: string
  }
}

interface ProfileSettingsProps {
  onUpdate?: () => void
}

// Utility function to extract handle from URL or return as-is if already a handle
function extractHandle(input: string): string {
  if (!input) return '';
  input = input.trim();
  try {
    const url = new URL(input);
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      let handle = pathParts[pathParts.length - 1];
      if (handle.startsWith('@')) handle = handle.slice(1);
      return '@' + handle;
    }
  } catch {
    // Not a URL
  }
  if (input.startsWith('@')) return input;
  return '@' + input;
}

// Timeout helper
async function withTimeout<T>(promise: Promise<T>, ms = 10000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ])
}

export function ProfileSettings({ onUpdate }: ProfileSettingsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isBarber, setIsBarber] = useState(false)
  const [barberId, setBarberId] = useState<string | null>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [, setAvatarUrl] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({})
  const { toast } = useToast()
  const { user, status } = useAuth()
  const { push: safePush } = useSafeNavigation();
  const { register, handleSubmit, reset, watch } = useForm<ProfileFormData>()

  // Location autocomplete state
  const [locationInput, setLocationInput] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<GeocodeResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add state for separate address fields (removed zipCode and state)
  const [addressFields, setAddressFields] = useState({
    address: '',
    city: ''
  })

  // Function to parse location string into separate fields (simplified)
  const parseLocation = (location: string) => {
    if (!location) return { address: '', city: '' }
    
    // Try different location formats
    const locationStr = location.trim()
    
    // Format: "Address, City, State ZIP" or "Address, City, State"
    const fullMatch = locationStr.match(/^(.+?),\s*([^,]+?)(?:,\s*[A-Za-z]{2,}\s*\d{5}?)?$/);
    if (fullMatch) {
      return {
        address: fullMatch[1].trim(),
        city: fullMatch[2].trim()
      }
    }
    
    // Format: "Address, City State ZIP" or "Address, City State"
    const cityStateMatch = locationStr.match(/^(.+?),\s*([^,]+?)(?:\s+[A-Za-z]{2,}\s*\d{5}?)?$/);
    if (cityStateMatch) {
      return {
        address: cityStateMatch[1].trim(),
        city: cityStateMatch[2].trim()
      }
    }
    
    // Fallback: split by comma and try to extract
    const parts = locationStr.split(',').map((part: string) => part.trim());
    if (parts.length >= 2) {
      const address = parts[0];
      const city = parts[1];
      
      return { address, city }
    }
    
    return { address: locationStr, city: '' }
  }

  // Function to combine address fields into location string (simplified)
  const combineAddressFields = (fields: typeof addressFields) => {
    const parts = [fields.address, fields.city].filter(Boolean);
    return parts.join(', ');
  }

  // Sync locationInput with addressFields when loaded
  useEffect(() => {
    const combined = [addressFields.address, addressFields.city].filter(Boolean).join(', ');
    setLocationInput(combined);
  }, [addressFields.address, addressFields.city]);

  // Debounced fetch suggestions
  const fetchLocationSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setLocationSuggestions([]);
      return;
    }
    setSuggestionsLoading(true);
    try {
      const suggestions = await getAddressSuggestionsDetailed(query);
      setLocationSuggestions(suggestions);
    } catch (err) {
      logger.error('Error fetching location suggestions', err);
      setLocationSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
    if (showSuggestions && locationInput.length >= 3) {
      locationDebounceRef.current = setTimeout(() => {
        fetchLocationSuggestions(locationInput);
      }, 300);
    } else if (locationInput.length < 3) {
      setLocationSuggestions([]);
    }
    return () => { if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current); };
  }, [locationInput, showSuggestions, fetchLocationSuggestions]);

  const handleLocationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocationInput(e.target.value);
    setShowSuggestions(true);
    // Update addressFields address while typing
    setAddressFields(prev => ({ ...prev, address: e.target.value, city: '' }));
  };

  const handleLocationSelect = (suggestion: GeocodeResult) => {
    const addr = suggestion.address || {};
    const house = addr.house_number || '';
    const road = addr.road || '';
    const city = addr.city || addr.town || addr.village || addr.hamlet || '';
    const state = addr.state || addr.state_code || '';
    const line1 = [house, road].filter(Boolean).join(' ');
    const line2 = [city, state].filter(Boolean).join(', ');
    const formatted = [line1, line2].filter(Boolean).join(', ');
    setLocationInput(formatted);
    setAddressFields({ address: [house, road].filter(Boolean).join(' '), city: city });
    setShowSuggestions(false);
    setLocationSuggestions([]);
  };

  const validateForm = (data: ProfileFormData): boolean => {
    const errors: {[key: string]: string} = {}
    
    if (!data.name?.trim()) errors.name = 'Full name is required'
    if (!data.username?.trim()) errors.username = 'Username is required'
    if (data.username && !/^[a-zA-Z0-9_]{3,30}$/.test(data.username)) {
      errors.username = 'Username must be 3-30 characters and contain only letters, numbers, and underscores'
    }
    if (!data.email?.trim()) errors.email = 'Email is required'
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.email = 'Please enter a valid email address'
    }
    if (data.phone && !/^[\+]?[1-9][\d]{0,15}$/.test(data.phone.replace(/\s/g, ''))) {
      errors.phone = 'Please enter a valid phone number'
    }
    if (isBarber && !data.businessName?.trim()) {
      errors.businessName = 'Business name is required for barbers'
    }
    if (isBarber && !data.bio?.trim()) {
      errors.bio = 'Bio is required for barbers'
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const fetchProfile = useCallback(async () => {
    if (!user) return

    try {
      const me = await api.me.get()
      const profile = me.profile
      const barber = profile.role === 'barber' ? me.barber : null
      if (profile.role === 'barber' && !barber) {
        safePush('/barber/onboarding')
        return
      }
      setIsBarber(!!barber)
      setBarberId(barber?.id ?? null)
      // Barbers have a city/state on their listing; profiles have no location.
      const location = barber ? [barber.city, barber.state].filter(Boolean).join(', ') : ''
      setAddressFields(parseLocation(location))

      reset({
        name: profile.name || '',
        username: profile.username || '',
        email: profile.email || '',
        phone: profile.phone || '',
        bio: barber?.bio || '',
        location,
        description: '',
        specialties: barber?.specialties || [],
        businessName: barber?.business_name || '',
        isPublic: barber?.is_public ?? false,
        socialMedia: {
          instagram: barber?.instagram || '',
          tiktok: barber?.tiktok || '',
        },
      })

      if (profile.avatar_url) {
        setAvatarUrl(profile.avatar_url)
      }
    } catch (error) {
      logger.error('Error fetching profile', error)
      toast({
        title: 'Error',
        description: 'Failed to load profile data. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsInitialLoad(false)
    }
  }, [user, reset, toast, safePush])

  useEffect(() => {
    // Redirect if not authenticated
    if (status === 'unauthenticated') {
      safePush('/login')
      return
    }

    if (user && isInitialLoad) {
      fetchProfile()
    }
  }, [status, user, isInitialLoad, safePush])

  const onSubmit = async (data: ProfileFormData) => {
    if (!validateForm(data)) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors before saving.',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsLoading(true)
      await withTimeout((async () => {
        const handle = (v: string) => (v ? extractHandle(v).replace(/^@/, '') : null)
        const { city, state } = cityStateOf(locationInput || combineAddressFields(addressFields))
        await api.me.update({
          name: data.name,
          username: data.username,
          phone: data.phone || null,
          ...(isBarber && barberId
            ? {
                businessName: data.businessName || null,
                bio: data.bio || null,
                specialties: data.specialties,
                instagram: handle(data.socialMedia.instagram),
                tiktok: handle(data.socialMedia.tiktok),
                ...(city && state ? { city, state } : {}),
              }
            : {}),
        })
        // The email is an auth setting: Supabase sends a confirmation link to the new address.
        if (data.email && user?.email && data.email.trim().toLowerCase() !== user.email.toLowerCase()) {
          const { error: emailError } = await supabase.auth.updateUser({ email: data.email.trim() })
          if (emailError) throw emailError
          toast({ title: 'Check your inbox', description: 'Confirm your new email address with the link we sent.' })
        }
        toast({
          title: 'Success',
          description: 'Profile updated successfully!',
        })
        onUpdate?.()
      })(), 10000)
    } catch (error) {
      if (error instanceof Error && error.message === 'timeout') {
        toast({ title: 'Timeout', description: 'Profile update took too long. Please try again.', variant: 'destructive' })
      } else {
        logger.error('Error updating profile', error)
        toast({
          title: 'Error',
          description: errorMessage(error, 'Failed to update profile. Please try again.'),
          variant: 'destructive',
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (isInitialLoad) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="p-4 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-2xl shadow-lg">
              <User className="h-8 w-8 text-secondary" />
            </div>
            <div>
              <h2 className="text-3xl sm:text-4xl font-bebas text-foreground tracking-wide">
                Profile Settings
              </h2>
              <p className="text-foreground/70 text-lg mt-2">Manage your personal information</p>
            </div>
          </div>
        </div>
        
        <Card className="bg-gradient-to-br from-white/5 to-white/3 border border-black/5 dark:border-white/10 shadow-2xl backdrop-blur-xl rounded-3xl">
          <CardContent className="p-8">
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="text-center space-y-4">
                <div className="relative">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-secondary" />
                  <div className="absolute inset-0 rounded-full bg-secondary/20 animate-ping" />
                </div>
                <p className="text-foreground/60 font-medium">Loading profile...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="p-4 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-2xl shadow-lg">
            <User className="h-8 w-8 text-secondary" />
          </div>
          <div>
            <h2 className="text-3xl sm:text-4xl font-bebas text-foreground tracking-wide">
              Profile Settings
            </h2>
            <p className="text-foreground/70 text-lg mt-2">Manage your personal information and preferences</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info Card */}
        <Card className="bg-gradient-to-br from-white/5 to-white/3 border border-black/5 dark:border-white/10 shadow-2xl backdrop-blur-xl rounded-3xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-secondary/10 to-transparent border-b border-black/5 dark:border-white/10 p-6">
            <CardTitle className="text-foreground flex items-center gap-3 text-2xl">
              <div className="p-2 bg-secondary/20 rounded-xl">
                <User className="h-6 w-6 text-secondary" />
              </div>
              Personal Information
            </CardTitle>
            <CardDescription className="text-foreground/70 text-base">
              Update your profile details and contact information
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            {/* Basic Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-secondary rounded-full"></div>
                <h4 className="text-foreground font-semibold text-sm uppercase tracking-widest">Basic Information</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="name" className="text-foreground font-semibold text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-secondary" />
                    Full Name *
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    className={`bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 text-foreground placeholder:text-foreground/40 focus:border-secondary focus:ring-secondary/20 rounded-xl h-12 text-base backdrop-blur-sm transition-all duration-200 ${validationErrors.name ? 'border-red-400' : ''}`}
                    {...register('name', { required: 'Name is required' })}
                    placeholder="Enter your full name"
                  />
                  {validationErrors.name && (
                    <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {validationErrors.name}
                    </p>
                  )}
                </div>
                <div className="space-y-3">
                  <Label htmlFor="username" className="text-foreground font-semibold text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-secondary" />
                    Username *
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    className={`bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 text-foreground placeholder:text-foreground/40 focus:border-secondary focus:ring-secondary/20 rounded-xl h-12 text-base backdrop-blur-sm transition-all duration-200 ${validationErrors.username ? 'border-red-400' : ''}`}
                    {...register('username', { required: 'Username is required' })}
                    placeholder="your_username"
                  />
                  {validationErrors.username && (
                    <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {validationErrors.username}
                    </p>
                  )}
                  {isBarber && (
                    <p className="text-xs text-muted-foreground">
                      Booking link: {bookingLinkLabel(watch('username') || 'your_username')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-secondary rounded-full"></div>
                <h4 className="text-foreground font-semibold text-sm uppercase tracking-widest">Contact Information</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="email" className="text-foreground font-semibold text-base flex items-center gap-2">
                    <Mail className="h-4 w-4 text-secondary" />
                    Email Address *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    className={`bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 text-foreground placeholder:text-foreground/40 focus:border-secondary focus:ring-secondary/20 rounded-xl h-12 text-base backdrop-blur-sm transition-all duration-200 ${validationErrors.email ? 'border-red-400' : ''}`}
                    {...register('email', { required: 'Email is required' })}
                    placeholder="Enter your email address"
                  />
                  {validationErrors.email && (
                    <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {validationErrors.email}
                    </p>
                  )}
                </div>
                <div className="space-y-3">
                  <Label htmlFor="phone" className="text-foreground font-semibold text-base flex items-center gap-2">
                    <Phone className="h-4 w-4 text-secondary" />
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    className={`bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 text-foreground placeholder:text-foreground/40 focus:border-secondary focus:ring-secondary/20 rounded-xl h-12 text-base backdrop-blur-sm transition-all duration-200 ${validationErrors.phone ? 'border-red-400' : ''}`}
                    {...register('phone')}
                    placeholder="(555) 123-4567"
                  />
                  {validationErrors.phone && (
                    <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {validationErrors.phone}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Location and bio belong to a barber's listing; client profiles have neither. */}
            {isBarber && (<>
            {/* Location */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-secondary rounded-full"></div>
                <h4 className="text-foreground font-semibold text-sm uppercase tracking-widest">Location</h4>
              </div>
              <div className="relative">
                <Label htmlFor="location-input" className="text-foreground font-semibold text-base flex items-center gap-2 mb-3">
                  <MapPin className="h-4 w-4 text-secondary" />
                  Address
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
                  <Input
                    id="location-input"
                    type="text"
                    className="pl-10 bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 text-foreground placeholder:text-foreground/40 focus:border-secondary focus:ring-secondary/20 rounded-xl h-12 text-base backdrop-blur-sm transition-all duration-200"
                    value={locationInput}
                    onChange={handleLocationInputChange}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
                    placeholder="Search your address..."
                    autoComplete="off"
                  />
                  {/* Autocomplete dropdown */}
                  {showSuggestions && (locationSuggestions.length > 0 || suggestionsLoading) && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-black/10 dark:border-white/20 rounded-xl shadow-xl overflow-hidden">
                      {suggestionsLoading && (
                        <div className="px-4 py-3 text-foreground/60 text-sm flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-secondary" />
                          Searching...
                        </div>
                      )}
                      {/* Powered by Google attribution */}
                      {locationSuggestions.length > 0 && (
                        <div className="px-3 py-1.5 flex items-center gap-1.5 border-b border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/5">
                          <svg className="h-3 w-3" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                          <span className="text-[10px] text-foreground/40">Powered by Google</span>
                        </div>
                      )}
                      {locationSuggestions.map((s, i) => (
                        <button
                          key={`${s.place_id || i}-${s.display_name}`}
                          type="button"
                          className="w-full text-left px-4 py-2.5 text-foreground hover:bg-secondary/20 text-sm transition-colors"
                          onMouseDown={() => handleLocationSelect(s)}
                        >
                          <span className="font-medium">{s.display_name || 'Unknown location'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-foreground/50 mt-2">
                  Start typing to search your address using Google Places
                </p>
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-secondary rounded-full"></div>
                <h4 className="text-foreground font-semibold text-sm uppercase tracking-widest">Bio</h4>
              </div>
              <Textarea
                id="bio"
                rows={4}
                className={`bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 text-foreground placeholder:text-foreground/40 focus:border-secondary focus:ring-secondary/20 rounded-xl text-base resize-none backdrop-blur-sm transition-all duration-200 ${validationErrors.bio ? 'border-red-400' : ''}`}
                {...register('bio')}
                placeholder="Tell us about yourself..."
              />
              {validationErrors.bio && (
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {validationErrors.bio}
                </p>
              )}
            </div>
            </>)}

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-gradient-to-r from-secondary to-secondary/90 hover:from-secondary/90 hover:to-secondary/80 text-button-foreground font-semibold shadow-lg rounded-xl px-8 py-3 text-lg"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Save className="h-5 w-5 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}