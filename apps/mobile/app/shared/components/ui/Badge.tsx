import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../theme/ThemeProvider';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'soft' | 'info';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  style?: ViewStyle | ViewStyle[];
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', style, className }) => {
  const { colors } = useTheme();

  const variantStyles: Record<BadgeVariant, any> = {
    default: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    secondary: {
      backgroundColor: colors.primarySubtle,
      borderColor: colors.primary,
    },
    destructive: {
      backgroundColor: colors.destructive,
      borderColor: colors.destructive,
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: colors.border,
    },
    soft: {
      backgroundColor: colors.primarySubtle,
      borderColor: colors.primarySubtle,
    },
    info: {
      backgroundColor: colors.info,
      borderColor: colors.info,
    },
  };

  const textStyles: Record<BadgeVariant, any> = {
    default: { color: colors.primaryForeground },
    secondary: { color: colors.primary },
    destructive: { color: colors.destructiveForeground },
    outline: { color: colors.foreground },
    soft: { color: colors.primary },
    info: { color: colors.infoForeground },
  };

  return (
    <View
      style={[
        tw`inline-flex items-center rounded-full border px-2.5 py-0.5`,
        variantStyles[variant],
        style
      ]}
    >
      <Text
        style={[
          tw`text-xs font-semibold`,
          textStyles[variant],
        ]}
      >
        {children}
      </Text>
    </View>
  );
};

export default Badge;
