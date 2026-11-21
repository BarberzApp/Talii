import { MutableRefObject } from 'react';
import { centsToDollarInput } from '@barber-app/shared';
import { api } from '../lib/api';
import { logger } from '../lib/logger';
import { fetchConnectStatus, isStripeReady } from '../lib/stripeConnect';
import type { Service } from './barberServicesHelper';

type FormData = {
  businessName: string;
  phone: string;
  location: string;
  bio: string;
  specialties: string[];
  services: Service[];
  stripeConnected: boolean;
  socialMedia: {
    instagram: string;
    twitter: string;
    tiktok: string;
    facebook: string;
  };
};

type SetFormData = React.Dispatch<React.SetStateAction<FormData>>;
type SetStripeStatus = React.Dispatch<React.SetStateAction<string | null>>;

interface PrefillDeps {
  userProfile: { name?: string | null; business_name?: string | null } | null;
  setFormData: SetFormData;
  setStripeStatus: SetStripeStatus;
  prefillDoneRef: MutableRefObject<boolean>;
}

/**
 * Single-run prefill for barber onboarding from GET /api/me, GET /api/me/services
 * and GET /api/stripe/connect/status. Server values only fill blank fields so
 * nothing the barber already typed is overwritten.
 */
export const runBarberPrefillOnce = async ({
  userProfile,
  setFormData,
  setStripeStatus,
  prefillDoneRef,
}: PrefillDeps) => {
  if (prefillDoneRef.current) return;

  try {
    const [me, servicesRes, connect] = await Promise.all([
      api.me.get(),
      api.services.list().catch((error) => {
        logger.error('Prefill: services fetch error', error);
        return { services: [] };
      }),
      fetchConnectStatus(),
    ]);

    const barber = me.barber;
    const businessName = barber?.business_name || me.profile.name || userProfile?.business_name || userProfile?.name || '';
    const location = [barber?.city, barber?.state].filter(Boolean).join(', ');
    const services: Service[] = servicesRes.services
      .filter((s) => s.is_active)
      .map((s) => ({
        id: s.id,
        name: s.name,
        price: Number(centsToDollarInput(s.price_cents)),
        duration: s.duration_minutes,
      }));
    const filled = (current: string, server: string | null | undefined) =>
      current && current.trim() ? current : server || '';

    setFormData((prev) => ({
      ...prev,
      businessName: filled(prev.businessName, businessName),
      bio: filled(prev.bio, barber?.bio),
      specialties: prev.specialties.length > 0 ? prev.specialties : barber?.specialties ?? [],
      socialMedia: {
        ...prev.socialMedia,
        instagram: filled(prev.socialMedia.instagram, barber?.instagram),
        tiktok: filled(prev.socialMedia.tiktok, barber?.tiktok),
      },
      phone: filled(prev.phone, me.profile.phone),
      location: filled(prev.location, location),
      services: services.length > 0 ? services : prev.services,
      stripeConnected: prev.stripeConnected || isStripeReady(connect),
    }));

    setStripeStatus(connect?.hasAccount ? (isStripeReady(connect) ? 'active' : 'pending') : null);
    prefillDoneRef.current = true;
  } catch (error) {
    logger.error('Prefill: unexpected error', error);
  }
};

export default runBarberPrefillOnce;
