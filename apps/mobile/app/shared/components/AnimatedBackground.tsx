import React, { useEffect, useRef } from 'react';
import { View, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../lib/theme';
import { useTheme } from './theme/ThemeProvider';

const { width, height } = Dimensions.get('window');

interface ParticleProps {
  delay: number;
  duration: number;
  startX: number;
  startY: number;
  size: number;
  primaryColor: string;
}

const Particle: React.FC<ParticleProps> = ({ delay, duration, startX, startY, size, primaryColor }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Speed up particle animation by reducing duration
    const fastDuration = duration * 0.5; 
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: fastDuration,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: fastDuration,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [duration]);

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -100],
  });

  const translateX = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, Math.random() * 50 - 25, 0],
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.8, 0],
  });

  const scale = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1, 0],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: primaryColor,
        left: startX,
        top: startY,
        transform: [{ translateY }, { translateX }, { scale }],
        opacity,
      }}
    />
  );
};

const LargeFloatingElement: React.FC<{ delay: number; index: number; primarySoftColor: string }> = ({ delay, index, primarySoftColor }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Speed up floating elements by 50%
    const baseDuration = (10000 + index * 2000) * 0.5;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: baseDuration,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: baseDuration,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, []);

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -30],
  });

  const scale = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.2, 1],
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.6, 0.3],
  });

  const size = Math.random() * 20 + 10;
  const left = 20 + index * 30;
  const top = 20 + index * 25;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: primarySoftColor,
        left: `${left}%`,
        top: `${top}%`,
        transform: [{ translateY }, { scale }],
        opacity,
      }}
    />
  );
};

export const AnimatedBackground: React.FC = () => {
  const { colors, colorScheme } = useTheme();
  const backgroundOpacity = useRef(new Animated.Value(0)).current;

  const gradientColors = colorScheme === 'dark' ? theme.gradients.backgroundDark : theme.gradients.background;
  const overlayColors: [string, string] = ['transparent', colors.glass];

  useEffect(() => {
    Animated.timing(backgroundOpacity, {
      toValue: 1,
      duration: theme.animations.timing.BACKGROUND_FADE,
      useNativeDriver: false,
    }).start();
  }, []);

  // Generate particles - faster durations
  const particles = Array.from({ length: 8 }, (_, i) => ({
    delay: Math.random() * 2500, // Reduced from 5000
    duration: (Math.random() * 8000 + 6000) * 0.5, // 50% faster
    startX: Math.random() * width,
    startY: Math.random() * height,
    size: Math.random() * 4 + 2,
  }));

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Base gradient background - theme-aware */}
      <Animated.View style={{ flex: 1, opacity: backgroundOpacity }}>
        <LinearGradient
          colors={gradientColors}
          style={{ flex: 1 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      </Animated.View>

      {/* Radial gradient overlays - Talii orange tints matching web */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <LinearGradient
          colors={['rgba(238, 109, 35, 0.12)', 'transparent']} // Talii orange #EE6D23 with opacity
          style={{
            position: 'absolute',
            width: 200,
            height: 200,
            borderRadius: theme.borderRadius.full,
            top: '80%',
            left: '20%',
          }}
        />
        <LinearGradient
          colors={['rgba(238, 109, 35, 0.08)', 'transparent']} // Talii orange #EE6D23 with opacity
          style={{
            position: 'absolute',
            width: 200,
            height: 200,
            borderRadius: theme.borderRadius.full,
            top: '20%',
            left: '80%',
          }}
        />
      </View>

      {/* Floating particles */}
      {particles.map((particle, index) => (
        <Particle key={index} {...particle} primaryColor={colors.primary} />
      ))}

      {/* Larger floating elements */}
      {Array.from({ length: 3 }, (_, index) => (
        <LargeFloatingElement
          key={`large-${index}`}
          delay={index * 2000}
          index={index}
          primarySoftColor={theme.gradients.glow[1]}
        />
      ))}

      {/* Subtle overlay for depth - theme-aware */}
      <LinearGradient
        colors={overlayColors}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
    </View>
  );
};
