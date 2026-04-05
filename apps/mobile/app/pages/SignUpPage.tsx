import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Alert,
    StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Scissors, User, ArrowLeft, Eye, EyeOff, Check } from 'lucide-react-native';
import { RootStackParamList } from '../shared/types';
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

type SignUpScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

type UserType = 'client' | 'barber';

export default function SignUpPage() {
    const { colors, colorScheme } = useTheme();
    const navigation = useNavigation<SignUpScreenNavigationProp>();
    const [userType, setUserType] = useState<UserType>('client');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [agreeToTerms, setAgreeToTerms] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [showContent, setShowContent] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setShowContent(true), 500);
        return () => clearTimeout(timer);
    }, []);

    const validateForm = (): boolean => {
        const newErrors: { [key: string]: string } = {};

        if (!fullName.trim()) {
            newErrors.fullName = 'Full name is required';
        }

        if (!email.trim()) {
            newErrors.email = 'Email is required';
        } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                newErrors.email = 'Please enter a valid email address';
            }
        }

        if (!password) {
            newErrors.password = 'Password is required';
        } else if (password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters long';
        }

        if (password !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }


        if (!agreeToTerms) {
            newErrors.terms = 'You must agree to the terms and conditions';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSignUp = async () => {
        if (!validateForm()) {
            return;
        }

        setIsLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        logger.log('=== Registration Process Started ===');
        logger.log('Registration Data:', { name: fullName, email, role: userType });

        try {
            // Create auth user with metadata
            logger.log('Creating auth user...');
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name: fullName,
                        role: userType,
                    },
                },
            });

            if (authError) {
                logger.error('Auth Error:', authError);
                
                // Check for user already registered error
                if (authError.message?.includes('User already registered')) {
                    Alert.alert(
                        'Account Exists',
                        'An account with this email already exists. Please sign in instead.',
                        [
                            { text: 'Go to Login', onPress: () => navigation.navigate('Login' as any) }
                        ]
                    );
                    return;
                }
                
                setErrors({ general: authError.message || 'Registration failed' });
                return;
            }

            logger.log('Auth Data:', authData);

            // Check if email confirmation is required
            if (authData.user && !authData.session) {
                logger.log('Email confirmation required');
                Alert.alert(
                    'Check Your Email',
                    'We\'ve sent you a confirmation email. Please verify your email address to complete registration.',
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.navigate('EmailConfirmation' as any)
                        }
                    ]
                );
                return;
            }

            if (!authData.user) {
                logger.error('No user returned from signup');
                setErrors({ general: 'Registration failed. Please try again.' });
                return;
            }

            // Try to create/update profile
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: authData.user.id,
                    email: authData.user.email,
                    name: fullName,
                    username: email.split('@')[0], // Generate username from email
                    role: userType,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });

            if (profileError) {
                logger.error('Profile creation error:', profileError);
                // Don't fail registration, profile will be created on first login
            }

            // For barbers, try to create business profile
            if (userType === 'barber') {
                logger.log('Creating business profile...');
                const { error: businessError } = await supabase
                    .from('barbers')
                    .insert({
                        user_id: authData.user.id,
                        status: 'pending',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    });

                if (businessError) {
                    logger.error('Business Profile Creation Failed:', businessError);
                    // Don't fail registration, barber row will be created on first login
                }
            }

            logger.log('Registration completed successfully');
            
            // Navigate based on user type
            if (authData.session) {
                Alert.alert(
                    'Registration Successful',
                    userType === 'barber' 
                        ?                                 'Welcome to Talii! Please complete your business profile setup.'
                        : 'Welcome to Talii!',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                if (userType === 'barber') {
                                    navigation.navigate('BarberOnboarding' as any);
                                } else {
                                    navigation.navigate('Home' as any);
                                }
                            }
                        }
                    ]
                );
            }

        } catch (error) {
            logger.error('Registration Process Failed:', error);
            setErrors({ general: 'An unexpected error occurred. Please try again.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignIn = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate('Login' as any);
    };

    const handleTermsPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate('Terms' as any);
    };

    const handleGoogleSignUp = async () => {
        // Google Sign-Up is not yet implemented
        // This function is kept for future implementation
        // For now, Google Sign-Up button is hidden from the UI
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.goBack();
    };

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
                    borderRadius: 22,
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
                                <View style={{ alignItems: 'center', marginBottom: 32 }}>
                                <Text style={{
                                fontSize: 28,
                                fontWeight: '700',
                                color: colors.foreground,
                                textAlign: 'center',
                            }}>
                                Create an Account
                            </Text>
                                
                                <Text style={{
                                    fontSize: 18,
                                    color: colors.mutedForeground,
                                    textAlign: 'center',
                                    marginTop: 12,
                                }}>
                                    Join Talii and start your journey
                                </Text>
                                </View>
                            </AnimatedSection>
                        )}

                        {/* Sign Up Form */}
                        {showContent && (
                            <AnimatedSection type="slideUp" delay={150}>
                            <GlassyCard>
                                    {errors.general && (
                                        <View style={{
                                            padding: 16,
                                            marginBottom: 24,
                                            borderRadius: theme.borderRadius.xl,
                                            backgroundColor: colors.muted,
                                            borderWidth: 1,
                                            borderColor: colors.destructive,
                                        }}>
                                            <Text style={{ color: colors.destructive, textAlign: 'center', fontSize: 14 }}>
                                                {errors.general}
                                            </Text>
                                        </View>
                                    )}

                                    {/* User Type Selection */}
                                    <View style={{
                                        flexDirection: 'row',
                                        marginBottom: 24,
                                        borderRadius: theme.borderRadius['3xl'],
                                        backgroundColor: colors.muted,
                                        padding: 4,
                                    }}>
                                    <AnimatedPressable
                                            style={{
                                                flex: 1,
                                                paddingVertical: 12,
                                                paddingHorizontal: 16,
                                                borderRadius: theme.borderRadius.xl,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: userType === 'client' ? colors.primary : 'transparent',
                                            }}
                                            onPress={() => {
                                                setUserType('client');
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            }}
                                            disabled={isLoading}
                                        >
                                            <User size={18} color={userType === 'client' ? colors.primaryForeground : colors.foreground} style={{ marginRight: 8 }} />
                                            <Text style={{
                                                fontWeight: '600',
                                                color: userType === 'client' ? colors.primaryForeground : colors.foreground,
                                            }}>
                                                Client
                                            </Text>
                                        </AnimatedPressable>
                                        <AnimatedPressable
                                            style={{
                                                flex: 1,
                                                paddingVertical: 12,
                                                paddingHorizontal: 16,
                                                borderRadius: theme.borderRadius.xl,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: userType === 'barber' ? colors.primary : 'transparent',
                                            }}
                                            onPress={() => {
                                                setUserType('barber');
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            }}
                                            disabled={isLoading}
                                        >
                                            <Scissors size={18} color={userType === 'barber' ? colors.primaryForeground : colors.foreground} style={{ marginRight: 8 }} />
                                            <Text style={{
                                                fontWeight: '600',
                                                color: userType === 'barber' ? colors.primaryForeground : colors.foreground,
                                            }}>
                                                Barber
                                            </Text>
                                        </AnimatedPressable>
                                    </View>

                                    <Input
                                        label="Full Name"
                                        placeholder="John Doe"
                                        value={fullName}
                                        onChangeText={(text) => {
                                            setFullName(text);
                                            setErrors({ ...errors, fullName: '' });
                                        }}
                                        error={errors.fullName || undefined}
                                        autoCapitalize="words"
                                        autoCorrect={false}
                                        editable={!isLoading}
                                    />

                                    <Input
                                        label="Email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChangeText={(text) => {
                                            setEmail(text);
                                            setErrors({ ...errors, email: '' });
                                        }}
                                        error={errors.email || undefined}
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
                                            setErrors({ ...errors, password: '' });
                                        }}
                                        error={errors.password || undefined}
                                        secureTextEntry={!showPassword}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        editable={!isLoading}
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

                                    <Input
                                        label="Confirm Password"
                                        placeholder="Re-enter your password"
                                        value={confirmPassword}
                                        onChangeText={(text) => {
                                            setConfirmPassword(text);
                                            setErrors({ ...errors, confirmPassword: '' });
                                        }}
                                        error={errors.confirmPassword || undefined}
                                        secureTextEntry={!showConfirmPassword}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        editable={!isLoading}
                                        rightIcon={
                                            <TouchableOpacity
                                                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                                style={{ padding: 8 }}
                                            >
                                                {showConfirmPassword ? (
                                                    <EyeOff size={20} color={colors.mutedForeground} />
                                                ) : (
                                                    <Eye size={20} color={colors.mutedForeground} />
                                                )}
                                            </TouchableOpacity>
                                        }
                                    />

                                    {/* Terms Agreement */}
                                    <AnimatedPressable
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            marginBottom: 16,
                                        }}
                                        onPress={() => {
                                            setAgreeToTerms(!agreeToTerms);
                                            setErrors({ ...errors, terms: '' });
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        }}
                                        disabled={isLoading}
                                    >
                                        <View style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: theme.borderRadius.sm,
                                            borderWidth: 2,
                                            borderColor: errors.terms ? colors.destructive : colors.border,
                                            backgroundColor: agreeToTerms ? colors.primary : 'transparent',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            marginRight: 12,
                                        }}>
                                            {agreeToTerms && (
                                                <Check size={12} color={colors.primaryForeground} />
                                            )}
                                        </View>
                                        <Text style={{
                                            fontSize: 14,
                                            color: colors.foreground,
                                            flex: 1,
                                        }}>
                                            I agree to the{' '}
                                            <Text
                                                onPress={handleTermsPress}
                                                style={{
                                                    color: colors.primary,
                                                    textDecorationLine: 'underline',
                                                    fontWeight: '600',
                                                }}
                                            >
                                                terms and conditions
                                            </Text>
                                            {' '}and{' '}
                                            <Text
                                                onPress={() => {
                                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                    navigation.navigate('PrivacyPolicy' as any);
                                                }}
                                                style={{
                                                    color: colors.primary,
                                                    textDecorationLine: 'underline',
                                                    fontWeight: '600',
                                                }}
                                            >
                                                privacy policy
                                            </Text>
                                        </Text>
                                    </AnimatedPressable>
                                    {errors.terms && (
                                        <Text style={{ color: colors.destructive, fontSize: 12, marginBottom: 16 }}>
                                            {errors.terms}
                                        </Text>
                                    )}

                                    <ActionButton
                                        variant="primary"
                                        onPress={handleSignUp}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? 'Creating account...' : 'Create account'}
                                    </ActionButton>
                            </GlassyCard>
                            </AnimatedSection>
                        )}
                        {showContent && (
                            <>
                                {/* Sign In Link */}
                                <View style={{ alignItems: 'center', marginTop: 32 }}>
                                    <Text style={{
                                        fontSize: 14,
                                        color: colors.mutedForeground,
                                        textAlign: 'center',
                                    }}>
                                        Already have an account?{' '}
                                        <Text
                                            onPress={handleSignIn}
                                            style={{
                                                color: colors.primary,
                                                textDecorationLine: 'underline',
                                                fontWeight: '600',
                                            }}
                                        >
                                            Sign in
                                        </Text>
                                    </Text>
                                </View>
                            </>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}