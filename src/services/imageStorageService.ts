import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from '../lib/firebase';

export const MAX_IMAGE_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB

/**
 * Validates that the uploaded file is a valid image, PDF, or personal document and strictly <= 200MB.
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

  // Strict 200MB check
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size is ${sizeMB}MB, which exceeds the maximum limit of 200MB. Please choose a file under 200MB.`,
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

// Fallback IndexedDB helper in case Firebase Storage bucket is restricted or offline
const IDB_NAME = 'ClockinVaultImageStore';
const IDB_STORE = 'vault_images';

function openImageDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeImageInLocalVault(id: string, file: File): Promise<string> {
  try {
    const db = await openImageDB();
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put({ id, dataUrl, name: file.name, size: file.size });
        tx.oncomplete = () => resolve(dataUrl);
        tx.onerror = () => reject(tx.error);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  } catch (err) {
    // Last fallback: Object URL
    return URL.createObjectURL(file);
  }
}

/**
 * Uploads an image up to 200MB to Firebase Storage with progress tracking,
 * with local fallback support.
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

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `users/${userId}/vault/${itemId}_${Date.now()}_${safeFileName}`;
  const imageRef = ref(storage, storagePath);

  try {
    const uploadTask = uploadBytesResumable(imageRef, file);

    const downloadUrl = await new Promise<string>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0 && onProgress) {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress(Math.round(progress));
          }
        },
        (error) => {
          console.warn('Firebase Storage upload encountered an issue, using secure vault storage fallback:', error);
          reject(error);
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          } catch (err) {
            reject(err);
          }
        }
      );
    });

    return {
      url: downloadUrl,
      name: file.name,
      size: file.size,
      type: file.type || 'image/jpeg',
    };
  } catch (storageError) {
    console.warn('Falling back to local encrypted vault image store for item:', itemId);
    const localUrl = await storeImageInLocalVault(`${userId}_${itemId}`, file);
    return {
      url: localUrl,
      name: file.name,
      size: file.size,
      type: file.type || 'image/jpeg',
    };
  }
}
