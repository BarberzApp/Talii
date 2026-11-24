// Builds the mobile app's Talii API client. Kept free of React Native imports
// (the Supabase client is passed in) so it can be exercised from Node.
// The app uses the ready-made instance in ./api.ts.

import { createApiClient, type ApiClient } from '@barber-app/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';

/** Used only in development builds when EXPO_PUBLIC_API_URL is not set. */
export const LOCAL_DEV_API_URL = 'http://localhost:3000';

/**
 * Refresh the session ourselves only when the access token expires within this
 * many seconds. Kept below supabase-js's own auto-refresh margin so the two do not
 * refresh back to back; normally auto-refresh has already renewed the token.
 */
export const REFRESH_BUFFER_SECONDS = 60;

let warnedAboutBaseUrl = false;

/**
 * The API origin from EXPO_PUBLIC_API_URL, without a trailing slash.
 * Development builds fall back to a local Next.js server (with a warning);
 * release builds have no fallback, so a missing value fails every request
 * (and is reported) rather than silently calling some other host.
 */
export function resolveApiBaseUrl(
  envValue: string | undefined = process.env.EXPO_PUBLIC_API_URL,
  isDev: boolean = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production'
): string {
  const raw = (envValue ?? '').trim();
  if (raw) return raw.replace(/\/+$/, '');

  if (!warnedAboutBaseUrl) {
    warnedAboutBaseUrl = true;
    if (isDev) {
      logger.warn(`EXPO_PUBLIC_API_URL is not set; using ${LOCAL_DEV_API_URL} (development only).`);
    } else {
      logger.error('EXPO_PUBLIC_API_URL is not set; API requests will fail.');
    }
  }
  return isDev ? LOCAL_DEV_API_URL : '';
}

/**
 * The current Supabase access token, refreshed first when it expires within 60 seconds.
 * Returns null when signed out.
 */
export function createAccessTokenGetter(supabase: SupabaseClient) {
  return async function getAccessToken(): Promise<string | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      logger.warn('Could not read the Supabase session for an API call.');
      return null;
    }
    const session = data.session;
    if (!session) return null;

    const expiresAt = session.expires_at;
    if (expiresAt && expiresAt - Math.floor(Date.now() / 1000) <= REFRESH_BUFFER_SECONDS) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        logger.warn('Could not refresh the Supabase session; using the current token.');
        return session.access_token || null;
      }
      return refreshed.session?.access_token || session.access_token || null;
    }
    return session.access_token || null;
  };
}

export function createMobileApiClient(options: {
  supabase: SupabaseClient;
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): ApiClient {
  return createApiClient({
    baseUrl: options.baseUrl ?? resolveApiBaseUrl(),
    getAccessToken: createAccessTokenGetter(options.supabase),
    fetch: options.fetch,
    timeoutMs: options.timeoutMs,
  });
}

export type UploadBucket = 'avatars' | 'media';

/**
 * Uploads image bytes into the caller's own folder and returns the public URL:
 * POST /api/uploads issues a signed upload URL (the server picks the path), then
 * the bytes go straight to Storage. Save the URL afterwards with PATCH /api/me.
 */
export async function uploadBytes(
  deps: { api: ApiClient; supabase: SupabaseClient },
  input: { bytes: Uint8Array | ArrayBuffer; bucket: UploadBucket; contentType: string; fileName: string }
): Promise<string> {
  const size = input.bytes.byteLength;
  const ticket = await deps.api.uploads.create({
    bucket: input.bucket,
    contentType: input.contentType,
    fileName: input.fileName,
    sizeBytes: size > 0 ? size : undefined,
  });
  const { error } = await deps.supabase.storage
    .from(ticket.bucket)
    .uploadToSignedUrl(ticket.path, ticket.token, input.bytes, { contentType: ticket.contentType });
  if (error) throw new Error(error.message || 'Upload failed. Please try again.');
  return ticket.publicUrl;
}

/**
 * Public booking page of a barber on the website. The website and the API are
 * the same Next.js deployment, so this uses the API origin.
 */
export function bookingPageUrl(username: string | null | undefined, baseUrl: string = resolveApiBaseUrl()): string | null {
  if (!username || !baseUrl) return null;
  return `${baseUrl}/book/${encodeURIComponent(username)}`;
}
