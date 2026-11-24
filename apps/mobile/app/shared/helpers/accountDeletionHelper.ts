import { useCallback, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { DeleteMeConflict } from '@barber-app/shared';
import { api, errorMessage, hasErrorCode } from '../lib/api';
import { useToast } from '../components/ui/use-toast';
import { useAuth } from '../hooks/useAuth';

interface AccountDeletionHelperOptions {
  /** @deprecated Not needed: the server finds the caller's barber listing. */
  barberId?: string;
}

/**
 * Encapsulates account deletion flow so the page stays small.
 * Flow:
 * 1) requestDelete -> shows warning toast and reveals confirmation input.
 * 2) user types "YES" (all caps) -> deleteAccount calls DELETE /api/me { confirm: true }.
 */
export const useAccountDeletionHelper = (_options: AccountDeletionHelperOptions = {}) => {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const isConfirmed = useMemo(() => confirmText.trim() === 'YES', [confirmText]);

  const requestDelete = useCallback(() => {
    toast({
      title: 'Delete account?',
      description: 'Type YES (all caps) below to confirm. This cannot be undone.',
      variant: 'warning',
      duration: 5000,
    });
    setIsConfirming(true);
  }, [toast]);

  const deleteAccount = useCallback(async () => {
    if (!user) {
      toast({
        title: 'Not signed in',
        description: 'Please log in again before deleting your account.',
        variant: 'warning',
      });
      return;
    }

    if (!isConfirmed) {
      toast({
        title: 'Confirmation required',
        description: 'Please type YES in all caps to proceed.',
        variant: 'warning',
      });
      return;
    }

    setIsDeleting(true);

    try {
      // DELETE /api/me cancels future bookings (normal refund policy), scrubs the
      // profile and listing, removes uploads and blocks sign-in. Booking and
      // payment history is kept on the server.
      await api.me.delete();

      await logout();

      toast({
        title: 'Account deleted',
        description: 'Your account has been deleted.',
        variant: 'success',
      });

      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' as never }],
      });
    } catch (error) {
      if (hasErrorCode(error, 'HAS_UPCOMING_BOOKINGS')) {
        const details = error.details as Partial<DeleteMeConflict> | undefined;
        const remaining = details?.bookings?.length ?? 0;
        const cancelled = details?.cancelledBookings?.length ?? 0;
        toast({
          title: 'Account not deleted',
          description:
            `${remaining} upcoming booking${remaining === 1 ? '' : 's'} could not be cancelled` +
            (cancelled ? ` (${cancelled} other${cancelled === 1 ? ' was' : 's were'} cancelled)` : '') +
            '. Cancel them from your calendar, then try again.',
          variant: 'destructive',
          duration: 8000,
        });
      } else {
        toast({
          title: 'Delete failed',
          description: errorMessage(error, 'Could not delete your account.'),
          variant: 'destructive',
        });
      }
    } finally {
      setIsDeleting(false);
      setIsConfirming(false);
      setConfirmText('');
    }
  }, [isConfirmed, logout, navigation, toast, user]);

  return {
    isConfirming,
    isDeleting,
    confirmText,
    setConfirmText,
    requestDelete,
    deleteAccount,
    isConfirmed,
  };
};

export default useAccountDeletionHelper;

