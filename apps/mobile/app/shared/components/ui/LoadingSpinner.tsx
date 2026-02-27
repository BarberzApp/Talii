import React from 'react';
import { View, ViewStyle, ActivityIndicator } from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../theme/ThemeProvider';

interface LoadingSpinnerProps {
  size?: 'sm' | 'default' | 'lg';
  color?: string;
  style?: ViewStyle | ViewStyle[];
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'default', 
  color,
  style 
}) => {
  const { colors } = useTheme();

  const sizeMap = {
    sm: 'small',
    default: 'small',
    lg: 'large'
  } as const;

  return (
    <View style={[tw`flex items-center justify-center`, style]}>
      <ActivityIndicator 
        size={sizeMap[size]} 
        color={color ?? colors.primary}
      />
    </View>
  );
};

export default LoadingSpinner;
