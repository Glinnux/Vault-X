import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, CreditCard, KeyRound, LockKeyhole, LogOut, Plus, Search, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { AddVaultItemModal } from '../components/AddVaultItemModal';
import { EditVaultItemModal } from '../components/EditVaultItemModal';
import { VaultCard } from '../components/VaultCard';
import { VaultOpeningAnimation } from '../components/VaultOpeningAnimation';
import { VaultSecurityGate } from '../components/VaultSecurityGate';
import { useAuth } from '../context/AuthContext';
import { usePrivacySettings } from '../context/PrivacySettingsContext';
import { isSuperAdminUser } from '../services/adminService';
import { canEditSlotItem, FREE_CREDENTIAL_SLOTS, getPlanOption, subscribeToUserSubscription } from '../services/subscriptionService';
import { deleteVaultItem, createVaultItem, subscribeToVault, updateVaultItem } from '../services/vaultService';
import { db } from '../lib/firebase';
import { UserSubscription, VaultItem } from '../types/vault';
import { doc, getDoc } from 'firebase/firestore';

export function VaultAccountPage() {
  const {
    user, loading: authLoading, isBanned, signOut, vaultUnlocked,
    vaultUnlockAnimationPending, clearVaultUnlockAnimationPending,
  } = useAuth();
  const navigate = useNavigate();
  const { screenshotProtectionEnabled } = usePrivacySettings();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [vaultDataReady, setVaultDataReady] = useState(false);
  const [showVaultOpening, setShowVaultOpening] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
  const [toast, setToast] = useState('');
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);
  const vaultPageRef = useRef<HTMLElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login', { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) {
      setCanAccessAdmin(false);
      return;
    }
    if (isSuperAdminUser(user.email)) {
      setCanAccessAdmin(true);
      return;
    }

    let active = true;
    getDoc(doc(db, 'admins', user.uid))
      .then((adminRecord) => {
        if (active) setCanAccessAdmin(adminRecord.exists());
      })
      .catch((error: unknown) => {
        console.error('Could not verify administrator navigation access:', error);
        if (active) setCanAccessAdmin(false);
      });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!user || !vaultUnlocked || isBanned) {
      setItems([]);
      setLoadingItems(false);
      setVaultDataReady(false);
      return;
    }

    setLoadingItems(true);
    setVaultDataReady(false);
    setLoadError('');
    return subscribeToVault(
      user.uid,
      (nextItems) => {
        setItems(nextItems);
        setLoadingItems(false);
        setVaultDataReady(true);
      },
      (error) => {
        console.error('Could not load the signed-in user vault:', error);
        setLoadError('Your vault could not be loaded. Check your connection and try again.');
        setLoadingItems(false);
        setVaultDataReady(true);
      }
    );
  }, [user, vaultUnlocked, isBanned]);

  useEffect(() => {
    if (!vaultUnlockAnimationPending) return;
    setShowVaultOpening(true);
    clearVaultUnlockAnimationPending();
  }, [vaultUnlockAnimationPending, clearVaultUnlockAnimationPending]);

  const completeVaultOpening = useCallback(() => {
    setShowVaultOpening(false);
    window.requestAnimationFrame(() => vaultPageRef.current?.focus());
  }, []);
  const isVaultOpening = showVaultOpening || vaultUnlockAnimationPending;

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      return;
    }
    return subscribeToUserSubscription(user.uid, user.email, setSubscription);
  }, [user]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [item.title, item.service, item.username, item.notes]
        .some((value) => value?.toLocaleLowerCase().includes(query))
    );
  }, [items, search]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  };

  const handleSignOut = async () => {
    setAccountMenuOpen(false);
    await signOut();
    navigate('/', { replace: true });
  };

  if (authLoading || !user) {
    return <main className="account-loading"><span className="account-spinner" />Loading your account…</main>;
  }

  if (isBanned) {
    return (
      <main className="account-state">
        <div className="account-state-card">
          <ShieldCheck size={30} />
          <h1>Account access is restricted</h1>
          <p>Contact Vault-X support if you believe this is a mistake.</p>
          <button type="button" className="button button-outline" onClick={handleSignOut}>Sign Out</button>
        </div>
      </main>
    );
  }

  if (!vaultUnlocked) {
    return <VaultSecurityGate user={user} />;
  }

  return (
    <>
    <main
      ref={vaultPageRef}
      className={`account-page page-transition ${isVaultOpening && !vaultDataReady ? 'vault-dashboard-waiting' : ''}`}
      tabIndex={-1}
      aria-hidden={isVaultOpening || undefined}
      inert={isVaultOpening}
    >
      {screenshotProtectionEnabled && user && (
        <div className="vault-privacy-watermark" aria-hidden="true">
          {Array.from({ length: 20 }, (_, index) => (
            <span key={index}>VAULT-X · {user.uid.slice(0, 4)}…{user.uid.slice(-4)}</span>
          ))}
        </div>
      )}
      <header className="account-header">
        <div className="site-container account-header-inner">
          <Link to="/" className="brand"><span className="brand-mark"><img src={`${import.meta.env.BASE_URL}vault-x-mark.svg`} alt="" /></span><span>Vault-X</span></Link>
          <div className="account-user">
            <div className="account-menu-wrap" ref={accountMenuRef}>
              <button
                type="button"
                className="account-menu-trigger"
                aria-label={`Account menu for ${user.email || 'your account'}`}
                aria-expanded={accountMenuOpen}
                aria-haspopup="true"
                onClick={() => setAccountMenuOpen((open) => !open)}
              >
                <span className="account-user-email">{user.email}</span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              {accountMenuOpen && (
                <div className="account-menu">
                  <div className="account-menu-identity"><strong>{user.displayName || 'Vault-X member'}</strong><span>{user.email}</span></div>
                  <Link to="/account#profile" onClick={() => setAccountMenuOpen(false)}><UserRound size={16} />Profile</Link>
                  <Link to="/account#settings" onClick={() => setAccountMenuOpen(false)}><Settings size={16} />Settings</Link>
                  <Link to="/subscription" onClick={() => setAccountMenuOpen(false)}><CreditCard size={16} />Subscription</Link>
                  <Link to="/account#security-settings" onClick={() => setAccountMenuOpen(false)}><ShieldCheck size={16} />Security</Link>
                  {canAccessAdmin && (
                    <Link
                      to={isSuperAdminUser(user.email) ? '/superadmin' : '/admin'}
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <LockKeyhole size={16} />
                      {isSuperAdminUser(user.email) ? 'Super Admin Dashboard' : 'Admin Dashboard'}
                    </Link>
                  )}
                  <button type="button" onClick={handleSignOut}><LogOut size={16} />Sign Out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="site-container account-content">
        <div className="account-welcome">
          <div>
            <span className="eyebrow">Your private space</span>
            <h1>Your Vault</h1>
            <p>Your credentials, organized and ready when you need them.</p>
          </div>
          <div className="account-protection"><LockKeyhole size={17} /><span>Vault unlocked on this device</span></div>
        </div>

        <section className="vault-plan-summary" aria-label="Subscription and storage usage">
          <div className="vault-plan-summary-icon"><CreditCard size={18} /></div>
          <div className="vault-plan-summary-details">
            <strong>
              {subscription === null
                ? 'Loading subscription…'
                : subscription.isUnlimited
                ? 'Unlimited plan'
                : subscription.planDuration
                ? `${getPlanOption(subscription.planDuration).name} plan`
                : 'Free plan'}
            </strong>
            <span>
              {items.length} of {subscription?.isUnlimited ? 'unlimited' : subscription?.maxCredentialSlots || FREE_CREDENTIAL_SLOTS} vault slots used
              {subscription?.expiresAt ? ` · Renews/expires ${new Date(subscription.expiresAt).toLocaleDateString()}` : ''}
            </span>
          </div>
          <Link to="/subscription" className="vault-plan-manage">Manage subscription</Link>
        </section>

        <section className="account-toolbar" aria-label="Vault controls">
          <label className="account-search">
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your credentials" aria-label="Search your credentials" />
          </label>
          <button type="button" className="button button-primary" onClick={() => setAdding(true)}><Plus size={17} /> Add Credential</button>
        </section>

        {loadError && <p className="account-error" role="alert">{loadError}</p>}
        {loadingItems ? (
          <div className="account-empty"><span className="account-spinner" /><p>Loading your encrypted vault…</p></div>
        ) : visibleItems.length === 0 ? (
          <div className="account-empty">
            <span className="account-empty-icon"><KeyRound size={25} /></span>
            <h2>{search ? 'No matching credentials' : 'Your vault is ready'}</h2>
            <p>{search ? 'Try another search term.' : 'Add your first credential to start organizing your digital life.'}</p>
            {!search && <button type="button" className="button button-primary" onClick={() => setAdding(true)}><Plus size={17} /> Add your first credential</button>}
          </div>
        ) : (
          <div className="account-items-grid">
            {visibleItems.map((item, index) => (
              <VaultCard
                key={item.id}
                item={item}
                slotIndex={index}
                canEdit={canEditSlotItem(index, subscription, Boolean(subscription?.isUnlimited))}
                onLockedEditClick={() => showToast('This vault slot is view-only. Review your subscription to restore editing.')}
                onEdit={setEditingItem}
                onDelete={async (itemId) => {
                  if (!user) return;
                  await deleteVaultItem(user.uid, itemId);
                  showToast('Credential deleted');
                }}
                onToggleFavorite={async (itemId, current) => {
                  if (!user) return;
                  await updateVaultItem(user.uid, itemId, { favorite: !current });
                }}
                onCopySuccess={() => showToast('Copied to clipboard')}
              />
            ))}
          </div>
        )}
      </div>

      <AddVaultItemModal
        isOpen={adding}
        onClose={() => setAdding(false)}
        credentialCount={items.length}
        maxSlots={subscription?.maxCredentialSlots || FREE_CREDENTIAL_SLOTS}
        isUnlimited={Boolean(subscription?.isUnlimited)}
        onAdd={async (payload) => {
          if (!user) return;
          await createVaultItem(user.uid, payload);
          setAdding(false);
          showToast('Credential added');
        }}
      />
      <EditVaultItemModal
        item={editingItem}
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        onSave={async (itemId, updates) => {
          if (!user) return;
          await updateVaultItem(user.uid, itemId, updates);
          setEditingItem(null);
          showToast('Credential updated');
        }}
      />
      {toast && <div className="account-toast" role="status">{toast}</div>}
    </main>
    {isVaultOpening && (
      <VaultOpeningAnimation readyToEnter={vaultDataReady} onComplete={completeVaultOpening} />
    )}
    </>
  );
}
