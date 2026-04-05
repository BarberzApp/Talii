import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import tw from 'twrnc';
import { BlurView } from 'expo-blur';
import { AnimatedSection } from './AnimatedSection';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
}: SelectProps) {
  const { colors, colorScheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(option => option.value === value);

  return (
    <View>
      <TouchableOpacity
        style={[
          tw`flex-row items-center justify-between px-3 py-3 rounded-xl border`,
          { 
            borderColor: colors.border, 
            backgroundColor: colors.background,
            opacity: disabled ? 0.5 : 1
          }
        ]}
        onPress={() => !disabled && setIsOpen(true)}
        disabled={disabled}
      >
        <Text style={[tw`text-base`, { color: selectedOption ? colors.foreground : colors.mutedForeground }]}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <ChevronDown size={20} color={colors.mutedForeground} />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity 
          style={tw`flex-1 justify-center items-center px-4`} 
          activeOpacity={1} 
          onPress={() => setIsOpen(false)}
        >
          <BlurView 
            intensity={40} 
            tint={colorScheme === 'dark' ? 'dark' : 'light'} 
            style={tw`absolute inset-0`} 
          />
          
          <TouchableOpacity activeOpacity={1} style={tw`w-full max-w-sm`}>
            <AnimatedSection type="scale" duration={250} spring>
              <View style={[
                tw`rounded-[1rem] overflow-hidden`,
                { backgroundColor: colors.popover, borderWidth: 1, borderColor: colors.border }
              ]}>
                <View style={[tw`px-4 py-4 border-b flex-row justify-between items-center`, { borderColor: colors.border }]}>
                  <Text style={[tw`text-lg font-bold`, { color: colors.foreground }]}>Select Option</Text>
                  <TouchableOpacity onPress={() => setIsOpen(false)}>
                    <Text style={[tw`text-xl`, { color: colors.mutedForeground }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={options}
                  keyExtractor={(item) => item.value}
                  style={{ maxHeight: 300 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[tw`px-4 py-4 flex-row items-center justify-between border-b`, { borderColor: colors.border }]}
                      onPress={() => {
                        onValueChange(item.value);
                        setIsOpen(false);
                      }}
                    >
                      <Text style={[tw`text-base`, { color: colors.foreground, fontWeight: item.value === value ? 'bold' : 'normal' }]}>
                        {item.label}
                      </Text>
                      {item.value === value && (
                        <Check size={20} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  )}
                />
              </View>
            </AnimatedSection>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export default Select;