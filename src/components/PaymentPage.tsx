import React, { useState } from 'react';
import {
  ArrowLeft,
  Copy,
  Check,
  Building2,
  CreditCard,
  ShieldCheck,
  Zap,
  Lock,
  Sparkles,
  HelpCircle,
  ExternalLink,
  Edit2,
  Save,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Mail,
  UserCheck,
  Calendar,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSelector } from './LanguageSelector';
import {
  submitPaymentVerification,
  ADMIN_SUPPORT_EMAIL,
} from '../services/supportService';
import {
  SUBSCRIPTION_PLANS,
  getPlanOption,
  FREE_CREDENTIAL_SLOTS,
  getBankTransferDetails,
  saveBankTransferDetails,
  activatePaidPlan,
  resetToFreePlan,
} from '../services/subscriptionService';
import { BankAccountDetails, UserSubscription, PlanDuration } from '../types/vault';

interface PaymentPageProps {
  userId: string;
  userEmail: string;
  subscription: UserSubscription;
  credentialCount: number;
  isUnlimited?: boolean;
  onBackToVault: () => void;
  onToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const PaymentPage: React.FC<PaymentPageProps> = ({
  userId,
  userEmail,
  subscription,
  credentialCount,
  isUnlimited = false,
  onBackToVault,
  onToast,
}) => {
  const { t } = useLanguage();
  const [bankDetails, setBankDetails] = useState<BankAccountDetails>(getBankTransferDetails());
  const [selectedPlan, setSelectedPlan] = useState<PlanDuration>('monthly');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Editable Account Number mode so user can set their exact number anytime
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [editBankName, setEditBankName] = useState(bankDetails.bankName);
  const [editAccountNumber, setEditAccountNumber] = useState(bankDetails.accountNumber);
  const [editAccountName, setEditAccountName] = useState(bankDetails.accountName);

  // Payment Confirmation Form
  const [senderName, setSenderName] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [bankUsed, setBankUsed] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activationSuccess, setActivationSuccess] = useState(false);
  const [emailNoticeModal, setEmailNoticeModal] = useState<{
    confirmedWithin: string;
    emailContent: string;
    senderName: string;
    bankUsed: string;
    paymentRef: string;
    amount: string;
    userUid: string;
    userEmail: string;
    planName: string;
    emailDelivery?: { sent: boolean; method: string; message: string };
    gmailAdminUrl?: string;
    mailtoAdminUrl?: string;
    gmailUserUrl?: string;
    mailtoUserUrl?: string;
  } | null>(null);

  const currentPlan = getPlanOption(selectedPlan);

  // Distinct payment reference prefix
  const referenceCode = `VAULT-${userId ? userId.substring(0, 8).toUpperCase() : 'USER'}`;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    onToast(`${label} copied to clipboard!`, 'info');
    setTimeout(() => {
      setCopiedField(null);
    }, 2500);
  };

  const handleSaveBankDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAccountNumber.trim()) {
      onToast('Account number cannot be empty', 'error');
      return;
    }
    const updated = saveBankTransferDetails({
      bankName: editBankName.trim() || 'Bank Transfer',
      accountNumber: editAccountNumber.trim(),
      accountName: editAccountName.trim() || 'Account Holder',
    });
    setBankDetails(updated);
    setIsEditingAccount(false);
    onToast('Account details successfully updated!', 'success');
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName.trim()) {
      onToast('Please enter your Sender Name / Depositor Name used in transfer.', 'error');
      return;
    }
    if (!bankUsed.trim()) {
      onToast('Please enter the Bank Used for the transfer.', 'error');
      return;
    }

    const finalRef = paymentRef.trim() || referenceCode;
    const amountVal = currentPlan.priceNGN;
    const formattedAmt = currentPlan.formattedPrice;

    try {
      setSubmitting(true);
      const result = await submitPaymentVerification({
        userId,
        userEmail,
        senderName: senderName.trim(),
        bankUsed: bankUsed.trim(),
        paymentRef: finalRef,
        paymentCurrency: 'NGN',
        planDuration: selectedPlan,
        amount: amountVal,
      });

      setEmailNoticeModal({
        confirmedWithin: result.confirmedWithin || '2 working days',
        emailContent: result.emailContent,
        senderName: senderName.trim(),
        bankUsed: bankUsed.trim(),
        paymentRef: finalRef,
        amount: formattedAmt,
        userUid: userId,
        userEmail: userEmail,
        planName: currentPlan.name,
        emailDelivery: result.emailDelivery,
        gmailAdminUrl: result.gmailAdminUrl,
        mailtoAdminUrl: result.mailtoAdminUrl,
        gmailUserUrl: result.gmailUserUrl,
        mailtoUserUrl: result.mailtoUserUrl,
      });

      setActivationSuccess(true);
      onToast(
        'Confirmation notice dispatched! Your payment would be confirmed within 2 working days.',
        'success'
      );
    } catch (err: any) {
      console.error(err);
      onToast('Submission failed. Please check connection and try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInstantDemoActivate = async () => {
    try {
      setSubmitting(true);
      await activatePaidPlan(userId, {
        planDuration: selectedPlan,
        paymentRef: `DEMO-INSTANT-${selectedPlan.toUpperCase()}-${Date.now()}`,
        status: 'verified',
        senderName: senderName.trim() || 'Demo Fast-Track',
        bankUsed: bankUsed.trim() || 'Direct Activation',
      });
      setActivationSuccess(true);
      onToast(
        `Instant Activation: ${currentPlan.name} active! ${
          currentPlan.isUnlimited ? 'Unlimited slots unlocked' : `${currentPlan.totalSlots} slots unlocked`
        }!`,
        'success'
      );
    } catch (err) {
      onToast('Error activating plan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetToFree = async () => {
    try {
      await resetToFreePlan(userId);
      setActivationSuccess(false);
      onToast('Plan reset to Free Tier (10 slots) for testing.', 'info');
    } catch (err) {
      onToast('Error resetting plan', 'error');
    }
  };

  const isUnrestricted = isUnlimited || subscription.isUnlimited || subscription.plan === 'unlimited';
  const isAlreadyPaid = isUnrestricted || subscription.plan === 'paid' || subscription.planDuration != null || activationSuccess;

  return (
    <div className="max-w-4xl mx-auto py-2 sm:py-6">
      {/* Back button and breadcrumb */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <button
          onClick={onBackToVault}
          className="inline-flex items-center space-x-2 text-xs font-mono text-cyan-400 hover:text-cyan-300 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>RETURN TO VAULT</span>
        </button>

        <div className="flex items-center space-x-3 text-xs font-mono text-slate-400">
          <LanguageSelector compact />
          <div className="flex items-center space-x-1.5">
            <span className="hidden sm:inline">Current Usage:</span>
            <span className="text-white font-bold">{credentialCount}</span>
            <span>/</span>
            <span className="text-cyan-400 font-bold">
              {isUnrestricted
                ? 'Unlimited slots'
                : isAlreadyPaid
                ? `${subscription.maxCredentialSlots || 30} slots`
                : `${FREE_CREDENTIAL_SLOTS} slots`}
            </span>
          </div>
        </div>
      </div>

      {/* Main Hero Card */}
      <div className="relative bg-slate-900/80 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl shadow-cyan-950/20 tech-corners mb-6 overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-cyan-500/10 via-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-mono text-xs mb-3">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>OFFICIAL STORAGE EXPANSION PORTAL</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2 font-mono">
              Upgrade <span className="text-emerald-400">Vault X</span> Storage
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-xl leading-relaxed">
              Standard free accounts include 10 slots for storing credentials. Choose a Nigerian Naira plan below to expand your capacity up to unlimited slots.
            </p>
          </div>

          {/* Pricing Highlight Pill */}
          <div className="bg-slate-950/90 border border-cyan-500/40 rounded-2xl p-4 sm:p-5 text-right flex-shrink-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Selected Plan
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1">
              {currentPlan.formattedPrice}
            </div>
            <div className="text-xs font-mono text-cyan-300">{currentPlan.durationLabel}</div>
            <div className="mt-2 text-[10px] text-slate-400 font-mono">
              {currentPlan.isUnlimited ? '✨ UNLIMITED SLOTS' : `${currentPlan.totalSlots} SLOTS TOTAL`}
            </div>
          </div>
        </div>

        {/* Paid or Unrestricted status notification */}
        {isUnrestricted ? (
          <div className="mt-6 p-4 rounded-xl bg-purple-950/70 border border-purple-500/50 text-purple-200 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0" />
              <div>
                <strong className="font-semibold text-white">Unrestricted VIP Account:</strong> Slot restrictions are removed from your account ({userEmail || 'active user'}). You have unlimited credential capacity.
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 bg-purple-900/60 text-purple-200 border border-purple-500/40 rounded-lg font-mono whitespace-nowrap self-start sm:self-auto">
              👑 UNLIMITED ACTIVE
            </span>
          </div>
        ) : isAlreadyPaid ? (
          <div className="mt-6 p-4 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs sm:text-sm flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <strong className="font-semibold">Upgrade Active:</strong> You have {subscription.maxCredentialSlots || 30} credential slots allotted to your account.
              </div>
            </div>
            <button
              onClick={handleResetToFree}
              className="text-xs px-2.5 py-1 bg-emerald-900/60 hover:bg-emerald-800 text-white rounded-lg transition-colors cursor-pointer"
              title="Test resetting to free tier 10-slot limit"
            >
              Reset for Testing
            </button>
          </div>
        ) : null}
      </div>

      {/* PLAN SELECTION CAROUSEL / CARDS */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-bold">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span>Select Your Plan (Nigerian Naira ₦)</span>
          </span>
          <span className="text-[11px] text-slate-500 font-mono">Select a plan to transfer</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${
                  isSelected
                    ? 'bg-gradient-to-b from-cyan-950/80 via-slate-900 to-indigo-950/80 border-cyan-400 shadow-xl shadow-cyan-950/50 ring-1 ring-cyan-500/40'
                    : 'bg-slate-900/70 hover:bg-slate-900/90 border-slate-800 hover:border-slate-700'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-2.5 right-4 bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full font-mono uppercase tracking-wider shadow-sm">
                    MOST POPULAR
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                      {plan.name}
                    </span>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-500 text-slate-950'
                          : 'border-slate-700 bg-slate-950'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>

                  <div className="text-2xl font-extrabold text-white font-mono tracking-tight">
                    {plan.formattedPrice}
                  </div>
                  <div className="text-xs text-cyan-300 font-mono mt-0.5">{plan.durationLabel}</div>

                  <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                    {plan.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Total Capacity:</span>
                  <span className="text-white font-bold">
                    {plan.isUnlimited ? '👑 Unlimited' : `${plan.totalSlots} Slots`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column Layout: Bank Details (Left) & Confirmation / Activation (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: OFFICIAL BANK ACCOUNT DETAILS */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-xl tech-corners">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    Bank Account Details
                  </h2>
                  <p className="text-[11px] text-slate-400">Official Nigerian Bank Transfer (NGN)</p>
                </div>
              </div>

              <span className="text-xs px-3 py-1 rounded-full font-mono bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold">
                ₦ NAIRA ONLY
              </span>
            </div>

            {/* If user is editing account details */}
            {isEditingAccount ? (
              <form onSubmit={handleSaveBankDetails} className="space-y-4 mb-6 p-4 rounded-xl bg-slate-950/80 border border-cyan-500/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-cyan-300">
                    Configure Bank Account Details
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingAccount(false)}
                    className="text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={editBankName}
                    onChange={(e) => setEditBankName(e.target.value)}
                    placeholder="e.g. Guaranty Trust Bank / Kuda / Access"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Account Number <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editAccountNumber}
                    onChange={(e) => setEditAccountNumber(e.target.value)}
                    placeholder="e.g. 0123456789"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Account Name</label>
                  <input
                    type="text"
                    value={editAccountName}
                    onChange={(e) => setEditAccountName(e.target.value)}
                    placeholder="e.g. Faith Oluwole / Vault X"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center space-x-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs py-2 rounded-lg cursor-pointer transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Account Details</span>
                </button>
              </form>
            ) : null}

            {/* Prominent Account Number Card */}
            <div className="relative bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/60 border border-cyan-500/40 rounded-2xl p-5 mb-5 shadow-inner">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase font-mono tracking-wider text-cyan-400 flex items-center gap-1.5 font-bold">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  OFFICIAL NAIRA ACCOUNT NUMBER
                </span>
                <button
                  onClick={() => setIsEditingAccount(true)}
                  className="text-[10px] text-slate-400 hover:text-cyan-300 flex items-center space-x-1 cursor-pointer transition-colors"
                  title="Update or change account number"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit Account Details</span>
                </button>
              </div>

              {/* Big Account Number Display */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/90 border border-slate-800 rounded-xl p-3.5">
                <div>
                  <div className="text-[10px] text-slate-400 font-mono">ACCOUNT NUMBER</div>
                  <div className="text-2xl sm:text-3xl font-mono font-extrabold text-white tracking-widest text-cyan-200">
                    {bankDetails.accountNumber}
                  </div>
                </div>

                <button
                  onClick={() => handleCopy(bankDetails.accountNumber, 'Account Number')}
                  className="inline-flex items-center justify-center space-x-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono px-4 py-2.5 rounded-lg shadow-md transition-all cursor-pointer whitespace-nowrap"
                >
                  {copiedField === 'Account Number' ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>COPIED!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>COPY NUMBER</span>
                    </>
                  )}
                </button>
              </div>

              {/* Bank Name, Account Name, Amount Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-800/80 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono block">BANK NAME</span>
                  <div className="font-semibold text-white mt-0.5">{bankDetails.bankName}</div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-mono block">ACCOUNT NAME</span>
                  <div className="font-semibold text-white mt-0.5">{bankDetails.accountName}</div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-mono block">AMOUNT TO TRANSFER</span>
                  <div className="font-extrabold text-cyan-300 text-base font-mono mt-0.5">
                    {currentPlan.formattedPrice}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-mono block">PLAN DURATION & SLOTS</span>
                  <div className="font-semibold text-white mt-0.5">
                    {currentPlan.name} ({currentPlan.durationLabel})
                  </div>
                </div>
              </div>
            </div>

            {/* Step-by-Step Guide */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                Transfer Instructions
              </h3>
              <ol className="space-y-2 text-xs text-slate-300 list-decimal list-inside leading-relaxed">
                <li>
                  Open your bank app and transfer <strong className="text-white font-mono">{currentPlan.formattedPrice}</strong> to the account details above.
                </li>
                <li>
                  In the transfer narration/remark, enter your user reference code:{' '}
                  <span className="font-mono text-cyan-300 font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                    {referenceCode}
                  </span>
                </li>
                <li>
                  Enter your Sender/Depositor Name in the verification form and click submit.
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: VERIFICATION SUBMISSION FORM */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-xl tech-corners">
            <div className="flex items-center space-x-2.5 mb-4 pb-3 border-b border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Submit Verification
                </h2>
                <p className="text-[11px] text-slate-400">Confirm your bank deposit</p>
              </div>
            </div>

            <form onSubmit={handleConfirmPayment} className="space-y-3.5">
              {/* Selected Plan Summary Badge */}
              <div className="p-3 rounded-xl bg-slate-950 border border-cyan-500/30 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block">PLAN SELECTED:</span>
                  <span className="text-cyan-300 font-bold">{currentPlan.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">FEE:</span>
                  <span className="text-white font-bold">{currentPlan.formattedPrice}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  User Verification UID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={userId}
                    readOnly
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono outline-none cursor-default pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(userId, 'User UID')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    title="Copy your User UID"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Depositor / Sender Full Name <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="e.g. Adebayo Ogunlesi"
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Bank Used for Transfer <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={bankUsed}
                  onChange={(e) => setBankUsed(e.target.value)}
                  placeholder="e.g. GTBank, Kuda, Zenith, OPay, Access"
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Transaction Reference / Narration (Optional)
                </label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder={`e.g. ${referenceCode} or Bank Session ID`}
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none"
                />
              </div>

              {/* 2 Working Days Notice Banner */}
              <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-xl text-xs space-y-1 font-mono">
                <div className="flex items-center space-x-1.5 text-cyan-300 font-bold text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>2 WORKING DAYS CONFIRMATION NOTICE</span>
                </div>
                <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                  Upon submitting your transfer details, an email notice will be issued confirming that your payment would be confirmed within <strong>2 working days</strong>.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-cyan-600 via-indigo-600 to-sky-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs py-3 px-4 rounded-xl shadow-lg shadow-cyan-600/25 transition-all cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>
                  {submitting
                    ? 'Transmitting Transfer Details...'
                    : `Submit Transfer for ${currentPlan.name} (${currentPlan.formattedPrice})`}
                </span>
              </button>
            </form>

            {/* Fast-Track / Demo Instant Activation */}
            <div className="mt-5 pt-5 border-t border-slate-800">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                <span>Instant Review / Fast-Track</span>
                <span className="text-cyan-400 text-[10px]">Testing Enclave</span>
              </div>
              <button
                type="button"
                onClick={handleInstantDemoActivate}
                disabled={submitting}
                className="w-full inline-flex items-center justify-center space-x-1.5 bg-slate-950 hover:bg-slate-900 border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 text-xs py-2.5 px-3 rounded-xl transition-all cursor-pointer font-mono"
              >
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>⚡ Instant Activate {currentPlan.name}</span>
              </button>
              <p className="text-[10px] text-slate-500 mt-1.5 text-center">
                Instantly credits slots for testing the quota limits in action.
              </p>
            </div>
          </div>

          {/* Guarantee / Support Box */}
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 text-xs text-slate-400 space-y-2">
            <div className="flex items-center space-x-2 text-slate-300 font-semibold text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Zero-Knowledge Guarantee</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Your credentials remain strictly client-encrypted and stored inside your dedicated Firestore partition.
            </p>
            <div className="pt-2 border-t border-slate-800/60 text-[11px]">
              Need payment assistance or have questions? Email us directly at{' '}
              <a
                href="mailto:oluwolefaith92@gmail.com"
                className="text-cyan-400 hover:underline font-mono"
              >
                oluwolefaith92@gmail.com
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 2 WORKING DAYS CONFIRMATION EMAIL NOTICE MODAL */}
      {emailNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl shadow-cyan-900/30 tech-corners space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400 mx-auto">
              <Mail className="w-6 h-6" />
            </div>

            <div className="text-center">
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                EMAIL NOTICE DISPATCHED
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight mt-2">
                Payment Would Be Confirmed Within 2 Working Days
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                A verification confirmation has been sent for{' '}
                <strong className="text-cyan-300 font-mono">{emailNoticeModal.planName} ({emailNoticeModal.amount})</strong>.
              </p>
            </div>

            {/* Verification Receipt Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs space-y-2.5">
              <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-850">
                <span className="text-[11px]">User Verification UID:</span>
                <span className="text-cyan-300 font-bold truncate max-w-[220px] select-all">
                  {emailNoticeModal.userUid}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Plan Selected:</span>
                <span className="font-semibold text-white">{emailNoticeModal.planName}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Sender / Depositor:</span>
                <span className="font-semibold text-white">{emailNoticeModal.senderName}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Bank Used:</span>
                <span className="text-white">{emailNoticeModal.bankUsed}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Amount:</span>
                <span className="text-emerald-400 font-bold text-sm font-mono">
                  {emailNoticeModal.amount}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Reference:</span>
                <span className="text-cyan-300">{emailNoticeModal.paymentRef}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300 pt-2 border-t border-slate-850">
                <span className="text-[11px] text-amber-400 font-bold">Confirmation SLA:</span>
                <span className="text-amber-300 font-bold">Within 2 Working Days</span>
              </div>
            </div>

            {/* Full Email Message Box */}
            <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-3 text-[11px] font-mono text-slate-300 space-y-1.5 whitespace-pre-wrap max-h-40 overflow-y-auto">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-sans">
                Official Email Notice Content:
              </div>
              {emailNoticeModal.emailContent}
            </div>

            {/* Email Dispatch & Gateway Status */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-slate-300 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>ADMIN NOTIFICATION GATEWAY:</span>
                <span className="text-cyan-300 font-bold">oluwolefaith92@gmail.com</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                {emailNoticeModal.emailDelivery?.sent
                  ? '✅ Automated notification dispatched to administrator inbox.'
                  : '📬 Verification recorded in the live audit queue. You can also send an instant copy to the administrator via Gmail below:'}
              </p>

              {/* Direct 1-Click Email Dispatch Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {emailNoticeModal.gmailAdminUrl && (
                  <a
                    href={emailNoticeModal.gmailAdminUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center space-x-1.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-[11px] font-sans font-medium py-2 px-3 rounded-xl shadow transition-all cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Send to Admin (Gmail)</span>
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </a>
                )}

                {emailNoticeModal.gmailUserUrl && (
                  <a
                    href={emailNoticeModal.gmailUserUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-sans font-medium py-2 px-3 rounded-xl border border-slate-700 transition-all cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Send Copy to My Email</span>
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </a>
                )}
              </div>
            </div>

            <div className="text-[11px] text-slate-400 text-center leading-relaxed font-sans">
              Once verified by our administrative team against the bank transfer log, your extra credential slots will be activated.
            </div>

            <button
              onClick={() => {
                setEmailNoticeModal(null);
                onBackToVault();
              }}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
            >
              Return to Vault Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
