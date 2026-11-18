import 'server-only'
import { getSupabaseAdmin } from './clients'

/**
 * For public routes that personalise results when a token is present (for
 * example, hiding blocked users). Returns the caller's user id, or null when
 * there is no valid Bearer token or the account is disabled. Never throws for
 * a bad token: the route stays public.
 */
export async function optionalCallerId(req: Request): Promise<string | null> {
  const header = req.headers.get('authorization')
  const match = header ? /^Bearer\s+(.+)$/i.exec(header.trim()) : null
  const token = match?.[1]?.trim()
  if (!token) return null

  const db = getSupabaseAdmin()
  try {
    const { data, error } = await db.auth.getUser(token)
    if (error || !data.user) return null
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('id, is_disabled')
      .eq('id', data.user.id)
      .maybeSingle()
    if (profileError || !profile || profile.is_disabled) return null
    return profile.id
  } catch {
    return null
  }
}
