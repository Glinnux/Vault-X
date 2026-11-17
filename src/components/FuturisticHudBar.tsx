import React from 'react';
import { Lock, Bot, Copy } from 'lucide-react';

interface FuturisticHudBarProps {
  totalItems: number;
  userEmail?: string | null;
  userUid?: string | null;
  onOpenGuide?: () => void;
  onToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const FuturisticHudBar: React.FC<FuturisticHudBarProps> = ({
  totalItems,
  userEmail,
  userUid,
  onOpenGuide,
  onToast,
}) => {
  const handleCopyUid = async () => {
    if (!userUid) return;
    try {
      await navigator.clipboard.writeText(userUid);
      onToast('User ID copied to clipboard.', 'success');
    } catch (error) {
      console.error('Could not copy user ID:', error);
      onToast('Could not copy user ID. Check clipboard permissions.', 'error');
    }
  };

  return (
    <div className="relative z-10 mb-6 w-full">
      <div className="vault-status-strip flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Lock className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Your vault is protected</p>
            <p className="mt-0.5 text-xs text-slate-500">Your saved items are encrypted</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {userUid && (
            <div
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600"
              title={`Verification UID: ${userUid}`}
            >
              <span className="hidden text-slate-500 sm:inline">ID</span>
              <span className="font-medium text-slate-700">{userUid.slice(0, 8)}…</span>
              <button
                type="button"
                onClick={handleCopyUid}
                className="rounded-md p-1 text-slate-500 hover:bg-white hover:text-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
                title="Copy user ID"
                aria-label="Copy user ID"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <strong className="font-semibold text-slate-900">{totalItems}</strong>
            <span className="ml-1">{totalItems === 1 ? 'saved item' : 'saved items'}</span>
          </span>

          {onOpenGuide && (
            <button
              onClick={onOpenGuide}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
              title="Open Vault X Storage & Information Guide"
            >
              <Bot className="h-4 w-4" />
              <span>Guide</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
