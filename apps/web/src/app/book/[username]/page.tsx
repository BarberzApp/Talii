'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api, errorMessage, hasErrorCode } from '@/shared/lib/api'
import { formatCents, type BarberProfileResponse, type PublicService } from '@barber-app/shared'
import { logger } from '@/shared/lib/logger'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Button } from '@/shared/components/ui/button'
import { BookingForm } from '@/shared/components/booking/booking-form'
import { useToast } from '@/shared/components/ui/use-toast'
import { Badge } from '@/shared/components/ui/badge'
import { Dialog, DialogContent, DialogTitle } from '@/shared/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import Link from 'next/link'
import {
  Share2,
  Star,
  MapPin, Clock,
  Calendar,
  ArrowLeft, Music,
  Eye, BookOpen, MoreHorizontal,
  Instagram, Award, Flag, Ban
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { FeeNote } from '@/shared/components/booking/fee-note'
import { ReportDialog } from '@/shared/components/safety/report-dialog'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'
import { storeRedirectUrl } from '@/shared/lib/redirect-utils'
import { bookingLink } from '@/shared/lib/app-url'

type Barber = {
  id: string
  userId: string
  name: string
  username?: string
  location?: string
  bio?: string
  avatar_url?: string
  cover_photo_url?: string
  timezone: string
  specialties: string[]
  services: PublicService[]
  portfolio: string[]
  instagram?: string
  tiktok?: string
  review_count?: number
  average_rating?: number
}

type Review = {
  id: string
  rating: number
  comment?: string
  created_at: string
  client: {
    name: string
    avatar_url?: string
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Error caught by boundary', error, { errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="mb-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold mb-2 text-foreground dark:text-white">Something went wrong</h1>
              <p className="text-muted-foreground mb-6">An unexpected error occurred. Please try again.</p>
            </div>
            
            <div className="space-y-3">
              <Button 
                onClick={() => window.location.reload()} 
                className="w-full rounded-full bg-secondary text-primary-foreground px-6 py-3"
              >
                Reload Page
              </Button>
              <Button asChild variant="outline" className="w-full rounded-full">
                <Link href="/browse">Browse Barbers</Link>
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function BookPageContent() {
  const params = useParams()
  const { toast } = useToast()
  const { user } = useAuth()
  const { push: safePush } = useSafeNavigation()
  const [barber, setBarber] = useState<Barber | null>(null)
  /** The raw GET response, handed to the booking form so it does not fetch the barber again. */
  const [profileData, setProfileData] = useState<BarberProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('services')
  const [reviews, setReviews] = useState<Review[]>([])
  const [loadingReviews, setLoadingReviews] = useState(true)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReviewId, setReportReviewId] = useState<string | null>(null)
  const [blockOpen, setBlockOpen] = useState(false)
  const [blocking, setBlocking] = useState(false)

  // Share functionality
  const handleShare = async () => {
    if (!barber) return

    const shareUrl = barber.username ? bookingLink(barber.username) : `${window.location.origin}/book/${barber.id}`
    const shareText = `Book your next haircut with ${barber.name} on Talii`

    try {
      if (navigator.share) {
        // Use native sharing on mobile devices
        await navigator.share({
          title: `Book with ${barber.name}`,
          text: shareText,
          url: shareUrl,
        })
      } else {
        // Fallback to clipboard copy
        await navigator.clipboard.writeText(shareUrl)
        toast({
          title: 'Link copied!',
          description: 'Booking link copied to clipboard.',
        })
      }
    } catch (error) {
      logger.error('Error sharing', error)
      // Fallback to clipboard copy if native sharing fails
      try {
        await navigator.clipboard.writeText(shareUrl)
        toast({
          title: 'Link copied!',
          description: 'Booking link copied to clipboard.',
        })
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to share or copy link.',
          variant: 'destructive',
        })
      }
    }
  }

  // Safely extract identifier from params (could be username or barber ID)
  const identifier = params && params.username ? (Array.isArray(params.username) ? params.username[0] : params.username) : undefined;

  useEffect(() => {
    if (identifier) {
      fetchBarberDetails()
    }
  }, [identifier])

  const fetchBarberDetails = async () => {
    if (!identifier) {
      setLoading(false)
      setError('Invalid identifier')
      return
    }

    try {
      // /book/<username> (or a barber id from older links)
      const data = UUID_RE.test(identifier)
        ? await api.barbers.get(identifier)
        : await api.barbers.getByUsername(identifier)

      const barberObject: Barber = {
        id: data.barber.id,
        userId: data.barber.user_id,
        name: data.profile.name || data.barber.business_name || 'Unknown Barber',
        username: data.profile.username,
        location: [data.barber.city, data.barber.state].filter(Boolean).join(', ') || undefined,
        bio: data.barber.bio || undefined,
        avatar_url: data.profile.avatar_url || undefined,
        cover_photo_url: data.profile.cover_photo_url || undefined,
        timezone: data.barber.timezone,
        specialties: data.barber.specialties || [],
        services: data.services,
        portfolio: data.barber.portfolio || [],
        instagram: data.barber.instagram || undefined,
        tiktok: data.barber.tiktok || undefined,
        review_count: data.rating.review_count,
        average_rating: data.rating.average_rating ?? 0,
      }

      setBarber(barberObject)
      setProfileData(data)
      // Reviews load in the background: the profile shows as soon as it arrives.
      void fetchReviews(data.barber.id)
    } catch (error) {
      setLoadingReviews(false)
      logger.error('Error fetching barber details', error)
      setError(
        hasErrorCode(error, 'BARBER_NOT_FOUND', 'VALIDATION_ERROR')
          ? 'Barber not found'
          : errorMessage(error, 'Failed to load barber details')
      )
    } finally {
      setLoading(false)
    }
  }

  const fetchReviews = async (barberId: string) => {
    try {
      setLoadingReviews(true)
      const { reviews: rows } = await api.barbers.reviews(barberId, { limit: 10 })
      setReviews(
        rows.map((review) => ({
          id: review.id,
          rating: review.rating,
          comment: review.comment || undefined,
          created_at: review.created_at,
          client: {
            name: review.reviewer_name || 'Anonymous',
            avatar_url: review.reviewer_avatar_url || undefined,
          },
        }))
      )
    } catch (err) {
      logger.error('Error fetching reviews', err)
    } finally {
      setLoadingReviews(false)
    }
  }

  /** Report and block need an account; signed-out visitors go to sign in and come back. */
  const requireSignIn = () => {
    if (user) return true
    storeRedirectUrl(window.location.pathname)
    safePush('/login')
    return false
  }

  const handleBlock = async () => {
    if (!barber) return
    setBlocking(true)
    try {
      await api.blocks.block(barber.userId)
      setBlockOpen(false)
      toast({ title: 'Blocked', description: `You will no longer see ${barber.name}, and they cannot see you. You can unblock them in Settings.` })
      safePush('/browse')
    } catch (err) {
      toast({ title: 'Could not block', description: errorMessage(err, 'Please try again.'), variant: 'destructive' })
    } finally {
      setBlocking(false)
    }
  }

  const isOwnProfile = !!user && !!barber && user.id === barber.userId

  const formatLocation = (location: string) => {
    if (!location) return '';
    const parts = location.split(',').map(s => s.trim());
    
    if (parts.length >= 4) {
      // For format: "88 Doe Court, Wynwood Drive, South Brunswick, NJ"
      const city = parts[parts.length - 2];
      const state = parts[parts.length - 1];
      return `${city}, ${state}`;
    } else if (parts.length >= 3) {
      // For format: "88 Doe Court, South Brunswick, NJ"
      const city = parts[1];
      const state = parts[2];
      return `${city}, ${state}`;
    } else if (parts.length >= 2) {
      // Fallback for shorter formats
      const city = parts[0];
      const state = parts[1];
      return `${city}, ${state}`;
    } else {
      return location;
    }
  }

  // Bad link (no username in the URL)
  if (!identifier) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md mx-auto">
          <div className="mb-6">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mb-2 text-foreground dark:text-white">Invalid Profile Link</h1>
            <p className="text-muted-foreground mb-6 text-sm sm:text-base">This profile link appears to be invalid or has expired.</p>
          </div>
          
          <div className="space-y-3">
            <Button asChild className="w-full rounded-full bg-secondary text-primary-foreground px-6 py-3 text-sm sm:text-base">
              <Link href="/browse">Browse Available Barbers</Link>
            </Button>
            <Button asChild variant="outline" className="w-full rounded-full text-sm sm:text-base">
              <Link href="/">Go to Homepage</Link>
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground mt-6">
            If you believe this is an error, please contact the barber directly.
          </p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md mx-auto">
          <div className="mb-6">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mb-2 text-foreground dark:text-white">Something went wrong</h1>
            <p className="text-muted-foreground mb-6 text-sm sm:text-base">{error}</p>
          </div>
          
          <div className="space-y-3">
            <Button 
              onClick={() => window.location.reload()} 
              className="w-full rounded-full bg-secondary text-primary-foreground px-6 py-3 text-sm sm:text-base"
            >
              Try Again
            </Button>
            <Button asChild variant="outline" className="w-full rounded-full text-sm sm:text-base">
              <Link href="/browse">Browse Barbers</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-background pb-[140px] md:pb-0" data-skeleton aria-busy="true" aria-label="Loading barber profile">
        <div className="sticky top-0 z-30 bg-black/5 dark:bg-white/5 backdrop-blur-xl border-b border-black/10 dark:border-white/10 h-[57px]" />
        <Skeleton className="h-48 md:h-64 w-full rounded-none" />
        <div className="px-4 -mt-16 flex flex-col items-center gap-3">
          <Skeleton className="h-32 w-32 rounded-full border-4 border-background" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-10 w-full max-w-xs rounded-full mt-2" />
        </div>
        <div className="px-4 mt-8 space-y-3 max-w-3xl mx-auto">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!barber) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md mx-auto">
          <div className="mb-6">
            <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mb-2 text-foreground dark:text-white">Profile Not Found</h1>
            <p className="text-muted-foreground mb-6 text-sm sm:text-base">The barber you&apos;re looking for does not exist or has been removed from the platform.</p>
          </div>
          
          <div className="space-y-3">
            <Button asChild className="w-full rounded-full bg-secondary text-primary-foreground px-6 py-3 text-sm sm:text-base">
              <Link href="/browse">Browse Available Barbers</Link>
            </Button>
            <Button asChild variant="outline" className="w-full rounded-full text-sm sm:text-base">
              <Link href="/">Go to Homepage</Link>
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground mt-6">
            The barber may have deactivated their account or changed their profile link.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background pb-[140px] md:pb-0">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-black/5 dark:bg-white/5 backdrop-blur-xl border-b border-black/10 dark:border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (window.history.length > 1 ? window.history.back() : safePush('/browse'))}
            aria-label="Back"
            className="text-foreground dark:text-white hover:bg-black/10 dark:hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <p className="text-lg font-bold text-foreground dark:text-white truncate">{barber.username ? `@${barber.username}` : barber.name}</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="More options"
                className="text-foreground dark:text-white hover:bg-black/10 dark:hover:bg-white/10"
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void handleShare()}>
                <Share2 className="h-4 w-4 mr-2" aria-hidden="true" /> Share profile
              </DropdownMenuItem>
              {!isOwnProfile && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => { if (requireSignIn()) setReportOpen(true) }}>
                    <Flag className="h-4 w-4 mr-2" aria-hidden="true" /> Report
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600 focus:text-red-700" onSelect={() => { if (requireSignIn()) setBlockOpen(true) }}>
                    <Ban className="h-4 w-4 mr-2" aria-hidden="true" /> Block
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="relative h-48 md:h-64 overflow-hidden">
        {barber.cover_photo_url ? (
          <img
            src={barber.cover_photo_url}
            alt="Cover photo"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-secondary/20 via-purple-500/20 to-secondary/20 relative">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-8 left-8 w-32 h-32 border border-white/20 rounded-full"></div>
              <div className="absolute bottom-12 right-12 w-24 h-24 border border-white/20 rounded-full"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-white/20 rounded-full"></div>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      </div>

      {/* Profile Section */}
      <div className="relative px-4 pb-4">
        {/* Avatar positioned over cover photo */}
        <div className="relative -mt-16 mb-4">
          <Avatar className="h-32 w-32 mx-auto border-4 border-background shadow-xl">
            <AvatarImage src={barber.avatar_url} alt={barber.name} className="object-cover w-full h-full" />
            <AvatarFallback className="text-4xl bg-secondary text-primary-foreground font-bold w-full h-full flex items-center justify-center">
              {barber.name && barber.name.length > 0 ? barber.name.charAt(0) : '?'}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Profile Info */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-foreground dark:text-white mb-1">{barber.name}</h1>
          {barber.username && (
            <p className="text-secondary text-lg font-mono mb-2">@{barber.username}</p>
          )}
          {barber.location && (
            <div className="flex items-center justify-center gap-1 text-muted-foreground dark:text-white/70 mb-3">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">{formatLocation(barber.location)}</span>
            </div>
          )}
          
          {/* Rating Display */}
          {barber.average_rating && barber.average_rating > 0 ? (
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${
                      i < Math.round(barber.average_rating!)
                        ? 'text-yellow-400 fill-current'
                        : 'text-muted-foreground dark:text-white/30'
                    }`}
                  />
                ))}
              </div>
              <span className="text-muted-foreground dark:text-white/90 text-base font-semibold">
                {barber.average_rating?.toFixed(1)}
              </span>
              <span className="text-muted-foreground dark:text-white/60 text-sm">
                ({barber.review_count || 0} {barber.review_count === 1 ? 'review' : 'reviews'})
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="h-5 w-5 text-muted-foreground dark:text-white/30"
                  />
                ))}
              </div>
              <span className="text-muted-foreground dark:text-white/60 text-sm">
                No reviews yet
              </span>
            </div>
          )}

          {/* Bio */}
          {barber.bio && (
            <p className="text-muted-foreground dark:text-white/80 text-sm leading-relaxed mb-4 max-w-md mx-auto">
              {barber.bio}
            </p>
          )}

          {/* Specialties */}
          {barber.specialties && barber.specialties.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {barber.specialties.map((specialty, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="bg-secondary/20 text-secondary border-secondary/30 px-3 py-1 text-xs"
                >
                  {specialty}
                </Badge>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-center mb-3">
            <Button
              onClick={() => setShowBookingForm(true)}
              disabled={barber.services.length === 0 || isOwnProfile}
              className="flex-1 max-w-xs bg-secondary text-primary-foreground font-semibold rounded-full hover:bg-secondary/90"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Book Now
            </Button>
            <Button
              onClick={handleShare}
              variant="outline"
              aria-label="Share profile"
              className="border-black/20 dark:border-white/20 text-foreground dark:text-white hover:bg-black/10 dark:hover:bg-white/10 rounded-full"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
          {isOwnProfile ? (
            <p className="text-sm text-muted-foreground mb-6">This is how clients see your page.</p>
          ) : barber.services.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-6">This barber has no services to book yet.</p>
          ) : (
            <FeeNote className="justify-center text-left max-w-md mx-auto mb-6" />
          )}

          {/* Social Links */}
          {(barber.instagram || barber.tiktok) && (
            <div className="flex justify-center gap-4 mb-6">
              {barber.instagram && (
                <a
                  href={`https://instagram.com/${barber.instagram.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${barber.name} on Instagram`}
                  className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-500 rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform"
                >
                  <Instagram className="h-5 w-5" />
                </a>
              )}
              {barber.tiktok && (
                <a
                  href={`https://www.tiktok.com/@${barber.tiktok.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${barber.name} on TikTok`}
                  className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform"
                >
                  <Music className="h-5 w-5" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-transparent border-b border-black/10 dark:border-white/10 rounded-none p-0">
            <TabsTrigger 
              value="services" 
              className="flex-1 data-[state=active]:text-secondary data-[state=active]:border-b-2 data-[state=active]:border-secondary bg-transparent text-muted-foreground dark:text-white/60 hover:text-foreground dark:text-white"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Services
            </TabsTrigger>
            <TabsTrigger 
              value="portfolio" 
              className="flex-1 data-[state=active]:text-secondary data-[state=active]:border-b-2 data-[state=active]:border-secondary bg-transparent text-muted-foreground dark:text-white/60 hover:text-foreground dark:text-white"
            >
              <Award className="h-4 w-4 mr-2" />
              Portfolio
            </TabsTrigger>
            <TabsTrigger 
              value="reviews" 
              className="flex-1 data-[state=active]:text-secondary data-[state=active]:border-b-2 data-[state=active]:border-secondary bg-transparent text-muted-foreground dark:text-white/60 hover:text-foreground dark:text-white"
            >
              <Star className="h-4 w-4 mr-2" />
              Reviews
            </TabsTrigger>
          </TabsList>


          {/* Services Tab */}
          <TabsContent value="services" className="mt-6">
            {barber.services && barber.services.length > 0 ? (
              <div className="space-y-3">
                <FeeNote compact className="px-1" />
                {barber.services.map((service) => (
                  <div
                    key={service.id}
                    className="flex justify-between items-start p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-foreground dark:text-white text-base mb-1">{service.name}</h4>
                      {service.description && (
                        <p className="text-muted-foreground dark:text-white/60 text-sm mb-2">{service.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-muted-foreground dark:text-white/60 text-sm">
                        <Clock className="h-4 w-4" />
                        <span>{service.duration_minutes} minutes</span>
                      </div>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="font-bold text-secondary text-xl">{formatCents(service.price_cents, { compact: true })}</p>
                      <p className="text-xs text-muted-foreground">in person</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground dark:text-white/40 mx-auto mb-4" />
                <p className="text-muted-foreground dark:text-white/60">No services available</p>
              </div>
            )}
          </TabsContent>

          {/* Portfolio Tab */}
          <TabsContent value="portfolio" className="mt-6">
            {barber.portfolio && barber.portfolio.length > 0 ? (
              <div className="grid grid-cols-3 gap-1">
                {barber.portfolio.map((item, index) => (
                  <button
                    type="button"
                    key={index}
                    aria-label={`View photo ${index + 1}`}
                    className="group relative aspect-square bg-black/5 dark:bg-white/5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setSelectedImage(item)}
                  >
                    <img
                      src={item}
                      alt={`Portfolio item ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Eye className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Award className="h-12 w-12 text-muted-foreground dark:text-white/40 mx-auto mb-4" />
                <p className="text-muted-foreground dark:text-white/60">No portfolio items available</p>
              </div>
            )}
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews" className="mt-6">
            {loadingReviews ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
              </div>
            ) : reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={review.client.avatar_url} alt={review.client.name} />
                        <AvatarFallback className="bg-secondary/20 text-secondary text-sm">
                          {review.client.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-foreground dark:text-white text-sm">{review.client.name}</h4>
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3 w-3 ${
                                  i < review.rating
                                    ? 'text-yellow-400 fill-current'
                                    : 'text-muted-foreground dark:text-white/30'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        {review.comment && (
                          <p className="text-muted-foreground dark:text-white/80 text-sm leading-relaxed">{review.comment}</p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-muted-foreground dark:text-white/50 text-xs">
                            {new Date(review.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          <button
                            type="button"
                            onClick={() => { if (requireSignIn()) setReportReviewId(review.id) }}
                            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                          >
                            Report
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Star className="h-12 w-12 text-muted-foreground dark:text-white/40 mx-auto mb-4" />
                <p className="text-muted-foreground dark:text-white/60">No reviews yet</p>
                <p className="text-muted-foreground dark:text-white/40 text-sm mt-2">Clients can review after a completed appointment.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Bottom spacing */}
      <div className="h-20"></div>

      {/* Image Dialog */}
      {selectedImage !== null && (
        <Dialog open={!!selectedImage} onOpenChange={open => !open && setSelectedImage(null)}>
          <DialogContent className="max-w-2xl w-full bg-background border border-border rounded-2xl shadow-2xl p-0 flex flex-col items-center justify-center [&>button]:left-4 [&>button]:right-auto">
            <DialogTitle className="sr-only">Portfolio photo</DialogTitle>
            <div className="w-full flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-secondary/20">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-secondary">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V6.75A2.25 2.25 0 015.25 4.5h13.5A2.25 2.25 0 0121 6.75v10.5A2.25 2.25 0 0118.75 19.5H5.25A2.25 2.25 0 013 17.25v-.75zm0 0l5.25-5.25a2.25 2.25 0 013.18 0l5.32 5.32M3 16.5l5.25-5.25a2.25 2.25 0 013.18 0l5.32 5.32" />
                  </svg>
                </span>
                <span className="text-foreground dark:text-white text-lg font-bold">Portfolio Image</span>
              </div>
              <button
                onClick={() => setSelectedImage(null)}
                aria-label="Close"
                className="text-foreground dark:text-white hover:text-secondary focus:outline-none focus:ring-2 focus:ring-secondary rounded-full p-1 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="w-full flex-1 flex items-center justify-center p-4">
              <img
                src={selectedImage || ''}
                alt="Portfolio item"
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-2xl shadow-lg"
                draggable={false}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showBookingForm && barber && (
        <ErrorBoundary>
          <BookingForm
            isOpen={showBookingForm}
            onClose={() => setShowBookingForm(false)}
            selectedDate={new Date()}
            barberId={barber.id}
            profile={profileData ?? undefined}
            onBookingCreated={() => setShowBookingForm(false)}
          />
        </ErrorBoundary>
      )}

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        contentType="profile"
        contentId={barber.userId}
        subject={barber.name}
      />

      <ReportDialog
        open={reportReviewId !== null}
        onOpenChange={(next) => { if (!next) setReportReviewId(null) }}
        contentType="review"
        contentId={reportReviewId ?? ''}
        subject="this review"
      />

      <AlertDialog open={blockOpen} onOpenChange={(next: boolean) => { if (!blocking) setBlockOpen(next) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block {barber.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You will not see each other on Talii, and you cannot book them while they are blocked. Bookings you already have are not cancelled. You can unblock them later in Settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={blocking}>Cancel</AlertDialogCancel>
            <Button onClick={handleBlock} disabled={blocking} className="bg-red-600 text-white hover:bg-red-700">
              {blocking ? 'Blocking...' : 'Block'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function BookPage() {
  return (
    <ErrorBoundary>
      <BookPageContent />
    </ErrorBoundary>
  )
} 