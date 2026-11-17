import { useEffect, useState } from 'react';
import { collection, getCountFromServer } from 'firebase/firestore';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { PaymentPage } from '../components/PaymentPage';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { FREE_CREDENTIAL_SLOTS, subscribeToUserSubscription } from '../services/subscriptionService';
import { UserSubscription } from '../types/vault';

export function SubscriptionPage() {
  const { user, loading, isBanned } = useAuth();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [credentialCount, setCredentialCount] = useState<number | null>(null);
  const [usageError, setUsageError] = useState('');
  const [usageRetry, setUsageRetry] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      return;
    }
    return subscribeToUserSubscription(user.uid, user.email, setSubscription);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCredentialCount(null);
      setUsageError('');
      return;
    }
    let active = true;
    setCredentialCount(null);
    setUsageError('');
    getCountFromServer(collection(db, 'users', user.uid, 'vault'))
      .then((snapshot) => {
        if (active) setCredentialCount(snapshot.data().count);
      })
      .catch((error: unknown) => {
        console.error('Could not load vault item usage for the subscription page:', error);
        if (active) setUsageError('Your current slot usage could not be loaded. Please try again.');
      });
    return () => { active = false; };
  }, [user, usageRetry]);

  if (loading) return <main className="account-loading"><span className="account-spinner" />Loading your account…</main>;
  if (!user) return <Navigate to="/login" replace />;
  if (isBanned) {
    return <main className="account-state"><div className="account-state-card"><h1>Account access is restricted</h1><p>Contact Vault-X support if you believe this is a mistake.</p><Link className="button button-primary" to="/vault">Return to Vault</Link></div></main>;
  }
  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3200);
  };

  return (
    <main className="account-page subscription-page">
      <header className="account-header">
        <div className="site-container account-header-inner">
          <Link to="/vault" className="brand"><span className="brand-mark"><img src={`${import.meta.env.BASE_URL}vault-x-mark.svg`} alt="" /></span><span>Vault-X</span></Link>
          <div className="subscription-header-actions">
            <Link to="/vault" className="admin-back-link"><ArrowLeft size={16} /> Return to Vault</Link>
          </div>
        </div>
      </header>
      <div className="site-container subscription-content">
        <div className="subscription-intro">
          <span className="eyebrow">Plan &amp; billing</span>
          <h1>Subscription</h1>
          <p>Review your current storage plan or choose an upgrade.</p>
        </div>
        {usageError ? (
          <div className="subscription-usage-error" role="alert">
            <p>{usageError}</p>
            <button type="button" className="button button-outline" onClick={() => setUsageRetry((value) => value + 1)}>Try again</button>
          </div>
        ) : credentialCount === null ? (
          <div className="account-empty subscription-usage-loading"><span className="account-spinner" /><p>Loading your slot usage…</p></div>
        ) : (
          <PaymentPage
            userId={user.uid}
            userEmail={user.email || ''}
            subscription={subscription || {
              plan: 'free',
              extraSlots: 0,
              maxCredentialSlots: FREE_CREDENTIAL_SLOTS,
              paymentStatus: 'none',
            }}
            credentialCount={credentialCount}
            isUnlimited={Boolean(subscription?.isUnlimited)}
            onBackToVault={() => navigate('/vault')}
            onToast={showToast}
          />
        )}
      </div>
      {toast && <div className={`account-toast admin-toast-${toast.type}`} role="status">{toast.message}</div>}
    </main>
  );
}
