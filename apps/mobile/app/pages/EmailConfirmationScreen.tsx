import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView, StatusBar} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MailCheck, RefreshCw, LogIn, ArrowLeft } from 'lucide-react-native';
import tw from 'twrnc';
import Button from '../shared/components/ui/Button';
import { useAuth } from '../shared/hooks/useAuth';
import { supabase } from '../shared/lib/supabase';
import { useTheme } from '../shared/components/theme';
import { AnimatedBackground } from '../shared/components/AnimatedBackground';
import { Card, CardContent } from '../shared/components/ui';
import { logger } from '../shared/lib/logger';

type RootStackParamList = {
  EmailConfirmation: { email: string };
};

type EmailConfirmationScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'EmailConfirmation'
>;

type EmailConfirmationScreenRouteProp = RouteProp<
  RootStackParamList,
  'EmailConfirmation'
>;

export default function EmailConfirmationScreen() {
  const { colors, colorScheme } = useTheme();
  const navigation = useNavigation<EmailConfirmationScreenNavigationProp>();
  const route = useRoute<EmailConfirmationScreenRouteProp>();
  const { user } = useAuth();
  const [checking, setChecking] = useState(false);
  
  const email = (user?.email || route?.params?.email || '').trim().toLowerCase();

  useEffect(() => {
    logger.info('Email confirmation screen context', {
      email,
      userEmail: user?.email,
      routeEmail: route?.params?.email,
    });
  }, [email, user, route?.params?.email]);
  useEffect(() => {
    const checkInterval = setInterval(async () => {
      if (user) {
        clearInterval(checkInterval);
        handleConfirmed();
      }
    }, 2000);

    return () => clearInterval(checkInterval);
  }, [user]);

  const handleConfirmed = () => {
    // Default to client flow if no user profile
    navigation.replace('FindBarber' as any, {});
  };

  const checkEmailConfirmation = async () => {
    setChecking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        Alert.alert(
          'Email Confirmed!',
          'Your email has been verified. Redirecting...',
          [
            {
              text: 'OK',
              onPress: handleConfirmed,
            },
          ]
        );
      } else {
        Alert.alert(
          'Not Confirmed Yet',
          'Please check your email and click the confirmation link first.',
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to check confirmation status. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const resendConfirmationEmail = async () => {
    if (!email) {
      Alert.alert(
        'Missing email',
        'We need your email to resend the confirmation. Please log in again or restart signup.'
      );
      logger.warn('Resend blocked: missing email context', {
        email,
        userEmail: user?.email,
        routeEmail: route?.params?.email,
      });
      return;
    }
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });
      if (error) throw error;
      Alert.alert(
        'Email Sent',
        'We&apos;ve sent another confirmation email. Please check your inbox.',
      );
      logger.info('Email sent successfully');
      
    } catch (error) {
      Alert.alert('Error', 'Failed to resend confirmation email. Please try again.');
      logger.error('Failed to resend confirmation email', error);
    }
    
  };

  const goToLogin = () => {
    navigation.replace('Login' as any, {});
  };

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <AnimatedBackground />

      <View style={tw`flex-1 justify-center px-6`}>
        {/* Back button */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[
            tw`absolute left-4 top-12 w-11 h-11 rounded-full items-center justify-center`,
            { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, zIndex: 10 },
          ]}
        >
          <ArrowLeft size={22} color={colors.foreground} />
        </TouchableOpacity>

        <Card style={[tw`w-full max-w-md self-center rounded-2xl`, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
          <CardContent style={tw`p-6`}>
            <View style={tw`items-center mb-4`}>
              <View
                style={[
                  tw`w-16 h-16 rounded-full items-center justify-center mb-3`,
                  { backgroundColor: colors.muted },
                ]}
              >
                <MailCheck size={28} color={colors.primary} />
            </View>
              <Text style={[tw`text-xl font-bold text-center`, { color: colors.foreground }]}>
                Check your email
            </Text>
              <Text style={[tw`text-sm text-center mt-2`, { color: colors.mutedForeground }]}>
                We sent a verification link to:
            </Text>
              <Text style={[tw`text-base font-semibold mt-1 text-center`, { color: colors.primary }]}>
              {email}
            </Text>
          </View>

            <Text style={[tw`text-center mb-6 text-sm leading-5`, { color: colors.mutedForeground }]}>
              Click the link in your inbox to verify. We&apos;ll redirect once it&apos;s confirmed.
          </Text>

            <View style={tw`gap-3`}>
            {checking ? (
                <View style={[tw`py-3 rounded-xl flex-row items-center justify-center`, { backgroundColor: colors.primary }]}>
                <ActivityIndicator color={colors.primaryForeground} />
                  <Text style={[tw`ml-2 font-semibold`, { color: colors.primaryForeground }]}>Checking...</Text>
              </View>
            ) : (
              <Button
                onPress={checkEmailConfirmation}
                size="lg"
                  style={[tw`w-full flex-row items-center justify-center gap-2`, { backgroundColor: colors.primary }]}
              >
                  <MailCheck size={18} color={colors.primaryForeground} />
                  <Text style={[tw`font-semibold`, { color: colors.primaryForeground }]}>
                    I&apos;ve confirmed my email
                  </Text>
              </Button>
            )}

              <Button
                variant="outline"
              onPress={resendConfirmationEmail}
                style={[tw`w-full flex-row items-center justify-center gap-2`, { borderWidth: 1, borderColor: colors.border }]}
            >
                <RefreshCw size={18} color={colors.primary} />
                <Text style={[tw`font-semibold`, { color: colors.primary }]}>Resend email</Text>
              </Button>

              <Button
                variant="ghost"
              onPress={goToLogin}
                style={tw`w-full flex-row items-center justify-center gap-2`}
            >
                <LogIn size={18} color={colors.mutedForeground} />
                <Text style={[tw`font-semibold`, { color: colors.mutedForeground }]}>
                Already confirmed? Go to login
              </Text>
              </Button>
          </View>
          </CardContent>
        </Card>
      </View>
    </SafeAreaView>
  );
}