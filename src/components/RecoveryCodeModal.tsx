import React, { useState } from 'react';
import { KeyRound, Mail, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface RecoveryCodeModalProps {
  onClose: () => void;
}

export const RecoveryCodeModal: React.FC<RecoveryCodeModalProps> = ({ onClose }) => {
  const {
    user,
    requestRecoveryCodeVerification,
    verifyRecoveryCodeVerification,
    issueRecoveryCodeWithPassword,
  } = useAuth();
  const hasGoogleProvider = Boolean(user?.providerData.some((provider) => provider.providerId === 'google.com'));
  const hasPasswordProvider = Boolean(user?.providerData.some((provider) => provider.providerId === 'password'));
  const [method, setMethod] = useState<'google' | 'password' | null>(
    hasGoogleProvider && hasPasswordProvider ? null : hasGoogleProvider ? 'google' : 'password'
  );
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const sendVerificationCode = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await requestRecoveryCodeVerification();
      setCodeSent(true);
      setMessage('A 6-digit verification code was sent to your Google account email. It expires in 10 minutes.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the verification email.');
    } finally {
      setBusy(false);
    }
  };

  const confirmGoogleCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await verifyRecoveryCodeVerification(verificationCode);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not verify the email code.');
    } finally {
      setBusy(false);
    }
  };

  const confirmPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await issueRecoveryCodeWithPassword(password);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not verify your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <section className="w-full max-w-md rounded-2xl border border-emerald-500/35 bg-[#07130f] p-6 text-white shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-300"><KeyRound className="h-5 w-5" /></div>
            <div>
              <h2 className="text-lg font-bold">Get a new recovery code</h2>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close recovery code dialog" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-slate-300">
          Verify it is you to create a replacement code. Your current unused recovery code will stop working.
        </p>

        {hasGoogleProvider && hasPasswordProvider && (
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setMethod('google'); setError(''); setMessage(''); }} className={`min-h-10 rounded-lg border px-3 text-xs font-semibold ${method === 'google' ? 'border-emerald-400 bg-emerald-950 text-emerald-200' : 'border-slate-700 text-slate-300'}`}>
              Google email code
            </button>
            <button type="button" onClick={() => { setMethod('password'); setError(''); setMessage(''); }} className={`min-h-10 rounded-lg border px-3 text-xs font-semibold ${method === 'password' ? 'border-emerald-400 bg-emerald-950 text-emerald-200' : 'border-slate-700 text-slate-300'}`}>
              Account password
            </button>
          </div>
        )}

        {method === 'google' && (
          <div className="space-y-3">
            {!codeSent ? (
              <button type="button" disabled={busy} onClick={sendVerificationCode} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold hover:bg-emerald-500 disabled:opacity-60">
                <Mail className="h-4 w-4" />{busy ? 'Sending code…' : 'Send verification code'}
              </button>
            ) : (
              <form onSubmit={confirmGoogleCode} className="space-y-3">
                <label className="block text-xs text-slate-300">
                  6-digit verification code
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-center text-lg font-mono tracking-[0.35em] text-white outline-none focus:border-emerald-400"
                  />
                </label>
                <button disabled={busy} className="min-h-11 w-full rounded-xl bg-emerald-600 px-4 text-sm font-bold hover:bg-emerald-500 disabled:opacity-60">
                  {busy ? 'Verifying…' : 'Verify and get new recovery code'}
                </button>
                <button type="button" disabled={busy} onClick={sendVerificationCode} className="min-h-9 w-full text-xs text-emerald-300 hover:text-emerald-200 disabled:opacity-60">
                  Send another code
                </button>
              </form>
            )}
          </div>
        )}

        {method === 'password' && (
          <form onSubmit={confirmPassword} className="space-y-3">
            <label className="block text-xs text-slate-300">
              Account password
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-400"
              />
            </label>
            <button disabled={busy} className="min-h-11 w-full rounded-xl bg-emerald-600 px-4 text-sm font-bold hover:bg-emerald-500 disabled:opacity-60">
              {busy ? 'Verifying…' : 'Verify and get new recovery code'}
            </button>
          </form>
        )}

        {message && <p role="status" className="mt-3 text-xs text-emerald-300">{message}</p>}
        {error && <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}
      </section>
    </div>
  );
};
