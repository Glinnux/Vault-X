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
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { VaultCategory, VaultItem, VaultItemType } from '../types/vault';

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
      const items: VaultItem[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId: data.userId || userId,
          type: (data.type as VaultItemType) || 'credential',
          title: data.title || '',
          service: data.service,
          username: data.username,
          password: data.password,
          url: data.url,
          category: (data.category as VaultCategory) || 'other',
          notes: data.notes,
          imageUrl: data.imageUrl,
          imageName: data.imageName,
          imageSize: data.imageSize,
          imageType: data.imageType,
          favorite: Boolean(data.favorite),
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      });
      onUpdate(items);
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

  const itemDoc: Record<string, any> = {
    userId,
    type: payload.type || 'credential',
    title: cleanTitle,
    category: payload.category || 'other',
    favorite: Boolean(payload.favorite),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (payload.service && payload.service.trim()) {
    itemDoc.service = payload.service.trim().slice(0, 100);
  }
  if (payload.username && payload.username.trim()) {
    itemDoc.username = payload.username.trim().slice(0, 320);
  }
  if (payload.password && payload.password.trim()) {
    itemDoc.password = payload.password.trim().slice(0, 500);
  }
  if (payload.url && payload.url.trim()) {
    itemDoc.url = payload.url.trim().slice(0, 1024);
  }
  if (payload.notes && payload.notes.trim()) {
    itemDoc.notes = payload.notes.trim().slice(0, 5000);
  }
  if (payload.imageUrl) {
    itemDoc.imageUrl = payload.imageUrl;
  }
  if (payload.imageName) {
    itemDoc.imageName = payload.imageName.slice(0, 255);
  }
  if (payload.imageSize !== undefined) {
    itemDoc.imageSize = payload.imageSize;
  }
  if (payload.imageType) {
    itemDoc.imageType = payload.imageType.slice(0, 100);
  }

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

  const updates: Record<string, any> = {
    updatedAt: serverTimestamp(),
  };

  if (payload.title !== undefined) {
    const cleanTitle = payload.title.trim().slice(0, 200);
    if (!cleanTitle) throw new Error('Title cannot be empty');
    updates.title = cleanTitle;
  }
  if (payload.service !== undefined) {
    updates.service = payload.service.trim().slice(0, 100);
  }
  if (payload.username !== undefined) {
    updates.username = payload.username.trim().slice(0, 320);
  }
  if (payload.password !== undefined) {
    updates.password = payload.password.trim().slice(0, 500);
  }
  if (payload.url !== undefined) {
    updates.url = payload.url.trim().slice(0, 1024);
  }
  if (payload.category !== undefined) {
    updates.category = payload.category;
  }
  if (payload.notes !== undefined) {
    updates.notes = payload.notes.trim().slice(0, 5000);
  }
  if (payload.imageUrl !== undefined) {
    updates.imageUrl = payload.imageUrl;
  }
  if (payload.imageName !== undefined) {
    updates.imageName = payload.imageName;
  }
  if (payload.imageSize !== undefined) {
    updates.imageSize = payload.imageSize;
  }
  if (payload.imageType !== undefined) {
    updates.imageType = payload.imageType;
  }
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
