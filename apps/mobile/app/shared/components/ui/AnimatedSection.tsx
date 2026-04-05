import React, { useEffect } from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
  withDelay,
  Easing 
} from 'react-native-reanimated';
import { theme } from '../../lib/theme';

type AnimationType = 'fade' | 'slideUp' | 'slideDown' | 'scale' | 'bounce';

interface AnimatedSectionProps {
  children: React.ReactNode;
  type?: AnimationType;
  delay?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  spring?: boolean;
}

export function AnimatedSection({
  children,
  type = 'fade',
  delay = 0,
  duration = 300,
  style,
  spring = false,
}: AnimatedSectionProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(type === 'slideUp' ? 20 : type === 'slideDown' ? -20 : 0);
  const scale = useSharedValue(type === 'scale' || type === 'bounce' ? 0.9 : 1);

  useEffect(() => {
    // Opacity animation
    opacity.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.ease) }));

    // Transform animations
    if (type === 'slideUp' || type === 'slideDown') {
      if (spring) {
        translateY.value = withDelay(delay, withSpring(0, {
          damping: 15,
          stiffness: 150,
        }));
      } else {
        translateY.value = withDelay(delay, withTiming(0, { duration, easing: Easing.out(Easing.back(1.2)) }));
      }
    }

    if (type === 'scale') {
      if (spring) {
        scale.value = withDelay(delay, withSpring(1, {
          damping: 15,
          stiffness: 150,
        }));
      } else {
        scale.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.back(1.5)) }));
      }
    }

    if (type === 'bounce') {
      scale.value = withDelay(delay, withSpring(1, {
        damping: 10,
        stiffness: 100,
      }));
    }
  }, [type, delay, duration, spring]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value }
    ]
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}
