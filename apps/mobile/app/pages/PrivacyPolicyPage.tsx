import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Shield } from 'lucide-react-native';
import { useTheme } from '../shared/components/theme';
import { theme } from '../shared/lib/theme';
import { AnimatedBackground } from '../shared/components/AnimatedBackground';

const privacyPolicy = `TALII PRIVACY POLICY

Effective Date: December 2025 • Last Updated: April 2026

Welcome to Talii. We respect your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application, website, and related services (collectively, the "Services").

By using our Services, you agree to the collection and use of information in accordance with this Privacy Policy. If you do not agree with our policies and practices, do not use our Services. This policy applies to all users (Clients and Professionals).

1. WHAT DATA WE COLLECT AND WHY
App Store guidelines require us to be transparent about what data we collect. Here is exactly what we collect:

1.1 Information You Provide to Us (Account & Profile Data)
• Account Registration: Name, email address, phone number, and password (encrypted and never accessible to us). We use this to secure your account and communicate with you.
• Profile Information: Profile photos, cover photos, bio, social media links, and location. We use this to display your profile in our marketplace.
• Booking Information: Service preferences, appointment history, and special requests.

1.2 Data From Device Permissions (Camera, Photos, & Location)
• Camera & Photos: If you choose to upload an avatar, cover photo, or portfolio image, we require access to your device's Camera or Photo Library. This data is only uploaded when you explicitly select it. We do not scan or collect photos you do not select.
• Location Data: We use Precise Location (with your permission) to help you find nearby barbers and to facilitate on-demand bookings. You can decline this permission at any time via your device settings, though distance-based search features will be disabled.

1.3 Automated Technical Data
• Device Information: Device type, OS version, and network identifiers. We use this to debug crashes and optimize the app.
• Diagnostic Data: If the app crashes, we securely collect error logs via Sentry. This data does not contain personally identifiable information unless strictly necessary for debugging.

2. HOW WE USE YOUR INFORMATION
We collect and use your data strictly for the following purposes:
• Service Delivery: To connect Clients with Professionals and process bookings.
• Account Management: To authenticate you and secure your data.
• Payment Processing: Payments are securely handled by Stripe. We do not view or store your full credit card details.
• Safety & Security: To monitor for fraudulent activity or abuse of our platform.

3. HOW WE SHARE YOUR INFORMATION
Talii does NOT sell your personal data to data brokers or advertising platforms.

We only share data with the following trusted third parties necessary to operate our app:
• Other Users: When a Client books a Professional, the Professional receives the Client's name and contact information to fulfill the appointment.
• Service Providers: Stripe (for processing payments), Supabase (our secure database and authentication provider), and Sentry (for crash reporting).

4. DATA RETENTION AND ACCOUNT DELETION
You have full control over your data.

• Data Retention: We retain your account data only for as long as your account is active or as needed to provide you with the Services.
• Account Deletion: You may delete your account at any time directly through the Talii App (Settings > Delete Account) or by emailing us. When you delete your account, we immediately initiate the permanent deletion of your profile, bookings, and uploaded photos from our active databases.

5. CHILDREN'S PRIVACY
Our Services strictly require users to be at least 13 years of age. We do not knowingly collect personal data from children. If you become aware that a child has provided us with personal information, please contact us immediately.

6. CONTACT US
If you have any questions, concerns, or requests regarding this Privacy Policy or how your data is handled, please contact our privacy team at:
Email: support@talii.com`;

export default function PrivacyPolicyPage() {
  const { theme, colors, colorScheme } = useTheme();
  const navigation = useNavigation();

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
            <Shield size={40} color={colors.primary} />
          </View>
          
          <Text style={{
            fontSize: 32,
            fontFamily: theme.typography.fontFamily.bebas[0],
            color: colors.primary,
            textAlign: 'center',
            marginBottom: 12,
          }}>
            Privacy Policy
          </Text>
          
          <Text style={{
            fontSize: 16,
            color: colors.mutedForeground,
            textAlign: 'center',
          }}>
            How we collect, use, and protect your data
          </Text>
        </View>

        {/* Privacy Policy Content */}
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
                {privacyPolicy}
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
          }}>
            Your privacy is important to us
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

