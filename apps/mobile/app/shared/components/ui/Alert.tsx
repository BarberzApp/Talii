import React from 'react';
import { View, Text, ViewStyle, TextStyle } from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../theme/ThemeProvider';

type AlertVariant = 'default' | 'destructive' | 'info';

interface AlertProps {
  children: React.ReactNode;
  variant?: AlertVariant;
  style?: ViewStyle | ViewStyle[];
  className?: string;
}

interface AlertTitleProps {
  children: React.ReactNode;
  style?: TextStyle | TextStyle[];
}

interface AlertDescriptionProps {
  children: React.ReactNode;
  style?: TextStyle | TextStyle[];
}

const Alert: React.FC<AlertProps> = ({ children, variant = 'default', style, className }) => {
  const { colors } = useTheme();

  const variantStyles: Record<AlertVariant, any> = {
    default: {
      backgroundColor: colors.background,
      borderColor: colors.border,
    },
    destructive: {
      backgroundColor: colors.destructive,
      borderColor: colors.destructive,
    },
    info: {
      backgroundColor: colors.primarySubtle,
      borderColor: colors.info,
    },
  };

  return (
    <View
      style={[
        tw`relative w-full rounded-lg border p-4`,
        variantStyles[variant],
        style
      ]}
    >
      {children}
    </View>
  );
};

const AlertTitle: React.FC<AlertTitleProps> = ({ children, style }) => {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        tw`mb-1 font-medium leading-none tracking-tight`,
        { color: colors.foreground },
        style
      ]}
    >
      {children}
    </Text>
  );
};

const AlertDescription: React.FC<AlertDescriptionProps> = ({ children, style }) => {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        tw`text-sm leading-relaxed`,
        { color: colors.mutedForeground },
        style
      ]}
    >
      {children}
    </Text>
  );
};

export { Alert, AlertTitle, AlertDescription };
