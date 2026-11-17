import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { isAuthRetryableFetchError, type User } from '@supabase/supabase-js'
import type { z, ZodTypeAny } from 'zod'
import type { Tables } from '@barber-app/shared'
import { getSupabaseAdmin } from './clients'
import { ApiError, errorResponse, INTERNAL_ERROR_MESSAGE } from './errors'

/**
 * defineRoute: the one wrapper every API route handler uses.
 *
 *   export const POST = defineRoute(
 *     { auth: 'user', body: z.object({ ... }), params: z.object({ id: z.string().uuid() }) },
 *     async ({ user, body, params }) => {
 *       ...
 *       return { booking }            // 200 JSON
 *       // or return Response.json(x, { status: 201 }) for full control
 *     }
 *   )
 *
 * Auth (`Authorization: Bearer <Supabase access token>`; no cookies):
 *   public  no token needed (any token is ignored); user/profile/barber are null.
 *   user    a valid token whose profile exists and is not disabled.
 *   barber  as user, plus the caller's `barbers` row (403 NOT_A_BARBER if none).
 *   admin   as user, plus `app_metadata.role === 'admin'` (server-controlled).
 *
 * Inputs: `body` (JSON), `query` (URL search params, one string per key; use
 * comma lists for arrays) and `params` (dynamic segments) are parsed with the
 * given zod schemas; failures return 400 VALIDATION_ERROR. Without a schema the
 * input is `undefined` and the request body is not read.
 *
 * Errors: throw `ApiError(status, code, message)` for anything the client may
 * see. Everything else becomes 500 INTERNAL with a generic message and is sent
 * to Sentry. Every response body is JSON; errors are `{ error: { code, message } }`.
 *
 * Writes always use the service-role client (`getSupabaseAdmin()`), which
 * bypasses RLS, so the handler must check ownership itself.
 */

export type AuthMode = 'public' | 'user' | 'barber' | 'admin'

export type CallerProfile = Pick<Tables<'profiles'>, 'id' | 'role' | 'name' | 'username' | 'is_disabled'>
export type CallerBarber = Tables<'barbers'>

interface AuthContexts {
  public: { user: null; profile: null; barber: null }
  user: { user: User; profile: CallerProfile; barber: null }
  barber: { user: User; profile: CallerProfile; barber: CallerBarber }
  admin: { user: User; profile: CallerProfile; barber: null }
}

type Parsed<S> = S extends ZodTypeAny ? z.output<S> : undefined

export interface RouteConfig<
  A extends AuthMode,
  B extends ZodTypeAny | undefined = undefined,
  Q extends ZodTypeAny | undefined = undefined,
  P extends ZodTypeAny | undefined = undefined,
> {
  auth: A
  body?: B
  query?: Q
  params?: P
}

export type HandlerContext<A extends AuthMode, B, Q, P> = AuthContexts[A] & {
  req: Request
  body: Parsed<B>
  query: Parsed<Q>
  params: Parsed<P>
}

/** The second argument Next.js passes to an App Router route handler. */
export interface NextRouteContext {
  params: Promise<Record<string, string | string[] | undefined>>
}

export type RouteHandler = (req: Request, ctx?: NextRouteContext) => Promise<Response>

const PROFILE_COLUMNS = 'id, role, name, username, is_disabled'

export function defineRoute<
  A extends AuthMode,
  B extends ZodTypeAny | undefined = undefined,
  Q extends ZodTypeAny | undefined = undefined,
  P extends ZodTypeAny | undefined = undefined,
>(
  config: RouteConfig<A, B, Q, P>,
  handler: (ctx: HandlerContext<A, B, Q, P>) => Promise<unknown>
): RouteHandler {
  return async (req, nextCtx) => {
    try {
      const auth = await authenticate(req, config.auth)

      const params = config.params
        ? validate(config.params, nextCtx ? await nextCtx.params : {}, 'params')
        : undefined
      const query = config.query
        ? validate(config.query, Object.fromEntries(new URL(req.url).searchParams), 'query')
        : undefined
      const body = config.body ? validate(config.body, await readJson(req), 'body') : undefined

      const result = await handler({
        ...(auth as AuthContexts[A]),
        req,
        body: body as Parsed<B>,
        query: query as Parsed<Q>,
        params: params as Parsed<P>,
      })

      if (result instanceof Response) return result
      return Response.json(result ?? {}, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      return toErrorResponse(error, req)
    }
  }
}

/** Turns anything thrown into the standard error response. */
export function toErrorResponse(error: unknown, req: Request): Response {
  if (error instanceof ApiError) {
    return errorResponse(error.status, error.code, error.message)
  }
  let path = ''
  try {
    path = new URL(req.url).pathname
  } catch {
    // keep empty
  }
  Sentry.captureException(error, { tags: { route: `${req.method} ${path}` } })
  if (process.env.NODE_ENV === 'development') {
    console.error(`[api] ${req.method} ${path} failed`, error)
  }
  return errorResponse(500, 'INTERNAL', INTERNAL_ERROR_MESSAGE)
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() || null : null
}

async function authenticate(req: Request, mode: AuthMode): Promise<AuthContexts[AuthMode]> {
  if (mode === 'public') return { user: null, profile: null, barber: null }

  const token = bearerToken(req)
  if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in to continue.')

  const db = getSupabaseAdmin()
  const { data, error } = await db.auth.getUser(token)
  if (error && isAuthRetryableFetchError(error)) {
    throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Sign-in service is unavailable. Please try again.')
  }
  if (error || !data.user) throw new ApiError(401, 'UNAUTHORIZED', 'Your session is invalid or has expired.')
  const user = data.user

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) throw profileError
  if (!profile) throw new ApiError(403, 'NO_PROFILE', 'Your account is not set up.')
  if (profile.is_disabled) throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account has been disabled.')

  if (mode === 'admin') {
    if (!isAdmin(user)) throw new ApiError(403, 'FORBIDDEN', 'Admins only.')
    return { user, profile, barber: null }
  }

  if (mode === 'barber') {
    const { data: barber, error: barberError } = await db
      .from('barbers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (barberError) throw barberError
    if (!barber) throw new ApiError(403, 'NOT_A_BARBER', 'This action needs a barber account.')
    return { user, profile, barber }
  }

  return { user, profile, barber: null }
}

/** Admin is `app_metadata.role === 'admin'` only; app_metadata is server-controlled. */
export function isAdmin(user: User): boolean {
  const meta = user.app_metadata as Record<string, unknown> | undefined
  return meta?.role === 'admin'
}

async function readJson(req: Request): Promise<unknown> {
  const text = await req.text()
  if (text.trim().length === 0) return undefined
  try {
    return JSON.parse(text)
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.')
  }
}

function validate<S extends ZodTypeAny>(schema: S, input: unknown, where: string): z.output<S> {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  const message = result.error.issues
    .slice(0, 5)
    .map((issue) => `${[where, ...issue.path].join('.')}: ${issue.message}`)
    .join('; ')
  throw new ApiError(400, 'VALIDATION_ERROR', message)
}
