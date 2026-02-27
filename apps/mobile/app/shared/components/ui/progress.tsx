import React from 'react';
import { View } from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../theme/ThemeProvider';

interface ProgressProps {
  value?: number;
  max?: number;
  className?: string;
}

const Progress: React.FC<ProgressProps> = ({
  value = 0,
  max = 100,
  className = '',
}) => {
  const { colors } = useTheme();
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <View
      style={[
        tw`w-full h-2 rounded-full overflow-hidden`,
        { backgroundColor: colors.muted },
      ]}
    >
      <View
        style={[
          tw`h-full rounded-full`,
          { 
            backgroundColor: colors.primary,
            width: `${percentage}%`,
          },
        ]}
      />
    </View>
  );
};

export default Progress;
