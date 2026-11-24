/**
 * Grants (or removes) admin rights: sets app_metadata.role = 'admin' on the
 * auth user with the given email. Admin is read only from app_metadata, which
 * users cannot change themselves (see docs/database/SCHEMA.md).
 *
 * Usage (credentials come from the environment, never from this file):
 *
 *   SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/set-admin.ts owner@example.com --yes
 *
 *   npx tsx --env-file=.env scripts/set-admin.ts owner@example.com          # local stack
 *   npx tsx scripts/set-admin.ts owner@example.com --remove                  # take admin away
 *
 * SUPABASE_URL falls back to NEXT_PUBLIC_SUPABASE_URL. Any host other than
 * localhost / 127.0.0.1 needs --yes, so a production change is deliberate.
 * The API sees the change at once; database policies (RLS) see it after the
 * user's access token refreshes (sign out and in again).
 */
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

async function findUserByEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  const wanted = email.toLowerCase()
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) fail(`Could not list users: ${error.message}`)
    const match = data.users.find((u) => u.email?.toLowerCase() === wanted)
    if (match) return match
    if (data.users.length < 1000) return null
  }
}

async function main() {
  const args = process.argv.slice(2)
  const email = args.find((a) => !a.startsWith('--'))
  const remove = args.includes('--remove')
  const confirmed = args.includes('--yes')
  if (!email || !email.includes('@')) fail('Usage: npx tsx scripts/set-admin.ts <email> [--remove] [--yes]')

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) fail('Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) to the project URL.')
  if (!key) fail('Set SUPABASE_SERVICE_ROLE_KEY for that project.')

  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    fail('SUPABASE_URL is not a valid URL.')
  }
  const local = host === 'localhost' || host === '127.0.0.1'
  if (!local && !confirmed) fail(`Target is ${host}. Re-run with --yes to change a remote project.`)

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const user = await findUserByEmail(admin, email)
  if (!user) fail(`No auth user with email ${email} on ${host}.`)

  const appMetadata = { ...(user.app_metadata ?? {}) } as Record<string, unknown>
  if (remove) appMetadata.role = null // GoTrue merges app_metadata; null deletes the key
  else appMetadata.role = 'admin'

  const { error } = await admin.auth.admin.updateUserById(user.id, { app_metadata: appMetadata })
  if (error) fail(`Update failed: ${error.message}`)
  console.log(`${remove ? 'Removed admin from' : 'Granted admin to'} ${email} (${user.id}) on ${host}.`)
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
