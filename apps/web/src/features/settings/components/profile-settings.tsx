'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { supabase } from '@/shared/lib/supabase'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { useToast } from '@/shared/components/ui/use-toast'
import { Loader2, Upload, CheckCircle, AlertCircle, User, Mail, Phone, MapPin, Building2, Instagram, Twitter, Facebook, Globe, Save, Camera, Sparkles, Info, Check } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Switch } from '@/shared/components/ui/switch'
import { SpecialtyAutocomplete } from '@/shared/components/ui/specialty-autocomplete'
import { Badge } from '@/shared/components/ui/badge'
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/shared/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { logger } from '@/shared/lib/logger'
import { getAddressSuggestionsDetailed } from '@/shared/lib/geocode'

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
    twitter: string
    tiktok: string
    facebook: string
  }
  carrier: string
  sms_notifications: boolean
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
async function withTimeout(promise: Promise<any>, ms = 10000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ])
}

const CARRIER_OPTIONS = [
  { value: 'verizon', label: 'Verizon' },
  { value: 'att', label: 'AT&T' },
  { value: 'tmobile', label: 'T-Mobile' },
  { value: 'sprint', label: 'Sprint' },
  { value: 'boost', label: 'Boost Mobile' },
  { value: 'uscellular', label: 'US Cellular' },
  { value: 'cricket', label: 'Cricket' },
  { value: 'metro', label: 'MetroPCS' },
  { value: 'googlefi', label: 'Google Fi' },
];

export function ProfileSettings({ onUpdate }: ProfileSettingsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isBarber, setIsBarber] = useState(false)
  const [barberId, setBarberId] = useState<string | null>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({})
  const { toast } = useToast()
  const { user, status } = useAuth()
  const router = useRouter()
  const { push: safePush } = useSafeNavigation();
  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<ProfileFormData>()
  const [isDeveloper, setIsDeveloper] = useState(false)

  // Location autocomplete state
  const [locationInput, setLocationInput] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
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

  const handleLocationSelect = (suggestion: any) => {
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
    if (!data.carrier?.trim()) errors.carrier = 'Carrier is required';
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
      // Fetch profile data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      // Check if user is a barber
      if (profile?.role === 'barber') {
        setIsBarber(true)
        const { data: barber, error: barberError } = await supabase
          .from('barbers')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (barberError) {
          logger.error('Error fetching barber profile', barberError)
          safePush('/barber/onboarding');
          return;
        }
        if (barber) {
          setBarberId(barber.id)
          // Use barber's bio if available, otherwise use profile's bio
          // Parse location into separate fields
          const parsedLocation = parseLocation(profile.location || '');
          setAddressFields(parsedLocation);
          
          // Get carrier and phone from localStorage for autofill
          const storedCarrier = typeof window !== 'undefined' ? localStorage.getItem('sms_carrier') : null;
          const storedPhone = typeof window !== 'undefined' ? localStorage.getItem('sms_phone') : null;
          
          reset({
            name: profile.name || '',
            username: profile.username || '',
            email: profile.email || '',
            phone: profile.phone || storedPhone || '',
            bio: barber.bio || profile.bio || '',
            location: profile.location || '',
            description: profile.description || '',
            specialties: barber.specialties || [],
            businessName: barber.business_name || '',
            isPublic: profile.is_public || false,
            socialMedia: {
              instagram: barber.instagram || '',
              twitter: barber.twitter || '',
              tiktok: barber.tiktok || '',
              facebook: barber.facebook || ''
            },
            carrier: profile.carrier || storedCarrier || '',
            sms_notifications: profile.sms_notifications || false,
          })
        }
      } else {
        // For non-barbers, just use profile data
        // Parse location into separate fields
        const parsedLocation = parseLocation(profile.location || '');
        setAddressFields(parsedLocation);
        
                  // Get carrier and phone from localStorage for autofill
          const storedCarrier = typeof window !== 'undefined' ? localStorage.getItem('sms_carrier') : null;
          const storedPhone = typeof window !== 'undefined' ? localStorage.getItem('sms_phone') : null;
          
          reset({
            name: profile.name || '',
            username: profile.username || '',
            email: profile.email || '',
            phone: profile.phone || storedPhone || '',
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
          carrier: profile.carrier || storedCarrier || '',
          sms_notifications: profile.sms_notifications || false,
        })
      }

      // Set avatar URL if exists
      if (profile.avatar_url) {
        setAvatarUrl(profile.avatar_url)
      }

      // Fetch is_developer from barbers table
      if (user?.role === 'barber') {
        const { data } = await supabase
          .from('barbers')
          .select('is_developer')
          .eq('user_id', user.id)
          .single()

        if (data && typeof data.is_developer === 'boolean') {
          setIsDeveloper(data.is_developer)
        }
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || !e.target.files[0]) return
      const file = e.target.files[0]
      
      // Validate file type and size
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select an image file.',
          variant: 'destructive',
        })
        return
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: 'File too large',
          description: 'Please select an image smaller than 5MB.',
          variant: 'destructive',
        })
        return
      }

      setIsLoading(true)
      // Upload to Supabase Storage with timeout
      await withTimeout((async () => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${user?.id}-${Date.now()}.${fileExt}`
        const { data, error } = await supabase.storage
          .from('avatars')
          .upload(fileName, file)
        if (error) throw error
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName)
        // Update profile with new avatar URL
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', user?.id)
        if (updateError) throw updateError
        setAvatarUrl(publicUrl)
        toast({
          title: 'Success',
          description: 'Avatar updated successfully!',
        })
      })(), 10000)
    } catch (error: any) {
      if (error.message === 'timeout') {
        toast({ title: 'Timeout', description: 'Avatar upload took too long. Please try again.', variant: 'destructive' })
      } else {
        logger.error('Error uploading avatar', error)
        toast({
          title: 'Error',
          description: 'Failed to upload avatar. Please try again.',
          variant: 'destructive',
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

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
        // Update profile
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            name: data.name,
            username: data.username,
            email: data.email,
            phone: data.phone,
            bio: data.bio,
            location: combineAddressFields(addressFields), // Combine address fields
            description: data.description,
            is_public: data.isPublic,
            carrier: data.carrier,
            sms_notifications: data.sms_notifications,
          })
          .eq('id', user?.id)
        if (profileError) throw profileError
        // Update barber data if user is a barber
        if (isBarber && barberId) {
          const { error: barberError } = await supabase
            .from('barbers')
            .update({
              business_name: data.businessName,
              bio: data.bio,
              specialties: data.specialties,
              instagram: extractHandle(data.socialMedia.instagram),
              twitter: extractHandle(data.socialMedia.twitter),
              tiktok: extractHandle(data.socialMedia.tiktok),
              facebook: extractHandle(data.socialMedia.facebook),
            })
            .eq('id', barberId)
          if (barberError) throw barberError
        }
        toast({
          title: 'Success',
          description: 'Profile updated successfully!',
        })
        onUpdate?.()
      })(), 10000)
    } catch (error: any) {
      if (error.message === 'timeout') {
        toast({ title: 'Timeout', description: 'Profile update took too long. Please try again.', variant: 'destructive' })
      } else {
        logger.error('Error updating profile', error)
        toast({
          title: 'Error',
          description: 'Failed to update profile. Please try again.',
          variant: 'destructive',
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeveloperToggle = async (checked: boolean) => {
    setIsDeveloper(checked)
    if (user?.role === 'barber') {
      await supabase
        .from('barbers')
        .update({ is_developer: checked })
        .eq('user_id', user.id)
    }
  }

  // Only show quick stats for clients
  const isClient = user?.role !== 'barber';
  // Example stats (replace with real data if available)
  const quickStats = [
    { label: 'Total Bookings', value: 0, icon: <CheckCircle className="h-6 w-6 text-secondary" /> },
    { label: 'Favorite Barbers', value: 0, icon: <Sparkles className="h-6 w-6 text-secondary" /> },
    { label: 'Member Since', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Recently', icon: <User className="h-6 w-6 text-secondary" /> },
  ];

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
                    <p className="text-sm text-red-400 flex items-center gap-1">
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
                    <p className="text-sm text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {validationErrors.username}
                    </p>
                  )}
                  <p className="text-xs text-foreground/60">
                    Booking link: bocmstyle.com/book/{watch('username') || 'your_username'}
                  </p>
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
                    <p className="text-sm text-red-400 flex items-center gap-1">
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
                    <p className="text-sm text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {validationErrors.phone}
                    </p>
                  )}
                </div>
              </div>
            </div>

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
                          <span className="font-medium">{s.display_name || s.name || 'Unknown location'}</span>
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
                <p className="text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {validationErrors.bio}
                </p>
              )}
            </div>

            {/* SMS Notifications */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-secondary rounded-full"></div>
                <h4 className="text-foreground font-semibold text-sm uppercase tracking-widest">SMS Notifications</h4>
              </div>
              <div className="space-y-3">
                <Label htmlFor="carrier" className="text-foreground font-semibold text-base flex items-center gap-2">
                  <Phone className="h-4 w-4 text-secondary" />
                  Carrier *
                  <span title="We need your carrier to send you free SMS reminders. If you're unsure, check your phone bill or carrier app.">
                    <Info className="h-4 w-4 text-secondary cursor-pointer" />
                  </span>
                </Label>
                <Select
                  value={watch('carrier')}
                  onValueChange={(value: string) => setValue('carrier', value)}
                >
                  <SelectTrigger className={`h-12 px-4 bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 text-foreground placeholder:text-foreground/40 focus:border-secondary focus:ring-secondary/20 rounded-xl backdrop-blur-sm transition-all duration-200 ${validationErrors.carrier ? 'border-red-400' : ''}`}>
                    <SelectValue placeholder="Select your carrier…" />
                  </SelectTrigger>
                  <SelectContent className="bg-gradient-to-br from-white/10 to-white/5 dark:from-white/10 dark:to-white/5 backdrop-blur-2xl border-black/10 dark:border-white/20 rounded-2xl shadow-2xl p-2 text-foreground">
                    {CARRIER_OPTIONS.map((carrier) => (
                      <SelectItem key={carrier.value} value={carrier.value} className="flex items-center justify-between px-4 py-2 hover:bg-secondary/10 rounded-lg transition-colors cursor-pointer mb-1 last:mb-0">
                        <span className="font-medium text-base">{carrier.label}</span>
                        {watch('carrier') === carrier.value && <Check className="h-4 w-4 text-secondary ml-2" />}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {validationErrors.carrier && (
                  <p className="text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {validationErrors.carrier}
                  </p>
                )}
              </div>
              <div>
                <Button
                  type="button"
                  className={!watch('sms_notifications') 
                    ? "bg-gradient-to-r from-secondary to-secondary/90 hover:from-secondary/90 hover:to-secondary/80 text-secondary-foreground font-semibold shadow-lg rounded-xl px-6 py-2 text-base transition-all" 
                    : "bg-green-600/20 border border-green-500/30 text-green-400 hover:text-green-300 font-semibold rounded-xl px-6 py-2 text-base flex items-center gap-2 hover:bg-green-600/30 transition-all"}
                  onClick={() => setValue('sms_notifications', !watch('sms_notifications'))}
                >
                  {!watch('sms_notifications') ? (
                    "Enable SMS Notifications"
                  ) : (
                    <><Check className="h-4 w-4" /> SMS Notifications Enabled</>
                  )}
                </Button>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-gradient-to-r from-secondary to-secondary/90 hover:from-secondary/90 hover:to-secondary/80 text-secondary-foreground font-semibold shadow-lg rounded-xl px-8 py-3 text-lg"
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