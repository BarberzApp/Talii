/**
 * Extra fake behaviour for the Phase 3b routes: the search / schedule / stats
 * database functions and the reviews views, computed from the FakeDb tables.
 * Not imported by production code.
 */
import { IDS } from './fixtures'
import { fakeUuid, type FakeDb, type Row } from './fake-supabase'

function listed(db: FakeDb, barber: Row): boolean {
  const owner = db.one('profiles', { id: barber.user_id })
  return barber.is_public === true && barber.listing_suspended !== true && !!owner && owner.is_disabled !== true
}

function card(db: FakeDb, b: Row): Row {
  const p = db.one('profiles', { id: b.user_id }) ?? {}
  return {
    id: b.id,
    user_id: b.user_id,
    business_name: b.business_name ?? null,
    bio: b.bio ?? null,
    specialties: b.specialties ?? [],
    city: b.city ?? null,
    state: b.state ?? null,
    latitude: b.latitude ?? null,
    longitude: b.longitude ?? null,
    name: p.name ?? null,
    username: p.username,
    avatar_url: p.avatar_url ?? null,
  }
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (d: number) => (d * Math.PI) / 180
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2
  return 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Wires nearby_barbers, search_barbers, replace_availability and admin_platform_stats. */
export function installApiFunctions(db: FakeDb): FakeDb {
  db.rpcHandlers.nearby_barbers = (args, fake) => {
    const rows = fake
      .table('barbers')
      .filter((b) => listed(fake, b) && typeof b.latitude === 'number' && typeof b.longitude === 'number')
      .map((b) => ({
        ...card(fake, b),
        distance_miles: haversineMiles(
          Number(args.p_latitude),
          Number(args.p_longitude),
          Number(b.latitude),
          Number(b.longitude)
        ),
      }))
      .filter((b) => b.distance_miles <= Number(args.p_radius_miles ?? 25))
      .sort((a, b) => a.distance_miles - b.distance_miles)
      .slice(0, Math.min(Math.max(Number(args.p_limit ?? 50), 1), 200))
    return { data: rows, error: null }
  }

  db.rpcHandlers.search_barbers = (args, fake) => {
    const term = String(args.p_query ?? '').trim().toLowerCase()
    const exclude = (args.p_exclude_user_ids as string[] | undefined) ?? []
    const rows = fake
      .table('barbers')
      .filter((b) => listed(fake, b) && !exclude.includes(String(b.user_id)))
      .map((b) => card(fake, b))
      .filter(
        (c) =>
          !term ||
          [c.business_name, c.name, c.username, c.city, c.state].some(
            (f) => typeof f === 'string' && f.toLowerCase().includes(term)
          )
      )
      .sort((a, b) =>
        String(a.business_name ?? a.name ?? a.username).toLowerCase() <
        String(b.business_name ?? b.name ?? b.username).toLowerCase()
          ? -1
          : 1
      )
    const offset = Number(args.p_offset ?? 0)
    return { data: rows.slice(offset, offset + Number(args.p_limit ?? 20)), error: null }
  }

  db.rpcHandlers.replace_availability = (args, fake) => {
    const windows = args.p_windows as Array<{ day_of_week: number; start_time: string; end_time: string }>
    if (!Array.isArray(windows)) return { data: null, error: { code: '22023', message: 'p_windows must be a JSON array' } }
    const kept = fake.table('availability').filter((r) => r.barber_id !== args.p_barber_id)
    const added = windows.map((w) => ({
      id: fakeUuid(),
      barber_id: args.p_barber_id,
      day_of_week: w.day_of_week,
      start_time: `${w.start_time}:00`,
      end_time: `${w.end_time}:00`,
    }))
    fake.tables.availability = [...kept, ...added]
    return { data: added, error: null }
  }

  db.rpcHandlers.admin_platform_stats = (_args, fake) => {
    const charges = fake.table('payments').filter((p) => p.type === 'charge' && p.status === 'succeeded')
    return {
      data: [
        {
          users_total: fake.table('profiles').length,
          barbers_total: fake.rows('profiles', { role: 'barber' }).length,
          platform_fees_cents: charges.reduce((s, c) => s + Number(c.application_fee_cents), 0),
        },
      ],
      error: null,
    }
  }
  return db
}

/** Adds a review and keeps the public_reviews / barber_rating_stats "views" in step. */
export function addReview(db: FakeDb, review: Row): Row {
  const row: Row = {
    id: fakeUuid(),
    barber_id: IDS.barber,
    client_id: IDS.clientUser,
    rating: 5,
    comment: null,
    is_hidden: false,
    created_at: new Date().toISOString(),
    ...review,
  }
  db.table('reviews').push(row)
  refreshReviewViews(db)
  return row
}

export function refreshReviewViews(db: FakeDb): void {
  const visible = db.table('reviews').filter((r) => !r.is_hidden)
  db.tables.public_reviews = visible.map((r) => {
    const p = db.one('profiles', { id: r.client_id })
    return {
      id: r.id,
      barber_id: r.barber_id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      reviewer_name: p && !p.is_disabled ? String(p.name ?? p.username).split(' ')[0] : null,
      reviewer_avatar_url: p && !p.is_disabled ? p.avatar_url ?? null : null,
    }
  })
  const byBarber = new Map<string, number[]>()
  for (const r of visible) byBarber.set(String(r.barber_id), [...(byBarber.get(String(r.barber_id)) ?? []), Number(r.rating)])
  db.tables.barber_rating_stats = [...byBarber].map(([barber_id, ratings]) => ({
    barber_id,
    review_count: ratings.length,
    average_rating: Math.round((ratings.reduce((s, x) => s + x, 0) / ratings.length) * 100) / 100,
  }))
}

/** Public URL of an object in the fake storage (matches TEST_ENV's Supabase URL). */
export function storageUrl(bucket: string, path: string): string {
  return `http://localhost:54321/storage/v1/object/public/${bucket}/${path}`
}
