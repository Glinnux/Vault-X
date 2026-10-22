import React from 'react';
import { ListTodo, Plus, Sparkles, FilterX, LogIn, CheckCircle2 } from 'lucide-react';
import { VaultXLogo } from './VaultXLogo';
import { useAuth } from '../context/AuthContext';

interface EmptyStateProps {
  isFiltered: boolean;
  onClearFilters: () => void;
  onLoadSampleTasks: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  isFiltered,
  onClearFilters,
  onLoadSampleTasks,
}) => {
  const { user, openAuthModal, loading } = useAuth();

  if (!user && !loading) {
    return (
      <div className="bg-[#05140d]/80 border border-emerald-900/50 rounded-2xl p-8 sm:p-12 text-center max-w-xl mx-auto my-6 backdrop-blur-sm tech-corners">
        <div className="flex items-center justify-center mb-5">
          <VaultXLogo size={64} showGlow={true} />
        </div>
        <h3 className="text-xl font-extrabold text-white mb-2 font-mono">
          Secure <span className="text-emerald-400">Vault X</span> Enclave
        </h3>
        <p className="text-slate-300 text-sm max-w-md mx-auto mb-6 leading-relaxed">
          Sign in with your Google or Email account to access your personal workspace. Every record and credential is encrypted and isolated in Firestore.
        </p>

        <button
          onClick={openAuthModal}
          className="inline-flex items-center space-x-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-lg shadow-emerald-950/60 transition-all cursor-pointer transform hover:-translate-y-0.5 font-mono"
        >
          <LogIn className="w-4 h-4" />
          <span>Sign In / Create Account</span>
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 pt-6 border-t border-slate-800/80 text-left text-xs text-slate-400">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>Strict User Record Isolation</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
            <span>Instant Real-Time Sync</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
            <span>Smart Priority & Tags</span>
          </div>
        </div>
      </div>
    );
  }

  if (isFiltered) {
    return (
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 text-center my-6">
        <div className="w-12 h-12 mx-auto rounded-xl bg-slate-800/80 flex items-center justify-center mb-3 text-slate-400">
          <FilterX className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-white mb-1">No tasks match your filters</h4>
        <p className="text-xs text-slate-400 mb-4 max-w-sm mx-auto">
          Try clearing your search query or adjusting your priority and tag filters.
        </p>
        <button
          onClick={onClearFilters}
          className="px-3.5 py-1.5 text-xs font-medium text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/60 rounded-xl transition-colors cursor-pointer"
        >
          Reset All Filters
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 sm:p-10 text-center my-6">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-950/50 border border-indigo-800/40 flex items-center justify-center mb-4 text-indigo-400">
        <ListTodo className="w-7 h-7" />
      </div>
      <h3 className="text-base font-semibold text-white mb-1">Your task list is empty</h3>
      <p className="text-xs text-slate-400 max-w-md mx-auto mb-5 leading-relaxed">
        Stay organized and productive. Add your first item using the input bar above, or load sample tasks to explore features.
      </p>

      <button
        onClick={onLoadSampleTasks}
        className="inline-flex items-center space-x-2 text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 px-4 py-2 rounded-xl transition-all cursor-pointer shadow-sm"
      >
        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
        <span>Load Sample Goals & Tasks</span>
      </button>
    </div>
  );
};
