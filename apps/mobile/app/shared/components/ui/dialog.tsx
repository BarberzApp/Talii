import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface DialogProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
}

interface DialogContentProps {
  children: React.ReactNode;
}

interface DialogHeaderProps {
  children: React.ReactNode;
}

interface DialogFooterProps {
  children: React.ReactNode;
}

interface DialogTitleProps {
  children: React.ReactNode;
}

const Dialog: React.FC<DialogProps> = ({ 
  visible, 
  onClose, 
  title, 
  children, 
  showCloseButton = true 
}) => {
  const { colors } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={[styles.overlay, { backgroundColor: colors.backdrop }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <View 
          style={[
            styles.dialog,
            {
              backgroundColor: colors.background,
              borderColor: colors.glassBorder,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {title && (
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
              {showCloseButton && (
                <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.glass }]}>
                  <Text style={[styles.closeButtonText, { color: colors.foreground }]}>×</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {children}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const DialogContent: React.FC<DialogContentProps> = ({ children }) => {
  return <View style={styles.content}>{children}</View>;
};

const DialogHeader: React.FC<DialogHeaderProps> = ({ children }) => {
  return <View style={styles.header}>{children}</View>;
};

const DialogFooter: React.FC<DialogFooterProps> = ({ children }) => {
  return <View style={styles.footer}>{children}</View>;
};

const DialogTitle: React.FC<DialogTitleProps> = ({ children }) => {
  const { colors } = useTheme();
  return <Text style={[styles.title, { color: colors.foreground }]}>{children}</Text>;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialog: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    margin: 20,
    minWidth: 300,
    maxWidth: Dimensions.get('window').width - 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    lineHeight: 20,
  },
  content: {
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});

export { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle }; 