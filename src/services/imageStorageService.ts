import { supabase } from '../lib/supabase';
import { auth } from '../lib/firebase';
import { decryptVaultBlob, encryptVaultBlob } from './vaultCrypto';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

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
): Promise<{ url: string; name: string; size: number; type: string; iv: string }> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  if (!supabase) throw new Error('Supabase Storage is not configured in the browser.');
  const account = auth.currentUser;
  if (!account || account.uid !== userId) throw new Error('Please sign in again before uploading.');

  try {
    const encryptedFile = await encryptVaultBlob(file);
    const token = await account.getIdToken();
    const response = await fetch(`${API_BASE_URL}/api/vault/files/sign-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ itemId, fileName: file.name, contentType: file.type, size: file.size }),
    });
    const details = await response.json().catch(() => ({}));
    if (!response.ok || !details.path || !details.token) {
      throw new Error(details.error || 'Could not prepare the secure upload.');
    }

    const encryptedUpload = new File([encryptedFile.blob], file.name, { type: file.type || 'application/octet-stream' });
    const { error } = await supabase.storage.from(details.bucket).uploadToSignedUrl(details.path, details.token, encryptedUpload);
    if (error) throw error;
    onProgress?.(100);

    return {
      // Store the private path, not an expiring public URL.
      url: `supabase://${details.bucket}/${details.path}`,
      name: file.name,
      size: file.size,
      type: file.type || 'image/jpeg',
      iv: encryptedFile.iv,
    };
  } catch (storageError: any) {
    console.error('Secure Supabase Storage upload failed:', storageError);
    throw new Error(storageError?.message || 'Secure file upload failed. Please try again.');
  }
}

export async function resolveVaultFileUrl(storedUrl?: string, iv?: string, mimeType?: string): Promise<string | undefined> {
  if (!storedUrl) return undefined;
  if (!storedUrl.startsWith('supabase://')) return storedUrl;
  const separator = storedUrl.indexOf('/', 'supabase://'.length);
  if (separator < 0) return undefined;
  const bucket = storedUrl.slice('supabase://'.length, separator);
  const path = storedUrl.slice(separator + 1);
  const account = auth.currentUser;
  if (!account) return undefined;
  const token = await account.getIdToken();
  const response = await fetch(`${API_BASE_URL}/api/vault/files/sign-download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ bucket, path }),
  });
  if (!response.ok) return undefined;
  const data = await response.json();
  if (!iv) return data.url; // Legacy files remain readable and are not yet encrypted.
  const fileResponse = await fetch(data.url);
  if (!fileResponse.ok) throw new Error('Could not download the encrypted vault file.');
  const decrypted = await decryptVaultBlob(await fileResponse.arrayBuffer(), iv, mimeType || 'application/octet-stream');
  return URL.createObjectURL(decrypted);
}

export async function migrateLegacyVaultFile(
  userId: string,
  itemId: string,
  storedUrl: string,
  name: string,
  mimeType: string
): Promise<{ url: string; iv: string; oldPath: string }> {
  const oldPath = storedUrl.slice(storedUrl.indexOf('/', 'supabase://'.length) + 1);
  const legacyDownloadUrl = await resolveVaultFileUrl(storedUrl);
  if (!legacyDownloadUrl) throw new Error('Could not access the old vault file for encryption.');
  const response = await fetch(legacyDownloadUrl);
  if (!response.ok) throw new Error('Could not download the old vault file for encryption.');
  const oldBlob = await response.blob();
  const original = new File([oldBlob], name || 'vault-document', { type: mimeType || oldBlob.type || 'application/octet-stream' });
  const uploaded = await uploadVaultImage(userId, `${itemId}_migration`, original);
  return { url: uploaded.url, iv: uploaded.iv, oldPath };
}

export async function deleteVaultFilePath(path: string): Promise<void> {
  const account = auth.currentUser;
  if (!account) throw new Error('Please sign in again before removing the old file.');
  const token = await account.getIdToken();
  const response = await fetch(`${API_BASE_URL}/api/vault/files/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ path }),
  });
  if (!response.ok) throw new Error('The old unencrypted file could not be removed from storage.');
}
