import React from 'react';
import { Switch as RNSwitch, View } from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../theme/ThemeProvider';

interface SwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

const Switch: React.FC<SwitchProps> = ({
  checked = false,
  onCheckedChange,
  disabled = false,
  className = '',
}) => {
  const { colors } = useTheme();
  return (
    <View style={tw`w-full`}>
      <RNSwitch
        value={checked}
        onValueChange={onCheckedChange}
        disabled={disabled}
        trackColor={{
          false: colors.muted,
          true: colors.primary,
        }}
        thumbColor={
          checked ? colors.primaryForeground : colors.foreground
        }
        ios_backgroundColor={colors.muted}
        style={tw`w-12 h-6`}
      />
    </View>
  );
};

export default Switch; 