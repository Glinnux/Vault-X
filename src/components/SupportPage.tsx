import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  LifeBuoy,
  MessageSquare,
  AlertTriangle,
  Lightbulb,
  CreditCard,
  Send,
  Copy,
  Check,
  ShieldCheck,
  Clock,
  Mail,
  ExternalLink,
  Sparkles,
  FileText,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  ADMIN_SUPPORT_EMAIL,
  submitSupportTicket,
  subscribeToUserTickets,
} from '../services/supportService';
import { SupportTicket } from '../types/vault';

interface SupportPageProps {
  onBackToVault: () => void;
  onToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const SupportPage: React.FC<SupportPageProps> = ({ onBackToVault, onToast }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'submit' | 'history'>('submit');

  // Form state
  const [type, setType] = useState<'suggestion' | 'complaint' | 'inquiry' | 'payment'>('suggestion');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [submitting, setSubmitting] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  // Success receipt modal
  const [submittedReceipt, setSubmittedReceipt] = useState<{
    ticketId: string;
    type: string;
    subject: string;
    mailtoUrl: string;
    serverDispatched: boolean;
  } | null>(null);

  // Tickets history
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  // Subscribe to user tickets
  useEffect(() => {
    if (!user?.uid) {
      setLoadingTickets(false);
      return;
    }
    const unsubscribe = subscribeToUserTickets(user.uid, (tickets) => {
      setMyTickets(tickets);
      setLoadingTickets(false);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  const userUid = user?.uid || 'ANONYMOUS-UID';
  const userEmail = user?.email || 'user@example.com';
  const userName = user?.displayName || 'Google User';

  const handleCopyUid = () => {
    navigator.clipboard.writeText(userUid);
    setCopiedUid(true);
    onToast(`User UID copied: ${userUid}`, 'info');
    setTimeout(() => setCopiedUid(false), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      onToast('Please enter a subject or title for your submission.', 'error');
      return;
    }
    if (!message.trim()) {
      onToast('Please provide details for your suggestion or complaint.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await submitSupportTicket({
        userId: userUid,
        userEmail: userEmail,
        userName: userName,
        type: type,
        subject: subject.trim(),
        message: message.trim(),
        priority: priority,
      });

      setSubmittedReceipt({
        ticketId: res.ticketId,
        type: type,
        subject: subject.trim(),
        mailtoUrl: res.mailtoUrl,
        serverDispatched: res.serverDispatched,
      });

      // Reset form
      setSubject('');
      setMessage('');
      onToast(`Your ${type} has been sent to the administrator with your UID!`, 'success');
    } catch (err: any) {
      console.error(err);
      onToast('Failed to submit ticket. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getDirectMailto = () => {
    const emailSubject = `[Vault X - ${type.toUpperCase()}] ${subject || 'Support Ticket'} (UID: ${userUid})`;
    const emailBody = `Dear Administrator (Faith Oluwole),

Here is my ${type.toUpperCase()} from Vault X:

USER VERIFICATION METRICS:
- User UID: ${userUid}
- User Email: ${userEmail}
- User Name: ${userName}
- Priority: ${priority}
- Date: ${new Date().toLocaleString()}

SUBJECT:
${subject || 'Support Inquiry'}

MESSAGE:
${message || 'Please write your message here.'}

Thank you.`;

    return `mailto:${ADMIN_SUPPORT_EMAIL}?subject=${encodeURIComponent(
      emailSubject
    )}&body=${encodeURIComponent(emailBody)}`;
  };

  return (
    <div className="max-w-4xl mx-auto py-2 sm:py-6 animate-in fade-in">
      {/* Top Breadcrumb & Return to Vault */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBackToVault}
          className="inline-flex items-center space-x-2 text-xs font-mono text-cyan-400 hover:text-cyan-300 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>RETURN TO VAULT</span>
        </button>

        <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
          <span className="hidden sm:inline">Admin Destination:</span>
          <span className="text-cyan-300 font-semibold">{ADMIN_SUPPORT_EMAIL}</span>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="relative bg-slate-900/80 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl shadow-cyan-950/20 tech-corners mb-8 overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-cyan-500/10 via-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-mono text-xs mb-3">
              <LifeBuoy className="w-3.5 h-3.5 text-cyan-400" />
              <span>OFFICIAL SUPPORT & FEEDBACK DESK</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Suggestions & Complaints Portal
            </h1>
            <p className="text-sm text-slate-300 mt-2 max-w-xl leading-relaxed">
              Have a suggestion to enhance Vault X, a complaint, or a payment confirmation inquiry? Submit directly to the vault administrator at{' '}
              <span className="text-cyan-300 font-mono font-medium">{ADMIN_SUPPORT_EMAIL}</span>. Every submission is digitally certified with your unique User UID.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5">
            <div className="bg-slate-950/80 border border-cyan-500/40 rounded-2xl p-4 font-mono text-xs shadow-inner">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between gap-2 mb-1">
                <span className="flex items-center gap-1 text-emerald-400">
                  <UserCheck className="w-3.5 h-3.5" />
                  Your Verified User UID:
                </span>
                <span className="text-[9px] text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-500/30">
                  AUTO-ATTACHED
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="text-white font-bold text-xs truncate max-w-[220px]" title={userUid}>
                  {userUid}
                </span>
                <button
                  type="button"
                  onClick={handleCopyUid}
                  className="p-1.5 bg-slate-800 hover:bg-cyan-950 text-cyan-300 hover:text-white rounded-lg border border-slate-700 transition-all cursor-pointer flex-shrink-0"
                  title="Copy User UID"
                >
                  {copiedUid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
                <span>Account:</span>
                <span className="text-slate-300 truncate">{userEmail}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Submit vs History */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 mb-6">
        <button
          onClick={() => setActiveTab('submit')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            activeTab === 'submit'
              ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-600/20 border border-cyan-400/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Submit Suggestion or Complaint</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-600/20 border border-cyan-400/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>My Submissions ({myTickets.length})</span>
        </button>
      </div>

      {activeTab === 'submit' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Submission Form */}
          <div className="lg:col-span-8 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-xl tech-corners">
            <h2 className="text-base font-bold text-white mb-4 flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-cyan-400" />
              <span>Compose Message for Vault Administrator</span>
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Category selector */}
              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
                  Select Submission Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('suggestion')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      type === 'suggestion'
                        ? 'bg-cyan-950/60 border-cyan-500 text-white ring-1 ring-cyan-500'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/40'
                    }`}
                  >
                    <Lightbulb className={`w-4 h-4 mb-1.5 ${type === 'suggestion' ? 'text-amber-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-semibold block">Suggestion</span>
                    <span className="text-[10px] text-slate-500">Feature ideas</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('complaint')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      type === 'complaint'
                        ? 'bg-rose-950/60 border-rose-500 text-white ring-1 ring-rose-500'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/40'
                    }`}
                  >
                    <AlertTriangle className={`w-4 h-4 mb-1.5 ${type === 'complaint' ? 'text-rose-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-semibold block">Complaint</span>
                    <span className="text-[10px] text-slate-500">Grievance or issue</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('payment')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      type === 'payment'
                        ? 'bg-emerald-950/60 border-emerald-500 text-white ring-1 ring-emerald-500'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/40'
                    }`}
                  >
                    <CreditCard className={`w-4 h-4 mb-1.5 ${type === 'payment' ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-semibold block">Payment Inquiry</span>
                    <span className="text-[10px] text-slate-500">2-day confirm</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('inquiry')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      type === 'inquiry'
                        ? 'bg-indigo-950/60 border-indigo-500 text-white ring-1 ring-indigo-500'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/40'
                    }`}
                  >
                    <LifeBuoy className={`w-4 h-4 mb-1.5 ${type === 'inquiry' ? 'text-indigo-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-semibold block">General Inquiry</span>
                    <span className="text-[10px] text-slate-500">Account questions</span>
                  </button>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                  Subject / Summary *
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={
                    type === 'suggestion'
                      ? 'e.g. Suggestion: Add custom tags color palette'
                      : type === 'complaint'
                      ? 'e.g. Complaint: Transfer verification question'
                      : type === 'payment'
                      ? 'e.g. Payment Confirmation: Sent from GTBank via Faith O.'
                      : 'e.g. Question regarding encrypted document storage'
                  }
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition-all shadow-inner"
                  required
                />
              </div>

              {/* Priority */}
              <div className="flex items-center space-x-3 text-xs">
                <span className="text-slate-400 font-mono uppercase text-[11px]">Priority:</span>
                {(['normal', 'high', 'urgent'] as const).map((p) => (
                  <label key={p} className="inline-flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="priority"
                      value={p}
                      checked={priority === p}
                      onChange={() => setPriority(p)}
                      className="text-cyan-500 focus:ring-cyan-500"
                    />
                    <span
                      className={`capitalize ${
                        p === 'urgent'
                          ? 'text-rose-400 font-semibold'
                          : p === 'high'
                          ? 'text-amber-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {p}
                    </span>
                  </label>
                ))}
              </div>

              {/* Detailed Message */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider">
                    Detailed Description / Feedback *
                  </label>
                  <span className="text-[10px] font-mono text-slate-500">{message.length}/5000</span>
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  maxLength={5000}
                  placeholder="Provide complete details, suggestions, or grievance description. Your verified User UID is automatically stamped onto this message."
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyan-500 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition-all shadow-inner resize-y"
                  required
                />
              </div>

              {/* UID Verification Notice */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 flex items-start gap-2.5 font-mono">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-200 block font-semibold text-[11px]">
                    Automatic UID Verification Stamped
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Destination: <strong className="text-cyan-300">{ADMIN_SUPPORT_EMAIL}</strong> &bull; Sender UID:{' '}
                    <strong className="text-white">{userUid}</strong>
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-cyan-600 via-indigo-600 to-sky-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs py-3 px-5 rounded-xl shadow-lg shadow-cyan-600/25 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {submitting
                      ? 'Dispatching with UID...'
                      : `Send ${type === 'suggestion' ? 'Suggestion' : 'Complaint'} to Admin`}
                  </span>
                </button>

                <a
                  href={getDirectMailto()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center space-x-2 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500 text-slate-300 hover:text-white font-mono text-xs py-3 px-4 rounded-xl transition-all"
                  title="Open in your default email client with UID pre-filled"
                >
                  <Mail className="w-4 h-4 text-cyan-400" />
                  <span>Send via Email Client</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </div>
            </form>
          </div>

          {/* Right Column: Policies & Quick Help */}
          <div className="lg:col-span-4 space-y-5">
            {/* Payment Confirmation FAQ Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl shadow-xl tech-corners">
              <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-xs mb-2">
                <Clock className="w-4 h-4" />
                <span>Payment Confirmation Policy</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                When you make a bank transfer and submit your <strong>Sender Name</strong> and <strong>Bank Used</strong> on the payment page, your payment is registered for confirmation within <strong>2 working days</strong>.
              </p>
              <div className="mt-3 p-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-200">
                Need urgent confirmation? Submit a ticket under <strong>Payment Inquiry</strong> with your deposit reference.
              </div>
            </div>

            {/* Direct Admin Info Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl shadow-xl tech-corners space-y-3">
              <div className="flex items-center space-x-2 text-cyan-400 font-semibold text-xs">
                <Mail className="w-4 h-4" />
                <span>Administrator Direct Line</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                All communications sent through this form reach the administrator mailbox directly:
              </p>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-mono text-xs text-cyan-300 break-all select-all">
                {ADMIN_SUPPORT_EMAIL}
              </div>
              <p className="text-[11px] text-slate-500">
                Always include your <strong>User UID</strong> when messaging from outside the app for swift verification.
              </p>
            </div>

            {/* Verification Guarantee */}
            <div className="bg-indigo-950/30 border border-indigo-900/50 rounded-2xl p-5 backdrop-blur-xl text-xs space-y-2">
              <div className="flex items-center space-x-2 text-indigo-300 font-semibold">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span>Zero-Knowledge Protection</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Your support messages never expose your client-encrypted passwords or sensitive vault files. Only account-level inquiries and feedback are shared.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* My Tickets History */
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-xl tech-corners">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>My Submitted Suggestions & Complaints</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time tracking of all tickets submitted under UID:{' '}
                <span className="text-cyan-300 font-mono">{userUid}</span>
              </p>
            </div>
          </div>

          {loadingTickets ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Loading your submission history...
            </div>
          ) : myTickets.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <FileText className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-medium text-slate-300">No submissions found</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                You haven't submitted any suggestions or complaints yet. Use the submit tab to send your ideas or inquiries to the administrator.
              </p>
              <button
                onClick={() => setActiveTab('submit')}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Your First Ticket</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myTickets.map((t) => (
                <div
                  key={t.id}
                  className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold ${
                          t.type === 'complaint'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : t.type === 'payment'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : t.type === 'suggestion'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                        }`}
                      >
                        {t.type}
                      </span>
                      <span className="font-semibold text-white text-xs sm:text-sm">{t.subject}</span>
                    </div>

                    <div className="flex items-center space-x-2 text-[10px] font-mono">
                      <span
                        className={`px-2 py-0.5 rounded-full ${
                          t.status === 'resolved'
                            ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-600'
                            : t.status === 'reviewed'
                            ? 'bg-blue-900/60 text-blue-300 border border-blue-600'
                            : 'bg-amber-900/50 text-amber-300 border border-amber-600'
                        }`}
                      >
                        {t.status === 'resolved'
                          ? 'RESOLVED'
                          : t.status === 'reviewed'
                          ? 'UNDER REVIEW'
                          : 'PENDING CONFIRMATION'}
                      </span>
                      <span className="text-slate-500">{t.id}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/60">
                    {t.message}
                  </p>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1">
                    <span>Transmitted to: {ADMIN_SUPPORT_EMAIL}</span>
                    <span>UID: {t.userId}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBMISSION CONFIRMATION RECEIPT MODAL */}
      {submittedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl shadow-cyan-900/30 tech-corners space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center text-emerald-400 mx-auto">
              <Check className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-white tracking-tight">
                Submission Successfully Transmitted!
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Your {submittedReceipt.type} has been dispatched to{' '}
                <strong className="text-cyan-300 font-mono">{ADMIN_SUPPORT_EMAIL}</strong>.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 font-mono text-xs">
              <div className="flex justify-between items-center text-slate-400">
                <span>Ticket Reference:</span>
                <span className="text-white font-bold">{submittedReceipt.ticketId}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Verified User UID:</span>
                <span className="text-cyan-300 font-bold truncate max-w-[200px]">{userUid}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Category:</span>
                <span className="text-amber-300 uppercase">{submittedReceipt.type}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Notice Sent To:</span>
                <span className="text-white">{ADMIN_SUPPORT_EMAIL}</span>
              </div>
            </div>

            <div className="text-xs text-slate-400 leading-relaxed text-center">
              Our administrator will inspect your message alongside your Verification UID. If this was a payment inquiry, please note that transfers are confirmed within <strong>2 working days</strong>.
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSubmittedReceipt(null)}
                className="flex-1 py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl text-xs transition-all cursor-pointer shadow-md"
              >
                Done
              </button>
              <a
                href={submittedReceipt.mailtoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-mono transition-all inline-flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                <span>Open in Mail</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
