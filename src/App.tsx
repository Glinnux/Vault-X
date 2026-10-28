import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  KeyRound,
  FileText,
  Plus,
  Search,
  X,
  Lock,
  AlertTriangle,
  RefreshCw,
  Users,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { VaultHeader } from './components/VaultHeader';
import { VaultCard } from './components/VaultCard';
import { AddVaultItemModal } from './components/AddVaultItemModal';
import { EditVaultItemModal } from './components/EditVaultItemModal';
import { AuthModal } from './components/AuthModal';
import { AdminUsersPage } from './components/AdminUsersPage';
import { AdminChatPage } from './components/AdminChatPage';
import { AndroidBottomNav } from './components/AndroidBottomNav';
import { AndroidInstallPrompt } from './components/AndroidInstallPrompt';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useDeviceDetection } from './hooks/useDeviceDetection';
import { CyberGridBackground } from './components/CyberGridBackground';
import { FuturisticHudBar } from './components/FuturisticHudBar';
import { VaultChatbot } from './components/VaultChatbot';
import { SlotUpgradeSideBox } from './components/SlotUpgradeSideBox';
import { PaymentPage } from './components/PaymentPage';
import { SupportPage } from './components/SupportPage';
import {
  subscribeToVault,
  createVaultItem,
  updateVaultItem,
  deleteVaultItem,
} from './services/vaultService';
import {
  subscribeToUserSubscription,
  FREE_CREDENTIAL_SLOTS,
  UNLIMITED_CREDENTIAL_SLOTS,
  resetToFreePlan,
  canEditSlotItem,
} from './services/subscriptionService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase';
import { subscribeToAdminsList, isSuperAdminUser, isUserAdmin, ADMIN_EMAIL } from './services/adminService';
import { VaultCategory, VaultItem, VaultViewMode, UserSubscription } from './types/vault';

function VaultApp() {
  const {
    user,
    loading: authLoading,
    isBanned,
    bannedReason,
    authError,
    clearAuthError,
    openAuthModal,
    signOut,
    recoveryNotice,
    clearRecoveryNotice,
  } = useAuth();
  const { t, isAutoMode, currentLangInfo } = useLanguage();
  const { isMobileDevice } = useDeviceDetection();
  const [appointedAdminIds, setAppointedAdminIds] = useState<string[]>([]);
  const [hasDirectAdminRecord, setHasDirectAdminRecord] = useState(false);
  const [hasAdminRole, setHasAdminRole] = useState(false);

  // Vault state
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Navigation & Filters
  const [viewMode, setViewMode] = useState<VaultViewMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modals & PWA
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const { isInstallable, install: installApp } = usePWAInstall();

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  useEffect(() => {
    if (!user) {
      setAppointedAdminIds([]);
      setHasDirectAdminRecord(false);
      setHasAdminRole(false);
      return;
    }

    const unsubscribeAdmins = subscribeToAdminsList((admins) => {
      setAppointedAdminIds(admins.map((admin) => admin.userId));
    });

    // Check the signed-in user's own records as a fallback when the full admin
    // collection listener is delayed or unavailable.
    const unsubscribeAdminRecord = onSnapshot(
      doc(db, 'admins', user.uid),
      (snapshot) => setHasDirectAdminRecord(snapshot.exists()),
      () => setHasDirectAdminRecord(false)
    );
    const unsubscribeUserRecord = onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => setHasAdminRole(snapshot.data()?.role === 'admin'),
      () => setHasAdminRole(false)
    );

    return () => {
      unsubscribeAdmins();
      unsubscribeAdminRecord();
      unsubscribeUserRecord();
    };
  }, [user]);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 3000);
  };

  // Subscription & Slot state (10 slots on free plan, +20 on paid, unlimited for admin)
  const [subscription, setSubscription] = useState<UserSubscription>(() => {
    const isOwner = Boolean(user?.email && isUserAdmin(user.email));
    return isOwner
      ? {
          plan: 'unlimited',
          extraSlots: UNLIMITED_CREDENTIAL_SLOTS,
          maxCredentialSlots: UNLIMITED_CREDENTIAL_SLOTS,
          isUnlimited: true,
          paymentStatus: 'verified',
          paymentRef: 'ADMIN-UNRESTRICTED',
          paymentCurrency: 'USD',
        }
      : {
          plan: 'free',
          extraSlots: 0,
          maxCredentialSlots: FREE_CREDENTIAL_SLOTS,
          paymentStatus: 'none',
        };
  });

  const isAdmin = Boolean(
    isSuperAdminUser(user?.email) ||
    (user?.uid && appointedAdminIds.includes(user.uid)) ||
    hasDirectAdminRecord ||
    hasAdminRole
  );
  const isAccountUnrestricted = Boolean(
    isAdmin ||
    subscription.isUnlimited ||
    subscription.plan === 'unlimited'
  );

  // Real-time Vault subscription for the signed-in user
  useEffect(() => {
    if (authLoading) return;

    if (isBanned) {
      setItems([]);
      setLoadingItems(false);
      return;
    }

    if (!user) {
      setItems([]);
      setLoadingItems(false);
      setSubscription({
        plan: 'free',
        extraSlots: 0,
        maxCredentialSlots: FREE_CREDENTIAL_SLOTS,
        paymentStatus: 'none',
      });
      return;
    }

    if (isUserAdmin(user.email)) {
      setSubscription({
        plan: 'unlimited',
        extraSlots: UNLIMITED_CREDENTIAL_SLOTS,
        maxCredentialSlots: UNLIMITED_CREDENTIAL_SLOTS,
        isUnlimited: true,
        paymentStatus: 'verified',
        paymentRef: 'ADMIN-UNRESTRICTED',
        paymentCurrency: 'USD',
      });
    }

    setLoadingItems(true);
    setErrorMessage(null);

    const unsubscribeVault = subscribeToVault(
      user.uid,
      (vaultItems) => {
        setItems(vaultItems);
        setLoadingItems(false);
      },
      (error: any) => {
        console.error('Vault subscription error:', error);
        setLoadingItems(false);
        setErrorMessage(error?.message || 'Failed to load isolated vault records.');
      }
    );

    const unsubscribeSub = subscribeToUserSubscription(user.uid, user.email, (sub) => {
      setSubscription(sub);
    });

    return () => {
      unsubscribeVault();
      unsubscribeSub();
    };
  }, [user, isBanned, authLoading]);

  // Counts for header tabs
  const counts = useMemo(() => {
    return {
      all: items.length,
      credentials: items.filter((it) => it.type === 'credential').length,
      documents: items.filter((it) => it.type === 'document').length,
      favorites: items.filter((it) => it.favorite).length,
    };
  }, [items]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // View mode filter
      if (viewMode === 'credentials' && item.type !== 'credential') return false;
      if (viewMode === 'documents' && item.type !== 'document') return false;
      if (viewMode === 'favorites' && !item.favorite) return false;

      // Category filter
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesService = item.service?.toLowerCase().includes(query);
        const matchesUsername = item.username?.toLowerCase().includes(query);
        const matchesNotes = item.notes?.toLowerCase().includes(query);
        const matchesDocName = item.imageName?.toLowerCase().includes(query);
        return Boolean(matchesTitle || matchesService || matchesUsername || matchesNotes || matchesDocName);
      }

      return true;
    });
  }, [items, viewMode, categoryFilter, searchQuery]);

  // CRUD actions
  const handleCreateItem = async (payload: any) => {
    if (!user) {
      showToast('Please sign in with Google first', 'error');
      return;
    }

    const usedSlots = items.length;
    if (!isAccountUnrestricted && usedSlots >= subscription.maxCredentialSlots) {
      showToast(
        `Vault item limit reached (${subscription.maxCredentialSlots} slots on the ${subscription.plan === 'paid' ? 'paid' : 'free'} plan). Please upgrade!`,
        'error'
      );
      setViewMode('payment');
      throw new Error(`Vault item slot limit reached (${subscription.maxCredentialSlots} max).`);
    }

    try {
      await createVaultItem(user.uid, payload);
      showToast(
        payload.type === 'credential' ? 'New credential securely saved' : 'Confidential document uploaded',
        'success'
      );
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to save item', 'error');
      throw err;
    }
  };

  const handleUpdateItem = async (itemId: string, payload: any) => {
    if (!user) return;
    try {
      await updateVaultItem(user.uid, itemId, payload);
      showToast('Vault record updated', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to update item', 'error');
      throw err;
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!user) return;
    try {
      await deleteVaultItem(user.uid, itemId);
      showToast('Item deleted from your vault', 'info');
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to delete item', 'error');
    }
  };

  const handleToggleFavorite = async (item: VaultItem) => {
    if (!user) return;
    try {
      await updateVaultItem(user.uid, item.id, {
        favorite: !item.favorite,
      });
      showToast(item.favorite ? 'Removed from favorites' : 'Marked as favorite', 'info');
    } catch (err) {
      console.error(err);
      showToast('Failed to update favorite', 'error');
    }
  };

  if (isBanned) {
    const appealSubject = `Appeal account restriction - UID ${user?.uid || ''}`;
    const appealBody = `Hello Vault X administrator,\n\nI would like to appeal the restriction on my account.\n\nUser UID: ${user?.uid || 'Unknown'}\nEmail: ${user?.email || 'Unknown'}\nReason shown: ${bannedReason || 'Not provided'}\n\nThank you.`;

    return (
      <div className={`app-shell ${isMobileDevice ? 'device-mobile' : 'device-desktop'} min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans`}>
        <VaultHeader
          currentView="all"
          onSelectView={() => {}}
          counts={counts}
          isPaid={false}
          isUnlimited={false}
        isAdmin={false}
        />
        <main className="flex-1 w-full max-w-xl mx-auto px-4 sm:px-6 py-10 sm:py-16 flex items-center">
          <section className="w-full p-5 sm:p-8 rounded-2xl bg-rose-950/40 border border-rose-500/50 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto" />
            <h1 className="text-xl sm:text-2xl font-bold text-white">Account access suspended</h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              This account is restricted by the administrator. Vault items cannot be viewed or changed while the restriction is active.
              {bannedReason ? ` Reason: ${bannedReason}` : ''}
            </p>
            <p className="text-xs text-slate-400">
              To appeal, contact the administrator. Access will return only after the restriction is lifted.
            </p>
            <a
              href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(appealSubject)}&body=${encodeURIComponent(appealBody)}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-semibold text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Appeal to administrator
            </a>
          </section>
        </main>
        <footer className="site-chrome border-t border-emerald-950 py-4 px-4 text-center text-xs text-slate-400">
          Vault X account access notice
        </footer>
      </div>
    );
  }

  return (
    <div className={`app-shell ${isMobileDevice ? 'device-mobile' : 'device-desktop'} min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black relative`}>
      {/* Ambient Futuristic Cyber Grid & Particle Canvas */}
      <CyberGridBackground />

      {/* Header */}
      <VaultHeader
        currentView={viewMode}
        onSelectView={(mode) => setViewMode(mode)}
        counts={counts}
        isPaid={subscription.plan === 'paid'}
        isUnlimited={isAccountUnrestricted}
        isAdmin={isAdmin}
        onInstallApp={installApp}
        isInstallable={isInstallable}
      />

      {/* Main Content (with bottom padding for Android navigation bar) */}
      <main className={`flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 ${isMobileDevice ? 'pb-28' : 'pb-8'} relative z-10`}>
        {/* Android PWA Install Banner */}
        <AndroidInstallPrompt />

        {/* Banner if Auth error */}
        {authError && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs sm:text-sm flex items-center justify-between shadow-lg">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <span>{authError}</span>
            </div>
            <button
              onClick={clearAuthError}
              className="text-xs px-2.5 py-1 bg-rose-900 hover:bg-rose-800 rounded-lg text-white cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Global Error message */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-amber-950/70 border border-amber-800 text-amber-200 text-xs sm:text-sm flex items-center justify-between shadow-lg">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs px-2.5 py-1 bg-amber-900 hover:bg-amber-800 rounded-lg text-white cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Futuristic Telemetry HUD Bar (when user is active and not on admin, payment, or support page) */}
        {user && viewMode !== 'admin' && viewMode !== 'admin-chat' && viewMode !== 'payment' && viewMode !== 'support' && (
          <FuturisticHudBar
            totalItems={filteredItems.length}
            userEmail={user.email}
            userUid={user.uid}
            onOpenGuide={() => setIsChatbotOpen(true)}
          />
        )}

        {/* ADMIN CONSOLE VIEW */}
        {viewMode === 'admin' ? (
          isAdmin ? (
            <AdminUsersPage
              onBackToVault={() => setViewMode('all')}
              onOpenAdminChat={() => setViewMode('admin-chat')}
              onToast={(msg) => showToast(msg)}
            />
          ) : (
            <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl tech-corners">
              <p className="text-sm text-rose-400">Unauthorized: Admin access is restricted.</p>
              <button
                onClick={() => setViewMode('all')}
                className="mt-3 text-xs text-cyan-400 underline cursor-pointer"
              >
                Back to My Personal Vault
              </button>
            </div>
          )
        ) : viewMode === 'admin-chat' ? (
          isAdmin ? (
            <AdminChatPage
              admins={[]}
              currentUser={user}
              isSuperAdmin={isSuperAdminUser(user?.email)}
              onToast={(msg, type) => showToast(msg, type)}
              onBackToConsole={() => setViewMode('admin')}
            />
          ) : (
            <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl tech-corners">
              <p className="text-sm text-rose-400">Unauthorized: Admin chat is restricted.</p>
              <button onClick={() => setViewMode('all')} className="mt-3 text-xs text-cyan-400 underline cursor-pointer">
                Back to My Personal Vault
              </button>
            </div>
          )
        ) : viewMode === 'payment' ? (
          /* SEPARATE PAYMENT & ACCOUNT DETAILS PAGE */
          <PaymentPage
            userId={user?.uid || ''}
            userEmail={user?.email || ''}
            subscription={subscription}
            credentialCount={counts.all}
            isUnlimited={isAccountUnrestricted}
            onBackToVault={() => setViewMode('all')}
            onToast={(msg, type) => showToast(msg, type)}
          />
        ) : viewMode === 'support' ? (
          /* SUPPORT & COMPLAINTS PAGE */
          <SupportPage
            onBackToVault={() => setViewMode('all')}
            onToast={(msg, type) => showToast(msg, type)}
          />
        ) : (
          /* USER VAULT VIEW WITH PAID FEATURE SIDE BOX */
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex-1 w-full min-w-0">
              {/* Top Toolbar: Search, Category Filter, and Add Actions */}
            {user && (
              <>
                {/* Account Suspended / Banned Notice */}
                {subscription.isBanned && (
                  <div className="mb-4 p-4 rounded-2xl bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs shadow-lg space-y-2 animate-in fade-in">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                      <strong className="text-sm font-bold text-white">Security Notice: Account Suspended</strong>
                    </div>
                    <p className="leading-relaxed font-sans">
                      This vault account has been suspended by administration.
                      {subscription.bannedReason ? ` Reason cited: "${subscription.bannedReason}".` : ''}
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-[11px] font-mono text-rose-300">
                      <span>Unbanning is strictly handled by the Primary Superadmin.</span>
                      <a
                        href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(ADMIN_EMAIL)}&su=${encodeURIComponent('Appeal Account Suspension - UID: ' + (user?.uid || ''))}&body=${encodeURIComponent('Hello Faith,\n\nI would like to appeal the suspension on my vault account (UID: ' + (user?.uid || '') + ').\n\nReason cited: ' + (subscription.bannedReason || 'None') + '\n\nThank you.')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded bg-rose-900 hover:bg-rose-800 text-white font-bold cursor-pointer inline-flex items-center gap-1 self-start sm:self-auto font-sans text-xs"
                      >
                        <span>Appeal Suspension</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Auto phone language sync notice badge */}
                {isAutoMode && (
                  <div className="flex items-center justify-between bg-cyan-950/40 border border-cyan-500/25 px-3.5 py-1.5 rounded-xl text-xs font-mono text-cyan-300 mb-4 animate-in fade-in">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">{currentLangInfo.flag}</span>
                      <span>
                        {t('phone_lang_detected', 'Configured to phone language')}:{' '}
                        <strong className="text-white font-bold">{currentLangInfo.nativeName} ({currentLangInfo.name})</strong>
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 hidden sm:inline">📱 Device Synced</span>
                  </div>
                )}

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  {/* Search Bar with futuristic cyber focus */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('search_placeholder', 'Search credentials, websites, usernames, or notes...')}
                      className="w-full bg-slate-900/80 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-10 pr-9 py-2 text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition-all shadow-inner"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Right side controls */}
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    {/* Category Filter Dropdown */}
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 rounded-xl px-3 py-2 outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <option value="all">All Categories</option>
                      <option value="social">Social & Web</option>
                      <option value="work">Work & Dev</option>
                      <option value="financial">Financial</option>
                      <option value="document">Personal Document</option>
                      <option value="other">Other</option>
                    </select>

                    {/* Add New Item Button with subtle cyber shimmer */}
                    <button
                      onClick={() => {
                        if (subscription.isBanned) {
                          showToast('Your account is suspended. Adding items is restricted. Contact admin.', 'error');
                          return;
                        }
                        setIsAddModalOpen(true);
                      }}
                      className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-medium text-xs px-3.5 sm:px-4 py-2 rounded-xl shadow-md shadow-cyan-600/25 transition-all cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{t('add_credential', 'Add Item')}</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Vault Content / Empty States */}
            {authLoading || (user && loadingItems && items.length === 0) ? (
              <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center">
                <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
                <p className="text-xs font-mono">DECRYPTING AND LOADING ISOLATED VAULT...</p>
              </div>
            ) : !user ? (
              /* Signed-out Futuristic Hero */
              <div className="relative bg-slate-900/70 border border-cyan-500/20 rounded-2xl p-8 sm:p-12 text-center max-w-xl mx-auto my-8 backdrop-blur-xl shadow-2xl shadow-cyan-950/20 tech-corners scanline-container">
                {/* Concentric subtle floating shield icon */}
                <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center animate-subtle-float">
                  <div className="absolute inset-0 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 animate-pulse pointer-events-none" />
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-sky-400 border border-cyan-400/40 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                </div>

                <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-mono text-[10px] mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  <span>QUANTUM SECURE VAULT ACTIVE</span>
                </div>

                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">
                  Zero-Knowledge Personal Vault
                </h3>
                <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto mb-8 leading-relaxed">
                  Authenticate securely to unlock your dedicated cloud enclave. Protect Facebook & Google logins, personal documents up to 200MB, and encrypted keys with cryptographic isolation.
                </p>

                <div className="flex items-center justify-center">
                  <button
                    onClick={openAuthModal}
                    className="inline-flex items-center justify-center space-x-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-medium text-sm px-8 py-3.5 rounded-xl shadow-lg shadow-cyan-600/30 hover:shadow-cyan-500/50 transition-all cursor-pointer transform hover:-translate-y-0.5"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Sign In / Create Account</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-10 pt-6 border-t border-slate-800/80 text-left text-xs text-slate-400">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-[11px]">Strict Firestore UID Isolation</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-[11px]">Encrypted Credential Locker</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-[11px]">Confidential Images &le; 200MB</span>
                  </div>
                </div>
              </div>
            ) : filteredItems.length === 0 ? (
              /* Signed-in Empty State */
              <div className="p-8 sm:p-12 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl max-w-lg mx-auto my-6">
                <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mx-auto mb-3">
                  {viewMode === 'documents' ? (
                    <FileText className="w-6 h-6 text-indigo-400" />
                  ) : (
                    <KeyRound className="w-6 h-6 text-indigo-400" />
                  )}
                </div>
                <h4 className="text-base font-semibold text-white mb-1">
                  {searchQuery
                    ? 'No matching vault records found'
                    : viewMode === 'favorites'
                    ? 'No favorite items yet'
                    : 'Your personal vault is empty'}
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
                  {searchQuery
                    ? 'Try searching with different keywords or clear the search filter.'
                    : 'Start storing your credentials, Facebook or Google logins, personal documents, and passwords securely.'}
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2.5 rounded-xl font-medium transition-all cursor-pointer shadow-md shadow-indigo-600/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add First Credential or Document</span>
                  </button>

                </div>
              </div>
            ) : (
              /* Grid of Vault Items */
              <div className="vault-stagger-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {filteredItems.map((item, index) => {
                  const editable = canEditSlotItem(index, subscription, isAccountUnrestricted);
                  return (
                    <VaultCard
                      key={item.id}
                      item={item}
                      slotIndex={index}
                      canEdit={editable}
                      onLockedEditClick={(slotIdx) => {
                        showToast(
                          `Slot #${slotIdx + 1} is View-Only because your plan countdown has expired. You can view & copy all stored credentials freely, but editing is limited to the first 10 slots. Renew to unlock editing!`,
                          'info'
                        );
                      }}
                      onEdit={(it) => {
                        if (!editable) {
                          showToast(
                            `Slot #${index + 1} is View-Only. Renew your plan to edit items beyond the first 10 slots.`,
                            'error'
                          );
                          return;
                        }
                        setEditingItem(it);
                      }}
                      onDelete={(id) => handleDeleteItem(id)}
                      onToggleFavorite={(id, current) => handleToggleFavorite(item)}
                      onCopySuccess={(text) => showToast(text, 'success')}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Side Box for Paid Feature & Capacity (when signed in) */}
          {user && (
            <div className="w-full lg:w-72 xl:w-80 flex-shrink-0">
              <SlotUpgradeSideBox
                credentialCount={counts.all}
                maxSlots={isAccountUnrestricted ? UNLIMITED_CREDENTIAL_SLOTS : subscription.maxCredentialSlots}
                isPaid={subscription.plan === 'paid'}
                isUnlimited={isAccountUnrestricted}
                onNavigateToPayment={() => setViewMode('payment')}
                onOpenAddItem={() => setIsAddModalOpen(true)}
                onResetTestPlan={() => resetToFreePlan(user.uid, user.email)}
              />
            </div>
          )}
        </div>
        )}
      </main>

      {/* Footer */}
      <footer className="site-chrome border-t border-emerald-950 bg-[#040e08]/95 py-4 px-4 sm:px-6 text-center text-[11px] text-slate-400 font-mono">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Vault-X &bull; Quantum-Resistant End-to-End Isolated Data</span>
          </div>
          <div className="flex items-center space-x-3 text-slate-400">
            {isAdmin && (
              <span className="text-emerald-300 font-medium">Administrator Authenticated</span>
            )}
            <span>Max Upload: 200MB</span>
          </div>
        </div>
      </footer>

      {/* Add Item Modal */}
      <AddVaultItemModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleCreateItem}
        credentialCount={counts.all}
        maxSlots={isAccountUnrestricted ? UNLIMITED_CREDENTIAL_SLOTS : subscription.maxCredentialSlots}
        isUnlimited={isAccountUnrestricted}
        onNavigateToPayment={() => setViewMode('payment')}
      />

      {/* Edit Item Modal */}
      <EditVaultItemModal
        isOpen={Boolean(editingItem)}
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={handleUpdateItem}
      />

      {/* AI Storage Guide Chatbot - Available to signed-in users on every device */}
      {user && (
        <VaultChatbot
          isOpenExternal={isChatbotOpen}
          onToggleOpen={(open) => setIsChatbotOpen(open)}
          onOpenAddItem={() => setIsAddModalOpen(true)}
          vaultSummary={{
            total: items.length,
            credentials: items.filter((item) => item.type === 'credential').length,
            documents: items.filter((item) => item.type === 'document').length,
            favorites: items.filter((item) => item.favorite).length,
            categories: Array.from(new Set(items.map((item) => item.category))),
          }}
        />
      )}

      {/* Android Adaptive Bottom Navigation Bar (Mobile Thumb-Friendly) */}
      {user && isMobileDevice && (
        <AndroidBottomNav
          currentView={viewMode}
          onSelectView={(mode) => setViewMode(mode)}
          onOpenAddModal={() => setIsAddModalOpen(true)}
          counts={counts}
          isAdmin={isAdmin}
        />
      )}

      {/* Authentication Modal (Google, Email/Password) */}
      <AuthModal />

      {recoveryNotice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-amber-400/40 bg-[#07130f] p-6 text-white shadow-2xl">
            <div className="flex items-center gap-2 text-amber-300 font-mono font-bold">
              <KeyRound className="h-5 w-5" />
              Save your Vault X recovery code
            </div>
            <p className="mt-3 text-sm text-slate-300">
              This one-time code helps you request an email change if you lose access to your sign-in email. Store it somewhere private. Vault X will not show it again.
            </p>
            <div className="my-5 rounded-xl border border-amber-400/40 bg-black/50 py-4 text-center text-2xl font-mono font-bold tracking-[0.35em] text-amber-200">
              {recoveryNotice.code}
            </div>
            <p className="text-[11px] text-slate-400">Expires in 15 minutes. Admin approval is required before an email change is applied.</p>
            <button
              type="button"
              onClick={clearRecoveryNotice}
              className="mt-5 w-full rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400"
            >
              I saved my code
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 left-5 z-50 flex items-center space-x-2.5 px-4 py-3 rounded-xl text-xs font-mono shadow-2xl transition-all animate-in slide-in-from-bottom-3 backdrop-blur-md tech-corners ${
            toast.type === 'error'
              ? 'bg-rose-950/90 border border-rose-600 text-rose-200 shadow-rose-950/40'
              : toast.type === 'info'
              ? 'bg-slate-900/90 border border-cyan-500/40 text-cyan-200 shadow-cyan-950/40'
              : 'bg-slate-900/90 border border-emerald-500/40 text-emerald-200 shadow-emerald-950/40'
          }`}
        >
          {toast.type === 'success' && (
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span className="animate-radar-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          )}
          {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
          {toast.type === 'info' && <Lock className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
          <span className="tracking-wide">[{toast.message.toUpperCase()}]</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <VaultApp />
      </AuthProvider>
    </LanguageProvider>
  );
}
