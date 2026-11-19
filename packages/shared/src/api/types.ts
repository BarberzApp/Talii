// Request and response contracts of the Next.js API (apps/web/src/app/api).
// Each type mirrors the header comment of its route.ts; keep them in step.
// Row types come from the generated database types so column renames show up
// as type errors in both apps.
//
// Conventions: money is integer cents; instants are ISO 8601 strings;
// a barber's local times ("HH:MM[:SS]", dates "YYYY-MM-DD") are in barbers.timezone.

import type { BookingStatus, PaymentStatus } from '../constants'
import type { Tables } from '../types/database.generated'

export type { BookingStatus }
export type BookingPaymentStatus = PaymentStatus

// ---------------------------------------------------------------- shared bits

export type Pagination = { limit: number; offset: number; total: number }
export type RatingStats = { review_count: number; average_rating: number | null }

export type BookingSource = 'app' | 'manual'

export type ProfileRow = Tables<'profiles'>
export type BarberRow = Tables<'barbers'>
export type ServiceRow = Tables<'services'>
export type AddonRow = Tables<'service_addons'>
export type BookingRow = Tables<'bookings'>
export type ReviewRow = Tables<'reviews'>
export type ReportRow = Tables<'reports'>

// ---------------------------------------------------------------- account

/** The caller's own profile row (GET /api/me). */
export type OwnProfile = Pick<
  ProfileRow,
  | 'id'
  | 'role'
  | 'name'
  | 'username'
  | 'email'
  | 'phone'
  | 'avatar_url'
  | 'cover_photo_url'
  | 'is_disabled'
  | 'created_at'
  | 'updated_at'
>

export type BillingSummary = { charges_enabled: boolean; details_submitted: boolean; fee_exempt: boolean }

export type MeResponse = {
  user: { id: string; email: string | null }
  isAdmin: boolean
  profile: OwnProfile
  barber: BarberRow | null
  billing: BillingSummary | null
}

/** PATCH /api/me. null or "" clears a text field; barber fields need a barber account. */
export type UpdateMeBody = {
  name?: string | null
  username?: string
  phone?: string | null
  avatarUrl?: string | null
  coverPhotoUrl?: string | null
  businessName?: string | null
  bio?: string | null
  specialties?: string[]
  instagram?: string | null
  tiktok?: string | null
  city?: string | null
  state?: string | null
  timezone?: string
  portfolio?: string[]
  isPublic?: boolean
  onboardingComplete?: boolean
}
export type UpdateMeResponse = MeResponse & { location: { geocoded: boolean } | null }

export type DeleteMeResponse = {
  deleted: true
  cancelledBookings: string[]
  removedFiles: number
  signInBlocked: boolean
}
/** Extra fields on the 409 HAS_UPCOMING_BOOKINGS error of DELETE /api/me (see ApiError.details). */
export type DeleteMeConflict = {
  bookings: Array<{ id: string; starts_at: string; status: string; as: 'client' | 'barber' }>
  cancelledBookings: string[]
}

export type BecomeBarberBody = { businessName?: string; timezone?: string }
export type BecomeBarberResponse = { barber: BarberRow; created: boolean }

// ---------------------------------------------------------------- uploads

export type UploadBucket = 'avatars' | 'media'
export type CreateUploadBody = { bucket: UploadBucket; contentType: string; fileName: string; sizeBytes?: number }
export type UploadTicket = {
  bucket: UploadBucket
  path: string
  signedUrl: string
  token: string
  publicUrl: string
  maxBytes: number
  contentType: string
}

// ---------------------------------------------------------------- catalog and schedule (barber)

export type CreateServiceBody = {
  name: string
  description?: string | null
  durationMinutes: number
  priceCents: number
  isActive?: boolean
}
export type UpdateServiceBody = Partial<CreateServiceBody>
export type CreateAddonBody = { name: string; description?: string | null; priceCents: number; isActive?: boolean }
export type UpdateAddonBody = Partial<CreateAddonBody>
/** DELETE of a service or add-on: deactivated instead when bookings reference it. */
export type CatalogDeleteResponse = { deleted: boolean; deactivated: boolean }

export type WeeklyWindowRow = { id: string; day_of_week: number; start_time: string; end_time: string }
/** startTime/endTime "HH:MM" (endTime may be "24:00"); dayOfWeek 0 = Sunday. */
export type WeeklyWindowInput = { dayOfWeek: number; startTime: string; endTime: string }

export type SpecialHoursRow = {
  id: string
  date: string
  is_closed: boolean
  start_time: string | null
  end_time: string | null
  reason: string | null
  created_at: string
  updated_at: string
}
export type PutSpecialHoursBody =
  | { date: string; isClosed: true; reason?: string | null }
  | { date: string; isClosed: false; startTime: string; endTime: string; reason?: string | null }
export type PutSpecialHoursResponse = {
  specialHours: SpecialHoursRow
  bookingsOutsideHours: Array<{ id: string; starts_at: string; ends_at: string; status: BookingStatus }>
}

// ---------------------------------------------------------------- discovery

export type ListBarbersQuery = {
  lat?: number
  lng?: number
  radiusMiles?: number
  q?: string
  limit?: number
  offset?: number
}
export type BarberCard = {
  id: string
  user_id: string
  business_name: string | null
  bio: string | null
  specialties: string[]
  city: string | null
  state: string | null
  name: string | null
  username: string
  avatar_url: string | null
  distance_miles: number | null
  rating: RatingStats
}
export type ListBarbersResponse = {
  barbers: BarberCard[]
  pagination: { limit: number; offset: number; hasMore: boolean }
}

export type PublicService = { id: string; name: string; description: string | null; duration_minutes: number; price_cents: number }
export type PublicAddon = { id: string; name: string; description: string | null; price_cents: number }
export type BarberProfileResponse = {
  barber: {
    id: string
    user_id: string
    business_name: string | null
    bio: string | null
    specialties: string[]
    instagram: string | null
    tiktok: string | null
    city: string | null
    state: string | null
    timezone: string
    portfolio: string[]
    created_at: string
  }
  profile: { id: string; name: string | null; username: string; avatar_url: string | null; cover_photo_url: string | null }
  services: PublicService[]
  addons: PublicAddon[]
  rating: RatingStats
}

export type AvailabilitySlot = {
  startsAt: string
  endsAt: string
  /** Local "HH:MM" in the barber's time zone. */
  time: string
  available: boolean
  reason?: 'booked' | 'past'
}
export type AvailabilityResponse = {
  date: string
  timezone: string
  serviceId: string
  durationMinutes: number
  slots: AvailabilitySlot[]
}

export type PublicReview = {
  id: string
  barber_id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer_name: string | null
  reviewer_avatar_url: string | null
}
export type BarberReviewsResponse = { reviews: PublicReview[]; rating: RatingStats; pagination: Pagination }

// ---------------------------------------------------------------- bookings

export type ListBookingsQuery = {
  as?: 'client' | 'barber'
  status?: BookingStatus[]
  from?: string
  to?: string
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

/** A booking as GET /api/bookings returns it. Profiles never carry email or phone. */
export type BookingListItem = Pick<
  BookingRow,
  | 'id'
  | 'barber_id'
  | 'client_id'
  | 'customer_name'
  | 'service_id'
  | 'starts_at'
  | 'ends_at'
  | 'hold_expires_at'
  | 'service_price_cents'
  | 'addon_total_cents'
  | 'booking_fee_cents'
  | 'notes'
  | 'cancelled_at'
  | 'cancellation_reason'
  | 'created_at'
  | 'updated_at'
> & {
  source: BookingSource
  status: BookingStatus
  payment_status: BookingPaymentStatus
  service: { id: string; name: string; duration_minutes: number } | null
  addons: Array<{ addon_id: string; name: string; price_cents: number }>
  barber: {
    id: string
    business_name: string | null
    timezone: string
    city: string | null
    state: string | null
    profile: { name: string | null; username: string; avatar_url: string | null } | null
  } | null
  client: { name: string | null; username: string; avatar_url: string | null } | null
}
export type ListBookingsResponse = { bookings: BookingListItem[]; pagination: Pagination }

export type CreateBookingBody = {
  barberId: string
  serviceId: string
  /** The slot's startsAt from GET /api/barbers/:id/availability. */
  startsAt: string
  addonIds?: string[]
  notes?: string
}
export type CreateBookingResponse = {
  booking: BookingRow
  /** null when the barber is fee-exempt: the booking is already confirmed. */
  clientSecret: string | null
}

export type BookingAction = { action: 'cancel'; reason?: string } | { action: 'complete' } | { action: 'no_show' }
export type BookingActionResponse = {
  booking: BookingRow
  refund: { id: string; amountCents: number; status: string } | null
}

export type CreateManualBookingBody = { serviceId: string; startsAt: string; customerName: string; notes?: string }

// ---------------------------------------------------------------- payments

export type ConnectLinkResponse = { url: string; type: 'dashboard' | 'onboarding' }
export type ConnectStatusResponse = {
  hasAccount: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  feeExempt: boolean
}

export type EarningsQuery = { from?: string; to?: string; limit?: number; offset?: number }
export type EarningsResponse = {
  from: string
  to: string
  currency: string
  totals: {
    feeShareEarnedCents: number
    feeShareReversedCents: number
    netFeeShareCents: number
    refundedToClientsCents: number
    completedBookings: number
    noShowBookings: number
    cancelledBookings: number
    upcomingBookings: number
    serviceRevenueCents: number
  }
  bookings: Array<{
    id: string
    startsAt: string
    status: BookingStatus
    source: BookingSource
    paymentStatus: BookingPaymentStatus
    customerName: string | null
    serviceName: string | null
    servicePriceCents: number
    addonTotalCents: number
    feeShareCents: number
  }>
  pagination: Pagination
  truncated: boolean
}

// ---------------------------------------------------------------- reviews and safety

export type OwnReview = Pick<
  ReviewRow,
  'id' | 'booking_id' | 'barber_id' | 'rating' | 'comment' | 'is_hidden' | 'created_at' | 'updated_at'
>
export type CreateReviewBody = { bookingId: string; rating: number; comment?: string | null }
export type UpdateReviewBody = { rating?: number; comment?: string | null }

export const REPORT_CONTENT_TYPES = ['user', 'profile', 'review', 'image'] as const
export const REPORT_REASONS = [
  'spam',
  'harassment',
  'hate_speech',
  'inappropriate_content',
  'fraud',
  'fake_profile',
  'violence',
  'sexual_content',
  'other',
] as const
export const REPORT_STATUSES = ['pending', 'reviewed', 'resolved', 'dismissed'] as const
export type ApiReportContentType = (typeof REPORT_CONTENT_TYPES)[number]
export type ApiReportReason = (typeof REPORT_REASONS)[number]
export type ApiReportStatus = (typeof REPORT_STATUSES)[number]

export type CreateReportBody = {
  contentType: ApiReportContentType
  /** User id, review id or image URL. */
  contentId: string
  reason: ApiReportReason
  details?: string
}
/** What a reporter sees (never reported_user_id). */
export type OwnReport = Pick<
  ReportRow,
  'id' | 'content_type' | 'content_id' | 'reason' | 'details' | 'status' | 'created_at' | 'updated_at'
>

export type BlockEntry = {
  userId: string
  createdAt: string
  name: string | null
  username: string | null
  avatarUrl: string | null
}

// ---------------------------------------------------------------- public utilities

/** Nominatim-compatible geocoding result (lat/lon are strings). */
export type GeocodeResult = {
  place_id: string
  display_name: string
  lat: string
  lon: string
  address: Record<string, string>
}
export type ReverseGeocodeResult = { name: string; city?: string; state?: string; country?: string }

export type SupportCategory = 'booking' | 'payment' | 'account' | 'technical' | 'general' | 'feedback'
export type SupportBody = { name: string; email: string; category: SupportCategory; subject: string; message: string }

// ---------------------------------------------------------------- admin

export type AdminUser = {
  id: string
  name: string | null
  username: string
  email: string | null
  phone: string | null
  role: 'client' | 'barber'
  is_disabled: boolean
  deleted_at: string | null
  avatar_url: string | null
  created_at: string
  barber: {
    id: string
    business_name: string | null
    is_public: boolean
    listing_suspended: boolean
    listed: boolean
    onboarding_complete: boolean
  } | null
  billing: BillingSummary | null
}
export type AdminUsersQuery = { q?: string; role?: 'client' | 'barber'; disabled?: boolean; limit?: number; offset?: number }
export type AdminUpdateUserBody = {
  isDisabled?: boolean
  role?: 'client' | 'barber'
  listingSuspended?: boolean
  feeExempt?: boolean
}
export type AdminUpdateUserResponse = { user: AdminUser; releasedHolds: number; signInBlocked: boolean | null }

export type AdminStats = {
  users_total: number
  clients_total: number
  barbers_total: number
  disabled_total: number
  users_new_since: number
  barbers_listed: number
  barbers_charges_enabled: number
  barbers_fee_exempt: number
  bookings_total: number
  bookings_pending: number
  bookings_confirmed: number
  bookings_upcoming: number
  bookings_completed: number
  bookings_cancelled: number
  bookings_no_show: number
  bookings_new_since: number
  fees_charged_cents: number
  platform_fees_cents: number
  refunded_cents: number
  platform_fees_refunded_cents: number
  fees_charged_since_cents: number
  platform_fees_since_cents: number
  reviews_total: number
  reviews_hidden: number
  reports_pending: number
  waitlist_total: number
}

export type AdminReport = ReportRow & { reporter_username: string | null; reported_username: string | null }
export type AdminReview = {
  id: string
  booking_id: string
  barber_id: string
  client_id: string | null
  rating: number
  comment: string | null
  is_hidden: boolean
  created_at: string
  updated_at: string
  reviewer_username: string | null
  barber_business_name: string | null
}
