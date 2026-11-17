// Navigation Types
export type RootStackParamList = {
  MainTabs: {
    screen?: string;
    params?: any;
  };
  Home: undefined;
  Login: undefined;
  SignUp: undefined;
  Browse: undefined;
  Settings: undefined;
  ForgotPassword: undefined;
  FindBarber: undefined;
  BarberOnboarding: undefined;
  BarberDashboard: undefined;
  BookingSuccess: undefined;
  BookingPage: {
    barberId: string;
    barberName: string;
  };
  BookingCalendar: {
    barberId: string;
    barberName: string;
    preSelectedService?: Service;
    guestMode?: boolean;
  };
  BookingConfirmation: {
    bookingId: string;
    barberId: string;
    barberName: string;
    service: Service;
    date: string;
  };
  EmailConfirmation: {
    email: string;
    userType: 'client' | 'barber';
  };
  Terms: undefined;
  PrivacyPolicy: undefined;
  BookingWebView: {
    barberId: string;
    barberName: string;
  };
  ProfilePortfolio: {
    barberId?: string;
  };
  ProfilePreview: {
    barberId: string;
  };
}

// User Types
export type UserRole = 'client' | 'barber' | 'admin';

export const USER_ROLES = {
  CLIENT: "client" as const,
  BARBER: "barber" as const,
  ADMIN: "admin" as const,
}

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

// Review Types
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
  // Relations
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

// Barber Types - Updated to match database schema
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
  // Relations
  user?: User;
  services?: Service[];
  availability?: Availability[];
  special_hours?: SpecialHours[];
}

// Service Types
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

// Service Addons
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

// Booking Types - Updated to match database schema
export type BookingStatus = 
  | 'pending'         // Initial state
  | 'payment_pending' // Awaiting payment
  | 'confirmed'       // Payment successful
  | 'completed'       // Service completed
  | 'cancelled'       // Cancelled before service
  | 'refunded'        // Payment refunded
  | 'partially_refunded' // Partial refund
  | 'failed'          // Payment failed
  | 'expired'         // Payment expired

export type PaymentStatus = 
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'

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
  service_price?: number; // Historical service price at time of booking
  // Relations
  barber?: Barber;
  service?: Service;
  client?: User;
  addons?: BookingAddon[];
}

// Booking Addons
export interface BookingAddon {
  id: string;
  booking_id: string;
  addon_id: string;
  price: number;
  created_at: string;
}

// Availability Types
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

// Payments
export interface Payment {
  id: string;
  payment_intent_id: string;
  amount: number;
  currency: string;
  status: string;
  barber_stripe_account_id: string;
  platform_fee: number;
  created_at: string;
  booking_id: string;
  booking?: Booking;
}

// Helper Types
export interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
}

export interface DateTimeSelection {
  date: Date | null;
  timeSlot: TimeSlot | null;
}

// Calendar Types
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  description?: string;
  location?: string;
  attendees?: string[];
  status?: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface CalendarDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  monthName: string;
  isToday: boolean;
  dateString: string;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Form types
export interface LoginForm {
  email: string;
  password: string;
}

export interface SignUpForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: 'client' | 'barber';
  agreeToTerms: boolean;
}

export interface BookingForm {
  barberId: string;
  serviceId: string;
  date: string;
  time: string;
  notes?: string;
}

// Database types for Supabase queries
export type BarberFromDB = {
  id: string;
  user_id: string;
  business_name?: string;
  specialties: string[];
  price_range?: string;
  stripe_account_status?: string;
  status?: string;
  onboarding_complete?: boolean;
  stripe_account_ready?: boolean;
  is_developer?: boolean;
}

export type ProfileFromDB = {
  id: string;
  name: string;
  location?: string;
  bio?: string;
  avatar_url?: string;
  is_public?: boolean;
  email_notifications?: boolean;
  sms_notifications?: boolean;
  marketing_emails?: boolean;
  is_disabled?: boolean;
  coverphoto?: string;
  carrier?: string;
} 