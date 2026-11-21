// Route mapping configuration for Next.js ↔ React Navigation alignment

export interface RouteMapping {
  nextjs: string;
  reactNavigation: string;
  requiresAuth: boolean;
  requiresRole?: 'client' | 'barber' | 'admin';
  description: string;
}

export const ROUTE_MAPPING: RouteMapping[] = [
  // Public routes
  {
    nextjs: '/',
    reactNavigation: 'Home',
    requiresAuth: false,
    description: 'Landing/Welcome page'
  },
  {
    nextjs: '/login',
    reactNavigation: 'Login',
    requiresAuth: false,
    description: 'User login page'
  },
  {
    nextjs: '/register',
    reactNavigation: 'SignUp',
    requiresAuth: false,
    description: 'User registration page'
  },
  {
    nextjs: '/confirm',
    reactNavigation: 'EmailConfirmation',
    requiresAuth: false,
    description: 'Email confirmation page'
  },
  {
    nextjs: '/terms',
    reactNavigation: 'Terms',
    requiresAuth: false,
    description: 'Terms and conditions page'
  },

  // Protected routes - Main app
  {
    nextjs: '/browse',
    reactNavigation: 'Browse',
    requiresAuth: true,
    description: 'Browse barbers page'
  },
  {
    nextjs: '/calendar',
    reactNavigation: 'Calendar',
    requiresAuth: true,
    description: 'Calendar page'
  },
  {
    nextjs: '/profile',
    reactNavigation: 'Profile',
    requiresAuth: true,
    description: 'User profile page'
  },
  {
    nextjs: '/settings',
    reactNavigation: 'Settings',
    requiresAuth: true,
    description: 'Settings page'
  },

  // Booking routes
  {
    nextjs: '/book',
    reactNavigation: 'BookingCalendar',
    requiresAuth: true,
    description: 'Booking calendar page'
  },
  {
    nextjs: '/booking/success',
    reactNavigation: 'BookingSuccess',
    requiresAuth: true,
    description: 'Booking success page'
  },

  // Barber-specific routes
  {
    nextjs: '/barber/onboarding',
    reactNavigation: 'BarberOnboarding',
    requiresAuth: true,
    requiresRole: 'barber',
    description: 'Barber onboarding page'
  },

  // Admin routes
  {
    nextjs: '/super-admin',
    reactNavigation: 'SuperAdmin',
    requiresAuth: true,
    requiresRole: 'admin',
    description: 'Super admin page'
  }
];

export const isRouteProtected = (route: string): boolean => {
  const mapping = ROUTE_MAPPING.find(r => r.reactNavigation === route || r.nextjs === route);
  return mapping?.requiresAuth || false;
};

export const getRouteRole = (route: string): 'client' | 'barber' | 'admin' | undefined => {
  const mapping = ROUTE_MAPPING.find(r => r.reactNavigation === route || r.nextjs === route);
  return mapping?.requiresRole;
};

// Deep linking configuration
export const DEEP_LINKING_CONFIG = {
  prefixes: ['bocm://', 'https://bocm.app'],
  config: {
    screens: {
      Home: '',
      Login: 'login',
      SignUp: 'register',
      EmailConfirmation: 'confirm',
      Terms: 'terms',
      Browse: 'browse',
      Calendar: 'calendar',
      Profile: 'profile',
      Settings: 'settings',
      BookingCalendar: 'book',
      BookingSuccess: 'booking/success',
      BarberOnboarding: 'barber/onboarding',
      SuperAdmin: 'super-admin',
    },
  },
}; 
