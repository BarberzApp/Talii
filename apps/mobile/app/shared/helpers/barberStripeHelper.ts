import { fetchConnectStatus, isStripeReady } from '../lib/stripeConnect';

/**
 * Reads the Stripe Connect status (GET /api/stripe/connect/status, which also
 * stores the latest flags) and marks the onboarding form when payments are ready.
 */
export const checkStripeStatusOnce = async (
  setFormData: React.Dispatch<React.SetStateAction<any>>,
  setStripeStatus: React.Dispatch<React.SetStateAction<string | null>>
) => {
  const status = await fetchConnectStatus();
  if (!status) return;
  if (isStripeReady(status)) {
    setFormData((prev: any) => ({ ...prev, stripeConnected: true }));
    setStripeStatus('active');
  } else if (status.hasAccount) {
    setStripeStatus('pending');
  }
};

export default { checkStripeStatusOnce };
