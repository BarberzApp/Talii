import React, { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import * as Font from 'expo-font';
import * as Linking from 'expo-linking';
import { initSentry } from './app/shared/lib/sentry';
import { logger } from './app/shared/lib/logger';
import tw from 'twrnc';
import { AppNavigator } from './app/navigation/AppNavigator';
import { AuthProvider } from './app/shared/hooks/useAuth';
import { StripeProvider } from '@stripe/stripe-react-native';
import { Toaster, useToast } from './app/shared/components/ui';
import { STRIPE_CONNECT_DEEP_LINK, fetchConnectStatus, isConnectSessionOpen } from './app/shared/lib/stripeConnect';
import { ThemeProvider, useTheme } from './app/shared/components/theme';
// Initialize Sentry as early as possible (using secure configuration from sentry.ts)
// The initSentry() function handles proper configuration with data privacy protections
initSentry();

const App = () => {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          'BebasNeue-Regular': require('./assets/fonts/BebasNeue-Regular.ttf'),
        });
        setFontsLoaded(true);
      } catch (error) {
        logger.error('Error loading fonts:', error);
        setFontsLoaded(true); // Continue without custom fonts
      }
    }

    loadFonts();
  }, []);

  // Handle deep links
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      try {
        logger.log('Deep link received:', event.url);
        
        if (!event.url || typeof event.url !== 'string') {
          logger.error('Invalid deep link URL:', event.url);
          return;
        }
        
        // Stripe Connect: the website's /barber/connect/return and /refresh pages
        // send the barber here. Read the account status from Stripe through the
        // API (it stores the flags); screens re-read it when they come into focus.
        // While the in-app Stripe session is open, that flow handles the return itself.
        if (event.url.startsWith(`${STRIPE_CONNECT_DEEP_LINK}/`) && !isConnectSessionOpen()) {
          if (event.url.includes('/return')) {
            fetchConnectStatus().then((status) => {
              if (status) logger.log('Stripe Connect status refreshed after return');
            });
          } else if (event.url.includes('/refresh')) {
            Alert.alert(
              'Continue Stripe Setup',
              'Your Stripe setup link expired. Open Settings > Earnings and tap Connect Stripe to continue.'
            );
          }
        }

        // Stripe PaymentSheet redirects (3-D Secure, bank apps) come back on
        // bocm://stripe-redirect; the Stripe SDK handles them.
      } catch (error) {
        logger.error('Error handling deep link:', error);
        // Don't crash the app - just log the error
        const { captureException } = require('./app/shared/lib/sentry');
        captureException(error as Error, {
          context: 'handleDeepLink',
          url: event.url,
        });
      }
    };

    // Listen for incoming links when app is already running
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Handle links that opened the app
    Linking.getInitialURL().then((url) => {
      if (url) {
        logger.log('App opened with URL:', url);
        handleDeepLink({ url });
      }
    }).catch((error) => {
      logger.error('Error getting initial URL:', error);
      // Don't crash - just log the error
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  const { toasts, dismiss } = useToast();

  const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (stripePublishableKey === undefined || stripePublishableKey === '') {
    logger.error('Stripe publishable key is missing');
  }

  return (
    <ThemeProvider>
      {!fontsLoaded ? (
        <AppLoadingScreen />
      ) : !stripePublishableKey ? (
        <AppConfigErrorScreen />
      ) : (
        <StripeProvider publishableKey={stripePublishableKey} urlScheme="bocm">
          <AuthProvider>
            <AppNavigator />
            <Toaster toasts={toasts} onDismiss={dismiss} />
          </AuthProvider>
        </StripeProvider>
      )}
    </ThemeProvider>
  );
};

function AppLoadingScreen() {
  const { colors } = useTheme();
  return (
    <View style={[tw`flex-1 justify-center items-center`, { backgroundColor: colors.background }]}>
      <Text style={[tw`text-xl font-bold`, { color: colors.primary }]}>Talii</Text>
      <Text style={[tw`text-sm mt-2`, { color: colors.mutedForeground }]}>Loading...</Text>
    </View>
  );
}

function AppConfigErrorScreen() {
  const { colors } = useTheme();
  return (
    <View style={[tw`flex-1 justify-center items-center`, { backgroundColor: colors.background }]}>
      <Text style={[tw`text-xl font-bold`, { color: colors.foreground }]}>Configuration Error</Text>
      <Text style={[tw`text-sm mt-2 text-center px-4`, { color: colors.mutedForeground }]}>
        The app is not properly configured. Please contact support.
      </Text>
    </View>
  );
}

export default App;