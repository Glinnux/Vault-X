import React from 'react';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
  AlertCircle,
  CreditCard,
  Building2,
  Lock,
  Zap,
} from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '../services/subscriptionService';

interface SlotUpgradeSideBoxProps {
  credentialCount: number;
  maxSlots: number;
  isPaid: boolean;
  isUnlimited?: boolean;
  onNavigateToPayment: () => void;
  onOpenAddItem: () => void;
  onResetTestPlan?: () => void;
}

export const SlotUpgradeSideBox: React.FC<SlotUpgradeSideBoxProps> = ({
  credentialCount,
  maxSlots,
  isPaid,
  isUnlimited = false,
  onNavigateToPayment,
  onOpenAddItem,
  onResetTestPlan,
}) => {
  const percentage = isUnlimited
    ? 100
    : Math.min(100, Math.round((credentialCount / maxSlots) * 100));
  const isFull = !isUnlimited && credentialCount >= maxSlots;
  const isNearLimit = !isUnlimited && credentialCount >= maxSlots - 2 && !isFull;
  const remaining = isUnlimited ? '∞' : Math.max(0, maxSlots - credentialCount);

  return (
    <aside className="w-full space-y-4">
      {/* 1. CREDENTIAL STORAGE CAPACITY METER */}
      <div className="bg-[#05140d]/85 border border-emerald-900/50 rounded-2xl p-4 sm:p-5 backdrop-blur-xl shadow-xl shadow-black/30 tech-corners relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-semibold tracking-wider uppercase text-slate-200 font-mono">
              Credential Slots
            </h3>
          </div>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              isUnlimited
                ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300 font-bold'
                : isPaid
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                : 'bg-black/60 border-emerald-950 text-slate-300'
            }`}
          >
            {isUnlimited ? '👑 UNRESTRICTED' : isPaid ? 'PAID (+20 SLOTS)' : 'FREE PLAN'}
          </span>
        </div>

        {/* Progress bar and counter */}
        <div className="space-y-2 mb-3">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-white">
              {credentialCount}{' '}
              <span className="text-xs text-slate-400 font-sans font-normal">
                {isUnlimited ? '/ Unlimited slots' : `/ ${maxSlots} slots used`}
              </span>
            </span>
            <span
              className={`text-xs font-mono font-medium ${
                isUnlimited
                  ? 'text-emerald-300 font-bold'
                  : isFull
                  ? 'text-rose-400'
                  : isNearLimit
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {isUnlimited ? 'UNLIMITED' : `${percentage}%`}
            </span>
          </div>

          <div className="w-full bg-black/60 rounded-full h-2.5 overflow-hidden border border-emerald-950/80 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isUnlimited
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-white shadow-sm shadow-emerald-500/30'
                  : isFull
                  ? 'bg-rose-500 shadow-sm shadow-rose-500/50'
                  : isNearLimit
                  ? 'bg-amber-400'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Status description */}
        <div className="text-[11px] text-slate-400 leading-relaxed">
          {isUnlimited ? (
            <div className="flex items-start gap-1.5 text-purple-200 bg-purple-950/40 border border-purple-900/60 p-2 rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Slot Restrictions Removed:</strong> Your account has unlimited credential storage allotment.
              </span>
            </div>
          ) : isFull ? (
            <div className="flex items-start gap-1.5 text-rose-300 bg-rose-950/40 border border-rose-900/60 p-2 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Limit Reached:</strong> All {maxSlots} vault item slots are filled. Upgrade to allot more slots.
              </span>
            </div>
          ) : (
            <p>
              {remaining} slot{remaining === 1 ? '' : 's'} available for new passwords and accounts.
            </p>
          )}
        </div>
      </div>

      {/* 2. PAID FEATURE UPGRADE SIDE BOX OR UNRESTRICTED CARD */}
      {isUnlimited ? (
        /* VIP UNRESTRICTED ACCOUNT CARD */
        <div className="bg-gradient-to-b from-purple-950/40 via-slate-900/90 to-indigo-950/40 border border-purple-500/40 rounded-2xl p-4 sm:p-5 backdrop-blur-xl shadow-xl shadow-purple-950/20 tech-corners">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-300 font-mono text-[10px] mb-3">
            <ShieldCheck className="w-3 h-3 text-purple-400" />
            <span className="font-semibold tracking-wider">UNRESTRICTED ACCOUNT</span>
          </div>

          <h4 className="text-sm font-bold text-white mb-1">
            Unlimited Credential Storage
          </h4>
          <p className="text-xs text-slate-300 mb-4 leading-relaxed">
            All credential slot limitations are removed from this account. You can securely store as many passwords, credentials, and accounts as needed.
          </p>

          <button
            onClick={onOpenAddItem}
            className="w-full inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Add New Credential</span>
          </button>
        </div>
      ) : !isPaid ? (
        <div className="relative bg-[#05140d]/90 border border-emerald-500/35 hover:border-emerald-400/60 rounded-2xl p-4 sm:p-5 backdrop-blur-xl shadow-xl shadow-emerald-950/30 tech-corners transition-all group">
          {/* Subtle Cyber Corner Accents */}
          <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-emerald-400 opacity-60" />
          <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-emerald-400 opacity-60" />

          {/* Badge */}
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] mb-3">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span className="font-semibold tracking-wider">PAID FEATURE &bull; +20 SLOTS</span>
          </div>

          <h4 className="text-sm font-bold text-white mb-1 tracking-tight flex items-center justify-between font-mono">
            <span>Allot 20 More Slots</span>
            <span className="text-xs font-mono text-emerald-300 font-normal">30 Total</span>
          </h4>

          <p className="text-xs text-slate-300 mb-3.5 leading-relaxed">
            Free users have 10 slots. Each credential or document uses one slot. Upgrade to add more vault item slots.
          </p>

          {/* Pricing Box */}
          <div className="bg-black/60 border border-emerald-950 rounded-xl p-3 mb-3.5 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400">Naira Plans from</div>
              <div className="text-base sm:text-lg font-bold font-mono text-white flex items-baseline gap-1.5">
                <span className="text-emerald-300">₦2,000 NGN</span>
                <span className="text-xs font-normal text-slate-400">/ 14 days</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                Monthly: ₦8,000 &bull; Yearly: ₦15,000
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
              <Zap className="w-4 h-4" />
            </div>
          </div>

          {/* Feature list */}
          <ul className="space-y-1.5 text-xs text-slate-300 mb-4 font-mono text-[11px]">
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>30 Total Credential Slots</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>Direct Bank Account Transfer</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>Zero-Trust Firestore Partition</span>
            </li>
          </ul>

          {/* Redirect to separate payment page */}
          <button
            onClick={onNavigateToPayment}
            className="w-full inline-flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-950/60 transition-all cursor-pointer group-hover:shadow-emerald-900 font-mono"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Make Payment & Upgrade</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
          </button>

          <p className="text-[10px] text-center text-slate-400 mt-2 font-mono">
            Redirects to bank transfer & account details page
          </p>
        </div>
      ) : (
        /* PRO ENCLAVE ACTIVE CARD */
        <div className="bg-gradient-to-b from-emerald-950/40 via-slate-900/90 to-cyan-950/40 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 backdrop-blur-xl shadow-xl shadow-emerald-950/20 tech-corners">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] mb-3">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span className="font-semibold tracking-wider">PAID PLAN ACTIVE</span>
          </div>

          <h4 className="text-sm font-bold text-white mb-1">
            +20 Extra Slots Allotted
          </h4>
          <p className="text-xs text-slate-300 mb-4 leading-relaxed">
            Your vault capacity has been extended. Credentials and documents each use one vault item slot.
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={onNavigateToPayment}
              className="w-full inline-flex items-center justify-center space-x-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs py-2 px-3 rounded-xl transition-all cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>View Account & Payment Details</span>
            </button>

            {onResetTestPlan && (
              <button
                onClick={onResetTestPlan}
                className="text-[10px] text-slate-500 hover:text-slate-400 underline cursor-pointer text-center py-1"
                title="Reset to 10 slots to test free plan limit"
              >
                Reset to Free Plan (Demo Test)
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
