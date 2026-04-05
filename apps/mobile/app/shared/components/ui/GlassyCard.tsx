import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import tw from 'twrnc';
import { useTheme } from '../theme/ThemeProvider';
import { theme } from '../../lib/theme';

interface GlassyCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
}

export function GlassyCard({
  children,
  style,
  intensity = 20,
  tint,
  rounded = '2xl'
}: GlassyCardProps) {
  const { colors, colorScheme } = useTheme();

  const getTint = () => {
    if (tint) return tint;
    return colorScheme === 'dark' ? 'dark' : 'light';
  };

  const borderRadius = theme.borderRadius[rounded];

  return (
    <View style={[
      tw`overflow-hidden`,
      {
        borderRadius,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        backgroundColor: colors.glass,
      },
      style
    ]}>
      <BlurView
        intensity={intensity}
        tint={getTint()}
        style={tw`absolute inset-0`}
      />
      {children}
    </View>
  );
}

export function GlassyCardContent({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[tw`p-6`, style]}>{children}</View>;
}
