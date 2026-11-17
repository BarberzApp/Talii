import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

interface StripeDeps {
  userId: string;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  setStripeStatus: React.Dispatch<React.SetStateAction<string | null>>;
  setStripeLoading: (v: boolean) => void;
  navigation: any;
  currentStep: number;
  stepsLength: number;
}

export const checkStripeStatusOnce = async (userId: string, setFormData: StripeDeps['setFormData'], setStripeStatus: StripeDeps['setStripeStatus']) => {
  try {
    const { data: barber, error } = await supabase
      .from('barbers')
      .select('stripe_account_id, stripe_account_status, stripe_account_ready')
      .eq('user_id', userId)
      .single();

    if (error) {
      logger.error('Stripe status check error:', error);
      return;
    }

    if (barber?.stripe_account_id && (barber.stripe_account_ready || barber.stripe_account_status === 'active')) {
      setFormData((prev: any) => ({ ...prev, stripeConnected: true }));
      setStripeStatus(barber.stripe_account_status);
    }
  } catch (err) {
    logger.error('Stripe status check unexpected error:', err);
  }
};

export default { checkStripeStatusOnce };
