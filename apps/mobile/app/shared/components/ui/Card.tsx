import React from 'react';
import { View, Text, ViewStyle, TextStyle, StyleProp } from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../theme/ThemeProvider';
import { theme } from '../../lib/theme';

type CardVariant = 'default' | 'elevated' | 'hero';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

interface CardHeaderProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

interface CardContentProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

interface CardTitleProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  className?: string;
}

interface CardDescriptionProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  className?: string;
}

interface CardFooterProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

const variantMap: Record<CardVariant, ViewStyle> = {
  default: {
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
  },
  elevated: {
    borderRadius: theme.borderRadius['2xl'],
    ...theme.shadows.md,
  },
  hero: {
    borderRadius: theme.borderRadius['3xl'],
    padding: 32,
    ...theme.shadows.lg,
  },
};

const Card: React.FC<CardProps> = ({ children, variant = 'default', style, className }) => {
  const { colors } = useTheme();
  return (
    <View 
      style={[
        { borderWidth: 1, overflow: 'hidden' },
        variantMap[variant],
        { 
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        style
      ]}
    >
      {children}
    </View>
  );
};

const CardHeader: React.FC<CardHeaderProps> = ({ children, style, className }) => {
  return (
    <View style={[tw`flex flex-col space-y-1.5 p-6`, style]}>
      {children}
    </View>
  );
};

const CardTitle: React.FC<CardTitleProps> = ({ children, style, className }) => {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        tw`text-2xl font-semibold leading-none tracking-tight`,
        { color: colors.cardForeground },
        style
      ]}
    >
      {children}
    </Text>
  );
};

const CardDescription: React.FC<CardDescriptionProps> = ({ children, style, className }) => {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        tw`text-sm`,
        { color: colors.mutedForeground },
        style
      ]}
    >
      {children}
    </Text>
  );
};

const CardContent: React.FC<CardContentProps> = ({ children, style, className }) => {
  return (
    <View style={[tw`p-6 pt-0`, style]}>
      {children}
    </View>
  );
};

const CardFooter: React.FC<CardFooterProps> = ({ children, style, className }) => {
  return (
    <View style={[tw`flex items-center p-6 pt-0`, style]}>
      {children}
    </View>
  );
};

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
