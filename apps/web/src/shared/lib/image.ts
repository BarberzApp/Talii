/**
 * Whether next/image may optimise this URL. next/image throws on hosts that
 * next.config.mjs does not list, and avatar URLs can come from sign-up metadata
 * (any https URL), so anything outside the configured hosts is rendered
 * unoptimised instead of crashing the page. Keep in sync with `images` in
 * next.config.mjs.
 */
const OPTIMISED_HOSTS = new Set([
  'localhost',
  'res.cloudinary.com',
  'lh3.googleusercontent.com',
  'avatars.githubusercontent.com',
  'images.unsplash.com',
])

export function isOptimizableImage(src: string | null | undefined): boolean {
  if (!src) return false
  if (src.startsWith('/')) return true // local file from /public
  let url: URL
  try {
    url = new URL(src)
  } catch {
    return false
  }
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabase) {
    try {
      const base = new URL(supabase)
      if (url.origin === base.origin && url.pathname.startsWith('/storage/v1/object/public/')) return true
    } catch {
      // fall through
    }
  }
  return url.protocol === 'https:' && OPTIMISED_HOSTS.has(url.hostname)
}
