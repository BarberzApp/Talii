import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Upload, Plus, Loader2, MapPin, Camera, Star, Trash2, MessageCircle, Image as ImageIcon, Building, Pencil } from 'lucide-react';
import { useAuth } from '@/shared/hooks/use-auth-zustand';
import { api, errorMessage } from '@/shared/lib/api';
import { uploadImage } from '@/shared/lib/uploads';
import { formatCents, type AddonRow, type MeResponse, type PublicReview, type ServiceRow } from '@barber-app/shared';
import { useToast } from '@/shared/components/ui/use-toast';
import { EnhancedBarberProfileSettings } from './enhanced-barber-profile-settings';
import Cropper, { Area } from 'react-easy-crop';
import getCroppedImg from '@/shared/lib/crop-image';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/components/ui/tabs';
import { logger } from '@/shared/lib/logger';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  username?: string;
  avatar_url?: string;
  bio?: string;
  /** "City, ST" from the barber row. */
  location?: string;
  phone?: string;
  cover_photo_url?: string;
  instagram?: string;
  tiktok?: string;
}

// Portfolio photos (images only; video was cut).
type PortfolioItem = {
  id: string;
  url: string;
};
interface BarberProfile {
  id: string;
  user_id: string;
  bio?: string;
  business_name?: string;
  specialties?: string[];
  instagram?: string;
  tiktok?: string;
  portfolio?: string[];
  reviewCount?: number;
}

type Service = ServiceRow;
type Addon = AddonRow;

function toPortfolioItems(urls: string[] | null | undefined): PortfolioItem[] {
  return (urls ?? []).map((url, index) => ({
    id: `item-${index}`,
    url,
  }));
}

function profileFromMe(me: MeResponse): UserProfile {
  return {
    id: me.profile.id,
    name: me.profile.name || '',
    email: me.profile.email || '',
    username: me.profile.username,
    avatar_url: me.profile.avatar_url || undefined,
    phone: me.profile.phone || undefined,
    cover_photo_url: me.profile.cover_photo_url || undefined,
    bio: me.barber?.bio || undefined,
    location: [me.barber?.city, me.barber?.state].filter(Boolean).join(', ') || undefined,
    instagram: me.barber?.instagram || undefined,
    tiktok: me.barber?.tiktok || undefined,
  };
}

function barberFromMe(me: MeResponse): BarberProfile | null {
  if (!me.barber) return null;
  return {
    id: me.barber.id,
    user_id: me.barber.user_id,
    bio: me.barber.bio || undefined,
    business_name: me.barber.business_name || undefined,
    specialties: me.barber.specialties,
    instagram: me.barber.instagram || undefined,
    tiktok: me.barber.tiktok || undefined,
    portfolio: me.barber.portfolio,
  };
}

export default function ProfilePortfolio() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [barberProfile, setBarberProfile] = useState<BarberProfile | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [openDialog, setOpenDialog] = useState<null | 'profile' | 'photo' | 'portfolio-upload'>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [coverSaving, setCoverSaving] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<PortfolioItem | null>(null);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const editProfileButtonRef = useRef<HTMLButtonElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  

  // Fetch services
  const fetchServices = useCallback(async () => {
    if (!barberProfile?.id) return

    try {
      setServicesLoading(true)
      logger.debug('Fetching services for barber', { barberId: barberProfile.id })
      
      const { services: servicesData } = await api.services.list()
      setServices(servicesData)

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
      
      const { addons: addonsData } = await api.addons.list()
      setAddons(addonsData)

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

  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  // Cover photo cropping state
  const [coverCropDialogOpen, setCoverCropDialogOpen] = useState(false);
  const [selectedCoverImage, setSelectedCoverImage] = useState<string | null>(null);
  const [coverCrop, setCoverCrop] = useState({ x: 0, y: 0 });
  const [coverZoom, setCoverZoom] = useState(1);
  const [coverCroppedAreaPixels, setCoverCroppedAreaPixels] = useState<Area | null>(null);
  // Services state
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(false);


  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const onCoverCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCoverCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Fetch user profile data
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) return;

      try {
        setLoading(true);
        logger.debug('Fetching profile data for user', { userId: user.id })
        
        const me = await api.me.get();
        setProfile(profileFromMe(me));
        const barber = barberFromMe(me);
        setBarberProfile(barber);
        setPortfolio(toPortfolioItems(barber?.portfolio));
        if (barber) {
          // Public stats; 404 while the listing is hidden, which just means no count.
          api.barbers
            .reviews(barber.id, { limit: 20 })
            .then(({ rating, reviews: rows }) => {
              setReviews(rows);
              setBarberProfile(prev => prev ? { ...prev, reviewCount: rating.review_count } : prev);
            })
            .catch(() => undefined);
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
    } catch {
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
    } catch {
      toast({ title: 'Error', description: 'Failed to load image.', variant: 'destructive' });
    }
  };

  const handleCoverCropSave = async () => {
    if (!selectedCoverImage || !coverCroppedAreaPixels) return;
    setCoverSaving(true);
    try {
      const croppedBlob = await getCroppedImg(selectedCoverImage, coverCroppedAreaPixels);
      const publicUrl = await uploadImage(croppedBlob, 'media', 'cover.jpg');
      await api.me.update({ coverPhotoUrl: publicUrl });
      setProfile(prev => prev ? { ...prev, cover_photo_url: publicUrl } : null);
      toast({ title: 'Success', description: 'Cover photo updated successfully!' });
      setCoverCropDialogOpen(false);
      setSelectedCoverImage(null);
    } catch (error) {
      toast({ title: 'Error', description: errorMessage(error, 'Failed to upload cropped cover image.'), variant: 'destructive' });
    } finally {
      setCoverSaving(false);
    }
  };

  const handlePortfolioUpload = async (file: File) => {
    try {
      if (!barberProfile) return;
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Photos only', description: 'Choose a JPEG, PNG, WebP, HEIC or GIF image.', variant: 'destructive' });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: 'File too large', description: 'Choose an image smaller than 10MB.', variant: 'destructive' });
        return;
      }

      setUploading(true);

      // Images only: the media bucket accepts JPEG/PNG/WebP/HEIC/GIF up to 10MB.
      const publicUrl = await uploadImage(file, 'media');
      const updatedPortfolio = [publicUrl, ...(barberProfile.portfolio || [])];
      await api.me.update({ portfolio: updatedPortfolio });
      setBarberProfile(prev => prev ? { ...prev, portfolio: updatedPortfolio } : prev);
      setPortfolio(toPortfolioItems(updatedPortfolio));

      toast({
        title: 'Photo added',
        description: 'It now shows in your gallery.',
      });
    } catch (error) {
      logger.error('Error uploading portfolio item', error)
      toast({
        title: 'Error',
        description: errorMessage(error, 'Failed to upload the photo. Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCropSave = async () => {
    if (!selectedImage || !croppedAreaPixels) return;
      setAvatarLoading(true);
    try {
      const croppedBlob = await getCroppedImg(selectedImage, croppedAreaPixels);
      const publicUrl = await uploadImage(croppedBlob, 'avatars', 'avatar.jpg');
      await api.me.update({ avatarUrl: publicUrl });
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      toast({ title: 'Success', description: 'Profile picture updated successfully!' });
      setCropDialogOpen(false);
      setSelectedImage(null);
    } catch (error) {
      toast({ title: 'Error', description: errorMessage(error, 'Failed to upload cropped image.'), variant: 'destructive' });
    } finally {
      setAvatarLoading(false);
    }
  };

  // Delete portfolio item
  const handleDeletePortfolio = async (item: PortfolioItem) => {
    if (!barberProfile) return;
    if (!window.confirm('Remove this photo from your gallery?')) return;
    const previous = portfolio;
    const newUrls = portfolio.filter(i => i.id !== item.id).map(i => i.url);
    setPortfolio(toPortfolioItems(newUrls));
    try {
      await api.me.update({ portfolio: newUrls });
      setBarberProfile(prev => prev ? { ...prev, portfolio: newUrls } : prev);
      if (selectedMedia?.id === item.id) setOpenDialog(null);
    } catch (error) {
      setPortfolio(previous);
      toast({ title: 'Error', description: errorMessage(error, 'Failed to remove the photo.'), variant: 'destructive' });
    }
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
          {profile?.cover_photo_url ? (
            <img
              src={profile.cover_photo_url}
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
              className="absolute top-4 right-4 z-30 h-10 w-10 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 hover:text-white transition-all border border-white/10"
              onClick={() => document.getElementById('cover-upload')?.click()}
              disabled={coverSaving}
              aria-label="Change cover photo"
            >
              {coverSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
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
                aria-label="Change profile photo"
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

      <div className="flex justify-center -mt-2 mb-4 relative z-20">
        <Button
          ref={editProfileButtonRef}
          onClick={() => setOpenDialog('profile')}
          variant="outline"
          className="rounded-full px-6"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit profile
        </Button>
      </div>

      {/* Aligned Stats Row - 1:1 with Client Portfolio */}
      <div className="w-full max-w-md mx-auto grid grid-cols-2 gap-4 sm:gap-8 mb-12 mt-8">
        <div className="bg-white/5 border border-white/10 backdrop-blur-2xl rounded-2xl p-4 sm:p-6 text-center group hover:border-secondary/30 transition-all duration-300 shadow-xl">
          <span className="block text-3xl sm:text-4xl font-bebas text-secondary group-hover:scale-110 transition-transform duration-300">
            {portfolio.length}
          </span>
          <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground/60 mt-1 font-bold">Gallery</span>
        </div>
        <div className="bg-white/5 border border-white/10 backdrop-blur-2xl rounded-2xl p-4 sm:p-6 text-center group hover:border-secondary/30 transition-all duration-300 shadow-xl">
          <span className="block text-3xl sm:text-4xl font-bebas text-secondary group-hover:scale-110 transition-transform duration-300">
            {barberProfile?.reviewCount || 0}
          </span>
          <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground/60 mt-1 font-bold">Reviews</span>
        </div>
      </div>




      {/* Aligned Tabs Section - 1:1 with Client Profile */}
      <div className="w-full max-w-5xl mx-auto mb-16">
        <Tabs defaultValue="portfolio" className="w-full">
          <div className="flex justify-center mb-10">
            <TabsList className="grid grid-cols-3 w-full max-w-lg h-14 items-center rounded-2xl bg-white/5 border border-white/10 p-1.5 backdrop-blur-2xl shadow-2xl">
              <TabsTrigger 
                value="portfolio" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-xl px-2 sm:px-8 py-3 text-xs sm:text-sm font-bold tracking-wider sm:tracking-widest transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-button data-[state=active]:text-button-foreground data-[state=active]:shadow-lg text-muted-foreground hover:text-foreground gap-2 uppercase"
              >
                <ImageIcon className="h-4 w-4" />
                Gallery
              </TabsTrigger>
              <TabsTrigger 
                value="services" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-xl px-2 sm:px-8 py-3 text-xs sm:text-sm font-bold tracking-wider sm:tracking-widest transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-button data-[state=active]:text-button-foreground data-[state=active]:shadow-lg text-muted-foreground hover:text-foreground gap-2 uppercase"
              >
                <Star className="h-4 w-4" />
                Services
              </TabsTrigger>
              <TabsTrigger 
                value="reviews" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-xl px-2 sm:px-8 py-3 text-xs sm:text-sm font-bold tracking-wider sm:tracking-widest transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-button data-[state=active]:text-button-foreground data-[state=active]:shadow-lg text-muted-foreground hover:text-foreground gap-2 uppercase"
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
                  disabled={uploading}
                  className="bg-button text-button-foreground hover:bg-button/90"
                >
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  {uploading ? 'Uploading...' : 'Add photo'}
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
                    Add photos of your best cuts. Clients see them on your booking page.
                  </p>
                  {isOwner && (
                    <Button
                      onClick={() => setOpenDialog('portfolio-upload')}
                      className="bg-secondary text-[#1A1A1A] font-bold h-12 px-8 rounded-full hover:scale-105 active:scale-95 transition-all"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add your first photo
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {portfolio.map((item) => (
                  <div
                    key={item.id}
                    className="relative aspect-square bg-muted rounded-[32px] overflow-hidden group border border-border hover:border-secondary/30 transition-all duration-500 shadow-xl"
                  >
                    <button
                      type="button"
                      className="block w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => {
                        setSelectedMedia(item);
                        setOpenDialog('photo');
                      }}
                      aria-label="View photo"
                    >
                      <img src={item.url} alt="Gallery photo" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    </button>
                    {isOwner && (
                      <button
                        type="button"
                        className="absolute top-3 right-3 bg-black/50 hover:bg-red-600 text-white rounded-2xl p-2.5 shadow-xl border border-white/10 transition-all sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white z-20"
                        onClick={() => handleDeletePortfolio(item)}
                        aria-label="Remove photo"
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
            <div className="flex flex-wrap gap-3 items-center justify-between mb-6">
              <h3 className="text-foreground font-bebas font-bold text-2xl tracking-tight">Offerings & Add-ons</h3>
              {isOwner && (
                <div className="flex gap-3">
                  <Button
                    href="/settings?tab=addons"
                    size="sm"
                    variant="outline"
                    className="rounded-full px-5 h-10"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Add-ons
                  </Button>
                  <Button
                    href="/settings?tab=services"
                    size="sm"
                    className="bg-button text-button-foreground font-bold hover:bg-button/90 rounded-full px-6 h-10 shadow-lg shadow-secondary/20"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Services
                  </Button>
                </div>
              )}
            </div>
            
            {/* Sub-tabs for Services and Add-ons */}
            <Tabs defaultValue="services" className="w-full">
              <TabsList className="w-full h-14 flex bg-white/5 border border-white/5 p-1 rounded-2xl mb-8 backdrop-blur-xl">
                <TabsTrigger value="services" className="flex-1 rounded-xl text-xs font-bold uppercase tracking-widest data-[state=active]:bg-button data-[state=active]:text-button-foreground transition-all">
                  Services ({services.length})
                </TabsTrigger>
                <TabsTrigger value="addons" className="flex-1 rounded-xl text-xs font-bold uppercase tracking-widest data-[state=active]:bg-button data-[state=active]:text-button-foreground transition-all">
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
                        Clients can only book you once you have at least one active service.
                      </p>
                      {isOwner && (
                        <Button
                          href="/settings?tab=services"
                          className="bg-button text-button-foreground font-bold h-12 px-8 rounded-full hover:bg-button/90 shadow-lg shadow-secondary/20"
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
                              <div className="font-bebas text-3xl text-foreground leading-none">{formatCents(service.price_cents, { compact: true })}</div>
                            </div>
                          </div>
                          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5 mb-4">
                            <div className="w-1.5 h-1.5 bg-secondary rounded-full" />
                            <span className="text-foreground/60 text-[10px] font-bold uppercase tracking-widest">{service.duration_minutes} min Session</span>
                          </div>
                          {service.description && (
                            <p className="text-foreground/50 text-sm leading-relaxed line-clamp-2 italic">“{service.description}”</p>
                          )}
                        </div>
                        {!service.is_active && (
                          <p className="text-xs font-semibold text-muted-foreground">Hidden from clients</p>
                        )}
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
                          href="/settings?tab=addons"
                          className="bg-button text-button-foreground hover:bg-button/90"
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
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-semibold text-foreground">{addon.name}</h3>
                          <div className="font-bold text-foreground">+{formatCents(addon.price_cents)}</div>
                        </div>
                        {addon.description && (
                          <p className="text-muted-foreground text-sm mt-1">{addon.description}</p>
                        )}
                        {!addon.is_active && (
                          <p className="text-xs font-semibold text-muted-foreground mt-1">Hidden from clients</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews">
            {reviews.length === 0 ? (
              <div className="text-center py-16">
                <MessageCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
                <h3 className="text-foreground font-bebas font-bold text-2xl mb-2">No reviews yet</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  Clients can leave a review after you mark their appointment completed in your calendar.
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {reviews.map((review) => (
                  <li key={review.id} className="bg-card border border-border rounded-2xl p-5">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="font-semibold text-foreground">{review.reviewer_name || 'Talii client'}</span>
                      <span className="flex items-center gap-1 text-sm font-semibold text-foreground" aria-label={`${review.rating} out of 5 stars`}>
                        <Star className="h-4 w-4 text-secondary fill-secondary" aria-hidden="true" />
                        {review.rating}/5
                      </span>
                    </div>
                    {review.comment && <p className="text-muted-foreground text-sm">{review.comment}</p>}
                    <p className="text-xs text-muted-foreground mt-2">{new Date(review.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Photo viewer */}
      <Dialog open={openDialog === 'photo'} onOpenChange={open => {
        setOpenDialog(open ? 'photo' : null);
        if (!open) setSelectedMedia(null);
      }}>
        <DialogContent className="max-w-3xl w-[95vw] p-4 bg-background border border-border rounded-3xl">
          <DialogTitle className="sr-only">Gallery photo</DialogTitle>
          <DialogDescription className="sr-only">A photo from your gallery</DialogDescription>
          {selectedMedia && (
            <div className="space-y-4">
              <img src={selectedMedia.url} alt="Gallery photo" className="w-full max-h-[70vh] object-contain rounded-2xl" />
              {isOwner && (
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => handleDeletePortfolio(selectedMedia)} className="text-red-700 border-red-300 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remove photo
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Profile Editor Modal */}
      <ProfileEditorModal
        open={openDialog === 'profile'}
        onClose={() => {
          setOpenDialog(null);
          if (editProfileButtonRef.current) editProfileButtonRef.current.focus();
        }}
        onProfileUpdated={async () => {
          // Refresh profile data after save
          try {
            setLoading(true);
            const me = await api.me.get();
            setProfile(profileFromMe(me));
            const barber = barberFromMe(me);
            setBarberProfile(barber);
            setPortfolio(toPortfolioItems(barber?.portfolio));
          } catch (error) {
            logger.error('Error refreshing profile', error)
          } finally {
            setLoading(false);
          }
        }}
      />
      {/* Cropping Dialog */}
      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bebas text-foreground">Crop Profile Photo</DialogTitle>
            <DialogDescription>Drag and zoom to frame your photo.</DialogDescription>
          </DialogHeader>
          {selectedImage && (
            <div className="relative w-full h-64 bg-muted rounded-xl overflow-hidden">
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
            <Button onClick={handleCropSave} disabled={avatarLoading} className="flex-1 bg-button text-button-foreground font-bold">{avatarLoading ? 'Saving...' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Cover Photo Cropping Dialog */}
      <Dialog open={coverCropDialogOpen} onOpenChange={setCoverCropDialogOpen}>
        <DialogContent className="max-w-[600px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Crop Cover Photo</DialogTitle>
            <DialogDescription>
              Adjust your cover photo to fit the banner (16:9 ratio)
            </DialogDescription>
          </DialogHeader>
          {selectedCoverImage && (
            <div className="relative w-full h-64 sm:h-80 bg-muted rounded-xl overflow-hidden">
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
            <Button onClick={() => setCoverCropDialogOpen(false)} variant="outline" className="flex-1">Cancel</Button>
            <Button onClick={handleCoverCropSave} disabled={coverSaving} className="flex-1 bg-button text-button-foreground font-bold">{coverSaving ? 'Saving...' : 'Save Cover'}</Button>
          </div>
        </DialogContent>
      </Dialog>
      


      {/* Portfolio Upload Dialog */}
      <Dialog open={openDialog === 'portfolio-upload'} onOpenChange={open => {
        setOpenDialog(open ? 'portfolio-upload' : null);
      }}>
        <DialogContent className="max-w-md w-full rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-foreground">Add a photo</DialogTitle>
            <DialogDescription>
              Add a photo of your work to your gallery.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-secondary/50 transition-colors">
                <input
                  id="portfolio-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif"
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
                  className="bg-button text-button-foreground font-bold rounded-xl px-8 py-3 mb-4"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose photo
                </Button>
                <p className="text-muted-foreground text-sm">
                  JPEG, PNG, WebP, HEIC or GIF, up to 10MB
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
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
        <DialogTitle className="sr-only">Edit profile</DialogTitle>
        <DialogDescription className="sr-only">Change the details clients see on your booking page.</DialogDescription>
        <div className="p-4 sm:p-6">
          <EnhancedBarberProfileSettings
            key={formKey}
            onSave={() => {
              onProfileUpdated();
              onClose();
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
} 