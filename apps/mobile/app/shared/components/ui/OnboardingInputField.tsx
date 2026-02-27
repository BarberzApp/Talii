import React from 'react';
import { View, Text, TextInput, KeyboardTypeOptions } from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../theme/ThemeProvider';

interface OnboardingInputFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  icon?: React.ComponentType<{ size?: number; color?: string; style?: any }>;
  error?: string;
  multiline?: boolean;
  description?: string;
}

export const OnboardingInputField: React.FC<OnboardingInputFieldProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  icon: Icon,
  error,
  multiline = false,
  description,
}) => {
  const { colors } = useTheme();
  return (
    <View style={tw`mb-4`}>
      <View style={tw`flex-row items-center mb-2`}>
        {Icon && <Icon size={16} color={colors.primary} style={tw`mr-2`} />}
        <Text style={[tw`text-sm font-medium`, { color: colors.foreground }]}>{label}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[
          tw`px-4 py-3 rounded-xl text-base`,
          multiline && tw`h-24`,
          {
            backgroundColor: colors.glass,
            color: colors.foreground,
            borderWidth: 1,
            borderColor: error ? colors.destructive : colors.glassBorder,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
      />
      {description && (
        <Text style={[tw`text-xs mt-1`, { color: colors.mutedForeground }]}>{description}</Text>
      )}
      {error && (
        <Text style={[tw`text-xs mt-1`, { color: colors.destructive }]}>{error}</Text>
      )}
    </View>
  );
};

export default OnboardingInputField;

