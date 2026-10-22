import {
  KeyRound,
  FileText,
  Star,
  Users,
  Plus,
  Sparkles,
} from 'lucide-react';
import { VaultXLogo } from './VaultXLogo';
import { useLanguage } from '../context/LanguageContext';
import { VaultViewMode } from '../types/vault';

interface AndroidBottomNavProps {
  currentView: VaultViewMode;
  onSelectView: (view: VaultViewMode) => void;
  onOpenAddModal: () => void;
  counts: {
    all: number;
    credentials: number;
    documents: number;
    favorites: number;
  };
  isAdmin?: boolean;
}

export const AndroidBottomNav: React.FC<AndroidBottomNavProps> = ({
  currentView,
  onSelectView,
  onOpenAddModal,
  counts,
  isAdmin = false,
}) => {
  const { t } = useLanguage();
  return (
    <nav
      aria-label="Mobile Navigation"
      className="site-chrome md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#040e08]/95 backdrop-blur-2xl border-t border-emerald-950 shadow-2xl pb-safe pt-1.5"
    >
      <div className="flex items-center justify-around px-2 max-w-lg mx-auto h-14">
        {/* All Items */}
        <button
          type="button"
          onClick={() => onSelectView('all')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-90 ${
            currentView === 'all' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <VaultXLogo size={20} showGlow={false} />
            {counts.all > 0 && (
              <span className="absolute -top-1 -right-2 text-[9px] font-mono px-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                {counts.all}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight font-mono">{t('nav_all', 'All')}</span>
        </button>

        {/* Credentials */}
        <button
          type="button"
          onClick={() => onSelectView('credentials')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-90 ${
            currentView === 'credentials' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <KeyRound className="w-5 h-5" />
            {counts.credentials > 0 && (
              <span className="absolute -top-1 -right-2 text-[9px] font-mono px-1 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                {counts.credentials}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">{t('nav_credentials', 'Logins')}</span>
        </button>

        {/* Floating Center Action Button (Add Item) */}
        <div className="relative -top-3 flex flex-col items-center justify-center px-1">
          <button
            type="button"
            onClick={onOpenAddModal}
            className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-950/60 border-2 border-[#040e08] active:scale-95 transition-transform cursor-pointer"
            title="Add New Credential or Document"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
          <span className="text-[9px] text-emerald-400/80 font-medium mt-0.5 font-mono">NEW</span>
        </div>

        {/* Documents */}
        <button
          type="button"
          onClick={() => onSelectView('documents')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-90 ${
            currentView === 'documents' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <FileText className="w-5 h-5" />
            {counts.documents > 0 && (
              <span className="absolute -top-1 -right-2 text-[9px] font-mono px-1 rounded-full bg-sky-950 text-sky-300 border border-sky-500/40">
                {counts.documents}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">{t('nav_documents', 'Docs')}</span>
        </button>

        {/* Admin or Favorites */}
        {isAdmin ? (
          <button
            type="button"
            onClick={() => onSelectView(currentView === 'admin' ? 'all' : 'admin')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-90 ${
              currentView === 'admin' ? 'text-purple-400 font-bold' : 'text-purple-300 hover:text-white'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 tracking-tight">{t('nav_admin', 'Admin')}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSelectView('favorites')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-90 ${
              currentView === 'favorites' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Star className="w-5 h-5" />
              {counts.favorites > 0 && (
                <span className="absolute -top-1 -right-2 text-[9px] font-mono px-1 rounded-full bg-amber-950 text-amber-300 border border-amber-500/40">
                  {counts.favorites}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">{t('nav_favorites', 'Starred')}</span>
          </button>
        )}
      </div>
    </nav>
  );
};
