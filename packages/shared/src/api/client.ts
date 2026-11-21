// Typed client for the Talii API, shared by the web and mobile apps.
//
//   const api = createApiClient({
//     baseUrl: '',                       // web: same origin; mobile: 'https://<host>'
//     getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
//   })
//   const { bookings } = await api.bookings.list({ as: 'barber', status: ['confirmed'] })
//
// Every call sends `Authorization: Bearer <token>` when the route needs (or can
// use) a signed-in user. Failures throw ApiError with the server's status and
// code; a request that never got a response throws ApiError(0, 'NETWORK_ERROR').
// Nothing here logs, so tokens and request bodies never reach a console.

import { ApiError } from './errors'
import type {
  AdminReport,
  AdminReview,
  AdminStats,
  AdminUpdateUserBody,
  AdminUpdateUserResponse,
  AdminUser,
  AdminUsersQuery,
  AddonRow,
  ApiReportStatus,
  AvailabilityResponse,
  BarberProfileResponse,
  BarberReviewsResponse,
  BecomeBarberBody,
  BecomeBarberResponse,
  BlockEntry,
  BookingAction,
  BookingActionResponse,
  BookingRow,
  CatalogDeleteResponse,
  ConnectLinkResponse,
  ConnectStatusResponse,
  CreateAddonBody,
  CreateBookingBody,
  CreateBookingResponse,
  CreateManualBookingBody,
  CreateReportBody,
  CreateReviewBody,
  CreateServiceBody,
  CreateUploadBody,
  DeleteMeResponse,
  EarningsQuery,
  EarningsResponse,
  GeocodeResult,
  ListBarbersQuery,
  ListBarbersResponse,
  ListBookingsQuery,
  ListBookingsResponse,
  MeResponse,
  OwnReport,
  OwnReview,
  Pagination,
  PutSpecialHoursBody,
  PutSpecialHoursResponse,
  ReportRow,
  ReverseGeocodeResult,
  ServiceRow,
  SpecialHoursRow,
  SupportBody,
  UpdateAddonBody,
  UpdateMeBody,
  UpdateMeResponse,
  UpdateReviewBody,
  UpdateServiceBody,
  UploadTicket,
  WeeklyWindowInput,
  WeeklyWindowRow,
} from './types'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/**
 * required: the route needs a signed-in user; without a token the call fails
 *           with 401 UNAUTHORIZED before any request is made.
 * optional: public route that personalises when signed in (blocks); the token
 *           is sent when there is one.
 * none:     public route; no token is sent.
 */
export type AuthRequirement = 'required' | 'optional' | 'none'

export type QueryValue = string | number | boolean | null | undefined | Array<string | number>

export interface RequestOptions {
  query?: Record<string, QueryValue>
  body?: unknown
  auth?: AuthRequirement
  signal?: AbortSignal
}

export interface ApiClientOptions {
  /** Origin of the API, without a trailing slash. '' means same origin (web). */
  baseUrl: string
  /** The current Supabase access token, or null when signed out. Called per request. */
  getAccessToken: () => string | null | undefined | Promise<string | null | undefined>
  /** Defaults to the global fetch. */
  fetch?: typeof fetch
  /** Abort requests that take longer than this. Default 30 s; 0 disables. */
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 30_000

function buildQuery(query: Record<string, QueryValue> | undefined): string {
  if (!query) return ''
  const parts: string[] = []
  for (const [key, raw] of Object.entries(query)) {
    if (raw === undefined || raw === null) continue
    const value = Array.isArray(raw) ? raw.join(',') : String(raw)
    if (Array.isArray(raw) && raw.length === 0) continue
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
  }
  return parts.length > 0 ? `?${parts.join('&')}` : ''
}

function seg(value: string): string {
  return encodeURIComponent(value)
}

const NOT_JSON = Symbol('not-json')

/** The parsed JSON body; undefined when empty, NOT_JSON when the body is not JSON. */
function parseText(text: string): unknown {
  if (text.length === 0) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return NOT_JSON
  }
}

function toApiError(status: number, statusText: string, body: unknown): ApiError {
  if (body && typeof body === 'object' && 'error' in body) {
    const { error, ...rest } = body as { error: unknown } & Record<string, unknown>
    if (error && typeof error === 'object') {
      const e = error as { code?: unknown; message?: unknown }
      const code = typeof e.code === 'string' ? e.code : `HTTP_${status}`
      const message = typeof e.message === 'string' && e.message ? e.message : statusText || 'Request failed.'
      return new ApiError(status, code, message, Object.keys(rest).length > 0 ? rest : undefined)
    }
    if (typeof error === 'string') return new ApiError(status, `HTTP_${status}`, error)
  }
  return new ApiError(status, `HTTP_${status}`, statusText || 'Request failed.')
}

export function createApiClient(options: ApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, '')
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  async function token(auth: AuthRequirement): Promise<string | null> {
    if (auth === 'none') return null
    try {
      return (await options.getAccessToken()) || null
    } catch {
      if (auth === 'required') throw new ApiError(401, 'UNAUTHORIZED', 'Sign in to continue.')
      return null
    }
  }

  /** Low-level call: resolves with the parsed JSON body (undefined for 204), throws ApiError. */
  async function request<T>(method: HttpMethod, path: string, opts: RequestOptions = {}): Promise<T> {
    const auth = opts.auth ?? 'required'
    const accessToken = await token(auth)
    if (auth === 'required' && !accessToken) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in to continue.')

    const headers: Record<string, string> = { Accept: 'application/json' }
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
    const hasBody = opts.body !== undefined
    if (hasBody) headers['Content-Type'] = 'application/json'

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const onAbort = () => controller?.abort()
    if (opts.signal) {
      if (opts.signal.aborted) controller?.abort()
      else opts.signal.addEventListener('abort', onAbort)
    }
    const timer = controller && timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null

    const doFetch = options.fetch ?? fetch
    const failure = (): ApiError => {
      const aborted = !!controller?.signal.aborted
      const byCaller = !!opts.signal?.aborted
      return new ApiError(
        0,
        byCaller ? 'ABORTED' : aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
        byCaller
          ? 'The request was cancelled.'
          : aborted
            ? 'The server took too long to respond. Please try again.'
            : 'Could not reach the server. Check your connection and try again.'
      )
    }

    // The timeout (and the caller's signal) covers the whole exchange, body included.
    let res: Response
    let text: string
    try {
      res = await doFetch(`${baseUrl}${path}${buildQuery(opts.query)}`, {
        method,
        headers,
        body: hasBody ? JSON.stringify(opts.body) : undefined,
        signal: controller?.signal,
      })
      text = res.status === 204 ? '' : await res.text()
    } catch {
      throw failure()
    } finally {
      if (timer) clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onAbort)
    }

    if (res.status === 204) return undefined as T
    const body = parseText(text)
    if (!res.ok) throw toApiError(res.status, res.statusText, body === NOT_JSON ? undefined : body)
    if (body === NOT_JSON) {
      throw new ApiError(res.status, 'INVALID_RESPONSE', 'The server sent an unexpected response. Please try again.')
    }
    return body as T
  }

  const get = <T>(path: string, query?: RequestOptions['query'], auth?: AuthRequirement) =>
    request<T>('GET', path, { query, auth })
  const send = <T>(method: HttpMethod, path: string, body?: unknown, auth?: AuthRequirement) =>
    request<T>(method, path, { body, auth })

  return {
    request,

    me: {
      get: () => get<MeResponse>('/api/me'),
      update: (body: UpdateMeBody) => send<UpdateMeResponse>('PATCH', '/api/me', body),
      /** 409 HAS_UPCOMING_BOOKINGS carries DeleteMeConflict in ApiError.details. */
      delete: () => send<DeleteMeResponse>('DELETE', '/api/me', { confirm: true }),
      becomeBarber: (body: BecomeBarberBody = {}) => send<BecomeBarberResponse>('POST', '/api/me/barber', body),
    },

    uploads: {
      /** Then upload with storage.from(bucket).uploadToSignedUrl(path, token, file) and save publicUrl. */
      create: (body: CreateUploadBody) => send<UploadTicket>('POST', '/api/uploads', body),
    },

    services: {
      list: () => get<{ services: ServiceRow[] }>('/api/me/services'),
      create: (body: CreateServiceBody) => send<{ service: ServiceRow }>('POST', '/api/me/services', body),
      update: (id: string, body: UpdateServiceBody) =>
        send<{ service: ServiceRow }>('PATCH', `/api/me/services/${seg(id)}`, body),
      remove: (id: string) => send<CatalogDeleteResponse>('DELETE', `/api/me/services/${seg(id)}`),
    },

    addons: {
      list: () => get<{ addons: AddonRow[] }>('/api/me/addons'),
      create: (body: CreateAddonBody) => send<{ addon: AddonRow }>('POST', '/api/me/addons', body),
      update: (id: string, body: UpdateAddonBody) =>
        send<{ addon: AddonRow }>('PATCH', `/api/me/addons/${seg(id)}`, body),
      remove: (id: string) => send<CatalogDeleteResponse>('DELETE', `/api/me/addons/${seg(id)}`),
    },

    schedule: {
      getWeek: () => get<{ availability: WeeklyWindowRow[] }>('/api/me/availability'),
      replaceWeek: (windows: WeeklyWindowInput[]) =>
        send<{ availability: WeeklyWindowRow[] }>('PUT', '/api/me/availability', { windows }),
      listSpecialHours: (range: { from?: string; to?: string } = {}) =>
        get<{ specialHours: SpecialHoursRow[] }>('/api/me/special-hours', range),
      putSpecialHours: (body: PutSpecialHoursBody) =>
        send<PutSpecialHoursResponse>('PUT', '/api/me/special-hours', body),
      deleteSpecialHours: (date: string) =>
        request<{ deleted: true }>('DELETE', '/api/me/special-hours', { query: { date } }),
    },

    barbers: {
      list: (query: ListBarbersQuery = {}) => get<ListBarbersResponse>('/api/barbers', query, 'optional'),
      get: (id: string) => get<BarberProfileResponse>(`/api/barbers/${seg(id)}`, undefined, 'optional'),
      getByUsername: (username: string) =>
        get<BarberProfileResponse>(`/api/barbers/by-username/${seg(username)}`, undefined, 'optional'),
      availability: (barberId: string, query: { date: string; serviceId: string }) =>
        get<AvailabilityResponse>(`/api/barbers/${seg(barberId)}/availability`, query, 'optional'),
      reviews: (barberId: string, query: { limit?: number; offset?: number } = {}) =>
        get<BarberReviewsResponse>(`/api/barbers/${seg(barberId)}/reviews`, query, 'optional'),
    },

    bookings: {
      list: (query: ListBookingsQuery = {}) => get<ListBookingsResponse>('/api/bookings', query),
      create: (body: CreateBookingBody) => send<CreateBookingResponse>('POST', '/api/bookings', body),
      update: (id: string, action: BookingAction) =>
        send<BookingActionResponse>('PATCH', `/api/bookings/${seg(id)}`, action),
      cancel: (id: string, reason?: string) =>
        send<BookingActionResponse>('PATCH', `/api/bookings/${seg(id)}`, { action: 'cancel', reason }),
      complete: (id: string) => send<BookingActionResponse>('PATCH', `/api/bookings/${seg(id)}`, { action: 'complete' }),
      noShow: (id: string) => send<BookingActionResponse>('PATCH', `/api/bookings/${seg(id)}`, { action: 'no_show' }),
      createManual: (body: CreateManualBookingBody) =>
        send<{ booking: BookingRow }>('POST', '/api/bookings/manual', body),
    },

    connect: {
      onboarding: () => send<ConnectLinkResponse>('POST', '/api/stripe/connect/onboarding'),
      dashboard: () => send<ConnectLinkResponse>('POST', '/api/stripe/connect/dashboard'),
      status: () => get<ConnectStatusResponse>('/api/stripe/connect/status'),
    },

    earnings: {
      get: (query: EarningsQuery = {}) => get<EarningsResponse>('/api/earnings', query),
    },

    reviews: {
      listOwn: (bookingId?: string) => get<{ reviews: OwnReview[] }>('/api/reviews', { bookingId }),
      create: (body: CreateReviewBody) => send<{ review: OwnReview }>('POST', '/api/reviews', body),
      update: (id: string, body: UpdateReviewBody) => send<{ review: OwnReview }>('PATCH', `/api/reviews/${seg(id)}`, body),
      remove: (id: string) => send<{ deleted: true }>('DELETE', `/api/reviews/${seg(id)}`),
    },

    reports: {
      create: (body: CreateReportBody) => send<{ report: OwnReport }>('POST', '/api/reports', body),
    },

    blocks: {
      list: () => get<{ blocks: BlockEntry[] }>('/api/blocks'),
      block: (userId: string) => send<{ blocked: true }>('POST', '/api/blocks', { userId }),
      unblock: (userId: string) => send<{ removed: boolean }>('DELETE', `/api/blocks/${seg(userId)}`),
    },

    geocode: {
      /** Places Autocomplete (at most 3 results, with coordinates). */
      autocomplete: (q: string) => get<GeocodeResult[]>('/api/geocode', { q }),
      /** Geocoding of free text or of city/state (at most 5 results). */
      search: (input: { q: string } | { city?: string; state?: string }) =>
        get<GeocodeResult[]>('/api/geocode', { ...input, type: 'geocode' }),
      reverse: (lat: number, lng: number) =>
        get<ReverseGeocodeResult | null>('/api/geocode', { latlng: `${lat},${lng}`, type: 'reverse' }),
    },

    support: {
      send: (body: SupportBody) => send<{ sent: true }>('POST', '/api/support', body, 'none'),
    },

    waitlist: {
      join: (email: string) => send<{ success: true }>('POST', '/api/waitlist', { email }, 'none'),
    },

    health: () => get<{ status: string; timestamp: string }>('/api/health', undefined, 'none'),

    admin: {
      listUsers: (query: AdminUsersQuery = {}) =>
        get<{ users: AdminUser[]; pagination: Pagination }>('/api/admin/users', query),
      updateUser: (id: string, body: AdminUpdateUserBody) =>
        send<AdminUpdateUserResponse>('PATCH', `/api/admin/users/${seg(id)}`, body),
      stats: (days?: number) => get<{ since: string; stats: AdminStats }>('/api/admin/stats', { days }),
      listReports: (query: { status?: ApiReportStatus; limit?: number; offset?: number } = {}) =>
        get<{ reports: AdminReport[]; pagination: Pagination }>('/api/admin/reports', query),
      updateReport: (id: string, status: ApiReportStatus) =>
        send<{ report: ReportRow }>('PATCH', `/api/admin/reports/${seg(id)}`, { status }),
      listReviews: (query: { hidden?: boolean; barberId?: string; limit?: number; offset?: number } = {}) =>
        get<{ reviews: AdminReview[]; pagination: Pagination }>('/api/admin/reviews', query),
      setReviewHidden: (id: string, isHidden: boolean) =>
        send<{ review: OwnReview }>('PATCH', `/api/admin/reviews/${seg(id)}`, { isHidden }),
      deleteMedia: (url: string) =>
        send<{ removed: boolean; cleared: Array<'avatar_url' | 'cover_photo_url' | 'portfolio'> }>(
          'DELETE',
          '/api/admin/media',
          { url }
        ),
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
