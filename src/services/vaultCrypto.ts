import { doc, getDoc, setDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';

const KDF_ITERATIONS = 600_000;
const encoder = new TextEncoder();
let activeVaultKey: CryptoKey | null = null;

export interface VaultKeyEnvelope {
  version: 1;
  kdf: 'PBKDF2-SHA-256';
  iterations: number;
  passwordSalt: string;
  passwordIv: string;
  passwordWrappedKey: string;
  recoveryIv: string;
  recoveryWrappedKey: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface VaultKeySetup {
  recoveryKey: string;
  envelope: VaultKeyEnvelope;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer as ArrayBuffer;
}

function createRecoveryKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function derivePasswordWrappingKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: asArrayBuffer(salt), iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function wrapVaultKey(vaultKey: CryptoKey, wrappingKey: CryptoKey): Promise<{ iv: string; wrappedKey: string }> {
  const rawVaultKey = await crypto.subtle.exportKey('raw', vaultKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asArrayBuffer(iv) }, wrappingKey, rawVaultKey);
  return { iv: toBase64(iv), wrappedKey: toBase64(new Uint8Array(encrypted)) };
}

async function unwrapVaultKey(wrappedKey: string, iv: string, wrappingKey: CryptoKey): Promise<CryptoKey> {
  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: asArrayBuffer(fromBase64(iv)) },
    wrappingKey,
    asArrayBuffer(fromBase64(wrappedKey))
  );
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function envelopeRef(uid: string) {
  return doc(db, 'users', uid, 'security', 'vaultKey');
}

export function isVaultKeyEnvelope(value: unknown): value is VaultKeyEnvelope {
  const envelope = value as Partial<VaultKeyEnvelope> | null;
  return Boolean(envelope && envelope.version === 1 && envelope.kdf === 'PBKDF2-SHA-256' &&
    Number.isInteger(envelope.iterations) && envelope.iterations! >= 100_000 && envelope.iterations! <= 2_000_000 &&
    typeof envelope.passwordSalt === 'string' && typeof envelope.passwordIv === 'string' &&
    typeof envelope.passwordWrappedKey === 'string' && typeof envelope.recoveryIv === 'string' &&
    typeof envelope.recoveryWrappedKey === 'string');
}

export async function getVaultKeyEnvelope(uid: string): Promise<VaultKeyEnvelope | null> {
  const snapshot = await getDoc(envelopeRef(uid));
  const data = snapshot.data();
  return snapshot.exists() && isVaultKeyEnvelope(data) ? data : null;
}

export async function createVaultKeyEnvelope(uid: string, password: string): Promise<VaultKeySetup> {
  if (!password || password.length < 8) throw new Error('Choose a vault password with at least 8 characters.');
  const ref = envelopeRef(uid);
  const existing = await getDoc(ref);
  if (existing.exists()) throw new Error('Vault encryption is already set up for this account.');

  const vaultKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const passwordSalt = crypto.getRandomValues(new Uint8Array(16));
  const passwordWrappingKey = await derivePasswordWrappingKey(password, passwordSalt, KDF_ITERATIONS);
  const recoveryKey = createRecoveryKey();
  const rawRecoveryKey = recoveryKey.replace(/-/g, '+').replace(/_/g, '/');
  const paddedRecoveryKey = rawRecoveryKey.padEnd(Math.ceil(rawRecoveryKey.length / 4) * 4, '=');
  const recoveryWrappingKey = await crypto.subtle.importKey('raw', asArrayBuffer(fromBase64(paddedRecoveryKey)), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  const passwordWrap = await wrapVaultKey(vaultKey, passwordWrappingKey);
  const recoveryWrap = await wrapVaultKey(vaultKey, recoveryWrappingKey);
  const envelope: VaultKeyEnvelope = {
    version: 1,
    kdf: 'PBKDF2-SHA-256',
    iterations: KDF_ITERATIONS,
    passwordSalt: toBase64(passwordSalt),
    passwordIv: passwordWrap.iv,
    passwordWrappedKey: passwordWrap.wrappedKey,
    recoveryIv: recoveryWrap.iv,
    recoveryWrappedKey: recoveryWrap.wrappedKey,
  };

  await runTransaction(db, async (transaction) => {
    const latest = await transaction.get(ref);
    if (latest.exists()) throw new Error('Vault encryption is already set up for this account.');
    transaction.set(ref, { ...envelope, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  const rawKey = await crypto.subtle.exportKey('raw', vaultKey);
  activeVaultKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  return { recoveryKey, envelope };
}

export async function unlockVaultWithPassword(uid: string, password: string): Promise<void> {
  const envelope = await getVaultKeyEnvelope(uid);
  if (!envelope) throw new Error('Vault encryption has not been set up yet.');
  const wrappingKey = await derivePasswordWrappingKey(password, fromBase64(envelope.passwordSalt), envelope.iterations);
  activeVaultKey = await unwrapVaultKey(envelope.passwordWrappedKey, envelope.passwordIv, wrappingKey);
}

export async function rotateVaultRecoveryKey(uid: string, password: string): Promise<string> {
  const envelope = await getVaultKeyEnvelope(uid);
  if (!envelope) throw new Error('No encrypted vault key was found for this account.');
  const passwordWrappingKey = await derivePasswordWrappingKey(password, fromBase64(envelope.passwordSalt), envelope.iterations);
  const vaultKey = await unwrapVaultKey(envelope.passwordWrappedKey, envelope.passwordIv, passwordWrappingKey);
  const recoveryKey = createRecoveryKey();
  const normalized = recoveryKey.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const recoveryWrappingKey = await crypto.subtle.importKey('raw', asArrayBuffer(fromBase64(padded)), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  const recoveryWrap = await wrapVaultKey(vaultKey, recoveryWrappingKey);
  await setDoc(envelopeRef(uid), {
    recoveryIv: recoveryWrap.iv,
    recoveryWrappedKey: recoveryWrap.wrappedKey,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  activeVaultKey = vaultKey;
  return recoveryKey;
}

export async function rewrapVaultKeyWithRecovery(
  uid: string,
  recoveryKey: string,
  newPassword: string,
  persist = true
): Promise<{ envelope: VaultKeyEnvelope; recoveryKey: string }> {
  if (!newPassword || newPassword.length < 8) throw new Error('Choose a new vault password with at least 8 characters.');
  const ref = envelopeRef(uid);
  const envelope = await getVaultKeyEnvelope(uid);
  if (!envelope) throw new Error('No encrypted vault key was found for this account.');
  const normalizedKey = recoveryKey.trim().replace(/-/g, '+').replace(/_/g, '/');
  const paddedKey = normalizedKey.padEnd(Math.ceil(normalizedKey.length / 4) * 4, '=');
  const wrappingKey = await crypto.subtle.importKey('raw', asArrayBuffer(fromBase64(paddedKey)), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  const vaultKey = await unwrapVaultKey(envelope.recoveryWrappedKey, envelope.recoveryIv, wrappingKey);
  const passwordSalt = crypto.getRandomValues(new Uint8Array(16));
  const newPasswordWrappingKey = await derivePasswordWrappingKey(newPassword, passwordSalt, KDF_ITERATIONS);
  const passwordWrap = await wrapVaultKey(vaultKey, newPasswordWrappingKey);
  const nextRecoveryKey = createRecoveryKey();
  const normalizedNextRecoveryKey = nextRecoveryKey.replace(/-/g, '+').replace(/_/g, '/');
  const paddedNextRecoveryKey = normalizedNextRecoveryKey.padEnd(Math.ceil(normalizedNextRecoveryKey.length / 4) * 4, '=');
  const nextRecoveryWrappingKey = await crypto.subtle.importKey('raw', asArrayBuffer(fromBase64(paddedNextRecoveryKey)), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  const recoveryWrap = await wrapVaultKey(vaultKey, nextRecoveryWrappingKey);
  const updated: VaultKeyEnvelope = {
    ...envelope,
    passwordSalt: toBase64(passwordSalt),
    passwordIv: passwordWrap.iv,
    passwordWrappedKey: passwordWrap.wrappedKey,
    recoveryIv: recoveryWrap.iv,
    recoveryWrappedKey: recoveryWrap.wrappedKey,
  };
  if (persist) await setDoc(ref, { ...updated, updatedAt: serverTimestamp() }, { merge: true });
  activeVaultKey = vaultKey;
  return { envelope: updated, recoveryKey: nextRecoveryKey };
}

export function getActiveVaultKey(): CryptoKey {
  if (!activeVaultKey) throw new Error('Unlock your vault before accessing its encrypted data.');
  return activeVaultKey;
}

export function clearActiveVaultKey(): void {
  activeVaultKey = null;
}

export async function encryptVaultValue(value: unknown): Promise<{ version: 1; iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: asArrayBuffer(iv) },
    getActiveVaultKey(),
    encoder.encode(JSON.stringify(value))
  );
  return { version: 1, iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
}

export async function decryptVaultValue<T>(encrypted: { iv: string; ciphertext: string }): Promise<T> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: asArrayBuffer(fromBase64(encrypted.iv)) },
    getActiveVaultKey(),
    asArrayBuffer(fromBase64(encrypted.ciphertext))
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

export async function encryptVaultBlob(file: Blob): Promise<{ blob: Blob; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asArrayBuffer(iv) }, getActiveVaultKey(), await file.arrayBuffer());
  return { blob: new Blob([encrypted], { type: 'application/octet-stream' }), iv: toBase64(iv) };
}

export async function decryptVaultBlob(ciphertext: ArrayBuffer, iv: string, mimeType: string): Promise<Blob> {
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: asArrayBuffer(fromBase64(iv)) }, getActiveVaultKey(), ciphertext);
  return new Blob([plaintext], { type: mimeType || 'application/octet-stream' });
}
