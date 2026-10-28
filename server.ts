import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore, Timestamp } from 'firebase-admin/firestore';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');
const PORT = Number(process.env.PORT) || 3000;
const SUPPORT_EMAIL = 'oluwolefaith92@gmail.com';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'vault-files';
const supabaseAdmin = SUPABASE_URL && SUPABASE_SECRET_KEY
  ? createSupabaseClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

app.use(express.json({ limit: '12mb' }));

// Basic abuse protection for the local/API server. Production deployments should
// also enforce rate limits at the hosting proxy or API gateway.
const requestBuckets = new Map<string, { startedAt: number; count: number }>();
function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: () => void) => {
    const key = `${req.ip || 'unknown'}:${req.path}`;
    const now = Date.now();
    const bucket = requestBuckets.get(key);
    if (!bucket || now - bucket.startedAt >= windowMs) {
      requestBuckets.set(key, { startedAt: now, count: 1 });
      next();
      return;
    }
    bucket.count += 1;
    if (bucket.count > maxRequests) {
      res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
      return;
    }
    next();
  };
}

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (_req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

type VerifiedApiUser = {
  uid: string;
  email: string;
  idToken: string;
  permissions: Record<string, boolean>;
};

function loadFirebaseServerConfig(): { apiKey: string; projectId: string; databaseId: string } {
  const fallback = {
    apiKey: process.env.FIREBASE_API_KEY || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    databaseId: process.env.FIREBASE_DATABASE_ID || '(default)',
  };
  const candidates = [
    path.resolve(__dirname, 'firebase-applet-config.json'),
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
  ];
  for (const candidate of candidates) {
    try {
      const config = JSON.parse(fs.readFileSync(candidate, 'utf8')) as Record<string, string>;
      return {
        apiKey: process.env.FIREBASE_API_KEY || config.apiKey || fallback.apiKey,
        projectId: process.env.FIREBASE_PROJECT_ID || config.projectId || fallback.projectId,
        databaseId: process.env.FIREBASE_DATABASE_ID || config.firestoreDatabaseId || fallback.databaseId,
      };
    } catch (_error) {
      // Try the next location or environment-only configuration.
    }
  }
  return fallback;
}

const firebaseServerConfig = loadFirebaseServerConfig();
const localServiceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(process.env.USERPROFILE || '', 'Documents', 'VaultX', 'service-account.json');
const SUPER_ADMIN_EMAILS = new Set([
  'oluwolefaith92@gmail.com',
  'faitholuwole6@gmail.com',
]);

// Firebase Admin is initialized only on the trusted server. The service-account
// file must never be imported by the browser or committed to the repository.
let adminAuth: ReturnType<typeof getAdminAuth> | null = null;
let adminDb: ReturnType<typeof getAdminFirestore> | null = null;
try {
  const hasLocalServiceAccount = Boolean(localServiceAccountPath && fs.existsSync(localServiceAccountPath));
  if (hasLocalServiceAccount || process.env.FIREBASE_CONFIG) {
    const serviceAccount = hasLocalServiceAccount
      ? JSON.parse(fs.readFileSync(localServiceAccountPath, 'utf8'))
      : null;
    const adminApp = getApps().length
      ? getApps()[0]
      : initializeApp({
          credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
          projectId: firebaseServerConfig.projectId || undefined,
        });
    adminAuth = getAdminAuth(adminApp);
    adminDb = getAdminFirestore(adminApp, firebaseServerConfig.databaseId || '(default)');
    console.log('[Recovery] Firebase Admin SDK enabled.');
  } else {
    console.warn('[Recovery] Firebase Admin SDK is disabled: trusted credentials are not configured.');
  }
} catch (error) {
  console.error('[Recovery] Firebase Admin SDK could not initialize:', error);
}

const RECOVERY_CODE_TTL_MS = 15 * 60 * 1000;
const RECOVERY_MAX_ATTEMPTS = 5;

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeRecoveryCode(value: unknown): string {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function recoveryLookupId(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateRecoveryCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function hashRecoveryCode(code: string, salt: Buffer): Buffer {
  return scryptSync(code, salt, 32);
}

function recoveryCodeMatches(code: string, saltHex: string, hashHex: string): boolean {
  try {
    const actual = hashRecoveryCode(code, Buffer.from(saltHex, 'hex'));
    const expected = Buffer.from(hashHex, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch (_error) {
    return false;
  }
}

async function notifyRecoveryAdmins(subject: string, body: string, fields: Record<string, string>) {
  if (!adminDb) return;
  const recipients = new Set(SUPER_ADMIN_EMAILS);
  try {
    const snapshot = await adminDb.collection('admins').get();
    snapshot.docs.forEach((doc) => {
      const email = normalizeEmail(doc.data().email);
      if (email) recipients.add(email);
    });
  } catch (error) {
    console.error('[Recovery] Could not load appointed admins:', error);
  }

  await Promise.allSettled(
    [...recipients].map((recipientEmail) =>
      dispatchEmailNotification({
        subject,
        recipientEmail,
        fields,
        textContent: body,
      })
    )
  );
}

async function loadAdminPermissions(uid: string, idToken: string): Promise<Record<string, boolean>> {
  if (adminDb) {
    try {
      const snapshot = await adminDb.collection('admins').doc(uid).get();
      const permissions = snapshot.data()?.permissions;
      if (permissions && typeof permissions === 'object') {
        return Object.fromEntries(
          Object.entries(permissions).map(([key, value]) => [key, value === true])
        );
      }
    } catch (error) {
      console.error('[Auth] Could not load admin permissions with Admin SDK:', error);
    }
  }
  if (!firebaseServerConfig.projectId) return {};
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseServerConfig.projectId}/databases/${firebaseServerConfig.databaseId}/documents/admins/${uid}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!response.ok) return {};
  const document = (await response.json()) as any;
  const fields = document.fields?.permissions?.mapValue?.fields || {};
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]: [string, any]) => [key, value.booleanValue === true])
  );
}

async function verifyApiUser(req: Request): Promise<VerifiedApiUser | null> {
  const authorization = req.header('authorization') || '';
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!idToken || !firebaseServerConfig.apiKey) return null;

  try {
    // Prefer Firebase Admin verification on the trusted server. The REST
    // lookup below remains only as a local-development fallback when the
    // server is intentionally running without Admin SDK credentials.
    if (adminAuth) {
      const decoded = await adminAuth.verifyIdToken(idToken, true);
      const account = await adminAuth.getUser(decoded.uid);
      if (account.disabled) return null;
      return {
        uid: account.uid,
        email: normalizeEmail(account.email || decoded.email || ''),
        idToken,
        permissions: await loadAdminPermissions(account.uid, idToken),
      };
    }

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseServerConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as any;
    const account = data.users?.[0];
    if (!account?.localId || account.disabled) return null;
    return {
      uid: account.localId,
      email: String(account.email || '').toLowerCase(),
      idToken,
      permissions: await loadAdminPermissions(account.localId, idToken),
    };
  } catch (_error) {
    return null;
  }
}

async function requireApiUser(req: Request, res: Response, permission?: string | string[]) {
  const user = await verifyApiUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return null;
  }
  if (permission) {
    const allowed = SUPER_ADMIN_EMAILS.has(user.email) || (Array.isArray(permission)
      ? permission.some((key) => user.permissions[key] === true)
      : user.permissions[permission] === true);
    if (!allowed) {
      res.status(403).json({ error: 'Administrator permission required.' });
      return null;
    }
  }
  return user;
}

function safeVaultFileName(value: unknown): string {
  return String(value || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160);
}

function isAllowedVaultMimeType(value: unknown): boolean {
  return new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
    'application/pdf', 'text/plain', 'text/csv', 'application/json',
    'application/msword', 'application/rtf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]).has(String(value || '').toLowerCase());
}

function isUserVaultPath(pathValue: unknown, uid: string): pathValue is string {
  return typeof pathValue === 'string' &&
    pathValue.startsWith(`users/${uid}/vault/`) &&
    pathValue.length <= 500 &&
    !pathValue.includes('..');
}

async function requireAdminChatUser(req: Request, res: Response): Promise<(VerifiedApiUser & { isSuperAdmin: boolean }) | null> {
  const user = await requireApiUser(req, res);
  if (!user || !adminDb) {
    if (user && !adminDb) res.status(503).json({ error: 'Admin chat is not configured on the server.' });
    return null;
  }
  const isSuper = SUPER_ADMIN_EMAILS.has(user.email);
  const adminRecord = await adminDb.collection('admins').doc(user.uid).get();
  if (!isSuper && !adminRecord.exists) {
    res.status(403).json({ error: 'Administrator access required.' });
    return null;
  }
  return { ...user, isSuperAdmin: isSuper };
}

function firestoreMillis(value: any): number | null {
  return value?.toMillis?.() || (typeof value === 'number' ? value : null);
}

// Supabase Storage is private. Firebase-authenticated users receive only
// short-lived signed upload/download URLs from this trusted server.
app.post('/api/vault/files/sign-upload', rateLimit(20, 10 * 60_000), async (req: Request, res: Response) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Supabase Storage is not configured on the server.' });
    return;
  }

  const itemId = String(req.body?.itemId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
  const fileName = safeVaultFileName(req.body?.fileName);
  const contentType = String(req.body?.contentType || '').toLowerCase();
  const size = Number(req.body?.size);
  if (!itemId || !isAllowedVaultMimeType(contentType) || !Number.isFinite(size) || size <= 0 || size > 50 * 1024 * 1024) {
    res.status(400).json({ error: 'File details are invalid or exceed the 50MB limit.' });
    return;
  }

  const filePath = `users/${user.uid}/vault/${itemId}_${Date.now()}_${fileName}`;
  const { data, error } = await supabaseAdmin.storage.from(SUPABASE_BUCKET).createSignedUploadUrl(filePath);
  if (error || !data?.token) {
    console.error('[Supabase Storage] Could not create upload URL:', error);
    res.status(502).json({ error: 'Could not prepare the secure file upload.' });
    return;
  }
  res.json({ path: filePath, token: data.token, bucket: SUPABASE_BUCKET });
});

app.post('/api/vault/files/sign-download', rateLimit(60, 10 * 60_000), async (req: Request, res: Response) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  if (!supabaseAdmin || !isUserVaultPath(req.body?.path, user.uid)) {
    res.status(400).json({ error: 'Invalid vault file path.' });
    return;
  }
  const { data, error } = await supabaseAdmin.storage.from(SUPABASE_BUCKET).createSignedUrl(req.body.path, 60 * 60);
  if (error || !data?.signedUrl) {
    console.error('[Supabase Storage] Could not create download URL:', error);
    res.status(404).json({ error: 'Could not access the vault file.' });
    return;
  }
  res.json({ url: data.signedUrl });
});

app.get('/api/admin/chats', async (req: Request, res: Response) => {
  const user = await requireAdminChatUser(req, res);
  if (!user || !adminDb) return;
  try {
    const snapshot = await adminDb.collection('admin_chats').get();
    const chats = snapshot.docs
      .map((chatDoc) => {
        const data = chatDoc.data();
        return {
          id: chatDoc.id,
          type: data.type,
          name: data.name,
          participantIds: data.participantIds || [],
          participantEmails: data.participantEmails || [],
          createdBy: data.createdBy,
          updatedAt: firestoreMillis(data.updatedAt),
          lastMessagePreview: data.lastMessagePreview || '',
        };
      })
      .filter((chat) => user.isSuperAdmin || chat.participantIds.includes(user.uid))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const directory = (await adminDb.collection('admins').get()).docs.map((adminDoc) => ({
      userId: adminDoc.id,
      email: normalizeEmail(adminDoc.data().email),
      displayName: adminDoc.data().displayName || 'Administrator',
      role: 'admin',
    }));
    for (const email of SUPER_ADMIN_EMAILS) {
      const superUser = await adminAuth?.getUserByEmail(email).catch(() => null);
      if (superUser && !directory.some((admin) => admin.userId === superUser.uid)) {
        directory.push({ userId: superUser.uid, email, displayName: superUser.displayName || 'Superadmin', role: 'superadmin' });
      }
    }
    res.json({ chats, directory });
  } catch (error) {
    console.error('[Admin Chat] Could not load chats:', error);
    res.status(500).json({ error: 'Could not load admin chats.' });
  }
});

app.post('/api/admin/chats', async (req: Request, res: Response) => {
  const user = await requireAdminChatUser(req, res);
  if (!user || !adminDb) return;
  const type = req.body?.type === 'group' ? 'group' : 'dm';
  try {
    let participantIds: string[] = [user.uid];
    let participantEmails: string[] = [user.email];
    let name = String(req.body?.groupName || '').trim().slice(0, 120) || 'Admin Operations Group';

    if (type === 'group') {
      if (!user.isSuperAdmin) {
        res.status(403).json({ error: 'Only the superadmin can create group chats.' });
        return;
      }
      const adminsSnapshot = await adminDb.collection('admins').get();
      participantIds = adminsSnapshot.docs.map((adminDoc) => adminDoc.id);
      participantEmails = adminsSnapshot.docs.map((adminDoc) => normalizeEmail(adminDoc.data().email)).filter(Boolean);
      for (const email of SUPER_ADMIN_EMAILS) {
        const superUser = await adminAuth?.getUserByEmail(email).catch(() => null);
        if (superUser && !participantIds.includes(superUser.uid)) {
          participantIds.push(superUser.uid);
          participantEmails.push(email);
        }
      }
    } else {
      const targetId = String(req.body?.targetId || '').trim();
      if (!targetId || targetId === user.uid) {
        res.status(400).json({ error: 'Choose another administrator for the DM.' });
        return;
      }
      const targetIsSuper = await Promise.any([...SUPER_ADMIN_EMAILS].map(async (email) => {
        const target = await adminAuth?.getUserByEmail(email);
        return target?.uid === targetId;
      })).catch(() => false);
      const targetAdmin = await adminDb.collection('admins').doc(targetId).get();
      if (!targetIsSuper && !targetAdmin.exists) {
        res.status(403).json({ error: 'That account is not an administrator.' });
        return;
      }
      const targetUser = await adminAuth?.getUser(targetId);
      participantIds.push(targetId);
      participantEmails.push(normalizeEmail(targetUser?.email));
      name = targetUser?.displayName || targetUser?.email || 'Administrator';
    }

    const chatRef = await adminDb.collection('admin_chats').add({
      type,
      name,
      participantIds,
      participantEmails,
      createdBy: user.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      lastMessagePreview: '',
    });
    res.json({ chat: { id: chatRef.id, type, name, participantIds, participantEmails, createdBy: user.uid, createdAt: Date.now(), updatedAt: Date.now(), lastMessagePreview: '' } });
  } catch (error) {
    console.error('[Admin Chat] Could not create chat:', error);
    res.status(500).json({ error: 'Could not create the admin chat.' });
  }
});

app.get('/api/admin/chats/:chatId/messages', async (req: Request, res: Response) => {
  const user = await requireAdminChatUser(req, res);
  if (!user || !adminDb) return;
  try {
    const chatSnapshot = await adminDb.collection('admin_chats').doc(req.params.chatId).get();
    const chat = chatSnapshot.data();
    if (!chatSnapshot.exists || (!user.isSuperAdmin && !chat?.participantIds?.includes(user.uid))) {
      res.status(404).json({ error: 'Chat not found.' });
      return;
    }
    const snapshot = await adminDb.collection('admin_chats').doc(req.params.chatId).collection('messages').get();
    const messages = snapshot.docs.map((messageDoc) => ({ id: messageDoc.id, ...messageDoc.data(), createdAt: firestoreMillis(messageDoc.data().createdAt) }))
      .sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0));
    res.json({ messages });
  } catch (error) {
    console.error('[Admin Chat] Could not load messages:', error);
    res.status(500).json({ error: 'Could not load chat messages.' });
  }
});

app.post('/api/admin/chats/:chatId/leave', async (req: Request, res: Response) => {
  const user = await requireAdminChatUser(req, res);
  if (!user || !adminDb) return;
  try {
    const chatRef = adminDb.collection('admin_chats').doc(req.params.chatId);
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(chatRef);
      const chat = snapshot.data();
      if (!snapshot.exists || !chat || chat.type !== 'group') {
        throw new Error('Only group chats can be left.');
      }
      const participantIds = Array.isArray(chat.participantIds) ? chat.participantIds : [];
      if (!participantIds.includes(user.uid)) {
        throw new Error('You are not a member of this group.');
      }
      const participantEmails = Array.isArray(chat.participantEmails) ? chat.participantEmails : [];
      transaction.update(chatRef, {
        participantIds: participantIds.filter((participantId: string) => participantId !== user.uid),
        participantEmails: participantEmails.filter((email: string) => normalizeEmail(email) !== user.email),
        updatedAt: Timestamp.now(),
      });
    });
    res.json({ message: 'You left the group chat.' });
  } catch (error: any) {
    const message = error?.message || 'Could not leave the group chat.';
    res.status(message.includes('Only group') || message.includes('not a member') ? 400 : 500).json({ error: message });
  }
});

app.post('/api/admin/chats/:chatId/participants', async (req: Request, res: Response) => {
  const user = await requireAdminChatUser(req, res);
  if (!user || !adminDb) return;
  if (!user.isSuperAdmin) {
    res.status(403).json({ error: 'Only the superadmin can add people to a group.' });
    return;
  }
  try {
    const requestedIds: string[] = Array.isArray(req.body?.participantIds)
      ? [...new Set<string>(req.body.participantIds.map((value: unknown) => String(value).trim()).filter(Boolean) as string[])]
      : [];
    if (requestedIds.length === 0 || requestedIds.length > 100) {
      res.status(400).json({ error: 'Choose at least one administrator to add.' });
      return;
    }
    const chatRef = adminDb.collection('admin_chats').doc(req.params.chatId);
    const chatSnapshot = await chatRef.get();
    const chat = chatSnapshot.data();
    if (!chatSnapshot.exists || !chat || chat.type !== 'group') {
      res.status(400).json({ error: 'People can only be added to group chats.' });
      return;
    }
    const currentIds = Array.isArray(chat.participantIds) ? chat.participantIds : [];
    const currentEmails = Array.isArray(chat.participantEmails) ? chat.participantEmails : [];
    const additions: { uid: string; email: string }[] = [];
    for (const uid of requestedIds) {
      if (currentIds.includes(uid)) continue;
      const appointedAdmin = await adminDb.collection('admins').doc(uid).get();
      let account = await adminAuth?.getUser(uid).catch(() => null);
      const isConfiguredSuperadmin = Boolean(account?.email && SUPER_ADMIN_EMAILS.has(normalizeEmail(account.email)));
      if (!appointedAdmin.exists && !isConfiguredSuperadmin) continue;
      if (!account) account = await adminAuth?.getUser(uid).catch(() => null);
      const email = normalizeEmail(String(account?.email || appointedAdmin.data()?.email || ''));
      if (email) additions.push({ uid, email });
    }
    if (additions.length === 0) {
      res.status(400).json({ error: 'No new administrator accounts were selected.' });
      return;
    }
    await chatRef.update({
      participantIds: [...currentIds, ...additions.map((addition) => addition.uid)],
      participantEmails: [...currentEmails, ...additions.map((addition) => addition.email)],
      updatedAt: Timestamp.now(),
    });
    const updatedChat = await chatRef.get();
    const updated = updatedChat.data() || {};
    res.json({ chat: { id: updatedChat.id, ...updated, createdAt: firestoreMillis(updated.createdAt), updatedAt: firestoreMillis(updated.updatedAt) } });
  } catch (error) {
    console.error('[Admin Chat] Could not add group participants:', error);
    res.status(500).json({ error: 'Could not add people to the group.' });
  }
});

app.post('/api/admin/chats/:chatId/messages', async (req: Request, res: Response) => {
  const user = await requireAdminChatUser(req, res);
  if (!user || !adminDb) return;
  const text = String(req.body?.text || '').trim();
  if (!text || text.length > 2000) {
    res.status(400).json({ error: 'Message must contain between 1 and 2000 characters.' });
    return;
  }
  try {
    const chatRef = adminDb.collection('admin_chats').doc(req.params.chatId);
    const chatSnapshot = await chatRef.get();
    const chat = chatSnapshot.data();
    if (!chatSnapshot.exists || (!user.isSuperAdmin && !chat?.participantIds?.includes(user.uid))) {
      res.status(404).json({ error: 'Chat not found.' });
      return;
    }
    const messageRef = await chatRef.collection('messages').add({
      senderId: user.uid,
      senderEmail: user.email,
      senderName: user.email,
      text,
      createdAt: Timestamp.now(),
    });
    await chatRef.update({ updatedAt: Timestamp.now(), lastMessagePreview: text.slice(0, 140) });
    res.json({ message: { id: messageRef.id, senderId: user.uid, senderEmail: user.email, senderName: user.email, text, createdAt: Date.now() } });
  } catch (error) {
    console.error('[Admin Chat] Could not send message:', error);
    res.status(500).json({ error: 'Could not send the message.' });
  }
});

app.post('/api/recovery/issue', rateLimit(3, 10 * 60_000), async (req: Request, res: Response) => {
  const user = await requireApiUser(req, res);
  if (!user) return;
  if (!adminDb || !adminAuth) {
    res.status(503).json({ error: 'Secure recovery is not configured on the server yet.' });
    return;
  }

  try {
    const account = await adminAuth.getUser(user.uid);
    const code = generateRecoveryCode();
    const salt = randomBytes(16);
    const now = Date.now();
    const expiresAt = now + RECOVERY_CODE_TTL_MS;
    const requestRef = adminDb.collection('recovery_requests').doc(recoveryLookupId(code));

    await requestRef.set({
      uid: user.uid,
      email: normalizeEmail(account.email || user.email),
      displayName: account.displayName || '',
      codeHash: hashRecoveryCode(code, salt).toString('hex'),
      codeSalt: salt.toString('hex'),
      status: 'issued',
      attempts: 0,
      createdAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(expiresAt),
    });

    await notifyRecoveryAdmins(
      `[Vault X] Recovery code issued for UID ${user.uid}`,
      `A recovery code was issued for a Vault X account. No recovery code is included in this notification.\n\nUID: ${user.uid}\nAccount email: ${account.email || user.email}\nExpires: ${new Date(expiresAt).toISOString()}\n\nAn admin approval is required before any email change can happen.`,
      { UID: user.uid, 'Account email': account.email || user.email, Expires: new Date(expiresAt).toISOString() }
    );

    res.json({ code, expiresAt });
  } catch (error) {
    console.error('[Recovery] Could not issue recovery code:', error);
    res.status(500).json({ error: 'Could not issue a recovery code.' });
  }
});

app.post('/api/recovery/request-email-change', rateLimit(5, 10 * 60_000), async (req: Request, res: Response) => {
  const code = normalizeRecoveryCode(req.body?.code);
  const newEmail = normalizeEmail(req.body?.newEmail);
  if (code.length !== 6 || !/^[A-Z0-9]{6}$/.test(code) || !/^\S+@\S+\.\S+$/.test(newEmail)) {
    res.status(400).json({ error: 'Enter a valid 6-character recovery code and a valid new email address.' });
    return;
  }
  if (!adminDb || !adminAuth) {
    res.status(503).json({ error: 'Secure recovery is not configured on the server yet.' });
    return;
  }

  try {
    const requestRef = adminDb.collection('recovery_requests').doc(recoveryLookupId(code));
    const snapshot = await requestRef.get();
    const request = snapshot.data();
    if (!snapshot.exists || !request) {
      res.status(400).json({ error: 'The code is invalid or expired.' });
      return;
    }

    const expiresAt = request.expiresAt?.toMillis?.() || 0;
    if (request.status !== 'issued' || expiresAt <= Date.now()) {
      res.status(400).json({ error: 'The code is invalid or expired.' });
      return;
    }

    const attempts = Number(request.attempts || 0) + 1;
    if (attempts > RECOVERY_MAX_ATTEMPTS) {
      await requestRef.update({ attempts, status: 'locked', updatedAt: Timestamp.now() });
      res.status(429).json({ error: 'Too many attempts. Ask an administrator for help.' });
      return;
    }
    if (!recoveryCodeMatches(code, String(request.codeSalt), String(request.codeHash))) {
      await requestRef.update({ attempts, updatedAt: Timestamp.now() });
      res.status(400).json({ error: 'The code is invalid or expired.' });
      return;
    }

    const existing = await adminAuth.getUserByEmail(newEmail).catch(() => null);
    if (existing && existing.uid !== request.uid) {
      res.status(409).json({ error: 'That email is already linked to another Vault X account.' });
      return;
    }

    await requestRef.update({
      status: 'pending_approval',
      proposedEmail: newEmail,
      attempts,
      requestedAt: Timestamp.now(),
    });

    await notifyRecoveryAdmins(
      `[Vault X] APPROVAL REQUIRED: email recovery for UID ${request.uid}`,
      `A user has requested to change their Vault X sign-in email. Review this request in the Admin Console before approving.\n\nUID: ${request.uid}\nCurrent email: ${request.email}\nRequested email: ${newEmail}\n\nThe recovery code was verified successfully.`,
      { UID: String(request.uid), 'Current email': String(request.email), 'Requested email': newEmail, Status: 'Pending approval' }
    );

    res.json({ message: 'Your request was verified and sent to the administrators for approval.' });
  } catch (error) {
    console.error('[Recovery] Could not process email recovery request:', error);
    res.status(500).json({ error: 'Could not process the recovery request.' });
  }
});

app.get('/api/admin/recovery-requests', async (req: Request, res: Response) => {
  const user = await requireApiUser(req, res, ['addAdmins', 'answerComplaints']);
  if (!user || !adminDb) return;
  try {
    const snapshot = await adminDb.collection('recovery_requests').get();
    const requests = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((request: any) => request.status === 'pending_approval')
      .sort((a: any, b: any) => (b.requestedAt?.toMillis?.() || 0) - (a.requestedAt?.toMillis?.() || 0))
      .map((request: any) => ({
        id: request.id,
        uid: request.uid,
        currentEmail: request.email,
        proposedEmail: request.proposedEmail,
        requestedAt: request.requestedAt?.toMillis?.() || null,
        expiresAt: request.expiresAt?.toMillis?.() || null,
      }));
    res.json({ requests });
  } catch (error) {
    console.error('[Recovery] Could not list recovery requests:', error);
    res.status(500).json({ error: 'Could not load recovery requests.' });
  }
});

app.post('/api/admin/recovery-requests/:id/decision', async (req: Request, res: Response) => {
  const user = await requireApiUser(req, res, ['addAdmins', 'answerComplaints']);
  if (!user || !adminDb || !adminAuth) return;
  const approved = req.body?.approved === true;
  const requestRef = adminDb.collection('recovery_requests').doc(req.params.id);

  try {
    const snapshot = await requestRef.get();
    const request = snapshot.data();
    if (!snapshot.exists || !request || request.status !== 'pending_approval') {
      res.status(404).json({ error: 'This recovery request is no longer pending.' });
      return;
    }

    if (!approved) {
      await requestRef.update({ status: 'rejected', rejectedBy: user.uid, rejectedAt: Timestamp.now() });
      res.json({ message: 'Recovery request rejected.' });
      return;
    }

    const proposedEmail = normalizeEmail(request.proposedEmail);
    if (!/^\S+@\S+\.\S+$/.test(proposedEmail)) {
      res.status(400).json({ error: 'The requested email is invalid.' });
      return;
    }
    const existing = await adminAuth.getUserByEmail(proposedEmail).catch(() => null);
    if (existing && existing.uid !== request.uid) {
      res.status(409).json({ error: 'That email is already linked to another account.' });
      return;
    }

    await adminAuth.updateUser(request.uid, { email: proposedEmail, emailVerified: false });
    await adminDb.collection('users').doc(request.uid).set({ email: proposedEmail, updatedAt: Timestamp.now() }, { merge: true });
    await requestRef.update({ status: 'approved', approvedBy: user.uid, approvedAt: Timestamp.now(), usedAt: Timestamp.now() });

    res.json({ message: 'Recovery approved. The user can now sign in with the new email address.' });
  } catch (error) {
    console.error('[Recovery] Could not decide recovery request:', error);
    res.status(500).json({ error: 'Could not update the recovery request.' });
  }
});

// Initialize Gemini SDK with User-Agent telemetry
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && !apiKey.startsWith('MY_')) {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// System instruction enforcing Vault Information Storage Guidance and Email routing for abstract inquiries/complaints
const SYSTEM_INSTRUCTION = `You are the CyberVault Storage & Security Assistant, an intelligent guide embedded inside the Clockin Vault web application.

PRIMARY MISSION:
Guide authenticated users on how to store, organize, protect, and manage their sensitive information in the vault:
1. Storing Credentials & Passwords:
   - Click the "+ Add Item" button in the upper toolbar.
   - Select the "Password / Credential" tab.
   - Enter Title (e.g. "Work Email", "AWS Console"), Service/Website, and Username/Email.
   - For Passwords, users can type their own or click the Magic Wand / Generate button to create strong random passwords with customizable length and character sets.
   - Add optional URL and encrypted secret notes.
2. Storing Secure Documents & Private Notes:
   - Select "+ Add Item" and switch to the "Secure Document" tab.
   - Store passport info, recovery seeds, API tokens, license keys, medical notes, or bank account details.
3. Organization & Management:
   - Use Categories: Personal, Work, Finance, Social, Document.
   - Attach comma-separated tags (e.g., "primary, critical, 2fa").
   - Star any card to mark it as a Favorite for quick 1-click filtering.
   - Search instantly by title, username, service, or tags using the Cyber Search bar.
4. Security & Isolation Architecture:
   - Explain that data is isolated per authenticated user in Google Cloud Firestore under /users/{user.uid}/vault/{itemId}.
   - Firestore security rules strictly block other users or unauthenticated clients from reading or modifying vault items.
5. Credential Storage Limits & Paid Feature (+20 Slots):
   - Free plan: Normal users receive 10 slots to store their credentials.
   - Paid upgrade: Users can allot 20 more credential slots (for 30 total slots) by paying $4.88 USD or ₦6,500 Naira.
   - The payment is handled via a separate dedicated page showing the official bank account number and transfer instructions.
   - Users can navigate to the upgrade page anytime via the "Upgrade (+20 Slots)" button in the header or the Side Box on their dashboard.

CRITICAL POLICY FOR ABSTRACT INQUIRIES & COMPLAINTS:
- If the user asks an ABSTRACT INQUIRY (such as unrelated trivia, philosophical questions, jokes, riddles, cooking recipes, general chit-chat, world news, life advice, or queries not related to vault storage and data protection), OR
- If the user submits a COMPLAINT, grievance, bug report, dispute, feature request, or asks how to contact human support:
YOU MUST POLITELY DIRECT THEM TO SEND THEIR COMPLAINT OR ABSTRACT INQUIRY TO THE ADMINISTRATOR EMAIL:
${SUPPORT_EMAIL}

Example response for abstract inquiries/complaints:
"For abstract inquiries, bug reports, feedback, or complaints, please reach out directly to the vault administrator at: **${SUPPORT_EMAIL}**."

Keep your tone professional, high-tech cyber-security oriented, concise, and helpful. Always provide actionable, step-by-step instructions.

INTELLIGENT CONVERSATION RULES:
- Answer Vault X questions naturally instead of repeating a fixed script.
- Use the supplied safe vault summary to answer count and organization questions.
- Never ask for or repeat passwords, secret notes, document contents, recovery phrases, API keys, or payment credentials. The summary never contains those secrets.
- Troubleshoot user-reported problems first with practical checks. Only direct genuine complaints, billing disputes, security incidents, or human-support requests to ${SUPPORT_EMAIL}.
- Ask one focused clarifying question when the request is ambiguous.
- For simple greetings such as "hello", "hi", or "hey", reply with a short friendly welcome and ask how you can help. Do not mention an empty vault or the "+ Add Item" button unless the user asks how to add or store something.
- Never claim to have completed an action unless the interface actually performed it, and never invent features or security guarantees.`;

// Intelligent fallback logic when Gemini API key is unavailable or fails
function getFallbackResponse(query: string): string {
  const q = query.toLowerCase().trim();

  // Abstract inquiry or complaint detection
  const isComplaint = /complaint|problem|issue|bug|error|dispute|broken|refund|hate|sucks|contact|human|admin|email|manager/i.test(q);
  const isAbstract = /weather|recipe|cook|joke|riddle|philosophy|meaning of life|president|movie|song|who made you|capital of|tell me a story/i.test(q);

  if (isComplaint || isAbstract) {
    return `For abstract inquiries, feedback, or complaints, please reach out directly to the vault administrator at **${SUPPORT_EMAIL}**.\n\nYou can email anytime with your inquiries, feedback, or issue details.`;
  }

  // Password storage
  if (/password|credential|login|passphrase/i.test(q)) {
    return `### How to Store Passwords in CyberVault:
1. Click the **"+ Add Item"** button on your dashboard.
2. Select the **"Password / Credential"** tab.
3. Fill in the **Title** (e.g., *GitHub Developer*, *Bank Account*).
4. Enter your **Username / Email**.
5. Type your password or click the **Wand (Generate)** icon to craft an ultra-secure 16+ character password.
6. Select a category (**Personal**, **Work**, **Finance**, or **Social**) and add tags (e.g., *critical, dev*).
7. Click **"Encrypt & Store Record"**. Your password is saved in your private Firestore database!`;
  }

  // Document / Note storage
  if (/document|note|passport|seed|license|memo|tax|secure note|text/i.test(q)) {
    return `### How to Store Secure Documents & Notes:
1. Click **"+ Add Item"** in the top navigation.
2. Switch to the **"Secure Document"** tab.
3. Give your document a title (e.g., *Passport & Visa Numbers*, *Crypto Recovery Seed*, *Server API Keys*).
4. Paste your sensitive information in the **Secret Content & Notes** field.
5. Assign a Category and custom tags for rapid filtering.
6. Click **"Encrypt & Store Record"** to isolate and protect your data.`;
  }

  // Security & Encryption
  if (/secure|security|encrypt|safe|hack|firewall|isolation|firestore|database/i.test(q)) {
    return `### Vault Security & Isolation Protocol:
- **Per-User Database Isolation**: All your vault entries are stored strictly under \`/users/{your-uid}/vault/{itemId}\` in Google Cloud Firestore.
- **Server-Enforced Rules**: Firebase security rules ensure that *only your authenticated Google Account* has read or write permissions. No other user can access your vault.
- **Micro-Decrypt Obfuscation**: Passwords remain concealed behind cyber masks until you explicitly click the reveal eye icon.
- **Safe Copy**: One-click clipboard copy allows you to paste credentials without exposing them visually.`;
  }

  // Organization & Search
  if (/tag|search|favorite|filter|organize|category|star/i.test(q)) {
    return `### Organizing & Finding Your Information:
- **Categories**: Filter by *Personal*, *Work*, *Finance*, *Social*, and *Document* using the category selector.
- **Favorites**: Click the **Star icon** on any vault card to pin it to your quick-access Favorites view.
- **Cyber Search**: Type in the search bar to filter instantly across titles, usernames, domains, and custom tags.
- **View Modes**: Switch between **All Items**, **Passwords Only**, **Documents Only**, and **Favorites** in the header.`;
  }

  // Storage Slot Limits, Paid Feature & Payment Page
  if (/slot|upgrade|price|pricing|cost|pay|paid|naira|dollar|account number|bank|buy|plan|tier/i.test(q)) {
    return `### Credential Storage Plans & Paid Upgrade:
- **Free Plan**: Every normal user is allotted **10 credential slots** free of charge.
- **Paid Upgrade (+20 Slots)**: You can allot **20 additional slots** (for **30 total credential slots**) by paying **$4.88 USD** or **₦6,500 Naira**.
- **Separate Payment Page**: Clicking the **"Upgrade (+20 Slots)"** button in the header or the **Side Box** redirects you to a dedicated page containing the official bank account number, transfer details, and proof verification.
- **How to Pay**: Transfer $4.88 or ₦6,500 to the official bank account displayed on that page, enter your transaction reference, and your slots will unlock immediately!`;
  }

  // General fallback
  return `### CyberVault Information Storage Guide:
Welcome to CyberVault! You can store and manage two primary types of data:
1. **Passwords & Credentials**: Click **"+ Add Item"** -> select **"Password / Credential"** -> enter service, username, and password.
2. **Encrypted Documents & Notes**: Click **"+ Add Item"** -> select **"Secure Document"** -> store confidential text, seeds, and records.

All data is strictly isolated to your authenticated account.

*Note: For any abstract inquiry, bug report, or complaint, please send an email directly to the administrator at **${SUPPORT_EMAIL}**.*`;
}

// Chat API endpoint
app.post('/api/chat', rateLimit(20, 60_000), async (req: Request, res: Response) => {
  try {
    const { message, history, vaultSummary } = req.body;
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const trimmed = message.trim();
    const authenticatedUser = await verifyApiUser(req);
    if (!authenticatedUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (/^(hi|hello|hey|good morning|good afternoon|good evening)[!.?,\s]*$/i.test(trimmed)) {
      res.json({
        reply: 'Hello! How can I help you use Vault X today?',
        supportEmail: SUPPORT_EMAIL,
        source: 'greeting',
      });
      return;
    }

    // Check if Gemini client is available
    if (aiClient) {
      try {
        // Construct conversation contents with system instruction
        const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

        // Add recent message history if available
        if (Array.isArray(history)) {
          const recent = history.slice(-6);
          for (const item of recent) {
            if (item && item.role && item.text) {
              contents.push({
                role: item.role === 'user' ? 'user' : 'model',
                parts: [{ text: item.text }],
              });
            }
          }
        }

        const safeSummary = vaultSummary && typeof vaultSummary === 'object'
          ? JSON.stringify({
              total: Number(vaultSummary.total) || 0,
              credentials: Number(vaultSummary.credentials) || 0,
              documents: Number(vaultSummary.documents) || 0,
              favorites: Number(vaultSummary.favorites) || 0,
              categories: Array.isArray(vaultSummary.categories)
                ? vaultSummary.categories.filter((category: unknown) => typeof category === 'string').slice(0, 20)
                : [],
            })
          : '{}';

        contents.push({
          role: 'user',
          parts: [{ text: `Safe current vault summary (metadata only; no secrets): ${safeSummary}` }],
        });

        // Add latest user message
        contents.push({
          role: 'user',
          parts: [{ text: trimmed }],
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini request timeout')), 12000)
        );

        const geminiCall = aiClient.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.3,
          },
        });

        const geminiResponse = await Promise.race([geminiCall, timeoutPromise]);

        const replyText = geminiResponse.text?.trim() || getFallbackResponse(trimmed);
        res.json({
          reply: replyText,
          supportEmail: SUPPORT_EMAIL,
          source: 'gemini',
        });
        return;
      } catch (_geminiError) {
        // Graceful fallback to built-in knowledge base if network delay occurs
        const replyText = getFallbackResponse(trimmed);
        res.json({
          reply: replyText,
          supportEmail: SUPPORT_EMAIL,
          source: 'fallback',
        });
        return;
      }
    }

    // Fallback response when no API key configured
    const replyText = getFallbackResponse(trimmed);
    res.json({
      reply: replyText,
      supportEmail: SUPPORT_EMAIL,
      source: 'fallback',
    });
  } catch (err: unknown) {
    console.error('Error handling chat request:', err);
    res.status(500).json({
      error: 'Failed to process chat message',
      supportEmail: SUPPORT_EMAIL,
    });
  }
});

// Persistent Local Storage for Audit Records
const DATA_DIR = path.resolve(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (_e) {
    // ignore
  }
}
const PAYMENTS_FILE = path.resolve(DATA_DIR, 'payment_submissions.json');
const TICKETS_FILE = path.resolve(DATA_DIR, 'support_submissions.json');

export interface StoredPayment {
  id: string;
  userId: string;
  userEmail: string;
  senderName: string;
  bankUsed: string;
  paymentRef: string;
  paymentCurrency: 'NGN' | 'USD';
  amount: number;
  formattedAmount: string;
  planDuration?: 'biweekly' | 'monthly' | 'yearly';
  planName?: string;
  status: 'pending' | 'verified' | 'rejected';
  submittedAt: string;
  timestamp: number;
  emailDeliveryStatus?: string;
  emailDeliveryMethod?: string;
  receiptName?: string;
  receiptType?: string;
  receiptSize?: number;
}

export interface StoredTicket {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  type: string;
  subject: string;
  message: string;
  priority?: string;
  status: 'pending' | 'reviewed' | 'resolved';
  submittedAt: string;
  timestamp: number;
  emailDeliveryStatus?: string;
  emailDeliveryMethod?: string;
}

function loadPaymentSubmissions(): StoredPayment[] {
  try {
    if (fs.existsSync(PAYMENTS_FILE)) {
      const data = fs.readFileSync(PAYMENTS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed reading payment submissions:', err);
  }
  return [];
}

function savePaymentSubmission(record: StoredPayment): void {
  try {
    const list = loadPaymentSubmissions();
    const existingIndex = list.findIndex((p) => p.id === record.id);
    if (existingIndex >= 0) {
      list[existingIndex] = record;
    } else {
      list.unshift(record);
    }
    fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed saving payment submission:', err);
  }
}

function updatePaymentStatus(id: string, status: 'pending' | 'verified' | 'rejected'): StoredPayment | null {
  try {
    const list = loadPaymentSubmissions();
    const item = list.find((p) => p.id === id);
    if (item) {
      item.status = status;
      fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(list, null, 2), 'utf-8');
      return item;
    }
  } catch (err) {
    console.error('Failed updating payment status:', err);
  }
  return null;
}

function loadSupportSubmissions(): StoredTicket[] {
  try {
    if (fs.existsSync(TICKETS_FILE)) {
      const data = fs.readFileSync(TICKETS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed reading support tickets:', err);
  }
  return [];
}

function saveSupportSubmission(record: StoredTicket): void {
  try {
    const list = loadSupportSubmissions();
    const existingIndex = list.findIndex((t) => t.id === record.id);
    if (existingIndex >= 0) {
      list[existingIndex] = record;
    } else {
      list.unshift(record);
    }
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed saving support ticket:', err);
  }
}

/**
 * Universal email notification dispatcher:
 * 1. Checks if SMTP credentials are configured (Nodemailer).
 * 2. Attempts FormSubmit email forwarding to SUPPORT_EMAIL.
 * 3. Returns delivery status and logs details to console.
 */
async function dispatchEmailNotification({
  subject,
  replyTo,
  fields,
  textContent,
  htmlContent,
  recipientEmail = SUPPORT_EMAIL,
  attachments,
}: {
  subject: string;
  replyTo?: string;
  fields: Record<string, string | number | undefined>;
  textContent: string;
  htmlContent?: string;
  recipientEmail?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}): Promise<{ sent: boolean; method: string; message: string }> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  // 1. Direct SMTP via Nodemailer if credentials provided
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: `"Clockin Vault" <${smtpUser}>`,
        to: recipientEmail,
        replyTo: replyTo || smtpUser,
        subject,
        text: textContent,
        html: htmlContent || `<pre style="font-family:sans-serif;white-space:pre-wrap;">${textContent}</pre>`,
        attachments,
      });

      console.log(`[Email Dispatch] SMTP delivered email to ${recipientEmail}`);
      return {
        sent: true,
        method: 'smtp',
        message: `Directly delivered to ${recipientEmail} via SMTP.`,
      };
    } catch (smtpErr) {
      console.error('[Email Dispatch] SMTP failed, attempting fallback gateway:', smtpErr);
    }
  }

  // 2. Gateway Dispatch via FormSubmit
  try {
    const appUrl = process.env.APP_URL || 'https://clockinvault.local';
    const formSubmitPayload: Record<string, any> = {
      _subject: subject,
      _replyto: replyTo || SUPPORT_EMAIL,
      _template: 'table',
      ...fields,
    };

    const res = await fetch(`https://formsubmit.co/ajax/${recipientEmail}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: appUrl,
        Referer: `${appUrl}/`,
      },
      body: JSON.stringify(formSubmitPayload),
    });

    const data = (await res.json().catch(() => null)) as any;
    console.log('[Email Dispatch] FormSubmit response:', data);

    if (data && (data.success === 'true' || data.success === true)) {
      return {
        sent: true,
        method: 'formsubmit',
        message: `Delivered to ${recipientEmail} via FormSubmit email gateway.`,
      };
    }

    if (data && data.message && data.message.includes('Activation')) {
      return {
        sent: false,
        method: 'formsubmit-activation-pending',
        message: `FormSubmit activation required: please open the email sent by FormSubmit to ${recipientEmail} and click 'Activate Form' to receive future automated emails in your inbox!`,
      };
    }

    return {
      sent: false,
      method: 'formsubmit',
      message: data?.message || 'FormSubmit response received',
    };
  } catch (fsErr) {
    console.warn('[Email Dispatch] FormSubmit network warning:', fsErr);
    return {
      sent: false,
      method: 'logged',
      message: 'Recorded in internal server audit database.',
    };
  }
}

// Endpoint to retrieve support email and status info
app.get('/api/support-info', (_req: Request, res: Response) => {
  res.json({
    supportEmail: SUPPORT_EMAIL,
  });
});

// Endpoint to get all payment submissions for Admin Console
app.get('/api/admin/payments', async (req: Request, res: Response) => {
  const user = await requireApiUser(req, res, ['viewTransactions', 'receiveTransactionNotices']);
  if (!user) return;
  const list = loadPaymentSubmissions();
  res.json({
    success: true,
    payments: list,
    supportEmail: SUPPORT_EMAIL,
  });
});

// Endpoint to update payment submission status
app.post('/api/admin/payments/:id/status', async (req: Request, res: Response) => {
  const user = await requireApiUser(req, res, 'giveSlots');
  if (!user) return;
  const { id } = req.params;
  const { status } = req.body;
  if (!['pending', 'verified', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  const updated = updatePaymentStatus(id, status);
  if (!updated) {
    res.status(404).json({ error: 'Payment record not found' });
    return;
  }
  res.json({ success: true, payment: updated });
});

// Endpoint to get all support tickets for Admin Console
app.get('/api/admin/support-tickets', async (req: Request, res: Response) => {
  const user = await requireApiUser(req, res, ['answerComplaints', 'redirectSuggestions']);
  if (!user) return;
  const list = loadSupportSubmissions();
  res.json({
    success: true,
    tickets: list,
  });
});

// Endpoint to handle bank transfer payment submission with user UID and send confirmation email notice
app.post('/api/payment-submission', rateLimit(5, 10 * 60_000), async (req: Request, res: Response) => {
  try {
    const { userId, userEmail, senderName, bankUsed, paymentRef, planDuration = 'biweekly', amount, receipt } = req.body;
    const user = await requireApiUser(req, res);
    if (!user) return;

    if (user.uid !== userId || (userEmail && user.email !== String(userEmail).toLowerCase())) {
      res.status(403).json({ error: 'Payment identity does not match the signed-in account.' });
      return;
    }
    if (
      typeof senderName !== 'string' || senderName.trim().length < 1 || senderName.length > 120 ||
      typeof bankUsed !== 'string' || bankUsed.trim().length < 1 || bankUsed.length > 100 ||
      (paymentRef !== undefined && (typeof paymentRef !== 'string' || paymentRef.length > 200)) ||
      !['biweekly', 'monthly', 'yearly'].includes(planDuration)
    ) {
      res.status(400).json({ error: 'Payment details are invalid or too long.' });
      return;
    }
    if (!senderName || !bankUsed || !receipt?.name || !receipt?.data) {
      res.status(400).json({ error: 'Sender name, bank used, and a payment receipt are required.' });
      return;
    }

    const safeReceiptName = String(receipt.name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160);
    const receiptSize = Number(receipt.size) || 0;
    if (receiptSize <= 0 || receiptSize > 10 * 1024 * 1024 || typeof receipt.data !== 'string') {
      res.status(400).json({ error: 'Receipt must be a valid file of 10MB or less.' });
      return;
    }
    const receiptType = String(receipt.type || '').toLowerCase();
    const allowedReceiptTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ]);
    if (!allowedReceiptTypes.has(receiptType)) {
      res.status(400).json({ error: 'Receipt must be a JPEG, PNG, WebP image, or PDF.' });
      return;
    }
    if (
      typeof receipt.data !== 'string' ||
      receipt.data.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(receipt.data)
    ) {
      res.status(400).json({ error: 'Receipt file encoding is invalid.' });
      return;
    }
    const receiptBuffer = Buffer.from(receipt.data, 'base64');
    if (!receiptBuffer.length || receiptBuffer.length > 10 * 1024 * 1024) {
      res.status(400).json({ error: 'Receipt file could not be validated.' });
      return;
    }

    let planName = '2-Weekly Plan (14 Days)';
    let planSlots = '+20 Credential Slots (30 slots total)';
    let calculatedAmount = 2000;

    if (planDuration === 'monthly') {
      planName = 'Monthly Plan (30 Days)';
      planSlots = '+40 Credential Slots (50 slots total)';
      calculatedAmount = 8000;
    } else if (planDuration === 'yearly') {
      planName = 'Yearly Plan (365 Days)';
      planSlots = 'Unlimited Credential Slots';
      calculatedAmount = 15000;
    }

    const submittedAmount = Number(amount);
    if (amount !== undefined && (!Number.isFinite(submittedAmount) || submittedAmount !== calculatedAmount)) {
      res.status(400).json({ error: 'The submitted amount does not match the selected plan.' });
      return;
    }
    const finalAmount = calculatedAmount;
    const formattedAmount = `₦${finalAmount.toLocaleString()} NGN`;
    const submittedAt = new Date().toUTCString();
    const paymentId = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Build Email for Admin
    const adminEmailSubject = `[Clockin Vault] NEW PAYMENT SUBMISSION - ${senderName} (${formattedAmount} - ${planName}) - UID: ${userId}`;
    const adminEmailBody = `NEW BANK TRANSFER PAYMENT SUBMISSION
Clockin Vault Storage Upgrade - ${planName}
Slots Allotment: ${planSlots}

VERIFICATION METRICS:
------------------------------------------------------
User Verification UID: ${userId}
User Email:            ${userEmail || 'Not specified'}
Selected Plan:         ${planName}
Allotted Slots:        ${planSlots}
Sender / Depositor:    ${senderName}
Bank Used in Transfer: ${bankUsed}
Payment Reference:     ${paymentRef || 'N/A'}
Receipt:               ${safeReceiptName} (${Math.round(receiptBuffer.length / 1024)} KB)
Amount Transferred:    ${formattedAmount}
Currency:              NGN (Nigerian Naira)
Submission Time:       ${submittedAt}
Payment Record ID:     ${paymentId}
------------------------------------------------------

CONFIRMATION NOTICE ISSUED TO USER:
"Your payment would be confirmed within 2 working days."

ADMIN ACTION REQUIRED:
1. Verify the deposit of ${formattedAmount} from "${senderName}" via ${bankUsed} in your bank account statement.
2. Sign in to Clockin Vault as ${SUPPORT_EMAIL}.
3. Open the Admin Console and click "Approve & Start Countdown" for User UID "${userId}".
Note: Once approved, the admin countdown will start and will only be visible on your admin console.`;

    // Confirmation Notice for the Paying User
    const customerEmailSubject = `Payment Submission Received - Clockin Vault Upgrade: ${planName} (UID: ${userId})`;
    const customerEmailContent = `Subject: Payment Submission Received - Clockin Vault Upgrade (UID: ${userId})

Dear User,

We have successfully received your payment submission for Clockin Vault (${planName} - ${planSlots}).

TRANSFER VERIFICATION DETAILS:
- User Verification UID: ${userId}
- User Email: ${userEmail || 'Not specified'}
- Plan Selected: ${planName}
- Sender / Depositor Name: ${senderName}
- Bank Used for Transfer: ${bankUsed}
- Transaction Narration / Reference: ${paymentRef || 'N/A'}
- Amount Transferred: ${formattedAmount}
- Timestamp: ${submittedAt}

CONFIRMATION NOTICE:
Your payment would be confirmed within 2 working days.

Our administrative team will match your bank transfer with our official account statements. Once confirmed, your additional credential slots will be activated on your account.

If you have any questions or require urgent verification, please reply to this notice or contact the administrator at ${SUPPORT_EMAIL} quoting your User UID: ${userId}.

Thank you for choosing Clockin Vault.
Quantum-Resistant Isolated Storage`;

    // 1. Dispatch email notification to Administrator
    const adminDelivery = await dispatchEmailNotification({
      subject: adminEmailSubject,
      replyTo: userEmail || SUPPORT_EMAIL,
      recipientEmail: SUPPORT_EMAIL,
      fields: {
        Notification: 'NEW PAYMENT SUBMISSION',
        User_UID: userId,
        User_Email: userEmail || 'N/A',
        Sender_Name: senderName,
        Bank_Used: bankUsed,
        Amount: formattedAmount,
        Payment_Reference: paymentRef || 'N/A',
        Receipt_File: safeReceiptName,
        Submission_Date: submittedAt,
        Notice_To_Customer: 'Payment would be confirmed within 2 working days',
      },
      textContent: adminEmailBody,
      attachments: [{ filename: safeReceiptName, content: receiptBuffer, contentType: receiptType }],
    });

    // 2. Also try sending confirmation to the user if userEmail is provided and SMTP is set up
    let userDelivery = null;
    if (userEmail && process.env.SMTP_HOST) {
      userDelivery = await dispatchEmailNotification({
        subject: customerEmailSubject,
        replyTo: SUPPORT_EMAIL,
        recipientEmail: userEmail,
        fields: {
          User_UID: userId,
          Amount: formattedAmount,
          Notice: 'Your payment would be confirmed within 2 working days',
        },
        textContent: customerEmailContent,
          attachments: [{ filename: safeReceiptName, content: receiptBuffer, contentType: receiptType }],
      });
    }

    // 3. Save to local audit storage
    const paymentRecord: StoredPayment = {
      id: paymentId,
      userId,
      userEmail: userEmail || '',
      senderName,
      bankUsed,
      paymentRef: paymentRef || '',
      paymentCurrency: 'NGN',
      amount: finalAmount,
      formattedAmount,
      planDuration,
      planName,
      status: 'pending',
      submittedAt,
      timestamp: Date.now(),
      emailDeliveryStatus: adminDelivery.message,
      emailDeliveryMethod: adminDelivery.method,
      receiptName: safeReceiptName,
      receiptType,
      receiptSize: receiptBuffer.length,
    };
    savePaymentSubmission(paymentRecord);

    // 4. Generate 1-click Direct Mail Compose Links
    const gmailAdminUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      SUPPORT_EMAIL
    )}&su=${encodeURIComponent(adminEmailSubject)}&body=${encodeURIComponent(adminEmailBody)}`;

    const mailtoAdminUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      adminEmailSubject
    )}&body=${encodeURIComponent(adminEmailBody)}`;

    const gmailUserUrl = userEmail
      ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
          userEmail
        )}&su=${encodeURIComponent(customerEmailSubject)}&body=${encodeURIComponent(
          customerEmailContent
        )}`
      : '';

    const mailtoUserUrl = userEmail
      ? `mailto:${userEmail}?subject=${encodeURIComponent(
          customerEmailSubject
        )}&body=${encodeURIComponent(customerEmailContent)}`
      : '';

    console.log('\n======================================================');
    console.log(`[PAYMENT SUBMISSION RECEIVED & AUDITED - UID: ${userId}]`);
    console.log(`Sender: ${senderName} | Bank: ${bankUsed} | Ref: ${paymentRef}`);
    console.log(`Amount: ${formattedAmount}`);
    console.log(`Notice: Customer notified payment would be confirmed within 2 working days.`);
    console.log(`Admin Dispatch (${SUPPORT_EMAIL}): [${adminDelivery.method}] ${adminDelivery.message}`);
    console.log('======================================================\n');

    res.json({
      success: true,
      paymentId,
      paymentRecord,
      userUid: userId,
      userEmail,
      confirmedWithin: '2 working days',
      emailContent: customerEmailContent,
      emailDelivery: adminDelivery,
      userDelivery,
      gmailAdminUrl,
      mailtoAdminUrl,
      gmailUserUrl,
      mailtoUserUrl,
      message: `Your payment details have been recorded! A confirmation email notice has been dispatched stating that your payment would be confirmed within 2 working days.`,
    });
  } catch (error) {
    console.error('Error processing payment submission:', error);
    res.status(500).json({ error: 'Failed to process payment submission.' });
  }
});

// Endpoint to receive suggestions and complaints sent to administrator email with user UID
app.post('/api/send-support-ticket', rateLimit(5, 10 * 60_000), async (req: Request, res: Response) => {
  try {
    const { userId, userEmail, userName, type, subject, message, priority, ticketId: requestedTicketId } = req.body;
    const user = await requireApiUser(req, res);
    if (!user) return;

    if (user.uid !== userId || (userEmail && user.email !== String(userEmail).toLowerCase())) {
      res.status(403).json({ error: 'Support ticket identity does not match the signed-in account.' });
      return;
    }

    if (
      typeof subject !== 'string' || subject.trim().length < 1 || subject.length > 200 ||
      typeof message !== 'string' || message.trim().length < 1 || message.length > 5000 ||
      !['suggestion', 'complaint', 'inquiry', 'payment'].includes(type) ||
      !['normal', 'high', 'urgent'].includes(priority || 'normal')
    ) {
      res.status(400).json({ error: 'Support ticket details are invalid or too long.' });
      return;
    }

    const ticketId = typeof requestedTicketId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(requestedTicketId)
      ? requestedTicketId
      : `tkt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const verifiedEmail = user.email;
    const categoryLabel = (type || 'suggestion').toUpperCase();
    const emailSubject = `[Clockin Vault - ${categoryLabel}] ${subject} (UID: ${userId})`;
    const submittedAt = new Date().toUTCString();

    const emailBody = `NEW SUPPORT TICKET / USER SUBMISSION
Clockin Vault Support & Feedback

USER VERIFICATION METRICS:
------------------------------------------------------
User UID:     ${userId}
User Email:   ${verifiedEmail || 'Anonymous'}
User Name:    ${userName || 'Authenticated User'}
Ticket ID:    ${ticketId}
Category:     ${categoryLabel}
Priority:     ${priority || 'Normal'}
Submitted At: ${submittedAt}
------------------------------------------------------

SUBJECT:
${subject}

MESSAGE / GRIEVANCE / SUGGESTION:
${message}

------------------------------------------------------
Admin Note: To verify or update this user's account permissions or slots,
search for User UID "${userId}" in the Admin Console.`;

    // 1. Dispatch email to Administrator
    const delivery = await dispatchEmailNotification({
      subject: emailSubject,
      replyTo: verifiedEmail || SUPPORT_EMAIL,
      recipientEmail: SUPPORT_EMAIL,
      fields: {
        Ticket_Type: categoryLabel,
        User_UID: userId,
        User_Email: verifiedEmail || 'N/A',
        User_Name: userName || 'N/A',
        Subject: subject,
        Message: message,
        Priority: priority || 'Normal',
        Ticket_ID: ticketId,
      },
      textContent: emailBody,
    });

    // 2. Save to local audit storage
    const ticketRecord: StoredTicket = {
      id: ticketId,
      userId,
      userEmail: verifiedEmail || '',
      userName,
      type: type || 'suggestion',
      subject,
      message,
      priority: priority || 'Normal',
      status: 'pending',
      submittedAt,
      timestamp: Date.now(),
      emailDeliveryStatus: delivery.message,
      emailDeliveryMethod: delivery.method,
    };
    saveSupportSubmission(ticketRecord);

    const gmailAdminUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      SUPPORT_EMAIL
    )}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    const mailtoAdminUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      emailSubject
    )}&body=${encodeURIComponent(emailBody)}`;

    console.log('\n======================================================');
    console.log(`[SUPPORT SUBMISSION FORWARDED - UID: ${userId}]`);
    console.log(`Category: ${categoryLabel} | Subject: ${subject}`);
    console.log(`Admin Dispatch (${SUPPORT_EMAIL}): [${delivery.method}] ${delivery.message}`);
    console.log('======================================================\n');

    res.json({
      success: true,
      ticketId,
      ticketRecord,
      adminEmail: SUPPORT_EMAIL,
      userUid: userId,
      emailDelivery: delivery,
      gmailAdminUrl,
      mailtoAdminUrl,
      message: `Your ${type || 'message'} has been sent to the vault administrator at ${SUPPORT_EMAIL} with your User UID (${userId}).`,
    });
  } catch (error) {
    console.error('Error sending support ticket:', error);
    res.status(500).json({ error: 'Failed to forward support ticket.' });
  }
});

// Mount Vite or serve static assets
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CyberVault Server] Running at http://0.0.0.0:${PORT}`);
    console.log(`[CyberVault Server] Support Email: ${SUPPORT_EMAIL}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
