import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TextInputProps, ViewStyle } from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../theme/ThemeProvider';

interface NumericInputProps extends Omit<TextInputProps, 'keyboardType' | 'value' | 'onChangeText'> {
  label: string;
  value: number;
  onChangeText: (value: number) => void;
  prefix?: string;
  suffix?: string;
  error?: string;
  containerStyle?: ViewStyle | ViewStyle[];
}

export const NumericInput: React.FC<NumericInputProps> = ({
  label,
  value,
  onChangeText,
  prefix,
  suffix,
  error,
  containerStyle,
  placeholder,
  ...props
}) => {
  const { colors } = useTheme();
  // Keep the raw text so partial input like "25." or "25.5" can be typed;
  // the parent gets the parsed number.
  const [text, setText] = useState(value ? String(value) : '');
  useEffect(() => {
    if ((parseFloat(text) || 0) !== value) setText(value ? String(value) : '');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- it reloads only when the listed keys change; the callback reads the current render
  }, [value]);

  return (
    <View style={[tw`flex-1`, containerStyle]}>
      <Text style={[tw`text-sm font-medium mb-2`, { color: colors.foreground }]}>
        {label}
      </Text>
      <View style={tw`relative`}>
        {prefix && (
          <Text style={[
            tw`absolute left-4 top-3 text-base z-10`,
            { color: colors.mutedForeground }
          ]}>
            {prefix}
          </Text>
        )}
        <TextInput
          style={[
            tw`px-4 py-3 rounded-xl text-base`,
            prefix && tw`pl-8`,
            suffix && tw`pr-8`,
            {
              backgroundColor: colors.glass,
              color: colors.foreground,
              borderWidth: 1,
              borderColor: error ? colors.destructive : colors.glassBorder,
            }
          ]}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          value={text}
          onChangeText={(input) => {
            const clean = input.replace(/[^0-9.]/g, '');
            setText(clean);
            onChangeText(clean === '' ? 0 : parseFloat(clean) || 0);
          }}
          keyboardType="decimal-pad"
          {...props}
        />
        {suffix && (
          <Text style={[
            tw`absolute right-4 top-3 text-base`,
            { color: colors.mutedForeground }
          ]}>
            {suffix}
          </Text>
        )}
      </View>
      {error && (
        <Text style={[tw`text-xs mt-1`, { color: colors.destructive }]}>
          {error}
        </Text>
      )}
    </View>
  );
};

export default NumericInput;

