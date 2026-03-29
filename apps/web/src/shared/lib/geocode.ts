// Geocoding helpers — backed by Google Maps Platform (Places API + Geocoding API)
// All requests go through the /api/nominatim server-side proxy to keep the API key safe.
import { logger } from './logger';

export async function geocodeAddress(address: string): Promise<{ lat: number, lon: number } | null> {
  if (typeof window === 'undefined') return null;
  const url = `/api/nominatim?type=geocode&q=${encodeURIComponent(address)}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
  } catch (error) {
    logger.error('Error geocoding address', error);
    return null;
  }
}

/** Address autocomplete suggestions (Google Places Autocomplete) */
export async function getAddressSuggestions(
  query: string
): Promise<Array<{ name: string; city?: string; country?: string; lat: number; lon: number }>> {
  if (typeof window === 'undefined') return [];
  if (!query || query.length < 3) return [];
  const url = `/api/nominatim?q=${encodeURIComponent(query)}`;
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
    logger.error('Error fetching address suggestions', error);
    return [];
  }
}

/**
 * Address autocomplete suggestions — returns raw normalized objects including
 * the full `address` component map (house_number, road, city, state, etc.)
 * from Google Places / Geocoding API.
 */
export async function getAddressSuggestionsDetailed(query: string): Promise<Array<any>> {
  if (typeof window === 'undefined') return [];
  if (!query || query.length < 3) return [];
  const url = `/api/nominatim?q=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data || [];
  } catch (error) {
    logger.error('Error fetching address suggestions', error);
    return [];
  }
}

/**
 * @deprecated Use `getAddressSuggestionsDetailed` instead.
 * Kept for backward compatibility.
 */
export const getAddressSuggestionsNominatim = getAddressSuggestionsDetailed;

export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<{ name: string; city?: string; country?: string } | null> {
  if (typeof window === 'undefined') return null;
  const url = `/api/nominatim?type=reverse&latlng=${lat},${lon}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data && data.name) {
      return { name: data.name, city: data.city, country: data.country };
    }
    return null;
  } catch (error) {
    logger.error('Error reverse geocoding', error);
    return null;
  }
}