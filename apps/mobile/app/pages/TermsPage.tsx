import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, FileText } from 'lucide-react-native';
import { useTheme } from '../shared/components/theme';
import { theme } from '../shared/lib/theme';
import { AnimatedBackground } from '../shared/components/AnimatedBackground';
import { RootStackParamList } from '../shared/types';

const terms = `TALII TERMS OF SERVICE

Effective Date: July 7, 2025 • Last Updated: April 1, 2026

OVERVIEW
Welcome to Talii. These Terms of Service ("Terms") govern your access to and use of the Talii website, mobile application, and all associated services (collectively, the "Services").

By using our Services, you agree to be bound by these Terms, our Privacy Policy, and all applicable laws and regulations. If you do not agree, do not use the Services.

OUR SERVICES
Talii is a digital marketplace that connects clients seeking beauty and barbering services ("Clients") with independent cosmetologists and barbers ("Professionals"). Talii provides the digital infrastructure for booking, service management, payment processing, and content discovery but does not directly offer any hair or beauty services.

For Clients:
• Discover top-rated barbers via location-based search.
• Book services instantly with real-time availability.
• Securely pay for services via Stripe integration.
• Manage booking history and leave reviews.

For Professionals:
• Create professional portfolios with images and videos.
• Custom scheduling with conflict detection.
• Detailed revenue tracking and business insights.
• Access to over 100 specialty tags for discovery.

SAFETY & LIABILITY
Important Notice
Talii is not liable for any damages, losses, injuries, or claims arising out of the actions or omissions of any Professional or Client. We do not verify the licensing status of Professionals. Clients are solely responsible for ensuring that their selected Professional holds any licenses required by law.

By using Talii, you acknowledge that private appointments carry inherent risks and you are solely responsible for your safety and actions.

GOVERNING LAW
These Terms are governed by the laws of the State of New Jersey, without regard to its conflict of law rules. Any disputes must be resolved in the courts of New Jersey or through binding arbitration if mutually agreed.

CONTACT US
For questions or concerns regarding these Terms, please contact us at:
Email: support@talii.com`;

type TermsNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function TermsPage() {
  const { theme, colors, colorScheme } = useTheme();
  const navigation = useNavigation<TermsNavigationProp>();

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
      <TouchableOpacity
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
      </TouchableOpacity>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 32, paddingVertical: 100, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View style={{
            width: 80,
            height: 80,
            borderRadius: theme.borderRadius.full,
            backgroundColor: colors.muted,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 24,
          }}>
            <FileText size={40} color={colors.primary} />
          </View>
          
          <Text style={{
            fontSize: 32,
            fontFamily: theme.typography.fontFamily.bebas[0],
            color: colors.primary,
            textAlign: 'center',
            marginBottom: 12,
          }}>
            Terms & Conditions
          </Text>
          
          <Text style={{
            fontSize: 16,
            color: colors.mutedForeground,
            textAlign: 'center',
          }}>
            Please read these terms carefully
          </Text>
        </View>

        {/* Terms Content */}
        <View style={{
          borderRadius: theme.borderRadius['3xl'],
          overflow: 'hidden',
        }}>
          <View
            style={{
              padding: 32,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 600 }}
            >
              <Text style={{
                fontSize: 14,
                lineHeight: 22,
                color: colors.foreground,
                textAlign: 'left',
              }}>
                {terms}
              </Text>
            </ScrollView>
          </View>
        </View>

        {/* Footer */}
        <View style={{ alignItems: 'center', marginTop: 32 }}>
          <Text style={{
            fontSize: 12,
            color: colors.mutedForeground,
            textAlign: 'center',
            marginBottom: 16,
          }}>
            By using BOCM, you agree to these terms and conditions
          </Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate('PrivacyPolicy');
            }}
          >
            <Text style={{
              fontSize: 14,
              color: colors.primary,
              textDecorationLine: 'underline',
              fontWeight: '600',
            }}>
              View Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
} 