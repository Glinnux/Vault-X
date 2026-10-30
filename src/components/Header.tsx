import React from 'react';
import { CheckCircle2, LogIn, LogOut, ShieldCheck, Radio } from 'lucide-react';
import { VaultXLogo } from './VaultXLogo';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  onOpenSecurityModal: () => void;
  onOpenShareModal: () => void;
  totalTasks: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSecurityModal,
  onOpenShareModal,
  totalTasks,
}) => {
  const { user, openAuthModal, signOut, loading } = useAuth();

  return (
    <header className="site-chrome sticky top-0 z-30 bg-[#040e08]/90 backdrop-blur-md border-b border-emerald-950 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <VaultXLogo size={38} showGlow={true} />
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg tracking-tight text-white font-mono">
                VAULT<span className="text-emerald-400">-X</span>
              </span>
              <span className="text-[11px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Zero-Knowledge Credential & Document Enclave
            </p>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {user && (
            <div className="hidden md:flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2.5 py-1 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-medium">Live Cloud Sync</span>
            </div>
          )}

          <button
            onClick={onOpenSecurityModal}
            className="flex items-center space-x-1.5 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            title="View Database Isolation & Security Rules"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Data Isolation</span>
          </button>

          {user && (
            <button
              onClick={onOpenShareModal}
              className="flex items-center space-x-1.5 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              title="Share or Export Tasks"
            >
              <Radio className="w-4 h-4 text-sky-400" />
              <span className="hidden sm:inline">Sync / Export</span>
            </button>
          )}

          {/* User Auth */}
          {loading ? (
            <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-indigo-500 animate-spin" />
          ) : user ? (
            <div className="flex items-center space-x-3 pl-2 border-l border-slate-800">
              <div className="flex items-center space-x-2">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 rounded-full ring-2 ring-indigo-500/40 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs text-white">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-medium text-white max-w-[130px] truncate">
                    {user.displayName || 'Google User'}
                  </div>
                  <div className="text-[10px] text-slate-400 max-w-[130px] truncate">
                    {user.email}
                  </div>
                </div>
              </div>

              <button
                onClick={signOut}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={openAuthModal}
              className="flex items-center space-x-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-medium px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In / Register</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
