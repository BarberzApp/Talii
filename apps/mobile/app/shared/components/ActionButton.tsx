import React, { useRef } from 'react';
import { TouchableOpacity, Text, Animated, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ArrowRight } from 'lucide-react-native';
import { theme } from '../lib/theme';
import { useTheme } from './theme/ThemeProvider';

interface ActionButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'tertiary';
  onPress?: () => void;
  icon?: boolean;
  style?: any;
  disabled?: boolean;
}

export const ActionButton: React.FC<ActionButtonProps> = ({ 
  children, 
  variant = 'primary', 
  onPress, 
  icon = false,
  style = {},
  disabled = false,
}) => {
  const { colors } = useTheme();
  const scaleValue = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isTertiary = variant === 'tertiary';

  const handlePressIn = () => {
    if (disabled) return;
    
    Animated.parallel([
      Animated.timing(scaleValue, {
        toValue: 0.98,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();

    if (isPrimary) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    if (disabled) return;
    
    Animated.parallel([
      Animated.spring(scaleValue, {
        toValue: 1,
        ...theme.animations.spring.MEDIUM,
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handlePress = () => {
    if (disabled || !onPress) return;
    onPress();
  };

  return (
    <TouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      activeOpacity={disabled ? 1 : 1}
      style={[
        {
          width: '100%',
          height: 56,
          borderRadius: theme.borderRadius['3xl'],
          overflow: 'hidden',
          marginBottom: 16,
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          flex: 1,
          transform: [{ scale: scaleValue }],
        }}
      >
        {isPrimary ? (
          // Primary button with gradient
          <LinearGradient
            colors={theme.gradients.button}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              flexDirection: 'row',
              paddingHorizontal: 24,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 8,
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: '600',
                color: colors.primaryForeground,
                marginRight: icon ? 12 : 0,
              }}
            >
              {children}
            </Text>
            {icon && (
              <Animated.View
                style={{
                  transform: [{
                    translateX: glowOpacity.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 4],
                    }),
                  }],
                }}
              >
                <ArrowRight size={24} color={colors.primaryForeground} />
              </Animated.View>
            )}
          </LinearGradient>
        ) : isSecondary ? (
          // Secondary button with glass effect
          <View style={{ flex: 1, borderRadius: theme.borderRadius['3xl'], overflow: 'hidden' }}>
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                flexDirection: 'row',
                paddingHorizontal: 24,
                borderWidth: 2,
                borderColor: colors.primary,
                borderRadius: theme.borderRadius['3xl'],
                backgroundColor: colors.muted,
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '600',
                  color: colors.primary,
                  marginRight: icon ? 12 : 0,
                }}
              >
                {children}
              </Text>
              {icon && (
                <Animated.View
                  style={{
                    transform: [{
                      translateX: glowOpacity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 4],
                      }),
                    }],
                  }}
                >
                  <ArrowRight size={24} color={colors.primary} />
                </Animated.View>
              )}
            </View>
          </View>
        ) : (
          // Tertiary button for subtle actions like "Continue as guest"
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 24,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: '500',
                color: colors.mutedForeground,
                textDecorationLine: 'underline',
              }}
            >
              {children}
            </Text>
          </View>
        )}

        {/* Glow effect for primary button */}
        {isPrimary && (
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: theme.borderRadius['3xl'],
              backgroundColor: colors.primary,
              opacity: glowOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.2],
              }),
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: glowOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.5],
              }),
              shadowRadius: 20,
              elevation: glowOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 16],
              }),
            }}
          />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};
