import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  StatusBar,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Scissors, ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../shared/hooks/useAuth';
import { supabase } from '../shared/lib/supabase';
import { logger } from '../shared/lib/logger';
import { useTheme } from '../shared/components/theme';
import { AnimatedBackground } from '../shared/components/AnimatedBackground';
import { ActionButton } from '../shared/components/ActionButton';
import { Card } from '../shared/components/ui/Card';
import Input from '../shared/components/ui/Input';
import { theme } from '../shared/lib/theme';
import { GlassyCard } from '../shared/components/ui/GlassyCard';
import { AnimatedSection } from '../shared/components/ui/AnimatedSection';
import { AnimatedPressable } from '../shared/components/ui/AnimatedPressable';

type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  SignUp: undefined;
  MainTabs: undefined;
  ProfileComplete: undefined;
};

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginPage() {
  const { colors, colorScheme } = useTheme();
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      setCheckingSession(true);
      try {
        logger.log('🔐 Checking existing session...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          logger.log('✅ Session found for user:', session.user.id);
          await handleRedirect(session.user.id);
        } else {
          logger.log('❌ No existing session found');
          setCheckingSession(false);
        }
      } catch (e) {
        logger.error('❌ Session check error:', e);
        setCheckingSession(false);
      }
    };
    checkSession();
  }, []);

  const handleRedirect = async (userId: string) => {
    try {
      logger.log('🎯 Starting redirect process for user:', userId);
      
      // Fetch profile with retry
      let profile = null;
      let retries = 3;
      
      while (retries > 0) {
        logger.log(`📋 Fetching profile - Attempt ${4 - retries}/3...`);
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        
        if (data) {
          profile = data;
          logger.log('✅ Profile fetched successfully');
          break;
        }
        
        logger.log('❌ Profile fetch attempt failed:', error);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!profile) {
        logger.log('❌ Could not fetch profile after retries');
        setCheckingSession(false);
        return;
      }

      // Check if profile needs completion
      if (!profile.role || !profile.username) {
        logger.log('⚠️ Profile incomplete, redirecting to completion');
        navigation.replace('ProfileComplete' as any);
        return;
      }

      // Ensure barber row exists
      if (profile.role === 'barber') {
        logger.log('💈 Checking for barber row...');
        const { data: existingBarber } = await supabase
          .from('barbers')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (!existingBarber) {
          logger.log('💈 Creating barber row...');
          const { error: insertError } = await supabase
            .from('barbers')
            .insert({
              user_id: userId,
              business_name: profile.business_name || '',
              status: 'pending',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (insertError) {
            logger.error('❌ Failed to create barber row:', insertError);
          } else {
            logger.log('✅ Barber row created successfully');
          }
        }
      }

      // Determine redirect path
      let redirectPath = 'MainTabs';
      
      if (profile.email === 'primbocm@gmail.com') {
        redirectPath = 'SuperAdmin' as any;
      } else if (profile.role === 'barber') {
        // Check if barber onboarding is already complete
        logger.log('💈 Checking if barber onboarding is complete...');
        const { data: barberData, error: barberError } = await supabase
          .from('barbers')
          .select('onboarding_complete, business_name, bio, specialties')
          .eq('user_id', userId)
          .single();

        if (barberError) {
          logger.error('❌ Error checking barber data:', barberError);
          redirectPath = 'BarberOnboarding';
        } else {
          logger.log('💈 Onboarding completion check:', {
            onboarding_complete: barberData?.onboarding_complete,
            businessName: barberData?.business_name,
            bio: barberData?.bio,
            specialties: barberData?.specialties
          });

          // If onboarding is marked as complete, skip to main app
          if (barberData?.onboarding_complete) {
            logger.log('✅ Barber onboarding is already complete! Going to main app...');
            redirectPath = 'MainTabs';
          } else {
            logger.log('⚠️ Barber onboarding incomplete, going to onboarding...');
            redirectPath = 'BarberOnboarding';
          }
        }
      } else if (profile.location) {
        redirectPath = 'MainTabs';
      } 

      logger.log('🎯 Redirecting to:', redirectPath);
      navigation.replace(redirectPath as any);
      
    } catch (error) {
      logger.error('❌ Redirect error:', error);
      setCheckingSession(false);
    }
  };

  const handleSignIn = async () => {
    setError(null);
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    logger.log('🔐 Starting login process for:', email);
    
    try {
      // Authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        logger.error('❌ Authentication error:', authError);
        
        if (authError.message?.includes('Invalid login credentials')) {
          setError('Invalid email or password');
        } else if (authError.message?.includes('Email not confirmed')) {
          setError('Please check your email to confirm your account');
        } else {
          setError(authError.message || 'An error occurred during login');
        }
        return;
      }

      if (!authData.user) {
        logger.error('❌ No user data returned');
        setError('Login failed. Please try again.');
        return;
      }

      logger.log('✅ Authentication successful for user:', authData.user.id);

      // Fetch profile with retry
      let profile = null;
      let retries = 3;
      
      while (retries > 0) {
        logger.log(`📋 Fetching profile - Attempt ${4 - retries}/3...`);
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();
        
        if (data) {
          profile = data;
          logger.log('✅ Profile fetched successfully');
          break;
        }
        
        logger.log('❌ Profile fetch attempt failed:', error);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!profile) {
        logger.error('❌ Could not fetch profile after retries');
        setError('Could not load profile. Please try again.');
        return;
      }

      // Check if profile is complete
      if (!profile.role || !profile.username) {
        logger.log('⚠️ Profile incomplete, user needs to complete registration');
        navigation.replace('ProfileComplete' as any);
        return;
      }

      // Ensure barber row exists for barber users
      if (profile.role === 'barber') {
        logger.log('💈 Checking for barber row...');
        const { data: existingBarber } = await supabase
          .from('barbers')
          .select('id')
          .eq('user_id', authData.user.id)
          .maybeSingle();

        if (!existingBarber) {
          logger.log('💈 Creating barber row...');
          const { error: insertError } = await supabase
            .from('barbers')
            .insert({
              user_id: authData.user.id,
              business_name: profile.business_name || '',
              status: 'pending',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (insertError) {
            logger.error('❌ Failed to create barber row:', insertError);
          } else {
            logger.log('✅ Barber row created successfully');
          }
        }
      }

      logger.log('✅ Login successful, redirecting...');
      await handleRedirect(authData.user.id);
      
    } catch (error) {
      logger.error('❌ Login error:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('SignUp');
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Enter Email', 'Please enter your email address first');
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert(
          'Check Your Email',
          'We\'ve sent you a password reset link. Please check your email.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send reset email. Please try again.');
    }
  };

  const handleGoogleSignIn = async () => {
    // Google Sign-In is not yet implemented
    // This function is kept for future implementation
    // For now, Google Sign-In button is hidden from the UI
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Home' as any);
  };

  if (checkingSession) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar
          barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />
        <AnimatedBackground />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{
            padding: 24,
            borderRadius: theme.borderRadius['3xl'],
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '600' }}>
              Checking session...
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      
      {/* Animated Background */}
      <AnimatedBackground />
      
      {/* Back Button */}
      <AnimatedPressable
        onPress={handleBack}
        style={{
          position: 'absolute',
          top: 60,
          left: 20,
          zIndex: 10,
          width: 44,
          height: 44,
          borderRadius: theme.borderRadius.full,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ArrowLeft size={24} color={colors.foreground} />
      </AnimatedPressable>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ paddingHorizontal: 32, paddingVertical: 24 }}>
            
            {/* Header */}
            {showContent && (
              <AnimatedSection type="fade">
                <View style={{ alignItems: 'center', marginBottom: 48 }}>
                <View style={{
                  width: 80,
                  height: 80,
                  borderRadius: theme.borderRadius.full,
                  backgroundColor: colors.muted,
                  borderWidth: 1,
                  borderColor: colors.border,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 24,
                }}>
                  <Scissors size={40} color={colors.primary} />
                </View>
                
                <Text style={{
                  fontSize: 28,
                  fontWeight: '700',
                  color: colors.foreground,
                  textAlign: 'center',
                }}>
                  Welcome back
                </Text>
                
                <Text style={{
                  fontSize: 18,
                  color: colors.mutedForeground,
                  textAlign: 'center',
                  marginTop: 12,
                }}>
                  Sign in to your account
                </Text>
                </View>
              </AnimatedSection>
            )}

            {/* Login Form */}
            {showContent && (
              <AnimatedSection type="slideUp" delay={150}>
                <View style={{ width: '100%' }}>
                  <View>
                  {error && (
                    <View style={{
                      padding: 16,
                      marginBottom: 24,
                      borderRadius: theme.borderRadius.xl,
                      backgroundColor: colors.muted,
                      borderWidth: 1,
                      borderColor: colors.destructive,
                    }}>
                      <Text style={{ color: colors.destructive, textAlign: 'center', fontSize: 14 }}>
                        {error}
                      </Text>
                    </View>
                  )}

                  <Input
                    label="Email"
                    placeholder="name@example.com"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      setError(null);
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />

                  <Input
                    label="Password"
                    placeholder="Enter your password"
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      setError(null);
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                    containerStyle={{ marginBottom: 0 }}
                    rightIcon={
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={{ padding: 8 }}
                      >
                        {showPassword ? (
                          <EyeOff size={20} color={colors.mutedForeground} />
                        ) : (
                          <Eye size={20} color={colors.mutedForeground} />
                        )}
                      </TouchableOpacity>
                    }
                  />

                  <AnimatedPressable
                    onPress={handleForgotPassword}
                    disabled={isLoading}
                    style={{ alignSelf: 'flex-end', marginTop: 8, marginBottom: 24 }}
                  >
                    <Text style={{
                      fontSize: 14,
                      color: colors.primary,
                      textDecorationLine: 'underline',
                    }}>
                      Forgot password?
                    </Text>
                  </AnimatedPressable>

                  <ActionButton
                    variant="primary"
                    onPress={handleSignIn}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Signing in...' : 'Sign in'}
                  </ActionButton>
                </View>

                {/* Sign Up Link */}
                <View style={{ alignItems: 'center', marginTop: 32 }}>
                  <Text style={{
                    fontSize: 14,
                    color: colors.mutedForeground,
                    textAlign: 'center',
                  }}>
                    Don&apos;t have an account?{' '}
                    <Text
                      onPress={handleSignUp}
                      style={{
                        color: colors.primary,
                        textDecorationLine: 'underline',
                        fontWeight: '600',
                      }}
                    >
                      Sign up
                    </Text>
                  </Text>
                </View>
              </View>
            </AnimatedSection>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}