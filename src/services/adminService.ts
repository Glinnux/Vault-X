import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  UserAccount,
  AdminRecord,
  AdminPermissions,
  DEFAULT_APPOINTED_ADMIN_PERMISSIONS,
  SUPER_ADMIN_PERMISSIONS,
} from '../types/vault';

export const ADMIN_EMAIL = 'oluwolefaith92@gmail.com';
export const SUPER_ADMIN_EMAILS = [
  'oluwolefaith92@gmail.com',
  'faitholuwole6@gmail.com',
];

// In-memory cache of appointed admin emails & UIDs with their permissions
const dynamicAdminEmails = new Set<string>();
const dynamicAdminUids = new Set<string>();
const dynamicAdminPermissions = new Map<string, AdminPermissions>();

/**
 * Checks if a given email is the primary owner / super-administrator.
 */
export function isSuperAdminUser(email?: string | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  return SUPER_ADMIN_EMAILS.some((sa) => sa.toLowerCase() === lower);
}

/**
 * Checks if a given email or UID is an authorized vault administrator.
 */
export function isUserAdmin(email?: string | null, userId?: string | null): boolean {
  if (email) {
    const lower = email.toLowerCase().trim();
    if (SUPER_ADMIN_EMAILS.some((admin) => admin.toLowerCase() === lower)) {
      return true;
    }
    if (dynamicAdminEmails.has(lower)) {
      return true;
    }
  }

  if (userId && dynamicAdminUids.has(userId)) {
    return true;
  }

  // Also check local cache
  try {
    const raw = localStorage.getItem('clockin_vault_dynamic_admins');
    if (raw) {
      const list: AdminRecord[] = JSON.parse(raw);
      if (email && list.some((a) => a.email.toLowerCase() === email.toLowerCase())) {
        return true;
      }
      if (userId && list.some((a) => a.userId === userId)) {
        return true;
      }
    }
  } catch (_e) {}

  return false;
}

/**
 * Retrieves the effective permissions for an administrator.
 * Super-admins always have full, unrestricted permissions.
 */
export function getAdminPermissions(
  userId?: string | null,
  email?: string | null
): AdminPermissions {
  if (isSuperAdminUser(email)) {
    return SUPER_ADMIN_PERMISSIONS;
  }

  if (userId && dynamicAdminPermissions.has(userId)) {
    return dynamicAdminPermissions.get(userId)!;
  }

  try {
    const raw = localStorage.getItem('clockin_vault_dynamic_admins');
    if (raw) {
      const list: AdminRecord[] = JSON.parse(raw);
      const found = list.find(
        (a) =>
          (userId && a.userId === userId) ||
          (email && a.email.toLowerCase() === email.toLowerCase())
      );
      if (found?.permissions) {
        return { ...DEFAULT_APPOINTED_ADMIN_PERMISSIONS, ...found.permissions };
      }
    }
  } catch (_e) {}

  return DEFAULT_APPOINTED_ADMIN_PERMISSIONS;
}

/**
 * Subscribes in real-time to the registered users directory in Firestore.
 */
export function subscribeToRegisteredUsers(
  onUpdate: (users: UserAccount[]) => void,
  onError: (error: unknown) => void
): () => void {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, orderBy('createdAt', 'desc'));

  let unsubscribeFirestore = () => {};
  try {
    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        const users: UserAccount[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const email = data.email || '';
          const isAdm = isUserAdmin(email, docSnap.id) || data.role === 'admin';
          return {
            userId: docSnap.id,
            email: email || 'No email provided',
            displayName: data.displayName || 'Vault User',
            photoURL: data.photoURL,
            role: isAdm ? 'admin' : (data.role || 'user'),
            plan: isAdm ? 'unlimited' : (data.plan || 'free'),
            planDuration: data.planDuration,
            extraSlots: isAdm ? 999999 : (data.extraSlots || 0),
            maxCredentialSlots: isAdm ? 999999 : data.maxCredentialSlots,
            approvedAt: data.approvedAt,
            expiresAt: data.expiresAt,
            isExpired: data.isExpired,
            isBanned: Boolean(data.isBanned),
            bannedReason: data.bannedReason || '',
            bannedAt: data.bannedAt,
            bannedBy: data.bannedBy || '',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
        });
        onUpdate(users);
      },
      (error) => {
        console.error('Error listening to registered users:', error);
        onError(error);
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    );
  } catch (error) {
    console.error('Failed to set up users listener:', error);
    onError(error);
  }

  return () => {
    unsubscribeFirestore();
  };
}

/**
 * Subscribes in real-time to the administrators list.
 */
export function subscribeToAdminsList(
  onUpdate: (admins: AdminRecord[]) => void
): () => void {
  const adminsRef = collection(db, 'admins');

  return onSnapshot(
    adminsRef,
    (snapshot) => {
      dynamicAdminEmails.clear();
      dynamicAdminUids.clear();
      dynamicAdminPermissions.clear();

      const list: AdminRecord[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const email = data.email ? String(data.email).toLowerCase().trim() : '';
        const uid = docSnap.id;
        const isSuper = SUPER_ADMIN_EMAILS.some((sa) => sa.toLowerCase() === email);

        const perms: AdminPermissions = isSuper
          ? SUPER_ADMIN_PERMISSIONS
          : data.permissions
          ? { ...DEFAULT_APPOINTED_ADMIN_PERMISSIONS, ...data.permissions }
          : DEFAULT_APPOINTED_ADMIN_PERMISSIONS;

        if (email) dynamicAdminEmails.add(email);
        if (uid) {
          dynamicAdminUids.add(uid);
          dynamicAdminPermissions.set(uid, perms);
        }

        return {
          userId: uid,
          email: data.email || 'Admin',
          displayName: data.displayName || 'Administrator',
          role: isSuper ? 'superadmin' : (data.role || 'admin'),
          addedBy: data.addedBy || 'Primary Superadmin',
          addedAt: data.addedAt,
          photoURL: data.photoURL,
          permissions: perms,
        };
      });

      // Ensure super-admins are always recognized
      SUPER_ADMIN_EMAILS.forEach((sa) => dynamicAdminEmails.add(sa.toLowerCase()));

      try {
        localStorage.setItem('clockin_vault_dynamic_admins', JSON.stringify(list));
      } catch (_e) {}

      onUpdate(list);
    },
    (err) => {
      console.warn('Admins list subscription error:', err);
    }
  );
}

/**
 * Appoints a new administrator by their registered UID or Account Email used for sign in.
 */
export async function addAdminByUidOrEmail(
  identifier: string,
  addedByEmail: string = ADMIN_EMAIL,
  initialPermissions?: Partial<AdminPermissions>
): Promise<{ success: boolean; user: UserAccount; message: string }> {
  const cleanId = identifier.trim();
  if (!cleanId) {
    throw new Error('Please enter a valid User UID or Email address.');
  }

  let targetUserSnap: any = null;
  let targetUid = '';
  let targetData: any = null;

  // 1. Try finding by direct UID
  try {
    const directDocRef = doc(db, 'users', cleanId);
    const snap = await getDoc(directDocRef);
    if (snap.exists()) {
      targetUserSnap = snap;
      targetUid = snap.id;
      targetData = snap.data();
    }
  } catch (_e) {}

  // 2. If not found by UID, search by email
  if (!targetUserSnap) {
    try {
      const q = query(
        collection(db, 'users'),
        where('email', '==', cleanId.toLowerCase())
      );
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        targetUserSnap = querySnap.docs[0];
        targetUid = targetUserSnap.id;
        targetData = targetUserSnap.data();
      }
    } catch (_e) {}
  }

  // 3. Fallback: search case-insensitive in users collection
  if (!targetUserSnap) {
    const allUsersSnap = await getDocs(collection(db, 'users'));
    const matched = allUsersSnap.docs.find((d) => {
      const uEmail = (d.data().email || '').toLowerCase();
      return (
        d.id.toLowerCase() === cleanId.toLowerCase() ||
        uEmail === cleanId.toLowerCase()
      );
    });

    if (matched) {
      targetUserSnap = matched;
      targetUid = matched.id;
      targetData = matched.data();
    }
  }

  if (!targetUserSnap || !targetData) {
    throw new Error(
      `No registered user found with UID or Email: "${cleanId}". Please verify the account has signed into Clockin Vault at least once.`
    );
  }

  const userEmail = targetData.email || cleanId;
  const displayName = targetData.displayName || 'Administrator';
  const perms = { ...DEFAULT_APPOINTED_ADMIN_PERMISSIONS, ...(initialPermissions || {}) };

  // 1. Save to admins collection with permissions
  const adminDocRef = doc(db, 'admins', targetUid);
  await setDoc(
    adminDocRef,
    {
      userId: targetUid,
      email: userEmail,
      displayName,
      photoURL: targetData.photoURL || '',
      role: 'admin',
      permissions: perms,
      addedBy: addedByEmail,
      addedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // 2. Update user's profile document to admin with unlimited capacity
  const userDocRef = doc(db, 'users', targetUid);
  await updateDoc(userDocRef, {
    role: 'admin',
    plan: 'unlimited',
    extraSlots: 999999,
    maxCredentialSlots: 999999,
    paymentStatus: 'verified',
    paymentRef: `ADMIN-ROLE-BY-${addedByEmail.toUpperCase()}`,
    updatedAt: serverTimestamp(),
  });

  // 3. Update in-memory sets
  dynamicAdminEmails.add(userEmail.toLowerCase());
  dynamicAdminUids.add(targetUid);
  dynamicAdminPermissions.set(targetUid, perms);

  const updatedAccount: UserAccount = {
    userId: targetUid,
    email: userEmail,
    displayName,
    photoURL: targetData.photoURL,
    role: 'admin',
    plan: 'unlimited',
    extraSlots: 999999,
    maxCredentialSlots: 999999,
    createdAt: targetData.createdAt,
    updatedAt: new Date(),
  };

  return {
    success: true,
    user: updatedAccount,
    message: `Successfully appointed ${userEmail} (UID: ${targetUid}) as Administrator!`,
  };
}

/**
 * Updates permissions for an appointed administrator.
 */
export async function updateAdminPermissions(
  targetUserId: string,
  newPermissions: AdminPermissions
): Promise<void> {
  const adminDocRef = doc(db, 'admins', targetUserId);
  await updateDoc(adminDocRef, {
    permissions: newPermissions,
    updatedAt: serverTimestamp(),
  });

  dynamicAdminPermissions.set(targetUserId, newPermissions);
}

/**
 * Removes an appointed administrator role (Super-admins cannot be removed).
 */
export async function removeAdminRole(
  targetUserId: string,
  targetEmail: string
): Promise<void> {
  const isSuper = SUPER_ADMIN_EMAILS.some(
    (sa) => sa.toLowerCase() === targetEmail.toLowerCase()
  );
  if (isSuper) {
    throw new Error('Primary Owner & Super-Administrator role cannot be removed.');
  }

  // Remove from admins collection
  try {
    await deleteDoc(doc(db, 'admins', targetUserId));
  } catch (err) {
    console.warn('Error deleting admin document:', err);
  }

  // Reset user's role back to user
  try {
    await updateDoc(doc(db, 'users', targetUserId), {
      role: 'user',
      plan: 'free',
      extraSlots: 0,
      maxCredentialSlots: 10,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Error updating user document:', err);
  }

  dynamicAdminEmails.delete(targetEmail.toLowerCase());
  dynamicAdminUids.delete(targetUserId);
  dynamicAdminPermissions.delete(targetUserId);
}

/**
 * Banning an account: Appointed admins can ban suspicious users; Superadmin can also ban.
 */
export async function banUserAccount(
  targetUserId: string,
  reason: string,
  bannedByEmail: string
): Promise<void> {
  const cleanReason = reason.trim() || 'Suspicious activity or unauthorized access detected';
  const userDocRef = doc(db, 'users', targetUserId);

  await updateDoc(userDocRef, {
    isBanned: true,
    bannedReason: cleanReason,
    bannedBy: bannedByEmail,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Unbanning an account: STRICTLY permitted only for the primary owner / super-admin!
 */
export async function unbanUserAccount(
  targetUserId: string,
  requestedByEmail: string
): Promise<void> {
  if (!isSuperAdminUser(requestedByEmail)) {
    throw new Error('Permission Denied: Unbanning accounts is reserved exclusively for the Primary Superadmin.');
  }

  const userDocRef = doc(db, 'users', targetUserId);
  await updateDoc(userDocRef, {
    isBanned: false,
    bannedReason: '',
    bannedBy: '',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Redirect an important suggestion to the primary administrator owner.
 */
export async function redirectSuggestionToOwner(
  ticketId: string,
  redirectedByEmail: string,
  adminNotes?: string
): Promise<void> {
  const ticketDocRef = doc(db, 'support_tickets', ticketId);
  await updateDoc(ticketDocRef, {
    isRedirectedToOwner: true,
    redirectedBy: redirectedByEmail,
    adminNotes: adminNotes || 'Forwarded to primary administrator for strategic review.',
    updatedAt: serverTimestamp(),
  });
}
