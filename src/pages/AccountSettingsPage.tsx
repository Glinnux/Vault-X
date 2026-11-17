import { ArrowLeft, CreditCard, LockKeyhole, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { LanguageSelector } from '../components/LanguageSelector';
import { useAuth } from '../context/AuthContext';
import { usePrivacySettings } from '../context/PrivacySettingsContext';

export function AccountSettingsPage() {
  const { user, loading } = useAuth();
  const { screenshotProtectionEnabled, setScreenshotProtectionEnabled } = usePrivacySettings();

  if (loading) return <main className="account-loading"><span className="account-spinner" />Loading your account…</main>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <main className="account-page">
      <header className="account-header">
        <div className="site-container account-header-inner">
          <Link to="/vault" className="brand"><span className="brand-mark"><img src={`${import.meta.env.BASE_URL}vault-x-mark.svg`} alt="" /></span><span>Vault-X</span></Link>
          <Link to="/vault" className="admin-back-link"><ArrowLeft size={16} /> Return to Vault</Link>
        </div>
      </header>
      <div className="site-container account-settings-content">
        <span className="eyebrow">Account</span>
        <h1>Profile &amp; Settings</h1>
        <section id="profile" className="account-settings-panel">
          <div className="account-settings-icon"><UserRound size={20} /></div>
          <div><h2>Profile</h2><p>{user.displayName || 'Vault-X member'}</p><small>{user.email}</small></div>
        </section>
        <section id="settings" className="account-settings-panel">
          <div className="account-settings-icon"><Settings size={20} /></div>
          <div className="account-settings-details"><h2>Settings</h2><p>Choose your preferred display language.</p><LanguageSelector /></div>
        </section>
        <section id="subscription" className="account-settings-panel">
          <div className="account-settings-icon"><CreditCard size={20} /></div>
          <div><h2>Subscription</h2><p>Review your current plan, storage usage, and available upgrades.</p><Link to="/subscription">Manage subscription</Link></div>
        </section>
        <section id="security-settings" className="account-settings-panel screenshot-settings-panel">
          <div className="account-settings-icon"><LockKeyhole size={20} /></div>
          <div className="account-settings-details">
            <h2>Security Settings</h2>
            <p>Choose the extra privacy behavior used while your vault is open.</p>
            <label className="screenshot-protection-toggle">
              <span>
                <strong>Screenshot Protection</strong>
                <small>{screenshotProtectionEnabled ? 'Privacy mode is on' : 'Privacy mode is off'}</small>
              </span>
              <input
                type="checkbox"
                checked={screenshotProtectionEnabled}
                onChange={(event) => setScreenshotProtectionEnabled(event.target.checked)}
                aria-describedby="screenshot-protection-explanation"
              />
              <span className="screenshot-protection-switch" aria-hidden="true" />
            </label>
            <p id="screenshot-protection-explanation" className="screenshot-protection-explanation">
              When on, Vault-X adds a subtle watermark with part of your account ID and hides revealed values when this tab loses focus. Browser screenshots and screen recordings cannot be reliably blocked.
            </p>
            <Link to="/security">Read about Vault-X security</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
