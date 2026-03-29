// Geocoding helpers for React Native — backed by Google Maps Platform APIs
// Requests are proxied through the Next.js backend to keep the API key server-side.
import { logger } from './logger';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.bocmstyle.com';

/** Geocode a full address string to { lat, lon } */
export async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  const url = `${API_BASE_URL}/api/nominatim?type=geocode&q=${encodeURIComponent(address)}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
  } catch (error) {
    logger.error('Error geocoding address:', error);
    return null;
  }
}

/** Get address autocomplete suggestions (Google Places Autocomplete) */
export async function getAddressSuggestions(
  query: string
): Promise<Array<{ name: string; city?: string; country?: string; lat: number; lon: number }>> {
  if (!query || query.length < 3) return [];
  const url = `${API_BASE_URL}/api/nominatim?q=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return (data || []).map((item: any) => ({
      name: item.display_name,
      city: item.address?.city,
      country: item.address?.country,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
    }));
  } catch (error) {
    logger.error('Error fetching address suggestions:', error);
    return [];
  }
}

/**
 * Get address autocomplete suggestions — returns raw normalized objects including
 * the full `address` component map (house_number, road, city, state, etc.)
 * from Google Places / Geocoding API.
 */
export async function getAddressSuggestionsDetailed(query: string): Promise<Array<any>> {
  if (!query || query.length < 3) return [];
  const url = `${API_BASE_URL}/api/nominatim?q=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data || [];
  } catch (error) {
    logger.error('Error fetching address suggestions:', error);
    return [];
  }
}

/**
 * @deprecated Use `getAddressSuggestionsDetailed` instead.
 * Kept for backward compatibility.
 */
export const getAddressSuggestionsNominatim = getAddressSuggestionsDetailed;

/** Reverse geocode a lat/lon to an address object (Google Geocoding API) */
export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<{ name: string; city?: string; country?: string } | null> {
  const url = `${API_BASE_URL}/api/nominatim?type=reverse&latlng=${lat},${lon}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data && data.name) {
      return { name: data.name, city: data.city, country: data.country };
    }
    return null;
  } catch (error) {
    logger.error('Error reverse geocoding:', error);
    return null;
  }
}

/** Validate an address string — returns true if Google can geocode it */
export async function validateAddress(address: string): Promise<boolean> {
  const url = `${API_BASE_URL}/api/nominatim?type=geocode&q=${encodeURIComponent(address)}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return Array.isArray(data) && data.length > 0;
  } catch (error) {
    logger.error('Error validating address:', error);
    return false;
  }
}