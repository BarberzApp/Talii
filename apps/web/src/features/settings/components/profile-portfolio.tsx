import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { PortfolioEditor } from './portfolio-editor';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Badge } from '@/shared/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Switch } from '@/shared/components/ui/switch';
import { Play, Instagram, Twitter, Facebook, Edit3, Upload, Video, Plus, X, Loader2, Sparkles, MapPin, Filter, Camera, MoreVertical, Star, Trash2, Edit, Eye, EyeOff, GripVertical, Heart, MessageCircle, Image as ImageIcon, Video as VideoIcon, ArrowLeft, ArrowRight, User, Calendar, Building, Share2, Award, Phone, ExternalLink } from 'lucide-react';
import { useAuth } from '@/shared/hooks/use-auth-zustand';
import { supabase } from '@/shared/lib/supabase';
import { useToast } from '@/shared/components/ui/use-toast';
import { EnhancedBarberProfileSettings } from './enhanced-barber-profile-settings';
import Cropper, { Area } from 'react-easy-crop';
import getCroppedImg from '@/shared/lib/crop-image';
import { useData } from '@/shared/hooks/use-data';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/components/ui/tabs';
import { cn } from '@/shared/lib/utils';
import { BookingForm } from '@/shared/components/booking/booking-form';
import { Progress } from '@/shared/components/ui/progress';
import { logger } from '@/shared/lib/logger';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  username?: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  phone?: string;
  coverphoto?: string; // Fix: match database column name
  instagram?: string;
  twitter?: string;
  facebook?: string;
}

// Update PortfolioItem type
type PortfolioItem = {
  id: string;
  type: 'image' | 'video';
  url: string;
  title?: string;
  likes?: number;
  comments?: number;
};
// Update BarberProfile type
interface BarberProfile {
  id: string;
  user_id: string;
  bio?: string;
  business_name?: string;
  specialties?: string[];
  instagram?: string;
  twitter?: string;
  facebook?: string;
  portfolio?: string[];
  featured_portfolio?: string;
  services?: Array<{
    id: string;
    name: string;
    price: number;
    duration: string;
    description: string;
  }>;
  reviews?: Array<{
    id: string;
    user: string;
    avatar: string;
    rating: number;
    comment: string;
    date: string;
  }>;
}

interface Service {
  id: string;
  barber_id: string;
  name: string;
  price: number;
  duration: string;
  description: string;
  created_at?: string;
}

interface Addon {
  id: string;
  barber_id: string;
  name: string;
  price: number;
  duration: string | null;
  description: string | null;
  created_at?: string;
}


export default function ProfilePortfolio() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [barberProfile, setBarberProfile] = useState<BarberProfile | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [openDialog, setOpenDialog] = useState<null | 'profile' | 'portfolio' | 'video' | 'portfolio-upload' | 'services' | 'addons'>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{
    type: 'video' | 'image';
    url: string;
    title?: string;
    description?: string;
    likes?: number;
    views?: number;
    created_at?: string;
    id?: string;
  } | null>(null);
  const editProfileButtonRef = useRef<HTMLButtonElement>(null);
  const editPortfolioButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  

  // Fetch services
  const fetchServices = useCallback(async () => {
    if (!barberProfile?.id) return

    try {
      setServicesLoading(true)
      logger.debug('Fetching services for barber', { barberId: barberProfile.id })
      
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .eq('barber_id', barberProfile.id)
        .order('created_at', { ascending: false })

      if (servicesError) {
        logger.error('Error fetching services', servicesError)
        throw servicesError
      }

      logger.debug('Found services data', { count: servicesData?.length })
      setServices(servicesData || [])

    } catch (error) {
      logger.error('Error fetching services', error)
      toast({
        title: 'Error',
        description: 'Failed to load services.',
        variant: 'destructive',
      })
    } finally {
      setServicesLoading(false)
    }
  }, [barberProfile?.id, toast])

  // Fetch add-ons
  const fetchAddons = useCallback(async () => {
    if (!barberProfile?.id) return

    try {
      setAddonsLoading(true)
      logger.debug('Fetching add-ons for barber', { barberId: barberProfile.id })
      
      const { data: addonsData, error: addonsError } = await supabase
        .from('service_addons')
        .select('*')
        .eq('barber_id', barberProfile.id)
        .order('created_at', { ascending: false })

      if (addonsError) {
        logger.error('Error fetching add-ons', addonsError)
        throw addonsError
      }

      logger.debug('Found add-ons data', { count: addonsData?.length })
      setAddons(addonsData || [])

    } catch (error) {
      logger.error('Error fetching add-ons', error)
      toast({
        title: 'Error',
        description: 'Failed to load add-ons.',
        variant: 'destructive',
      })
    } finally {
      setAddonsLoading(false)
    }
  }, [barberProfile?.id, toast])

  // Fetch services and add-ons when barber profile is loaded
  useEffect(() => {
    if (barberProfile?.id) {
      fetchServices()
      fetchAddons()
    }
  }, [barberProfile?.id, fetchServices, fetchAddons])

  // Handle booking service
  const handleBookService = (service: Service) => {
    setSelectedBookingDate(new Date())
    setBookingFormOpen(true)
  }

  // Handle add to booking (for add-ons)
  const handleAddToBooking = (addon: Addon) => {
    setSelectedBookingDate(new Date())
    setBookingFormOpen(true)
  }

  // Handle booking created
  const handleBookingCreated = (booking: { id: string }) => {
    setBookingFormOpen(false)
    toast({
      title: 'Booking Confirmed!',
      description: 'Your appointment has been scheduled successfully.',
    })
  }
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [portfolioModalOpen, setPortfolioModalOpen] = useState(false);
  const [selectedPortfolioItem, setSelectedPortfolioItem] = useState<PortfolioItem | null>(null);
  // Cover photo cropping state
  const [coverCropDialogOpen, setCoverCropDialogOpen] = useState(false);
  const [selectedCoverImage, setSelectedCoverImage] = useState<string | null>(null);
  const [coverCrop, setCoverCrop] = useState({ x: 0, y: 0 });
  const [coverZoom, setCoverZoom] = useState(1);
  const [coverCroppedAreaPixels, setCoverCroppedAreaPixels] = useState<Area | null>(null);
  // Starred/featured portfolio logic
  const [featuredId, setFeaturedId] = useState<string | null>(barberProfile?.featured_portfolio || null);
  // Services state
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(false);
  // Booking state
  const [bookingFormOpen, setBookingFormOpen] = useState(false);
  const [selectedBookingDate, setSelectedBookingDate] = useState<Date>(new Date());


  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const onCoverCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCoverCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Calculate distance between two points
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };


  // Remove handleLocationFilter and clearLocationFilter functions - no longer needed

  // Fetch user profile data
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) return;

      try {
        setLoading(true);
        logger.debug('Fetching profile data for user', { userId: user.id })
        
        // Fetch profile and barber data in parallel
        const [profileResult, barberResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single(),
          supabase
            .from('barbers')
            .select('*')
            .eq('user_id', user.id)
            .single()
        ]);

        logger.debug('Profile fetch result', { hasData: !!profileResult.data, hasError: !!profileResult.error })
        logger.debug('Barber fetch result', { hasData: !!barberResult.data, hasError: !!barberResult.error })

        if (profileResult.error) {
          logger.error('Profile fetch error', profileResult.error)
        }

        if (barberResult.error) {
          logger.error('Barber fetch error', barberResult.error)
        }

        if (profileResult.data) {
          setProfile(profileResult.data);
        }

        if (barberResult.data) {
          setBarberProfile(barberResult.data);
          
          // Convert portfolio URLs to PortfolioItem format
          if (barberResult.data.portfolio) {
            const portfolioItems: PortfolioItem[] = barberResult.data.portfolio.map((url: string, index: number) => ({
              id: `item-${index}`,
              type: url.includes('.mp4') || url.includes('.mov') || url.includes('.avi') ? 'video' : 'image',
              url
            }));
            setPortfolio(portfolioItems);
          }
        } else {
          // User is not a barber - they are a client
          logger.debug('User is a client (no barber profile found)', { userId: user.id })
          setBarberProfile(null); // Explicitly set to null to ensure client interface
        }
      } catch (error) {
        logger.error('Error fetching profile data', error)
        toast({
          title: 'Error',
          description: 'Failed to load profile data.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user, toast]);

  // Socials based on real data
  const socials = [
    { icon: Instagram, href: barberProfile?.instagram, color: 'text-[#E1306C]' },
    { icon: Twitter, href: barberProfile?.twitter, color: 'text-[#1DA1F2]' },
    { icon: Facebook, href: barberProfile?.facebook, color: 'text-[#1877F3]' },
  ].filter(social => social.href); // Only show socials that have URLs

  const handleEditProfile = () => {
    setOpenDialog('profile');
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || !e.target.files[0]) return;
      const file = e.target.files[0];
      
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select an image file.',
          variant: 'destructive',
        });
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please select an image smaller than 5MB.',
          variant: 'destructive',
        });
        return;
      }
      
      setSelectedImage(URL.createObjectURL(file));
      setCropDialogOpen(true);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load image.', variant: 'destructive' });
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || !e.target.files[0]) return;
      const file = e.target.files[0];
      
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select an image file.',
          variant: 'destructive',
        });
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please select an image smaller than 5MB.',
          variant: 'destructive',
        });
        return;
      }
      
      // Open cropping dialog instead of uploading directly
      setSelectedCoverImage(URL.createObjectURL(file));
      setCoverCropDialogOpen(true);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load image.', variant: 'destructive' });
    }
  };

  const handleCoverCropSave = async () => {
    if (!selectedCoverImage || !coverCroppedAreaPixels) return;
    setLoading(true);
    try {
      const croppedBlob = await getCroppedImg(selectedCoverImage, coverCroppedAreaPixels);
      const fileExt = 'jpeg';
      const fileName = `${user?.id}/cover/${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('portfolio').upload(fileName, croppedBlob, { contentType: 'image/jpeg' });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(fileName);
      const { error: updateError } = await supabase.from('profiles').update({ coverphoto: publicUrl }).eq('id', user?.id);
      if (updateError) throw updateError;
      setProfile(prev => prev ? { ...prev, coverphoto: publicUrl } : null);
      toast({ title: 'Success', description: 'Cover photo updated successfully!' });
      setCoverCropDialogOpen(false);
      setSelectedCoverImage(null);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to upload cropped cover image.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handlePortfolioUpload = async (file: File) => {
    try {
      if (!barberProfile) return;
      
      setLoading(true);
      
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/portfolio/${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from('portfolio')
        .upload(fileName, file);

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('portfolio')
        .getPublicUrl(fileName);

      // Add to portfolio array
      const newPortfolioItem: PortfolioItem = {
        id: `item-${Date.now()}`,
        type: file.type.startsWith('video/') ? 'video' : 'image',
        url: publicUrl,
        title: file.name.replace(/\.[^/.]+$/, ''),
        likes: 0,
        comments: 0
      };

      setPortfolio(prev => [newPortfolioItem, ...prev]);
      
      // Update barber profile
      const updatedPortfolio = [publicUrl, ...(barberProfile.portfolio || [])];
      const { error: updateError } = await supabase
        .from('barbers')
        .update({ portfolio: updatedPortfolio })
        .eq('id', barberProfile.id);

      if (updateError) throw updateError;

      toast({
        title: 'Success',
        description: 'Portfolio item uploaded successfully!',
      });
    } catch (error) {
      logger.error('Error uploading portfolio item', error)
      toast({
        title: 'Error',
        description: 'Failed to upload portfolio item. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCropSave = async () => {
    if (!selectedImage || !croppedAreaPixels) return;
      setAvatarLoading(true);
    try {
      const croppedBlob = await getCroppedImg(selectedImage, croppedAreaPixels);
      const fileExt = 'jpeg';
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('avatars').upload(fileName, croppedBlob, { contentType: 'image/jpeg' });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user?.id);
      if (updateError) throw updateError;
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      toast({ title: 'Success', description: 'Profile picture updated successfully!' });
      setCropDialogOpen(false);
      setSelectedImage(null);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to upload cropped image.', variant: 'destructive' });
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleProfileUpdate = async (updatedData: Partial<UserProfile>) => {
    try {
      // Update profile data
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: updatedData.name,
          bio: updatedData.bio,
          location: updatedData.location,
          phone: updatedData.phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id);

      if (profileError) throw profileError;

      // Update barber profile data
      if (barberProfile) {
        const { error: barberError } = await supabase
          .from('barbers')
          .update({
            bio: updatedData.bio,
            instagram: updatedData.instagram,
            twitter: updatedData.twitter,
            facebook: updatedData.facebook,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user?.id);

        if (barberError) throw barberError;
      }

      // Refresh profile data
      const [profileResult, barberResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user?.id)
          .single(),
        supabase
          .from('barbers')
          .select('*')
          .eq('user_id', user?.id)
          .single()
      ]);

      if (profileResult.data) setProfile(profileResult.data);
      if (barberResult.data) setBarberProfile(barberResult.data);

      toast({
        title: 'Success',
        description: 'Profile updated successfully!',
      });
    } catch (error) {
      logger.error('Error updating profile', error)
      toast({
        title: 'Error',
        description: 'Failed to update profile.',
        variant: 'destructive',
      });
    }
  };

  // Starred/featured portfolio logic
  const handleStarPortfolio = async (item: PortfolioItem) => {
    if (!barberProfile) return;
    setFeaturedId(item.id);
    // Update backend
    await supabase.from('barbers').update({ featured_portfolio: item.id }).eq('id', barberProfile.id);
  };
  // Delete portfolio item
  const handleDeletePortfolio = async (item: PortfolioItem) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    // Remove from state
    setPortfolio(prev => prev.filter(i => i.id !== item.id));
    // Remove from backend
    if (barberProfile) {
      const newUrls = portfolio.filter(i => i.id !== item.id).map(i => i.url);
      await supabase.from('barbers').update({ portfolio: newUrls }).eq('id', barberProfile.id);
      // If deleted item was featured, clear featured_portfolio
      if (featuredId === item.id) {
        setFeaturedId(null);
        await supabase.from('barbers').update({ featured_portfolio: null }).eq('id', barberProfile.id);
      }
    }
    setPortfolioModalOpen(false);
  };

  const isOwner = true; // Always true for now, since this is the user's own profile

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-xl font-bebas font-bold animate-pulse text-foreground">Loading profile...</div>
      </div>
    );
  }

  // Main layout and header (new design)
  return (
    <div className="min-h-screen bg-transparent pb-[140px] md:pb-0 px-4 sm:px-6 pt-6 selection:bg-secondary/30">
      {/* 1:1 Client-Aligned Header Section */}
      <div className="relative w-full max-w-5xl mx-auto mb-20 border border-white/5 shadow-2xl">
        {/* Cover Photo */}
        <div className="h-48 sm:h-72 w-full bg-gradient-to-br from-secondary/20 via-background to-secondary/10 flex items-end justify-center relative group rounded-3xl overflow-hidden">
          {profile?.coverphoto ? (
            <img
              src={profile.coverphoto}
              alt="Cover"
              className="absolute inset-0 w-full h-full object-cover object-center z-0 transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 w-full h-full bg-secondary/5 z-0" />
          )}
          
          {/* Glass overlay with intensified bottom fade */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent z-10" />
          <div className="absolute inset-0 backdrop-blur-[2px] z-5" />

          {/* Camera button for cover photo - Aligned */}
          {isOwner && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-4 right-4 z-30 h-10 w-10 rounded-full bg-black/20 backdrop-blur-md text-white/80 hover:bg-black/40 hover:text-white transition-all border border-white/10"
              onClick={() => document.getElementById('cover-upload')?.click()}
            >
              <Camera className="h-5 w-5" />
            </Button>
          )}

        </div>

        {/* Avatar - High End Aligned Presentation */}
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 z-30">
          <div className="relative group/avatar">
            <div className="absolute inset-0 bg-secondary/30 rounded-full blur-xl scale-90 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-500" />
            <Avatar className="w-32 h-32 sm:w-40 sm:h-40 border-8 border-background shadow-2xl bg-muted relative z-10">
              <AvatarImage src={profile?.avatar_url || ''} alt={profile?.name || 'Avatar'} className="object-cover" />
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-6xl uppercase">
                {profile?.name?.charAt(0) || 'B'}
              </AvatarFallback>
            </Avatar>
            
            {isOwner && (
              <Button
                size="icon"
                className="absolute bottom-2 right-2 h-10 w-10 rounded-full bg-secondary text-[#1A1A1A] hover:bg-secondary/90 shadow-lg border-4 border-background z-20 group-hover/avatar:scale-110 transition-transform"
                onClick={() => avatarFileInputRef.current?.click()}
                disabled={avatarLoading}
              >
                {avatarLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarUpload}
        disabled={avatarLoading}
      />
      <input
        id="cover-upload"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverUpload}
      />

      {/* Name, Username, Stats */}
      {/* Profile Info Details (Modernized) */}
      {/* Name, Username, Location - Aligned Info Section */}
      <div className="pt-24 pb-8 flex flex-col items-center relative z-20 max-w-5xl mx-auto">
        <h1 className="text-4xl sm:text-6xl font-bebas font-bold text-foreground tracking-tight mb-2 uppercase">
          {barberProfile?.business_name || profile?.name || 'Your Craft'}
        </h1>
        <div className="flex flex-wrap justify-center items-center gap-3">
          <div className="text-secondary font-mono text-sm sm:text-base border border-secondary/20 bg-secondary/5 px-3 py-1 rounded-full">
            @{profile?.username || profile?.name?.toLowerCase().replace(/\s+/g, '') || 'username'}
          </div>
          {barberProfile?.specialties && barberProfile.specialties.slice(0, 2).map((s, i) => (
            <Badge key={i} variant="outline" className="border-white/10 text-muted-foreground uppercase font-bold tracking-widest text-[10px] h-8 px-4 rounded-full">
              {s}
            </Badge>
          ))}
        </div>
        {profile?.location && (
          <div className="flex items-center gap-2 text-muted-foreground font-medium mt-4">
            <MapPin className="h-4 w-4 text-secondary/60" />
            <span>
              {(() => {
                const parts = profile.location.split(',').map(s => s.trim());
                if (parts.length >= 4) return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
                if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
                return profile.location;
              })()}
            </span>
          </div>
        )}
      </div>

      {/* Aligned Stats Row - 1:1 with Client Portfolio */}
      <div className="w-full max-w-4xl mx-auto grid grid-cols-3 gap-4 sm:gap-8 mb-12 mt-12">
        <div className="bg-white/5 border border-white/10 backdrop-blur-2xl rounded-2xl p-4 sm:p-6 text-center group hover:border-secondary/30 transition-all duration-300 shadow-xl">
          <span className="block text-3xl sm:text-4xl font-bebas text-secondary group-hover:scale-110 transition-transform duration-300">
            {portfolio.length}
          </span>
          <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground/60 mt-1 font-bold">Gallery</span>
        </div>
        <div className="bg-white/5 border border-white/10 backdrop-blur-2xl rounded-2xl p-4 sm:p-6 text-center group hover:border-secondary/30 transition-all duration-300 shadow-xl">
          <span className="block text-3xl sm:text-4xl font-bebas text-secondary group-hover:scale-110 transition-transform duration-300">
            {barberProfile?.reviews?.length || 0}
          </span>
          <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground/60 mt-1 font-bold">Reviews</span>
        </div>
      </div>




      {/* Aligned Tabs Section - 1:1 with Client Profile */}
      <div className="w-full max-w-5xl mx-auto mb-16 px-4">
        <Tabs defaultValue="portfolio" className="w-full">
          <div className="flex justify-center mb-10">
            <TabsList className="inline-flex h-14 items-center justify-center rounded-2xl bg-white/5 border border-white/10 p-1.5 backdrop-blur-2xl shadow-2xl">
              <TabsTrigger 
                value="portfolio" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-xl px-8 py-3 text-sm font-bold tracking-widest transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:shadow-lg text-muted-foreground hover:text-foreground gap-2 uppercase"
              >
                <ImageIcon className="h-4 w-4" />
                Gallery
              </TabsTrigger>
              <TabsTrigger 
                value="services" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-xl px-8 py-3 text-sm font-bold tracking-widest transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:shadow-lg text-muted-foreground hover:text-foreground gap-2 uppercase"
              >
                <Star className="h-4 w-4" />
                Services
              </TabsTrigger>
              <TabsTrigger 
                value="reviews" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-xl px-8 py-3 text-sm font-bold tracking-widest transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:shadow-lg text-muted-foreground hover:text-foreground gap-2 uppercase"
              >
                <MessageCircle className="h-4 w-4" />
                Reviews
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Portfolio Tab */}
          <TabsContent value="portfolio">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-foreground font-bebas font-bold text-xl">Portfolio ({portfolio.length})</h3>
              {isOwner && (
                <Button
                  onClick={() => setOpenDialog('portfolio-upload')}
                  size="sm"
                  className="bg-secondary text-primary-foreground hover:bg-secondary/90"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Add to Portfolio
                </Button>
              )}
            </div>
            
            {portfolio.length === 0 ? (
              <div className="text-center py-20">
                <div className="bg-white/5 border border-white/10 rounded-[40px] p-12 max-w-md mx-auto backdrop-blur-3xl shadow-2xl">
                  <div className="w-20 h-20 bg-secondary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <ImageIcon className="h-10 w-10 text-secondary" />
                  </div>
                  <h3 className="text-foreground font-bebas font-bold text-3xl mb-3">Your Gallery is Empty</h3>
                  <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
                    Start building your professional aesthetic by adding your best photos and videos.
                  </p>
                  {isOwner && (
                    <Button
                      onClick={() => setOpenDialog('portfolio-upload')}
                      className="bg-secondary text-[#1A1A1A] font-bold h-12 px-8 rounded-full hover:scale-105 active:scale-95 transition-all"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Item
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {portfolio.map((item) => (
                  <div 
                    key={item.id} 
                    className="relative aspect-square bg-slate-900 rounded-[32px] overflow-hidden group cursor-pointer border border-white/5 hover:border-secondary/30 transition-all duration-500 shadow-xl"
                    onClick={() => {
                      setSelectedMedia({
                        type: item.type,
                        url: item.url,
                        title: item.title || 'Portfolio Item',
                        id: item.id
                      });
                      setOpenDialog('video');
                    }}
                  >
                    {item.type === 'image' ? (
                      <img src={item.url} alt={item.title || 'Portfolio'} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    ) : (
                      <div className="relative w-full h-full">
                        <video src={item.url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" muted playsInline preload="metadata" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                          <Play className="h-10 w-10 text-white fill-white/20 backdrop-blur-sm rounded-full p-2 border border-white/20" />
                        </div>
                      </div>
                    )}
                    
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-6">
                      <p className="text-white font-bebas text-2xl mb-1 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">{item.title || 'Gallery Work'}</p>
                      <div className="flex items-center gap-4 text-white/60 text-xs translate-y-4 group-hover:translate-y-0 transition-transform duration-500 delay-100">
                        <div className="flex items-center gap-2">
                          <Heart className="h-4 w-4 text-red-500" />
                          <span>{item.likes || 0}</span>
                        </div>
                      </div>
                    </div>

                    {/* Delete button (Glassmorphism) */}
                    {isOwner && (
                      <button
                        className="absolute top-4 right-4 bg-black/40 hover:bg-red-500/80 text-white backdrop-blur-md rounded-2xl p-3 shadow-xl focus:outline-none border border-white/10 transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 hover:rotate-12 z-20"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePortfolio(item);
                        }}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-foreground font-bebas font-bold text-2xl tracking-tight">Offerings & Add-ons</h3>
              {isOwner && (
                <div className="flex gap-3">
                  <Button
                    onClick={() => setOpenDialog('addons')}
                    size="sm"
                    className="bg-white/5 border border-white/10 text-foreground hover:bg-white/10 rounded-full px-5 h-10 backdrop-blur-xl"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Add-on
                  </Button>
                  <Button
                    onClick={() => setOpenDialog('services')}
                    size="sm"
                    className="bg-secondary text-[#1A1A1A] font-bold hover:scale-105 active:scale-95 transition-all rounded-full px-6 h-10 shadow-lg shadow-secondary/20"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Service
                  </Button>
                </div>
              )}
            </div>
            
            {/* Sub-tabs for Services and Add-ons */}
            <Tabs defaultValue="services" className="w-full">
              <TabsList className="w-full h-14 flex bg-white/5 border border-white/5 p-1 rounded-2xl mb-8 backdrop-blur-xl">
                <TabsTrigger value="services" className="flex-1 rounded-xl text-xs font-bold uppercase tracking-widest data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground transition-all">
                  Services ({services.length})
                </TabsTrigger>
                <TabsTrigger value="addons" className="flex-1 rounded-xl text-xs font-bold uppercase tracking-widest data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground transition-all">
                  Add-ons ({addons.length})
                </TabsTrigger>
              </TabsList>

              {/* Services Sub-tab */}
              <TabsContent value="services">
                {servicesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-secondary mx-auto mb-4" />
                  <p className="text-foreground/60">Loading services...</p>
                    </div>
                  </div>
                ) : services.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="bg-white/5 border border-white/10 rounded-[40px] p-12 max-w-md mx-auto backdrop-blur-3xl shadow-2xl">
                      <div className="w-20 h-20 bg-secondary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <Building className="h-10 w-10 text-secondary" />
                      </div>
                      <h3 className="text-foreground font-bebas font-bold text-3xl mb-3">No Services Defined</h3>
                      <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
                        What's your specialty? Add your menu to let clients know exactly what you offer.
                      </p>
                      {isOwner && (
                        <Button
                          onClick={() => setOpenDialog('services')}
                          className="bg-secondary text-[#1A1A1A] font-bold h-12 px-8 rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg shadow-secondary/20"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add First Service
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {services.map((service) => (
                      <div key={service.id} className="group bg-white/5 border border-white/10 hover:border-secondary/30 transition-all duration-300 rounded-[32px] p-8 flex flex-col justify-between backdrop-blur-3xl shadow-xl">
                        <div className="mb-6">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bebas text-2xl text-foreground tracking-tight group-hover:text-secondary transition-colors">{service.name}</h3>
                            <div className="text-right">
                              <div className="font-bebas text-3xl text-foreground leading-none">${service.price}</div>
                            </div>
                          </div>
                          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5 mb-4">
                            <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse" />
                            <span className="text-foreground/60 text-[10px] font-bold uppercase tracking-widest">{service.duration} Session</span>
                          </div>
                          {service.description && (
                            <p className="text-foreground/50 text-sm leading-relaxed line-clamp-2 italic">“{service.description}”</p>
                          )}
                        </div>
                        <Button 
                          onClick={() => handleBookService(service)}
                          className="w-full bg-white/5 border border-white/10 text-foreground hover:bg-secondary hover:text-[#1A1A1A] hover:border-transparent font-bold h-12 rounded-2xl transition-all duration-500 group-hover:shadow-lg group-hover:shadow-secondary/10"
                        >
                          Modify Details
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Add-ons Sub-tab */}
              <TabsContent value="addons">
                {addonsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-secondary mx-auto mb-4" />
                  <p className="text-foreground/60">Loading add-ons...</p>
                    </div>
                  </div>
                ) : addons.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl p-8 max-w-md mx-auto">
                      <Plus className="h-12 w-12 text-foreground/40 mx-auto mb-4" />
                      <h3 className="text-foreground font-bebas font-bold text-xl mb-2">No add-ons yet</h3>
                      <p className="text-foreground/60 text-sm mb-6">
                        Add extra services that clients can choose from
                      </p>
                      {isOwner && (
                        <Button
                          onClick={() => setOpenDialog('addons')}
                          className="bg-secondary text-primary-foreground hover:bg-secondary/90"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add First Add-on
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {addons.map((addon) => (
                      <div key={addon.id} className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-foreground">{addon.name}</h3>
                          <div className="text-right">
                            <div className="font-bold text-foreground">${addon.price}</div>
                            <div className="text-foreground/70 text-sm">{addon.duration || 'Quick add-on'}</div>
                          </div>
                        </div>
                        {addon.description && (
                          <p className="text-foreground/80 text-sm mb-3">{addon.description}</p>
                        )}
                        <Button 
                          onClick={() => handleAddToBooking(addon)}
                          className="w-full bg-secondary text-primary-foreground hover:bg-secondary/90"
                        >
                          Add to Booking
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>


        </Tabs>
      </div>

      {/* Premium Media Viewer Modal */}
      <Dialog open={openDialog === 'video'} onOpenChange={open => {
        setOpenDialog(open ? 'video' : null);
        if (!open) setSelectedMedia(null);
      }}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 overflow-hidden bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[40px] shadow-2xl flex flex-col md:flex-row">
          <DialogTitle className="sr-only">Media Viewer</DialogTitle>
          <DialogDescription className="sr-only">Viewing {selectedMedia?.title || 'Portfolio content'}</DialogDescription>
          
          {/* Main Media Area */}
          <div className="flex-1 relative bg-black/20 flex items-center justify-center overflow-hidden">
            <button 
              onClick={() => setOpenDialog(null)}
              className="absolute top-6 left-6 z-50 bg-black/40 hover:bg-black/60 text-white backdrop-blur-xl rounded-full p-3 border border-white/10 transition-all hover:scale-110 active:scale-95"
            >
              <X className="h-6 w-6" />
            </button>

            {selectedMedia?.type === 'video' ? (
              <div className="w-full h-full flex items-center justify-center p-4 sm:p-12">
                <video 
                  src={selectedMedia.url} 
                  controls 
                  autoPlay 
                  loop
                  className="max-w-full max-h-full rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
                />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center p-4 sm:p-12">
                <img 
                  src={selectedMedia?.url} 
                  alt={selectedMedia?.title} 
                  className="max-w-full max-h-full object-contain rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
                />
              </div>
            )}
          </div>

          {/* Sidebar / Info Panel */}
          <div className="w-full md:w-[400px] bg-white/[0.02] backdrop-blur-2xl border-l border-white/5 flex flex-col p-8 lg:p-12">
            <div className="flex-1 overflow-y-auto">
              {/* Header Info */}
              <div className="mb-10">
                <Badge className="bg-secondary/20 text-secondary border-secondary/30 font-bebas tracking-widest text-[10px] mb-4">
                  {selectedMedia?.type === 'video' ? 'Video' : 'Gallery Image'}
                </Badge>
                <h2 className="text-4xl lg:text-5xl font-bebas font-bold text-foreground leading-tight tracking-tight mb-4">
                  {selectedMedia?.title || 'Unnamed Work'}
                </h2>
                <div className="flex items-center gap-3 text-muted-foreground text-sm font-medium">
                  <User className="h-4 w-4 text-secondary/60" />
                  <span>{profile?.name}</span>
                  <div className="w-1 h-1 bg-white/20 rounded-full" />
                  <Calendar className="h-4 w-4 text-secondary/60" />
                  <span>{selectedMedia?.created_at ? new Date(selectedMedia.created_at).toLocaleDateString() : 'Recent'}</span>
                </div>
              </div>

              {/* Description */}
              <div className="mb-12">
                <p className="text-foreground/80 leading-relaxed text-base lg:text-lg">
                  {selectedMedia?.description || "A showcase of technical skill and artistic vision. This work represents the standard of excellence we strive for at our shop."}
                </p>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 gap-4 mb-12">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex flex-col items-center justify-center group hover:bg-secondary/5 transition-colors">
                  <Heart className="h-6 w-6 text-red-500 mb-2 group-hover:scale-125 transition-transform" />
                  <span className="text-2xl font-bebas font-bold">{selectedMedia?.likes || 0}</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Appreciation</span>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex flex-col items-center justify-center group hover:bg-secondary/5 transition-colors">
                  <Eye className="h-6 w-6 text-secondary mb-2 group-hover:scale-125 transition-transform" />
                  <span className="text-2xl font-bebas font-bold">{selectedMedia?.views || 124}</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Visibility</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4 pt-8 border-t border-white/5">
              <Button 
                className="w-full bg-secondary text-[#1A1A1A] font-bold h-14 rounded-2xl shadow-[0_10px_30px_rgba(var(--secondary),0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                onClick={() => {
                  toast({
                    title: "Success",
                    description: "Portfolio link copied to clipboard!"
                  });
                }}
              >
                <Share2 className="h-5 w-5 mr-3" />
                Share Talent
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Portfolio Editor Modal */}
      <PortfolioEditor
        initialItems={portfolio}
        open={openDialog === 'portfolio'}
        onClose={() => {
          setOpenDialog(null);
          if (editPortfolioButtonRef.current) editPortfolioButtonRef.current.focus();
        }}
        onSave={async (items) => {
          setPortfolio(items);
          // Refresh profile data to get updated portfolio
          if (user) {
            try {
              const { data: barberResult } = await supabase
                .from('barbers')
                .select('portfolio')
                .eq('user_id', user.id)
                .single();
              if (barberResult?.portfolio) {
                const portfolioItems: PortfolioItem[] = barberResult.portfolio.map((url: string, index: number) => ({
                  id: `item-${index}`,
                  type: url.includes('.mp4') || url.includes('.mov') || url.includes('.avi') ? 'video' : 'image',
                  url
                }));
                setPortfolio(portfolioItems);
              }
            } catch (error) {
              logger.error('Error refreshing portfolio', error)
            }
          }
        }}
      />
      {/* Profile Editor Modal */}
      <ProfileEditorModal
        open={openDialog === 'profile'}
        onClose={() => {
          setOpenDialog(null);
          if (editProfileButtonRef.current) editProfileButtonRef.current.focus();
        }}
        onProfileUpdated={async () => {
          // Refresh profile data after save
          if (user) {
            try {
              setLoading(true);
              const [profileResult, barberResult] = await Promise.all([
                supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', user.id)
                  .single(),
                supabase
                  .from('barbers')
                  .select('*')
                  .eq('user_id', user.id)
                  .single()
              ]);
              if (profileResult.data) setProfile(profileResult.data);
              if (barberResult.data) setBarberProfile(barberResult.data);
            } catch (error) {
              logger.error('Error refreshing profile', error)
            } finally {
              setLoading(false);
            }
          }
        }}
      />
      {/* Cropping Dialog */}
      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="max-w-[400px] bg-darkpurple/95 border border-white/10">
          <DialogHeader>
            <DialogTitle className="text-lg font-bebas text-white">Crop Profile Photo</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="relative w-full h-64 bg-white/5 rounded-xl overflow-hidden">
              <Cropper
                image={selectedImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <Button onClick={() => setCropDialogOpen(false)} variant="outline" className="flex-1">Cancel</Button>
            <Button onClick={handleCropSave} className="flex-1 bg-secondary text-white font-bold">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Cover Photo Cropping Dialog */}
      <Dialog open={coverCropDialogOpen} onOpenChange={setCoverCropDialogOpen}>
        <DialogContent className="max-w-[600px] bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">Crop Cover Photo</DialogTitle>
            <DialogDescription className="text-white/80">
              Adjust your cover photo to fit the banner (16:9 ratio)
            </DialogDescription>
          </DialogHeader>
          {selectedCoverImage && (
            <div className="relative w-full h-80 bg-white/5 rounded-xl overflow-hidden">
              <Cropper
                image={selectedCoverImage}
                crop={coverCrop}
                zoom={coverZoom}
                aspect={16/9}
                onCropChange={setCoverCrop}
                onZoomChange={setCoverZoom}
                onCropComplete={onCoverCropComplete}
              />
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <Button onClick={() => setCoverCropDialogOpen(false)} variant="outline" className="flex-1 border-white/20 text-white hover:bg-white/10">Cancel</Button>
            <Button onClick={handleCoverCropSave} className="flex-1 bg-secondary text-primary-foreground font-bold">Save Cover</Button>
          </div>
        </DialogContent>
      </Dialog>
      


      {/* Services Dialog */}
      <Dialog open={openDialog === 'services'} onOpenChange={open => {
        setOpenDialog(open ? 'services' : null);
      }}>
        <DialogContent className="max-w-md w-full bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Add Service</DialogTitle>
            <DialogDescription className="text-white/80">
              Add a new service to your offerings
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label htmlFor="service-name" className="text-white font-medium mb-2 block">
                Service Name
              </Label>
              <Input
                id="service-name"
                placeholder="e.g., Haircut, Beard Trim"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <Label htmlFor="service-price" className="text-white font-medium mb-2 block">
                Price ($)
              </Label>
              <Input
                id="service-price"
                type="number"
                placeholder="25"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <Label htmlFor="service-duration" className="text-white font-medium mb-2 block">
                Duration
              </Label>
              <Input
                id="service-duration"
                placeholder="30 minutes"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <Label htmlFor="service-description" className="text-white font-medium mb-2 block">
                Description (Optional)
              </Label>
              <Textarea
                id="service-description"
                placeholder="Describe what's included in this service..."
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                rows={3}
                style={{ whiteSpace: 'pre-wrap' }}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => setOpenDialog(null)}
                variant="outline"
                className="flex-1 border-white/20 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  // TODO: Implement service creation
                  toast({
                    title: 'Coming Soon',
                    description: 'Service creation will be available soon!',
                  })
                  setOpenDialog(null)
                }}
                className="flex-1 bg-secondary text-primary-foreground hover:bg-secondary/90"
              >
                Add Service
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add-ons Dialog */}
      <Dialog open={openDialog === 'addons'} onOpenChange={open => {
        setOpenDialog(open ? 'addons' : null);
      }}>
        <DialogContent className="max-w-md w-full bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Add Add-on</DialogTitle>
            <DialogDescription className="text-white/80">
              Add an extra service that clients can choose from
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label htmlFor="addon-name" className="text-white font-medium mb-2 block">
                Add-on Name
              </Label>
              <Input
                id="addon-name"
                placeholder="e.g., Beard Oil, Hair Styling"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <Label htmlFor="addon-price" className="text-white font-medium mb-2 block">
                Price ($)
              </Label>
              <Input
                id="addon-price"
                type="number"
                placeholder="5"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <Label htmlFor="addon-duration" className="text-white font-medium mb-2 block">
                Duration (Optional)
              </Label>
              <Input
                id="addon-duration"
                placeholder="5 minutes"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <Label htmlFor="addon-description" className="text-white font-medium mb-2 block">
                Description (Optional)
              </Label>
              <Textarea
                id="addon-description"
                placeholder="Describe what's included in this add-on..."
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                rows={3}
                style={{ whiteSpace: 'pre-wrap' }}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => setOpenDialog(null)}
                variant="outline"
                className="flex-1 border-white/20 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  // TODO: Implement addon creation
                  toast({
                    title: 'Coming Soon',
                    description: 'Add-on creation will be available soon!',
                  })
                  setOpenDialog(null)
                }}
                className="flex-1 bg-secondary text-primary-foreground hover:bg-secondary/90"
              >
                Add Add-on
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Portfolio Upload Dialog */}
      <Dialog open={openDialog === 'portfolio-upload'} onOpenChange={open => {
        setOpenDialog(open ? 'portfolio-upload' : null);
      }}>
        <DialogContent className="max-w-md w-full bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Add to Portfolio</DialogTitle>
            <DialogDescription className="text-white/80">
              Upload photos or videos to your portfolio
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label htmlFor="portfolio-upload" className="text-white font-medium mb-2 block">
                Select File
              </Label>
              <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-secondary/50 transition-colors">
                <input
                  id="portfolio-upload"
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handlePortfolioUpload(file);
                      setOpenDialog(null);
                    }
                  }}
                  className="hidden"
                />
                <Button
                  onClick={() => document.getElementById('portfolio-upload')?.click()}
                  className="bg-secondary text-primary-foreground font-bold rounded-xl px-8 py-3 mb-4"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </Button>
                <p className="text-white/60 text-sm">
                  Images or videos up to 270MB
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Existing Booking Form */}
      {barberProfile && (
        <BookingForm
          isOpen={bookingFormOpen}
          onClose={() => setBookingFormOpen(false)}
          selectedDate={selectedBookingDate}
          barberId={barberProfile.id}
          onBookingCreated={handleBookingCreated}
        />
      )}
      
      {/* Indeterminate Progress Bar for Portfolio Upload */}
      {uploading && (
        <div className="w-full mb-4">
          <Progress value={100} className="h-2 animate-pulse bg-white/10" />
          <div className="text-xs text-white/60 text-center mt-1">Uploading to portfolio...</div>
        </div>
      )}
    </div>
  );
}

function ProfileEditorModal({ open, onClose, onProfileUpdated }: { open: boolean; onClose: () => void; onProfileUpdated: () => void }) {
  const [formKey, setFormKey] = useState(0);
  
  useEffect(() => {
    if (open) {
      setFormKey(prev => prev + 1);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full p-0 overflow-y-auto max-h-[90vh]">
        <div className="p-6">
          <EnhancedBarberProfileSettings
            key={formKey}
            onSave={() => {
              onProfileUpdated();
              onClose();
            }}
            showPreview={false}
            showIntegrationGuide={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
} 