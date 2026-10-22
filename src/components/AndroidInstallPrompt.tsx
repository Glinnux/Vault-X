import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, ShieldCheck } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const AndroidInstallPrompt: React.FC = () => {
  const { isInstallable, isInstalled, isAndroid, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isDismissed = sessionStorage.getItem('vault_x_install_dismissed') === 'true';
    if (isDismissed) setDismissed(true);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('vault_x_install_dismissed', 'true');
  };

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      setDismissed(true);
    }
  };

  if (isInstalled || dismissed || !isInstallable) {
    return null;
  }

  return (
    <div className="w-full mb-4 animate-in fade-in slide-in-from-top-2">
      <div className="relative bg-[#05140d]/90 border border-emerald-500/40 rounded-2xl p-3.5 sm:p-4 backdrop-blur-xl shadow-xl flex items-center justify-between gap-3 tech-corners">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight font-mono">
                {isAndroid ? 'Install on Android' : 'Install Vault X'}
              </h4>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                PWA
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Add to home screen for fullscreen standalone access & instant unlocking.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={handleInstall}
            className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2 px-3.5 rounded-xl shadow-md shadow-emerald-950/60 transition-all cursor-pointer active:scale-95 whitespace-nowrap font-mono"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Dismiss install notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
