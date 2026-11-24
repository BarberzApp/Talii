import { supabase } from './supabase';
import { createMobileApiClient } from './api-factory';

/**
 * The mobile app's client for the Talii API (apps/web/src/app/api). Requests go
 * to EXPO_PUBLIC_API_URL with the Supabase session's access token as a Bearer
 * token. Every database write goes through it; failures throw ApiError.
 */
export const api = createMobileApiClient({ supabase });

export {
  ApiError,
  isApiError,
  hasErrorCode,
  errorMessage,
  bookingErrorMessage,
} from '@barber-app/shared';
