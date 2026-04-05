import React from 'react';
import {
  TouchableOpacity,
  Text,
  TouchableOpacityProps,
  TextStyle,
  ViewStyle
} from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../theme/ThemeProvider';
import { theme } from '../../lib/theme';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

type ButtonSize = 'sm' | 'default' | 'lg' | 'hero' | 'icon';
type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';

interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  children: React.ReactNode;
  onPress?: () => void;
  size?: ButtonSize;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
  className?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  onPress,
  size = 'default',
  variant = 'default',
  disabled = false,
  style,
  textStyle,
  className,
  ...props
}) => {
  const { colors } = useTheme();

  const sizeContainerStyles: Record<ButtonSize, ViewStyle> = {
    sm: { height: 36, paddingHorizontal: 12, borderRadius: theme.borderRadius.xl },
    default: { height: 40, paddingHorizontal: 16, borderRadius: theme.borderRadius.xl },
    lg: { height: 44, paddingHorizontal: 32, borderRadius: theme.borderRadius['2xl'] },
    hero: { height: 56, paddingHorizontal: 24, borderRadius: theme.borderRadius['3xl'], width: '100%' as any },
    icon: { height: 40, width: 40, borderRadius: theme.borderRadius.xl },
  };

  const variantStyles: Record<ButtonVariant, ViewStyle> = {
    default: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 6,
    },
    destructive: { backgroundColor: colors.destructive },
    outline: { 
      borderWidth: 1, 
      borderColor: colors.border, 
      backgroundColor: colors.background 
    },
    secondary: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: colors.primary,
    },
    ghost: { backgroundColor: 'transparent' },
    link: { backgroundColor: 'transparent' },
  };

  const textSizeStyles: Record<ButtonSize, number> = {
    sm: 14,
    default: 16,
    lg: 18,
    hero: 20,
    icon: 14
  };

  const textVariantStyles: Record<ButtonVariant, TextStyle> = {
    default: { color: colors.primaryForeground },
    destructive: { color: colors.destructiveForeground },
    outline: { color: colors.foreground },
    secondary: { color: colors.primary },
    ghost: { color: colors.foreground },
    link: { color: colors.primary, textDecorationLine: 'underline' }
  };

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  return (
    <AnimatedTouchableOpacity
      style={[
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
        sizeContainerStyles[size],
        variantStyles[variant],
        disabled && { opacity: 0.5 },
        style,
        animatedStyle
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={0.9}
      {...props}
    >
      {typeof children === 'string' ? (
        <Text
          style={[
            tw`font-semibold text-center`,
            textVariantStyles[variant],
            { fontSize: textSizeStyles[size] },
            textStyle
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </AnimatedTouchableOpacity>
  );
};

export default Button;
