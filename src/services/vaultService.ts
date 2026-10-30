import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDoc,
  deleteField,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { VaultCategory, VaultItem, VaultItemType } from '../types/vault';
import { decryptVaultValue, encryptVaultValue, getActiveVaultKey } from './vaultCrypto';
import { deleteVaultFilePath, migrateLegacyVaultFile } from './imageStorageService';

export interface CreateVaultItemPayload {
  type: VaultItemType;
  title: string;
  service?: string;
  username?: string;
  password?: string;
  url?: string;
  category: VaultCategory;
  notes?: string;
  imageUrl?: string;
  imageName?: string;
  imageSize?: number;
  imageType?: string;
  imageIv?: string;
  favorite?: boolean;
}

export interface UpdateVaultItemPayload {
  title?: string;
  service?: string;
  username?: string;
  password?: string;
  url?: string;
  category?: VaultCategory;
  notes?: string;
  imageUrl?: string;
  imageName?: string;
  imageSize?: number;
  imageType?: string;
  imageIv?: string;
  favorite?: boolean;
}

/**
 * Real-time listener for user's isolated private vault in Firestore.
 */
export function subscribeToVault(
  userId: string,
  onUpdate: (items: VaultItem[]) => void,
  onError: (error: unknown) => void
): () => void {
  const collectionPath = `users/${userId}/vault`;
  const vaultRef = collection(db, 'users', userId, 'vault');
  const q = query(vaultRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      void Promise.all(snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const sensitive = data.encryptedData
          ? await decryptVaultValue<Pick<VaultItem, 'title' | 'service' | 'username' | 'password' | 'url' | 'notes' | 'imageName'>>(data.encryptedData)
          : {
              title: data.title || '', service: data.service, username: data.username,
              password: data.password, url: data.url, notes: data.notes, imageName: data.imageName,
            };
        let migratedFile: { url: string; iv: string; oldPath: string } | null = null;
        if (data.imageUrl?.startsWith('supabase://') && !data.imageIv) {
          try {
            migratedFile = await migrateLegacyVaultFile(userId, docSnap.id, data.imageUrl, sensitive.imageName || '', data.imageType || '');
          } catch (migrationError) {
            console.error(`[Vault Migration] Could not encrypt attachment for ${docSnap.id}:`, migrationError);
          }
        }
        const item: VaultItem = {
          id: docSnap.id,
          userId: data.userId || userId,
          type: (data.type as VaultItemType) || 'credential',
          ...sensitive,
          category: (data.category as VaultCategory) || 'other',
          imageUrl: migratedFile?.url || data.imageUrl,
          imageSize: data.imageSize,
          imageType: data.imageType,
          imageIv: migratedFile?.iv || data.imageIv,
          favorite: Boolean(data.favorite),
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };

        // Opportunistically migrate existing plaintext records after the user
        // unlocks their key. The plaintext fields are removed in the same write.
        if (!data.encryptedData || migratedFile) {
          const legacyUpdates: Record<string, unknown> = { updatedAt: serverTimestamp() };
          if (!data.encryptedData) {
          const encryptedData = await encryptVaultValue({
            title: sensitive.title || 'Untitled', service: sensitive.service, username: sensitive.username,
            password: sensitive.password, url: sensitive.url, notes: sensitive.notes, imageName: sensitive.imageName,
          });
            legacyUpdates.title = 'Encrypted item';
            legacyUpdates.encryptedData = encryptedData;
            for (const field of ['service', 'username', 'password', 'url', 'notes', 'imageName']) legacyUpdates[field] = deleteField();
          }
          if (migratedFile) {
            legacyUpdates.imageUrl = migratedFile.url;
            legacyUpdates.imageIv = migratedFile.iv;
          }
          await updateDoc(doc(db, 'users', userId, 'vault', docSnap.id), legacyUpdates);
          if (migratedFile) {
            try {
              await deleteVaultFilePath(migratedFile.oldPath);
            } catch (deleteError) {
              console.error(`[Vault Migration] Old plaintext attachment remains for ${docSnap.id}:`, deleteError);
            }
          }
        }
        return item;
      })).then(onUpdate).catch((error) => {
        console.error('Could not decrypt or migrate vault records:', error);
        onError(error);
      });
    },
    (error) => {
      console.error('Error listening to vault items:', error);
      onError(error);
      handleFirestoreError(error, OperationType.LIST, collectionPath);
    }
  );
}

/**
 * Creates a new credential or personal document in the user's isolated Firestore vault.
 */
export async function createVaultItem(
  userId: string,
  payload: CreateVaultItemPayload
): Promise<string> {
  const cleanTitle = payload.title.trim().slice(0, 200);
  if (!cleanTitle) {
    throw new Error('Title or label cannot be empty.');
  }

  const vaultRef = collection(db, 'users', userId, 'vault');
  const newDocRef = doc(vaultRef);
  const docPath = `users/${userId}/vault/${newDocRef.id}`;

  const encryptedData = await encryptVaultValue({
    title: cleanTitle,
    service: payload.service?.trim().slice(0, 100),
    username: payload.username?.trim().slice(0, 320),
    password: payload.password?.trim().slice(0, 500),
    url: payload.url?.trim().slice(0, 1024),
    notes: payload.notes?.trim().slice(0, 5000),
    imageName: payload.imageName?.slice(0, 255),
  });
  const itemDoc: Record<string, any> = {
    userId,
    type: payload.type || 'credential',
    title: 'Encrypted item',
    encryptedData,
    category: payload.category || 'other',
    favorite: Boolean(payload.favorite),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (payload.imageUrl) {
    itemDoc.imageUrl = payload.imageUrl;
  }
  if (payload.imageSize !== undefined) {
    itemDoc.imageSize = payload.imageSize;
  }
  if (payload.imageType) {
    itemDoc.imageType = payload.imageType.slice(0, 100);
  }
  if (payload.imageIv) itemDoc.imageIv = payload.imageIv;

  try {
    await setDoc(newDocRef, itemDoc);
    return newDocRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
    throw error;
  }
}

/**
 * Updates an existing credential or document in Firestore.
 */
export async function updateVaultItem(
  userId: string,
  itemId: string,
  payload: UpdateVaultItemPayload
): Promise<void> {
  const docPath = `users/${userId}/vault/${itemId}`;
  const itemRef = doc(db, 'users', userId, 'vault', itemId);

  getActiveVaultKey();
  const existingSnapshot = await getDoc(itemRef);
  if (!existingSnapshot.exists()) throw new Error('Vault item not found.');
  const existing = existingSnapshot.data();
  const oldSensitive = existing.encryptedData
    ? await decryptVaultValue<Record<string, string | undefined>>(existing.encryptedData)
    : {
        title: existing.title, service: existing.service, username: existing.username, password: existing.password,
        url: existing.url, notes: existing.notes, imageName: existing.imageName,
      };
  const mergedSensitive = { ...oldSensitive };
  for (const field of ['title', 'service', 'username', 'password', 'url', 'notes', 'imageName'] as const) {
    if (payload[field] !== undefined) mergedSensitive[field] = payload[field] as string;
  }
  if (payload.title !== undefined && !payload.title.trim()) throw new Error('Title cannot be empty');
  const encryptedData = await encryptVaultValue(mergedSensitive);

  const updates: Record<string, any> = {
    title: 'Encrypted item',
    encryptedData,
    updatedAt: serverTimestamp(),
  };
  for (const field of ['service', 'username', 'password', 'url', 'notes', 'imageName'] as const) updates[field] = deleteField();
  if (payload.category !== undefined) {
    updates.category = payload.category;
  }
  if (payload.imageUrl !== undefined) {
    updates.imageUrl = payload.imageUrl;
  }
  if (payload.imageSize !== undefined) {
    updates.imageSize = payload.imageSize;
  }
  if (payload.imageType !== undefined) {
    updates.imageType = payload.imageType;
  }
  if (payload.imageIv !== undefined) updates.imageIv = payload.imageIv;
  if (payload.favorite !== undefined) {
    updates.favorite = Boolean(payload.favorite);
  }

  try {
    await updateDoc(itemRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
    throw error;
  }
}

/**
 * Deletes a credential or document permanently from Firestore.
 */
export async function deleteVaultItem(userId: string, itemId: string): Promise<void> {
  const docPath = `users/${userId}/vault/${itemId}`;
  const itemRef = doc(db, 'users', userId, 'vault', itemId);

  try {
    await deleteDoc(itemRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
    throw error;
  }
}
