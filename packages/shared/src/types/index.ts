import type { BookingStatus, PaymentStatus, UserRole } from '../constants';
export type { Database, Json } from './database';

export interface User {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole | null;
  username?: string | null;
  phone?: string | null;
  location?: string | null;
  description?: string | null;
  bio?: string | null;
  favorites: string[] | null;
  join_date: string | null;
  created_at: string | null;
  updated_at: string | null;
  avatar_url?: string | null;
  is_public?: boolean | null;
  email_notifications?: boolean | null;
  sms_notifications?: boolean | null;
  marketing_emails?: boolean | null;
  instagram_url?: string | null;
  twitter_url?: string | null;
  tiktok_url?: string | null;
  facebook_url?: string | null;
  is_disabled?: boolean | null;
  coverphoto?: string | null;
  carrier?: string | null;
  user_metadata?: {
    role?: UserRole;
    name?: string;
  };
}

// DB-aligned barber shape (mobile is currently closer to schema)
export interface Barber {
  id: string;
  user_id: string | null;
  bio?: string | null;
  specialties: string[] | null;
  price_range?: string | null;
  next_available?: string | null;
  created_at: string | null;
  updated_at: string | null;
  stripe_account_id?: string | null;
  stripe_account_status?: 'pending' | 'active' | 'deauthorized' | null;
  business_name?: string | null;
  status?: string | null;
  onboarding_complete?: boolean | null;
  stripe_account_ready?: boolean | null;
  instagram?: string | null;
  twitter?: string | null;
  tiktok?: string | null;
  facebook?: string | null;
  portfolio?: string[] | null;
  is_developer?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  state?: string | null;
  review_count?: number | null;
  average_rating?: number | null;
  user?: User;
  services?: Service[];
  availability?: Availability[];
  special_hours?: SpecialHours[];
  time_off?: TimeOff[];
  booking_restrictions?: BookingRestrictions;
  ondemand_settings?: OnDemandSettings;
}

export interface Service {
  id: string;
  barber_id: string;
  name: string;
  description?: string;
  duration: number;
  price: number;
  created_at: string;
  updated_at: string;
  barber?: Barber;
  addons?: ServiceAddon[];
}

export interface ServiceAddon {
  id: string;
  barber_id: string;
  name: string;
  description?: string;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  barber_id: string;
  client_id?: string | null;
  service_id: string;
  date: string;
  status: BookingStatus | null;
  payment_status: PaymentStatus | null;
  price: number;
  notes?: string | null;
  guest_name?: string | null;
  guest_email?: string | null;
  guest_phone?: string | null;
  created_at: string | null;
  updated_at: string | null;
  platform_fee?: number | null;
  barber_payout?: number | null;
  payment_intent_id?: string | null;
  addon_total?: number | null;
  review_requested?: boolean | null;
  review_requested_at?: string | null;
  end_time?: string | null;
  service_price?: number | null;
  barber?: Barber;
  service?: Service;
  client?: User;
  addons?: BookingAddon[];
}

export interface BookingAddon {
  id: string;
  booking_id: string;
  addon_id: string;
  price: number;
  created_at: string;
}

export interface Review {
  id: string;
  booking_id: string;
  barber_id: string;
  client_id: string;
  rating: number;
  comment?: string;
  is_verified: boolean;
  is_public: boolean;
  is_moderated: boolean;
  moderator_notes?: string;
  created_at: string;
  updated_at: string;
  client?: User;
  barber?: Barber;
  booking?: Booking;
}

export interface ReviewStats {
  total_reviews: number;
  average_rating: number;
  rating_distribution: { [key: number]: number };
  recent_reviews: Review[];
}

export interface Availability {
  id: string;
  barber_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
  barber?: Barber;
}

export interface SpecialHours {
  id: string;
  barber_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_closed: boolean;
  reason?: string;
  created_at: string;
  updated_at: string;
  barber?: Barber;
}

export interface TimeOff {
  id: string;
  barber_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
  created_at: string;
}

export interface BookingRestrictions {
  id: string;
  barber_id: string;
  min_interval_minutes: number;
  max_bookings_per_day: number;
  advance_booking_days: number;
  same_day_booking_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface OnDemandSettings {
  id: string;
  barber_id: string;
  is_enabled: boolean;
  availability_radius_miles: number;
  min_notice_minutes: number;
  max_notice_hours: number;
  surge_pricing_enabled: boolean;
  surge_multiplier: number;
  created_at: string;
  updated_at: string;
}

export interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
}

export interface DateTimeSelection {
  date: Date | null;
  timeSlot: TimeSlot | null;
}

// Notifications
export interface Notification {
  id: string;
  user_id?: string | null;
  title: string;
  message: string;
  type: string;
  booking_id?: string | null;
  read?: boolean | null;
  created_at?: string | null;
  user?: User;
  booking?: Booking;
}

// Payments (Stripe)
export interface Payment {
  id: string;
  payment_intent_id: string;
  amount: number;
  currency: string;
  status: string;
  barber_stripe_account_id: string;
  platform_fee: number;
  created_at: string;
  booking_id?: string | null;
  booking?: Booking;
}

// Scheduling / On-demand
export interface SchedulingSlot {
  id: string;
  barber_id?: string | null;
  day_of_week?: number | null;
  start_time: string;
  end_time: string;
  slot_duration_minutes?: number | null;
  buffer_minutes_before?: number | null;
  buffer_minutes_after?: number | null;
  max_bookings_per_slot?: number | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type OnDemandRequestStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'completed';

export interface OnDemandRequest {
  id: string;
  client_id?: string | null;
  barber_id?: string | null;
  service_id?: string | null;
  requested_time: string;
  location_lat?: number | null;
  location_lng?: number | null;
  location_address?: string | null;
  status?: OnDemandRequestStatus | null;
  price: number;
  surge_multiplier?: number | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// SMS booking notification state
export interface BookingTexts {
  id: string;
  client_name?: string | null;
  client_phone?: string | null;
  client_carrier?: string | null;
  barber_phone?: string | null;
  barber_carrier?: string | null;
  booking_time?: string | null;
  confirmation_sent?: boolean | null;
  reminder_sent?: boolean | null;
  barber_sms_notifications?: boolean | null;
  client_sms_notifications?: boolean | null;
}

// Cuts (reels) + analytics
export interface Cut {
  id: string;
  barber_id?: string | null;
  title: string;
  description?: string | null;
  url: string;
  thumbnail?: string | null;
  category: string;
  duration?: number | null;
  views?: number | null;
  likes?: number | null;
  shares?: number | null;
  tags?: string[] | null;
  is_featured?: boolean | null;
  is_public?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  comments_count?: number | null;
  barber?: Barber;
}

export interface CutComment {
  id: string;
  cut_id?: string | null;
  user_id?: string | null;
  comment: string;
  created_at?: string | null;
  updated_at?: string | null;
  user?: User;
  cut?: Cut;
}

export type CutAnalyticsActionType = 'view' | 'like' | 'share' | 'comment';

export interface CutAnalytics {
  id: string;
  cut_id?: string | null;
  user_id?: string | null;
  action_type?: CutAnalyticsActionType | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at?: string | null;
  user?: User;
  cut?: Cut;
}

// Calendar sync
export type CalendarProvider = 'google_calendar' | 'outlook' | 'apple_calendar';
export type CalendarSyncDirection = 'inbound' | 'outbound' | 'bidirectional';
export type CalendarSyncStatus = 'synced' | 'pending' | 'failed' | 'conflict';
export type CalendarSyncOperation =
  | 'sync_to_external'
  | 'sync_from_external'
  | 'create_event'
  | 'update_event'
  | 'delete_event';
export type CalendarSyncLogStatus = 'success' | 'failed' | 'partial';

export interface UserCalendarConnection {
  id: string;
  user_id?: string | null;
  provider: CalendarProvider;
  access_token: string;
  refresh_token?: string | null;
  expires_at?: string | null;
  calendar_id?: string | null;
  sync_enabled?: boolean | null;
  last_sync_at?: string | null;
  sync_direction?: CalendarSyncDirection | null;
  created_at?: string | null;
  updated_at?: string | null;
  user?: User;
}

export interface SyncedEvent {
  id: string;
  user_id?: string | null;
  external_event_id: string;
  external_calendar_id: string;
  booking_id?: string | null;
  event_data?: any | null;
  sync_direction?: CalendarSyncDirection | null;
  sync_status?: CalendarSyncStatus | null;
  last_synced_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  user?: User;
  booking?: Booking;
}

export interface CalendarSyncLog {
  id: string;
  user_id?: string | null;
  connection_id?: string | null;
  operation: CalendarSyncOperation;
  status: CalendarSyncLogStatus;
  details?: any | null;
  error_message?: string | null;
  created_at?: string | null;
  user?: User;
  connection?: UserCalendarConnection;
}

// Moderation / safety
export type ReportContentType = 'user' | 'review' | 'video' | 'image' | 'comment' | 'profile';
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'inappropriate_content'
  | 'fraud'
  | 'fake_profile'
  | 'violence'
  | 'sexual_content'
  | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id?: string | null;
  content_type: ReportContentType;
  content_id: string;
  reason: ReportReason;
  description?: string | null;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
}

export interface BlockedUser {
  id: string;
  user_id: string;
  blocked_user_id: string;
  created_at: string;
}
