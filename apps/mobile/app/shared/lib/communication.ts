import { Linking, Platform, Alert } from 'react-native';
import { logger } from './logger';

/**
 * Opens the native messages app with a pre-filled recipient and message.
 * On iOS, this will use iMessage if the recipient has it enabled.
 * 
 * @param phoneNumber The recipient's phone number
 * @param message An optional pre-filled message
 */
export const openMessages = async (phoneNumber: string, message: string = '') => {
  if (!phoneNumber) {
    logger.error('No phone number provided to openMessages');
    return;
  }

  // Clean the phone number (remove non-digits, but keep + for international)
  const cleanedNumber = phoneNumber.replace(/[^\d+]/g, '');
  
  // URL schemes:
  // sms:<phone_number> - Standard SMS
  // sms:<phone_number>&body=<message> - iOS (old)
  // sms:<phone_number>?body=<message> - Android & iOS (modern)
  
  const separator = Platform.OS === 'ios' ? '&' : '?';
  const url = `sms:${cleanedNumber}${message ? `${separator}body=${encodeURIComponent(message)}` : ''}`;

  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert(
        'Not Supported',
        'Your device does not support sending text messages directly.',
        [{ text: 'OK' }]
      );
    }
  } catch (error) {
    logger.error('Error opening messages:', error);
    Alert.alert(
      'Error',
      'An unexpected error occurred while trying to open the messages app.',
      [{ text: 'OK' }]
    );
  }
};

/**
 * Opens the native phone app to start a call.
 */
export const openPhone = async (phoneNumber: string) => {
  if (!phoneNumber) return;
  const cleanedNumber = phoneNumber.replace(/[^\d+]/g, '');
  const url = `tel:${cleanedNumber}`;
  
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    }
  } catch (error) {
    logger.error('Error opening phone:', error);
  }
};
