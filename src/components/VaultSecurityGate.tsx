import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, Copy, LockKeyhole } from 'lucide-react';
import { User } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { getVaultKeyEnvelope } from '../services/vaultCrypto';

export const VaultSecurityGate: React.FC<{ user: User }> = ({ user }) => {
  const {
    unlockVault, vaultRecoveryKeyNotice, clearVaultRecoveryKeyNotice,
    vaultRecoveryTicket, requestVaultRecoveryEmail, completeVaultPasswordRecovery, authError,
    rotateVaultRecoveryKey,
  } = useAuth();
  const [hasEnvelope, setHasEnvelope] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [useRecoveryKey, setUseRecoveryKey] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    getVaultKeyEnvelope(user.uid)
      .then((envelope) => { if (active) setHasEnvelope(Boolean(envelope)); })
      .catch(() => { if (active) setError('Could not check your vault encryption settings. Please retry.'); });
    return () => { active = false; };
  }, [user.uid, vaultRecoveryKeyNotice]);

  useEffect(() => {
    if (authError) setError(authError);
  }, [authError]);

  const isRecovery = Boolean(vaultRecoveryTicket) || useRecoveryKey;
  const isSetup = hasEnvelope === false && !isRecovery;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if ((isSetup || isRecovery) && password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      if (isRecovery) await completeVaultPasswordRecovery(recoveryKey, password);
      else await unlockVault(password);
      setPassword('');
      setConfirmPassword('');
    } catch (cause) {
      setError(isRecovery
        ? (cause instanceof Error ? cause.message : 'Could not recover the vault key. Check the recovery key and try again.')
        : isSetup
        ? (cause instanceof Error ? cause.message : 'Could not set up vault encryption.')
        : 'That password could not unlock this vault. Use your saved recovery key if you reset the password.');
    } finally {
      setBusy(false);
    }
  };

  const sendRecoveryEmail = async () => {
    setError('');
    setRecoveryMessage('');
    try {
      setRecoveryMessage(await requestVaultRecoveryEmail());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send recovery email.');
    }
  };

  const regenerateRecoveryKey = async () => {
    setError('');
    setBusy(true);
    try {
      await rotateVaultRecoveryKey(password);
      setPassword('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not rotate the recovery key.');
    } finally {
      setBusy(false);
    }
  };

  const copyRecoveryKey = async () => {
    if (!vaultRecoveryKeyNotice) return;
    await navigator.clipboard.writeText(vaultRecoveryKeyNotice);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#050a10] p-4 text-white">
      <section className="w-full max-w-lg rounded-2xl border border-emerald-500/30 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-300"><ShieldCheck className="h-6 w-6" /></div>
          <div>
            <h1 className="text-lg font-bold">{vaultRecoveryKeyNotice ? 'Save your recovery key' : isRecovery ? 'Recover vault password' : isSetup ? 'Set up vault encryption' : 'Unlock your encrypted vault'}</h1>
            <p className="text-xs text-slate-400">Signed in as {user.email || 'your account'}</p>
          </div>
        </div>

        {vaultRecoveryKeyNotice ? (
          <>
            <p className="text-sm leading-relaxed text-slate-300">This recovery key is shown only once. Store it somewhere private and separate from your device. Vault X cannot restore encrypted data without it if you lose your password.</p>
            <div className="my-5 break-all rounded-xl border border-amber-400/40 bg-black/40 p-4 text-center font-mono text-sm tracking-wider text-amber-200">{vaultRecoveryKeyNotice}</div>
            <button onClick={copyRecoveryKey} className="mb-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 text-sm hover:bg-slate-700"><Copy className="h-4 w-4" />{copied ? 'Copied' : 'Copy recovery key'}</button>
            <button onClick={clearVaultRecoveryKeyNotice} className="min-h-11 w-full rounded-xl bg-emerald-600 px-4 text-sm font-bold hover:bg-emerald-500">I saved this recovery key</button>
          </>
        ) : hasEnvelope === null ? (
          <div className="py-6 text-center">
            <p role={error ? 'alert' : undefined} className={`text-sm ${error ? 'text-rose-300' : 'text-slate-400'}`}>
              {error || 'Checking encryption setup…'}
            </p>
            {error && <button onClick={() => window.location.reload()} className="mt-4 min-h-10 rounded-xl border border-slate-700 px-4 text-xs text-slate-200 hover:border-emerald-500">Retry after checking your connection and Firestore rules</button>}
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm leading-relaxed text-slate-300">
              {isRecovery
                ? 'Your Gmail confirmation is verified. Enter the separate high-entropy recovery key you saved when encryption was set up, then choose a new vault password.'
                : isSetup
                ? 'Choose a strong vault password. Email/password accounts can use their sign-in password; Google accounts need a separate vault password.'
                : 'Enter your sign-in password, or the separate Vault password you created for Google sign-in. This password stays on this device.'}
            </p>
            <form onSubmit={submit} className="space-y-3">
              {isRecovery && <label className="block text-xs text-slate-300">One-time recovery key
                <input type="text" required autoComplete="off" value={recoveryKey} onChange={(event) => setRecoveryKey(event.target.value.trim())} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm font-mono text-white outline-none focus:border-emerald-400" />
              </label>}
              <label className="block text-xs text-slate-300">{isSetup ? 'Create vault password' : 'Vault password'}
                <input type="password" required minLength={8} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-400" />
              </label>
              {(isSetup || isRecovery) && <label className="block text-xs text-slate-300">Confirm vault password
                <input type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-400" />
              </label>}
              {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
              <button disabled={busy} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold hover:bg-emerald-500 disabled:opacity-60"><LockKeyhole className="h-4 w-4" />{busy ? 'Securing vault…' : isRecovery ? 'Recover and unlock vault' : isSetup ? 'Create encrypted vault' : 'Unlock vault'}</button>
            </form>
            {!isSetup && !isRecovery && <button type="button" disabled={busy || !password} onClick={regenerateRecoveryKey} className="mt-2 min-h-10 w-full rounded-xl border border-slate-700 px-3 text-xs text-slate-300 hover:border-emerald-500 disabled:opacity-50">Regenerate recovery key (invalidates the old one)</button>}
            {recoveryMessage && <p role="status" className="mt-3 text-xs text-emerald-300">{recoveryMessage}</p>}
            {!isSetup && !isRecovery && <div className="mt-4 border-t border-slate-800 pt-3">
              <p className="mb-2 flex items-center gap-2 text-[11px] text-slate-500"><KeyRound className="h-3.5 w-3.5" />For Google accounts: confirm the recovery link sent to Gmail, then use your saved recovery key to set a new Vault password.</p>
              {user.providerData.some((provider) => provider.providerId === 'password') && <button type="button" onClick={() => { setUseRecoveryKey(true); setError(authError || ''); }} className="mb-2 min-h-10 w-full rounded-xl border border-slate-700 px-3 text-xs font-semibold text-slate-200 hover:border-emerald-500">I have my recovery key</button>}
              {user.providerData.some((provider) => provider.providerId === 'google.com') && <button type="button" onClick={sendRecoveryEmail} className="min-h-10 w-full rounded-xl border border-slate-700 px-3 text-xs font-semibold text-slate-200 hover:border-emerald-500">Email me a recovery confirmation link</button>}
            </div>}
          </>
        )}
      </section>
    </div>
  );
};
