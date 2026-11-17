import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
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
];

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const SUPER_ADMIN_SESSION_STORAGE_KEY = 'vault-x-super-admin-session';

export function getSuperAdminAccessSessionToken(): string | null {
  return typeof window === 'undefined' ? null : window.sessionStorage.getItem(SUPER_ADMIN_SESSION_STORAGE_KEY);
}

function storeSuperAdminAccessSessionToken(sessionToken: string): void {
  window.sessionStorage.setItem(SUPER_ADMIN_SESSION_STORAGE_KEY, sessionToken);
}

export function clearSuperAdminAccessSessionToken(): void {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(SUPER_ADMIN_SESSION_STORAGE_KEY);
}

export function getSuperAdminSessionHeaders(): Record<string, string> {
  const sessionToken = getSuperAdminAccessSessionToken();
  return sessionToken ? { 'X-Super-Admin-Session': sessionToken } : {};
}

export type AdminNotificationCategory = 'admin_activity' | 'payments' | 'support' | 'recovery';
export type AdminNotificationPreferences = Record<AdminNotificationCategory, boolean>;

export interface AdminNotificationRecipient {
  userId: string;
  email: string;
  displayName: string;
  categories: AdminNotificationPreferences;
}

interface AdminNotificationApiResponse {
  admins?: AdminNotificationRecipient[];
  error?: string;
  success?: boolean;
  sent?: boolean;
  message?: string;
}

export interface AdminOverview {
  totalUsers: number;
  activeUsers: number;
  totalCredentials: number;
  totalDocuments: number;
  recentUsers: Array<{
    userId: string;
    email: string | null;
    displayName: string | null;
    createdAt: string | null;
  }>;
  recentActivity: [];
}

export class AdminOverviewError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'AdminOverviewError';
  }
}

export interface SuperAdminAccessChallenge {
  challengeToken: string;
  expiresAt: number;
}

export interface SuperAdminAccessSession {
  sessionToken: string;
}

export async function verifySuperAdminPassword(password: string): Promise<SuperAdminAccessChallenge> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('You must be signed in to verify Super Admin access.');

  const response = await fetch(`${API_BASE_URL}/api/superadmin/access/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ password }),
  });
  const data = await response.json().catch(() => ({})) as Partial<SuperAdminAccessChallenge> & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Super Admin password verification failed.');
  if (
    typeof data.challengeToken !== 'string' ||
    !Number.isFinite(data.expiresAt) ||
    Number(data.expiresAt) <= Date.now()
  ) {
    throw new Error('The server returned an invalid owner verification challenge.');
  }
  return { challengeToken: data.challengeToken, expiresAt: Number(data.expiresAt) };
}

export async function verifySuperAdminOwnerWord(
  ownerWord: string,
  challengeToken: string
): Promise<SuperAdminAccessSession> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('You must be signed in to verify Super Admin access.');

  const response = await fetch(`${API_BASE_URL}/api/superadmin/access/owner-verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Super-Admin-Challenge': challengeToken,
    },
    body: JSON.stringify({ ownerWord }),
  });
  const data = await response.json().catch(() => ({})) as Partial<SuperAdminAccessSession> & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Owner word verification failed.');
  if (typeof data.sessionToken !== 'string') {
    throw new Error('The server returned an invalid Super Admin access session.');
  }
  storeSuperAdminAccessSessionToken(data.sessionToken);
  return { sessionToken: data.sessionToken };
}

export async function validateSuperAdminAccessSession(sessionToken: string): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('You must be signed in to access Super Admin tools.');

  const response = await fetch(`${API_BASE_URL}/api/superadmin/access/check`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Super-Admin-Session': sessionToken,
    },
  });
  const data = await response.json().catch(() => ({})) as { error?: string; verified?: boolean };
  if (!response.ok || data.verified !== true) {
    if (response.status === 401 || response.status === 403) clearSuperAdminAccessSessionToken();
    throw new Error(data.error || 'A verified Super Admin session is required.');
  }
}

export async function revokeSuperAdminAccessSession(sessionToken: string): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('You must be signed in to end the Super Admin session.');

  const response = await fetch(`${API_BASE_URL}/api/superadmin/access/revoke`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Super-Admin-Session': sessionToken,
    },
  });
  const data = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(data.error || 'Could not revoke the Super Admin access session.');
  clearSuperAdminAccessSessionToken();
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new AdminOverviewError('Authentication required.', 401);

  const response = await fetch(`${API_BASE_URL}/api/admin/overview`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...getSuperAdminSessionHeaders(),
    },
  });
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new AdminOverviewError(
      'The admin API returned a web page instead of data. Restart the server so its API routes are loaded.',
      response.status === 200 ? 503 : response.status
    );
  }
  const data = await response.json() as AdminOverview & { error?: string };
  if (!response.ok) {
    throw new AdminOverviewError(data.error || 'Could not load the admin overview.', response.status);
  }
  if (
    !Number.isFinite(data.totalUsers) ||
    !Number.isFinite(data.activeUsers) ||
    !Number.isFinite(data.totalCredentials) ||
    !Number.isFinite(data.totalDocuments) ||
    !Array.isArray(data.recentUsers)
  ) {
    throw new AdminOverviewError('The server returned invalid admin overview data.', 502);
  }
  return data;
}

export type AdminActivityAction =
  | 'subscription_approved'
  | 'subscription_extended'
  | 'subscription_expired'
  | 'subscription_reset'
  | 'unlimited_slots_granted'
  | 'user_banned'
  | 'user_unbanned'
  | 'admin_appointed'
  | 'admin_revoked'
  | 'admin_permissions_updated'
  | 'ticket_status_changed'
  | 'suggestion_redirected';

async function getNotificationAuthHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('You must be signed in to manage email notifications.');
  return { Authorization: `Bearer ${token}`, ...getSuperAdminSessionHeaders() };
}

async function readNotificationResponse(response: Response): Promise<AdminNotificationApiResponse> {
  const data = await response.json().catch(() => ({})) as AdminNotificationApiResponse;
  if (!response.ok) throw new Error(data.error || 'Email notification request failed.');
  return data;
}

export async function fetchAdminNotificationRecipients(): Promise<AdminNotificationRecipient[]> {
  const response = await fetch(`${API_BASE_URL}/api/admin/notification-preferences`, {
    headers: await getNotificationAuthHeaders(),
  });
  const data = await readNotificationResponse(response);
  if (!Array.isArray(data.admins)) throw new Error('The server returned invalid notification settings.');
  return data.admins;
}

export async function saveAdminNotificationPreferences(
  userId: string,
  categories: AdminNotificationPreferences
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/admin/notification-preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(await getNotificationAuthHeaders()),
    },
    body: JSON.stringify({ userId, categories }),
  });
  await readNotificationResponse(response);
}

export async function sendAdminActivityNotification(data: {
  action: AdminActivityAction;
  targetUid: string;
  targetEmail?: string;
  summary: string;
}): Promise<{ sent: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/admin/activity-notification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await getNotificationAuthHeaders()),
    },
    body: JSON.stringify(data),
  });
  const result = await readNotificationResponse(response);
  if (typeof result.sent !== 'boolean' || typeof result.message !== 'string') {
    throw new Error('The server returned an invalid admin notification status.');
  }
  return { sent: result.sent, message: result.message };
}

const NO_ADMIN_PERMISSIONS: AdminPermissions = {
  viewFullUserInfo: false,
  giveSlots: false,
  answerComplaints: false,
  redirectSuggestions: false,
  viewTransactions: false,
  banUsers: false,
  addAdmins: false,
  receiveTransactionNotices: false,
};

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

  return NO_ADMIN_PERMISSIONS;
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

  const batch = writeBatch(db);
  batch.delete(doc(db, 'admins', targetUserId));
  batch.update(doc(db, 'users', targetUserId), {
    role: 'user',
    plan: 'free',
    extraSlots: 0,
    maxCredentialSlots: 10,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();

  dynamicAdminEmails.delete(targetEmail.toLowerCase());
  dynamicAdminUids.delete(targetUserId);
  dynamicAdminPermissions.delete(targetUserId);
}

/**
 * Banning an account is restricted to the authenticated SuperAdmin.
 */
export async function banUserAccount(
  targetUserId: string,
  reason: string
): Promise<void> {
  const bannedByEmail = auth.currentUser?.email;
  if (!bannedByEmail || !isSuperAdminUser(bannedByEmail)) {
    throw new Error('Permission Denied: Only the SuperAdmin can ban user accounts.');
  }

  const cleanReason = reason.trim() || 'Suspicious activity or unauthorized access detected';
  const userDocRef = doc(db, 'users', targetUserId);

  await updateDoc(userDocRef, {
    isBanned: true,
    bannedReason: cleanReason,
    bannedBy: bannedByEmail,
    bannedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Unbanning an account: STRICTLY permitted only for the primary owner / super-admin!
 */
export async function unbanUserAccount(
  targetUserId: string
): Promise<void> {
  if (!auth.currentUser?.email || !isSuperAdminUser(auth.currentUser.email)) {
    throw new Error('Permission Denied: Unbanning accounts is reserved exclusively for the Primary Superadmin.');
  }

  const userDocRef = doc(db, 'users', targetUserId);
  await updateDoc(userDocRef, {
    isBanned: false,
    bannedReason: '',
    bannedBy: '',
    bannedAt: null,
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
