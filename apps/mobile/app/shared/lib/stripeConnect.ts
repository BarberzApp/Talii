import * as WebBrowser from 'expo-web-browser';
import type { ConnectStatusResponse } from '@barber-app/shared';
import { api } from './api';
import { logger } from './logger';

/**
 * The website's /barber/connect/return and /refresh pages send the browser to
 * this deep link (bocm://stripe-connect/return?account_id=... or /refresh).
 */
export const STRIPE_CONNECT_DEEP_LINK = 'bocm://stripe-connect';

export type ConnectFlowResult = {
  /** The account's status read from Stripe after the browser closed (null if that failed). */
  status: ConnectStatusResponse | null;
  /** Stripe sent the barber to the refresh URL (link expired); open a new link to continue. */
  needsNewLink: boolean;
  /** What the API returned: a dashboard login link or an onboarding link. */
  linkType: 'dashboard' | 'onboarding';
};

/** True when Stripe can take booking-fee charges for this barber (or the fee is waived). */
export function isStripeReady(status: ConnectStatusResponse | null | undefined): boolean {
  return !!status && (status.feeExempt || (status.hasAccount && status.chargesEnabled && status.detailsSubmitted));
}

/** GET /api/stripe/connect/status (reads Stripe and stores the flags). */
export async function fetchConnectStatus(): Promise<ConnectStatusResponse | null> {
  try {
    return await api.connect.status();
  } catch (error) {
    logger.warn('Could not read Stripe Connect status.');
    return null;
  }
}

/**
 * Opens Stripe onboarding (or the Express dashboard) in an in-app browser session.
 * `POST /api/stripe/connect/onboarding` or `/dashboard` returns the URL; the
 * session closes when the website redirects to the bocm://stripe-connect deep
 * link (or the barber closes it). The status is then read with
 * GET /api/stripe/connect/status. Throws ApiError when no link could be created.
 */
export async function openStripeConnect(kind: 'onboarding' | 'dashboard'): Promise<ConnectFlowResult> {
  const link = kind === 'onboarding' ? await api.connect.onboarding() : await api.connect.dashboard();

  let needsNewLink = false;
  try {
    const result = await WebBrowser.openAuthSessionAsync(link.url, STRIPE_CONNECT_DEEP_LINK);
    needsNewLink = result.type === 'success' && result.url.includes('/refresh');
  } catch (error) {
    logger.error('Could not open the Stripe page:', error);
    throw error;
  }

  return { status: await fetchConnectStatus(), needsNewLink, linkType: link.type };
}
