import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import { theme } from '../lib/theme';
import { useTheme } from './theme/ThemeProvider';
import type { ResolvedColors } from '../lib/theme';

interface AnimatedTextProps {
  text: string;
  type?: 'welcome' | 'title' | 'tagline';
  delay?: number;
  style?: any;
}

const getTypeStyles = (type: string, colors: ResolvedColors) => {
  switch (type) {
    case 'title':
      return {
        fontSize: 36,
        fontFamily: theme.typography.fontFamily.bebas[0],
        letterSpacing: -0.5,
        lineHeight: 40,
        textAlign: 'center' as const,
        color: colors.primary,
        fontWeight: '600' as const,
      };
    case 'welcome':
      return {
        fontSize: 16,
        fontWeight: '500' as const,
        color: colors.mutedForeground,
        letterSpacing: 0.1,
        textAlign: 'center' as const,
        lineHeight: 22,
      };
    case 'tagline':
      return {
        fontSize: 16,
        fontWeight: '500' as const,
        color: colors.foreground,
        letterSpacing: 0.1,
        textAlign: 'center' as const,
        lineHeight: 24,
      };
    default:
      return {
        fontSize: 16,
        fontWeight: '400' as const,
        color: colors.foreground,
        textAlign: 'center' as const,
        lineHeight: 24,
      };
  }
};

export const AnimatedText: React.FC<AnimatedTextProps> = ({ 
  text, 
  type = 'welcome', 
  delay = 0,
  style = {}
}) => {
  const { colors } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const animatedValues = useRef(text.split('').map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (isVisible) {
      const animations = text.split('').map((_, index) =>
        Animated.spring(animatedValues[index], {
          toValue: 1,
          delay: delay + index * theme.animations.timing.CHARACTER_DELAY,
          ...theme.animations.spring.TIGHT,
          useNativeDriver: true,
        })
      );

      Animated.stagger(theme.animations.timing.CHARACTER_DELAY, animations).start();
    }
  }, [isVisible]);

  const typeStyles = getTypeStyles(type, colors);

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
      {text.split('').map((char, index) => {
        const animatedStyle = {
          opacity: animatedValues[index],
          transform: [
            {
              translateY: animatedValues[index].interpolate({
                inputRange: [0, 1],
                outputRange: type === 'title' ? [50, 0] : [30, 0],
              }),
            },
            {
              scale: animatedValues[index].interpolate({
                inputRange: [0, 1],
                outputRange: type === 'title' ? [0.3, 1] : [0.8, 1],
              }),
            },
          ],
        };

        const textStyle = [
          typeStyles,
          style,
          animatedStyle,
        ];

        return (
          <Animated.View key={index} style={{ marginHorizontal: type === 'title' ? 2 : 0 }}>
            <Animated.Text style={textStyle}>
              {char === ' ' ? '\u00A0' : char}
            </Animated.Text>
          </Animated.View>
        );
      })}
    </View>
  );
};
