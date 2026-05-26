import { NextRequest, NextResponse } from 'next/server';
import { handleCorsPreflight, withCors } from '@/shared/lib/cors';
import { logger } from '@/shared/lib/logger';

// Google Maps Platform proxy
// Supports:
//   ?q=<query>                    → Places Autocomplete (address suggestions)
//   ?q=<query>&type=geocode       → Geocoding API (address → lat/lon)
//   ?latlng=<lat,lon>&type=reverse → Reverse Geocoding (lat/lon → address)

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/** Map a Google Geocoding result to the Nominatim-compatible shape expected by callers */
function normalizeGeocodeResult(result: any) {
  const lat = result.geometry?.location?.lat?.toString() ?? '';
  const lon = result.geometry?.location?.lng?.toString() ?? '';
  const addressComponents: Record<string, string> = {};
  for (const c of result.address_components ?? []) {
    if (c.types.includes('street_number')) addressComponents.house_number = c.long_name;
    if (c.types.includes('route')) addressComponents.road = c.long_name;
    if (c.types.includes('locality')) addressComponents.city = c.long_name;
    if (c.types.includes('administrative_area_level_1')) addressComponents.state = c.short_name;
    if (c.types.includes('postal_code')) addressComponents.postcode = c.long_name;
    if (c.types.includes('country')) addressComponents.country = c.long_name;
  }
  return {
    place_id: result.place_id ?? '',
    display_name: result.formatted_address ?? '',
    lat,
    lon,
    address: addressComponents,
  };
}

/** Map a Google Places Autocomplete prediction to Nominatim-compatible shape */
async function expandAutocompleteToGeocode(placeId: string): Promise<any> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${encodeURIComponent(placeId)}&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.length) return null;
  return normalizeGeocodeResult(data.results[0]);
}

export async function GET(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  if (preflightResponse) return preflightResponse;

  if (!GOOGLE_MAPS_API_KEY) {
    logger.error('GOOGLE_MAPS_API_KEY is not set');
    const err = NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });
    return withCors(request, err);
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const city = searchParams.get('city');
  const state = searchParams.get('state');
  const latlng = searchParams.get('latlng');
  const type = searchParams.get('type'); // 'geocode' | 'reverse' | undefined (default = autocomplete)

  try {
    // ── Reverse Geocoding ──────────────────────────────────────────────────────
    if (type === 'reverse' && latlng) {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(latlng)}&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status !== 'OK' || !data.results?.length) {
        return withCors(request, NextResponse.json(null));
      }

      const first = data.results[0];
      const address: Record<string, string> = {};
      for (const c of first.address_components ?? []) {
        if (c.types.includes('locality')) address.city = c.long_name;
        if (c.types.includes('administrative_area_level_1')) address.state = c.short_name;
        if (c.types.includes('country')) address.country = c.long_name;
      }

      return withCors(request, NextResponse.json({
        name: first.formatted_address,
        city: address.city,
        state: address.state,
        country: address.country,
      }));
    }

    // ── Geocoding (address → lat/lon, single result) ───────────────────────────
    let query = q;
    if (city && state) query = `${city}, ${state}`;
    else if (city) query = city;
    else if (state) query = state;

    if (!query) {
      return withCors(request, NextResponse.json({ error: 'Missing query' }, { status: 400 }));
    }

    if (type === 'geocode') {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&components=country:US&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status !== 'OK' || !data.results?.length) {
        return withCors(request, NextResponse.json([]));
      }

      const results = data.results.slice(0, 5).map(normalizeGeocodeResult);
      return withCors(request, NextResponse.json(results));
    }

    // ── Place Autocomplete (default) ───────────────────────────────────────────
    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(query)}` +
      `&types=address` +
      `&components=country:us` +
      `&key=${GOOGLE_MAPS_API_KEY}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Places API responded with status: ${data.status}`);
    }

    // Enrich predictions with full geocode data (lat, lon, address components)
    const predictions = data.predictions ?? [];
    const normalized = await Promise.all(
      predictions.slice(0, 5).map((p: any) => expandAutocompleteToGeocode(p.place_id))
    );

    return withCors(request, NextResponse.json(normalized.filter(Boolean)));
  } catch (error) {
    logger.error('Error fetching from Google Maps API', error);
    const errorResponse = NextResponse.json({ error: 'Failed to fetch location data' }, { status: 500 });
    return withCors(request, errorResponse);
  }
}

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request) || new NextResponse(null, { status: 200 });
}