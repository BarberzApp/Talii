import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    AppState,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import tw from 'twrnc';
import { RootStackParamList } from '../shared/types';
import { api, errorMessage, isApiError } from '../shared/lib/api';
import { fetchConnectStatus, isStripeReady, openStripeConnect } from '../shared/lib/stripeConnect';
import { parseCityState } from '../shared/lib/geocode';
import { useAuth } from '../shared/hooks/useAuth';
import { useTheme } from '../shared/components/theme';
import { logger } from '../shared/lib/logger';
import { 
    Card, 
    CardContent,
    Button,
    SectionHeader,
    NumericInput,
    ProgressIndicator,
    OnboardingInputField
} from '../shared/components/ui';
import { 
    CheckCircle, 
    CreditCard, 
    Building, 
    Scissors, 
    X, 
    Instagram, 
    Plus,
    Trash2,
    Phone,
    MapPin,
    Sparkles,
    Info
} from 'lucide-react-native';
import { SpecialtyAutocomplete } from '../shared/components/ui/SpecialtyAutocomplete';
import { SocialMediaLinks } from '../shared/components/ui/SocialMediaLinks';
import { LocationInput } from '../shared/components/ui/LocationInput';
import { BARBER_SPECIALTIES } from '../shared/utils/settings.utils';
import { runBarberPrefillOnce } from '../shared/helpers/barberPrefillHelper';
import { checkStripeStatusOnce } from '../shared/helpers/barberStripeHelper';
import {
    addService as addServiceHelper,
    removeService as removeServiceHelper,
    updateService as updateServiceHelper,
    syncServices,
    type Service as ServiceInput,
} from '../shared/helpers/barberServicesHelper';
import { validateStep as validateStepHelper } from '../shared/helpers/barberValidationHelper';
import { extractHandle } from '../shared/helpers/socialHandleHelper';
import { formatPhoneNumber } from '../shared/helpers/phoneFormatHelper';

type BarberOnboardingNavigationProp = NativeStackNavigationProp<RootStackParamList, 'BarberOnboarding'>;

const steps = [
    {
        id: 'business',
        title: 'Business Information',
        description: 'Tell us about your business',
        icon: Building,
        required: ['businessName', 'phone', 'location', 'bio']
    },
    {
        id: 'services',
        title: 'Services & Pricing',
        description: 'Set up your services and pricing',
        icon: Scissors,
        required: ['services']
    },
    {
        id: 'stripe',
        title: 'Payment Setup',
        description: 'Connect your Stripe account to receive payments',
        icon: CreditCard,
        required: ['stripeConnected']
    },
];

interface FormData {
    businessName: string;
    phone: string;
    location: string;
    bio: string;
    specialties: string[];
    services: ServiceInput[];
    stripeConnected: boolean;
    socialMedia: {
        instagram: string;
        twitter: string;
        tiktok: string;
        facebook: string;
    };
}

interface ValidationErrors {
    [key: string]: string;
}

export default function BarberOnboardingPage() {
    const { theme, colors } = useTheme();
    const navigation = useNavigation<BarberOnboardingNavigationProp>();
    const { user, userProfile, refreshProfile } = useAuth();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [stripeLoading, setStripeLoading] = useState(false);
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
    const [stripeStatus, setStripeStatus] = useState<string | null>(null);
    const [onboardingComplete, setOnboardingComplete] = useState(false);
    const [showCompleteBanner, setShowCompleteBanner] = useState(true);
    const prefillDoneRef = useRef(false);
    const phoneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [formData, setFormData] = useState<FormData>({
        businessName: '',
        phone: '',
        location: '',
        bio: '',
        specialties: [],
        services: [
            { name: 'Haircut', price: 30, duration: 30 },
            { name: 'Beard Trim', price: 20, duration: 20 },
        ],
        stripeConnected: false,
        socialMedia: {
            instagram: '',
            twitter: '',
            tiktok: '',
            facebook: '',
        }
    });

    // Prefill form with existing data (single run via helper)
    useEffect(() => {
        // Reset prefill ref on mount to ensure it runs when navigating from settings
        prefillDoneRef.current = false;
        
        const prefill = async () => {
            if (!user || prefillDoneRef.current) return;
            await runBarberPrefillOnce({
                userProfile,
                setFormData,
                setStripeStatus,
                prefillDoneRef,
            });
        };

        if (user) {
            prefill();
        }
    }, [user, userProfile]);

    useEffect(() => {
        return () => {
            if (phoneDebounceRef.current) {
                clearTimeout(phoneDebounceRef.current);
            }
        };
    }, []);

    // Check if user is a barber
    useEffect(() => {
        if (user && userProfile?.role !== 'barber') {
            logger.log('User is not a barber, redirecting to home');
            navigation.navigate('Home');
        }
    }, [user, userProfile, navigation]);

    // Check Stripe status when user returns to the app (e.g., from Stripe onboarding)
    useFocusEffect(
        useCallback(() => {
            const checkStatus = async () => {
                if (!user) return;
                await checkStripeStatusOnce(setFormData, setStripeStatus);
            };
            checkStatus();
            const delayedCheck = setTimeout(checkStatus, 2000);
            return () => clearTimeout(delayedCheck);
        }, [user])
    );

    // Also check Stripe status when app comes back to foreground
    useEffect(() => {
        const handleAppStateChange = (nextAppState: string) => {
            if (nextAppState === 'active' && user) {
                checkStripeStatusOnce(setFormData, setStripeStatus);
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription?.remove();
    }, [user]);

    const validateStep = async (stepIndex: number): Promise<boolean> => {
        const step = steps[stepIndex];
        const { errors, isValid } = validateStepHelper(step.id, formData);
        // Ensure specialty requirement message is preserved
        if (step.id === 'business' && !formData.specialties.length) {
            errors.specialties = errors.specialties || 'At least one specialty is required';
        }
        setValidationErrors(errors);
        return isValid;
    };

    const handleChange = (field: string, value: string | string[] | number) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
        
        if (validationErrors[field]) {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const handleSpecialtiesChange = (specialties: string[]) => {
        handleChange('specialties', specialties);
    };

    const handleServiceChange = (index: number, field: string, value: string | number) =>
        updateServiceHelper(index, field, value, setFormData);

    const addService = () => addServiceHelper(setFormData);

    const removeService = (index: number) => removeServiceHelper(index, setFormData);

    const handleSocialMediaUpdate = (socialData: {
        instagram: string;
        twitter: string;
        tiktok: string;
        facebook: string;
    }) => {
        setFormData(prev => ({
            ...prev,
            socialMedia: socialData
        }));
    };

    const handleSubmit = async () => {
        if (loading) return;

        const isValid = await validateStep(currentStep);
        if (!isValid) {
            Alert.alert('Validation Error', 'Please fix the errors before continuing.');
            return;
        }

        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
            return;
        }

        // Final submission: PATCH /api/me (profile + listing; the server geocodes
        // city/state), then the services, then mark onboarding complete.
        setLoading(true);
        try {
            if (!user?.id) {
                throw new Error('User not authenticated. Please log in again.');
            }
            if (userProfile?.role !== 'barber') {
                throw new Error('Only barbers can complete this onboarding process.');
            }

            const handle = (v: string) => (v ? extractHandle(v).replace(/^@/, '') || null : null);
            const { city, state } = parseCityState(formData.location);
            let deviceTimeZone: string | undefined;
            try {
                deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
            } catch {
                deviceTimeZone = undefined;
            }

            await api.me.update({
                phone: formData.phone || null,
                businessName: formData.businessName || null,
                bio: formData.bio || null,
                specialties: formData.specialties,
                city,
                state,
                instagram: handle(formData.socialMedia.instagram),
                tiktok: handle(formData.socialMedia.tiktok),
                ...(deviceTimeZone ? { timezone: deviceTimeZone } : {}),
            });

            if (formData.services.length > 0) {
                const saved = await syncServices(formData.services);
                setFormData(prev => ({ ...prev, services: saved }));
            }

            await api.me.update({ onboardingComplete: true });
            await refreshProfile();

            setOnboardingComplete(true);

            if (formData.stripeConnected) {
                Alert.alert(
                    'Onboarding Complete!',
                    'Your profile is fully set up and ready to receive payments. Welcome to the platform!',
                    [{ text: 'Go to Main App', onPress: () => navigation.navigate('MainTabs' as any) }]
                );
            } else {
                navigation.navigate('MainTabs' as any);
            }
        } catch (error) {
            logger.error('Error during onboarding submission', { code: isApiError(error) ? error.code : 'UNKNOWN' });
            Alert.alert(
                'Error',
                isApiError(error)
                    ? error.message
                    : error instanceof Error && error.message
                        ? error.message
                        : 'Failed to save your information. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    /**
     * POST /api/stripe/connect/onboarding (creates the Express account if needed),
     * opens the link in the browser, then reads GET /api/stripe/connect/status
     * once the website sends the barber back with the bocm://stripe-connect link.
     */
    const handleStripeConnect = async () => {
        if (stripeLoading) return;
        setStripeLoading(true);
        try {
            const current = await fetchConnectStatus();
            if (isStripeReady(current)) {
                setFormData(prev => ({ ...prev, stripeConnected: true }));
                setStripeStatus('active');
                Alert.alert('Stripe Account Active', 'Your Stripe account is already active and ready to accept payments!');
                return;
            }

            const { status, needsNewLink } = await openStripeConnect('onboarding');
            if (isStripeReady(status)) {
                setFormData(prev => ({ ...prev, stripeConnected: true }));
                setStripeStatus('active');
                Alert.alert(
                    'Payment Setup Complete!',
                    'Your Stripe account has been connected. You can now receive payments.'
                );
            } else {
                setStripeStatus(status?.hasAccount ? 'pending' : null);
                Alert.alert(
                    'Setup In Progress',
                    needsNewLink
                        ? 'The setup link expired. Tap Connect again to continue where you left off.'
                        : 'Your Stripe setup is not finished yet. You can complete it now or later in your settings.'
                );
            }
        } catch (error) {
            logger.error('Error connecting Stripe', { code: isApiError(error) ? error.code : 'UNKNOWN' });
            Alert.alert('Error', errorMessage(error, 'Failed to connect Stripe account. Please try again.'));
        } finally {
            setStripeLoading(false);
        }
    };

    const handleSkip = async () => {
        Alert.alert(
            'Skip Payment Setup?',
            'You can always set up payments later in your settings. Are you sure you want to skip this step?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Skip',
                    style: 'destructive',
                    onPress: () => {
                        setFormData(prev => ({ ...prev, stripeConnected: false }));
                        handleSubmit();
                    }
                }
            ]
        );
    };

    const getProgressPercentage = () => {
        // If Stripe is connected, show 100% completion
        if (formData.stripeConnected) {
            return 100;
        }
        // Otherwise, calculate based on current step
        return ((currentStep + 1) / steps.length) * 100;
    };

    const renderStep = () => {
        const step = steps[currentStep];
        const Icon = step.icon;

        switch (step.id) {
            case 'business':
                return (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-32`}>
                        {/* Business Information */}
                        <Card style={[tw`mb-6`, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
                            <CardContent style={tw`p-4`}>
                                <SectionHeader
                                    title="Business Information"
                                    icon={Info}
                                />

                                <OnboardingInputField
                                    label="Business Name *"
                                    value={formData.businessName}
                                    onChangeText={(text: string) => handleChange('businessName', text)}
                                    placeholder="Enter your business name"
                                    icon={Building}
                                    error={validationErrors.businessName}
                                />

                                <OnboardingInputField
                                    label="Phone Number *"
                                    value={formData.phone}
                                    onChangeText={(text: string) => {
                                        if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);
                                        handleChange('phone', text);
                                        phoneDebounceRef.current = setTimeout(() => {
                                            const formatted = formatPhoneNumber(text);
                                            handleChange('phone', formatted);
                                        }, 300);
                                    }}
                                    placeholder="(555) 123-4567"
                                    keyboardType="phone-pad"
                                    icon={Phone}
                                    error={validationErrors.phone}
                                />

                                <View style={tw`mb-4`}>
                                    <View style={tw`flex-row items-center mb-2`}>
                                        <MapPin size={16} color={colors.primary} style={tw`mr-2`} />
                                        <Text style={[tw`text-sm font-medium`, { color: colors.foreground }]}>
                                            Location *
                                        </Text>
                                    </View>
                                    <LocationInput
                                        value={formData.location}
                                        onChange={(value: string) => handleChange('location', value)}
                                        placeholder="Enter your business location..."
                                        error={validationErrors.location}
                                    />
                                </View>

                                <OnboardingInputField
                                    label="Bio *"
                                    value={formData.bio}
                                    onChangeText={(text: string) => handleChange('bio', text)}
                                    placeholder="Tell us about your business, experience, and what makes you unique..."
                                    multiline
                                    error={validationErrors.bio}
                                    description={`${formData.bio.length}/500 characters`}
                                />
                            </CardContent>
                        </Card>

                        {/* Specialties */}
                        <Card style={[tw`mb-6`, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
                            <CardContent style={tw`p-4`}>
                                <SectionHeader
                                    title="Specialties"
                                    icon={Sparkles}
                                />

                                <View style={tw`mb-4`}>
                                    <Text style={[tw`text-sm font-medium mb-2`, { color: colors.foreground }]}>
                                        Select your specialties *
                                    </Text>
                                    <SpecialtyAutocomplete
                                        value={formData.specialties}
                                        onChange={handleSpecialtiesChange}
                                        placeholder="Select your specialties..."
                                        maxSelections={15}
                                    />
                                    <Text style={[tw`text-xs mt-2`, { color: colors.mutedForeground }]}>
                                        List your specialties to help clients find you
                                    </Text>
                                    {validationErrors.specialties && (
                                        <Text style={[tw`text-xs mt-1`, { color: colors.destructive }]}>
                                            {validationErrors.specialties}
                                        </Text>
                                    )}
                                </View>
                            </CardContent>
                        </Card>

                        {/* Social Media */}
                        <Card style={[tw`mb-6`, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
                            <CardContent style={tw`p-4`}>
                                <SectionHeader
                                    title="Social Media (Optional)"
                                    icon={Instagram}
                                    description="Add your social media handles to help clients connect with you"
                                />

                                <View style={tw`space-y-4`}>
                                    <OnboardingInputField
                                        label="Instagram"
                                        value={formData.socialMedia.instagram}
                                        onChangeText={(text: string) => handleSocialMediaUpdate({
                                            ...formData.socialMedia,
                                            instagram: text
                                        })}
                                        placeholder="@yourusername"
                                        description="Only your handle (e.g., @yourusername)"
                                    />

                                    <OnboardingInputField
                                        label="TikTok"
                                        value={formData.socialMedia.tiktok}
                                        onChangeText={(text: string) => handleSocialMediaUpdate({
                                            ...formData.socialMedia,
                                            tiktok: text
                                        })}
                                        placeholder="@yourusername"
                                        description="Only your handle (e.g., @yourusername)"
                                    />
                                </View>
                            </CardContent>
                        </Card>
                    </ScrollView>
                );

            case 'services':
                return (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-32`}>
                        <Card style={[tw`mb-6`, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
                            <CardContent style={tw`p-4`}>
                                <SectionHeader
                                    title="Services & Pricing"
                                    icon={Scissors}
                                    description="Set up your services and pricing to start accepting bookings"
                                />

                                <View style={tw`space-y-6`}>
                                    {formData.services.map((service, index) => (
                                        <View key={index} style={[
                                            tw`p-4 rounded-xl`,
                                            { backgroundColor: colors.glass }
                                        ]}>
                                            <View style={tw`flex-row items-center justify-between mb-4`}>
                                                <View style={tw`flex-row items-center`}>
                                                    <View style={[
                                                        tw`w-8 h-8 rounded-lg items-center justify-center mr-3`,
                                                        { backgroundColor: colors.glass }
                                                    ]}>
                                                        <Text style={[tw`text-sm font-bold`, { color: colors.primary }]}>
                                                            {index + 1}
                                                        </Text>
                                                    </View>
                                                    <Text style={[tw`text-base font-semibold`, { color: colors.foreground }]}>
                                                        Service {index + 1}
                                                    </Text>
                                                </View>
                                                {formData.services.length > 1 && (
                                                    <TouchableOpacity
                                                        onPress={() => removeService(index)}
                                                        style={[
                                                            tw`p-2 rounded-lg`,
                                                            { backgroundColor: colors.destructiveSubtle }
                                                        ]}
                                                    >
                                                        <Trash2 size={16} color={colors.destructive} />
                                                    </TouchableOpacity>
                                                )}
                                            </View>

                                            <OnboardingInputField
                                                label="Service Name *"
                                                value={service.name}
                                                onChangeText={(text: string) => handleServiceChange(index, 'name', text)}
                                                placeholder="e.g., Haircut, Beard Trim, Fade"
                                                error={validationErrors[`services.${index}.name`]}
                                            />

                                            <View style={tw`flex-row gap-4`}>
                                                <NumericInput
                                                    label="Price ($) *"
                                                    value={service.price}
                                                    onChangeText={(value) => handleServiceChange(index, 'price', value)}
                                                    prefix="$"
                                                    placeholder="30"
                                                    error={validationErrors[`services.${index}.price`]}
                                                />
                                                <NumericInput
                                                    label="Duration (min) *"
                                                    value={service.duration}
                                                    onChangeText={(value) => handleServiceChange(index, 'duration', value)}
                                                    suffix="min"
                                                    placeholder="30"
                                                    error={validationErrors[`services.${index}.duration`]}
                                                />
                                            </View>
                                        </View>
                                    ))}
                                    
                                    <TouchableOpacity
                                        onPress={addService}
                                        style={[
                                            tw`flex-row items-center justify-center p-4 rounded-xl border-2 border-dashed`,
                                            { borderColor: colors.glassBorder, backgroundColor: 'transparent' }
                                        ]}
                                    >
                                        <View style={[
                                            tw`w-8 h-8 rounded-lg items-center justify-center mr-3`,
                                            { backgroundColor: colors.glass }
                                        ]}>
                                            <Plus size={16} color={colors.primary} />
                                        </View>
                                        <Text style={[tw`font-semibold text-base`, { color: colors.primary }]}>
                                            Add Another Service
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </CardContent>
                        </Card>
                    </ScrollView>
                );

            case 'stripe':
                return (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-32`}>
                        <Card style={[tw`mb-6`, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
                            <CardContent style={tw`p-4`}>
                                <SectionHeader
                                    title="Payment Setup"
                                    icon={CreditCard}
                                    description="Connect your Stripe account to start accepting payments"
                                />

                                <View style={[
                                    tw`p-4 rounded-xl`,
                                    { backgroundColor: colors.glass }
                                ]}>
                                    <View style={tw`flex-row items-center mb-4`}>
                                        <View style={[
                                            tw`w-12 h-12 rounded-xl items-center justify-center mr-4`,
                                            { backgroundColor: colors.glass }
                                        ]}>
                                            <CreditCard size={24} color={colors.primary} />
                                        </View>
                                        <View style={tw`flex-1`}>
                                            <Text style={[tw`text-lg font-bold`, { color: colors.foreground }]}>
                                                Stripe Connect
                                            </Text>
                                            <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>
                                                Secure payment processing
                                            </Text>
                                        </View>
                                    </View>
                                    
                                    <View style={tw`space-y-3 mb-6`}>
                                        <View style={tw`flex-row items-start`}>
                                            <View style={[
                                                tw`w-6 h-6 rounded-full items-center justify-center mr-3 mt-0.5`,
                                                { backgroundColor: colors.successSubtle }
                                            ]}>
                                                <Text style={[tw`text-xs font-bold`, { color: colors.success }]}>✓</Text>
                                            </View>
                                            <Text style={[tw`text-sm flex-1`, { color: colors.foreground }]}>
                                                Accept credit card and digital wallet payments
                                            </Text>
                                        </View>
                                        
                                        <View style={tw`flex-row items-start`}>
                                            <View style={[
                                                tw`w-6 h-6 rounded-full items-center justify-center mr-3 mt-0.5`,
                                                { backgroundColor: colors.successSubtle }
                                            ]}>
                                                <Text style={[tw`text-xs font-bold`, { color: colors.success }]}>✓</Text>
                                            </View>
                                            <Text style={[tw`text-sm flex-1`, { color: colors.foreground }]}>
                                                Automatic payouts to your bank account
                                            </Text>
                                        </View>
                                        
                                        <View style={tw`flex-row items-start`}>
                                            <View style={[
                                                tw`w-6 h-6 rounded-full items-center justify-center mr-3 mt-0.5`,
                                                { backgroundColor: colors.successSubtle }
                                            ]}>
                                                <Text style={[tw`text-xs font-bold`, { color: colors.success }]}>✓</Text>
                                            </View>
                                            <Text style={[tw`text-sm flex-1`, { color: colors.foreground }]}>
                                                Industry-leading security and fraud protection
                                            </Text>
                                        </View>
                                    </View>
                                    
                                    <TouchableOpacity
                                        onPress={handleStripeConnect}
                                        disabled={stripeLoading}
                                        style={[
                                            tw`flex-row items-center justify-center py-3 px-6 rounded-xl`,
                                            { backgroundColor: colors.primary },
                                            stripeLoading && { opacity: 0.6 }
                                        ]}
                                    >
                                        {stripeLoading ? (
                                            <ActivityIndicator color={colors.primaryForeground} />
                                        ) : (
                                            <>
                                                <CreditCard size={20} color={colors.primaryForeground} style={tw`mr-3`} />
                                                <Text style={[tw`font-semibold text-base`, { color: colors.primaryForeground }]}>
                                                    Connect Stripe Account
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                                
                                {/* Skip Option */}
                                <View style={[
                                    tw`p-4 rounded-xl mt-4`,
                                    { backgroundColor: colors.glass }
                                ]}>
                                    <Text style={[tw`text-sm text-center`, { color: colors.mutedForeground }]}>
                                        You can always set up payments later in your settings
                                    </Text>
                                </View>
                            </CardContent>
                        </Card>
                    </ScrollView>
                );

            default:
                return null;
        }
    };

    return (
        <SafeAreaView style={[tw`flex-1`, { backgroundColor: colors.background }]}>
            <StatusBar barStyle="light-content" />
            
            {/* Header */}
            <View style={tw`px-6 pt-6 pb-4`}>
                <View style={tw`items-center mb-6`}>
                    <View style={[tw`p-4 rounded-full mb-3`, { backgroundColor: colors.primary + '20' }]}>
                        {React.createElement(steps[currentStep].icon, { 
                            size: 32, 
                            color: colors.primary 
                        })}
                    </View>
                    <Text style={[tw`text-2xl font-bold`, { color: colors.foreground }]}>
                        {steps[currentStep].title}
                    </Text>
                    <Text style={[tw`text-sm mt-1`, { color: colors.mutedForeground }]}>
                        {steps[currentStep].description}
                    </Text>
                </View>
            </View>

            {/* Progress Section */}
            <View style={tw`px-6 mb-6`}>
                <ProgressIndicator
                    steps={steps}
                    currentStep={currentStep}
                    progressPercentage={getProgressPercentage()}
                />
            </View>

            {/* Onboarding Complete Banner */}
            {onboardingComplete && showCompleteBanner && (
                <View style={tw`px-6 mb-6`}>
                    <Card style={[{ backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
                        <CardContent style={tw`p-4`}>
                            <View style={tw`flex-row items-center justify-between mb-2`}>
                                <View style={tw`flex-row items-center`}>
                                    <CheckCircle size={16} color={colors.primary} style={tw`mr-2`} />
                                    <Text style={[tw`text-sm font-semibold`, { color: colors.foreground }]}>
                                        Onboarding Complete!
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setShowCompleteBanner(false)}
                                >
                                    <X size={16} color={colors.mutedForeground} />
                                </TouchableOpacity>
                            </View>
                            <Text style={[tw`text-xs`, { color: colors.mutedForeground }]}>
                                Your profile is ready. You can now receive bookings and payments. Welcome to the platform!
                            </Text>
                            <Button
                                variant="secondary"
                                onPress={() => navigation.navigate('MainTabs' as any)}
                                style={tw`mt-3 rounded-xl`}
                                size="sm"
                            >
                                Go to Profile
                            </Button>
                        </CardContent>
                    </Card>
                </View>
            )}

            {/* Main Content - Takes up most of the space */}
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={tw`flex-1`}
            >
                <View style={tw`px-6 flex-1`}>
                    {renderStep()}
                </View>
            </KeyboardAvoidingView>

            {/* Navigation Buttons */}
            <View style={[tw`px-6 py-3 border-t`, { borderColor: colors.glassBorder }]}>
                <View style={tw`flex-row justify-between items-center gap-3`}>
                    <Button
                        variant="outline"
                        onPress={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                        disabled={currentStep === 0}
                        style={[
                            tw`flex-1 rounded-xl`,
                            { borderColor: colors.primary, opacity: currentStep === 0 ? 0.5 : 1 }
                        ]}
                        textStyle={{ color: colors.primary }}
                    >
                        Back
                    </Button>
                    
                    <TouchableOpacity
                        style={[
                            tw`rounded-xl px-6 py-2.5 flex-1 flex-row items-center justify-center`,
                            { backgroundColor: colors.primary, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
                            loading && { opacity: 0.6 }
                        ]}
                        onPress={async () => {
                            if (await validateStep(currentStep)) {
                                if (currentStep < steps.length - 1) {
                                    setCurrentStep((prev) => prev + 1)
                                } else {
                                    handleSubmit()
                                }
                            } else {
                                Alert.alert('Validation Error', 'Please fix the errors before continuing.');
                            }
                        }}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={colors.primaryForeground} />
                        ) : (
                            <Text style={[tw`text-base font-bold text-center`, { color: colors.primaryForeground }]}>
                                {currentStep < steps.length - 1 ? 'Next' : 'Finish'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}