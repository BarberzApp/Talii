export type UserRole = 'client' | 'barber' | 'admin';

export const USER_ROLES = {
  CLIENT: 'client' as const,
  BARBER: 'barber' as const,
  ADMIN: 'admin' as const
};

export type BookingStatus =
  | 'pending'
  | 'payment_pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded'
  | 'failed'
  | 'expired';

export type PaymentStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

