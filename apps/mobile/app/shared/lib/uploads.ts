import * as FileSystem from 'expo-file-system';
import { api } from './api';
import { supabase } from './supabase';
import { uploadBytes, type UploadBucket } from './api-factory';

export type { UploadBucket };

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
};

/** The image's MIME type from the picker, else from the file extension (JPEG when unknown). */
export function imageContentType(uri: string, pickerMimeType?: string | null): string {
  if (pickerMimeType && pickerMimeType.startsWith('image/')) return pickerMimeType.toLowerCase();
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[ext] ?? 'image/jpeg';
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Uploads a local image (an expo-image-picker URI) into the caller's folder of
 * `bucket` and returns its public URL. Buckets: `avatars` (profile and cover
 * photos, 5 MB) and `media` (portfolio, 10 MB). The server checks type and size.
 */
export async function uploadImageFromUri(
  uri: string,
  bucket: UploadBucket,
  options: { mimeType?: string | null; fileName?: string | null } = {}
): Promise<string> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw new Error('Image file not found. Please select the image again.');

  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const bytes = base64ToBytes(base64);
  if (bytes.byteLength === 0) throw new Error('The image file is empty. Please select a different image.');

  const fileName = options.fileName || uri.split('/').pop() || 'image';
  return uploadBytes(
    { api, supabase },
    { bytes, bucket, contentType: imageContentType(uri, options.mimeType), fileName }
  );
}
