import React, { useState, useEffect } from 'react';
import {
  View,
  SafeAreaView,
  StatusBar,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Sun, Moon } from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../shared/components/theme';
import { AnimatedBackground } from '../shared/components/AnimatedBackground';
import { AnimatedLogo } from '../shared/components/AnimatedLogo';
import { AnimatedText } from '../shared/components/AnimatedText';
import { ActionButton } from '../shared/components/ActionButton';
import type { RootStackParamList } from '../shared/types';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomePage() {
  const { colors, colorScheme, themePreference, setColorScheme } = useTheme();
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [showContent, setShowContent] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  const [showSocialProof, setShowSocialProof] = useState(false);
  const homestring = 'Built to Help';
  const homestring2 = 'You Earn More';
  useEffect(() => {
    // Staggered content appearance - sped up
    const contentTimer = setTimeout(() => setShowContent(true), 200); // Reduced from 500
    const buttonsTimer = setTimeout(() => setShowButtons(true), 1200); // Reduced from 2500
    const socialProofTimer = setTimeout(() => setShowSocialProof(true), 1500); // Reduced from 3000

    return () => {
      clearTimeout(contentTimer);
      clearTimeout(buttonsTimer);
      clearTimeout(socialProofTimer);
    };
  }, []);

  const handleGetStarted = () => {
    navigation.navigate('SignUp' as never);
  };

  const handleLogin = () => {
    navigation.navigate('Login' as never);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      
      {/* Theme toggle - quick access */}
      <TouchableOpacity
        onPress={() => setColorScheme(themePreference === 'dark' ? 'light' : 'dark')}
        style={{
          position: 'absolute',
          top: 60,
          right: 20,
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
        {colorScheme === 'dark' ? (
          <Sun size={22} color={colors.foreground} />
        ) : (
          <Moon size={22} color={colors.foreground} />
        )}
      </TouchableOpacity>

      {/* Animated Background */}
      <AnimatedBackground />
      
      {/* Main Content Container */}
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        paddingHorizontal: 20, // 16-20px per spec §5.2
        paddingTop: 64, // 48-64px from safe area per spec §5.2
        paddingBottom: 24,
      }}>
        
        {/* Logo Section */}
        <View style={{ marginBottom: 48, alignItems: 'center' }}>
          <AnimatedLogo />
        </View>

        {/* Text Content */}
        {showContent && (
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
            <View style={{ marginBottom: 24, alignItems: 'center' }}>
              <AnimatedText
                text={homestring}
                type="title"
                delay={200}
              />
              <AnimatedText
                text={homestring2}
                type="title"
                delay={600}
              />
            </View>
            
            {/* Trust badge/proof text */}
            <View style={{ marginTop: 16 }}>
              <AnimatedText
                text='Everything You Need to Scale'
                type="welcome"
                delay={300}
              />
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {showButtons && (
          <View style={{ width: '100%', marginBottom: 48 }}>
            <ActionButton 
              variant="primary" 
              icon
              onPress={handleGetStarted}
            >
              Start Your Journey
            </ActionButton>
            
            <ActionButton 
              variant="secondary"
              onPress={handleLogin}
            >
              Log In
            </ActionButton>

            <ActionButton 
              variant="tertiary"
              onPress={() => navigation.navigate('GuestBrowse' as never)}>
              Continue as Guest
            </ActionButton>
          </View>
        )}

        {/* Footer */}
        <View style={{ 
          position: 'absolute', 
          bottom: 24, 
          left: 0, 
          right: 0, 
          alignItems: 'center',
          paddingHorizontal: 32,
        }}>
          <View style={{
            paddingVertical: 16,
            paddingHorizontal: 24,
            borderRadius: 16,
            backgroundColor: colors.muted,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            <Animated.Text
              style={{
                fontSize: 12,
                color: colors.mutedForeground,
                textAlign: 'center',
                marginBottom: 4,
                fontWeight: '500',
              }}
            >
              Talii
            </Animated.Text>
            <Animated.Text
              style={{
                fontSize: 10,
                color: colors.mutedForeground,
                textAlign: 'center',
              }}
            >
              © 2025 Talii. All rights reserved.
            </Animated.Text>
            <Animated.Text
              style={{
                fontSize: 10,
                color: colors.mutedForeground,
                textAlign: 'center',
                marginTop: 4,
              }}
            >
              The future of booking.
            </Animated.Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}