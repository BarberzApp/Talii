import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../theme/ThemeProvider';
import { LucideIcon } from 'lucide-react-native';

interface SectionHeaderProps {
  title: string;
  icon?: LucideIcon;
  description?: string;
  style?: ViewStyle | ViewStyle[];
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  icon: Icon,
  description,
  style,
}) => {
  const { colors } = useTheme();
  return (
    <View style={[tw`mb-4`, style]}>
      <View style={tw`flex-row items-center mb-2`}>
        {Icon && <Icon size={20} color={colors.primary} style={tw`mr-2`} />}
        <Text style={[tw`text-lg font-semibold`, { color: colors.foreground }]}>
          {title}
        </Text>
      </View>
      {description && (
        <Text style={[tw`text-sm`, { color: colors.mutedForeground }]}>
          {description}
        </Text>
      )}
    </View>
  );
};

export default SectionHeader;

