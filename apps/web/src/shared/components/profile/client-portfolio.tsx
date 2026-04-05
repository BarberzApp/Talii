"use client"

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { useData } from '@/shared/hooks/use-data'
import { useToast } from '@/shared/components/ui/use-toast'
import { logger } from '@/shared/lib/logger'
import { Button } from '@/shared/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog'
import { Progress } from '@/shared/components/ui/progress'
import { Textarea } from '@/shared/components/ui/textarea'
import { 
  Heart, 
  Users, 
  History, 
  MapPin, 
  Calendar, 
  Clock, 
  Play, 
  Camera, 
  Loader2,
  Star,
  MessageCircle,
  Share2,
  Eye,
  Edit3,
  Save,
  X
} from 'lucide-react'
import { PastStylistCard } from './PastStylistCard'
import { supabase } from '@/shared/lib/supabase'
import { cn } from '@/lib/utils'

interface UserProfile {
  id: string
  name: string
  email: string
  username?: string
  avatar_url?: string
  bio?: string
  location?: string
  phone?: string
  coverphoto?: string
}

interface Cut {
  id: string
  title: string
  description?: string
  url: string
  thumbnail?: string
  views: number
  likes: number
  shares: number
  created_at: string
  barber: {
    id: string
    name: string
    image: string
  }
}

export default function ClientPortfolio() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { bookings, loading, error } = useData()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [openDialog, setOpenDialog] = useState<null | 'video'>(null)
  const [selectedVideo, setSelectedVideo] = useState<Cut | null>(null)
  const [likedVideos, setLikedVideos] = useState<Cut[]>([])
  const [videosLoading, setVideosLoading] = useState(true)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const avatarFileInputRef = useRef<HTMLInputElement>(null)
  const coverFileInputRef = useRef<HTMLInputElement>(null)
  const [coverLoading, setCoverLoading] = useState(false)

  // Client-specific state for bookings from database
  const [clientBookings, setClientBookings] = useState<any[]>([]);
  const [userReviews, setUserReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [editingReview, setEditingReview] = useState<string | null>(null);
  const [editReviewData, setEditReviewData] = useState<{rating: number, comment: string}>({rating: 5, comment: ''});
  const [updatingReview, setUpdatingReview] = useState(false);

  // Get user's bookings from useData hook
  const userBookings = bookings.filter(b => b.clientId === user?.id)
  
  // Create past barbers from clientBookings (direct database data)
  const pastBarbers = [...new Set(clientBookings.map(b => b.barber_id))].map(barberId => {
    const booking = clientBookings.find(b => b.barber_id === barberId)
    if (booking?.barbers?.profiles) {
      return {
        id: booking.barber_id,
        name: booking.barbers.profiles.name,
        image: booking.barbers.profiles.avatar_url || undefined,
        username: booking.barbers.profiles.username || undefined
      }
    }
    return null
  }).filter(Boolean)

  // Debug logging for past barbers
  logger.debug('Past barbers calculated', { pastBarbers, count: clientBookings.length });

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return

      try {
        setProfileLoading(true)
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileError) {
          logger.error('Error fetching profile', profileError)
          return
        }

        setProfile(profileData)
      } catch (error) {
        logger.error('Error fetching profile', error)
      } finally {
        setProfileLoading(false)
      }
    }

    fetchProfile()
  }, [user])

  // Fetch client bookings from database
  useEffect(() => {
    const fetchClientBookings = async () => {
      if (!user) return;
      try {
        logger.debug('Fetching client bookings for user', { userId: user.id });
        const { data, error } = await supabase
          .from('bookings')
          .select(`*, barbers:barber_id(user_id, profiles:user_id(name, avatar_url, username)), services:service_id(name, price)`) // join barber and service info
          .eq('client_id', user.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        logger.debug('Client bookings data', { count: data?.length });
        setClientBookings(data || []);
      } catch (error) {
        logger.error('Error fetching client bookings', error);
      }
    };
    fetchClientBookings();
  }, [user]);

  // Fetch user reviews
  useEffect(() => {
    const fetchUserReviews = async () => {
      if (!user) return;
      try {
        setReviewsLoading(true);
        logger.debug('Fetching user reviews for', { userId: user.id });
        const { data, error } = await supabase
          .from('reviews')
          .select(`
            id,
            rating,
            comment,
            created_at,
            barber:barber_id(
              id,
              user_id,
              profiles:user_id(
                name,
                avatar_url,
                username
              )
            ),
            booking:booking_id(
              id,
              date,
              service:service_id(
                name
              )
            )
          `)
          .eq('client_id', user.id)
          .eq('is_public', true)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        logger.debug('User reviews data', { count: data?.length });
        setUserReviews(data || []);
      } catch (error) {
        logger.error('Error fetching user reviews', error);
      } finally {
        setReviewsLoading(false);
      }
    };
    fetchUserReviews();
  }, [user]);

  // Fetch liked videos
  useEffect(() => {
    const fetchLikedVideos = async () => {
      if (!user) return

      try {
        setVideosLoading(true)
        const { data: likedData, error: likedError } = await supabase
          .from('cut_analytics')
          .select(`
            cut_id,
            cuts (
              id,
              title,
              description,
              url,
              thumbnail,
              views,
              likes,
              shares,
              created_at,
              barber_id,
              barbers (
                id,
                user_id,
                profiles:user_id (
                name,
                  avatar_url
                )
              )
            )
          `)
          .eq('user_id', user.id)
          .eq('action_type', 'like')

        if (likedError) {
          logger.error('Error fetching liked videos', likedError)
          return
        }

        const videos: Cut[] = []
        
        // Get actual like counts for each cut
        const cutIds = likedData?.map(item => item.cut_id).filter(Boolean) || []
        let likeCounts: {[key: string]: number} = {}
        
        if (cutIds.length > 0) {
          const { data: likeCountData } = await supabase
            .from('cut_analytics')
            .select('cut_id')
            .in('cut_id', cutIds)
            .eq('action_type', 'like')
          
          // Count likes per cut
          likeCountData?.forEach(item => {
            likeCounts[item.cut_id] = (likeCounts[item.cut_id] || 0) + 1
          })
          
          logger.debug('Like counts for liked videos', { likeCounts })
        }
        
        likedData?.forEach(item => {
          const cutData = item.cuts as any
          if (cutData && cutData.barbers && cutData.barbers.profiles) {
            videos.push({
              id: cutData.id,
              title: cutData.title,
              description: cutData.description,
              url: cutData.url,
              thumbnail: cutData.thumbnail,
              views: cutData.views,
              likes: likeCounts[cutData.id] || cutData.likes || 0, // Use actual count or fallback
              shares: cutData.shares,
              created_at: cutData.created_at,
              barber: {
                id: cutData.barbers.id,
                name: cutData.barbers.profiles.name,
                image: cutData.barbers.profiles.avatar_url
              }
            })
          }
        })

        setLikedVideos(videos)
      } catch (error) {
        logger.error('Error fetching liked videos', error)
      } finally {
        setVideosLoading(false)
      }
    }

    fetchLikedVideos()
  }, [user])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    try {
      setAvatarLoading(true)
      
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file)

      if (error) throw error

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)

      if (updateError) throw updateError

      // Update local state
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null)

      toast({
        title: 'Success',
        description: 'Profile picture updated successfully!',
      })
    } catch (error) {
      logger.error('Error uploading avatar', error)
      toast({
        title: 'Error',
        description: 'Failed to update profile picture.',
        variant: 'destructive',
      })
    } finally {
      setAvatarLoading(false)
    }
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    try {
      setCoverLoading(true)
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-cover-${Date.now()}.${fileExt}`
      const { data, error } = await supabase.storage
        .from('covers')
        .upload(fileName, file)
      if (error) throw error
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('covers')
        .getPublicUrl(fileName)
      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ coverphoto: publicUrl })
        .eq('id', user.id)
      if (updateError) throw updateError
      // Update local state
      setProfile(prev => prev ? { ...prev, coverphoto: publicUrl } : null)
      toast({
        title: 'Success',
        description: 'Cover photo updated successfully!',
      })
    } catch (error) {
      logger.error('Error uploading cover photo', error)
      toast({
        title: 'Error',
        description: 'Failed to update cover photo.',
        variant: 'destructive',
      })
    } finally {
      setCoverLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  // Handle review editing
  const handleEditReview = (review: any) => {
    setEditingReview(review.id)
    setEditReviewData({
      rating: review.rating,
      comment: review.comment || ''
    })
  }

  const handleSaveReview = async (reviewId: string) => {
    if (!user || updatingReview) return

    try {
      setUpdatingReview(true)

      const { error } = await supabase
        .from('reviews')
        .update({
          rating: editReviewData.rating,
          comment: editReviewData.comment.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', reviewId)
        .eq('client_id', user.id) // Ensure user can only edit their own reviews

      if (error) throw error

      // Update local state
      setUserReviews(prev => prev.map(review => 
        review.id === reviewId 
          ? { 
              ...review, 
              rating: editReviewData.rating, 
              comment: editReviewData.comment.trim() || null,
              updated_at: new Date().toISOString()
            }
          : review
      ))

      setEditingReview(null)
      toast({
        title: "Success",
        description: "Review updated successfully!",
      })
    } catch (error) {
      logger.error('Error updating review', error)
      toast({
        title: "Error",
        description: "Failed to update review. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUpdatingReview(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingReview(null)
    setEditReviewData({rating: 5, comment: ''})
  }



  if (profileLoading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center pb-[140px] md:pb-0">
        <div className="text-center space-y-6 relative z-10">
          <div className="relative">
            <Loader2 className="h-16 w-16 animate-spin mx-auto text-secondary opacity-80" />
            <div className="absolute inset-0 rounded-full bg-secondary/15 animate-ping duration-[2000ms]" />
          </div>
          <p className="text-foreground font-bebas text-2xl tracking-[0.2em] opacity-40 animate-pulse">Loading Profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent pb-[140px] md:pb-0 px-4 sm:px-6 pt-6">
      {/* Header Section */}
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

          {/* Camera button for cover photo - Modernized */}
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-4 right-4 z-30 h-10 w-10 rounded-full bg-black/20 backdrop-blur-md text-white/80 hover:bg-black/40 hover:text-white transition-all border border-white/10"
            onClick={() => coverFileInputRef.current?.click()}
            disabled={coverLoading}
          >
            {coverLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Camera className="h-5 w-5" />
            )}
          </Button>
          <input
            ref={coverFileInputRef}
            type="file"
            accept="image/*"
            onChange={handleCoverUpload}
            className="hidden"
          />

        </div>

        {/* Avatar - High End Presentation */}
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 z-30">
          <div className="relative group/avatar">
            <div className="absolute inset-0 bg-secondary/30 rounded-full blur-xl scale-90 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-500" />
            <Avatar className="w-32 h-32 sm:w-40 sm:h-40 border-8 border-background shadow-2xl bg-muted relative z-10">
              <AvatarImage src={profile?.avatar_url} alt={profile?.name} className="object-cover" />
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-6xl uppercase">
                {profile?.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <Button
              size="icon"
              className="absolute bottom-2 right-2 h-10 w-10 rounded-full bg-secondary text-primary-foreground hover:bg-secondary/90 shadow-lg border-4 border-background z-20 group-hover/avatar:scale-110 transition-transform"
              onClick={() => avatarFileInputRef.current?.click()}
              disabled={avatarLoading}
            >
              {avatarLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Camera className="h-5 w-5" />
              )}
            </Button>
            <input
              ref={avatarFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Name, Username, Location - Spaced & Modernized */}
      <div className="pt-24 pb-8 flex flex-col items-center relative z-20 max-w-5xl mx-auto">
        <h1 className="text-4xl sm:text-6xl font-bebas font-bold text-foreground tracking-tight mb-2">
          {profile?.name}
        </h1>
        {profile?.username && (
          <div className="text-secondary font-mono text-sm sm:text-base border border-secondary/20 bg-secondary/5 px-3 py-1 rounded-full mb-4">
            @{profile.username}
          </div>
        )}
        {profile?.location && (
          <div className="flex items-center gap-2 text-muted-foreground font-medium mb-2">
            <MapPin className="h-4 w-4 text-secondary/60" />
            <span>{profile.location}</span>
          </div>
        )}
      </div>

      {/* Stats Row - Premium Visuals */}
      <div className="w-full max-w-4xl mx-auto grid grid-cols-2 gap-4 sm:gap-8 mb-12">
        <div className="bg-white/5 border border-white/10 backdrop-blur-2xl rounded-2xl p-4 sm:p-6 text-center group hover:border-secondary/30 transition-all duration-300 shadow-xl">
          <span className="block text-3xl sm:text-4xl font-bebas text-secondary group-hover:scale-110 transition-transform duration-300">
            {pastBarbers.length}
          </span>
          <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground/60 mt-1 font-bold">Stylists</span>
        </div>
        <div className="bg-white/5 border border-white/10 backdrop-blur-2xl rounded-2xl p-4 sm:p-6 text-center group hover:border-secondary/30 transition-all duration-300 shadow-xl">
          <span className="block text-3xl sm:text-4xl font-bebas text-secondary group-hover:scale-110 transition-transform duration-300">
            {clientBookings.length}
          </span>
          <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground/60 mt-1 font-bold">Bookings</span>
        </div>
      </div>
      {/* Tabs */}
      <div className="w-full max-w-5xl mx-auto mb-16">
        <Tabs defaultValue="past-barbers" className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="inline-flex h-14 items-center justify-center rounded-2xl bg-white/5 border border-white/10 p-1.5 backdrop-blur-2xl shadow-2xl">
              <TabsTrigger 
                value="past-barbers" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-xl px-8 py-3 text-sm font-bold tracking-widest transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:shadow-lg text-muted-foreground hover:text-foreground gap-2"
              >
                <Users className="h-4 w-4" />
                <span className="uppercase">Stylists</span>
              </TabsTrigger>
              <TabsTrigger 
                value="bookings" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-xl px-8 py-3 text-sm font-bold tracking-widest transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:shadow-lg text-muted-foreground hover:text-foreground gap-2"
              >
                <Star className="h-4 w-4" />
                <span className="uppercase">Reviews</span>
              </TabsTrigger>
            </TabsList>
          </div>



          <TabsContent value="past-barbers" className="mt-0 outline-none">
            {pastBarbers.length === 0 ? (
              <div className="text-center py-20 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl max-w-2xl mx-auto shadow-2xl">
                <div className="p-4 bg-secondary/10 rounded-full w-fit mx-auto mb-6">
                  <Users className="h-10 w-10 text-secondary/60" />
                </div>
                <h3 className="text-foreground font-bebas font-bold text-3xl mb-4 tracking-tight">No Connections</h3>
                <p className="text-muted-foreground text-base mb-8 max-w-sm mx-auto leading-relaxed">
                  Your past stylists will appear here. Book an appointment to start building your network.
                </p>
                <Button
                  onClick={() => window.location.href = '/browse'}
                  className="bg-secondary text-primary-foreground font-bold hover:bg-secondary/90 px-8 py-6 h-auto rounded-xl shadow-lg hover:scale-105 transition-transform"
                >
                  Find a Stylist
                </Button>
              </div>
            ) : (
              <div className="grid gap-6">
                {pastBarbers.map((barber) => (
                  <PastStylistCard
                    key={barber?.id}
                    barber={{
                      id: barber?.id || '',
                      name: barber?.name || '',
                      image: barber?.image,
                      username: barber?.username
                    }}
                    rating={4}
                    isOnline={true}
                    onBookAgain={(barberId) => {
                      if (barber?.username) {
                        window.location.href = `/book/${barber.username}`;
                      } else {
                        window.location.href = `/browse?barber=${barberId}`;
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="bookings" className="mt-0 outline-none">
            {reviewsLoading ? (
              <div className="text-center py-20">
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-secondary/60 mb-4" />
                <p className="text-muted-foreground font-bebas text-lg tracking-widest">Loading reviews...</p>
              </div>
            ) : userReviews.length === 0 ? (
              <div className="text-center py-20 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl max-w-2xl mx-auto shadow-2xl">
                <div className="p-4 bg-secondary/10 rounded-full w-fit mx-auto mb-6">
                  <Star className="h-10 w-10 text-secondary/60" />
                </div>
                <h3 className="text-foreground font-bebas font-bold text-3xl mb-4 tracking-tight">No Reviews</h3>
                <p className="text-muted-foreground text-base mb-8 max-w-sm mx-auto leading-relaxed">
                  Your feedback helps the community. Leave a review after your next appointment.
                </p>
                <Button
                  onClick={() => window.location.href = '/browse'}
                  className="bg-secondary text-primary-foreground font-bold hover:bg-secondary/90 px-8 py-6 h-auto rounded-xl shadow-lg hover:scale-105 transition-transform"
                >
                  Explore Stylists
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {userReviews.map((review) => (
                  <Card key={review.id} className="bg-white/5 border border-white/10 backdrop-blur-2xl rounded-2xl overflow-hidden hover:border-secondary/20 transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12 border border-white/10">
                          <AvatarImage 
                            src={review.barber?.profiles?.avatar_url} 
                            alt={review.barber?.profiles?.name} 
                          />
                          <AvatarFallback className="bg-secondary text-primary-foreground font-bebas text-xl">
                            {review.barber?.profiles?.name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                            <div>
                              <h4 className="font-bold text-foreground text-lg mb-0.5">
                                {review.barber?.profiles?.name}
                              </h4>
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-secondary/10 text-secondary rounded text-[10px] font-bold uppercase tracking-wider">Verified Booking</span>
                                <span className="text-xs text-muted-foreground">•</span>
                                <span className="text-xs text-muted-foreground">{formatDate(review.created_at)}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3 w-3 ${
                                    i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-white/10'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>

                          {editingReview === review.id ? (
                            <div className="mt-4 space-y-4 bg-muted/30 p-4 rounded-xl border border-white/5">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium text-muted-foreground mr-2">New Rating:</span>
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-5 w-5 cursor-pointer transition-all ${
                                      i < editReviewData.rating ? 'text-yellow-400 fill-yellow-400 scale-110' : 'text-white/20 hover:text-yellow-400/50'
                                    }`}
                                    onClick={() => setEditReviewData(prev => ({...prev, rating: i + 1}))}
                                  />
                                ))}
                              </div>
                              <Textarea
                                value={editReviewData.comment}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditReviewData(prev => ({...prev, comment: e.target.value}))}
                                className="bg-background/50 border-white/10 focus:border-secondary/50 min-h-[100px] rounded-xl"
                                placeholder="Edit your review..."
                              />
                              <div className="flex gap-2 justify-end">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={handleCancelEdit}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  Cancel
                                </Button>
                                <Button 
                                  size="sm" 
                                  className="bg-secondary text-primary-foreground hover:bg-secondary/90 shadow-lg px-6"
                                  onClick={() => handleSaveReview(review.id)}
                                  disabled={updatingReview}
                                >
                                  {updatingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="group relative">
                              <p className="text-foreground/90 text-sm leading-relaxed mb-4 italic">
                                "{review.comment || 'No comment provided.'}"
                              </p>
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-muted-foreground">
                                  Appointment: <span className="text-secondary/70 font-medium">{review.booking?.service?.name || 'General Service'}</span>
                                  {review.updated_at && review.updated_at !== review.created_at && (
                                    <span className="ml-2 text-white/30">(edited)</span>
                                  )}
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-white/5 hover:bg-secondary/10 hover:text-secondary"
                                  onClick={() => handleEditReview(review)}
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Video Dialog - Modernized */}
      <Dialog open={openDialog === 'video'} onOpenChange={open => setOpenDialog(open ? 'video' : null)}>
        <DialogContent className="max-w-4xl w-full bg-background/80 border border-white/10 backdrop-blur-[40px] rounded-3xl shadow-2xl p-0 overflow-hidden outline-none">
          {selectedVideo && (
            <div className="flex flex-col">
              <div className="relative aspect-video bg-black group/video">
                <video 
                  src={selectedVideo.url} 
                  className="w-full h-full object-contain"
                  controls
                  autoPlay
                />
              </div>
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14 border-2 border-secondary/20">
                      <AvatarImage src={selectedVideo.barber.image} alt={selectedVideo.barber.name} />
                      <AvatarFallback className="text-xl bg-secondary text-primary-foreground font-bebas">
                        {selectedVideo.barber.name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-foreground font-bebas font-bold text-3xl tracking-tight leading-none mb-1">
                        {selectedVideo.title}
                      </h3>
                      <p className="text-secondary font-medium tracking-wide">
                        {selectedVideo.barber.name}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-white/10 bg-white/5 hover:bg-secondary/10 hover:text-secondary h-10 px-4 rounded-xl gap-2"
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </Button>
                    <Button 
                      className="bg-secondary text-primary-foreground hover:bg-secondary/90 h-10 px-6 rounded-xl font-bold"
                    >
                      Book This Style
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white/5 border border-white/5 p-4 rounded-2xl text-center">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground/60 mb-1">Views</p>
                    <p className="text-xl font-bebas text-foreground">{selectedVideo.views.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/5 border border-white/5 p-4 rounded-2xl text-center">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground/60 mb-1">Likes</p>
                    <p className="text-xl font-bebas text-secondary">{selectedVideo.likes.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/5 border border-white/5 p-4 rounded-2xl text-center">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground/60 mb-1">Shares</p>
                    <p className="text-xl font-bebas text-foreground">{selectedVideo.shares.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
} 