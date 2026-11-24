export interface ProfileFormData {
  name: string;
  username: string;
  email: string;
  phone: string;
  bio: string;
  location: string;
  description: string;
  specialties: string[];
  businessName: string;
  isPublic: boolean;
  socialMedia: {
    instagram: string;
    twitter: string;
    tiktok: string;
    facebook: string;
  };
}

export interface Service {
  id?: string;
  name: string;
  duration: number;
  /** Dollars exactly as typed ("25", "25.5", "25.50"); converted to cents on save. */
  price: string;
  description?: string;
  barber_id?: string;
}

export interface ServiceAddon {
  id?: string;
  name: string;
  description?: string;
  /** Dollars exactly as typed; converted to cents on save. */
  price: string;
  is_active: boolean;
  barber_id?: string;
}

export interface SettingsData {
  profileComplete: boolean;
  servicesComplete: boolean;
  availabilityComplete: boolean;
  stripeConnected: boolean;
}

export type Tab = 'profile' | 'services' | 'addons' | 'availability' | 'earnings'; 