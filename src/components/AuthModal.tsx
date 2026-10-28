import React, { useState } from 'react';
import {
  X,
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  KeyRound,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { VaultXLogo } from './VaultXLogo';
import { useAuth } from '../context/AuthContext';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    closeAuthModal,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    authError,
    clearAuthError,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'recover-email'>('signin');
  const [email, setEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localSuccessMsg, setLocalSuccessMsg] = useState<string | null>(null);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    setLocalSuccessMsg(null);

    if (!email.trim()) return;

    setIsSubmitting(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else if (mode === 'signup') {
        await signUpWithEmail(email, password, displayName);
      } else if (mode === 'forgot') {
        await resetPassword(email);
        setLocalSuccessMsg(`Password reset link sent to ${email}. Please check your inbox.`);
      } else if (mode === 'recover-email') {
        const response = await fetch('/api/recovery/request-email-change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: recoveryCode, newEmail: email }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Could not submit the recovery request.');
        setLocalSuccessMsg(data.message || 'Your request was sent to the administrators for approval.');
      }
    } catch (err: any) {
      // Error is caught and formatted in AuthContext and displayed via authError
      if (mode === 'recover-email') setLocalSuccessMsg(err?.message || 'Could not submit the recovery request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleClick = async () => {
    clearAuthError();
    setLocalSuccessMsg(null);
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#05140d] border border-emerald-500/35 rounded-2xl p-4 sm:p-7 shadow-2xl shadow-emerald-950/60 tech-corners overflow-hidden max-h-[calc(100dvh-1rem)] overflow-y-auto text-white">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-emerald-950/60 transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-4">
          <VaultXLogo size={42} showGlow={false} />
          <div>
            <h3 className="text-lg font-extrabold text-white tracking-tight font-mono">
              {mode === 'forgot'
                ? 'Reset Password'
                : mode === 'recover-email'
                ? 'Recover Sign-In Email'
                : mode === 'signup'
                ? 'Create Vault X Account'
                : 'Access Vault X'}
            </h3>
            <p className="text-xs text-emerald-300/80">
              Zero-knowledge credential encryption & document enclave
            </p>
          </div>
        </div>

        {/* Primary Mode Tabs (Sign In vs Register) */}
        {mode !== 'forgot' && mode !== 'recover-email' && (
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/60 border border-emerald-950 rounded-xl my-3 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                clearAuthError();
                setLocalSuccessMsg(null);
                setMode('signin');
              }}
              className={`py-1.5 rounded-lg transition-all cursor-pointer text-center font-mono ${
                mode === 'signin'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                clearAuthError();
                setLocalSuccessMsg(null);
                setMode('signup');
              }}
              className={`py-1.5 rounded-lg transition-all cursor-pointer text-center font-mono ${
                mode === 'signup'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Error notification */}
        {authError && (
          <div className="my-3 p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex flex-col space-y-2 animate-in fade-in">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed font-sans">{authError}</div>
            </div>
            <button
              type="button"
              onClick={() => setShowTroubleshooting(true)}
              className="text-[11px] font-mono text-cyan-300 hover:underline inline-flex items-center gap-1 self-start pt-1 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>See why this happened & how to resolve it</span>
            </button>
          </div>
        )}

        {/* Success notification */}
        {localSuccessMsg && (
          <div className="my-3 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-start space-x-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{localSuccessMsg}</div>
          </div>
        )}

        {/* Social / OAuth Providers */}
        {mode !== 'forgot' && (
          <div className="space-y-2.5 mt-3">
            {/* Google Sign In */}
            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center space-x-3 bg-slate-800/90 hover:bg-slate-750 text-white font-medium text-xs py-2.5 px-4 rounded-xl border border-slate-700/80 transition-all cursor-pointer shadow-sm hover:border-slate-600 disabled:opacity-60"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-3.5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <span className="relative bg-slate-900 px-3 text-[10px] uppercase font-mono tracking-wider text-slate-500">
                Or continue with email credentials
              </span>
            </div>
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Full Name / Alias
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-sans"
                />
              </div>
            </div>
          )}

          {mode === 'recover-email' && (
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">6-Character Recovery Code</label>
              <input
                type="text"
                required
                maxLength={6}
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="ABC123"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-sm tracking-[0.3em] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              {mode === 'recover-email' ? 'New Email Address' : 'Email Address'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-sans"
              />
            </div>
          </div>

          {mode !== 'forgot' && mode !== 'recover-email' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-mono text-slate-300">Password</label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      clearAuthError();
                      setMode('forgot');
                    }}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-10 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-950/60 transition-all cursor-pointer disabled:opacity-60 mt-1 font-mono"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>
              {isSubmitting
                ? 'Processing...'
                : mode === 'signup'
                ? 'Register & Create Vault X Account'
                : mode === 'forgot'
                ? 'Send Password Reset Link'
                : mode === 'recover-email'
                ? 'Submit Recovery Request'
                : 'Sign In to Vault X'}
            </span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </form>

        {mode === 'signin' && (
          <button
            type="button"
            onClick={() => {
              clearAuthError();
              setLocalSuccessMsg(null);
              setMode('recover-email');
            }}
            className="mt-3 w-full text-center text-[11px] text-amber-300 hover:text-amber-200 cursor-pointer"
          >
            Forgot your sign-in email? Use a recovery code
          </button>
        )}

        {/* Collapsible Troubleshooting & Local Run Section */}
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => setShowTroubleshooting(!showTroubleshooting)}
            className="w-full flex items-center justify-between text-xs font-mono text-slate-400 hover:text-cyan-300 cursor-pointer py-1 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
              <span>Why can't I sign in? (Troubleshooting & Local Setup)</span>
            </span>
            {showTroubleshooting ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showTroubleshooting && (
            <div className="mt-2.5 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] text-slate-300 space-y-2.5 font-sans leading-relaxed animate-in fade-in">
              <div>
                <strong className="text-white block font-mono flex items-center gap-1">
                  <span>1. Browser Popup Blocked</span>
                </strong>
                <p className="text-slate-400 mt-0.5">
                  Browsers (especially inside web preview iframes) frequently block OAuth popup windows. Look for a blocked popup icon in your browser URL address bar and select <strong>"Always allow popups"</strong>.
                </p>
              </div>

              <div>
                <strong className="text-white block font-mono flex items-center gap-1">
                  <span>2. First-Time Email Sign-In</span>
                </strong>
                <p className="text-slate-400 mt-0.5">
                  If signing in with email, make sure you clicked <strong>"Create Account (New User)"</strong> to register first. If Email/Password shows "Provider Disabled", enable it in the Firebase Console under <em>Authentication &gt; Sign-in method</em>, or use Google Sign-In.
                </p>
              </div>

              <div className="pt-1 border-t border-slate-900 flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>Firebase Project: gen-lang-client-0532918067</span>
                <span className="text-cyan-400">Port: 3000</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 text-center text-xs text-slate-400">
          {mode === 'forgot' ? (
            <button
              type="button"
              onClick={() => {
                clearAuthError();
                setLocalSuccessMsg(null);
                setMode('signin');
              }}
              className="text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer underline"
            >
              Back to Sign In
            </button>
          ) : mode === 'signin' ? (
            <p>
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => {
                  clearAuthError();
                  setLocalSuccessMsg(null);
                  setMode('signup');
                }}
                className="text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer underline"
              >
                Sign Up for Free
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  clearAuthError();
                  setLocalSuccessMsg(null);
                  setMode('signin');
                }}
                className="text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer underline"
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
