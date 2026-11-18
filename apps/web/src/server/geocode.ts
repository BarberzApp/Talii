import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { getServerEnv } from './env'
import { ApiError } from './errors'

/**
 * Google Maps Platform calls (Geocoding API and Places Autocomplete), US only.
 * The API key never leaves the server and is never logged: errors carry the
 * Google status, not the request URL.
 */

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'
const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json'
const TIMEOUT_MS = 5000

/** Most results returned, and most place details fetched per autocomplete request. */
export const MAX_GEOCODE_RESULTS = 5
export const MAX_AUTOCOMPLETE_EXPANSIONS = 3

/** Nominatim-compatible shape the web and mobile callers already parse. */
export interface GeocodeResult {
  place_id: string
  display_name: string
  lat: string
  lon: string
  address: Record<string, string>
}

export interface ReverseGeocodeResult {
  name: string
  city?: string
  state?: string
  country?: string
}

interface GoogleComponent {
  long_name: string
  short_name: string
  types: string[]
}

interface GoogleGeocodeResult {
  place_id?: string
  formatted_address?: string
  geometry?: { location?: { lat?: number; lng?: number } }
  address_components?: GoogleComponent[]
}

interface GoogleResponse {
  status?: string
  results?: GoogleGeocodeResult[]
  predictions?: Array<{ place_id?: string }>
}

function apiKey(): string {
  const key = getServerEnv().GOOGLE_MAPS_API_KEY
  if (!key) throw new ApiError(503, 'GEOCODING_UNAVAILABLE', 'Location search is not available right now.')
  return key
}

async function callGoogle(baseUrl: string, params: Record<string, string>): Promise<GoogleResponse> {
  const url = new URL(baseUrl)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('key', apiKey())

  let res: Response
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' })
  } catch {
    throw new ApiError(502, 'GEOCODING_FAILED', 'Location search failed. Please try again.')
  }
  if (!res.ok) throw new ApiError(502, 'GEOCODING_FAILED', 'Location search failed. Please try again.')
  const body = (await res.json().catch(() => ({}))) as GoogleResponse
  if (body.status !== 'OK' && body.status !== 'ZERO_RESULTS') {
    Sentry.captureMessage(`Google Maps API status ${body.status ?? 'unknown'}`, { level: 'warning' })
    throw new ApiError(502, 'GEOCODING_FAILED', 'Location search failed. Please try again.')
  }
  return body
}

function normalize(result: GoogleGeocodeResult): GeocodeResult {
  const address: Record<string, string> = {}
  for (const c of result.address_components ?? []) {
    if (c.types.includes('street_number')) address.house_number = c.long_name
    if (c.types.includes('route')) address.road = c.long_name
    if (c.types.includes('locality')) address.city = c.long_name
    if (c.types.includes('administrative_area_level_1')) address.state = c.short_name
    if (c.types.includes('postal_code')) address.postcode = c.long_name
    if (c.types.includes('country')) address.country = c.long_name
  }
  return {
    place_id: result.place_id ?? '',
    display_name: result.formatted_address ?? '',
    lat: result.geometry?.location?.lat?.toString() ?? '',
    lon: result.geometry?.location?.lng?.toString() ?? '',
    address,
  }
}

/** Address text → up to 5 matches with coordinates. */
export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  const body = await callGoogle(GEOCODE_URL, { address: query, components: 'country:US' })
  return (body.results ?? []).slice(0, MAX_GEOCODE_RESULTS).map(normalize)
}

/** Address suggestions while typing, each expanded to coordinates (at most 3 detail lookups). */
export async function autocompleteAddress(query: string): Promise<GeocodeResult[]> {
  const body = await callGoogle(AUTOCOMPLETE_URL, { input: query, types: 'address', components: 'country:us' })
  const placeIds = (body.predictions ?? [])
    .map((p) => p.place_id)
    .filter((id): id is string => !!id)
    .slice(0, MAX_AUTOCOMPLETE_EXPANSIONS)

  const expanded = await Promise.all(
    placeIds.map(async (placeId) => {
      try {
        const detail = await callGoogle(GEOCODE_URL, { place_id: placeId })
        return detail.results?.[0] ? normalize(detail.results[0]) : null
      } catch {
        return null
      }
    })
  )
  return expanded.filter((r): r is GeocodeResult => r !== null)
}

/** Coordinates → city/state/country, or null when nothing matches. */
export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResult | null> {
  const body = await callGoogle(GEOCODE_URL, { latlng: `${lat},${lon}` })
  const first = body.results?.[0]
  if (!first) return null
  const out: ReverseGeocodeResult = { name: first.formatted_address ?? '' }
  for (const c of first.address_components ?? []) {
    if (c.types.includes('locality')) out.city = c.long_name
    if (c.types.includes('administrative_area_level_1')) out.state = c.short_name
    if (c.types.includes('country')) out.country = c.long_name
  }
  return out
}

/**
 * Best-effort "City, ST" → coordinates for a barber's listing. Returns null on
 * any failure (no key, Google error, no match); never throws.
 */
export async function geocodeCityState(
  city: string | null,
  state: string | null
): Promise<{ latitude: number; longitude: number } | null> {
  const query = [city, state].filter((s) => s && s.trim()).join(', ')
  if (!query) return null
  try {
    const [first] = await geocodeAddress(query)
    const latitude = Number(first?.lat)
    const longitude = Number(first?.lon)
    if (!first || !Number.isFinite(latitude) || !Number.isFinite(longitude) || first.lat === '' || first.lon === '') {
      return null
    }
    return { latitude, longitude }
  } catch {
    return null
  }
}
