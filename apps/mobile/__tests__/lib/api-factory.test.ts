import {
  LOCAL_DEV_API_URL,
  bookingPageUrl,
  createAccessTokenGetter,
  resolveApiBaseUrl,
  uploadBytes,
} from '@/lib/api-factory';
import { parseCityState } from '@/lib/geocode';

jest.mock('@/lib/logger');

describe('resolveApiBaseUrl', () => {
  it('uses EXPO_PUBLIC_API_URL without a trailing slash', () => {
    expect(resolveApiBaseUrl('https://api.example.com/', false)).toBe('https://api.example.com');
  });

  it('falls back to a local server only in development', () => {
    expect(resolveApiBaseUrl('', true)).toBe(LOCAL_DEV_API_URL);
    expect(resolveApiBaseUrl(undefined, false)).toBe('');
  });
});

describe('createAccessTokenGetter', () => {
  const now = () => Math.floor(Date.now() / 1000);

  it('returns null when signed out', async () => {
    const supabase = { auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }) } };
    await expect(createAccessTokenGetter(supabase as any)()).resolves.toBeNull();
  });

  it('returns the current token when it is not about to expire', async () => {
    const supabase = {
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'a', expires_at: now() + 3600 } }, error: null }),
        refreshSession: jest.fn(),
      },
    };
    await expect(createAccessTokenGetter(supabase as any)()).resolves.toBe('a');
    expect(supabase.auth.refreshSession).not.toHaveBeenCalled();
  });

  it('refreshes a token that expires within 60 seconds', async () => {
    const supabase = {
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'old', expires_at: now() + 30 } }, error: null }),
        refreshSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'new' } }, error: null }),
      },
    };
    await expect(createAccessTokenGetter(supabase as any)()).resolves.toBe('new');
  });

  it('leaves a token with 90 seconds left to supabase-js auto-refresh', async () => {
    const supabase = {
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'cur', expires_at: now() + 90 } }, error: null }),
        refreshSession: jest.fn(),
      },
    };
    await expect(createAccessTokenGetter(supabase as any)()).resolves.toBe('cur');
    expect(supabase.auth.refreshSession).not.toHaveBeenCalled();
  });
});

describe('uploadBytes', () => {
  it('asks the API for a signed URL, uploads to it and returns the public URL', async () => {
    const uploadToSignedUrl = jest.fn().mockResolvedValue({ data: {}, error: null });
    const supabase = { storage: { from: jest.fn(() => ({ uploadToSignedUrl })) } };
    const api = {
      uploads: {
        create: jest.fn().mockResolvedValue({
          bucket: 'avatars',
          path: 'u1/x.png',
          signedUrl: 'https://s',
          token: 'tok',
          publicUrl: 'https://public/u1/x.png',
          maxBytes: 5,
          contentType: 'image/png',
        }),
      },
    };
    const bytes = new Uint8Array([1, 2, 3]);

    const url = await uploadBytes({ api: api as any, supabase: supabase as any }, {
      bytes,
      bucket: 'avatars',
      contentType: 'image/png',
      fileName: 'me.png',
    });

    expect(url).toBe('https://public/u1/x.png');
    expect(api.uploads.create).toHaveBeenCalledWith({ bucket: 'avatars', contentType: 'image/png', fileName: 'me.png', sizeBytes: 3 });
    expect(supabase.storage.from).toHaveBeenCalledWith('avatars');
    expect(uploadToSignedUrl).toHaveBeenCalledWith('u1/x.png', 'tok', bytes, { contentType: 'image/png' });
  });
});

describe('helpers', () => {
  it('builds the public booking page URL', () => {
    expect(bookingPageUrl('ann_b', 'https://talii.example')).toBe('https://talii.example/book/ann_b');
    expect(bookingPageUrl(null, 'https://talii.example')).toBeNull();
  });

  it('parses city and state from a location string', () => {
    expect(parseCityState('Brooklyn, NY')).toEqual({ city: 'Brooklyn', state: 'NY' });
    expect(parseCityState('123 Main St, Brooklyn, NY 11201, USA')).toEqual({ city: 'Brooklyn', state: 'NY' });
    expect(parseCityState('Austin')).toEqual({ city: 'Austin', state: null });
    expect(parseCityState('')).toEqual({ city: null, state: null });
  });
});
