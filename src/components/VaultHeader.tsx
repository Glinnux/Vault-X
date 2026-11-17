import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  LogOut,
  Lock,
  Users,
  Terminal,
  Sparkles,
  LifeBuoy,
  Copy,
  Check,
  KeyRound,
  ChevronDown,
} from 'lucide-react';
import { VaultXLogo } from './VaultXLogo';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSelector } from './LanguageSelector';
import { isSuperAdminUser, isUserAdmin } from '../services/adminService';
import { auth } from '../lib/firebase';
import { db } from '../lib/firebase';
import { VaultViewMode } from '../types/vault';

interface VaultHeaderProps {
  currentView: VaultViewMode;
  onSelectView: (view: VaultViewMode) => void;
  counts: {
    all: number;
    credentials: number;
    documents: number;
    favorites: number;
  };
  isPaid?: boolean;
  isUnlimited?: boolean;
  isAdmin?: boolean;
  onInstallApp?: () => void;
  isInstallable?: boolean;
  onManageRecoveryCode?: () => void;
}

export const VaultHeader: React.FC<VaultHeaderProps> = ({
  currentView,
  onSelectView,
  counts,
  isPaid,
  isUnlimited,
  isAdmin: isAdminProp,
  onInstallApp,
  isInstallable,
  onManageRecoveryCode,
}) => {
  const { user, openAuthModal, signOut, loading, isBanned } = useAuth();
  const { t, isAutoMode, currentLangInfo } = useLanguage();
  const [hasAppointedAdminRecord, setHasAppointedAdminRecord] = useState(false);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAccountMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!user || isBanned) {
      setHasAppointedAdminRecord(false);
      return;
    }

    return onSnapshot(
      doc(db, 'admins', user.uid),
      (snapshot) => setHasAppointedAdminRecord(snapshot.exists()),
      (error) => {
        console.warn('Could not verify appointed admin access:', error);
        setHasAppointedAdminRecord(false);
      }
    );
  }, [user?.uid, isBanned]);

  const isAdmin = !isBanned && Boolean(
    isAdminProp ||
    hasAppointedAdminRecord ||
    isSuperAdminUser(user?.email) ||
    isUserAdmin(user?.email, user?.uid)
  );
  const isAdminArea = currentView === 'admin' || currentView === 'admin-chat';

  useEffect(() => {
    if (!isAdmin) return;
    const checkPayments = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/admin/payments', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          const pending = (data.payments || []).filter((p: any) => p.status === 'pending').length;
          setPendingPaymentsCount(pending);
        }
      } catch (_e) {
        // ignore
      }
    };
    checkPayments();
    const interval = setInterval(checkPayments, 15000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  return (
    <header className="site-chrome vault-header-enter sticky top-0 z-30 bg-[#040e08]/90 backdrop-blur-xl border-b border-emerald-900/40 text-white shadow-xl shadow-black/10">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        {/* Main top bar */}
        <div className="h-16 flex items-center justify-between">
          {/* Brand: Vault X with Bespoke Logo */}
          <div
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => onSelectView('all')}
          >
            <div className="vault-brand-logo relative self-center translate-y-1">
              <VaultXLogo size={70} showGlow={false} />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-radar-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <div className="vault-header-brand-details min-w-0">
              <div className="flex items-center space-x-2">
                <img
                  src={`${import.meta.env.BASE_URL}vault-x-wordmark.svg`}
                  alt="VAULT-X"
                  className="h-6 w-28 object-contain object-left sm:h-7 sm:w-36"
                  draggable={false}
                />
                <span className="hidden sm:flex text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  {t('zero_trust', 'ZERO-TRUST')}
                </span>
              </div>
              <p className="text-xs text-emerald-300/70 hidden sm:block font-mono text-[11px]">
                {t('app_subtitle', 'Quantum-Resistant Isolated Storage')}
              </p>
            </div>
          </div>

          {/* Right actions: Language Changer, Admin Console & Auth */}
          <div className="vault-header-actions flex min-w-0 max-w-full shrink items-center space-x-2 sm:space-x-3">
            {/* Language Selector Dropdown */}
            <LanguageSelector className="vault-header-language shrink-0" />

            {isInstallable && onInstallApp && (
              <button
                onClick={onInstallApp}
                className="hidden sm:inline-flex items-center space-x-1.5 text-xs text-slate-950 hover:text-slate-950 bg-cyan-600 hover:bg-cyan-500 border border-cyan-500 px-3 py-1.5 rounded-lg transition-all cursor-pointer font-mono"
                title="Install Vault X on your device"
              >
                <span>📲 {t('nav_install', 'Install App')}</span>
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => onSelectView(isAdminArea ? 'all' : 'admin')}
                className={`vault-header-admin-button flex shrink-0 items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all cursor-pointer relative ${
                  isAdminArea
                    ? 'bg-purple-600 border-purple-400 text-white shadow-md shadow-purple-600/30'
                    : 'bg-purple-950/70 border-purple-800 text-purple-200 hover:bg-purple-900/80 hover:border-purple-600'
                }`}
                title="View All Registered Users & Payments (Admin Console)"
              >
                <Users className="w-3.5 h-3.5 text-purple-300" />
                <span className="vault-header-admin-label">{isAdminArea ? 'Exit Admin' : t('nav_admin', 'Admin Console')}</span>
                {pendingPaymentsCount > 0 && (
                  <span className="vault-header-admin-alert hidden items-center gap-1 bg-amber-500 text-slate-950 font-bold text-[10px] px-1.5 py-0.2 rounded-full font-mono animate-pulse shadow-sm sm:flex">
                    {pendingPaymentsCount} NEW
                  </span>
                )}
              </button>
            )}

            {loading ? (
              <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-cyan-500 animate-spin" />
            ) : user ? (
              <div className="vault-header-account relative min-w-0 shrink-0 pl-2 border-l border-slate-800" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsAccountMenuOpen((open) => !open)}
                  aria-expanded={isAccountMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Open account menu"
                  className="vault-account-trigger flex items-center gap-2 rounded-xl p-1.5 text-left hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover ring-2 ring-emerald-100"
                    />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">
                      {(user.displayName || user.email || 'U')[0].toUpperCase()}
                    </span>
                  )}
                  <span className="hidden max-w-[150px] text-left sm:block">
                    <span className="block truncate text-xs font-semibold text-slate-900">
                      {user.displayName || 'Account'}
                    </span>
                    <span className="block max-w-[150px] truncate text-[10px] text-slate-500">
                      {user.email}
                    </span>
                  </span>
                  <ChevronDown className={`hidden h-4 w-4 text-slate-500 transition-transform sm:block ${isAccountMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isAccountMenuOpen && (
                  <div className="modern-dropdown-panel absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl" role="menu" aria-label="Account options">
                    <div className="border-b border-slate-100 px-3 py-2.5">
                      <p className="text-xs font-semibold text-slate-900">{user.displayName || 'Your account'}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        void navigator.clipboard.writeText(user.uid).catch((error: unknown) => {
                          console.error('Could not copy account ID:', error);
                        });
                        setIsAccountMenuOpen(false);
                      }}
                      className="modern-menu-item mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Copy className="h-4 w-4 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate">Copy account ID</span>
                      <span className="text-[10px] text-slate-400">{user.uid.slice(0, 8)}…</span>
                    </button>
                    {onManageRecoveryCode && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsAccountMenuOpen(false);
                          onManageRecoveryCode();
                        }}
                        className="modern-menu-item flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <KeyRound className="h-4 w-4 text-emerald-700" />
                        Recovery code
                      </button>
                    )}
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        void signOut();
                      }}
                      className="modern-menu-item flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-700 hover:bg-rose-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Lock vault and sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className="flex items-center space-x-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg shadow-sm shadow-emerald-950 transition-all cursor-pointer font-mono"
              >
                <span>Sign In / Register</span>
              </button>
            )}
          </div>
        </div>

        {/* View / Category navigation tabs (shown when signed in) */}
        {user && !isAdminArea && (
          <div className="mobile-menu-scroll flex flex-nowrap items-center space-x-1 sm:space-x-2 overflow-x-auto py-2.5 border-t border-emerald-950 text-xs">
            <button
              onClick={() => onSelectView('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                currentView === 'all'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40 border border-emerald-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-emerald-950/40'
              }`}
            >
              <span>{t('nav_all', 'All Items')}</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-black/40 rounded-full font-mono text-emerald-200">
                {counts.all}
              </span>
            </button>

            <button
              onClick={() => onSelectView('credentials')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                currentView === 'credentials'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40 border border-emerald-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-emerald-950/40'
              }`}
            >
              <span>{t('nav_credentials', 'Credentials')}</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-black/40 rounded-full font-mono text-emerald-200">
                {counts.credentials}
              </span>
            </button>

            <button
              onClick={() => onSelectView('documents')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                currentView === 'documents'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40 border border-emerald-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-emerald-950/40'
              }`}
            >
              <span>{t('nav_documents', 'Documents & IDs')}</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-black/40 rounded-full font-mono text-emerald-200">
                {counts.documents}
              </span>
            </button>

            <button
              onClick={() => onSelectView('favorites')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                currentView === 'favorites'
                  ? 'bg-emerald-700 text-white shadow-md shadow-emerald-950/40 border border-emerald-300/40'
                  : 'text-slate-400 hover:text-white hover:bg-emerald-950/40'
              }`}
            >
              <span>{t('nav_favorites', 'Favorites')}</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-black/40 rounded-full font-mono text-emerald-200">
                {counts.favorites}
              </span>
            </button>

            <button
              onClick={() => onSelectView('support')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                currentView === 'support'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40 border border-emerald-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-emerald-950/40'
              }`}
              title="Submit suggestions or complaints to the administrator"
            >
              <LifeBuoy className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('nav_support', 'Support & Complaints')}</span>
            </button>

            <button
              onClick={() => onSelectView('payment')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ml-auto ${
                currentView === 'payment'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40 border border-emerald-400/40'
                  : isUnlimited
                  ? 'text-emerald-300 hover:text-white bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-500/40'
                  : isPaid
                  ? 'text-emerald-300 hover:text-white bg-emerald-950/50 hover:bg-emerald-900/70 border border-emerald-500/40'
                  : 'text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {isUnlimited
                  ? '👑 Unlimited Slots Active'
                  : isPaid
                  ? t('paid_plan_badge', 'Paid Plan (+20 Slots)')
                  : t('nav_upgrade', 'Upgrade (+20 Slots)')}
              </span>
              {!isPaid && !isUnlimited && (
                <span className="text-[10px] px-1.5 py-0.2 bg-black/40 rounded-full font-mono text-emerald-300">
                  $4.88 / ₦6,500
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
