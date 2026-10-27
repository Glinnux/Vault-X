import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  ShieldCheck,
  Search,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Calendar,
  Mail,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  LifeBuoy,
  MessageSquare,
  AlertTriangle,
  Lightbulb,
  CreditCard,
  Clock,
  ExternalLink,
  Shield,
  UserPlus,
  Trash2,
  Bell,
  CheckCheck,
  Tag,
  Send,
  HelpCircle,
  Settings,
  Slash,
  Eye,
  EyeOff,
  UserX,
  UserCheck,
  Share2,
  Sliders,
  X,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import {
  UserAccount,
  UserPlanTier,
  SupportTicket,
  PlanDuration,
  AdminRecord,
  AdminPermissions,
  DEFAULT_APPOINTED_ADMIN_PERMISSIONS,
  SUPER_ADMIN_PERMISSIONS,
} from '../types/vault';
import {
  subscribeToRegisteredUsers,
  subscribeToAdminsList,
  addAdminByUidOrEmail,
  removeAdminRole,
  updateAdminPermissions,
  banUserAccount,
  unbanUserAccount,
  redirectSuggestionToOwner,
  getAdminPermissions,
  isSuperAdminUser,
  ADMIN_EMAIL,
  SUPER_ADMIN_EMAILS,
  isUserAdmin,
} from '../services/adminService';
import {
  updateUserPlanByAdmin,
  approveUserSubscriptionByAdmin,
  extendUserSubscriptionCountdown,
  expireUserSubscriptionNow,
  grantUnlimitedSlots,
  resetToFreePlan,
  formatRemainingCountdown,
  SUBSCRIPTION_PLANS,
  getPlanOption,
} from '../services/subscriptionService';
import {
  subscribeToAllTickets,
  updateTicketStatus,
  fetchServerPayments,
  updateServerPaymentStatus,
  ServerPaymentRecord,
} from '../services/supportService';
import { useAuth } from '../context/AuthContext';

interface AdminUsersPageProps {
  onBackToVault: () => void;
  onToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const AdminUsersPage: React.FC<AdminUsersPageProps> = ({
  onBackToVault,
  onToast,
}) => {
  const { user } = useAuth();

  // Primary Navigation Tabs: Redesigned into separate, non-confusing distinct tabs
  const [activeTab, setActiveTab] = useState<
    'payments' | 'suggestions' | 'complaints' | 'feedback' | 'admins' | 'users' | 'resolved'
  >('payments');

  // Bank Transfer Sub-tabs: 'notifications' (pending queue) vs 'resolved' (verified audit archive)
  const [paymentSubTab, setPaymentSubTab] = useState<'notifications' | 'resolved'>('notifications');

  // Ticket Status Filter (Applies to whichever ticket tab is active)
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | 'pending' | 'reviewed' | 'resolved'>('all');

  // Data Collections
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [serverPayments, setServerPayments] = useState<ServerPaymentRecord[]>([]);
  const [adminsList, setAdminsList] = useState<AdminRecord[]>([]);
  const [adminsListLoaded, setAdminsListLoaded] = useState(false);

  // Loading States
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);

  // Search & Copy Helpers
  const [search, setSearch] = useState('');
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  // Appoint Admin Form State
  const [newAdminIdentifier, setNewAdminIdentifier] = useState('');
  const [newAdminPerms, setNewAdminPerms] = useState<AdminPermissions>({
    ...DEFAULT_APPOINTED_ADMIN_PERMISSIONS,
  });
  const [showPermsConfigInForm, setShowPermsConfigInForm] = useState(false);
  const [isAppointingAdmin, setIsAppointingAdmin] = useState(false);
  const [appointSuccessNotice, setAppointSuccessNotice] = useState<string | null>(null);

  // Modal: Edit Admin Permissions
  const [editingAdmin, setEditingAdmin] = useState<AdminRecord | null>(null);
  const [permEditState, setPermEditState] = useState<AdminPermissions>({
    ...DEFAULT_APPOINTED_ADMIN_PERMISSIONS,
  });
  const [isSavingPerms, setIsSavingPerms] = useState(false);

  // Modal: Ban User
  const [banningUser, setBanningUser] = useState<UserAccount | null>(null);
  const [banReasonInput, setBanReasonInput] = useState('Suspicious account activity or unverified payment attempt');
  const [isSubmittingBan, setIsSubmittingBan] = useState(false);

  // Modal: Redirect Suggestion to Primary Admin
  const [redirectingTicket, setRedirectingTicket] = useState<SupportTicket | null>(null);
  const [redirectNoteInput, setRedirectNoteInput] = useState('');
  const [isSubmittingRedirect, setIsSubmittingRedirect] = useState(false);

  // Check current user's role and granular permissions
  const isSuperAdmin = isSuperAdminUser(user?.email);
  const isAppointedAdmin = Boolean(user?.uid && adminsList.some((admin) => admin.userId === user.uid));
  const currentAdminPerms: AdminPermissions = useMemo(() => {
    if (isSuperAdmin) return SUPER_ADMIN_PERMISSIONS;
    if (!isAppointedAdmin) {
      return {
        viewFullUserInfo: false,
        giveSlots: false,
        answerComplaints: false,
        redirectSuggestions: false,
        viewTransactions: false,
        banUsers: false,
        addAdmins: false,
        receiveTransactionNotices: false,
      };
    }
    return getAdminPermissions(user?.uid, user?.email);
  }, [user, adminsList, isSuperAdmin, isAppointedAdmin]);

  const availableAdminTabs = useMemo(() => {
    const canViewPayments = isSuperAdmin || currentAdminPerms.viewTransactions || currentAdminPerms.receiveTransactionNotices;
    const canViewSuggestions = isSuperAdmin || currentAdminPerms.answerComplaints || currentAdminPerms.redirectSuggestions;
    const canViewTickets = isSuperAdmin || currentAdminPerms.answerComplaints;
    const canViewUsers = isSuperAdmin || currentAdminPerms.viewFullUserInfo || currentAdminPerms.giveSlots || currentAdminPerms.banUsers || currentAdminPerms.addAdmins;
    const canViewResolved = isSuperAdmin || currentAdminPerms.viewTransactions || currentAdminPerms.receiveTransactionNotices ||
      currentAdminPerms.answerComplaints || currentAdminPerms.redirectSuggestions;

    return [
      { id: 'payments' as const, label: 'Bank Transfer Queue', allowed: canViewPayments },
      { id: 'suggestions' as const, label: 'Suggestions', allowed: canViewSuggestions },
      { id: 'complaints' as const, label: 'Complaints', allowed: canViewTickets },
      { id: 'feedback' as const, label: 'Feedback & Inquiries', allowed: canViewTickets },
      { id: 'resolved' as const, label: 'Resolved', allowed: canViewResolved },
      { id: 'admins' as const, label: 'Appoint & Manage Admins', allowed: isSuperAdmin || currentAdminPerms.addAdmins },
      { id: 'users' as const, label: 'Registered Accounts', allowed: canViewUsers },
    ].filter((tab) => tab.allowed);
  }, [isSuperAdmin, currentAdminPerms]);

  // Live 1-second ticker for admin countdown timers
  const [, setTicker] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTicker((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. Subscribe to registered users
  useEffect(() => {
    const canViewUsers = isSuperAdmin || (
      isAppointedAdmin &&
      (currentAdminPerms.viewFullUserInfo || currentAdminPerms.giveSlots || currentAdminPerms.banUsers || currentAdminPerms.addAdmins)
    );
    if (!canViewUsers) {
      setUsers([]);
      setLoadingUsers(false);
      return;
    }
    setLoadingUsers(true);
    const unsubscribe = subscribeToRegisteredUsers(
      (userList) => {
        setUsers(userList);
        setLoadingUsers(false);
      },
      (error) => {
        console.error('Admin users subscription error:', error);
        setLoadingUsers(false);
      }
    );
    return () => unsubscribe();
  }, [isSuperAdmin, isAppointedAdmin, currentAdminPerms]);

  // 2. Subscribe to support tickets
  useEffect(() => {
    const canViewTickets = isSuperAdmin || (
      isAppointedAdmin && (currentAdminPerms.answerComplaints || currentAdminPerms.redirectSuggestions)
    );
    if (!canViewTickets) {
      setTickets([]);
      setLoadingTickets(false);
      return;
    }
    setLoadingTickets(true);
    const unsubscribe = subscribeToAllTickets((ticketList) => {
      setTickets(ticketList);
      setLoadingTickets(false);
    });
    return () => unsubscribe();
  }, [isSuperAdmin, isAppointedAdmin, currentAdminPerms]);

  // 3. Subscribe to admins list
  useEffect(() => {
    const unsubscribe = subscribeToAdminsList((list) => {
      setAdminsList(list);
      setAdminsListLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isSuperAdmin && adminsListLoaded && (!isAppointedAdmin || availableAdminTabs.length === 0)) {
      onBackToVault();
      return;
    }
    if (!isSuperAdmin && availableAdminTabs.length > 0 && !availableAdminTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(availableAdminTabs[0].id);
    }
  }, [isSuperAdmin, adminsListLoaded, isAppointedAdmin, availableAdminTabs, activeTab, onBackToVault]);

  // 4. Fetch server-audited payments
  const loadPayments = async () => {
    setLoadingPayments(true);
    const payments = await fetchServerPayments();
    setServerPayments(payments);
    setLoadingPayments(false);
  };

  useEffect(() => {
    const canViewPayments = isSuperAdmin || (
      isAppointedAdmin && (currentAdminPerms.viewTransactions || currentAdminPerms.receiveTransactionNotices)
    );
    if (!canViewPayments) {
      setServerPayments([]);
      setLoadingPayments(false);
      return;
    }
    void loadPayments();
  }, [isSuperAdmin, isAppointedAdmin, currentAdminPerms]);

  const handleCopyUid = (uid: string) => {
    navigator.clipboard.writeText(uid);
    setCopiedUid(uid);
    onToast(`Copied UID: ${uid}`, 'info');
    setTimeout(() => {
      setCopiedUid(null);
    }, 2000);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Recent';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Recent';
    }
  };

  // --- Plan & Countdown Handlers (Permission 2: giveSlots) ---
  const handleApprovePlan = async (
    targetUid: string,
    targetEmail: string,
    duration: PlanDuration
  ) => {
    if (!isSuperAdmin && !currentAdminPerms.giveSlots) {
      onToast('Access Denied: You do not have permission to give slots or approve plans.', 'error');
      return;
    }
    try {
      const result = await approveUserSubscriptionByAdmin(targetUid, duration);
      onToast(`Approved ${result.plan.name} (${result.plan.durationLabel}) for ${targetEmail}. Live countdown initiated!`, 'success');
    } catch (e: any) {
      console.error(e);
      onToast(e?.message || 'Failed to approve subscription', 'error');
    }
  };

  const handleExtendCountdown = async (
    targetUid: string,
    targetEmail: string,
    currentExpiresAt: number | undefined,
    days: number
  ) => {
    if (!isSuperAdmin && !currentAdminPerms.giveSlots) {
      onToast('Access Denied: You do not have permission to give slots or extend countdowns.', 'error');
      return;
    }
    try {
      await extendUserSubscriptionCountdown(targetUid, currentExpiresAt, days);
      onToast(`Extended countdown by +${days} days for ${targetEmail}`, 'info');
    } catch (e: any) {
      console.error(e);
      onToast(e?.message || 'Failed to extend countdown', 'error');
    }
  };

  const handleExpireNow = async (targetUid: string, targetEmail: string) => {
    if (!isSuperAdmin && !currentAdminPerms.giveSlots) {
      onToast('Access Denied: You do not have permission to modify user slots.', 'error');
      return;
    }
    try {
      await expireUserSubscriptionNow(targetUid);
      onToast(`Expired countdown for ${targetEmail}. Space reset to 0; slots 11+ view-only.`, 'info');
    } catch (e: any) {
      console.error(e);
      onToast(e?.message || 'Failed to expire countdown', 'error');
    }
  };

  const handleResetUserFree = async (targetUid: string, targetEmail: string) => {
    if (!isSuperAdmin && !currentAdminPerms.giveSlots) {
      onToast('Access Denied: You do not have permission to modify user slots.', 'error');
      return;
    }
    try {
      await resetToFreePlan(targetUid, targetEmail);
      onToast(`Reset ${targetEmail} to Free Tier (10 slots)`, 'info');
    } catch (e: any) {
      console.error(e);
      onToast(e?.message || 'Failed to reset plan', 'error');
    }
  };

  const handleGrantUnlimited = async (targetUid: string, targetEmail: string) => {
    if (!isSuperAdmin && !currentAdminPerms.giveSlots) {
      onToast('Access Denied: You do not have permission to grant unlimited slots.', 'error');
      return;
    }
    try {
      await grantUnlimitedSlots(targetUid);
      onToast(`Granted permanent unlimited slots to ${targetEmail}`, 'success');
    } catch (e: any) {
      console.error(e);
      onToast(e?.message || 'Failed to grant unlimited slots', 'error');
    }
  };

  const handleApproveServerPayment = async (
    payment: ServerPaymentRecord,
    customDuration?: PlanDuration
  ) => {
    if (!isSuperAdmin && !currentAdminPerms.giveSlots) {
      onToast('Access Denied: You do not have permission to approve transactions or give slots.', 'error');
      return;
    }
    try {
      const duration: PlanDuration =
        customDuration ||
        payment.planDuration ||
        (payment.amount >= 15000 ? 'yearly' : payment.amount >= 8000 ? 'monthly' : 'biweekly');

      await approveUserSubscriptionByAdmin(payment.userId, duration);
      await updateServerPaymentStatus(payment.id, 'verified');
      await loadPayments();
      onToast(`Approved ${duration.toUpperCase()} plan & started live countdown for UID: ${payment.userId}`, 'success');
    } catch (e: any) {
      console.error(e);
      onToast(e?.message || 'Failed to approve payment', 'error');
    }
  };

  // --- Ticket Handlers (Permission 3: answerComplaints) ---
  const handleTicketStatus = async (
    ticketId: string,
    status: 'pending' | 'reviewed' | 'resolved'
  ) => {
    if (!isSuperAdmin && !currentAdminPerms.answerComplaints) {
      onToast('Access Denied: You do not have permission to answer complaints or update status.', 'error');
      return;
    }
    try {
      await updateTicketStatus(ticketId, status);
      onToast(`Item marked as ${status.toUpperCase()}`, 'success');
    } catch (e: any) {
      console.error(e);
      onToast('Failed to update ticket status', 'error');
    }
  };

  // --- Redirect Suggestion Handler (Permission 4: redirectSuggestions) ---
  const handleOpenRedirectModal = (ticket: SupportTicket) => {
    if (!isSuperAdmin && !currentAdminPerms.redirectSuggestions) {
      onToast('Access Denied: You do not have permission to redirect suggestions.', 'error');
      return;
    }
    setRedirectingTicket(ticket);
    setRedirectNoteInput(`Strategic suggestion from user UID ${ticket.userId}: please evaluate for inclusion.`);
  };

  const handleConfirmRedirectSuggestion = async () => {
    if (!redirectingTicket) return;
    setIsSubmittingRedirect(true);
    try {
      await redirectSuggestionToOwner(
        redirectingTicket.id,
        user?.email || ADMIN_EMAIL,
        redirectNoteInput.trim()
      );

      // Open pre-filled Gmail compose to primary owner
      const subject = `[Important Suggestion Forwarded] ${redirectingTicket.subject} (UID: ${redirectingTicket.userId})`;
      const body = `Hello Faith,\n\nAn important suggestion has been redirected to you by ${user?.email || 'Admin'}.\n\nUser UID: ${redirectingTicket.userId}\nUser Email: ${redirectingTicket.userEmail}\nSubject: ${redirectingTicket.subject}\n\nSuggestion Message:\n"${redirectingTicket.message}"\n\nAdmin Forwarding Note:\n"${redirectNoteInput}"\n\n-- Vault X Administrative Enclave`;
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(ADMIN_EMAIL)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      window.open(gmailUrl, '_blank', 'noopener,noreferrer');

      onToast(`Successfully redirected suggestion to Primary Admin (${ADMIN_EMAIL})!`, 'success');
      setRedirectingTicket(null);
    } catch (err: any) {
      console.error('Redirect suggestion failed:', err);
      onToast(err?.message || 'Failed to redirect suggestion', 'error');
    } finally {
      setIsSubmittingRedirect(false);
    }
  };

  // --- Account Banning & Unbanning Handlers (Permission 6) ---
  const handleOpenBanModal = (targetUser: UserAccount) => {
    if (!isSuperAdmin && !currentAdminPerms.banUsers) {
      onToast('Access Denied: You do not have permission to ban suspicious users.', 'error');
      return;
    }
    setBanningUser(targetUser);
    setBanReasonInput('Suspicious account behavior or unverified transaction activity');
  };

  const handleConfirmBanUser = async () => {
    if (!banningUser) return;
    setIsSubmittingBan(true);
    try {
      await banUserAccount(
        banningUser.userId,
        banReasonInput.trim(),
        user?.email || ADMIN_EMAIL
      );
      onToast(`Account UID ${banningUser.userId} has been banned and locked.`, 'info');
      setBanningUser(null);
    } catch (err: any) {
      console.error('Ban user failed:', err);
      onToast(err?.message || 'Failed to ban user account', 'error');
    } finally {
      setIsSubmittingBan(false);
    }
  };

  const handleUnbanUser = async (targetUser: UserAccount) => {
    // Strictly superadmin power per user instructions!
    if (!isSuperAdmin) {
      onToast('Permission Denied: Unbanning accounts is reserved exclusively for the Primary Superadmin.', 'error');
      return;
    }
    try {
      await unbanUserAccount(targetUser.userId, user?.email || ADMIN_EMAIL);
      onToast(`Successfully unbanned user account UID: ${targetUser.userId}`, 'success');
    } catch (err: any) {
      console.error('Unban user failed:', err);
      onToast(err?.message || 'Failed to unban user account', 'error');
    }
  };

  // --- Appoint New Admin Handler (Permission 7: addAdmins) ---
  const handleAppointAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin && !currentAdminPerms.addAdmins) {
      onToast('Access Denied: You do not have permission to appoint new administrators.', 'error');
      return;
    }
    if (!newAdminIdentifier.trim()) {
      onToast('Please enter a user UID or email address', 'error');
      return;
    }

    setIsAppointingAdmin(true);
    setAppointSuccessNotice(null);
    try {
      const result = await addAdminByUidOrEmail(
        newAdminIdentifier.trim(),
        user?.email || ADMIN_EMAIL,
        newAdminPerms
      );
      onToast(result.message, 'success');
      setAppointSuccessNotice(result.message);
      setNewAdminIdentifier('');
      setShowPermsConfigInForm(false);
    } catch (err: any) {
      console.error('Appoint admin failed:', err);
      onToast(err?.message || 'Failed to appoint administrator', 'error');
    } finally {
      setIsAppointingAdmin(false);
    }
  };

  const handleRevokeAdmin = async (targetUid: string, targetEmail: string) => {
    if (!isSuperAdmin && !currentAdminPerms.addAdmins) {
      onToast('Access Denied: You do not have permission to revoke administrators.', 'error');
      return;
    }
    if (!confirm(`Are you sure you want to revoke administrator access for ${targetEmail}?`)) {
      return;
    }
    try {
      await removeAdminRole(targetUid, targetEmail);
      onToast(`Revoked admin privileges for ${targetEmail}`, 'info');
    } catch (err: any) {
      console.error('Revoke admin failed:', err);
      onToast(err?.message || 'Failed to revoke administrator', 'error');
    }
  };

  // --- Edit Admin Permissions Modal Handlers ---
  const handleOpenEditPermissions = (targetAdmin: AdminRecord) => {
    if (!isSuperAdmin && !currentAdminPerms.addAdmins) {
      onToast('Access Denied: You do not have permission to edit administrator permissions.', 'error');
      return;
    }
    setEditingAdmin(targetAdmin);
    setPermEditState({
      ...DEFAULT_APPOINTED_ADMIN_PERMISSIONS,
      ...(targetAdmin.permissions || {}),
    });
  };

  const handleSavePermissions = async () => {
    if (!editingAdmin) return;
    setIsSavingPerms(true);
    try {
      await updateAdminPermissions(editingAdmin.userId, permEditState);
      onToast(`Permissions successfully updated for ${editingAdmin.email}!`, 'success');
      setEditingAdmin(null);
    } catch (err: any) {
      console.error('Update permissions failed:', err);
      onToast(err?.message || 'Failed to update administrator permissions', 'error');
    } finally {
      setIsSavingPerms(false);
    }
  };

  // --- Filtered Counts & Datasets ---
  const pendingPayments = useMemo(
    () => serverPayments.filter((p) => p.status === 'pending'),
    [serverPayments]
  );
  const resolvedPayments = useMemo(
    () => serverPayments.filter((p) => p.status === 'verified'),
    [serverPayments]
  );

  // Group tickets into separated categories
  const suggestionTickets = useMemo(
    () => tickets.filter((t) => t.type === 'suggestion'),
    [tickets]
  );
  const complaintTickets = useMemo(
    () => tickets.filter((t) => t.type === 'complaint'),
    [tickets]
  );
  const feedbackTickets = useMemo(
    () => tickets.filter((t) => t.type !== 'suggestion' && t.type !== 'complaint'),
    [tickets]
  );

  // Filter lists based on search & status filter
  const filterTicketList = (baseList: SupportTicket[]) => {
    let list = baseList;
    if (ticketStatusFilter !== 'all') {
      list = list.filter((t) => t.status === ticketStatusFilter);
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (t) =>
        t.subject.toLowerCase().includes(q) ||
        t.message.toLowerCase().includes(q) ||
        t.userEmail.toLowerCase().includes(q) ||
        t.userId.toLowerCase().includes(q)
    );
  };

  const filteredSuggestions = useMemo(() => filterTicketList(suggestionTickets), [suggestionTickets, ticketStatusFilter, search]);
  const filteredComplaints = useMemo(() => filterTicketList(complaintTickets), [complaintTickets, ticketStatusFilter, search]);
  const filteredFeedback = useMemo(() => filterTicketList(feedbackTickets), [feedbackTickets, ticketStatusFilter, search]);

  // Filtered payments based on active payment sub-tab
  const activePaymentsList = useMemo(() => {
    const base = paymentSubTab === 'notifications' ? pendingPayments : resolvedPayments;
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (p) =>
        p.senderName.toLowerCase().includes(q) ||
        p.bankUsed.toLowerCase().includes(q) ||
        p.paymentRef.toLowerCase().includes(q) ||
        p.userEmail.toLowerCase().includes(q) ||
        p.userId.toLowerCase().includes(q)
    );
  }, [paymentSubTab, pendingPayments, resolvedPayments, search]);

  // Filtered registered users
  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        (u.email || '').toLowerCase().includes(q) ||
        (u.displayName || '').toLowerCase().includes(q) ||
        u.userId.toLowerCase().includes(q)
    );
  }, [users, search]);

  // Helper for masking user info if viewFullUserInfo is false
  const canViewFullUserInfo = isSuperAdmin || currentAdminPerms.viewFullUserInfo;

  const resolvedTickets = useMemo(() => {
    const queryText = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (ticket.status !== 'resolved') return false;
      if (!queryText) return true;
      return [ticket.subject, ticket.message, ticket.userEmail, ticket.userId]
        .some((value) => value.toLowerCase().includes(queryText));
    });
  }, [tickets, search]);

  return (
    <div className="space-y-6 animate-in fade-in pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <button
            onClick={onBackToVault}
            className="inline-flex items-center space-x-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium mb-2 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to My Personal Vault</span>
          </button>
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-gradient-to-br from-purple-900/80 to-indigo-900/80 border border-purple-500/40 rounded-xl text-purple-300 shadow-md">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>Administrative Console & Command</span>
                {isSuperAdmin && (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-950 border border-purple-500/60 text-purple-300 font-mono font-bold">
                    👑 SUPERADMIN
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Granular multi-admin permissions, separate queues & bank transfer verification &bull; Auth:{' '}
                <span className="text-purple-300 font-mono font-medium">{user?.email || ADMIN_EMAIL}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isSuperAdmin ? (
            <span className="px-3 py-1 rounded-full text-xs bg-purple-950/90 border border-purple-500/60 text-purple-200 flex items-center gap-1.5 font-bold shadow-sm">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span>Full Enclave Superadmin</span>
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs bg-indigo-950/80 border border-indigo-500/50 text-indigo-300 flex items-center gap-1.5 font-medium shadow-sm">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              <span>Appointed Administrator</span>
            </span>
          )}
        </div>
      </div>

      {/* Detailed metrics are reserved for the superadmin; appointed admins see only permitted tabs. */}
      {isSuperAdmin && (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Metric 1: Pending Bank Transfers */}
        <div
          onClick={() => {
            setActiveTab('payments');
            setPaymentSubTab('notifications');
          }}
          className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
            activeTab === 'payments' && paymentSubTab === 'notifications'
              ? 'bg-amber-950/30 border-amber-500/60 shadow-md'
              : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Bell className="w-3 h-3" />
              <span>New Transfers</span>
            </span>
            {pendingPayments.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </span>
          <div className="text-xl font-bold text-amber-300 mt-1 font-mono">{pendingPayments.length}</div>
          <span className="text-[10px] text-slate-400">{resolvedPayments.length} resolved</span>
        </div>

        {/* Metric 2: Suggestions */}
        <div
          onClick={() => setActiveTab('suggestions')}
          className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
            activeTab === 'suggestions'
              ? 'bg-amber-950/30 border-amber-500/60 shadow-md'
              : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1">
            <Lightbulb className="w-3 h-3" />
            <span>Suggestions</span>
          </span>
          <div className="text-xl font-bold text-amber-300 mt-1 font-mono">{suggestionTickets.length}</div>
          <span className="text-[10px] text-slate-400">
            {suggestionTickets.filter((t) => t.isRedirectedToOwner).length} forwarded
          </span>
        </div>

        {/* Metric 3: Complaints */}
        <div
          onClick={() => setActiveTab('complaints')}
          className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
            activeTab === 'complaints'
              ? 'bg-rose-950/30 border-rose-500/60 shadow-md'
              : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400 font-bold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            <span>Complaints</span>
          </span>
          <div className="text-xl font-bold text-rose-300 mt-1 font-mono">{complaintTickets.length}</div>
          <span className="text-[10px] text-slate-400">
            {complaintTickets.filter((t) => t.status === 'pending').length} unaddressed
          </span>
        </div>

        {/* Metric 4: Feedback */}
        <div
          onClick={() => setActiveTab('feedback')}
          className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
            activeTab === 'feedback'
              ? 'bg-cyan-950/30 border-cyan-500/60 shadow-md'
              : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            <span>Inquiries</span>
          </span>
          <div className="text-xl font-bold text-cyan-300 mt-1 font-mono">{feedbackTickets.length}</div>
          <span className="text-[10px] text-slate-400">General feedback</span>
        </div>

        {/* Metric 5: Admins */}
        <div
          onClick={() => setActiveTab('admins')}
          className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
            activeTab === 'admins'
              ? 'bg-purple-950/30 border-purple-500/60 shadow-md'
              : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-bold flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            <span>Admins</span>
          </span>
          <div className="text-xl font-bold text-purple-300 mt-1 font-mono">
            {adminsList.length > 0 ? adminsList.length : 1}
          </div>
          <span className="text-[10px] text-slate-400">With permissions</span>
        </div>

        {/* Metric 6: Registered Users */}
        <div
          onClick={() => setActiveTab('users')}
          className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
            activeTab === 'users'
              ? 'bg-indigo-950/30 border-indigo-500/60 shadow-md'
              : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>Users</span>
          </span>
          <div className="text-xl font-bold text-indigo-300 mt-1 font-mono">{users.length}</div>
          <span className="text-[10px] text-slate-400">UID Directory</span>
        </div>
      </div>
      )}

      {/* Main Distinct Tab Navigation Bar (Separating each feature into distinct tabs) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800 text-xs">
        {availableAdminTabs.map((tab) => {
          const TabIcon = {
            payments: CreditCard,
            suggestions: Lightbulb,
            complaints: AlertTriangle,
            feedback: MessageSquare,
            resolved: CheckCheck,
            admins: ShieldCheck,
            users: Users,
          }[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-indigo-950/80 text-indigo-200 border border-indigo-500/50 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <TabIcon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.id === 'payments' && pendingPayments.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-full font-mono font-bold">
                  {pendingPayments.length}
                </span>
              )}
              {tab.id === 'resolved' && (
                <span className="text-[10px] px-2 py-0.5 bg-emerald-950 border border-emerald-700/50 rounded-full font-mono text-emerald-300">
                  {resolvedPayments.length + tickets.filter((ticket) => ticket.status === 'resolved').length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Global Filter Bar for Current Tab */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            activeTab === 'payments'
              ? 'Search transfers by Depositor, Bank, Reference code, or User UID...'
              : activeTab === 'suggestions'
              ? 'Search suggestions by subject, message, or user UID...'
              : activeTab === 'complaints'
              ? 'Search complaints by user issue, subject, or user UID...'
              : activeTab === 'feedback'
              ? 'Search feedback & inquiries by user message or UID...'
              : activeTab === 'admins'
              ? 'Search administrators by email, name, or UID...'
              : activeTab === 'resolved'
              ? 'Search resolved issues and verified payments...'
              : 'Search registered accounts by UID, email, or display name...'
          }
          className="w-full bg-slate-900/80 border border-slate-800 focus:border-cyan-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition-all shadow-inner"
        />
      </div>

      {/* ============================================================== */}
      {activeTab === 'resolved' && (
        <section className="space-y-5">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCheck className="w-5 h-5 text-emerald-400" />
              Resolved
            </h3>
            <p className="text-xs text-slate-400 mt-1">Resolved support issues and verified payment records are archived here.</p>
          </div>
          {(isSuperAdmin || currentAdminPerms.viewTransactions || currentAdminPerms.receiveTransactionNotices) && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-emerald-300">Verified payments ({resolvedPayments.length})</h4>
              {resolvedPayments.map((payment) => (
                <article key={payment.id} className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-950/20 text-xs">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong className="text-white">{payment.formattedAmount} · {payment.senderName}</strong>
                    <span className="text-emerald-300">Verified</span>
                  </div>
                  <p className="text-slate-400 mt-1">Reference: {payment.paymentRef || 'N/A'} · UID: {payment.userId}</p>
                </article>
              ))}
              {resolvedPayments.length === 0 && <p className="text-xs text-slate-500">No verified payments.</p>}
            </div>
          )}
          {(isSuperAdmin || currentAdminPerms.answerComplaints || currentAdminPerms.redirectSuggestions) && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-cyan-300">Resolved issues ({resolvedTickets.length})</h4>
              {resolvedTickets.map((ticket) => (
                <article key={ticket.id} className="p-3 rounded-xl border border-cyan-500/20 bg-slate-900/70 text-xs">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong className="text-white">{ticket.subject}</strong>
                    <span className="text-emerald-300">Resolved · {ticket.type}</span>
                  </div>
                  <p className="text-slate-300 mt-1 whitespace-pre-wrap break-words">{ticket.message}</p>
                  <p className="text-slate-500 mt-2">
                    UID: {ticket.userId}
                    {canViewFullUserInfo ? ` · ${ticket.userEmail}` : ''}
                  </p>
                </article>
              ))}
              {resolvedTickets.length === 0 && <p className="text-xs text-slate-500">No resolved issues.</p>}
            </div>
          )}
        </section>
      )}

      {/* ============================================================== */}
      {/* SECTION 1: BANK TRANSFER VERIFICATION QUEUE                    */}
      {/* (WITH SEPARATE PLACES FOR NEW NOTIFICATIONS & RESOLVED TRANS)  */}
      {/* ============================================================== */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          {/* Permission check: viewTransactions */}
          {!isSuperAdmin && !currentAdminPerms.viewTransactions && !currentAdminPerms.receiveTransactionNotices ? (
            <div className="py-12 px-6 rounded-2xl bg-slate-900/80 border border-rose-500/40 text-center space-y-2">
              <Lock className="w-10 h-10 text-rose-400 mx-auto" />
              <h3 className="text-base font-bold text-white">Access Restricted: View Transactions Disabled</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Your administrator account does not possess permission to view financial transactions or the bank transfer queue. Please contact the primary superadmin to request access.
              </p>
            </div>
          ) : (
            <>
              {/* Bank Transfer Sub-Navigation: Notifications (Pending) vs Resolved */}
              <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-3">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPaymentSubTab('notifications')}
                    className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      paymentSubTab === 'notifications'
                        ? 'bg-amber-500/20 text-amber-200 border border-amber-500/50 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5 text-amber-400" />
                    <span>New Notifications & Pending Queue</span>
                    <span className="text-[10px] px-2 py-0.5 bg-amber-950 text-amber-300 rounded-full font-mono font-bold">
                      {pendingPayments.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setPaymentSubTab('resolved')}
                    className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      paymentSubTab === 'resolved'
                        ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/50 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Resolved & Verified Transactions</span>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-950 text-emerald-300 rounded-full font-mono font-bold">
                      {resolvedPayments.length}
                    </span>
                  </button>
                </div>

                <button
                  onClick={loadPayments}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-mono text-cyan-300 rounded-lg border border-slate-700 transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingPayments ? 'animate-spin' : ''}`} />
                  <span>Refresh Queue</span>
                </button>
              </div>

              {loadingPayments ? (
                <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center bg-slate-900/40 border border-slate-800 rounded-2xl">
                  <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
                  <p className="text-xs">Loading payment transactions...</p>
                </div>
              ) : activePaymentsList.length === 0 ? (
                <div className="py-16 text-center text-slate-400 bg-slate-900/40 border border-slate-800 rounded-2xl space-y-2 p-6">
                  <CreditCard className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-sm font-medium text-white">
                    {paymentSubTab === 'notifications'
                      ? 'No new transfer notifications pending'
                      : 'No resolved transactions yet'}
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {paymentSubTab === 'notifications'
                      ? 'When users transfer funds via bank and enter their depositor name and reference, instant alerts will appear here.'
                      : 'Approved bank transactions and their audit trail will be archived in this section.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activePaymentsList.map((p) => {
                    const isPending = p.status === 'pending';
                    const confirmEmailSubject = `Payment Confirmed - Vault X Upgrade (UID: ${p.userId})`;
                    const confirmEmailBody = `Dear ${p.senderName},\n\nYour bank transfer of ${p.formattedAmount} via ${p.bankUsed} has been confirmed by our administrative team!\n\nYour extra credential slots and vault duration are now active on your account (UID: ${p.userId}).\n\nThank you for choosing Vault X.\nQuantum-Resistant Isolated Storage`;
                    const gmailConfirmUrl = p.userEmail
                      ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(p.userEmail)}&su=${encodeURIComponent(confirmEmailSubject)}&body=${encodeURIComponent(confirmEmailBody)}`
                      : '';

                    // Permission 8: notify primary admin
                    const notifyAdminSubject = `[Purchase Notice] ${p.senderName} (${p.formattedAmount}) via ${p.bankUsed} - UID: ${p.userId}`;
                    const notifyAdminBody = `Hello Faith,\n\nA new purchase transaction has been checked and verified for notification by ${user?.email || 'Admin'}.\n\nUser UID: ${p.userId}\nUser Email: ${p.userEmail}\nDepositor Name: ${p.senderName}\nBank: ${p.bankUsed}\nAmount: ${p.formattedAmount}\nReference / Memo: ${p.paymentRef}\nSubmitted At: ${p.submittedAt}\n\nPlease audit and verify this purchase.\n-- Vault X Admin Team`;
                    const gmailNotifyAdminUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(ADMIN_EMAIL)}&su=${encodeURIComponent(notifyAdminSubject)}&body=${encodeURIComponent(notifyAdminBody)}`;

                    return (
                      <div
                        key={p.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                          isPending
                            ? 'bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-950/20'
                            : 'bg-emerald-950/20 border-emerald-500/30'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                          <div className="flex items-center space-x-2.5">
                            <span className={`p-2 rounded-xl border ${
                              isPending ? 'bg-amber-950 text-amber-400 border-amber-500/40' : 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
                            }`}>
                              <CreditCard className="w-4 h-4" />
                            </span>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-mono font-bold text-white">
                                  {p.formattedAmount} &bull; {p.senderName}
                                </span>
                                <span className="text-xs text-cyan-300 font-mono">via {p.bankUsed}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                                Submitted: {p.submittedAt}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <span
                              className={`text-[10px] font-mono px-2.5 py-1 rounded-full border font-bold ${
                                isPending
                                  ? 'bg-amber-950 text-amber-300 border-amber-500/50 animate-pulse'
                                  : 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                              }`}
                            >
                              {isPending ? '🔔 PENDING APPROVAL' : '✅ VERIFIED & ACTIVE'}
                            </span>
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="mt-3 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs font-mono grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase">User UID:</span>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              <span className="text-cyan-300 font-bold truncate max-w-[130px]" title={p.userId}>
                                {p.userId}
                              </span>
                              <button
                                onClick={() => handleCopyUid(p.userId)}
                                className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                                title="Copy UID"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase">User Email:</span>
                            <span className="text-white font-medium truncate block mt-0.5" title={p.userEmail}>
                              {p.userEmail || 'Not specified'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase">Depositor Name:</span>
                            <span className="text-emerald-300 font-bold block mt-0.5">
                              {p.senderName}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase">Bank Name:</span>
                            <span className="text-cyan-200 block mt-0.5">
                              {p.bankUsed}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2.5 p-2.5 bg-slate-950/60 rounded-xl border border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono gap-2">
                          <div className="flex items-center space-x-2 text-slate-400">
                            <span className="text-slate-500 uppercase text-[10px]">Narration Memo:</span>
                            <span className="text-amber-300 font-bold">{p.paymentRef || 'N/A'}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-sans">
                            Requested Plan:{' '}
                            <strong className="text-cyan-300 font-mono">
                              {p.planName || (p.amount >= 15000 ? 'Yearly Plan' : p.amount >= 8000 ? 'Monthly Plan' : '2-Weekly Plan')}
                            </strong>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1.5">
                            {gmailConfirmUrl && (
                              <a
                                href={gmailConfirmUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-sans transition-all inline-flex items-center gap-1.5 border border-slate-700"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                <span>Email User Confirmation</span>
                                <ExternalLink className="w-3 h-3 opacity-70" />
                              </a>
                            )}

                            {/* Permission 8: Check & Notify Primary Admin of purchase */}
                            {(isSuperAdmin || currentAdminPerms.receiveTransactionNotices) && (
                              <a
                                href={gmailNotifyAdminUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs px-2.5 py-1.5 rounded-lg bg-purple-950/80 hover:bg-purple-900 text-purple-200 font-sans transition-all inline-flex items-center gap-1.5 border border-purple-700/60"
                                title="Check transaction and notify primary admin Faith Oluwole"
                              >
                                <Send className="w-3.5 h-3.5 text-purple-400" />
                                <span>Notify Primary Admin of Purchase</span>
                              </a>
                            )}
                          </div>

                          {isPending ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Permission 2: Give slots / approve */}
                              <button
                                onClick={() => handleApproveServerPayment(p, 'biweekly')}
                                disabled={!isSuperAdmin && !currentAdminPerms.giveSlots}
                                className="text-xs px-3 py-1.5 rounded-lg bg-cyan-900/90 hover:bg-cyan-800 disabled:opacity-40 disabled:cursor-not-allowed text-cyan-200 border border-cyan-600/60 font-bold shadow-md transition-all cursor-pointer flex items-center space-x-1"
                                title="Approve 2-Weekly Plan: 14 Days, +20 slots (30 total), ₦2,000"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                                <span>Approve 2-Wk (14d)</span>
                              </button>
                              <button
                                onClick={() => handleApproveServerPayment(p, 'monthly')}
                                disabled={!isSuperAdmin && !currentAdminPerms.giveSlots}
                                className="text-xs px-3 py-1.5 rounded-lg bg-indigo-900/90 hover:bg-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed text-indigo-200 border border-indigo-600/60 font-bold shadow-md transition-all cursor-pointer flex items-center space-x-1"
                                title="Approve Monthly Plan: 30 Days, 50 slots total, ₦8,000"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                                <span>Approve Monthly (30d)</span>
                              </button>
                              <button
                                onClick={() => handleApproveServerPayment(p, 'yearly')}
                                disabled={!isSuperAdmin && !currentAdminPerms.giveSlots}
                                className="text-xs px-3 py-1.5 rounded-lg bg-purple-900/90 hover:bg-purple-800 disabled:opacity-40 disabled:cursor-not-allowed text-purple-200 border border-purple-600/60 font-bold shadow-md transition-all cursor-pointer flex items-center space-x-1"
                                title="Approve Yearly Plan: 365 Days, Unlimited slots, ₦15,000"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                                <span>Approve Yearly (365d)</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2 text-xs text-emerald-400 font-mono">
                              <CheckCheck className="w-4 h-4 text-emerald-400" />
                              <span>Approved & Recorded in Audit Archive</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 2: SUGGESTIONS (SEPARATE DEDICATED TAB)                 */}
      {/* ============================================================== */}
      {activeTab === 'suggestions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-3">
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-amber-950 border border-amber-500/40 text-amber-400">
                <Lightbulb className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">User Suggestions Queue</h3>
                <p className="text-[11px] text-slate-400">
                  Feature suggestions and recommendations submitted by vault users
                </p>
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-1 text-xs self-start sm:self-auto font-mono">
              <span className="text-slate-500 text-[10px] uppercase mr-1">Status:</span>
              {(['all', 'pending', 'reviewed', 'resolved'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setTicketStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md text-[11px] capitalize cursor-pointer transition-colors ${
                    ticketStatusFilter === st
                      ? 'bg-amber-950 border border-amber-500/50 text-amber-300 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {loadingTickets ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center bg-slate-900/40 border border-slate-800 rounded-2xl">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mb-3" />
              <p className="text-xs">Loading suggestions...</p>
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="py-16 text-center text-slate-400 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
              <Lightbulb className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-white">No suggestions match current filter</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                User recommendations for new features and vault improvements will be indexed here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSuggestions.map((t) => {
                const replySubject = `Re: [Clockin Vault Suggestion] ${t.subject}`;
                const gmailReplyUrl = t.userEmail
                  ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(t.userEmail)}&su=${encodeURIComponent(replySubject)}&body=${encodeURIComponent(`Hi ${t.userName || 'there'},\n\nThank you for your suggestion regarding:\n"${t.message}"\n\nOur product engineering team has reviewed this proposal...\n\n`)}`
                  : '';

                return (
                  <div
                    key={t.id}
                    className="p-4 sm:p-5 rounded-2xl border border-amber-500/30 bg-amber-950/20 transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center space-x-2.5">
                        <span className="p-2 rounded-xl bg-amber-950 text-amber-400 border border-amber-500/40">
                          <Lightbulb className="w-4 h-4" />
                        </span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-bold text-white tracking-tight">
                              {t.subject}
                            </span>
                            {t.isRedirectedToOwner && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 border border-purple-500/60 text-purple-300 font-mono font-bold">
                                🚀 FORWARDED TO OWNER
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                            Submitted: {formatDate(t.createdAt)} &bull; User: {t.userName || 'Anonymous'}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-mono px-2.5 py-1 rounded-full border font-bold self-start sm:self-auto ${
                          t.status === 'resolved'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                            : t.status === 'reviewed'
                            ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                            : 'bg-amber-950 text-amber-300 border-amber-500/50 animate-pulse'
                        }`}
                      >
                        {t.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Message Body */}
                    <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                      {t.message}
                    </div>

                    {t.adminNotes && (
                      <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-800/40 text-xs text-purple-200 font-mono flex items-start gap-2">
                        <Share2 className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <strong className="text-purple-300">Admin Forwarding Note:</strong> {t.adminNotes}
                          {t.redirectedBy && (
                            <span className="text-[10px] text-purple-400 block mt-0.5">by {t.redirectedBy}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Metadata & Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/60 text-xs font-mono">
                      <div className="flex items-center space-x-3 text-slate-400">
                        <div className="flex items-center space-x-1">
                          <span className="text-slate-500">UID:</span>
                          <span className="text-cyan-300 font-bold">{t.userId}</span>
                          <button
                            onClick={() => handleCopyUid(t.userId)}
                            className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                            title="Copy UID"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <span>&bull;</span>
                        <div className="flex items-center space-x-1 text-slate-300">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{t.userEmail}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 flex-wrap">
                        {/* Permission 4: Redirect Suggestion to Primary Admin */}
                        {(isSuperAdmin || currentAdminPerms.redirectSuggestions) && (
                          <button
                            onClick={() => handleOpenRedirectModal(t)}
                            className="px-2.5 py-1 bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-600/60 rounded-lg transition-colors cursor-pointer flex items-center gap-1 font-sans text-xs font-bold"
                            title="Redirect important suggestion to primary administrator (Faith Oluwole)"
                          >
                            <Share2 className="w-3 h-3 text-purple-400" />
                            <span>Redirect to Admin</span>
                          </button>
                        )}

                        {gmailReplyUrl && (
                          <a
                            href={gmailReplyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 font-sans text-xs"
                          >
                            <Send className="w-3 h-3" />
                            <span>Reply via Gmail</span>
                          </a>
                        )}

                        {/* Permission 3: Answer / update complaints and tickets */}
                        {(isSuperAdmin || currentAdminPerms.answerComplaints) && (
                          <>
                            {t.status !== 'reviewed' && (
                              <button
                                onClick={() => handleTicketStatus(t.id, 'reviewed')}
                                className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 rounded-lg transition-colors cursor-pointer"
                              >
                                Mark Reviewed
                              </button>
                            )}
                            {t.status !== 'resolved' ? (
                              <button
                                onClick={() => handleTicketStatus(t.id, 'resolved')}
                                className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 rounded-lg transition-colors cursor-pointer font-bold"
                              >
                                Mark Resolved
                              </button>
                            ) : (
                              <button
                                onClick={() => handleTicketStatus(t.id, 'pending')}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                              >
                                Reopen
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 3: COMPLAINTS (SEPARATE DEDICATED TAB)                  */}
      {/* ============================================================== */}
      {activeTab === 'complaints' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-3">
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-rose-950 border border-rose-500/40 text-rose-400">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">Customer Complaints Queue</h3>
                <p className="text-[11px] text-slate-400">
                  Issues, errors, and grievances submitted by users requiring prompt resolution
                </p>
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-1 text-xs self-start sm:self-auto font-mono">
              <span className="text-slate-500 text-[10px] uppercase mr-1">Status:</span>
              {(['all', 'pending', 'reviewed', 'resolved'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setTicketStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md text-[11px] capitalize cursor-pointer transition-colors ${
                    ticketStatusFilter === st
                      ? 'bg-rose-950 border border-rose-500/50 text-rose-300 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {loadingTickets ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center bg-slate-900/40 border border-slate-800 rounded-2xl">
              <RefreshCw className="w-8 h-8 text-rose-400 animate-spin mb-3" />
              <p className="text-xs">Loading complaints...</p>
            </div>
          ) : filteredComplaints.length === 0 ? (
            <div className="py-16 text-center text-slate-400 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-white">No complaints found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No open user complaints currently match the selected status filter.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredComplaints.map((t) => {
                const replySubject = `Urgent Re: [Clockin Vault Complaint Resolution] ${t.subject}`;
                const gmailReplyUrl = t.userEmail
                  ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(t.userEmail)}&su=${encodeURIComponent(replySubject)}&body=${encodeURIComponent(`Dear ${t.userName || 'Valued User'},\n\nWe have received your complaint regarding:\n"${t.message}"\n\nOur administrative team has addressed the issue as follows...\n\nSincerely,\nClockin Vault Support`)}`
                  : '';

                return (
                  <div
                    key={t.id}
                    className="p-4 sm:p-5 rounded-2xl border border-rose-500/30 bg-rose-950/20 transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center space-x-2.5">
                        <span className="p-2 rounded-xl bg-rose-950 text-rose-400 border border-rose-500/40">
                          <AlertTriangle className="w-4 h-4" />
                        </span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300">
                              COMPLAINT
                            </span>
                            <span className="text-sm font-bold text-white tracking-tight">
                              {t.subject}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                            Submitted: {formatDate(t.createdAt)} &bull; User: {t.userName || 'Anonymous'}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-mono px-2.5 py-1 rounded-full border font-bold self-start sm:self-auto ${
                          t.status === 'resolved'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                            : t.status === 'reviewed'
                            ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                            : 'bg-rose-950 text-rose-300 border-rose-500/50 animate-pulse'
                        }`}
                      >
                        {t.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Message Body */}
                    <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-rose-100 leading-relaxed font-sans whitespace-pre-wrap">
                      {t.message}
                    </div>

                    {/* Metadata & Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/60 text-xs font-mono">
                      <div className="flex items-center space-x-3 text-slate-400">
                        <div className="flex items-center space-x-1">
                          <span className="text-slate-500">UID:</span>
                          <span className="text-cyan-300 font-bold">{t.userId}</span>
                          <button
                            onClick={() => handleCopyUid(t.userId)}
                            className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                            title="Copy UID"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <span>&bull;</span>
                        <div className="flex items-center space-x-1 text-slate-300">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{t.userEmail}</span>
                        </div>
                      </div>

                      {/* Permission 3: Answer complaints */}
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        {gmailReplyUrl && (
                          <a
                            href={gmailReplyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-700/60 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 font-sans text-xs font-bold"
                          >
                            <Send className="w-3 h-3" />
                            <span>Answer Complaint (Gmail)</span>
                          </a>
                        )}

                        {(isSuperAdmin || currentAdminPerms.answerComplaints) ? (
                          <>
                            {t.status !== 'reviewed' && (
                              <button
                                onClick={() => handleTicketStatus(t.id, 'reviewed')}
                                className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 rounded-lg transition-colors cursor-pointer"
                              >
                                Mark Reviewed
                              </button>
                            )}
                            {t.status !== 'resolved' ? (
                              <button
                                onClick={() => handleTicketStatus(t.id, 'resolved')}
                                className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 rounded-lg transition-colors cursor-pointer font-bold"
                              >
                                Mark Resolved
                              </button>
                            ) : (
                              <button
                                onClick={() => handleTicketStatus(t.id, 'pending')}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                              >
                                Reopen
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">
                            Answering complaints disabled per role
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 4: FEEDBACK & INQUIRIES (SEPARATE DEDICATED TAB)        */}
      {/* ============================================================== */}
      {activeTab === 'feedback' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-3">
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-400">
                <MessageSquare className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">General Feedback & Inquiries Queue</h3>
                <p className="text-[11px] text-slate-400">
                  User questions, feedback, and general support conversations
                </p>
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-1 text-xs self-start sm:self-auto font-mono">
              <span className="text-slate-500 text-[10px] uppercase mr-1">Status:</span>
              {(['all', 'pending', 'reviewed', 'resolved'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setTicketStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md text-[11px] capitalize cursor-pointer transition-colors ${
                    ticketStatusFilter === st
                      ? 'bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {loadingTickets ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center bg-slate-900/40 border border-slate-800 rounded-2xl">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
              <p className="text-xs">Loading feedback & inquiries...</p>
            </div>
          ) : filteredFeedback.length === 0 ? (
            <div className="py-16 text-center text-slate-400 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
              <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-white">No items match current filter</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                General inquiries and user feedback messages will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFeedback.map((t) => {
                const replySubject = `Re: [Clockin Vault Inquiries] ${t.subject}`;
                const gmailReplyUrl = t.userEmail
                  ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(t.userEmail)}&su=${encodeURIComponent(replySubject)}&body=${encodeURIComponent(`Hi ${t.userName || 'there'},\n\nThank you for contacting Clockin Vault regarding:\n"${t.message}"\n\n`)}`
                  : '';

                return (
                  <div
                    key={t.id}
                    className="p-4 sm:p-5 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center space-x-2.5">
                        <span className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-500/40">
                          <MessageSquare className="w-4 h-4" />
                        </span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-bold text-white tracking-tight">
                              {t.subject}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                            Submitted: {formatDate(t.createdAt)} &bull; User: {t.userName || 'Anonymous'}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-mono px-2.5 py-1 rounded-full border font-bold self-start sm:self-auto ${
                          t.status === 'resolved'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                            : t.status === 'reviewed'
                            ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                            : 'bg-amber-950 text-amber-300 border-amber-500/50 animate-pulse'
                        }`}
                      >
                        {t.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                      {t.message}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/60 text-xs font-mono">
                      <div className="flex items-center space-x-3 text-slate-400">
                        <div className="flex items-center space-x-1">
                          <span className="text-slate-500">UID:</span>
                          <span className="text-cyan-300 font-bold">{t.userId}</span>
                          <button
                            onClick={() => handleCopyUid(t.userId)}
                            className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                            title="Copy UID"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <span>&bull;</span>
                        <div className="flex items-center space-x-1 text-slate-300">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{t.userEmail}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 flex-wrap">
                        {gmailReplyUrl && (
                          <a
                            href={gmailReplyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 font-sans text-xs"
                          >
                            <Send className="w-3 h-3" />
                            <span>Reply via Gmail</span>
                          </a>
                        )}

                        {(isSuperAdmin || currentAdminPerms.answerComplaints) && (
                          <>
                            {t.status !== 'reviewed' && (
                              <button
                                onClick={() => handleTicketStatus(t.id, 'reviewed')}
                                className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 rounded-lg transition-colors cursor-pointer"
                              >
                                Mark Reviewed
                              </button>
                            )}
                            {t.status !== 'resolved' ? (
                              <button
                                onClick={() => handleTicketStatus(t.id, 'resolved')}
                                className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 rounded-lg transition-colors cursor-pointer font-bold"
                              >
                                Mark Resolved
                              </button>
                            ) : (
                              <button
                                onClick={() => handleTicketStatus(t.id, 'pending')}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                              >
                                Reopen
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 5: APPOINT & MANAGE ADMINS (SEPARATE DEDICATED PAGE)    */}
      {/* ============================================================== */}
      {activeTab === 'admins' && (
        <div className="space-y-6">
          {/* Permission 7: Appoint New Admin Form Card */}
          <div className="bg-gradient-to-b from-purple-950/40 via-slate-900 to-indigo-950/40 border border-purple-500/40 rounded-2xl p-5 sm:p-6 shadow-xl shadow-purple-950/30 tech-corners">
            <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 bg-purple-900/60 border border-purple-500/40 rounded-xl text-purple-300">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <span>Appoint New Administrator</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 border border-purple-500/50 text-purple-300 font-mono">
                      Via UID or Account Email
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Appoint any registered user through their unique verification UID or the email account used for sign in (Google or Email).
                  </p>
                </div>
              </div>

              {(!isSuperAdmin && !currentAdminPerms.addAdmins) && (
                <span className="text-xs text-rose-400 font-mono flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Requires 'Add Admins' permission</span>
                </span>
              )}
            </div>

            {appointSuccessNotice && (
              <div className="my-3 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center space-x-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{appointSuccessNotice}</span>
              </div>
            )}

            <form onSubmit={handleAppointAdmin} className="mt-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Shield className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    disabled={!isSuperAdmin && !currentAdminPerms.addAdmins}
                    value={newAdminIdentifier}
                    onChange={(e) => setNewAdminIdentifier(e.target.value)}
                    placeholder="Enter registered User UID (e.g. 5qX8...) or Account Email (Google or Email)..."
                    className="w-full bg-slate-950 border border-purple-500/30 focus:border-purple-400 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAppointingAdmin || (!isSuperAdmin && !currentAdminPerms.addAdmins)}
                  className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-purple-950/50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isAppointingAdmin ? 'Appointing...' : 'Appoint Administrator'}</span>
                </button>
              </div>

              {/* Initial Permissions Configuration Toggle */}
              {(isSuperAdmin || currentAdminPerms.addAdmins) && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowPermsConfigInForm(!showPermsConfigInForm)}
                    className="inline-flex items-center space-x-1.5 text-xs font-mono text-purple-300 hover:text-purple-200 cursor-pointer pt-1"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>
                      {showPermsConfigInForm ? 'Hide' : 'Configure'} Initial Granular Permissions (8 Rules)
                    </span>
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showPermsConfigInForm ? 'rotate-90' : ''}`} />
                  </button>

                  {showPermsConfigInForm && (
                    <div className="mt-3 p-4 bg-slate-950/90 border border-purple-500/30 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-3 text-xs animate-in fade-in">
                      <label className="flex items-start space-x-2 cursor-pointer p-2 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700">
                        <input
                          type="checkbox"
                          checked={newAdminPerms.viewFullUserInfo}
                          onChange={(e) => setNewAdminPerms({ ...newAdminPerms, viewFullUserInfo: e.target.checked })}
                          className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                          <strong className="text-white block font-sans">1. View Full Registered User Info</strong>
                          <span className="text-[11px] text-slate-400 block font-sans">
                            {newAdminPerms.viewFullUserInfo ? 'Full email & names visible' : 'UID-only mode (names & emails masked)'}
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start space-x-2 cursor-pointer p-2 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700">
                        <input
                          type="checkbox"
                          checked={newAdminPerms.giveSlots}
                          onChange={(e) => setNewAdminPerms({ ...newAdminPerms, giveSlots: e.target.checked })}
                          className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                          <strong className="text-white block font-sans">2. Ability to Give Slots</strong>
                          <span className="text-[11px] text-slate-400 block font-sans">Approve 2-Wk, Monthly & Yearly slot plans</span>
                        </div>
                      </label>

                      <label className="flex items-start space-x-2 cursor-pointer p-2 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700">
                        <input
                          type="checkbox"
                          checked={newAdminPerms.answerComplaints}
                          onChange={(e) => setNewAdminPerms({ ...newAdminPerms, answerComplaints: e.target.checked })}
                          className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                          <strong className="text-white block font-sans">3. Ability to Answer Complaints</strong>
                          <span className="text-[11px] text-slate-400 block font-sans">Resolve issues & reply via Gmail</span>
                        </div>
                      </label>

                      <label className="flex items-start space-x-2 cursor-pointer p-2 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700">
                        <input
                          type="checkbox"
                          checked={newAdminPerms.redirectSuggestions}
                          onChange={(e) => setNewAdminPerms({ ...newAdminPerms, redirectSuggestions: e.target.checked })}
                          className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                          <strong className="text-white block font-sans">4. Ability to Redirect Suggestions</strong>
                          <span className="text-[11px] text-slate-400 block font-sans">Forward strategic suggestions to primary admin</span>
                        </div>
                      </label>

                      <label className="flex items-start space-x-2 cursor-pointer p-2 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700">
                        <input
                          type="checkbox"
                          checked={newAdminPerms.viewTransactions}
                          onChange={(e) => setNewAdminPerms({ ...newAdminPerms, viewTransactions: e.target.checked })}
                          className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                          <strong className="text-white block font-sans">5. Ability to View Transactions</strong>
                          <span className="text-[11px] text-slate-400 block font-sans">Access bank transfer queues & audit archive</span>
                        </div>
                      </label>

                      <label className="flex items-start space-x-2 cursor-pointer p-2 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700">
                        <input
                          type="checkbox"
                          checked={newAdminPerms.banUsers}
                          onChange={(e) => setNewAdminPerms({ ...newAdminPerms, banUsers: e.target.checked })}
                          className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                          <strong className="text-white block font-sans">6. Ability to Ban Users</strong>
                          <span className="text-[11px] text-slate-400 block font-sans">Ban suspicious users (unbanning is strictly superadmin role)</span>
                        </div>
                      </label>

                      <label className="flex items-start space-x-2 cursor-pointer p-2 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700">
                        <input
                          type="checkbox"
                          checked={newAdminPerms.addAdmins}
                          onChange={(e) => setNewAdminPerms({ ...newAdminPerms, addAdmins: e.target.checked })}
                          className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                          <strong className="text-white block font-sans">7. Ability to Add Admins</strong>
                          <span className="text-[11px] text-slate-400 block font-sans">Appoint other admins & edit permissions</span>
                        </div>
                      </label>

                      <label className="flex items-start space-x-2 cursor-pointer p-2 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700">
                        <input
                          type="checkbox"
                          checked={newAdminPerms.receiveTransactionNotices}
                          onChange={(e) => setNewAdminPerms({ ...newAdminPerms, receiveTransactionNotices: e.target.checked })}
                          className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                          <strong className="text-white block font-sans">8. Receive Transaction Notices</strong>
                          <span className="text-[11px] text-slate-400 block font-sans">Check alerts and notify primary admin of purchases</span>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>

          {/* Current Administrators Directory */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <span>Authorized Administrators & Granted Permissions</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Manage appointed staff, view active authority, and edit granular permissions
                </p>
              </div>

              <span className="text-xs font-mono px-2.5 py-1 bg-purple-950 border border-purple-700/60 rounded-full text-purple-300">
                {adminsList.length > 0 ? adminsList.length : 1} Admin{adminsList.length === 1 ? '' : 's'} Total
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Primary Superadmin Owner Card */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-purple-500/50 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-purple-950/50">
                      👑
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-xs">Faith Oluwole (Primary Owner)</span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-950 border border-purple-500/60 text-purple-300 font-mono font-bold">
                          SUPERADMIN
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono block mt-0.5">
                        {ADMIN_EMAIL}
                      </span>
                    </div>
                  </div>
                </div>

                {/* All 8 Superadmin Powers Badge */}
                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                  <span className="px-2 py-1 rounded bg-purple-950/50 text-purple-300 border border-purple-800/40">✓ Full User Info</span>
                  <span className="px-2 py-1 rounded bg-purple-950/50 text-purple-300 border border-purple-800/40">✓ Give Slots</span>
                  <span className="px-2 py-1 rounded bg-purple-950/50 text-purple-300 border border-purple-800/40">✓ Answer Complaints</span>
                  <span className="px-2 py-1 rounded bg-purple-950/50 text-purple-300 border border-purple-800/40">✓ Strategic Redirect</span>
                  <span className="px-2 py-1 rounded bg-purple-950/50 text-purple-300 border border-purple-800/40">✓ View Transactions</span>
                  <span className="px-2 py-1 rounded bg-purple-950/50 text-purple-300 border border-purple-800/40">✓ Ban & Unban (Sole)</span>
                  <span className="px-2 py-1 rounded bg-purple-950/50 text-purple-300 border border-purple-800/40">✓ Add Admins</span>
                  <span className="px-2 py-1 rounded bg-purple-950/50 text-purple-300 border border-purple-800/40">✓ Purchase Notices</span>
                </div>

                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                  <span>Role: Permanent Enclave Owner</span>
                  <span className="text-purple-300 font-bold">Protected</span>
                </div>
              </div>

              {/* Appointed Administrators */}
              {adminsList
                .filter((a) => a.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase())
                .map((admin) => {
                  const perms = admin.permissions || DEFAULT_APPOINTED_ADMIN_PERMISSIONS;

                  return (
                    <div
                      key={admin.userId}
                      className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-purple-500/40 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-700 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                            {(admin.displayName || admin.email || 'A')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-white text-xs truncate">
                                {admin.displayName || 'Appointed Admin'}
                              </span>
                              <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-500/50 text-indigo-300 font-mono">
                                APPOINTED
                              </span>
                            </div>
                            <span className="text-xs text-slate-400 font-mono block mt-0.5 truncate">
                              {admin.email}
                            </span>
                          </div>
                        </div>

                        {/* Revoke button */}
                        {(isSuperAdmin || currentAdminPerms.addAdmins) && (
                          <button
                            onClick={() => handleRevokeAdmin(admin.userId, admin.email)}
                            className="text-xs text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-950/40 transition-colors cursor-pointer flex items-center gap-1 font-mono text-[11px]"
                            title="Revoke Administrator Role"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Revoke</span>
                          </button>
                        )}
                      </div>

                      {/* Active Permissions Summary Grid */}
                      <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
                        <span className={`px-2 py-0.5 rounded border ${perms.viewFullUserInfo ? 'bg-indigo-950/60 text-indigo-200 border-indigo-800/40' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
                          {perms.viewFullUserInfo ? '✓ Full User Info' : '✗ UID-Only Mode'}
                        </span>
                        <span className={`px-2 py-0.5 rounded border ${perms.giveSlots ? 'bg-cyan-950/60 text-cyan-200 border-cyan-800/40' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
                          {perms.giveSlots ? '✓ Give Slots' : '✗ Give Slots'}
                        </span>
                        <span className={`px-2 py-0.5 rounded border ${perms.answerComplaints ? 'bg-rose-950/60 text-rose-200 border-rose-800/40' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
                          {perms.answerComplaints ? '✓ Answer Complaints' : '✗ Complaints'}
                        </span>
                        <span className={`px-2 py-0.5 rounded border ${perms.redirectSuggestions ? 'bg-amber-950/60 text-amber-200 border-amber-800/40' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
                          {perms.redirectSuggestions ? '✓ Redirect Suggest.' : '✗ Suggestions'}
                        </span>
                        <span className={`px-2 py-0.5 rounded border ${perms.viewTransactions ? 'bg-emerald-950/60 text-emerald-200 border-emerald-800/40' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
                          {perms.viewTransactions ? '✓ Transactions' : '✗ Transactions'}
                        </span>
                        <span className={`px-2 py-0.5 rounded border ${perms.banUsers ? 'bg-rose-950/60 text-rose-200 border-rose-800/40' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
                          {perms.banUsers ? '✓ Ban Users' : '✗ Ban Users'}
                        </span>
                        <span className={`px-2 py-0.5 rounded border ${perms.addAdmins ? 'bg-purple-950/60 text-purple-200 border-purple-800/40' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
                          {perms.addAdmins ? '✓ Add Admins' : '✗ Add Admins'}
                        </span>
                        <span className={`px-2 py-0.5 rounded border ${perms.receiveTransactionNotices ? 'bg-amber-950/60 text-amber-200 border-amber-800/40' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
                          {perms.receiveTransactionNotices ? '✓ Purchase Alerts' : '✗ Purchase Alerts'}
                        </span>
                      </div>

                      {/* Card Footer with Edit Permissions Button */}
                      <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] font-mono">
                        <div className="flex items-center space-x-1 text-slate-400">
                          <span className="text-slate-500">UID:</span>
                          <span className="text-cyan-300 truncate max-w-[100px]">{admin.userId}</span>
                          <button
                            onClick={() => handleCopyUid(admin.userId)}
                            className="text-slate-500 hover:text-white"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>

                        {(isSuperAdmin || currentAdminPerms.addAdmins) ? (
                          <button
                            onClick={() => handleOpenEditPermissions(admin)}
                            className="px-2.5 py-1 bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-600/60 rounded-lg transition-colors cursor-pointer flex items-center gap-1 font-sans text-xs font-bold"
                          >
                            <Settings className="w-3 h-3 text-purple-400" />
                            <span>Edit Permissions</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500">Added: {formatDate(admin.addedAt)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 6: REGISTERED ACCOUNTS & LIVE COUNTDOWNS DIRECTORY     */}
      {/* ============================================================== */}
      {activeTab === 'users' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-3">
          {/* Privacy Notice when viewing in UID-only mode */}
          {!canViewFullUserInfo && (
            <div className="p-3 bg-indigo-950/60 border-b border-indigo-800/40 text-xs text-indigo-200 flex items-center justify-between font-sans">
              <div className="flex items-center space-x-2">
                <EyeOff className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <span>
                  <strong>Restricted UID View Active:</strong> Per your appointed admin permissions, user email and personal identity details are masked. You have access to verification UIDs, capacity allotments, countdowns, and banning actions.
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-900 border border-indigo-700 text-indigo-300 uppercase">
                Privacy Enforced
              </span>
            </div>
          )}

          {loadingUsers ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
              <p className="text-xs">Loading registered users directory...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm font-medium">No users found</p>
              <p className="text-xs text-slate-500 mt-1">Users appear here automatically when they sign in.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-medium">
                  <tr>
                    <th className="py-3 px-4">User & Verification UID</th>
                    <th className="py-3 px-4">Account Email</th>
                    <th className="py-3 px-4">Plan & Capacity</th>
                    <th className="py-3 px-4">Admin Countdown (Hidden From User)</th>
                    <th className="py-3 px-4">Admin Actions & Controls</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4">Registered Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.map((u) => {
                    const isUserOwnerAdmin = isUserAdmin(u.email, u.userId);
                    const isUnrestrictedUser = isUserOwnerAdmin || u.plan === 'unlimited';
                    const isPaidUser = u.plan === 'paid';
                    const isBanned = Boolean(u.isBanned);

                    return (
                      <tr
                        key={u.userId}
                        className={`transition-colors ${isBanned ? 'bg-rose-950/20 hover:bg-rose-950/30' : 'hover:bg-slate-800/30'}`}
                      >
                        {/* User display & UID */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-start space-x-2.5">
                            {canViewFullUserInfo && u.photoURL ? (
                              <img
                                src={u.photoURL}
                                alt={u.displayName || 'User'}
                                className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-700 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center font-bold text-white text-xs flex-shrink-0">
                                {canViewFullUserInfo ? (u.displayName || u.email || 'U')[0].toUpperCase() : '🔒'}
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="font-semibold text-white block truncate">
                                {canViewFullUserInfo ? (u.displayName || 'Anonymous User') : `Protected User (${u.userId.slice(0, 6)}...)`}
                              </span>
                              {isUserOwnerAdmin && (
                                <span className="text-[10px] text-purple-400 font-mono font-medium block">👑 Administrator</span>
                              )}
                              {/* Prominent Verification UID */}
                              <div className="flex items-center space-x-1.5 mt-1 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-[10px] font-mono text-cyan-300">
                                <span className="text-slate-500">UID:</span>
                                <span className="truncate max-w-[120px]" title={u.userId}>
                                  {u.userId}
                                </span>
                                <button
                                  onClick={() => handleCopyUid(u.userId)}
                                  className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                                  title={`Copy UID: ${u.userId}`}
                                >
                                  {copiedUid === u.userId ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Email (Masked if viewFullUserInfo is false) */}
                        <td className="py-3.5 px-4 font-mono text-slate-300">
                          <div className="flex items-center space-x-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <span className="truncate max-w-[180px]">
                              {canViewFullUserInfo ? u.email : '•••••••• (Masked per Role)'}
                            </span>
                          </div>
                        </td>

                        {/* Plan & Capacity */}
                        <td className="py-3.5 px-4">
                          {isUserOwnerAdmin || isUnrestrictedUser ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/50 text-purple-300 font-bold">
                                <Sparkles className="w-3 h-3 text-purple-400" />
                                <span>UNLIMITED SLOTS</span>
                              </span>
                              <span className="text-[10px] text-purple-400/80 font-mono">👑 Permanent VIP</span>
                            </div>
                          ) : isPaidUser ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-bold">
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span>{u.maxCredentialSlots || 30} SLOTS TOTAL</span>
                              </span>
                              <span className="text-[10px] text-cyan-300 font-mono">
                                {u.planDuration ? getPlanOption(u.planDuration).name : 'Paid Plan'}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                                <span>FREE (10 SLOTS)</span>
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">Base Allocation</span>
                            </div>
                          )}
                        </td>

                        {/* Admin Countdown (Hidden From User UI) */}
                        <td className="py-3.5 px-4">
                          {(() => {
                            if (isUserOwnerAdmin || (u.plan === 'unlimited' && !u.expiresAt)) {
                              return (
                                <div className="flex flex-col gap-0.5 min-w-[180px]">
                                  <span className="inline-flex items-center space-x-1 text-[11px] font-mono text-purple-300 font-bold">
                                    <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                                    <span>Permanent (No Expiry)</span>
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono">Admin Owner Allotment</span>
                                </div>
                              );
                            }

                            if (u.expiresAt) {
                              const countdown = formatRemainingCountdown(u.expiresAt);
                              if (countdown.isExpired) {
                                return (
                                  <div className="flex flex-col gap-1 p-2 rounded-lg bg-rose-950/40 border border-rose-500/40 min-w-[210px]">
                                    <div className="flex items-center space-x-1.5 text-rose-300 font-mono font-bold text-xs">
                                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                                      <span>00d 00h 00m (EXPIRED)</span>
                                    </div>
                                    <div className="text-[10px] text-rose-200/80 font-sans leading-tight">
                                      Space reset to 0 extra slots. Slots 11+ view-only; first 10 slots editable.
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div className="flex flex-col gap-1 p-2 rounded-lg bg-slate-950/90 border border-cyan-500/40 shadow-sm min-w-[210px]">
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span className="inline-flex items-center space-x-1.5 text-xs font-mono font-bold text-cyan-300">
                                      <Clock className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                                      <span>{countdown.text}</span>
                                    </span>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-200 font-mono uppercase">
                                      {u.planDuration ? getPlanOption(u.planDuration).durationLabel : 'Active'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-0.5 border-t border-slate-900">
                                    <span>Unlocked: <strong className="text-white">{u.maxCredentialSlots || 30} slots</strong></span>
                                    <span className="text-emerald-400 flex items-center gap-0.5 text-[9px] font-sans">
                                      <Lock className="w-2.5 h-2.5" />
                                      <span>Hidden on user UI</span>
                                    </span>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div className="text-[11px] font-mono text-slate-400 min-w-[170px]">
                                <span className="text-slate-400">Standard Free Tier</span>
                                <span className="block text-[10px] text-slate-500 font-sans">No active countdown timer</span>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Admin Controls */}
                        <td className="py-3.5 px-4">
                          {isUserOwnerAdmin ? (
                            <div className="flex items-center space-x-2">
                              <span className="text-[11px] text-purple-400 font-mono italic">Administrator</span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1.5 min-w-[220px]">
                              {/* Plan Approval Buttons (Permission 2: giveSlots) */}
                              <div className="flex items-center gap-1 flex-wrap">
                                <button
                                  onClick={() => handleApprovePlan(u.userId, u.email, 'biweekly')}
                                  disabled={!isSuperAdmin && !currentAdminPerms.giveSlots}
                                  className="text-[10px] px-2 py-0.5 rounded font-mono bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 transition-all cursor-pointer font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Approve 2-Weekly Plan: 14 Days, +20 slots (30 total), ₦2,000"
                                >
                                  +2-Wk (14d)
                                </button>
                                <button
                                  onClick={() => handleApprovePlan(u.userId, u.email, 'monthly')}
                                  disabled={!isSuperAdmin && !currentAdminPerms.giveSlots}
                                  className="text-[10px] px-2 py-0.5 rounded font-mono bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 transition-all cursor-pointer font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Approve Monthly Plan: 30 Days, 50 slots total, ₦8,000"
                                >
                                  +Month (30d)
                                </button>
                                <button
                                  onClick={() => handleApprovePlan(u.userId, u.email, 'yearly')}
                                  disabled={!isSuperAdmin && !currentAdminPerms.giveSlots}
                                  className="text-[10px] px-2 py-0.5 rounded font-mono bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-700/60 transition-all cursor-pointer font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Approve Yearly Plan: 365 Days, Unlimited slots, ₦15,000"
                                >
                                  +Year (365d)
                                </button>
                              </div>

                              {/* Countdown Extensions and Expiry testing */}
                              {u.expiresAt && !formatRemainingCountdown(u.expiresAt).isExpired && (
                                <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-slate-800">
                                  <button
                                    onClick={() => handleExtendCountdown(u.userId, u.email, u.expiresAt, 7)}
                                    disabled={!isSuperAdmin && !currentAdminPerms.giveSlots}
                                    className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Extend countdown by +7 days"
                                  >
                                    +7d
                                  </button>
                                  <button
                                    onClick={() => handleExtendCountdown(u.userId, u.email, u.expiresAt, 14)}
                                    disabled={!isSuperAdmin && !currentAdminPerms.giveSlots}
                                    className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Extend countdown by +14 days"
                                  >
                                    +14d
                                  </button>
                                  <button
                                    onClick={() => handleExpireNow(u.userId, u.email)}
                                    disabled={!isSuperAdmin && !currentAdminPerms.giveSlots}
                                    className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 transition-all cursor-pointer font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Expire countdown immediately to test space reset & view-only slots"
                                  >
                                    Expire Now
                                  </button>
                                </div>
                              )}

                              {/* Appoint as Admin & Permanent Unlimited */}
                              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                {(isSuperAdmin || currentAdminPerms.addAdmins) && (
                                  <button
                                    onClick={() => {
                                      setNewAdminIdentifier(u.userId);
                                      setActiveTab('admins');
                                    }}
                                    className="text-[9px] px-2 py-0.5 rounded font-mono bg-purple-950/60 hover:bg-purple-900 text-purple-300 border border-purple-700/60 transition-colors cursor-pointer flex items-center gap-1"
                                    title="Appoint this user as Administrator"
                                  >
                                    <UserPlus className="w-2.5 h-2.5" />
                                    <span>Make Admin</span>
                                  </button>
                                )}

                                {(isSuperAdmin || currentAdminPerms.giveSlots) && (
                                  <button
                                    onClick={() => handleGrantUnlimited(u.userId, u.email)}
                                    className="text-[9px] px-1.5 py-0.5 rounded font-mono text-purple-300 hover:text-white transition-colors cursor-pointer"
                                    title="Make permanently unlimited without countdown"
                                  >
                                    👑 VIP
                                  </button>
                                )}

                                {(u.plan !== 'free' || u.expiresAt) && (isSuperAdmin || currentAdminPerms.giveSlots) && (
                                  <button
                                    onClick={() => handleResetUserFree(u.userId, u.email)}
                                    className="text-[9px] px-1.5 py-0.5 rounded font-mono text-rose-400 hover:text-rose-300 hover:underline transition-colors cursor-pointer ml-auto"
                                    title="Reset user back to base free 10 slots"
                                  >
                                    Reset Free
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Account Status & Banning / Unbanning Controls (User Request 3 #6) */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isUserOwnerAdmin ? (
                            <span className="text-[10px] text-purple-400 font-mono">Protected</span>
                          ) : isBanned ? (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950 border border-rose-500 text-rose-300 font-bold">
                                <Slash className="w-3 h-3 text-rose-400" />
                                <span>BANNED</span>
                              </span>
                              {u.bannedReason && (
                                <span className="text-[9px] text-rose-300 max-w-[130px] truncate" title={u.bannedReason}>
                                  {u.bannedReason}
                                </span>
                              )}

                              {/* Unban Button: Strictly Superadmin role per instructions! */}
                              {isSuperAdmin ? (
                                <button
                                  onClick={() => handleUnbanUser(u)}
                                  className="text-[9px] px-2 py-0.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-600/60 text-emerald-300 rounded font-mono font-bold cursor-pointer transition-colors inline-flex items-center gap-1"
                                  title="Superadmin Power: Unban this user account"
                                >
                                  <UserCheck className="w-3 h-3 text-emerald-400" />
                                  <span>Unban Account</span>
                                </button>
                              ) : (
                                <span
                                  className="text-[9px] text-slate-500 font-mono italic"
                                  title="Unbanning is strictly reserved for the primary superadmin"
                                >
                                  Superadmin unban only
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center space-x-1 text-[10px] font-mono text-emerald-400 font-medium">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Active</span>
                              </span>

                              {/* Ban Button: Appointed admins with banUsers, or Superadmin */}
                              {(isSuperAdmin || currentAdminPerms.banUsers) && (
                                <button
                                  onClick={() => handleOpenBanModal(u)}
                                  className="text-[9px] px-2 py-0.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 rounded font-mono cursor-pointer transition-colors inline-flex items-center gap-1"
                                  title="Ban suspicious user"
                                >
                                  <UserX className="w-3 h-3 text-rose-400" />
                                  <span>Ban User</span>
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Registered Date */}
                        <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                          <div className="flex items-center space-x-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <span>{formatDate(u.createdAt)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: EDIT ADMINISTRATOR PERMISSIONS (ALL 8 PERMISSIONS)    */}
      {/* ============================================================== */}
      {editingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-purple-500/40 rounded-2xl p-6 shadow-2xl shadow-purple-950/50 tech-corners space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingAdmin(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 bg-purple-950 border border-purple-500/40 rounded-xl text-purple-300">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Edit Administrator Permissions
                </h3>
                <p className="text-xs text-purple-300 font-mono">
                  {editingAdmin.email} (UID: {editingAdmin.userId})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Configure each specific authority granted to this appointed administrator. Changes take effect across the console immediately upon saving.
            </p>

            {/* Permissions Toggles List */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800">
              {/* Permission 1 */}
              <label className="flex items-start justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/40 cursor-pointer transition-colors">
                <div className="pr-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white">1. View Full Information of Registered Users</span>
                    {permEditState.viewFullUserInfo ? (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-700 font-mono">Full Info</span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">UID Only</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    When checked: Admin views full email addresses, display names, and profile photos. When unchecked: Admin sees only user verification UIDs; personal info is masked.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={permEditState.viewFullUserInfo}
                  onChange={(e) => setPermEditState({ ...permEditState, viewFullUserInfo: e.target.checked })}
                  className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
              </label>

              {/* Permission 2 */}
              <label className="flex items-start justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/40 cursor-pointer transition-colors">
                <div className="pr-3">
                  <div className="text-xs font-bold text-white">2. Ability to Give Slots & Approve Plans</div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Permits admin to approve 2-Weekly, Monthly, or Yearly plans, extend countdown clocks, and grant credential slots to users.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={permEditState.giveSlots}
                  onChange={(e) => setPermEditState({ ...permEditState, giveSlots: e.target.checked })}
                  className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
              </label>

              {/* Permission 3 */}
              <label className="flex items-start justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/40 cursor-pointer transition-colors">
                <div className="pr-3">
                  <div className="text-xs font-bold text-white">3. Ability to Answer Complaints</div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Permits admin to review customer complaints, compose replies via Gmail, and mark issues as resolved or reviewed.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={permEditState.answerComplaints}
                  onChange={(e) => setPermEditState({ ...permEditState, answerComplaints: e.target.checked })}
                  className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
              </label>

              {/* Permission 4 */}
              <label className="flex items-start justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/40 cursor-pointer transition-colors">
                <div className="pr-3">
                  <div className="text-xs font-bold text-white">4. Ability to Redirect Important Suggestions to Me</div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Allows admin to flag high-value user recommendations and forward them directly to the primary admin (Faith Oluwole) with attached audit notes.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={permEditState.redirectSuggestions}
                  onChange={(e) => setPermEditState({ ...permEditState, redirectSuggestions: e.target.checked })}
                  className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
              </label>

              {/* Permission 5 */}
              <label className="flex items-start justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/40 cursor-pointer transition-colors">
                <div className="pr-3">
                  <div className="text-xs font-bold text-white">5. Ability to View Transactions</div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Access to the Bank Transfer Queue and the verified transactions audit archive.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={permEditState.viewTransactions}
                  onChange={(e) => setPermEditState({ ...permEditState, viewTransactions: e.target.checked })}
                  className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
              </label>

              {/* Permission 6 */}
              <label className="flex items-start justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/40 cursor-pointer transition-colors">
                <div className="pr-3">
                  <div className="text-xs font-bold text-white">6. Ability to Ban Users (Unbanning is Strictly Primary Owner Role)</div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Appointed admin can ban suspicious or malicious users. Note: Unbanning is strictly reserved for the primary superadmin.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={permEditState.banUsers}
                  onChange={(e) => setPermEditState({ ...permEditState, banUsers: e.target.checked })}
                  className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
              </label>

              {/* Permission 7 */}
              <label className="flex items-start justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/40 cursor-pointer transition-colors">
                <div className="pr-3">
                  <div className="text-xs font-bold text-white">7. Ability to Add Admins</div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Permits admin to appoint new administrators and modify admin permission matrices.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={permEditState.addAdmins}
                  onChange={(e) => setPermEditState({ ...permEditState, addAdmins: e.target.checked })}
                  className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
              </label>

              {/* Permission 8 */}
              <label className="flex items-start justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/40 cursor-pointer transition-colors">
                <div className="pr-3">
                  <div className="text-xs font-bold text-white">8. Ability to Receive Transaction Notices & Notify Me of Purchase</div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Shows incoming transfer badges so admin can check incoming payments and notify the primary admin of purchase transactions.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={permEditState.receiveTransactionNotices}
                  onChange={(e) => setPermEditState({ ...permEditState, receiveTransactionNotices: e.target.checked })}
                  className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
              </label>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingAdmin(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingPerms}
                onClick={handleSavePermissions}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-950/50 cursor-pointer disabled:opacity-50 transition-all flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isSavingPerms ? 'Saving Changes...' : 'Save Permissions'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: BAN USER CONFIRMATION                                 */}
      {/* ============================================================== */}
      {banningUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-2xl p-6 shadow-2xl shadow-rose-950/50 tech-corners space-y-4">
            <button
              onClick={() => setBanningUser(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 bg-rose-950 border border-rose-500/40 rounded-xl text-rose-300">
                <UserX className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Ban User Account
                </h3>
                <p className="text-xs text-rose-300 font-mono">
                  UID: {banningUser.userId}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Banning this account immediately suspends user access to their vault and marks the account in audit logs. Note: Unbanning is strictly reserved for the primary superadmin.
            </p>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Reason for Ban
              </label>
              <textarea
                rows={3}
                value={banReasonInput}
                onChange={(e) => setBanReasonInput(e.target.value)}
                placeholder="State the reason for banning this account..."
                className="w-full bg-slate-950 border border-rose-500/30 focus:border-rose-400 rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none font-sans"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setBanningUser(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingBan || !banReasonInput.trim()}
                onClick={handleConfirmBanUser}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/50 cursor-pointer disabled:opacity-50 transition-all flex items-center space-x-1.5"
              >
                <Slash className="w-3.5 h-3.5" />
                <span>{isSubmittingBan ? 'Banning...' : 'Confirm Ban'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: REDIRECT SUGGESTION TO PRIMARY ADMIN                   */}
      {/* ============================================================== */}
      {redirectingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-purple-500/40 rounded-2xl p-6 shadow-2xl shadow-purple-950/50 tech-corners space-y-4">
            <button
              onClick={() => setRedirectingTicket(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 bg-purple-950 border border-purple-500/40 rounded-xl text-purple-300">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Redirect Suggestion to Primary Admin
                </h3>
                <p className="text-xs text-purple-300 font-mono">
                  Forward to: {ADMIN_EMAIL}
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
              <span className="text-[10px] uppercase font-mono text-slate-500 block">User Suggestion:</span>
              <strong className="text-white block mt-0.5">{redirectingTicket.subject}</strong>
              <p className="text-slate-300 mt-1 line-clamp-3 font-sans">{redirectingTicket.message}</p>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Your Strategic Forwarding Note
              </label>
              <textarea
                rows={3}
                value={redirectNoteInput}
                onChange={(e) => setRedirectNoteInput(e.target.value)}
                placeholder="Add your evaluation or why this suggestion is important..."
                className="w-full bg-slate-950 border border-purple-500/30 focus:border-purple-400 rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none font-sans"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRedirectingTicket(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingRedirect}
                onClick={handleConfirmRedirectSuggestion}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-950/50 cursor-pointer disabled:opacity-50 transition-all flex items-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmittingRedirect ? 'Forwarding...' : 'Forward to Admin'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
