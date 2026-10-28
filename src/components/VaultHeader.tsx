import React, { useState, useEffect } from 'react';
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
}) => {
  const { user, openAuthModal, signOut, loading, isBanned } = useAuth();
  const { t, isAutoMode, currentLangInfo } = useLanguage();
  const [hasAppointedAdminRecord, setHasAppointedAdminRecord] = useState(false);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);

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
              <VaultXLogo size={64} showGlow={true} />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-radar-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white group-hover:text-emerald-300 transition-colors font-mono">
                  VAULT<span className="text-emerald-400">-X</span>
                </span>
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
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Language Selector Dropdown */}
            <LanguageSelector />

            {isInstallable && onInstallApp && (
              <button
                onClick={onInstallApp}
                className="hidden sm:inline-flex items-center space-x-1.5 text-xs text-emerald-300 hover:text-white bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/40 px-3 py-1.5 rounded-lg transition-all cursor-pointer font-mono"
                title="Install Vault X on your device"
              >
                <span>📲 {t('nav_install', 'Install App')}</span>
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => onSelectView(currentView === 'admin' ? 'all' : 'admin')}
                className={`flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all cursor-pointer relative ${
                  currentView === 'admin'
                    ? 'bg-purple-600 border-purple-400 text-white shadow-md shadow-purple-600/30'
                    : 'bg-purple-950/70 border-purple-800 text-purple-200 hover:bg-purple-900/80 hover:border-purple-600'
                }`}
                title="View All Registered Users & Payments (Admin Console)"
              >
                <Users className="w-3.5 h-3.5 text-purple-300" />
                <span>{currentView === 'admin' ? 'Exit Admin' : t('nav_admin', 'Admin Console')}</span>
                {pendingPaymentsCount > 0 && (
                  <span className="flex items-center gap-1 bg-amber-500 text-slate-950 font-bold text-[10px] px-1.5 py-0.2 rounded-full font-mono animate-pulse shadow-sm">
                    {pendingPaymentsCount} NEW
                  </span>
                )}
              </button>
            )}

            {loading ? (
              <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-cyan-500 animate-spin" />
            ) : user ? (
              <div className="flex items-center space-x-3 pl-2 border-l border-slate-800">
                <div className="flex items-center space-x-2">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-8 h-8 rounded-full ring-2 ring-cyan-500/40 object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-cyan-700 flex items-center justify-center font-bold text-xs text-white">
                      {(user.displayName || user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="hidden lg:block text-left">
                    <div className="text-xs font-medium text-white max-w-[130px] truncate">
                      {user.displayName || 'Google User'}
                    </div>
                    <div className="text-[10px] text-slate-400 max-w-[130px] truncate font-mono">
                      {user.email}
                    </div>
                  </div>
                </div>

                {/* User UID verification chip */}
                <div className="hidden md:flex items-center space-x-1.5 bg-slate-950/80 border border-slate-800 px-2 py-1 rounded-lg text-[10px] font-mono text-slate-400">
                  <span className="text-slate-500">UID:</span>
                  <span className="text-cyan-300 font-semibold truncate max-w-[80px]" title={user.uid}>
                    {user.uid.slice(0, 8)}...
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(user.uid);
                    }}
                    className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                    title={`Copy full User UID: ${user.uid}`}
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>

                <button
                  onClick={signOut}
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                  title="Lock Vault & Terminate Session"
                >
                  <LogOut className="w-4 h-4" />
                </button>
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
        {user && currentView !== 'admin' && (
          <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-2.5 border-t border-emerald-950 text-xs">
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
