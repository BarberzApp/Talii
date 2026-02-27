import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import tw from 'twrnc';

interface FormProps {
  children: React.ReactNode;
  className?: string;
}

interface FormFieldProps {
  children: React.ReactNode;
  label?: string;
  error?: string;
  required?: boolean;
  className?: string;
}

interface FormMessageProps {
  children: React.ReactNode;
  variant?: 'default' | 'destructive';
  className?: string;
}

const Form: React.FC<FormProps> = ({ children, className = '' }) => {
  return (
    <View style={tw`w-full space-y-4`}>
      {children}
    </View>
  );
};

const FormField: React.FC<FormFieldProps> = ({
  children,
  label,
  error,
  required = false,
  className = '',
}) => {
  const { colors } = useTheme();
  return (
    <View style={tw`w-full space-y-2`}>
      {label && (
        <Text
          style={[
            tw`text-sm font-medium`,
            { color: colors.foreground },
          ]}
        >
          {label}
          {required && (
            <Text style={{ color: colors.destructive }}> *</Text>
          )}
        </Text>
      )}
      {children}
      {error && (
        <Text
          style={[
            tw`text-sm`,
            { color: colors.destructive },
          ]}
        >
          {error}
        </Text>
      )}
    </View>
  );
};

const FormMessage: React.FC<FormMessageProps> = ({
  children,
  variant = 'default',
  className = '',
}) => {
  const { colors } = useTheme();
  const getMessageColor = () => {
    switch (variant) {
      case 'destructive':
        return colors.destructive;
      default:
        return colors.mutedForeground;
    }
  };

  return (
    <Text
      style={[
        tw`text-sm`,
        { color: getMessageColor() },
      ]}
    >
      {children}
    </Text>
  );
};

export { Form, FormField, FormMessage }; 