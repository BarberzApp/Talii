import React, { useEffect } from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withRepeat,
  withSequence,
  Easing 
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { theme } from '../../lib/theme';
import tw from 'twrnc';

interface SkeletonProps {
  style?: StyleProp<ViewStyle>;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  width?: number | string;
  height?: number | string;
}

export function Skeleton({ style, rounded = 'md', width, height }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const borderRadius = theme.borderRadius[rounded];

  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.muted,
          borderRadius,
          width: width as any,
          height: height as any,
        },
        animatedStyle,
        style
      ]}
    />
  );
}

export function SkeletonCard() {
  const { colors } = useTheme();
  return (
    <View style={[tw`p-6 mb-4 rounded-xl border`, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Skeleton height={24} width="60%" rounded="lg" style={tw`mb-4`} />
      <Skeleton height={16} width="100%" rounded="md" style={tw`mb-2`} />
      <Skeleton height={16} width="80%" rounded="md" style={tw`mb-4`} />
      <View style={tw`flex-row gap-2 mt-2`}>
        <Skeleton height={36} width={100} rounded="lg" />
        <Skeleton height={36} width={80} rounded="lg" />
      </View>
    </View>
  );
}

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return <Skeleton width={size} height={size} rounded="full" />;
}
