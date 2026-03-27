import React from 'react';
import { TextInput, TextInputProps, View, Text, ViewStyle, TextStyle } from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../theme/ThemeProvider';
import { theme } from '../../lib/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle | ViewStyle[];
  inputStyle?: TextStyle | TextStyle[];
  focusBorderColor?: string;
  className?: string;
  icon?: any;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
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
  leftIcon,
  rightIcon,
  description,
  ...props
}) => {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <View style={[tw`w-full mb-4`, containerStyle]}>
      {(label || Icon) && (
        <View style={tw`flex-row items-center mb-2`}>
          {Icon && <Icon size={16} color={colors.primary} style={tw`mr-2`} />}
          {label && (
            <Text style={[{ fontSize: 14, fontWeight: '600' }, { color: colors.foreground }]}>
              {label}
            </Text>
          )}
        </View>
      )}
      <View
        style={[
          {
            height: 56,
            borderRadius: theme.borderRadius['2xl'],
            borderWidth: 1,
            borderColor: error ? colors.destructive : isFocused ? colors.primary : colors.border,
            backgroundColor: colors.input,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
          },
        ]}
      >
        {leftIcon}
        <TextInput
          style={[
            {
              flex: 1,
              color: colors.foreground,
              fontSize: 16,
              includeFontPadding: false,
              textAlignVertical: 'center',
              paddingVertical: 0,
            },
            inputStyle
          ]}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
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
        {rightIcon}
      </View>
      {description && !error && (
        <Text style={[tw`text-xs mt-1`, { color: colors.mutedForeground }]}>
          {description}
        </Text>
      )}
      {error && (
        <Text style={[{ fontSize: 12, marginTop: 4 }, { color: colors.destructive }]}>
          {error}
        </Text>
      )}
    </View>
  );
};

export default Input;
