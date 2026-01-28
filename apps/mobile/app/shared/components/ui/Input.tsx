import React from 'react';
import { TextInput, TextInputProps, View, Text, ViewStyle, TextStyle } from 'react-native';
import tw from 'twrnc';
import { theme } from '../../lib/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle | ViewStyle[];
  inputStyle?: TextStyle | TextStyle[];
  focusBorderColor?: string;
  className?: string;
  icon?: any;
  description?: string;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  inputStyle,
  placeholder,
  focusBorderColor,
  className,
  icon: Icon,
  description,
  ...props
}) => {
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <View style={[tw`w-full mb-4`, containerStyle]}>
      {(label || Icon) && (
        <View style={tw`flex-row items-center mb-2`}>
          {Icon && <Icon size={16} color={theme.colors.secondary} style={tw`mr-2`} />}
          {label && (
            <Text style={[tw`text-sm font-medium`, { color: theme.colors.foreground }]}>
              {label}
            </Text>
          )}
        </View>
      )}
      <TextInput
        style={[
          tw`flex w-full rounded-xl border px-4 py-3 text-base`,
          {
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderColor: error ? theme.colors.destructive : 'rgba(255,255,255,0.1)',
            color: theme.colors.foreground,
            borderWidth: 1,
            includeFontPadding: false,
            textAlignVertical: 'center',
          },
          isFocused && {
            borderColor: theme.colors.secondary,
            borderWidth: 1,
          },
          inputStyle
        ]}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.mutedForeground}
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus && props.onFocus(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur && props.onBlur(e);
        }}
        {...props}
      />
      {description && !error && (
        <Text style={[tw`text-xs mt-1`, { color: theme.colors.mutedForeground }]}>
          {description}
        </Text>
      )}
      {error && (
        <Text style={[tw`text-xs mt-1`, { color: theme.colors.destructive }]}>
          {error}
        </Text>
      )}
    </View>
  );
};

export default Input;