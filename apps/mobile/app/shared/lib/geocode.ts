// Geocoding helpers, proxied by GET /api/geocode (Google Maps; the key stays on
// the server). The route needs a signed-in user: signed-out calls throw
// ApiError 401 inside and these helpers return empty results.
import type { GeocodeResult } from '@barber-app/shared';
import { api, isApiError } from './api';
import { logger } from './logger';

function logFailure(what: string, error: unknown) {
  if (isApiError(error) && error.status === 401) return; // signed out: no geocoding
  logger.error(`Geocoding failed (${what})`, { code: isApiError(error) ? error.code : 'UNKNOWN' });
}

/**
 * Address autocomplete suggestions (Google Places): normalized results including
 * the `address` component map (house_number, road, city, state, postcode, ...).
 */
export async function getAddressSuggestionsDetailed(query: string): Promise<GeocodeResult[]> {
  if (!query || query.length < 3) return [];
  try {
    return await api.geocode.autocomplete(query);
  } catch (error) {
    logFailure('autocomplete', error);
    return [];
  }
}

/**
 * City and state from a free-text location such as "Brooklyn, NY",
 * "Brooklyn, NY 11201, USA" or "123 Main St, Brooklyn, NY 11201, USA".
 * The listing's coordinates are geocoded by the server from city/state.
 */
export function parseCityState(location: string): { city: string | null; state: string | null } {
  const parts = location
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length > 1 && /^(usa|us|united states( of america)?)$/i.test(parts[parts.length - 1])) parts.pop();
  if (parts.length === 0) return { city: null, state: null };
  if (parts.length === 1) return { city: parts[0], state: null };
  // "NY 11201" -> "NY"
  const state = parts[parts.length - 1].replace(/\s+\d{5}(-\d{4})?$/, '').trim() || null;
  return { city: parts[parts.length - 2] || null, state };
}
