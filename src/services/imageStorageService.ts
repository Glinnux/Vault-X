import { supabase } from '../lib/supabase';
import { auth } from '../lib/firebase';

export const MAX_IMAGE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Validates that the uploaded file is a valid image, PDF, or personal document and strictly <= 50MB.
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const allowedDocExt = /\.(jpe?g|png|webp|gif|svg|avif|bmp|ico|pdf|txt|csv|json|doc|docx|odt|rtf)$/i;
  const isImageOrDoc =
    file.type.startsWith('image/') ||
    file.type === 'application/pdf' ||
    file.type.startsWith('text/') ||
    allowedDocExt.test(file.name);

  if (!isImageOrDoc) {
    return {
      valid: false,
      error: 'Please select a valid image (JPEG, PNG, WebP) or document file (PDF, TXT, DOC).',
    };
  }

  // Strict 50MB check
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size is ${sizeMB}MB, which exceeds the maximum limit of 50MB. Please choose a file under 50MB.`,
    };
  }

  return { valid: true };
}

/**
 * Formats bytes to readable human strings (e.g. "4.2 MB").
 */
export function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Uploads a vault file to private Supabase Storage using a server-issued
 * signed upload URL. The Supabase secret key never reaches the browser.
 */
export async function uploadVaultImage(
  userId: string,
  itemId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ url: string; name: string; size: number; type: string }> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  if (!supabase) throw new Error('Supabase Storage is not configured in the browser.');
  const account = auth.currentUser;
  if (!account || account.uid !== userId) throw new Error('Please sign in again before uploading.');

  try {
    const token = await account.getIdToken();
    const response = await fetch('/api/vault/files/sign-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ itemId, fileName: file.name, contentType: file.type, size: file.size }),
    });
    const details = await response.json().catch(() => ({}));
    if (!response.ok || !details.path || !details.token) {
      throw new Error(details.error || 'Could not prepare the secure upload.');
    }

    const { error } = await supabase.storage.from(details.bucket).uploadToSignedUrl(details.path, details.token, file);
    if (error) throw error;
    onProgress?.(100);

    return {
      // Store the private path, not an expiring public URL.
      url: `supabase://${details.bucket}/${details.path}`,
      name: file.name,
      size: file.size,
      type: file.type || 'image/jpeg',
    };
  } catch (storageError: any) {
    console.error('Secure Supabase Storage upload failed:', storageError);
    throw new Error(storageError?.message || 'Secure file upload failed. Please try again.');
  }
}

export async function resolveVaultFileUrl(storedUrl?: string): Promise<string | undefined> {
  if (!storedUrl) return undefined;
  if (!storedUrl.startsWith('supabase://')) return storedUrl;
  const separator = storedUrl.indexOf('/', 'supabase://'.length);
  if (separator < 0) return undefined;
  const bucket = storedUrl.slice('supabase://'.length, separator);
  const path = storedUrl.slice(separator + 1);
  const account = auth.currentUser;
  if (!account) return undefined;
  const token = await account.getIdToken();
  const response = await fetch('/api/vault/files/sign-download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ bucket, path }),
  });
  if (!response.ok) return undefined;
  const data = await response.json();
  return data.url;
}
