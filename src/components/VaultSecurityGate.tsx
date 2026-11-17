import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import { User } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { getVaultKeyEnvelope } from '../services/vaultCrypto';

export const VaultSecurityGate: React.FC<{ user: User }> = ({ user }) => {
  const {
    unlockVault, vaultRecoveryKeyNotice, clearVaultRecoveryKeyNotice,
    completeVaultPasswordRecovery, authError,
    rotateVaultRecoveryKey,
  } = useAuth();
  const [hasEnvelope, setHasEnvelope] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [useRecoveryKey, setUseRecoveryKey] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  const isRecovery = useRecoveryKey;
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
    <main className="vault-unlock-page fixed inset-0 z-[100] overflow-y-auto text-white">
      <div className="vault-unlock-atmosphere" aria-hidden="true">
        <span className="vault-unlock-grid" />
        <span className="vault-unlock-glow vault-unlock-glow--one" />
        <span className="vault-unlock-glow vault-unlock-glow--two" />
      </div>
      <div className="vault-unlock-shell">
        <header className="vault-unlock-brandbar">
          <a className="vault-unlock-brand" href="/" aria-label="Vault-X home">
            <span className="vault-unlock-brand-mark"><img src={`${import.meta.env.BASE_URL}vault-x-mark.svg`} alt="" /></span>
            <span>Vault<span>-X</span></span>
          </a>
          <div className="vault-unlock-status">
            <span className="vault-unlock-status-dot" />
            Encrypted Vault
          </div>
        </header>

        <div className="vault-unlock-content">
          <div className="vault-unlock-intro">
            <div className="vault-unlock-hero-icon" aria-hidden="true">
              <ShieldCheck className="vault-unlock-shield" />
              <LockKeyhole className="vault-unlock-lock" />
            </div>
            <p className="vault-unlock-eyebrow"><span /> PRIVATE SPACE · DEVICE AUTHENTICATION</p>
            <h1>Welcome Back to Your Vault</h1>
            <p className="vault-unlock-lead">Your encrypted data is waiting. Authenticate to unlock your private space.</p>
          </div>

          <section className="vault-unlock-card" aria-labelledby="vault-unlock-card-title">
            {vaultRecoveryKeyNotice ? (
              <>
                <div className="vault-unlock-card-heading">
                  <span className="vault-unlock-card-icon"><KeyRound size={20} /></span>
                  <div>
                    <p className="vault-unlock-card-kicker">RECOVERY KEY</p>
                    <h2 id="vault-unlock-card-title">Save your recovery key</h2>
                  </div>
                </div>
                <p className="vault-unlock-description">This key is shown only once. Save it somewhere private and separate from this device. Vault-X cannot restore encrypted data without it if you lose your password.</p>
                <div className="vault-unlock-recovery-value">{vaultRecoveryKeyNotice}</div>
                <button type="button" onClick={copyRecoveryKey} className="vault-unlock-button vault-unlock-button--secondary">
                  {copied ? <Check size={17} /> : <Copy size={17} />}
                  {copied ? 'Recovery key copied' : 'Copy recovery key'}
                </button>
                <button type="button" onClick={clearVaultRecoveryKeyNotice} className="vault-unlock-button vault-unlock-button--primary">I saved this recovery key</button>
              </>
            ) : hasEnvelope === null ? (
              <div className="vault-unlock-checking">
                <span className={error ? 'vault-unlock-checking-icon is-error' : 'vault-unlock-checking-icon'}>
                  {error ? <ShieldCheck size={22} /> : <LoaderCircle size={22} className="vault-unlock-spinner" />}
                </span>
                <h2 id="vault-unlock-card-title">{error ? 'Could not check vault setup' : 'Checking your encrypted vault'}</h2>
                <p role={error ? 'alert' : undefined}>{error || 'Confirming this account’s encryption settings…'}</p>
                {error && <button type="button" onClick={() => window.location.reload()} className="vault-unlock-button vault-unlock-button--secondary">Retry after checking your connection</button>}
              </div>
            ) : (
              <>
                <div className="vault-unlock-card-heading">
                  <span className="vault-unlock-card-icon"><LockKeyhole size={20} /></span>
                  <div>
                    <p className="vault-unlock-card-kicker">{isRecovery ? 'ACCOUNT RECOVERY' : isSetup ? 'ENCRYPTION SETUP' : 'SECURE SIGN-IN'}</p>
                    <h2 id="vault-unlock-card-title">{isRecovery ? 'Recover Your Encrypted Vault' : isSetup ? 'Set Up Your Encrypted Vault' : 'Unlock Your Encrypted Vault'}</h2>
                  </div>
                </div>

                <div className="vault-unlock-account">
                  <span className="vault-unlock-account-icon"><ShieldCheck size={17} /></span>
                  <span><small>AUTHENTICATED ACCOUNT</small><strong>{user.email || 'Your account'}</strong></span>
                </div>

                <p className="vault-unlock-description">
                  {isRecovery
                    ? 'Enter the recovery key you saved when encryption was set up, then choose a new vault password.'
                    : isSetup
                    ? 'Choose a strong vault password. Email/password accounts may use their sign-in password; Google accounts need a separate vault password.'
                    : 'Enter your sign-in password, or the separate vault password you created for Google sign-in. The vault password stays on this device.'}
                </p>

                <form onSubmit={submit} className="vault-unlock-form">
                  {isRecovery && (
                    <label className="vault-unlock-field" htmlFor="vault-recovery-key">
                      <span>One-time recovery key</span>
                      <input id="vault-recovery-key" type="text" required autoComplete="off" value={recoveryKey} onChange={(event) => setRecoveryKey(event.target.value.trim())} />
                    </label>
                  )}
                  <div className="vault-unlock-field">
                    <label htmlFor="vault-password">{isSetup ? 'Create vault password' : 'Vault password'}</label>
                    <span className="vault-unlock-password-wrap">
                      <input id="vault-password" type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete={isSetup || isRecovery ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} />
                      <button type="button" className="vault-unlock-toggle-password" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide vault password' : 'Show vault password'} aria-pressed={showPassword}>
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </span>
                  </div>
                  {(isSetup || isRecovery) && (
                    <div className="vault-unlock-field">
                      <label htmlFor="vault-confirm-password">Confirm vault password</label>
                      <span className="vault-unlock-password-wrap">
                        <input id="vault-confirm-password" type={showConfirmPassword ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                        <button type="button" className="vault-unlock-toggle-password" onClick={() => setShowConfirmPassword((shown) => !shown)} aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showConfirmPassword}>
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </span>
                    </div>
                  )}

                  {error && <p role="alert" className="vault-unlock-error"><span aria-hidden="true">!</span>{error}</p>}
                  <button type="submit" disabled={busy} className="vault-unlock-button vault-unlock-button--primary">
                    {busy ? <LoaderCircle size={18} className="vault-unlock-spinner" /> : <LockKeyhole size={18} />}
                    {busy ? 'Securing your vault…' : isRecovery ? 'Recover and unlock vault' : isSetup ? 'Create encrypted vault' : 'Unlock My Vault'}
                  </button>
                </form>

                {!isSetup && !isRecovery && (
                  <div className="vault-unlock-recovery-actions">
                    <div className="vault-unlock-recovery-divider"><span>RECOVERY OPTIONS</span></div>
                    <button type="button" disabled={busy || !password} onClick={regenerateRecoveryKey} className="vault-unlock-button vault-unlock-button--secondary">
                      <KeyRound size={17} />Regenerate Recovery Key
                    </button>
                    <p className="vault-unlock-warning">Regenerating your recovery key invalidates the previously issued key. Enter your vault password first.</p>
                    {user.providerData.some((provider) => provider.providerId === 'password') && (
                      <button type="button" onClick={() => { setUseRecoveryKey(true); setError(authError || ''); }} className="vault-unlock-button vault-unlock-button--secondary">
                        <KeyRound size={17} />I Have My Recovery Key
                      </button>
                    )}
                  </div>
                )}
                {isRecovery && (
                  <button type="button" onClick={() => { setUseRecoveryKey(false); setError(''); }} className="vault-unlock-back">
                    <ArrowLeft size={15} />Back to password unlock
                  </button>
                )}
              </>
            )}
          </section>

          <aside className="vault-unlock-privacy">
            <span className="vault-unlock-privacy-icon"><ShieldCheck size={18} /></span>
            <div>
              <strong>Your privacy matters.</strong>
              <p>Your vault encryption credentials remain private. Only the appropriate authentication process can unlock your encrypted data.</p>
            </div>
          </aside>
          <p className="vault-unlock-footer">VAULT-X <span>·</span> YOUR PRIVATE SPACE</p>
        </div>
      </div>
    </main>
  );
};
