import 'server-only'
import { getSupabaseAdmin, type Db } from './clients'
import { ApiError } from './errors'
import { hiddenUserIds } from './safety'

/**
 * Public discovery: barber search, public barber profiles and reviews.
 * Only listed barbers (is_public, not suspended by an admin, and the owner's
 * profile not disabled) are
 * returned. When the caller is signed in, users they blocked or who blocked
 * them are left out.
 */

export interface RatingStats {
  review_count: number
  average_rating: number | null
}

const NO_RATING: RatingStats = { review_count: 0, average_rating: null }
/** nearby_barbers clamps its limit to 200, so nearby paging stops there. */
export const NEARBY_MAX_RESULTS = 200

async function ratingsFor(db: Db, barberIds: string[]): Promise<Map<string, RatingStats>> {
  const map = new Map<string, RatingStats>()
  if (barberIds.length === 0) return map
  const { data, error } = await db
    .from('barber_rating_stats')
    .select('barber_id, review_count, average_rating')
    .in('barber_id', barberIds)
  if (error) throw error
  for (const r of data ?? []) {
    if (r.barber_id) {
      map.set(r.barber_id, { review_count: r.review_count ?? 0, average_rating: r.average_rating ?? null })
    }
  }
  return map
}

function matchesQuery(term: string, fields: Array<string | null | undefined>): boolean {
  return fields.some((f) => !!f && f.toLowerCase().includes(term))
}

export interface ListBarbersInput {
  lat?: number
  lng?: number
  radiusMiles: number
  q?: string
  limit: number
  offset: number
}

export interface BarberCard {
  id: string
  user_id: string
  business_name: string | null
  bio: string | null
  specialties: string[]
  city: string | null
  state: string | null
  name: string | null
  username: string
  avatar_url: string | null
  distance_miles: number | null
  rating: RatingStats
}

/**
 * GET /api/barbers. With lat/lng: nearest first within radiusMiles (via
 * nearby_barbers; `q` then narrows the nearby results). Without: listed
 * barbers whose business name, name, username, city or state contains `q`
 * (search_barbers), alphabetical.
 */
export async function listBarbers(input: ListBarbersInput, callerId: string | null) {
  const db = getSupabaseAdmin()
  const hidden = callerId ? await hiddenUserIds(db, callerId) : []
  const term = input.q?.trim().toLowerCase() || undefined

  let rows: Array<Omit<BarberCard, 'rating'>>
  let hasMore: boolean

  if (input.lat !== undefined && input.lng !== undefined) {
    const { data, error } = await db.rpc('nearby_barbers', {
      p_latitude: input.lat,
      p_longitude: input.lng,
      p_radius_miles: input.radiusMiles,
      p_limit: NEARBY_MAX_RESULTS,
    })
    if (error) throw error
    const hiddenSet = new Set(hidden)
    const matching = (data ?? []).filter(
      (b) =>
        !hiddenSet.has(b.user_id) &&
        (!term || matchesQuery(term, [b.business_name, b.name, b.username, b.city, b.state]))
    )
    const page = matching.slice(input.offset, input.offset + input.limit)
    hasMore = matching.length > input.offset + input.limit
    rows = page.map((b) => ({
      id: b.id,
      user_id: b.user_id,
      business_name: b.business_name,
      bio: b.bio,
      specialties: b.specialties ?? [],
      city: b.city,
      state: b.state,
      name: b.name,
      username: b.username,
      avatar_url: b.avatar_url,
      distance_miles: Math.round(b.distance_miles * 10) / 10,
    }))
  } else {
    const { data, error } = await db.rpc('search_barbers', {
      p_query: term ?? '',
      p_exclude_user_ids: hidden,
      p_limit: input.limit + 1,
      p_offset: input.offset,
    })
    if (error) throw error
    const all = data ?? []
    hasMore = all.length > input.limit
    rows = all.slice(0, input.limit).map((b) => ({
      id: b.id,
      user_id: b.user_id,
      business_name: b.business_name,
      bio: b.bio,
      specialties: b.specialties ?? [],
      city: b.city,
      state: b.state,
      name: b.name,
      username: b.username,
      avatar_url: b.avatar_url,
      distance_miles: null,
    }))
  }

  const ratings = await ratingsFor(
    db,
    rows.map((r) => r.id)
  )
  return {
    barbers: rows.map((r) => ({ ...r, rating: ratings.get(r.id) ?? NO_RATING })),
    pagination: { limit: input.limit, offset: input.offset, hasMore },
  }
}

const PUBLIC_BARBER_COLUMNS =
  'id, user_id, business_name, bio, specialties, instagram, tiktok, city, state, timezone, portfolio, is_public, listing_suspended, created_at'

type PublicBarberRow = {
  id: string
  user_id: string
  business_name: string | null
  bio: string | null
  specialties: string[]
  instagram: string | null
  tiktok: string | null
  city: string | null
  state: string | null
  timezone: string
  portfolio: string[]
  is_public: boolean
  listing_suspended: boolean
  created_at: string
}

async function findBarber(db: Db, by: { id: string } | { username: string }) {
  if ('id' in by) {
    const { data, error } = await db.from('barbers').select(PUBLIC_BARBER_COLUMNS).eq('id', by.id).maybeSingle()
    if (error) throw error
    return data as PublicBarberRow | null
  }
  // Usernames are unique ignoring case. Escape LIKE wildcards ("_" is common in
  // usernames) so only the case-insensitive exact match can come back.
  const { data: profiles, error } = await db
    .from('profiles')
    .select('id, username')
    .ilike('username', by.username.replace(/[\\%_]/g, '\\$&'))
    .limit(2)
  if (error) throw error
  const owner = (profiles ?? []).find((p) => p.username.toLowerCase() === by.username.toLowerCase())
  if (!owner) return null
  const { data, error: barberError } = await db
    .from('barbers')
    .select(PUBLIC_BARBER_COLUMNS)
    .eq('user_id', owner.id)
    .maybeSingle()
  if (barberError) throw barberError
  return data as PublicBarberRow | null
}

/** A listed barber the caller may see, with its public profile fields; null otherwise. */
async function visibleBarber(db: Db, by: { id: string } | { username: string }, callerId: string | null) {
  const barber = await findBarber(db, by)
  if (!barber || !barber.is_public || barber.listing_suspended) return null

  const { data: profile, error } = await db
    .from('profiles')
    .select('id, name, username, avatar_url, cover_photo_url, is_disabled')
    .eq('id', barber.user_id)
    .maybeSingle()
  if (error) throw error
  if (!profile || profile.is_disabled) return null

  if (callerId && callerId !== barber.user_id) {
    const hidden = await hiddenUserIds(db, callerId)
    if (hidden.includes(barber.user_id)) return null
  }
  return {
    barber,
    profile: {
      id: profile.id,
      name: profile.name,
      username: profile.username,
      avatar_url: profile.avatar_url ?? null,
      cover_photo_url: profile.cover_photo_url ?? null,
    },
  }
}

/** GET /api/barbers/:id and /api/barbers/by-username/:username. */
export async function getBarberProfile(by: { id: string } | { username: string }, callerId: string | null) {
  const db = getSupabaseAdmin()
  const found = await visibleBarber(db, by, callerId)
  if (!found) throw new ApiError(404, 'BARBER_NOT_FOUND', 'Barber not found.')
  const { barber, profile } = found

  const [{ data: services, error: servicesError }, { data: addons, error: addonsError }, ratings] = await Promise.all([
    db
      .from('services')
      .select('id, name, description, duration_minutes, price_cents')
      .eq('barber_id', barber.id)
      .eq('is_active', true)
      .order('price_cents', { ascending: true }),
    db
      .from('service_addons')
      .select('id, name, description, price_cents')
      .eq('barber_id', barber.id)
      .eq('is_active', true)
      .order('price_cents', { ascending: true }),
    ratingsFor(db, [barber.id]),
  ])
  if (servicesError) throw servicesError
  if (addonsError) throw addonsError

  return {
    barber: {
      id: barber.id,
      user_id: barber.user_id,
      business_name: barber.business_name,
      bio: barber.bio,
      specialties: barber.specialties ?? [],
      instagram: barber.instagram,
      tiktok: barber.tiktok,
      city: barber.city,
      state: barber.state,
      timezone: barber.timezone,
      portfolio: barber.portfolio ?? [],
      created_at: barber.created_at,
    },
    profile,
    services: services ?? [],
    addons: addons ?? [],
    rating: ratings.get(barber.id) ?? NO_RATING,
  }
}

/** GET /api/barbers/:id/reviews: visible reviews, newest first, without blocked reviewers. */
export async function listBarberReviews(
  barberId: string,
  callerId: string | null,
  page: { limit: number; offset: number }
) {
  const db = getSupabaseAdmin()
  const found = await visibleBarber(db, { id: barberId }, callerId)
  if (!found) throw new ApiError(404, 'BARBER_NOT_FOUND', 'Barber not found.')

  let excludedReviewIds: string[] = []
  if (callerId) {
    const hidden = await hiddenUserIds(db, callerId)
    if (hidden.length > 0) {
      const { data, error } = await db
        .from('reviews')
        .select('id')
        .eq('barber_id', barberId)
        .in('client_id', hidden)
      if (error) throw error
      excludedReviewIds = (data ?? []).map((r) => r.id)
    }
  }

  let query = db
    .from('public_reviews')
    .select('id, barber_id, rating, comment, created_at, reviewer_name, reviewer_avatar_url', { count: 'exact' })
    .eq('barber_id', barberId)
  if (excludedReviewIds.length > 0) query = query.not('id', 'in', `(${excludedReviewIds.join(',')})`)
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(page.offset, page.offset + page.limit - 1)
  if (error) throw error

  const ratings = await ratingsFor(db, [barberId])
  return {
    reviews: data ?? [],
    rating: ratings.get(barberId) ?? NO_RATING,
    pagination: { limit: page.limit, offset: page.offset, total: count ?? 0 },
  }
}
