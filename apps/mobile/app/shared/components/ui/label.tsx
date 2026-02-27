import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import tw from 'twrnc';

interface LabelProps {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
  required?: boolean;
}

const Label: React.FC<LabelProps> = ({ 
  children, 
  htmlFor, 
  className = '',
  required = false 
}) => {
  const { colors } = useTheme();
  return (
    <View style={tw`mb-2`}>
      <Text
        style={[
          tw`text-sm font-medium`,
          { color: colors.foreground },
        ]}
      >
        {children}
        {required && (
          <Text style={{ color: colors.destructive }}> *</Text>
        )}
      </Text>
    </View>
  );
};

export default Label; 