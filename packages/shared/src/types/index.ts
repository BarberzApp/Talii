import type { BookingStatus, PaymentStatus, UserRole } from '../constants';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  username?: string;
  phone?: string;
  location?: string;
  description?: string;
  bio?: string;
  favorites: string[];
  join_date: string;
  created_at: string;
  updated_at: string;
  avatar_url?: string;
  is_public?: boolean;
  email_notifications?: boolean;
  sms_notifications?: boolean;
  marketing_emails?: boolean;
  instagram_url?: string;
  twitter_url?: string;
  tiktok_url?: string;
  facebook_url?: string;
  is_disabled?: boolean;
  coverphoto?: string;
  carrier?: string;
  user_metadata?: {
    role?: UserRole;
    name?: string;
  };
}

// DB-aligned barber shape (mobile is currently closer to schema)
export interface Barber {
  id: string;
  user_id: string;
  bio?: string;
  specialties: string[];
  price_range?: string;
  next_available?: string;
  created_at: string;
  updated_at: string;
  stripe_account_id?: string;
  stripe_account_status?: 'pending' | 'active' | 'deauthorized';
  business_name?: string;
  status?: string;
  onboarding_complete?: boolean;
  stripe_account_ready?: boolean;
  instagram?: string;
  twitter?: string;
  tiktok?: string;
  facebook?: string;
  portfolio?: string[];
  is_developer?: boolean;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
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
  client_id?: string;
  service_id: string;
  date: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  price: number;
  notes?: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  created_at: string;
  updated_at: string;
  platform_fee?: number;
  barber_payout?: number;
  payment_intent_id?: string;
  addon_total?: number;
  service_price?: number;
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

