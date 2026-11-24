import React from 'react';
import { Text } from 'react-native';
import tw from 'twrnc';
import { TOTAL_PRICE_CENTS, formatCents } from '@barber-app/shared';
import { useTheme } from './theme';

/** The fee rule in one line, shown wherever services are listed before booking. */
export const bookingFeeNoteText = (): string =>
  `Booking fee ${formatCents(TOTAL_PRICE_CENTS)} (some barbers waive it) — service paid in person.`;

export default function BookingFeeNote({ style }: { style?: object }) {
  const { colors } = useTheme();
  return (
    <Text style={[tw`text-sm text-center`, { color: colors.mutedForeground }, style]}>
      {bookingFeeNoteText()}
    </Text>
  );
}
