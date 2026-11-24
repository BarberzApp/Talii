"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Switch } from '@/shared/components/ui/switch'
import { Separator } from '@/shared/components/ui/separator'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { useToast } from '@/shared/components/ui/use-toast'
import { api, errorMessage } from '@/shared/lib/api'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import {
  MapPin,
  Scissors, Building2,
  Instagram, Music,
  AlertCircle,
  Loader2,
  User,
  Sparkles,
  Save
} from 'lucide-react'
// import { BrowseIntegrationGuide } from './browse-integration-guide' // Removed
import { SpecialtyAutocomplete } from '@/shared/components/ui/specialty-autocomplete'
import { cityStateOf, getAddressSuggestionsDetailed, type GeocodeResult } from '@/shared/lib/geocode'
import { logger } from '@/shared/lib/logger'
import { bookingLinkLabel } from '@/shared/lib/app-url'

const barberProfileSchema = z.object({
  // Basic Info
  name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username must be less than 30 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  businessName: z.string().min(2, 'Business name must be at least 2 characters'),
  bio: z.string().max(500, 'Bio must be less than 500 characters'),
  location: z.string().min(2, 'Location is required'),
  phone: z.string().min(7, 'Please enter a valid phone number'),
  
  // Professional Info
  specialties: z.array(z.string()).min(1, 'Select at least one specialty'),
  
  // Social Media
  instagram: z.string().optional().or(z.literal('')),
  tiktok: z.string().optional().or(z.literal('')),
  
  // Visibility
  isPublic: z.boolean(),
})

type BarberProfileFormData = z.infer<typeof barberProfileSchema>

interface EnhancedBarberProfileSettingsProps {
  onSave?: () => void;
}

// Utility function to extract handle from URL or return as-is if already a handle
function extractHandle(input: string): string {
  if (!input) return '';
  // Remove leading/trailing whitespace
  input = input.trim();
  // If input is a URL, extract the handle
  try {
    const url = new URL(input);
    // Instagram/Twitter/TikTok: last path segment
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      let handle = pathParts[pathParts.length - 1];
      // For TikTok, handle may be prefixed with '@'
      if (handle.startsWith('@')) handle = handle.slice(1);
      return '@' + handle;
    }
  } catch {
    // Not a URL, fall through
  }
  // If input starts with @, return as-is, else add @
  if (input.startsWith('@')) return input;
  return '@' + input;
}

export function EnhancedBarberProfileSettings({ onSave }: EnhancedBarberProfileSettingsProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [locationInput, setLocationInput] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<GeocodeResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const form = useForm<BarberProfileFormData>({
    resolver: zodResolver(barberProfileSchema),
    defaultValues: {
      name: '',
      username: '',
      businessName: '',
      bio: '',
      location: '',
      phone: '',
      specialties: [],
      instagram: '',
      tiktok: '',
      isPublic: true,
    },
  })


  // Debounced fetch suggestions
  const debouncedFetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setLocationSuggestions([]);
      return;
    }
    
    setSuggestionsLoading(true);
    try {
      const suggestions = await getAddressSuggestionsDetailed(query);
      setLocationSuggestions(suggestions);
    } catch (error) {
      logger.error('Error fetching suggestions', error)
      setLocationSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  // Fetch suggestions as user types
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new timer
    if (showSuggestions && locationInput.length >= 3) {
      const timer = setTimeout(() => {
        debouncedFetchSuggestions(locationInput);
      }, 300); // 300ms debounce
      
      debounceTimerRef.current = timer;
    } else if (locationInput.length < 3) {
      setLocationSuggestions([]);
    }
    
    // Cleanup timer on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [locationInput, showSuggestions, debouncedFetchSuggestions]);

  // Handle location input change
  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocationInput(e.target.value ?? '');
    setShowSuggestions(true);
    form.setValue('location', e.target.value ?? '');
  };

  // Handle suggestion select
  const handleSuggestionSelect = (suggestion: GeocodeResult) => {
    // Format: house_number road, city/town, state (e.g., '88 Doe Court, South Brunswick, NJ')
    const address = suggestion.address || {};
    const house = address.house_number || '';
    const road = address.road || '';
    const city = address.city || address.town || address.village || address.hamlet || '';
    const state = address.state || address.state_code || '';
    // Build the formatted string
    const line1 = [house, road].filter(Boolean).join(' ');
    const line2 = [city, state].filter(Boolean).join(', ');
    const formatted = [line1, line2].filter(Boolean).join(', ');
    setLocationInput(formatted);
    setShowSuggestions(false);
    setLocationSuggestions([]); // Clear suggestions immediately
    form.setValue('location', formatted);
  };

  // Hide suggestions once the field loses focus (after a click on one has landed).
  // The location is checked when saving.
  const handleLocationBlur = () => {
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const { reset: resetForm } = form

  const loadBarberProfile = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      logger.debug('Loading barber profile for user', { userId: user.id })

      const me = await api.me.get()
      const profile = me.profile
      const barber = me.barber
      if (!barber) throw new Error('No barber profile')
      const location = [barber.city, barber.state].filter(Boolean).join(', ')

      const formData = {
        name: profile.name || '',
        username: profile.username || '',
        businessName: barber.business_name || '',
        bio: barber.bio || '',
        location,
        phone: profile.phone || '',
        specialties: barber.specialties || [],
        instagram: barber.instagram || '',
        tiktok: barber.tiktok || '',
        isPublic: barber.is_public,
      }

      logger.debug('Setting form data', { hasData: !!formData.name })
      resetForm(formData)
      setLocationInput(location);

    } catch (error) {
      logger.error('Error loading barber profile', error)
      toast({
        title: 'Error',
        description: 'Failed to load profile data. Please refresh the page.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [user, resetForm, toast])

  useEffect(() => {
    if (user) {
      loadBarberProfile()
    }
  }, [user, loadBarberProfile])

  const onSubmit = async (data: BarberProfileFormData) => {
    if (!user) return

    // City and state from the chosen suggestion (or the typed "City, ST"); the
    // API geocodes them for nearby search.
    const geoSuggestions = await getAddressSuggestionsDetailed(data.location);
    const { city, state } = cityStateOf(geoSuggestions[0] ?? data.location)
    if (!city || !state) {
      toast({
        title: 'Check your location',
        description: 'Enter your city and state, for example "Chicago, IL", or pick a suggestion.',
        variant: 'destructive',
      })
      return;
    }

    try {
      setLoading(true)

      const result = await api.me.update({
        name: data.name,
        username: data.username,
        phone: data.phone,
        businessName: data.businessName,
        bio: data.bio,
        specialties: data.specialties,
        instagram: extractHandle(data.instagram || '') || null,
        tiktok: extractHandle(data.tiktok || '') || null,
        city,
        state,
        isPublic: data.isPublic,
      })
      if (result.location && !result.location.geocoded) {
        toast({
          title: 'Location not found',
          description: 'Saved, but we could not place your city on the map, so you will not appear in nearby search yet.',
          variant: 'destructive',
        })
      }

      toast({
        title: 'Success',
        description: 'Profile updated successfully! Your changes will be visible in search results.',
      })

      if (onSave) onSave();

    } catch (error) {
      logger.error('Error updating profile', error)
      toast({
        title: 'Error',
        description: errorMessage(error, 'Failed to update profile'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
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
              Barber Profile Settings
            </h2>
            <p className="text-foreground/70 text-lg mt-2">
              Manage your profile information that appears in search results and booking pages
            </p>
          </div>
        </div>
      </div>

      <Card className="bg-gradient-to-br from-white/5 to-white/3 border border-black/5 dark:border-white/10 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-secondary/10 to-transparent border-b border-black/5 dark:border-white/10 p-6">
          <CardTitle className="flex items-center gap-3 text-foreground text-2xl font-bebas">
            <div className="p-2 bg-secondary/20 rounded-xl">
              <Building2 className="h-6 w-6 text-secondary" />
            </div>
            Profile Information
          </CardTitle>
          <CardDescription className="text-foreground/70 text-base">
            Update your basic information and business details
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              {/* Basic Information */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-secondary/20 rounded-lg flex items-center justify-center">
                    <User className="h-4 w-4 text-secondary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Basic Information</h3>
                </div>
                <Separator className="my-2 bg-secondary/40" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold">Full Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Your full name" {...field} className="bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-foreground placeholder:text-muted-foreground focus:border-secondary rounded-xl backdrop-blur-sm transition-all duration-200" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold">Username *</FormLabel>
                        <FormControl>
                          <Input placeholder="your_username" {...field} className="bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-foreground placeholder:text-muted-foreground focus:border-secondary rounded-xl backdrop-blur-sm transition-all duration-200" />
                        </FormControl>
                        <FormDescription className="text-foreground/60">
                          Used in your booking link: {bookingLinkLabel(field.value || 'your_username')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-semibold">Business Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Your business name" {...field} className="bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-foreground placeholder:text-muted-foreground focus:border-secondary rounded-xl backdrop-blur-sm transition-all duration-200" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-semibold">Bio</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell clients about yourself, your experience, and what makes you unique..."
                          className="min-h-[100px] bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-foreground placeholder:text-muted-foreground focus:border-secondary rounded-xl backdrop-blur-sm transition-all duration-200"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        This appears in search results and your profile page. {field.value?.length || 0}/500 characters
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="location"
                    render={() => (
                      <FormItem className="relative">
                        <FormLabel className="text-foreground font-semibold">Location *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-secondary" />
                            <Input
                              placeholder="City, State (e.g. Chicago, IL)"
                              className="pl-10 bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-foreground placeholder:text-muted-foreground focus:border-secondary rounded-xl backdrop-blur-sm transition-all duration-200"
                              value={locationInput ?? ''}
                              onChange={handleLocationChange}
                              onFocus={() => setShowSuggestions(true)}
                              onBlur={handleLocationBlur}
                              autoComplete="off"
                            />
                            {/* Suggestions dropdown */}
                            {showSuggestions && (locationSuggestions.length > 0 || suggestionsLoading) && (
                              <div className="absolute z-50 left-0 right-0 mt-1 bg-black border border-black/10 dark:border-white/20 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                {suggestionsLoading && (
                                  <div className="px-4 py-2 text-foreground/60 text-sm">
                                    <div className="flex items-center gap-2">
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-secondary"></div>
                                      Searching...
                                    </div>
                                  </div>
                                )}
                                {/* Powered by Google */}
                  <div className="px-3 py-1 flex items-center gap-1.5 border-t border-white/10">
                    <svg className="h-3 w-3" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    <span className="text-[10px] text-foreground/40">Powered by Google</span>
                  </div>
                  {locationSuggestions.map((s, i) => (
                                  <button
                                    key={`${s.place_id || i}-${s.display_name}`}
                                    type="button"
                                    className="w-full text-left px-4 py-2 text-foreground hover:bg-secondary/20"
                                    onMouseDown={() => handleSuggestionSelect(s)}
                                  >
                                    {s.display_name || 'Unknown location'}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold">Phone Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="+1 (555) 123-4567" {...field} className="bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-foreground placeholder:text-muted-foreground focus:border-secondary rounded-xl backdrop-blur-sm transition-all duration-200" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator className="bg-white/20" />

              {/* Professional Information */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-secondary/20 rounded-lg flex items-center justify-center">
                    <Scissors className="h-4 w-4 text-secondary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Professional Information</h3>
                </div>
                <Separator className="my-2 bg-secondary/40" />
                
                <FormField
                  control={form.control}
                  name="specialties"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-semibold">Specialties *</FormLabel>
                      <FormControl>
                        <SpecialtyAutocomplete
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Search and select your specialties..."
                          maxSelections={15}
                        />
                      </FormControl>
                      <FormDescription>
                        Select the services you specialize in. These appear in search results and help clients find you.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              </div>

              <Separator className="bg-white/20" />

              {/* Social Media */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-secondary/20 rounded-lg flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-secondary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Social Media</h3>
                </div>
                <Separator className="my-2 bg-secondary/40" />
                <p className="text-sm text-foreground/80">
                  Add your social media handles (just your @ or username, not the full link).
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="instagram"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-foreground font-semibold">
                          <Instagram className="h-4 w-4 text-[#E1306C]" />
                          Instagram
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="@yourusername" {...field} className="bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-foreground placeholder:text-muted-foreground focus:border-secondary rounded-xl backdrop-blur-sm transition-all duration-200" />
                        </FormControl>
                        <FormDescription className="text-foreground/60">
                          Only your handle (e.g., @yourusername)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />


                  <FormField
                    control={form.control}
                    name="tiktok"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-foreground font-semibold">
                          <Music className="h-4 w-4 text-[#000000]" />
                          TikTok
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="@yourusername" {...field} className="bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-foreground placeholder:text-muted-foreground focus:border-secondary rounded-xl" />
                        </FormControl>
                        <FormDescription className="text-foreground/60">
                          Only your handle (e.g., @yourusername)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                </div>
              </div>

              <Separator className="bg-white/20" />

              {/* Visibility Settings */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-secondary/20 rounded-lg flex items-center justify-center">
                    <AlertCircle className="h-4 w-4 text-secondary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Visibility Settings</h3>
                </div>
                <Separator className="my-2 bg-secondary/40" />
                
                <FormField
                  control={form.control}
                  name="isPublic"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-xl border p-6 bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base text-foreground font-semibold">Public Profile</FormLabel>
                        <FormDescription>
                          When enabled, your profile appears in search results and can be discovered by new clients.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {!form.watch('isPublic') && (
                  <Alert className="bg-red-900/30 border-red-400/30 text-foreground">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Your profile is currently private and won&apos;t appear in search results. Enable public profile to start receiving bookings from new clients.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-6">
                <Button 
                  type="submit" 
                  disabled={loading} 
                  className="min-w-[140px] bg-button text-button-foreground font-semibold rounded-xl px-8 py-3 hover:bg-button/90 shadow-lg text-lg transition-all duration-200 hover:scale-105 active:scale-100 focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-darkpurple"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Profile Preview */}
      {/* Removed profile preview as requested */}

      {/* Integration Guide */}
              {/* BrowseIntegrationGuide removed */}
    </div>
  )
} 