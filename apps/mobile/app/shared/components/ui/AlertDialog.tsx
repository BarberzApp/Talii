import React from 'react';
import { Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../theme/ThemeProvider';
import { theme } from '../../lib/theme';

interface AlertDialogProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  cancelText?: string;
  confirmText?: string;
  onConfirm: () => void;
  variant?: 'default' | 'destructive';
}

export function AlertDialog({
  visible,
  onClose,
  title,
  description,
  cancelText = 'Cancel',
  confirmText = 'Continue',
  onConfirm,
  variant = 'default'
}: AlertDialogProps) {
  const { colors } = useTheme();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[tw`flex-1 justify-center items-center px-4`, { backgroundColor: colors.backdrop }]}>
          <TouchableWithoutFeedback>
            <View style={[
              tw`w-full max-w-sm rounded-[1rem] p-6 overflow-hidden`,
              { backgroundColor: colors.popover, borderWidth: 1, borderColor: colors.border }
            ]}>
              <Text style={[tw`text-xl font-bold mb-2`, { color: colors.foreground }]}>
                {title}
              </Text>
              
              {description && (
                <Text style={[tw`text-base mb-6`, { color: colors.mutedForeground }]}>
                  {description}
                </Text>
              )}

              <View style={tw`flex-row justify-end space-x-3`}>
                <TouchableOpacity 
                  onPress={onClose}
                  style={[tw`px-4 py-2.5 rounded-xl border`, { borderColor: colors.border }]}
                >
                  <Text style={[tw`font-semibold`, { color: colors.foreground }]}>{cancelText}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => {
                    onConfirm();
                    onClose();
                  }}
                  style={[
                    tw`px-4 py-2.5 rounded-xl ml-3`, 
                    { backgroundColor: variant === 'destructive' ? colors.destructive : colors.primary }
                  ]}
                >
                  <Text style={[
                    tw`font-semibold`, 
                    { color: variant === 'destructive' ? colors.destructiveForeground : colors.primaryForeground }
                  ]}>
                    {confirmText}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
