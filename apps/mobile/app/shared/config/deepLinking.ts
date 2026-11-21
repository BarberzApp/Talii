import { LinkingOptions } from '@react-navigation/native';
import { DEEP_LINKING_CONFIG } from './routeMapping';
import { logger } from '../lib/logger';

export const linking: LinkingOptions<any> = {
  prefixes: DEEP_LINKING_CONFIG.prefixes,
  
  config: {
    screens: {
      // Auth screens
      Login: 'login',
      SignUp: 'register',
      EmailConfirmation: 'confirm',
      Terms: 'terms',
      
      // Main app screens
      MainTabs: {
        screens: {
          Browse: 'browse',
          Calendar: 'calendar',
          Profile: 'profile',
          Settings: 'settings',
        },
      },
      
      // Individual screens
      Home: '',
      ProfilePortfolio: 'profile',
      BarberOnboarding: 'barber/onboarding',
      BookingCalendar: 'book/:barberId?',
      BookingSuccess: 'booking/success',
      
      // Admin routes
      SuperAdmin: 'super-admin',
    },
  },
  
  // Custom function to handle deep links
  async getInitialURL() {
    // Handle initial URL when app is opened from a deep link
    return null;
  },
  
  // Custom function to subscribe to URL changes
  subscribe(listener) {
    // Handle URL changes while app is running
    return () => {
      // Cleanup subscription
    };
  },
};

// Function to handle incoming deep links
export function handleDeepLink(url: string) {
  logger.log('🔗 Handling deep link:', url);
  
  if (!url || typeof url !== 'string') {
    logger.error('Invalid deep link URL provided:', url);
    return {
      route: 'Home',
      params: {},
      url: url || '',
    };
  }
  
  // Parse the URL and extract route and parameters
  let urlObj: URL;
  let path: string;
  let params: Record<string, string>;
  
  try {
    urlObj = new URL(url);
    path = urlObj.pathname;
    params = Object.fromEntries(urlObj.searchParams.entries());
  } catch (error) {
    logger.error('Error parsing deep link URL:', error, { url });
    // Return safe defaults if URL parsing fails
    return {
      route: 'Home',
      params: {},
      url: url,
    };
  }
  
  // Map web app routes to mobile app routes (aligned with Next.js)
  const routeMapping: Record<string, string> = {
    '/': 'Home',
    '/login': 'Login',
    '/register': 'SignUp',
    '/confirm': 'EmailConfirmation',
    '/terms': 'Terms',
    '/browse': 'Browse',
    '/calendar': 'Calendar',
    '/profile': 'Profile',
    '/settings': 'Settings',
    '/book': 'BookingCalendar',
    '/booking/success': 'BookingSuccess',
    '/barber/onboarding': 'BarberOnboarding',
    '/super-admin': 'SuperAdmin',
  };
  
  // Extract route from path
  const route = routeMapping[path] || path.replace('/', '');
  
  return {
    route,
    params,
    url,
  };
}
