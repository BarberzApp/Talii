import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import tw from 'twrnc';

interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

const Separator: React.FC<SeparatorProps> = ({
  orientation = 'horizontal',
  className = '',
}) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        orientation === 'horizontal' ? tw`h-px w-full` : tw`w-px h-full`,
        { backgroundColor: colors.border },
      ]}
    />
  );
};

export default Separator; 