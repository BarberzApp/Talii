import React from 'react';
import { TextInput, View, Text, TextInputProps } from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../theme/ThemeProvider';

interface TextareaProps extends TextInputProps {
  label?: string;
  error?: string;
  rows?: number;
  icon?: any;
  description?: string;
}

const Textarea: React.FC<TextareaProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  className = '',
  rows = 4,
  maxLength,
  error,
  multiline = true,
  icon: Icon,
  description,
  ...props
}) => {
  const { colors } = useTheme();
  const minHeight = multiline ? Math.max(80, rows * 20) : 50;
  const disabled = props.editable === false;

  return (
    <View style={tw`w-full mb-4`}>
      {(label || Icon) && (
        <View style={tw`flex-row items-center mb-2`}>
          {Icon && <Icon size={16} color={colors.primary} style={tw`mr-2`} />}
          {label && (
            <Text style={[tw`text-sm font-medium`, { color: colors.foreground }]}>
              {label}
            </Text>
          )}
        </View>
      )}
      <TextInput
        style={[
          tw`w-full px-4 py-3 rounded-xl border text-base`,
          {
            backgroundColor: colors.glass,
            color: colors.foreground,
            borderColor: error ? colors.destructive : colors.glassBorder,
            minHeight,
            opacity: disabled ? 0.5 : 1,
            textAlignVertical: multiline ? 'top' : 'center',
            includeFontPadding: false,
          },
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        maxLength={maxLength}
        {...props}
      />
      {description && !error && (
        <Text style={[tw`text-xs mt-1`, { color: colors.mutedForeground }]}>
          {description}
        </Text>
      )}
      {error && (
        <Text
          style={[
            tw`text-xs mt-1`,
            { color: colors.destructive },
          ]}
        >
          {error}
        </Text>
      )}
    </View>
  );
};

export default Textarea; 