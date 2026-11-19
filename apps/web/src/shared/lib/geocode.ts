// Geocoding helpers backed by GET /api/geocode (Google Maps, US only, signed-in
// users only; the API key stays on the server). Each helper returns an empty
// result instead of throwing (signed out, rate limited, or not configured).
import type { GeocodeResult } from '@barber-app/shared'
import { api } from './api'
import { logger } from './logger'

export type { GeocodeResult }

export async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  if (typeof window === 'undefined' || !address.trim()) return null
  try {
    const results = await api.geocode.search({ q: address })
    return results.length > 0 ? { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) } : null
  } catch (error) {
    logger.error('Error geocoding address', error)
    return null
  }
}

/** Address autocomplete suggestions. */
export async function getAddressSuggestions(
  query: string
): Promise<Array<{ name: string; city?: string; country?: string; lat: number; lon: number }>> {
  const results = await getAddressSuggestionsDetailed(query)
  return results.map((item) => ({
    name: item.display_name,
    city: item.address?.city,
    country: item.address?.country,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
  }))
}

/** Autocomplete results with the full address map (house_number, road, city, state, postcode, country). */
export async function getAddressSuggestionsDetailed(query: string): Promise<GeocodeResult[]> {
  if (typeof window === 'undefined') return []
  if (!query || query.trim().length < 3) return []
  try {
    return await api.geocode.autocomplete(query.trim())
  } catch (error) {
    logger.error('Error fetching address suggestions', error)
    return []
  }
}

export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<{ name: string; city?: string; state?: string; country?: string } | null> {
  if (typeof window === 'undefined') return null
  try {
    return await api.geocode.reverse(lat, lon)
  } catch (error) {
    logger.error('Error reverse geocoding', error)
    return null
  }
}

/** City and state from a geocoding result, or from a "…, City, ST" string. */
export function cityStateOf(input: GeocodeResult | string | null | undefined): { city: string | null; state: string | null } {
  if (!input) return { city: null, state: null }
  if (typeof input !== 'string') {
    const a = input.address || {}
    return { city: a.city || a.town || a.village || null, state: a.state || null }
  }
  const parts = input.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) return { city: parts[parts.length - 2], state: parts[parts.length - 1] }
  return { city: parts[0] ?? null, state: null }
}
