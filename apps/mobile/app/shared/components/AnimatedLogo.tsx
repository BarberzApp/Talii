import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Image } from 'react-native';
import { theme } from '../lib/theme';
import { useTheme } from './theme/ThemeProvider';

const logoLight = require('../../../assets/brand/talii-logo.png');
const logoDark = require('../../../assets/brand/talii-logo-dark.png');

interface SparkleProps {
  delay: number;
  top: number;
  left: number;
  primaryColor: string;
}

const Sparkle: React.FC<SparkleProps> = ({ delay, top, left, primaryColor }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1500, // Reduced from 3000
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1500, // Reduced from 3000
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, []);

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 10],
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1, 0],
  });

  const scale = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1, 0],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: primaryColor,
        top: `${top}%`,
        left: `${left}%`,
        transform: [{ translateY }, { scale }],
        opacity,
      }}
    />
  );
};

export const AnimatedLogo: React.FC = () => {
  const { colors, colorScheme } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const scaleValue = useRef(new Animated.Value(0)).current;
  const opacityValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 200); // Reduced from 500
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isVisible) {
      // Logo entrance animation
      Animated.parallel([
        Animated.spring(scaleValue, {
          toValue: 1,
          ...theme.animations.spring.BOUNCE,
          useNativeDriver: true,
        }),
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: theme.animations.timing.LOGO_ENTRANCE,
          useNativeDriver: true,
        }),
      ]).start();

      // Continuous pulse animation - sped up
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1,
            duration: 1000, // Reduced from 2000
            useNativeDriver: true,
          }),
          Animated.timing(pulseValue, {
            toValue: 0,
            duration: 1000, // Reduced from 2000
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isVisible]);

  const pulse = pulseValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleValue }, { scale: pulse }],
        opacity: opacityValue,
      }}
    >
      {/* Logo container */}
      <View style={{ position: 'relative', width: 120, height: 120 }}>
        {/* Logo content */}
        <View
          style={{
            width: '100%',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Image
            source={colorScheme === 'dark' ? logoDark : logoLight}
            style={{
              width: 96, // 72-96px per spec §2.3
              height: 96,
              resizeMode: 'contain',
            }}
          />
        </View>

        {/* Floating sparkles */}
        <Sparkle delay={0} top={20} left={15} primaryColor={colors.primary} />
        <Sparkle delay={500} top={45} left={40} primaryColor={colors.primary} />
        <Sparkle delay={1000} top={70} left={65} primaryColor={colors.primary} />
      </View>
    </Animated.View>
  );
};
